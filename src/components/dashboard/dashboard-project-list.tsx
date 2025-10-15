
"use client";

import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import type { Project } from "@/lib/types";
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { formatDate } from "@/lib/utils";

export default function DashboardProjectList() {
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  
  const projectsQuery = useMemo(() => {
    if (!user) return null; 
    return query(collection(firestore, "projects"), orderBy("startDate", "desc"), limit(5));
  }, [firestore, user]);

  const { data: recentProjects, isLoading: isDataLoading, error } = useCollection<Project>(projectsQuery, {
    disabled: !user 
  });
  
  const isLoading = isAuthLoading || (user && isDataLoading);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!user) {
    return null; 
  }

  if (error) {
    return <p className="p-4 text-destructive">Error loading projects: {error.message}</p>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {recentProjects && recentProjects.length > 0 ? (
            recentProjects.map((project: Project) => (
              <div key={project.id} className="p-4 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                   <Link href={`/projects/${project.id}`} className="font-medium hover:underline">{project.name}</Link>
                   <p className="text-xs text-muted-foreground">{formatDate(project.startDate)}</p>
                </div>
                <Badge variant="outline">{project.status}</Badge>
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-muted-foreground">No recent projects found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
