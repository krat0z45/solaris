
"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
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
import type { Client, Project, ProjectType, Milestone, ProjectMilestone } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useUser, useCollection, useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, query, addDoc, updateDoc, doc, where } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { addDays, format, isValid, parseISO } from "date-fns";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required."),
  clientId: z.string().min(1, "Client is required."),
  projectType: z.string().min(1, "Project type is required."),
  startDate: z.string().min(1, "Start date is required."),
  estimatedEndDate: z.string().min(1, "Estimated end date is required."),
  status: z.enum(["On Track", "At Risk", "Off Track", "On Hold", "Completed"]),
  milestones: z.array(z.object({
    id: z.string(),
    milestoneId: z.string(),
    milestoneStartDate: z.string().min(1, "Milestone start date is required."),
    milestoneEndDate: z.string().min(1, "Milestone end date is required."),
  })).min(1, "At least one milestone schedule is required."),
});


type ProjectFormProps = {
  project?: Project;
  onSuccess?: () => void;
};

export default function ProjectForm({ project, onSuccess }: ProjectFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState<string | undefined>(project?.projectType);
  const [projectStartDate, setProjectStartDate] = useState<string | undefined>(project?.startDate);
  const [projectEndDate, setProjectEndDate] = useState<string | undefined>(project?.estimatedEndDate);
  const [scheduledMilestones, setScheduledMilestones] = useState<ProjectMilestone[]>(project?.milestones || []);

  // --- Data Fetching ---
  const clientsQuery = useMemo(() => firestore ? query(collection(firestore, "clients")) : null, [firestore]);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);

  const projectTypesQuery = useMemo(() => firestore ? query(collection(firestore, "projectTypes")) : null, [firestore]);
  const { data: projectTypes, isLoading: projectTypesLoading } = useCollection<ProjectType>(projectTypesQuery);
  
  const milestonesQuery = useMemo(() => {
    if (!firestore || !selectedProjectType) return null;
    return query(collection(firestore, "milestones"), where("projectTypes", "array-contains", selectedProjectType));
  }, [firestore, selectedProjectType]);
  const { data: applicableMilestones, isLoading: milestonesLoading } = useCollection<Milestone>(milestonesQuery);

  // --- Effects ---
  // Effect to auto-populate or clear milestone schedules when project type changes
  useEffect(() => {
    if (applicableMilestones) {
      const newScheduledMilestones = applicableMilestones.map(m => {
        const existing = scheduledMilestones.find(sm => sm.milestoneId === m.id);
        // Use existing if it exists, otherwise create a new one with a unique ID
        return existing || { id: crypto.randomUUID(), milestoneId: m.id, milestoneStartDate: '', milestoneEndDate: '' };
      });
      setScheduledMilestones(newScheduledMilestones);
    } else {
      setScheduledMilestones([]);
    }
  }, [applicableMilestones, project?.id]); // Also depend on project.id to re-eval for edits


  // --- Event Handlers ---
  const handleMilestoneDateChange = (milestoneId: string, dateType: 'milestoneStartDate' | 'milestoneEndDate', value: string) => {
    setScheduledMilestones(prev => 
      prev.map(m => m.milestoneId === milestoneId ? { ...m, [dateType]: value } : m)
    );
  };
  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
        return;
    };
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const data = {
        name: formData.get("name"),
        clientId: formData.get("clientId"),
        projectType: selectedProjectType,
        startDate: projectStartDate,
        estimatedEndDate: projectEndDate,
        status: formData.get("status"),
        milestones: scheduledMilestones,
    };
    
    // Manual validation for milestone dates within project dates
    let dateError = '';
    if (projectStartDate && projectEndDate) {
        const pStart = parseISO(projectStartDate);
        const pEnd = parseISO(projectEndDate);
        if(!isValid(pStart) || !isValid(pEnd) || pStart > pEnd) {
            dateError = "Project start date must be before the end date.";
        } else {
            for (const ms of scheduledMilestones) {
                const mStart = parseISO(ms.milestoneStartDate);
                const mEnd = parseISO(ms.milestoneEndDate);
                if (!isValid(mStart) || !isValid(mEnd) || mStart > mEnd) {
                    dateError = `Invalid dates for a milestone. Start must be before end.`;
                    break;
                }
                if (mStart < pStart || mEnd > pEnd) {
                    dateError = `Milestone dates must be within the project's start and end dates.`;
                    break;
                }
            }
        }
    }

    if(dateError) {
        toast({ variant: "destructive", title: "Date Error", description: dateError });
        setIsSubmitting(false);
        return;
    }


    const validatedFields = projectSchema.safeParse(data);

    if (!validatedFields.success) {
      const errorMessage = Object.values(validatedFields.error.flatten().fieldErrors).flat().join("\n");
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: errorMessage || "Please check all fields.",
      });
      setIsSubmitting(false);
      return;
    }
    
    const projectData = { ...validatedFields.data, managerId: user.uid };

    try {
      if (project) {
        const projectRef = doc(firestore, 'projects', project.id);
        await updateDoc(projectRef, projectData).catch(e => {
           if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: projectRef.path,
                operation: 'update',
                requestResourceData: projectData,
            });
            errorEmitter.emit('permission-error', permissionError);
           }
        });
      } else {
        const projectsColRef = collection(firestore, 'projects');
        await addDoc(projectsColRef, projectData).catch(e => {
            if (e.code === 'permission-denied') {
              const permissionError = new FirestorePermissionError({
                  path: projectsColRef.path,
                  operation: 'create',
                  requestResourceData: projectData,
              });
              errorEmitter.emit('permission-error', permissionError);
            }
        });
      }

      toast({
        title: "Success",
        description: `Project ${project ? 'updated' : 'created'} successfully.`,
      });
      formRef.current?.reset();
      onSuccess?.();
    } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message || `An unexpected error occurred.` });
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Render Logic ---
  const isLoading = clientsLoading || projectTypesLoading;
  
  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 py-6">
      
      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input id="name" name="name" defaultValue={project?.name} placeholder="e.g. Innovate HQ Solar Roof" required/>
      </div>

       <div className="space-y-2">
          <Label htmlFor="clientId">Client</Label>
          <Select name="clientId" defaultValue={project?.clientId} required>
            <SelectTrigger id="clientId"><SelectValue placeholder="Select a client" /></SelectTrigger>
            <SelectContent>
              {clients?.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" name="startDate" type="date" value={projectStartDate || ''} onChange={e => setProjectStartDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
            <Label htmlFor="estimatedEndDate">Estimated End Date</Label>
            <Input id="estimatedEndDate" name="estimatedEndDate" type="date" value={projectEndDate || ''} onChange={e => setProjectEndDate(e.target.value)} required />
        </div>
      </div>

       <div className="space-y-2">
            <Label htmlFor="projectType">Project Type</Label>
            <Select name="projectType" value={selectedProjectType} onValueChange={setSelectedProjectType} required>
                <SelectTrigger id="projectType"><SelectValue placeholder="Select a type" /></SelectTrigger>
                <SelectContent>
                  {projectTypes?.map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        
        {milestonesLoading && (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/><span>Loading milestones...</span></div>
        )}

        {selectedProjectType && !milestonesLoading && applicableMilestones && (
            <Card>
                <CardHeader>
                    <CardTitle>Milestone Schedule</CardTitle>
                    <CardDescription>Set the timeline for each project milestone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full" defaultValue={applicableMilestones.map(m => m.id)}>
                        {applicableMilestones.map((milestone) => (
                           <AccordionItem value={milestone.id} key={milestone.id}>
                                <AccordionTrigger>{milestone.name}</AccordionTrigger>
                                <AccordionContent className="pl-1 pt-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`ms-start-${milestone.id}`} className="text-xs">Start Date</Label>
                                            <Input id={`ms-start-${milestone.id}`} type="date" 
                                               value={scheduledMilestones.find(sm => sm.milestoneId === milestone.id)?.milestoneStartDate || ''}
                                               onChange={(e) => handleMilestoneDateChange(milestone.id, 'milestoneStartDate', e.target.value)}
                                               min={projectStartDate} max={projectEndDate}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`ms-end-${milestone.id}`} className="text-xs">End Date</Label>
                                            <Input id={`ms-end-${milestone.id}`} type="date" 
                                               value={scheduledMilestones.find(sm => sm.milestoneId === milestone.id)?.milestoneEndDate || ''}
                                               onChange={(e) => handleMilestoneDateChange(milestone.id, 'milestoneEndDate', e.target.value)}
                                               min={scheduledMilestones.find(sm => sm.milestoneId === milestone.id)?.milestoneStartDate || projectStartDate}
                                               max={projectEndDate}
                                            />
                                        </div>
                                    </div>
                                </AccordionContent>
                           </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        )}

      <div className="space-y-2">
            <Label htmlFor="status">Project Status</Label>
            <Select name="status" defaultValue={project?.status || "On Track"} required>
                <SelectTrigger id="status"><SelectValue placeholder="Select a status" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="On Track">On Track</SelectItem>
                    <SelectItem value="At Risk">At Risk</SelectItem>
                    <SelectItem value="Off Track">Off Track</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
            </Select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || isLoading}>{isSubmitting ? 'Saving...' : project ? 'Save Changes' : 'Create Project'}</Button>
      </div>
    </form>
  );
}
