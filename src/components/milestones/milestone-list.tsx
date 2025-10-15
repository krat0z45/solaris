
"use client";

import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle, Trash2, CheckCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Milestone, ProjectType } from "@/lib/types";
import MilestoneActions from "./milestone-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Badge } from "../ui/badge";

function ErrorState({ error }: { error: Error }) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="text-center py-12 border-2 border-dashed rounded-lg border-destructive/50 bg-destructive/5 text-destructive">
                    <div className="flex justify-center">
                        <AlertTriangle className="h-8 w-8 mb-4" />
                    </div>
                    <h3 className="text-lg font-medium">Permission Denied</h3>
                    <p className="text-sm">
                        You do not have permission to view the list of milestones.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-medium">No Milestones Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by adding your first milestone.
          </p>
          <MilestoneActions />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MilestoneList() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const milestonesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, "milestones"), orderBy("name"));
  }, [firestore, user]);

  const { data: milestones, isLoading: isLoadingMilestones, error } = useCollection<Milestone>(milestonesQuery, {
    disabled: isUserLoading || !user
  });
  
  // Fetch dynamic project types
  const projectTypesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "projectTypes"));
  }, [firestore]);
  const { data: projectTypes, isLoading: projectTypesLoading } = useCollection<ProjectType>(projectTypesQuery);
  
  const projectTypeMap = useMemo(() => {
    if (!projectTypes) return new Map();
    return new Map(projectTypes.map(pt => [pt.id, pt.name]));
  }, [projectTypes]);


  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (milestoneId: string) => {
    if (!firestore) return;
    setIsDeleting(milestoneId);
    
    const milestoneRef = doc(firestore, "milestones", milestoneId);

    deleteDoc(milestoneRef)
      .then(() => {
        toast({
          title: "Success",
          description: "Milestone deleted successfully.",
        });
      })
      .catch((e: any) => {
        if (e.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: milestoneRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: e.message || "Failed to delete milestone.",
          });
        }
      })
      .finally(() => {
        setIsDeleting(null);
      });
  };

  const isLoading = isUserLoading || isLoadingMilestones || projectTypesLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!milestones || milestones.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {milestones.map((milestone) => (
            <Card key={milestone.id}>
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle>{milestone.name}</CardTitle>
                        <CardDescription>{milestone.description}</CardDescription>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {milestone.projectTypes && milestone.projectTypes.map(ptId => (
                                <Badge key={ptId} variant="secondary">{projectTypeMap.get(ptId) || ptId}</Badge>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                       <MilestoneActions milestone={milestone} />
                       <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isDeleting === milestone.id}>
                                    {isDeleting === milestone.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the milestone "{milestone.name}".
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(milestone.id)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Sub-Milestones</h4>
                    <div className="space-y-2 pl-4 border-l">
                        {milestone.subMilestones && milestone.subMilestones.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                <p className="text-sm">{sub.name}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        ))}
      </div>
    </div>
  );
}

    