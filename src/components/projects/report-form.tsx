
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Project, WeeklyReport, Milestone } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "../ui/progress";
import { useCollection, useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, query, where, doc, setDoc, addDoc, updateDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

const reportSchema = z.object({
    summary: z.string().min(1, "Summary is required."),
    status: z.enum(["On Track", "At Risk", "Off Track"]),
    completedSubMilestones: z.array(z.string()).optional(),
    progress: z.number().min(0).max(100),
});

type ReportFormProps = {
  project: Project;
  report: WeeklyReport;
  previouslyCompletedSubMilestones: string[];
};

export default function ReportForm({ project, report, previouslyCompletedSubMilestones }: ReportFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  const [summary, setSummary] = useState(report.summary || '');
  const [status, setStatus] = useState<WeeklyReport['status']>(report.status || 'On Track');
  const [checkedSubMilestones, setCheckedSubMilestones] = useState<string[]>([]);
  
  const milestoneIds = useMemo(() => project.milestones.map(m => m.milestoneId), [project]);
  
  const milestonesQuery = useMemo(() => {
    if (!firestore || milestoneIds.length === 0) return null;
    return query(collection(firestore, "milestones"), where("__name__", "in", milestoneIds));
  }, [firestore, milestoneIds]);

  const { data: projectMilestones, isLoading: milestonesLoading } = useCollection<Milestone>(milestonesQuery, {
      disabled: milestoneIds.length === 0
  });

  const allSubMilestones = useMemo(() => {
    return projectMilestones?.flatMap(m => m.subMilestones) || [];
  }, [projectMilestones]);

  useEffect(() => {
    const initialSubMilestones = new Set([
        ...previouslyCompletedSubMilestones, 
        ...(report.completedSubMilestones || [])
    ]);
    setCheckedSubMilestones(Array.from(initialSubMilestones));
  }, [report.id, previouslyCompletedSubMilestones, report.completedSubMilestones]);

  const progressValue = useMemo(() => {
    if (!allSubMilestones || allSubMilestones.length === 0) return 0;
    return Math.round((checkedSubMilestones.length / allSubMilestones.length) * 100);
  }, [checkedSubMilestones, allSubMilestones]);

  const handleCheckboxChange = (subMilestoneId: string, checked: boolean) => {
    setCheckedSubMilestones(prev => 
      checked ? [...prev, subMilestoneId] : prev.filter(id => id !== subMilestoneId)
    );
  };
  
  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (allSubMilestones.length > 0 && checkedSubMilestones.length === allSubMilestones.length && project.status !== 'Completed') {
      setShowCompletionDialog(true);
    } else {
      await saveReportAndProject();
    }
  };
  
  const saveReportAndProject = async (markProjectAsCompleted = false) => {
    if (!firestore) return;
    setIsSubmitting(true);
    setShowCompletionDialog(false);

    const reportDataForValidation = {
      summary,
      status,
      completedSubMilestones: checkedSubMilestones,
      progress: progressValue,
    };

    const validatedFields = reportSchema.safeParse(reportDataForValidation);

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

    const finalReportData = {
      projectId: report.projectId,
      week: report.week,
      createdAt: report.id ? report.createdAt : new Date().toISOString(),
      ...validatedFields.data,
    };
    
    const isNewReport = !report.id;
    const reportsCollectionRef = collection(firestore, `projects/${project.id}/weeklyReports`);
    
    try {
        const reportPromise = isNewReport 
            ? addDoc(reportsCollectionRef, finalReportData) 
            : updateDoc(doc(reportsCollectionRef, report.id!), finalReportData);

        const promises = [reportPromise];

        if (markProjectAsCompleted) {
            const projectRef = doc(firestore, 'projects', project.id);
            const projectUpdatePromise = updateDoc(projectRef, { status: 'Completed' });
            promises.push(projectUpdatePromise);
        }
        
      await Promise.all(promises);
      toast({
        title: "Success",
        description: `Report ${isNewReport ? 'created' : 'updated'}. Project status ${markProjectAsCompleted ? 'set to Completed' : 'remains unchanged'}.`,
      });
      router.push(`/projects/${project.id}`);

    } catch (e: any) {
        const isPermissionError = e.code === 'permission-denied';
        if (isPermissionError) {
             const permissionError = new FirestorePermissionError({
                path: 'Multiple operations',
                operation: 'write',
                requestResourceData: { report: finalReportData, projectUpdate: markProjectAsCompleted ? { status: 'Completed' } : undefined },
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             toast({
                variant: "destructive",
                title: "Error",
                description: e.message || `An unexpected error occurred.`,
            });
        }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (milestonesLoading) {
    return (
        <div className="flex justify-center items-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
  }

  return (
    <>
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Weekly Summary</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  id="summary"
                  name="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Provide a detailed summary of this week's progress, challenges, and next steps."
                  rows={10}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Completed Sub-Milestones Checklist</CardTitle>
                <CardDescription>Check off the individual tasks completed this week.</CardDescription>
              </CardHeader>
              <CardContent>
                {projectMilestones && projectMilestones.length > 0 ? (
                    <Accordion type="multiple" className="w-full" defaultValue={projectMilestones.map(m => m.id)}>
                        {projectMilestones.map((milestone) => (
                           <AccordionItem value={milestone.id} key={milestone.id}>
                                <AccordionTrigger>{milestone.name}</AccordionTrigger>
                                <AccordionContent className="pl-4">
                                    <div className="space-y-3">
                                    {milestone.subMilestones.map((subMilestone) => {
                                        const isPreviouslyCompleted = previouslyCompletedSubMilestones.includes(subMilestone.id);
                                        return (
                                            <div key={subMilestone.id} className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={`submilestone-${subMilestone.id}`}
                                                    checked={checkedSubMilestones.includes(subMilestone.id)}
                                                    onCheckedChange={(checked) => handleCheckboxChange(subMilestone.id, !!checked)}
                                                    disabled={isPreviouslyCompleted}
                                                />
                                                <Label htmlFor={`submilestone-${subMilestone.id}`} className={`font-normal ${isPreviouslyCompleted ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}>
                                                    {subMilestone.name}
                                                </Label>
                                            </div>
                                        );
                                    })}
                                    </div>
                                </AccordionContent>
                           </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">No milestone templates found for this project type.</p>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Weekly Status</CardTitle></CardHeader>
              <CardContent>
                <RadioGroup name="status" value={status} onValueChange={(value) => setStatus(value as WeeklyReport['status'])} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="On Track" id="on-track" />
                    <Label htmlFor="on-track">On Track</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="At Risk" id="at-risk" />
                    <Label htmlFor="at-risk">At Risk</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Off Track" id="off-track" />
                    <Label htmlFor="off-track">Off Track</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Overall Project Progress</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Progress value={progressValue} aria-label="Project progress" />
                  <span className="font-bold text-lg w-16 text-right tabular-nums">{progressValue}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Progress is calculated based on completed sub-milestones.</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Report"}
          </Button>
        </div>
      </form>
      <AlertDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Project Completion</AlertDialogTitle>
            <AlertDialogDescription>
              You have marked all sub-milestones as complete. Do you want to update the project's final status to "Completed"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => saveReportAndProject(false)} disabled={isSubmitting}>
              Just Save Report
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => saveReportAndProject(true)} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Confirm & Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
