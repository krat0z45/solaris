'use client';

import PageHeader from "@/components/page-header";
import UserActions from "@/components/users/user-actions";
import UserList from "@/components/users/user-list";
import { useUser } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function UsersPage() {
    const { user } = useUser();

    // This page is only for admins
    if (user?.role !== 'admin') {
        return (
        <div className="space-y-6">
            <PageHeader
            title="Access Denied"
            description="You do not have permission to view this page."
            />
            <Card className="mt-6">
            <CardContent className="pt-6">
                <div className="text-center py-12 border-2 border-dashed rounded-lg flex flex-col items-center justify-center">
                <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">Admin Access Required</h3>
                <p className="text-sm text-muted-foreground">
                    Managing users is restricted to administrators.
                </p>
                </div>
            </CardContent>
            </Card>
        </div>
        );
    }

    return (
        <div className="space-y-6">
        <PageHeader
            title="User Management"
            description="View and manage user accounts and roles."
        >
            <UserActions />
        </PageHeader>
        <UserList />
        </div>
    );
}
