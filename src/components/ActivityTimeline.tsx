import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  UserPlus, 
  ArrowRightLeft,
  XCircle,
  Clock,
  User as UserIcon,
  Tag,
  Zap,
  MoreHorizontal,
  ChevronDown,
  Filter as FilterIcon,
  Search,
  History as HistoryIcon
} from 'lucide-react';
import { Activity, ActivityType, Remark, CallLog, FollowUp } from '../types';
import { cn } from '../lib/utils';
import { format, isToday, isYesterday, startOfDay, subDays } from 'date-fns';

interface TimelineItem {
  id: string;
  type: string;
  originalType: string;
  title: string;
  description: string;
  timestamp: string;
  by: string;
  icon: any;
  color: string;
  meta?: any;
  count?: number; // For merged items
  lastTimestamp?: string;
  subItems?: TimelineItem[];
}

interface ActivityTimelineProps {
  activities: Activity[];
  remarks: Remark[];
  callLogs: CallLog[];
  followUps: FollowUp[];
}

export default function ActivityTimeline({ activities, remarks, callLogs, followUps }: ActivityTimelineProps) {
  const [limit, setLimit] = useState(10);
  const [filter, setFilter] = useState<string>('all');

  // Process and merge items
  const processedItems = useMemo(() => {
    // 1. Combine all sources with cleaned types and titles
    const rawItems: TimelineItem[] = [
      ...activities.map(a => ({
        id: a.id,
        type: 'activity',
        originalType: a.type,
        title: getTimelineTitle(a.type),
        description: a.details || '',
        timestamp: a.timestamp,
        by: a.userName,
        icon: getActivityIcon(a.type),
        color: getActivityColor(a.type)
      })),
      ...remarks
        .filter(r => r.type !== 'visit_note')
        .map(r => ({
          id: r.id,
          type: 'remark',
          originalType: 'remark_added',
          title: 'Note Added',
          description: r.text,
          timestamp: r.at,
          by: r.by,
          icon: MessageSquare,
          color: 'gold',
          meta: { category: r.category, sentiment: r.sentiment }
        })),
      ...callLogs.map(c => ({
        id: c.id,
        type: 'call',
        originalType: 'call_activity',
        title: 'Call Attempted',
        description: `Outcome: ${c.outcome.replace('_', ' ')}${c.note ? ` | Note: ${c.note}` : ''}`,
        timestamp: c.timestamp,
        by: c.by,
        icon: PhoneCall,
        color: c.outcome === 'answered' ? 'green' : 'orange'
      })),
      ...followUps
        .filter(f => f.status === 'completed' || f.status === 'cancelled')
        .map(f => ({
          id: f.id,
          type: 'followup',
          originalType: f.status === 'completed' ? 'followup_done' : 'followup_cancelled',
          title: 'Follow-up',
          description: `Scheduled: ${format(new Date(f.date), 'dd MMM, hh:mm a')} | Status: ${f.status.toUpperCase()}${f.purpose ? ` | Purpose: ${f.purpose}` : ''}${f.outcome_note ? ` | Note: ${f.outcome_note}` : ''}`,
          timestamp: f.completed_at || f.created_at,
          by: f.userName || 'System',
          icon: Calendar,
          color: f.status === 'completed' ? 'green' : 'gray'
        }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 2. Filter and Deduplicate
    const importantTypes = [
      'lead_created', 'lead_status_changed', 'lead_quality_changed',
      'call_attempted', 'call_answered', 'call_activity',
      'visit_scheduled', 'visit_done', 'visit_cancelled',
      'remark_added', 'followup_scheduled', 'followup_done', 'followup_cancelled', 'whatsapp_sent'
    ];

    let filtered = rawItems.filter(item => importantTypes.includes(item.originalType));

    // 3. Advanced Merge Logic
    const merged: TimelineItem[] = [];
    const seenContent = new Set(); 

    filtered.forEach(item => {
      // Deduplicate exact content within the same hour to avoid double-logging
      const contentKey = `${item.description.trim().toLowerCase().substring(0, 50)}-${item.timestamp.substring(0, 13)}`;
      if (seenContent.has(contentKey)) return;
      seenContent.add(contentKey);

      // Hide remarks that are just status changes already logged as activities
      if (item.type === 'remark') {
        const isStatusChange = /status changed|quality changed/i.test(item.description);
        if (isStatusChange) return;
      }

      const last = merged[merged.length - 1];
      if (last) {
        const timeDiffMinutes = (new Date(last.timestamp).getTime() - new Date(item.timestamp).getTime()) / (1000 * 60);
        const isSameUser = last.by === item.by;
        const isCloseTime = timeDiffMinutes >= 0 && timeDiffMinutes <= 15; 

        if (isSameUser && isCloseTime) {
          // If descriptions are very similar, just keep one
          const isSimilar = last.description.includes(item.description) || item.description.includes(last.description);
          if (isSimilar && last.type === item.type) return;

          if (!last.subItems) {
            last.subItems = [{ ...last, subItems: undefined }];
          }
          last.subItems.push({ ...item });

          const hierarchy: Record<string, number> = {
            'lead_created': 1000,
            'visit_done': 90,
            'visit_scheduled': 85,
            'followup_done': 70,
            'followup_scheduled': 65,
            'call_answered': 50,
            'call_attempted': 40,
            'remark_added': 10
          };
          const lastScore = hierarchy[last.originalType] || 0;
          const itemScore = hierarchy[item.originalType] || 0;
          
          if (itemScore > lastScore) {
            last.title = item.title;
            last.originalType = item.originalType;
            last.icon = item.icon;
            last.color = item.color;
          }
          return; 
        }
      }

      merged.push({ ...item });
    });

    return merged;
  }, [activities, remarks, callLogs, followUps]);

  // Apply UI filter
  const filteredItems = useMemo(() => {
    if (filter === 'all') return processedItems;
    return processedItems.filter(item => {
      if (filter === 'calls') return item.type === 'call' || item.originalType === 'call_attempted' || item.originalType === 'call_answered';
      if (filter === 'visits') return item.originalType.startsWith('visit_');
      if (filter === 'followups') return item.type === 'followup' || item.originalType.startsWith('followup_');
      return true;
    });
  }, [processedItems, filter]);

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {
      'Today': [],
      'Yesterday': [],
      'Earlier': []
    };

    filteredItems.forEach((item, index) => {
      if (index >= limit) return; // Apply global limit

      const date = new Date(item.timestamp);
      if (isToday(date)) groups['Today'].push(item);
      else if (isYesterday(date)) groups['Yesterday'].push(item);
      else groups['Earlier'].push(item);
    });

    return groups;
  }, [filteredItems, limit]);

  const hasItems = filteredItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-[#E6D8B8]/30">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F1E6] rounded-lg text-[#9A8262] text-[10px] font-bold uppercase tracking-wider">
          <FilterIcon size={12} /> Filter
        </div>
        {[
          { id: 'all', label: 'All History' },
          { id: 'calls', label: 'Calls' },
          { id: 'visits', label: 'Visits' },
          { id: 'followups', label: 'Follow-ups' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setLimit(10); }}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
              filter === f.id 
                ? "bg-[#C9A84C] border-[#C9A84C] text-[#1C1207] shadow-sm" 
                : "bg-white border-[#E6D8B8] text-[#9A8262] hover:border-[#C9A84C]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative space-y-8 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-[#E6D8B8]/50">
        {hasItems ? (
          (['Today', 'Yesterday', 'Earlier'] as const).map(group => (
            groupedItems[group].length > 0 && (
              <div key={group} className="space-y-4">
                <div className="flex items-center gap-3 ml-2 mb-6">
                  <div className="h-px bg-[#C9A84C]/30 flex-1" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9A8262] bg-[#FFFDF6] px-3 py-1 rounded-full border border-[#E6D8B8]/50 shadow-sm">
                    {group}
                  </span>
                  <div className="h-px bg-[#C9A84C]/30 flex-1" />
                </div>

                <div className="space-y-6">
                  {groupedItems[group].map((item) => (
                    <div key={item.id} className="relative pl-12 group/item">
                      {/* Timeline Dot & Icon */}
                      <div className={cn(
                        "absolute left-0 top-1 w-10 h-10 rounded-xl border-4 border-[#F2ECD8] flex items-center justify-center transition-all shadow-sm z-10 group-hover/item:scale-110",
                        getColorClass(item.color)
                      )}>
                        <item.icon size={16} />
                      </div>

                      {/* Content Card */}
                      <div className="bg-white border border-[#E6D8B8] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className={cn("text-[11px] font-black uppercase tracking-wider", getTextClass(item.color, true))}>
                                {item.title}
                                {item.count && item.count > 1 && ` (${item.count} times)`}
                              </h4>
                              {item.meta?.category && (
                                <span className="text-[9px] font-bold text-[#9A8262] bg-[#F5F1E6] px-2 py-0.5 rounded flex items-center gap-1">
                                  <Tag size={10} /> {item.meta.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <time className="text-[10px] font-bold text-[#9A8262] flex items-center gap-1">
                                <Clock size={10} />
                                {format(new Date(item.timestamp), 'hh:mm a')}
                                {item.lastTimestamp && ` (Last at ${format(new Date(item.lastTimestamp), 'hh:mm a')})`}
                              </time>
                              <div className="flex items-center gap-1 text-[10px] font-bold text-[#9A8262]">
                                <UserIcon size={10} />
                                {item.by}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#FDFAF2]/50 rounded-lg border border-[#E6D8B8]/30 overflow-hidden">
                          {item.subItems ? (
                            <div className="divide-y divide-[#E6D8B8]/30">
                              {item.subItems
                                .filter((sub, idx, self) => 
                                  idx === self.findIndex((t) => t.description === sub.description)
                                )
                                .map((sub, idx) => (
                                <div key={idx} className="p-3 flex items-start gap-3">
                                  <div className={cn("mt-0.5", getTextClass(sub.color, false))}>
                                    <sub.icon size={14} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9A8262] mb-0.5">{sub.title}</p>
                                    <p className="text-[#2A1C00] text-sm font-medium leading-relaxed">{sub.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3">
                              {item.originalType.includes('status_changed') ? (
                                <div className="flex items-center gap-2">
                                  <ArrowRightLeft size={14} className="text-[#C9A84C]" />
                                  <p className="text-sm">
                                    <span className="font-black text-[#2A1C00]">
                                      New → {item.description.replace(/Changed (status|quality) to /i, '')}
                                    </span>
                                  </p>
                                </div>
                              ) : item.originalType.includes('quality_changed') ? (
                                <div className="flex items-center gap-2">
                                  <Tag size={14} className="text-[#C9A84C]" />
                                  <p className="text-sm">
                                    <span className="font-black text-[#2A1C00]">
                                      Quality → {item.description.replace(/Changed (status|quality) to /i, '')}
                                    </span>
                                  </p>
                                </div>
                              ) : item.type === 'followup' ? (
                                <div className="space-y-2">
                                    <p className="text-[#2A1C00] text-sm font-bold">{item.description.split(' | ')[0]}</p>
                                    {item.description.includes('| Outcome:') && (
                                        <p className="text-xs text-green-600 font-medium italic border-t border-green-100 pt-1 mt-1">
                                            Outcome: {item.description.split('| Outcome:')[1]}
                                        </p>
                                    )}
                                </div>
                              ) : (
                                <p className="text-[#2A1C00] text-sm font-medium leading-relaxed">
                                  {item.description}
                                </p>
                              )}
                              
                              {item.meta?.sentiment && (
                                <div className="mt-2 pt-2 border-t border-[#E6D8B8]/20 flex justify-end">
                                  <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm", getSentimentClass(item.meta.sentiment))}>
                                    {getSentimentEmoji(item.meta.sentiment)} {item.meta.sentiment}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))
        ) : (
          <div className="py-20 text-center opacity-30">
            <HistoryIcon size={48} className="mx-auto mb-3" />
            <p className="font-['Cormorant_Garamond'] text-xl font-bold">No matching history</p>
            <p className="text-sm">Try changing your filter to see more activities</p>
          </div>
        )}
      </div>

      {filteredItems.length > limit && (
        <div className="flex justify-center pt-4">
          <button 
            onClick={() => setLimit(prev => prev + 10)}
            className="flex items-center gap-2 px-6 py-2 bg-white border border-[#E6D8B8] text-[#C9A84C] font-bold rounded-full hover:bg-[#F5F1E6] transition-all shadow-sm text-sm"
          >
            <ChevronDown size={18} /> Show More History
          </button>
        </div>
      )}
    </div>
  );
}

function getTimelineTitle(type: string): string {
  const titles: Record<string, string> = {
    'lead_created': 'Lead Created',
    'lead_updated': 'Details Updated',
    'lead_status_changed': 'Status Changed',
    'lead_quality_changed': 'Quality Updated',
    'lead_transferred': 'Lead Transferred',
    'call_attempted': 'Call Attempted',
    'call_answered': 'Call Answered',
    'visit_scheduled': 'Visit Scheduled',
    'visit_done': 'Visit Completed',
    'visit_cancelled': 'Visit Cancelled',
    'visit_no_show': 'Visit No Show',
    'whatsapp_sent': 'WhatsApp Sent',
    'remark_added': 'Note Added',
    'followup_scheduled': 'Follow-up',
    'followup_done': 'Follow-up',
    'followup_cancelled': 'Follow-up'
  };
  return titles[type] || type.replace(/_/g, ' ');
}

function getActivityIcon(type: string): any {
  switch (type) {
    case 'lead_created': return UserPlus;
    case 'lead_updated': return Zap;
    case 'lead_status_changed': return ArrowRightLeft;
    case 'lead_quality_changed': return Tag;
    case 'lead_transferred': return ArrowRightLeft;
    case 'visit_scheduled': return Calendar;
    case 'visit_done': return CheckCircle2;
    case 'visit_cancelled': return XCircle;
    case 'visit_no_show': return XCircle;
    case 'whatsapp_sent': return MessageSquare;
    case 'call_answered': return PhoneCall;
    case 'call_attempted': return PhoneCall;
    case 'remark_added': return MessageSquare;
    case 'followup_scheduled': return Calendar;
    case 'followup_done': return CheckCircle2;
    case 'followup_cancelled': return XCircle;
    default: return Zap;
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'lead_created': return 'blue';
    case 'lead_status_changed': return 'gold';
    case 'lead_quality_changed': return 'gold';
    case 'visit_done': return 'green';
    case 'visit_cancelled': return 'red';
    case 'visit_no_show': return 'red';
    case 'whatsapp_sent': return 'green';
    case 'call_answered': return 'green';
    case 'call_attempted': return 'orange';
    case 'remark_added': return 'gold';
    case 'followup_done': return 'green';
    case 'followup_cancelled': return 'red';
    default: return 'gold';
  }
}

function getColorClass(color: string) {
  switch (color) {
    case 'gold': return 'bg-[#C9A84C] text-[#1C1207]';
    case 'green': return 'bg-green-500 text-white';
    case 'blue': return 'bg-blue-500 text-white';
    case 'red': return 'bg-rose-500 text-white';
    case 'orange': return 'bg-orange-500 text-white';
    case 'gray': return 'bg-gray-400 text-white';
    default: return 'bg-[#C9A84C] text-[#1C1207]';
  }
}

function getTextClass(color: string, onlyText = false) {
  if (onlyText) {
    switch (color) {
      case 'gold': return 'text-[#9A8262]';
      case 'green': return 'text-green-600';
      case 'blue': return 'text-blue-600';
      case 'red': return 'text-rose-600';
      case 'orange': return 'text-orange-600';
      default: return 'text-[#9A8262]';
    }
  }
  switch (color) {
    case 'gold': return 'text-[#1C1207] bg-[#C9A84C]';
    case 'green': return 'text-white bg-green-600 font-bold';
    case 'blue': return 'text-white bg-blue-600 font-bold';
    case 'red': return 'text-white bg-rose-600 font-bold';
    case 'orange': return 'text-white bg-orange-600 font-bold';
    default: return 'text-[#1C1207] bg-[#C9A84C]';
  }
}

function getSentimentClass(sentiment: string) {
  switch (sentiment) {
    case 'positive': return 'bg-green-100 text-green-700 border border-green-200';
    case 'excited': return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'negative': return 'bg-red-100 text-red-700 border border-red-200';
    case 'skeptical': return 'bg-purple-100 text-purple-700 border border-purple-200';
    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
}

function getSentimentEmoji(sentiment: string) {
  switch (sentiment) {
    case 'positive': return '😊';
    case 'excited': return '🤩';
    case 'negative': return '😞';
    case 'skeptical': return '🧐';
    default: return '😐';
  }
}
