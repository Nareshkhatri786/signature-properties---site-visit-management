import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  startOfToday, 
  startOfYesterday, 
  subDays, 
  startOfMonth, 
  subMonths, 
  endOfMonth,
  format,
  isWithinInterval,
  parseISO
} from 'date-fns';

export type DateRangeType = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DateRange {
  type: DateRangeType;
  start: Date;
  end: Date;
}

interface DateRangeSelectorProps {
  selectedRange: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export default function DateRangeSelector({ selectedRange, onChange, className }: DateRangeSelectorProps) {
  const options: { label: string; value: DateRangeType }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'last7days' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last Month', value: 'lastMonth' },
    { label: 'Custom Range', value: 'custom' },
  ];

  const handleTypeChange = (type: DateRangeType) => {
    let start = new Date();
    let end = new Date();

    switch (type) {
      case 'today':
        start = startOfToday();
        break;
      case 'yesterday':
        start = startOfYesterday();
        end = startOfYesterday();
        end.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        start = subDays(new Date(), 7);
        break;
      case 'thisMonth':
        start = startOfMonth(new Date());
        break;
      case 'lastMonth':
        const lastMonth = subMonths(new Date(), 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'custom':
        return;
    }

    onChange({ type, start, end });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="relative">
        <select
          value={selectedRange.type}
          onChange={(e) => handleTypeChange(e.target.value as DateRangeType)}
          className="appearance-none bg-[#FFFDF6] border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-10 text-sm font-medium text-[#2A1C00] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C9A84C]" />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A8262] pointer-events-none" />
      </div>

      {selectedRange.type === 'custom' && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <input
            type="date"
            value={format(selectedRange.start, 'yyyy-MM-dd')}
            onChange={(e) => onChange({ ...selectedRange, start: parseISO(e.target.value) })}
            className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
          />
          <span className="text-[#9A8262] text-xs font-bold uppercase">to</span>
          <input
            type="date"
            value={format(selectedRange.end, 'yyyy-MM-dd')}
            onChange={(e) => onChange({ ...selectedRange, end: parseISO(e.target.value) })}
            className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
          />
        </div>
      )}

      <div className="hidden sm:block text-[11px] font-bold text-[#9A8262] uppercase tracking-wider bg-[#F5EDD4] px-3 py-1.5 rounded-full border border-[#E6D8B8]">
        {format(selectedRange.start, 'dd MMM')} — {format(selectedRange.end, 'dd MMM yyyy')}
      </div>
    </div>
  );
}

export function isDateInRange(dateStr: string, range: DateRange): boolean {
  try {
    const date = parseISO(dateStr);
    return isWithinInterval(date, { start: range.start, end: range.end });
  } catch {
    return false;
  }
}
