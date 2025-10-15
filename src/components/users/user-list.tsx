"use client";

import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { User } from "@/lib/types";
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
import UserActions from "./user-actions";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
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
                        You do not have permission to view the list of users.
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
          <h3 className="text-lg font-medium">No Users Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by adding your first user.
          </p>
          <UserActions />
        </div>
      </CardContent>
    </Card>
  );
}

export default function UserList() {
  const firestore = useFirestore();
  const { user: currentUser, isUserLoading } = useUser();
  const { toast } = useToast();

  const usersQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, "users"), orderBy("name"));
  }, [firestore, currentUser]);

  const { data: users, isLoading, error } = useCollection<User>(usersQuery, {
    disabled: isUserLoading || !currentUser
  });

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (user: User) => {
    if (!firestore || currentUser?.role !== 'admin' || user.id === currentUser.id) {
        toast({
            variant: "destructive",
            title: "Action Forbidden",
            description: user.id === currentUser.id ? "You cannot delete your own account." : "You do not have permission to delete users.",
        });
        return;
    }
    setIsDeleting(user.id);
    
    const userRef = doc(firestore, "users", user.id);

    deleteDoc(userRef)
      .then(() => {
        toast({
          title: "Success",
          description: "User deleted successfully.",
        });
      })
      .catch((e: any) => {
        if (e.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: e.message || "Failed to delete user.",
          });
        }
      })
      .finally(() => {
        setIsDeleting(null);
      });
  };

  const finalLoading = isUserLoading || (currentUser && isLoading);

  if (finalLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!users || users.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatarUrl} alt={user.name} />
                            <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                        <UserActions userToEdit={user} />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" disabled={isDeleting === user.id || user.id === currentUser.id}>
                                    {isDeleting === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the user "{user.name}". This only deletes the Firestore record, not the auth user.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(user)} className="bg-destructive hover:bg-destructive/90">
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