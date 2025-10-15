
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, errorEmitter } from '@/firebase';
import { addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import type { Reminder } from '@/lib/types';
import { format } from 'date-fns';
import { FirestorePermissionError } from '@/firebase/errors';

const reminderSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  date: z.string().min(1, 'Date is required.'),
  description: z.string().optional(),
});

interface ReminderFormProps {
  reminder?: Reminder;
  defaultDate?: Date;
  onSuccess?: () => void;
}

export default function ReminderForm({ reminder, defaultDate, onSuccess }: ReminderFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const validatedFields = reminderSchema.safeParse(data);

    if (!validatedFields.success) {
      const errorMessage = Object.values(validatedFields.error.flatten().fieldErrors).flat().join('\n');
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: errorMessage || 'Please check the form fields.',
      });
      return;
    }

    const reminderData = {
        ...validatedFields.data,
        description: validatedFields.data.description || '',
    };
    
    const handleError = (e: any, operation: 'create' | 'update') => {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: reminder ? `users/${user.uid}/reminders/${reminder.id}` : `users/${user.uid}/reminders`,
                operation,
                requestResourceData: reminderData,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to ${operation} reminder.`,
            });
        }
    };

    if (reminder) {
        // Update existing reminder
        const reminderRef = doc(firestore, `users/${user.uid}/reminders`, reminder.id);
        updateDoc(reminderRef, reminderData)
        .then(() => {
            toast({ title: 'Success', description: 'Reminder updated.'});
            onSuccess?.();
        })
        .catch((e) => handleError(e, 'update'));

    } else {
        // Create new reminder
        const finalData = {
            ...reminderData,
            completed: false,
            createdAt: new Date().toISOString(),
        }
        const remindersColRef = collection(firestore, `users/${user.uid}/reminders`);
        addDoc(remindersColRef, finalData)
        .then(() => {
            toast({ title: 'Success', description: 'Reminder added.'});
            formRef.current?.reset();
            onSuccess?.();
        })
        .catch((e) => handleError(e, 'create'));
    }
  };

  const defaultDateString = defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '';
  
  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 py-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={reminder?.title} required />
      </div>
       <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" defaultValue={reminder?.date || defaultDateString} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea id="description" name="description" defaultValue={reminder?.description} />
      </div>
      <div className="flex justify-end">
        <Button type="submit">{reminder ? 'Save Changes' : 'Add Reminder'}</Button>
      </div>
    </form>
  );
}
