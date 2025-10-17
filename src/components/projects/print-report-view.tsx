
"use client";

import { useCollection, useFirestore } from "@/firebase";
import { CheckSquare, Square, Loader2 } from 'lucide-react';
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { collection, query, where } from "firebase/firestore";
import { useMemo, useState } from "react";
import type { Client, Project, User, WeeklyReport, Milestone } from "@/lib/types";

export default function PrintReportView({ 
    project, 
    client, 
    manager, 
    report 
}: { 
    project: Project, 
    client: Client | null, 
    manager: User | null, 
    report: WeeklyReport 
}) {
  const firestore = useFirestore();
  
  const milestonesQuery = useMemo(() => 
    query(collection(firestore, "milestones"), where("projectTypes", "array-contains", project.projectType)), 
    [firestore, project.projectType]
  );
  const { data: projectMilestones, isLoading: milestonesLoading } = useCollection<Milestone>(milestonesQuery);

  if (milestonesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans bg-white text-black">
      <header className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Acciona Manager</h1>
          <p className="text-gray-600">Weekly Progress Report</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="text-gray-600">Report #{report.week}</p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-8 my-8">
        <div>
          <h3 className="font-semibold text-gray-500 uppercase tracking-wider text-sm">Client</h3>
          <p className="text-lg">{client?.name || 'N/A'}</p>
        </div>
        <div>
          <h3 className="font-semibold text-gray-500 uppercase tracking-wider text-sm">Start Date</h3>
          <p className="text-lg">{formatDate(project.startDate)}</p>
        </div>
         <div>
          <h3 className="font-semibold text-gray-500 uppercase tracking-wider text-sm">Total Progress</h3>
          <p className="text-lg font-bold">{report.progress}%</p>
        </div>
      </section>

      <main className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4 flex justify-between items-center">
            Weekly Summary
            <Badge className={
                report.status === 'On Track' ? 'bg-green-100 text-green-800' :
                report.status === 'At Risk' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
            }>{report.status}</Badge>
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">{report.summary}</p>
        </div>

        <div>
            <h3 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">Milestones Status for this Report</h3>
            <div className="space-y-4">
                {projectMilestones?.map(milestone => (
                    <div key={milestone.id}>
                        <h4 className="font-medium">{milestone.name}</h4>
                        <div className="space-y-2 pl-4 mt-1">
                            {milestone.subMilestones.map(subMilestone => (
                                <div key={subMilestone.id} className="flex items-center gap-3">
                                    {report.completedSubMilestones?.includes(subMilestone.id) ? 
                                        <CheckSquare className="h-5 w-5 text-green-600" /> :
                                        <Square className="h-5 w-5 text-gray-300" />
                                    }
                                    <span className="text-sm">{subMilestone.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </main>

      <footer className="mt-12 pt-4 border-t text-center text-xs text-gray-500">
        <p>Report generated on {new Date().toLocaleDateString()}</p>
        <p>Solaris Manager - Project Management Simplified</p>
      </footer>
    </div>
  );
}
