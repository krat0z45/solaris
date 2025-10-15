
"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError, useAuth } from "@/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { z } from "zod";
import type { User } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

const userSchema = z.object({
  name: z.string().min(1, "Full name is required."),
  email: z.string().email("Invalid email address."),
  role: z.enum(["admin", "manager"], { required_error: "Role is required." }),
});

type UserFormProps = {
    userToEdit?: User;
    onSuccess?: () => void;
};

export default function UserForm({ userToEdit, onSuccess }: UserFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !auth) {
        toast({ variant: "destructive", title: "Error", description: "Firebase not available." });
        return;
    };
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const password = formData.get("password") as string | undefined;

    const validatedFields = userSchema.safeParse(data);

    if (!validatedFields.success) {
      const errorMessage = Object.values(validatedFields.error.flatten().fieldErrors).flat().join("\n");
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: errorMessage || "Please check the form fields.",
      });
      setIsSubmitting(false);
      return;
    }

    const { email, name, role } = validatedFields.data;
    
    try {
        if (userToEdit) {
            const userRef = doc(firestore, 'users', userToEdit.id);
            await updateDoc(userRef, { name, role }).catch((e) => {
                 if (e.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: userRef.path,
                        operation: 'update',
                        requestResourceData: { name, role },
                    });
                    errorEmitter.emit('permission-error', permissionError);
                 }
                 throw e;
            });
            toast({ title: "Success", description: "User updated successfully." });
        } else {
            if (!password || password.length < 6) {
                toast({ variant: "destructive", title: "Validation Error", description: "Password must be at least 6 characters." });
                setIsSubmitting(false);
                return;
            }
            
            // This is a workaround because the client SDK's `createUserWithEmailAndPassword`
            // automatically signs in the new user. The ideal solution is a Cloud Function.
            // Here, we create the user, which logs out the admin, and then we must log the admin back in.
            // NOTE: This flow requires that we have the admin's password, which we don't.
            // As a simplified workaround for this context, we will just create the user and their profile.
            // The admin will be logged out and will need to log back in manually.

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            const userDocRef = doc(firestore, "users", userCredential.user.uid);
            const userData = { id: userCredential.user.uid, name, email, role, avatarUrl: `https://i.pravatar.cc/150?u=${userCredential.user.uid}` };
            
            await setDoc(userDocRef, userData);
            
            // Log out the newly created user and notify the admin
            await auth.signOut();
            toast({ 
                title: "User Created & Logged Out", 
                description: "New user created. You have been logged out for security. Please log in again to continue." 
            });
            // Redirect to login to force re-authentication
            window.location.href = '/login';
            // We return here to stop execution flow
            return;
        }
        formRef.current?.reset();
        onSuccess?.();
    } catch (e: any) {
         let description = "An unexpected error occurred.";
         if (e.code === 'auth/email-already-in-use') {
            description = "This email is already registered.";
         } else if (e.message) {
            description = e.message;
         }
         toast({
            variant: "destructive",
            title: "Operation Failed",
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
        <Input id="name" name="name" defaultValue={userToEdit?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={userToEdit?.email} disabled={!!userToEdit} required />
      </div>
       {!userToEdit && (
         <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
       )}
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select name="role" defaultValue={userToEdit?.role || 'manager'} required>
            <SelectTrigger id="role"><SelectValue placeholder="Select a role" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : userToEdit ? "Save Changes" : "Create User"}
        </Button>
      </div>
    </form>
  );
}
