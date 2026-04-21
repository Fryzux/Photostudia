import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, X } from 'lucide-react';

import { cn } from './utils';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type DatePickerInputProps = {
  id?: string;
  value?: string;
  onChange: (nextValue: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function parseIsoDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function DatePickerInput({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = 'Выберите дату',
  className,
  disabled = false,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const minDate = useMemo(() => parseIsoDate(min), [min]);
  const maxDate = useMemo(() => parseIsoDate(max), [max]);

  const calendarDisabled = useMemo(() => {
    if (minDate && maxDate) {
      return [{ before: minDate }, { after: maxDate }];
    }
    if (minDate) {
      return { before: minDate };
    }
    if (maxDate) {
      return { after: maxDate };
    }
    return undefined;
  }, [maxDate, minDate]);

  const formattedLabel = selectedDate ? format(selectedDate, 'dd.MM.yyyy', { locale: ru }) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          'group inline-flex h-12 w-full items-center justify-between gap-2 whitespace-nowrap rounded-full border border-[#111111]/12 bg-white px-5 text-base font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:h-14 sm:text-lg',
          selectedDate ? 'text-[#111111]' : 'text-[#7a7a7a]',
          className,
        )}
      >
        <span>{formattedLabel}</span>
        <span className="flex items-center gap-1.5">
          {selectedDate ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Очистить дату"
              className="rounded-full p-1.5 text-[#8a8a8a] transition hover:bg-[#f1f1ee] hover:text-[#111111]"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onChange('');
                }
              }}
            >
              <X className="h-4 w-4" />
            </span>
          ) : null}
          <CalendarDays className="h-5 w-5 text-[#5c5c5c] transition group-hover:text-[#111111]" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-[1.4rem] border border-[#111111]/10 bg-white p-0 shadow-[0_20px_40px_rgba(17,17,17,0.16)]" align="center">
        <Calendar
          mode="single"
          selected={selectedDate}
          locale={ru}
          disabled={calendarDisabled}
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : '');
            setOpen(false);
          }}
          classNames={{
            months: 'p-4',
            month: 'flex flex-col gap-5',
            caption: 'relative flex items-center justify-center pb-1',
            caption_label: 'text-xl font-semibold text-[#111111]',
            nav_button:
              'h-10 w-10 rounded-full border border-[#111111]/12 bg-white text-[#5f5f5f] p-0 transition hover:bg-[#f4f4f1] hover:text-[#111111]',
            head_row: 'flex gap-0.5',
            head_cell: 'w-11 text-sm uppercase tracking-[0.08em] text-[#7a7a7a]',
            row: 'mt-1.5 flex w-full gap-0.5',
            day: 'h-11 w-11 rounded-full text-lg text-[#111111]',
            day_selected:
              'bg-[#111111] text-white hover:bg-[#111111] hover:text-white focus:bg-[#111111] focus:text-white',
            day_today: 'border border-[#111111]/25 bg-[#f4f4f1]',
            day_outside: 'text-[#b5b5b0]',
            day_disabled: 'text-[#c2c2bd] opacity-100',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
