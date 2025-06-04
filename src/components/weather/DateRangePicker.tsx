
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickerProps {
  onDateChange: (range: DateRange | undefined) => void;
  initialRange?: DateRange;
  id?: string; // Added id to props
}

const DateRangePicker: FC<DateRangePickerProps & React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  onDateChange,
  initialRange,
  id, // Destructure id
}) => {
  const [date, setDate] = useState<DateRange | undefined>(initialRange);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (initialRange) {
      setDate(initialRange);
    }
  }, [initialRange]);

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setDate(selectedRange);
    onDateChange(selectedRange);
    if (selectedRange?.from && selectedRange?.to) {
        setIsOpen(false);
    }
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id || 'date-range-picker-trigger'} // Use passed id or a default
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateRangePicker;
