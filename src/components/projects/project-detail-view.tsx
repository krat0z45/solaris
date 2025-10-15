

'use client';

import { useDoc, useCollection, useFirestore, useUser, errorEmitter, FirestorePermissionError } from "@/firebase";
import { notFound, useRouter } from 'next/navigation';
import PageHeader from '@/components/page-header';
import ProjectActions from '@/components/projects/project-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { Briefcase, Calendar, User, Building, CalendarClock, Loader2, ShieldAlert, Printer, Trash2, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { differenceInDays, parseISO, isPast, isFuture, formatDistanceToNow } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { collection, doc, query, orderBy, deleteDoc, getDocs, writeBatch, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import type { Client, Project, ProjectType, WeeklyReport, Milestone } from '@/lib/types';
import ProjectProgressChart from '@/components/projects/project-progress-chart';
import GeneralReportView from './general-report-view';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";


function MilestoneStatusIndicator({ startDate, endDate }: { startDate: string, endDate: string }) {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const today = new Date();

    let status: 'delayed' | 'atRisk' | 'onTime' | 'future' = 'future';
    let tooltipText = '';

    if (isPast(end)) {
        status = 'delayed';
        tooltipText = `Delayed. Was due ${formatDistanceToNow(end, { addSuffix: true })}.`;
    } else if (isPast(start) && isFuture(end)) {
        const totalDuration = differenceInDays(end, start);
        const elapsedDuration = differenceInDays(today, start);
        const progress = (elapsedDuration / totalDuration) * 100;
        if (progress > 75) {
            status = 'atRisk';
            tooltipText = `At Risk. ${differenceInDays(end, today)} days remaining.`;
        } else {
            status = 'onTime';
            tooltipText = `On Time. Due in ${formatDistanceToNow(end, { addSuffix: true })}.`;
        }
    } else if (isFuture(start)) {
        status = 'future';
        tooltipText = `Scheduled to start ${formatDistanceToNow(start, { addSuffix: true })}.`;
    } else { // Today is within start and end
        status = 'onTime';
        tooltipText = `On Time. Due in ${formatDistanceToNow(end, { addSuffix: true })}.`;
    }

    const colorClasses = {
        delayed: 'bg-red-500',
        atRisk: 'bg-yellow-500',
        onTime: 'bg-emerald-500',
        future: 'bg-gray-400'
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <div className={cn("h-3 w-3 rounded-full", colorClasses[status])}></div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}


export default function ProjectDetailView({ projectId }: { projectId: string }) {
  // --- All Hooks must be called at the top level ---
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [isDeleting, setIsDeleting] = useState(false);

  const projectRef = useMemo(() => doc(firestore, "projects", projectId), [firestore, projectId]);
  const { data: project, isLoading: projectLoading, error: projectError } = useDoc<Project>(projectRef);

  const clientRef = useMemo(() => project ? doc(firestore, "clients", project.clientId) : null, [firestore, project]);
  const { data: client, isLoading: clientLoading } = useDoc<Client>(clientRef, { disabled: !project });

  const projectTypeRef = useMemo(() => project ? doc(firestore, "projectTypes", project.projectType) : null, [firestore, project]);
  const { data: projectType, isLoading: projectTypeLoading } = useDoc<ProjectType>(projectTypeRef, { disabled: !project });

  const reportsQuery = useMemo(() => query(collection(firestore, `projects/${projectId}/weeklyReports`), orderBy('week', 'asc')), [firestore, projectId]);
  const { data: reports, isLoading: reportsLoading } = useCollection<WeeklyReport>(reportsQuery);

  const milestoneIds = useMemo(() => project?.milestones?.map(m => m.milestoneId) || [], [project]);
  const milestonesQuery = useMemo(() => {
    if (!firestore || milestoneIds.length === 0) return null;
    return query(collection(firestore, "milestones"), where('__name__', 'in', milestoneIds));
  }, [firestore, milestoneIds]);
  const { data: milestoneTemplates, isLoading: milestonesLoading } = useCollection<Milestone>(milestonesQuery, { disabled: milestoneIds.length === 0 });

  const milestoneMap = useMemo(() => new Map(milestoneTemplates?.map(m => [m.id, m])), [milestoneTemplates]);
  
  const { timeProgress, daysRemaining } = useMemo(() => {
    if (!project) return { timeProgress: 0, daysRemaining: 0 };
    const startDate = parseISO(project.startDate);
    const endDate = parseISO(project.estimatedEndDate);
    const today = new Date();
    
    const totalDuration = differenceInDays(endDate, startDate);
    const elapsedDuration = differenceInDays(today, startDate);
    
    let progress = totalDuration > 0 ? Math.round((elapsedDuration / totalDuration) * 100) : 0;
    const remaining = differenceInDays(endDate, today);

    return {
      timeProgress: Math.max(0, Math.min(100, progress)),
      daysRemaining: Math.max(0, remaining),
    };
  }, [project]);
  
  // --- Loading and Error States (called after all hooks) ---
  const isLoading = projectLoading || clientLoading || reportsLoading || isAuthLoading || projectTypeLoading || milestonesLoading;
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (projectError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-10">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You do not have permission to view this project.</p>
          <Button onClick={() => router.push('/projects')}>Return to Projects</Button>
        </div>
      );
  }

  if (!project) {
    notFound();
  }
  
  // --- Computed Values & Logic (safe to use project now) ---
  const latestReport = reports?.[reports.length - 1];
  const overallProgress = latestReport?.progress ?? 0;
  
  const isManagerOrAdmin = user?.role === 'admin' || (project && user?.uid === project.managerId);

  const handleDeleteProject = async () => {
    if (!firestore || !project) return;
    setIsDeleting(true);
    try {
        const batch = writeBatch(firestore);
        const reportsSnapshot = await getDocs(query(collection(firestore, `projects/${project.id}/weeklyReports`)));
        reportsSnapshot.forEach(reportDoc => batch.delete(reportDoc.ref));
        batch.delete(doc(firestore, 'projects', project.id));
        await batch.commit();

        toast({ title: "Project Deleted", description: `"${project.name}" has been permanently removed.` });
        router.push('/projects');
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `projects/${project.id}`, operation: 'delete' }));
        } else {
            toast({ variant: "destructive", title: "Deletion Failed", description: e.message });
        }
        setIsDeleting(false);
    }
  };
  
  const getStatusColor = (status: string) => {
    const colors = {
      'On Track': 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700',
      'At Risk': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
      'Off Track': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };
  
  const projectDetails = [
    { label: "Client", value: client?.name || 'N/A', icon: Building },
    { label: "Project Manager", value: project.managerId, icon: User },
    { label: "Start Date", value: formatDate(project.startDate), icon: Calendar },
    { label: "Estimated End Date", value: formatDate(project.estimatedEndDate), icon: CalendarClock },
    { label: "Project Type", value: projectType?.name || project.projectType, icon: Briefcase },
  ];

  // --- Render ---
  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={`Details for project #${project.id.substring(0,6)}...`}>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link href={`/projects/${project.id}/report/general/print`} target="_blank">Print General Report</Link></DropdownMenuItem>
                {reports && reports.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Print Weekly Report</DropdownMenuLabel>
                        {reports.map(report => (
                             <DropdownMenuItem key={report.id} asChild>
                                <Link href={`/projects/${project.id}/report/${report.week}/print?reportId=${report.id}`} target="_blank">Report #{report.week}</Link>
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
        {isManagerOrAdmin && <ProjectActions project={project} />}
      </PageHeader>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
                <CardContent className="grid gap-6 grid-cols-1 sm:grid-cols-2">
                  {projectDetails.map(detail => (
                    <div key={detail.label} className="flex items-start gap-3">
                      <detail.icon className="h-5 w-5 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">{detail.label}</p>
                        <p className="font-medium break-all">{detail.value}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
               <Card>
                <CardHeader>
                    <CardTitle>Milestone Timeline</CardTitle>
                    <CardDescription>Scheduled dates and status for each project milestone.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {project.milestones && project.milestones.map(pm => {
                        const template = milestoneMap.get(pm.milestoneId);
                        return (
                        <div key={pm.milestoneId} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                            <div className="flex items-center gap-4">
                                <MilestoneStatusIndicator startDate={pm.milestoneStartDate} endDate={pm.milestoneEndDate} />
                                <div>
                                    <p className="font-medium">{template?.name || 'Unknown Milestone'}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatDate(pm.milestoneStartDate)} - {formatDate(pm.milestoneEndDate)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        )
                    })}
                </CardContent>
              </Card>
              {isManagerOrAdmin && (
                <Card className="border-destructive/50">
                    <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex-1">
                                <p className="font-medium">Delete this project</p>
                                <p className="text-sm text-muted-foreground">This action is irreversible. All associated data will be permanently deleted.</p>
                            </div>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isDeleting} className="w-full sm:w-auto">
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Delete Project
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently delete "{project.name}" and all associated reports.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                            {isDeleting ? 'Deleting...' : 'Yes, delete project'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
              )}
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Project Status</CardTitle></CardHeader>
                <CardContent><Badge variant="outline" className={cn("text-base", getStatusColor(project.status))}>{project.status}</Badge></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Overall Progress</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Progress value={overallProgress} aria-label={`${overallProgress}% complete`} />
                      <span className="text-lg font-bold">{overallProgress}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{latestReport ? `Last updated in week ${latestReport.week} report.` : 'No progress reported yet.'}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Time Elapsed</CardTitle></CardHeader>
                <CardContent>
                   <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Progress value={timeProgress} aria-label={`${timeProgress}% of time elapsed`} />
                      <span className="text-lg font-bold">{timeProgress}%</span>
                    </div>
                     <p className="text-sm text-muted-foreground">{daysRemaining > 0 ? `${daysRemaining} days remaining.` : 'Past due date.'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
         <TabsContent value="progress" className="mt-6">
           <ProjectProgressChart reports={reports || []} project={project} />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Submitted Reports</CardTitle>
              {isManagerOrAdmin && <Button asChild><Link href={`/projects/${project.id}/report/${(reports?.length || 0) + 1}`}>New Report</Link></Button>}
            </CardHeader>
            <CardContent>
              {reports && reports.length > 0 ? (
                <div className="divide-y divide-border -mx-6">
                  {reports.map(report => (
                    <div key={report.id} className="px-6 py-4 hover:bg-muted/50 transition-colors flex justify-between items-center">
                      <div>
                        <Link href={`/projects/${project.id}/report/${report.week}?reportId=${report.id}`} className="font-medium text-primary hover:underline">Report #{report.week}</Link>
                        <p className="text-sm text-muted-foreground line-clamp-1">{report.summary}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {report.status && <Badge variant="outline" className={cn(getStatusColor(report.status))}>{report.status}</Badge>}
                        {isManagerOrAdmin && <Button asChild variant="outline" size="sm"><Link href={`/projects/${project.id}/report/${report.week}?reportId=${report.id}`}>View/Edit</Link></Button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10"><p className="text-muted-foreground">No weekly reports have been submitted yet.</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
         <TabsContent value="general" className="mt-6">
          <GeneralReportView project={project} reports={reports || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}