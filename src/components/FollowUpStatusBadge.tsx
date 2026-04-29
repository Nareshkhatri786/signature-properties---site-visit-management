import React from 'react';
import { Clock, Calendar, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

// Defining the types locally for better reliability
export type FollowUpDisplayStatus = 'overdue' | 'today' | 'upcoming' | 'completed' | 'none';

interface FollowUpStatusBadgeProps {
  status: FollowUpDisplayStatus;
  date?: string;
  isLost?: boolean;
  visitStatus?: 'Cancelled' | 'No Show' | string; // Added to handle specific visit outcomes
  onClick?: () => void;
  className?: string;
}

export function FollowUpStatusBadge({ 
  status, 
  date, 
  isLost, 
  visitStatus, 
  onClick, 
  className 
}: FollowUpStatusBadgeProps) {
  
  // Logic for Labels and Colors based on your requirements
  const getInfo = () => {
    if (isLost) {
      return { 
        label: "No follow-up required", 
        color: "bg-slate-100 text-slate-500 border-slate-200",
        icon: <XCircle size={12} />
      };
    }
    
    if (visitStatus === 'Cancelled' || visitStatus === 'No Show') {
      return { 
        label: "No follow-up scheduled", 
        color: "bg-amber-50 text-amber-600 border-amber-200",
        icon: <AlertCircle size={12} />
      };
    }

    switch (status) {
      case 'overdue': 
        return { label: 'Overdue', color: 'bg-red-50 text-red-600 border-red-200', icon: <AlertCircle size={12} /> };
      case 'today': 
        return { label: 'Today', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Calendar size={12} /> };
      case 'upcoming': 
        return { label: 'Upcoming', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', icon: <Clock size={12} /> };
      case 'completed': 
        return { label: 'Completed', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 size={12} /> };
      default: 
        return { label: 'No Follow-up', color: 'bg-gray-50 text-gray-400 border-gray-200', icon: null };
    }
  };

  const info = getInfo();

  return (
    <button
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all",
        info.color,
        onClick ? "hover:brightness-95 active:scale-95 cursor-pointer" : "cursor-default",
        className
      )}
    >
      {info.icon}
      <span>{info.label}</span>
      
      {/* Only show the date if it's an active follow-up (not lost, cancelled, or completed) */}
      {date && !isLost && visitStatus !== 'Cancelled' && visitStatus !== 'No Show' && status !== 'none' && status !== 'completed' && (
        <span className="opacity-70 border-l border-current pl-1.5 ml-0.5">
          {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
      )}
    </button>
  );
}