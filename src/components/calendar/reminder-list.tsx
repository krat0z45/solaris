
'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Reminder } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, CalendarX2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import ReminderActions from './reminder-actions';
import { Badge } from '../ui/badge';

interface ReminderListProps {
  selectedDate?: string; // YYYY-MM-DD
}

export default function ReminderList({ selectedDate }: ReminderListProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const remindersQuery = useMemo(() => {
    if (!user || !selectedDate) return null;
    return query(
      collection(firestore, `users/${user.uid}/reminders`),
      where('date', '==', selectedDate),
    );
  }, [user, firestore, selectedDate]);

  const { data: reminders, isLoading } = useCollection<Reminder>(remindersQuery, {
    disabled: !remindersQuery,
  });
  
  const handleToggleComplete = (reminder: Reminder) => {
    if (!user || !firestore) return;
    setIsUpdating(reminder.id);
    const reminderRef = doc(firestore, `users/${user.uid}/reminders`, reminder.id);
    updateDoc(reminderRef, { completed: !reminder.completed })
    .catch((e) => {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: reminderRef.path,
                operation: 'update',
                requestResourceData: { completed: !reminder.completed }
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update reminder.'});
        }
    })
    .finally(() => setIsUpdating(null));
  };

  const handleDelete = (reminderId: string) => {
     if (!user || !firestore) return;
     const reminderRef = doc(firestore, `users/${user.uid}/reminders`, reminderId);
     deleteDoc(reminderRef)
     .then(() => toast({ title: 'Success', description: 'Reminder deleted.'}))
     .catch((e) => {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: reminderRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete reminder.'});
        }
     });
  };

  const headerDate = selectedDate ? format(parseISO(selectedDate), 'PPP') : 'Reminders';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{headerDate}</CardTitle>
        <CardDescription>Tasks and events for this day.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center h-24">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && (!reminders || reminders.length === 0) && (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <CalendarX2 className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <h3 className="text-lg font-medium">No Reminders</h3>
            <p className="text-sm text-muted-foreground">
              Add a reminder for this day.
            </p>
          </div>
        )}
        {!isLoading && reminders && reminders.length > 0 && (
          <div className="space-y-4">
            {reminders.sort((a,b) => a.createdAt.localeCompare(b.createdAt)).map((reminder) => (
              <div key={reminder.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50">
                <div className='flex items-center h-full pt-1'>
                    <Checkbox
                        id={`reminder-${reminder.id}`}
                        checked={reminder.completed}
                        onCheckedChange={() => handleToggleComplete(reminder)}
                        disabled={isUpdating === reminder.id}
                    />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor={`reminder-${reminder.id}`}
                    className={`font-medium ${reminder.completed ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {reminder.title}
                  </label>
                  {reminder.description && (
                    <p className={`text-sm text-muted-foreground ${reminder.completed ? 'line-through' : ''}`}>
                      {reminder.description}
                    </p>
                  )}
                </div>
                <div className='flex items-center h-full'>
                    <ReminderActions reminder={reminder} />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(reminder.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
