"use client";

import { useMemo, useRef, useState } from "react";
import type { Project, WeeklyReport, Milestone, Client, User, SubMilestone } from "@/lib/types";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { CheckSquare, Loader2, Square, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { isAfter, parseISO } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "../ui/button";

interface PrintGeneralReportViewProps {
  project: Project;
  client: Client | null;
  manager: User | null;
  reports: WeeklyReport[];
}

export default function PrintGeneralReportView({ project, client, manager, reports }: PrintGeneralReportViewProps) {
  const firestore = useFirestore();
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    const element = printRef.current;
    if (!element) return;
    setIsDownloading(true);

    // Temporarily hide the button before capturing
    const downloadButton = element.querySelector<HTMLElement>('#download-button');
    if(downloadButton) downloadButton.style.display = 'none';

    const canvas = await html2canvas(element, { scale: 2 });
    
    // Show the button again after capturing
    if(downloadButton) downloadButton.style.display = 'flex';

    const data = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0;

    pdf.addImage(data, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(`reporte-general-${project.name}.pdf`);
    setIsDownloading(false);
  };


  const allCompletedSubMilestones = useMemo(() => {
    const subMilestoneIds = new Set<string>();
    reports.forEach(report => {
      (report.completedSubMilestones || []).forEach(id => subMilestoneIds.add(id));
    });
    return Array.from(subMilestoneIds);
  }, [reports]);

  const milestonesQuery = useMemo(() => 
    query(collection(firestore, "milestones"), where("projectTypes", "array-contains", project.projectType)), 
    [firestore, project.projectType]
  );
  const { data: projectMilestones, isLoading: milestonesLoading } = useCollection<Milestone>(milestonesQuery);

  const subMilestoneCompletionDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    // Iterate through reports in order of creation to find the first time a sub-milestone was completed
    reports.slice().sort((a,b) => a.week - b.week).forEach(report => {
        report.completedSubMilestones?.forEach(subId => {
            if (!map.has(subId)) {
                map.set(subId, parseISO(report.createdAt));
            }
        });
    });
    return map;
}, [reports]);

  const latestReport = reports[reports.length - 1];
  const overallProgress = latestReport?.progress ?? 0;

  if (milestonesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end mb-4">
             <Button onClick={handleDownloadPdf} disabled={isDownloading} id="download-button">
                {isDownloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                Descargar PDF
            </Button>
        </div>
        <div ref={printRef} className="p-8 font-sans bg-white text-black rounded-lg shadow-lg">
          <header className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Acciona Manager</h1>
              <p className="text-gray-600">General Project Report</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-semibold">{project.name}</h2>
              <p className="text-gray-600">Project #{project.id.substring(0, 6)}...</p>
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
              <h3 className="font-semibold text-gray-500 uppercase tracking-wider text-sm">Final Status</h3>
              <Badge className="text-lg mt-1">{project.status}</Badge>
            </div>
          </section>

          <main className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">
                Overall Progress
              </h3>
              <div className="flex items-center gap-4">
                <Progress value={overallProgress} className="h-4" />
                <span className="text-xl font-bold">{overallProgress}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">Completed Milestones</h3>
                <div className="space-y-3">
                  {projectMilestones?.map(milestone => {
                    const projectMilestone = project.milestones.find(pm => pm.milestoneId === milestone.id);
                    const allSubsForThisMilestone = milestone.subMilestones.map(sm => sm.id);
                    const completedSubsForThisMilestone = allSubsForThisMilestone.filter(smId => allCompletedSubMilestones.includes(smId));
                    const allSubsComplete = completedSubsForThisMilestone.length === allSubsForThisMilestone.length;

                    let completionStatus = null;
                    if (allSubsComplete && projectMilestone) {
                        const estimatedEndDate = parseISO(projectMilestone.milestoneEndDate);
                        const completionDates = completedSubsForThisMilestone.map(id => subMilestoneCompletionDateMap.get(id)).filter(d => d) as Date[];
                        const lastCompletionDate = new Date(Math.max.apply(null, completionDates.map(d => d.getTime())));

                        if (isAfter(lastCompletionDate, estimatedEndDate)) {
                            completionStatus = <Badge className="bg-red-100 text-red-800 ml-2">Retraso</Badge>;
                        } else {
                            completionStatus = <Badge className="bg-green-100 text-green-800 ml-2">A tiempo</Badge>;
                        }
                    }

                    return (
                      <div key={milestone.id}>
                        <div className="flex items-center">
                            {allSubsComplete ? <CheckSquare className="h-5 w-5 mt-px text-green-600" /> : <Square className="h-5 w-5 mt-px text-gray-300" />}
                            <p className={`font-medium ml-3 ${!allSubsComplete && "text-gray-500"}`}>{milestone.name}</p>
                            {completionStatus}
                        </div>
                        <ul className="pl-8 mt-1 space-y-1">
                          {milestone.subMilestones.map(sm => {
                              const isCompleted = allCompletedSubMilestones.includes(sm.id);
                              return (
                                  <li key={sm.id} className="flex items-center gap-2 text-xs text-gray-600">
                                      {isCompleted ? <CheckSquare className="h-3 w-3 text-green-500" /> : <Square className="h-3 w-3 text-gray-400" />}
                                      <span className={isCompleted ? 'line-through' : ''}>{sm.name}</span>
                                  </li>
                              )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">Weekly Summaries Log</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {reports.slice().reverse().map(report => (
                    <div key={report.id} className="border-l-2 pl-4">
                      <p className="font-semibold text-sm">Week {report.week}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>

          <footer className="mt-12 pt-4 border-t text-center text-xs text-gray-500">
            <p>Report generated on {new Date().toLocaleDateString()}</p>
            <p>Acciona Manager - Project Management Simplified</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
