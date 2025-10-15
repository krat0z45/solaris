
'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '../ui/button';
import ReminderForm from './reminder-form';
import { PlusCircle, Edit } from 'lucide-react';
import type { Reminder } from '@/lib/types';

interface ReminderActionsProps {
  reminder?: Reminder;
  selectedDate?: Date;
}

export default function ReminderActions({ reminder, selectedDate }: ReminderActionsProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {reminder ? (
           <Button variant="ghost" size="icon" className='h-8 w-8'>
                <Edit className="h-4 w-4" />
           </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Reminder
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{reminder ? 'Edit Reminder' : 'New Reminder'}</SheetTitle>
          <SheetDescription>
            {reminder ? 'Update the details for your reminder.' : 'Add a new task or event to your calendar.'}
          </SheetDescription>
        </SheetHeader>
        <ReminderForm
          reminder={reminder}
          defaultDate={selectedDate}
          onSuccess={handleSuccess}
        />
      </SheetContent>
    </Sheet>
  );
}
