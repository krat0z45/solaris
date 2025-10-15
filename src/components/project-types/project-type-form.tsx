
"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { z } from "zod";
import type { ProjectType } from "@/lib/types";

const projectTypeSchema = z.object({
  name: z.string().min(1, "Project type name is required."),
});

type ProjectTypeFormProps = {
    projectType?: ProjectType;
    onSuccess?: () => void;
};

export default function ProjectTypeForm({ projectType, onSuccess }: ProjectTypeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const validatedFields = projectTypeSchema.safeParse(data);

    if (!validatedFields.success) {
      const errorMessage = Object.values(validatedFields.error.flatten().fieldErrors).flat().join("\n");
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: errorMessage || "Please check the form fields.",
      });
      return;
    }

    const projectTypeData = validatedFields.data;
    
    const handleSuccess = () => {
      toast({
        title: "Success",
        description: `Project type ${projectType ? 'updated' : 'created'} successfully.`,
      });
      formRef.current?.reset();
      onSuccess?.();
    };
    
    const handleError = (e: any, operation: 'create' | 'update') => {
      if (e.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: projectType ? `projectTypes/${projectType.id}` : 'projectTypes',
              operation,
              requestResourceData: projectTypeData,
          });
          errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({
            variant: "destructive",
            title: "Error",
            description: e.message || "An unexpected error occurred while saving the project type.",
        });
      }
    };

    if (projectType) {
        const typeRef = doc(firestore, 'projectTypes', projectType.id);
        updateDoc(typeRef, projectTypeData)
          .then(handleSuccess)
          .catch((e) => handleError(e, 'update'));
    } else {
        const typesColRef = collection(firestore, 'projectTypes');
        addDoc(typesColRef, projectTypeData)
          .then(handleSuccess)
          .catch((e) => handleError(e, 'create'));
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 py-6">
      <div className="space-y-2">
        <Label htmlFor="name">Project Type Name</Label>
        <Input id="name" name="name" defaultValue={projectType?.name} placeholder="e.g. Solar Panel Installation" required />
      </div>
      <div className="flex justify-end">
        <Button type="submit">{projectType ? 'Save Changes' : 'Create Project Type'}</Button>
      </div>
    </form>
  );
}

    