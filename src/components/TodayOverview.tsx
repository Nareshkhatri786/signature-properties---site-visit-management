import React, { useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Flame, MessageSquare, Phone, TrendingUp, Target } from 'lucide-react';
import { Lead, Visit, FollowUp, CallLog, User, Page } from '../types';
import { cn, getLocalDateString } from '../lib/utils';
import { useComplianceReport, useFunnelReport, usePriorityQueue, useSlaStatus } from '../lib/queries';
import { apiService } from '../lib/api-service';
import { toast } from 'react-hot-toast';

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
  const role = (user?.role || '').toLowerCase();
  const canSeeComplianceTable = role === 'admin' || role === 'adm' || role === 'manager';
  const { data: complianceReport } = useComplianceReport('today', canSeeComplianceTable);
  const { data: priorityQueue } = usePriorityQueue(10, true);
  const { data: slaStatus } = useSlaStatus('today', true, canSeeComplianceTable);
  const { data: funnelReport } = useFunnelReport('month', true);
  const [isFixing, setIsFixing] = useState<'missed_followups' | 'missed_visit_outcomes' | null>(null);

  const runBulkFix = async (mode: 'missed_followups' | 'missed_visit_outcomes') => {
    try {
      setIsFixing(mode);
      const res = await apiService.runComplianceBulkFix(mode, 100);
      toast.success(`Compliance fix completed: ${res.fixed || 0} records updated.`);
    } catch (e: any) {
      toast.error(e.message || 'Bulk fix failed');
    } finally {
      setIsFixing(null);
    }
  };

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

    const activeLeads = leads.filter((l) => l.status !== 'closed' && l.status !== 'lost');
    const pendingLeadIds = new Set(
      followUps.filter((f) => f.status === 'pending' && f.leadId).map((f) => String(f.leadId))
    );
    const missedFollowups = activeLeads
      .filter((l) => !pendingLeadIds.has(String(l.id)))
      .slice(0, 8);

    const visitHasPendingFollowup = (visitId?: string, leadId?: string) =>
      followUps.some((f) =>
        f.status === 'pending' &&
        ((visitId && String(f.visitId || '') === String(visitId)) || (leadId && String(f.leadId || '') === String(leadId)))
      );

    const missedVisitOutcome = visits
      .filter((v) => v.visit_status === 'completed')
      .filter((v) => {
        const hasOutcome = !!String(v.outcome || '').trim();
        const needsNextAction = v.outcome === 'follow_up_required';
        const hasNextAction = visitHasPendingFollowup(v.id, v.leadId);
        return !hasOutcome || (needsNextAction && !hasNextAction);
      })
      .slice(0, 8);

    const counts = {
      overdueFollowups: followUps.filter((f) => f.status === 'pending' && normalizeDate(f.date) < today).length,
      todayVisits: visits.filter((v) => v.visit_date === today && (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled')).length,
      myPendingTasks: followUps.filter((f) => f.status === 'pending' && f.userName === user.name && normalizeDate(f.date) <= today).length,
      hotLeads: leads.filter((l) => l.quality === 'hot' && l.status !== 'closed' && l.status !== 'lost').length,
      missedFollowups: activeLeads.filter((l) => !pendingLeadIds.has(String(l.id))).length,
      missedVisitOutcome: visits
        .filter((v) => v.visit_status === 'completed')
        .filter((v) => {
          const hasOutcome = !!String(v.outcome || '').trim();
          const needsNextAction = v.outcome === 'follow_up_required';
          const hasNextAction = visitHasPendingFollowup(v.id, v.leadId);
          return !hasOutcome || (needsNextAction && !hasNextAction);
        }).length
    };

    return { overdueFollowups, todayVisits, myPendingTasks, hotLeads, missedFollowups, missedVisitOutcome, counts };
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ActionCountCard label="SLA Breaches" value={slaStatus?.summary?.totalBreaches || 0} tone="red" onClick={() => onNavigate('followups')} />
        <ActionCountCard label="First Response Breach" value={slaStatus?.summary?.firstResponseBreaches || 0} tone="amber" onClick={() => onNavigate('leads')} />
        <ActionCountCard label="Missed Visit Outcomes" value={slaStatus?.summary?.missedVisitOutcomes || 0} tone="red" onClick={() => onNavigate('visits')} />
        <ActionCountCard label="Stale Hot Leads" value={slaStatus?.summary?.staleHotLeads || 0} tone="orange" onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Missed Follow-up"
          icon={<AlertCircle size={16} className="text-red-500" />}
          emptyText="Great. No missed lead follow-ups."
          actionText="Open Leads"
          onAction={() => onNavigate('leads')}
          items={vm.missedFollowups.map((l) => ({
            id: l.id,
            primary: l.name,
            secondary: `${l.mobile || 'No mobile'} • ${l.assignedToName || 'Unassigned'}`,
            onClick: () => onNavigate('lead-detail', l.id)
          }))}
        />

        <Panel
          title="Missed Visit Outcome"
          icon={<Calendar size={16} className="text-red-500" />}
          emptyText="Great. No missed visit outcomes."
          actionText="Open Visits"
          onAction={() => onNavigate('visits')}
          items={vm.missedVisitOutcome.map((v) => ({
            id: v.id,
            primary: v.client_name,
            secondary: `${v.visit_date} • ${v.outcome ? 'Next action missing' : 'Outcome missing'}`,
            onClick: () => onNavigate('detail', v.id)
          }))}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Next Best Lead Queue"
          icon={<Target size={16} className="text-blue-600" />}
          emptyText="No leads in priority queue."
          actionText="Open Leads"
          onAction={() => onNavigate('leads')}
          items={(priorityQueue?.queue || []).map((q: any) => ({
            id: q.leadId,
            primary: `${q.name} (Score ${q.score})`,
            secondary: `${q.source || 'Unknown'} • ${(q.reasons || []).join(', ') || 'Review now'}`,
            onClick: () => onNavigate('lead-detail', q.leadId)
          }))}
        />

        <div className="bg-white border border-[#E6D8B8] rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 bg-[#FDFAF2] border-b border-[#E6D8B8] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#2A1C00]">
              <TrendingUp size={16} className="text-emerald-600" />
              <p className="text-sm font-bold">Funnel Snapshot ({funnelReport?.range || 'month'})</p>
            </div>
            <button onClick={() => onNavigate('reports')} className="text-[11px] font-bold text-[#C9A84C] hover:underline">
              Open Reports
            </button>
          </div>
          <div className="p-3 text-sm">
            <div className="grid grid-cols-5 gap-2 text-center">
              <FunnelMetric label="Leads" value={funnelReport?.overall?.total || 0} />
              <FunnelMetric label="Contacted" value={funnelReport?.overall?.contacted || 0} />
              <FunnelMetric label="Visit Sch." value={funnelReport?.overall?.visit_scheduled || 0} />
              <FunnelMetric label="Visit Done" value={funnelReport?.overall?.visit_done || 0} />
              <FunnelMetric label="Closed" value={funnelReport?.overall?.closed || 0} />
            </div>
            <p className="mt-3 text-xs text-[#9A8262]">
              Close rate: <span className="font-bold text-[#2A1C00]">{funnelReport?.overall?.close_rate_pct || 0}%</span>
            </p>
          </div>
        </div>
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

      {canSeeComplianceTable && (
        <div className="bg-white border border-[#E6D8B8] rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 bg-[#FDFAF2] border-b border-[#E6D8B8] flex items-center justify-between">
            <p className="text-sm font-bold text-[#2A1C00]">Manager Compliance (Today)</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => runBulkFix('missed_followups')}
                disabled={isFixing !== null}
                className="text-[10px] font-bold border border-[#E6D8B8] rounded px-2 py-1 text-[#9A8262] hover:bg-white disabled:opacity-50"
              >
                {isFixing === 'missed_followups' ? 'Fixing...' : 'Fix Follow-ups'}
              </button>
              <button
                onClick={() => runBulkFix('missed_visit_outcomes')}
                disabled={isFixing !== null}
                className="text-[10px] font-bold border border-[#E6D8B8] rounded px-2 py-1 text-[#9A8262] hover:bg-white disabled:opacity-50"
              >
                {isFixing === 'missed_visit_outcomes' ? 'Fixing...' : 'Fix Visit Outcomes'}
              </button>
              <button onClick={() => onNavigate('reports')} className="text-[11px] font-bold text-[#C9A84C] hover:underline">Open Reports</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#F2ECD8] text-[10px] uppercase text-[#9A8262]">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Lead FU%</th>
                  <th className="px-3 py-2">Visit Outcome%</th>
                  <th className="px-3 py-2">Next Action%</th>
                  <th className="px-3 py-2">Overall%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F2E6]">
                {(complianceReport?.rows || []).map((row: any) => (
                  <tr key={row.userId} className="text-sm">
                    <td className="px-3 py-2 font-semibold text-[#2A1C00]">{row.userName}</td>
                    <td className="px-3 py-2">{row.leadFollowupCompliancePct}%</td>
                    <td className="px-3 py-2">{row.visitOutcomeCompliancePct}%</td>
                    <td className="px-3 py-2">{row.visitNextActionCompliancePct}%</td>
                    <td className={cn("px-3 py-2 font-bold", row.overallCompliancePct >= 80 ? "text-green-600" : row.overallCompliancePct >= 60 ? "text-amber-600" : "text-red-600")}>
                      {row.overallCompliancePct}%
                    </td>
                  </tr>
                ))}
                {(!complianceReport?.rows || complianceReport.rows.length === 0) && (
                  <tr>
                    <td className="px-3 py-4 text-xs text-[#9A8262]" colSpan={5}>No compliance rows available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#F2ECD8] rounded-lg p-2 bg-[#FFFEFA]">
      <p className="text-[10px] uppercase tracking-wider text-[#9A8262] font-bold">{label}</p>
      <p className="text-lg font-bold text-[#2A1C00]">{value}</p>
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
