import React, { useMemo } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Flame, MessageSquare, Phone } from 'lucide-react';
import { Lead, Visit, FollowUp, CallLog, User, Page } from '../types';
import { cn, getLocalDateString } from '../lib/utils';

interface TodayOverviewProps {
  leads: Lead[];
  visits: Visit[];
  followUps: FollowUp[];
  callLogs: CallLog[];
  users: User[];
  user: User;
  onNavigate: (page: Page, id?: string, filters?: any) => void;
}

function normalizeDate(input?: string) {
  if (!input) return '';
  if (input.includes('T') || input.includes('Z')) {
    return getLocalDateString(new Date(input));
  }
  return input;
}

export default function TodayOverview({ leads, visits, followUps, user, onNavigate }: TodayOverviewProps) {
  const today = getLocalDateString();

  const vm = useMemo(() => {
    const overdueFollowups = followUps
      .filter((f) => f.status === 'pending' && normalizeDate(f.date) < today)
      .sort((a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date)))
      .slice(0, 8);

    const todayVisits = visits
      .filter((v) => v.visit_date === today && (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled'))
      .sort((a, b) => (a.visit_time || '').localeCompare(b.visit_time || ''))
      .slice(0, 8);

    const myPendingTasks = followUps
      .filter((f) => f.status === 'pending' && f.userName === user.name && normalizeDate(f.date) <= today)
      .slice(0, 8);

    const hotLeads = leads
      .filter((l) => l.quality === 'hot' && l.status !== 'closed' && l.status !== 'lost')
      .slice(0, 8);

    const counts = {
      overdueFollowups: followUps.filter((f) => f.status === 'pending' && normalizeDate(f.date) < today).length,
      todayVisits: visits.filter((v) => v.visit_date === today && (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled')).length,
      myPendingTasks: followUps.filter((f) => f.status === 'pending' && f.userName === user.name && normalizeDate(f.date) <= today).length,
      hotLeads: leads.filter((l) => l.quality === 'hot' && l.status !== 'closed' && l.status !== 'lost').length
    };

    return { overdueFollowups, todayVisits, myPendingTasks, hotLeads, counts };
  }, [followUps, leads, visits, user.name, today]);

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-white border border-[#E6D8B8] rounded-xl p-4">
        <h2 className="text-lg font-bold text-[#2A1C00]">Today Action Center</h2>
        <p className="text-xs text-[#9A8262] mt-1">Operational view for immediate actions only.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ActionCountCard label="Overdue Follow-ups" value={vm.counts.overdueFollowups} tone="red" onClick={() => onNavigate('followups')} />
        <ActionCountCard label="Today's Visits" value={vm.counts.todayVisits} tone="blue" onClick={() => onNavigate('visits', undefined, { period: 'today' })} />
        <ActionCountCard label="My Pending Tasks" value={vm.counts.myPendingTasks} tone="amber" onClick={() => onNavigate('followups')} />
        <ActionCountCard label="Hot Leads" value={vm.counts.hotLeads} tone="orange" onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Overdue Follow-ups"
          icon={<AlertCircle size={16} className="text-red-500" />}
          emptyText="No overdue follow-ups."
          actionText="Open Follow-ups"
          onAction={() => onNavigate('followups')}
          items={vm.overdueFollowups.map((f) => ({
            id: f.id,
            primary: f.userName || 'Unassigned',
            secondary: `${normalizeDate(f.date)} • ${f.method}`,
            onClick: () => onNavigate('followups')
          }))}
        />

        <Panel
          title="Today's Visits"
          icon={<Calendar size={16} className="text-blue-600" />}
          emptyText="No visits scheduled for today."
          actionText="Open Visits"
          onAction={() => onNavigate('visits', undefined, { period: 'today' })}
          items={vm.todayVisits.map((v) => ({
            id: v.id,
            primary: v.client_name,
            secondary: `${v.visit_time || 'Any time'} • ${v.assigned_to || 'Unassigned'}`,
            onClick: () => onNavigate('detail', v.id)
          }))}
        />

        <Panel
          title="My Pending Tasks"
          icon={<Clock size={16} className="text-amber-600" />}
          emptyText="No pending tasks."
          actionText="Open Follow-ups"
          onAction={() => onNavigate('followups')}
          items={vm.myPendingTasks.map((f) => ({
            id: f.id,
            primary: f.purpose || 'Pending follow-up',
            secondary: `${normalizeDate(f.date)} • ${f.method}`,
            onClick: () => onNavigate('followups')
          }))}
        />

        <Panel
          title="Hot Leads"
          icon={<Flame size={16} className="text-orange-500" />}
          emptyText="No hot leads pending."
          actionText="Open Leads"
          onAction={() => onNavigate('leads', undefined, { quality: 'hot' })}
          items={vm.hotLeads.map((l) => ({
            id: l.id,
            primary: l.name,
            secondary: `${l.mobile || 'No mobile'} • ${l.source || 'Unknown source'}`,
            onClick: () => onNavigate('lead-detail', l.id)
          }))}
        />
      </div>

      <div className="bg-white border border-[#E6D8B8] rounded-xl p-3">
        <p className="text-[11px] font-bold text-[#9A8262] uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <QuickAction label="Call Queue" icon={<Phone size={14} />} onClick={() => onNavigate('followups')} />
          <QuickAction label="WhatsApp Queue" icon={<MessageSquare size={14} />} onClick={() => onNavigate('whatsapp')} />
          <QuickAction label="Today Visits" icon={<Calendar size={14} />} onClick={() => onNavigate('visits', undefined, { period: 'today' })} />
          <QuickAction label="Hot Leads" icon={<CheckCircle2 size={14} />} onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} />
        </div>
      </div>
    </div>
  );
}

function ActionCountCard({ label, value, tone, onClick }: { label: string; value: number; tone: 'red' | 'blue' | 'amber' | 'orange'; onClick: () => void }) {
  const toneClass = {
    red: 'text-red-600 bg-red-50 border-red-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100'
  }[tone];

  return (
    <button onClick={onClick} className={cn('border rounded-xl p-3 text-left transition-colors hover:bg-white', toneClass)}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-[11px] font-bold mt-1">{label}</p>
    </button>
  );
}

function Panel({
  title,
  icon,
  items,
  emptyText,
  actionText,
  onAction
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; primary: string; secondary: string; onClick: () => void }>;
  emptyText: string;
  actionText: string;
  onAction: () => void;
}) {
  return (
    <div className="bg-white border border-[#E6D8B8] rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#2A1C00]">
          {icon}
          <p className="text-sm font-bold">{title}</p>
        </div>
        <button onClick={onAction} className="text-[11px] font-bold text-[#C9A84C] hover:underline">
          {actionText}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-4 text-xs text-[#9A8262]">{emptyText}</div>
      ) : (
        <div className="divide-y divide-[#F2ECD8]">
          {items.map((item) => (
            <button key={item.id} onClick={item.onClick} className="w-full text-left px-3 py-2.5 hover:bg-[#FFFEFA] transition-colors">
              <p className="text-sm font-semibold text-[#2A1C00] line-clamp-1">{item.primary}</p>
              <p className="text-[11px] text-[#9A8262] line-clamp-1">{item.secondary}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 border border-[#E6D8B8] rounded-lg py-2 text-xs font-bold text-[#5C4820] hover:bg-[#FDFAF2] transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}
