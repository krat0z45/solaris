
"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { updateProfile, updateEmail, type User } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { z } from "zod";
import { Loader2 } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(1, "Full name is required."),
  email: z.string().email("Invalid email address."),
});

export default function ProfileForm({ user, onSuccess }: { user: User, onSuccess?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !auth.currentUser) return;
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const data = {
        name: formData.get("name") as string,
        email: formData.get("email") as string,
    };

    const validatedFields = profileSchema.safeParse(data);

    if (!validatedFields.success) {
      const errorMessage = Object.values(validatedFields.error.flatten().fieldErrors).flat().join("\n");
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: errorMessage,
      });
      setIsSubmitting(false);
      return;
    }

    const { name, email } = validatedFields.data;
    const currentUser = auth.currentUser;

    try {
        const promises = [];

        // Update Auth Profile if name changed
        if (name !== currentUser.displayName) {
            promises.push(updateProfile(currentUser, { displayName: name }));
        }

        // Update email if it changed
        if (email !== currentUser.email) {
            promises.push(updateEmail(currentUser, email));
        }

        // Update Firestore document
        const userDocRef = doc(firestore, "users", currentUser.uid);
        promises.push(updateDoc(userDocRef, { name, email }));

        await Promise.all(promises);

        toast({
            title: "Profile Updated",
            description: "Your information has been successfully saved.",
        });
        onSuccess?.();

    } catch (error: any) {
      console.error(error);
      let description = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/requires-recent-login') {
        description = "This action is sensitive and requires recent authentication. Please log out and log back in before updating your profile.";
      } else if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `users/${currentUser.uid}`,
            operation: 'update',
            requestResourceData: { name, email },
        }));
        description = "You don't have permission to update this profile.";
      }
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: description,
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 py-6">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" defaultValue={user.displayName || ""} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" name="email" type="email" defaultValue={user.email || ""} required />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
