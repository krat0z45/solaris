

export type User = {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'manager';
  avatarUrl?: string;
};

export type Client = {
  id: string;
  name:string;
  email: string;
  avatarUrl: string;
};

export type ProjectMilestone = {
    id: string; // Unique identifier for this specific project-milestone link
    milestoneId: string;
    milestoneStartDate: string;
    milestoneEndDate: string;
}

export type Project = {
  id: string;
  name: string;
  clientId: string;
  managerId: string;
  projectType: string; // This will now be an ID referencing the projectTypes collection
  startDate: string; // YYYY-MM-DD
  estimatedEndDate: string; // YYYY-MM-DD
  status: 'On Track' | 'At Risk' | 'Off Track' | 'On Hold' | 'Completed';
  milestones: ProjectMilestone[];
};

export type SubMilestone = {
  id: string;
  name: string;
};

export type Milestone = {
    id: string;
    name: string;
    description: string;
    projectTypes: string[]; // This will now be an array of projectType IDs
    subMilestones: SubMilestone[];
};

export type WeeklyReport = {
  id?: string; // Optional: will not exist for new reports until saved
  projectId: string;
  week: number; // Sequential report number (1, 2, 3...)
  progress: number; // 0-100, represents the OVERALL project progress at the end of this week
  summary: string;
  status: 'On Track' | 'At Risk' | 'Off Track';
  completedSubMilestones: string[]; // Changed from milestones (milestone IDs) to sub-milestone IDs
  createdAt: string; // ISO Date string
};

export type Reminder = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  description?: string;
  completed: boolean;
  createdAt: string;
};

export type ProjectType = {
  id: string;
  name: string;
};

    