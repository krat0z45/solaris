
"use client";

import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, Trash2, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProjectType } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import ProjectTypeActions from "./project-type-actions";

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
                        You do not have permission to view the list of project types.
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
          <Layers className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Project Types Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by adding your first project type.
          </p>
          <ProjectTypeActions />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectTypeList() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const projectTypesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, "projectTypes"), orderBy("name"));
  }, [firestore, user]);

  const { data: projectTypes, isLoading, error } = useCollection<ProjectType>(projectTypesQuery, {
    disabled: isUserLoading || !user
  });

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (type: ProjectType) => {
    if (!firestore || user?.role !== 'admin') return;
    setIsDeleting(type.id);
    
    const typeRef = doc(firestore, "projectTypes", type.id);

    deleteDoc(typeRef)
      .then(() => {
        toast({
          title: "Success",
          description: "Project type deleted successfully.",
        });
      })
      .catch((e: any) => {
        if (e.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: typeRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: e.message || "Failed to delete project type.",
          });
        }
      })
      .finally(() => {
        setIsDeleting(null);
      });
  };

  const finalLoading = isUserLoading || (user && isLoading);

  if (finalLoading) {
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

  if (!projectTypes || projectTypes.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                        <ProjectTypeActions projectType={type} />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" disabled={isDeleting === type.id}>
                                    {isDeleting === type.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the project type "{type.name}".
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(type)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

    