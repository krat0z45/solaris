
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
import type { ProjectType } from "@/lib/types";
import ProjectTypeForm from "./project-type-form";
import { useUser } from "@/firebase";

type ProjectTypeActionsProps = {
  projectType?: ProjectType;
};

export default function ProjectTypeActions({ projectType }: ProjectTypeActionsProps) {
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
        {projectType ? (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Project Type
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{projectType ? "Edit Project Type" : "Add New Project Type"}</SheetTitle>
          <SheetDescription>
            {projectType
              ? "Update the name for this project type."
              : "Enter the name for the new project type."}
          </SheetDescription>
        </SheetHeader>
        <ProjectTypeForm
            projectType={projectType}
            onSuccess={handleSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}

    