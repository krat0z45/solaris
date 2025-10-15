
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
import { Edit } from "lucide-react";
import type { User } from "firebase/auth";
import ProfileForm from "./profile-form";

export default function EditProfileSheet({ user }: { user: User }) {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Edit className="mr-2 h-4 w-4" />
          Modificar Perfil
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit Profile</SheetTitle>
          <SheetDescription>
            Update your account information.
          </SheetDescription>
        </SheetHeader>
        <ProfileForm user={user} onSuccess={handleSuccess} />
      </SheetContent>
    </Sheet>
  );
}
