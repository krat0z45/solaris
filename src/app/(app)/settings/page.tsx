'use client';

import PageHeader from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences."
      />
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the look and feel of the application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                    <span>Dark Mode</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Enable dark mode for the application.
                    </span>
                </Label>
                <Switch id="dark-mode" />
            </div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Manage how you receive notifications. (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-center py-12 border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-muted/50">
                <p className="text-sm text-muted-foreground">
                    Notification settings are under construction.
                </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
