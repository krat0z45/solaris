
"use client";

import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, limit } from "firebase/firestore";
import type { Client } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default function DashboardClientList() {
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  
  const clientsQuery = useMemo(() => {
    if (!user) return null; 
    // There's no timestamp for clients, so we just grab the first 5
    return query(collection(firestore, "clients"), limit(5));
  }, [firestore, user]);

  const { data: recentClients, isLoading: isDataLoading, error } = useCollection<Client>(clientsQuery, {
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
    return <p className="p-4 text-destructive">Error loading clients: {error.message}</p>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {recentClients && recentClients.length > 0 ? (
            recentClients.map((client: Client) => (
              <div key={client.id} className="p-4 flex items-center gap-4">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={client.avatarUrl} alt={client.name} />
                    <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <p className="font-medium">{client.name}</p>
                    <a href={`mailto:${client.email}`} className="text-xs text-muted-foreground hover:underline">
                        {client.email}
                    </a>
                </div>
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-muted-foreground">No clients found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
