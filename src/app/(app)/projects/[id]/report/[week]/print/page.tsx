'use client';

import { useDoc, useCollection, useFirestore } from '@/firebase';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { Client, Project, User, WeeklyReport } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import PrintReportView from '@/components/projects/print-report-view';
import { collection, doc, query } from 'firebase/firestore';

export default function PrintReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const week = params.week as string;
  const reportId = searchParams.get('reportId');

  const firestore = useFirestore();

  const reportNumber = parseInt(week, 10);
  if (isNaN(reportNumber)) {
    notFound();
  }

  // --- Data Fetching ---
  const projectRef = useMemo(() => doc(firestore, 'projects', projectId), [firestore, projectId]);
  const { data: project, isLoading: projectLoading } = useDoc<Project>(projectRef);

  const clientRef = useMemo(() => (project ? doc(firestore, 'clients', project.clientId) : null), [firestore, project]);
  const { data: client, isLoading: clientLoading } = useDoc<Client>(clientRef, { disabled: !project });

  // Fetch the specific report
  const reportRef = useMemo(() => {
    if (!reportId) return null;
    return doc(firestore, `projects/${projectId}/weeklyReports`, reportId);
  }, [firestore, projectId, reportId]);
  const { data: report, isLoading: reportLoading } = useDoc<WeeklyReport>(reportRef, { disabled: !reportId });

  const isLoading = projectLoading || clientLoading || (reportId && reportLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project || (reportId && !report)) {
    notFound();
  }
  
  // A new report that is not yet saved won't have an ID, so we create a temporary one for printing.
  const finalReport = report || {
    week: reportNumber,
    summary: 'Report not yet saved.',
    status: 'On Track',
    progress: 0,
    completedSubMilestones: [],
    projectId: projectId,
    createdAt: new Date().toISOString(),
  };

  return (
    <PrintReportView
      project={project}
      client={client || null}
      manager={null} // We will display the managerId from the project object
      report={finalReport}
    />
  );
}
