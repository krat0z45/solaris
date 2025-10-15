
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import PageHeader from '@/components/page-header';
import ReminderList from '@/components/calendar/reminder-list';
import ReminderActions from '@/components/calendar/reminder-actions';
import { format } from 'date-fns';

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // We format the date to 'yyyy-MM-dd' to ensure consistency for Firestore queries.
  const selectedDateString = date ? format(date, 'yyyy-MM-dd') : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Manage your personal tasks and reminders."
      >
        {/* Pass the selected date to the actions to pre-fill the form */}
        <ReminderActions selectedDate={date} />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-2 sm:p-4">
             <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="p-0"
                classNames={{
                    root: 'w-full',
                    months: 'w-full',
                    month: 'w-full',
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex justify-between w-full mt-2",
                    row: "flex justify-between w-full mt-2",
                    day: "h-12 w-12 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day_selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground",
                }}
            />
          </CardContent>
        </Card>
        <div className="lg:col-span-1">
            <ReminderList selectedDate={selectedDateString} />
        </div>
      </div>
    </div>
  );
}
