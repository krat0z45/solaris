
"use client";

import React, { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError, useCollection } from "@/firebase";
import { addDoc, collection, doc, updateDoc, query } from "firebase/firestore";
import { z } from "zod";
import type { Milestone, ProjectType, SubMilestone } from "@/lib/types";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const milestoneSchema = z.object({
  name: z.string().min(1, "Milestone name is required."),
  description: z.string().min(1, "Description is required."),
  projectTypes: z.array(z.string()).min(1, "At least one project type is required."),
  subMilestones: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Sub-milestone name cannot be empty.")
  })).min(1, "At least one sub-milestone is required."),
});

type MilestoneFormProps = {
    milestone?: Milestone;
    onSuccess?: () => void;
};

export default function MilestoneForm({ milestone, onSuccess }: MilestoneFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const [projectTypes, setProjectTypes] = useState<string[]>(milestone?.projectTypes || []);
  const [subMilestones, setSubMilestones] = useState<SubMilestone[]>(milestone?.subMilestones || [{id: crypto.randomUUID(), name: ''}]);

  // Fetch dynamic project types
  const projectTypesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "projectTypes"));
  }, [firestore]);
  const { data: availableProjectTypes, isLoading: projectTypesLoading } = useCollection<ProjectType>(projectTypesQuery);

  const handleAddSubMilestone = () => {
    setSubMilestones([...subMilestones, { id: crypto.randomUUID(), name: '' }]);
  };

  const handleSubMilestoneChange = (index: number, name: string) => {
    const newSubMilestones = [...subMilestones];
    newSubMilestones[index].name = name;
    setSubMilestones(newSubMilestones);
  };
  
  const handleRemoveSubMilestone = (index: number) => {
    const newSubMilestones = subMilestones.filter((_, i) => i !== index);
    setSubMilestones(newSubMilestones);
  };

  const handleProjectTypeChange = (typeId: string, checked: boolean) => {
    setProjectTypes(prev => 
      checked ? [...prev, typeId] : prev.filter(pt => pt !== typeId)
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const milestoneDataToValidate = {
        name,
        description,
        projectTypes,
        subMilestones: subMilestones.filter(sm => sm.name.trim() !== '')
    };

    const validatedFields = milestoneSchema.safeParse(milestoneDataToValidate);

    if (!validatedFields.success) {
      const errorMessage = Object.values(validatedFields.error.flatten().fieldErrors).flat().join("\n");
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: errorMessage || "Please check the form fields.",
      });
      return;
    }

    const milestoneData = validatedFields.data;
    
    const handleSuccess = () => {
      toast({
        title: "Success",
        description: `Milestone ${milestone ? 'updated' : 'created'} successfully.`,
      });
      formRef.current?.reset();
      onSuccess?.();
    };
    
    const handleError = (e: any, operation: 'create' | 'update') => {
      if (e.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: milestone ? `milestones/${milestone.id}` : 'milestones',
              operation,
              requestResourceData: milestoneData,
          });
          errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({
            variant: "destructive",
            title: "Error",
            description: e.message || "An unexpected error occurred while saving the milestone.",
        });
      }
    };

    if (milestone) {
        const milestoneRef = doc(firestore, 'milestones', milestone.id);
        updateDoc(milestoneRef, milestoneData)
          .then(handleSuccess)
          .catch((e) => handleError(e, 'update'));
    } else {
        const milestonesColRef = collection(firestore, 'milestones');
        addDoc(milestonesColRef, milestoneData)
          .then(handleSuccess)
          .catch((e) => handleError(e, 'create'));
    }
  };

  if (projectTypesLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 py-6">
      <div className="space-y-2">
        <Label htmlFor="name">Milestone Name</Label>
        <Input id="name" name="name" defaultValue={milestone?.name} placeholder="e.g. Site Survey" required />
      </div>
       <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={milestone?.description} placeholder="Describe what this milestone entails." required />
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Project Types</CardTitle>
            <CardDescription>Select all project types this milestone applies to.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
            {availableProjectTypes?.map((pt) => (
                <div key={pt.id} className="flex items-center space-x-2">
                    <Checkbox
                        id={`project-type-${pt.id}`}
                        checked={projectTypes.includes(pt.id)}
                        onCheckedChange={(checked) => handleProjectTypeChange(pt.id, !!checked)}
                    />
                    <Label htmlFor={`project-type-${pt.id}`}>{pt.name}</Label>
                </div>
            ))}
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>Sub-Milestones</CardTitle>
              <CardDescription>Define the individual tasks for this milestone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {subMilestones.map((sub, index) => (
                  <div key={sub.id} className="flex items-center gap-2">
                      <Input
                          value={sub.name}
                          onChange={(e) => handleSubMilestoneChange(index, e.target.value)}
                          placeholder={`Sub-milestone ${index + 1}`}
                          required
                      />
                      <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSubMilestone(index)}
                          disabled={subMilestones.length <= 1}
                          className="text-destructive hover:text-destructive"
                      >
                          <Trash2 className="h-4 w-4" />
                      </Button>
                  </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddSubMilestone}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Sub-Milestone
              </Button>
          </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">{milestone ? 'Save Changes' : 'Create Milestone'}</Button>
      </div>
    </form>
  );
}

    