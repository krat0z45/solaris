"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { PlusCircle, Edit } from "lucide-react";
import type { User } from "@/lib/types";
import UserForm from "./user-form";
import { useUser } from "@/firebase";

type UserActionsProps = {
  userToEdit?: User;
};

export default function UserActions({ userToEdit }: UserActionsProps) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();

  const handleSuccess = () => {
    setOpen(false);
  };
  
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {userToEdit ? (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{userToEdit ? "Edit User" : "Add New User"}</SheetTitle>
          <SheetDescription>
            {userToEdit
              ? "Update the details for this user."
              : "Enter the details for the new user."}
          </SheetDescription>
        </SheetHeader>
        <UserForm
            userToEdit={userToEdit}
            onSuccess={handleSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}
