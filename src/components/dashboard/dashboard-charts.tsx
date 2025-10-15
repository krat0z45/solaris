
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, Cell, XAxis } from 'recharts';
import { Loader2 } from 'lucide-react';

const STATUS_COLORS = {
  'On Track': 'hsl(var(--chart-2))',
  'At Risk': 'hsl(var(--chart-4))',
  'Off Track': 'hsl(var(--chart-1))',
  'On Hold': 'hsl(var(--muted-foreground))',
  'Completed': 'hsl(var(--chart-5))',
};

export default function DashboardCharts() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const projectsQuery = useMemo(() => {
    if (!user) return null;
    // Admins and managers can see all projects for stats purposes
    return query(collection(firestore, 'projects'));
  }, [firestore, user]);

  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery, {
    disabled: !user,
  });

  const isLoading = isUserLoading || projectsLoading;

  const chartData = useMemo(() => {
    if (!projects) return [];
    
    const statusCounts = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      fill: STATUS_COLORS[name as keyof typeof STATUS_COLORS] || 'hsl(var(--muted-foreground))',
    }));
  }, [projects]);

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return null; // Don't render anything if there are no projects
  }

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Projects by Status</CardTitle>
          <CardDescription>A donut chart showing the distribution of project statuses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="mx-auto aspect-square h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                  {chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Project Count</CardTitle>
          <CardDescription>A bar chart showing the number of projects for each status.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart accessibilityLayer data={chartData}>
                <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                <Bar dataKey="value" radius={4}>
                   {chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
