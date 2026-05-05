import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, CheckCircle2, CalendarRange,
  CalendarDays as CalendarIcon, Clock, Flag,
  FireExtinguisher, Thermometer, Snowflake, Ban,
  Eye, MessageSquare, Plus, Phone, Users, AlertCircle,
  Filter, LayoutDashboard, TrendingUp, ArrowRight,
  Trophy, Target, Zap, ChevronRight
} from 'lucide-react';
import { Visit, Page, Lead, FollowUp, User, VisitFilters, Project, CallLog } from '../types';
import { cn, getLocalDateString } from '../lib/utils';
import { getLeadFollowUp, getFollowUpDisplayStatus } from '../lib/followupUtils';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DateRangeSelector, { DateRange, isDateInRange } from './DateRangeSelector';
import { startOfToday, endOfToday, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import AIAdvisor from './AIAdvisor';

interface DashboardProps {
  visits: Visit[];
  leads: Lead[];
  followUps: FollowUp[];
  user: User;
  users?: User[];
  projects?: Project[];
  callLogs?: CallLog[];
  stats?: {
    statusStats: { status: string, count: number }[];
    qualityStats: { quality: string, count: number }[];
    todayCount: number;
  };
  onNavigate: (page: Page, id?: string, filters?: any) => void;
}

export default React.memo(function Dashboard({ visits, leads, followUps, user, users = [], projects = [], callLogs = [], stats, onNavigate }: DashboardProps) {
  const userRole = user?.role?.toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'adm';
  const isManager = userRole === 'manager';
  const [dateRange, setDateRange] = useState<DateRange>({
    type: 'today',
    start: startOfToday(),
    end: endOfToday()
  });

  const todayStr = useMemo(() => getLocalDateString(), []);
  
  const calculatedStats = useMemo(() => {
    const hotLeads = leads.filter(l => l.quality === 'hot').length;
    const warmLeads = leads.filter(l => l.quality === 'warm').length;
    const coldLeads = leads.filter(l => l.quality === 'cold').length;
    const disqLeads = leads.filter(l => l.quality === 'disq').length;
    const activeLeadsCount = leads.length - disqLeads;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const safeParseDate = (dateStr: string | undefined | null) => {
      if (!dateStr) return null;
      try {
        const d = parseISO(dateStr);
        return isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    };

    const completedVisitsList = visits.filter(v => v.visit_status === 'completed');
    const completedToday = completedVisitsList.filter(v => {
      const d = safeParseDate(v.visit_date);
      return d ? isToday(d) : false;
    }).length;

    const completedYesterday = completedVisitsList.filter(v => {
      const d = safeParseDate(v.visit_date);
      return d ? isYesterday(d) : false;
    }).length;

    const completedThisWeek = completedVisitsList.filter(v => {
      const d = safeParseDate(v.visit_date);
      return d ? isThisWeek(d) : false;
    }).length;

    const completedThisMonth = completedVisitsList.filter(v => {
      const d = safeParseDate(v.visit_date);
      return d ? isThisMonth(d) : false;
    }).length;

    const scheduledVisitsList = visits.filter(v => v.visit_status === 'scheduled' || v.visit_status === 'rescheduled');
    const scheduledToday = scheduledVisitsList.filter(v => {
      const d = safeParseDate(v.visit_date);
      return d ? isToday(d) : false;
    }).length;

    const scheduledThisWeek = scheduledVisitsList.filter(v => {
      const d = safeParseDate(v.visit_date);
      return d ? isThisWeek(d) : false;
    }).length;

    const scheduledThisMonth = scheduledVisitsList.filter(v => {
      const d = safeParseDate(v.visit_date);
      return d ? isThisMonth(d) : false;
    }).length;

    const filteredVisitsList = visits.filter(v => isDateInRange(v.visit_date || '', dateRange));
    const filteredLeadsList = leads.filter(l => isDateInRange(l.created_at || '', dateRange));
    
    const visitsInRangeDataList = [...filteredVisitsList]
      .sort((a, b) => (a.visit_date || '').localeCompare(b.visit_date || '') || (a.visit_time || '').localeCompare(b.visit_time || ''));

    const upcoming = visits
      .filter(v => v.visit_date && v.visit_date > todayStr && (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled'))
      .sort((a, b) => (a.visit_date || '').localeCompare(b.visit_date || ''))
      .slice(0, 5);

    const followUpRemindersList = visits
      .filter(v => {
        if (!v.visit_date) return false;
        const d = safeParseDate(v.visit_date);
        if (!d) return false;
        return d < today && (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled') && v.status !== 'disq';
      })
      .sort((a, b) => (a.visit_date || '').localeCompare(b.visit_date || ''))
      .slice(0, 5);

    // Conversion funnel
    const visitedLeadIds = new Set(visits.map(v => v.leadId).filter(Boolean));
    const visitedCount = visitedLeadIds.size;
    const completedLeadIds = new Set(visits.filter(v => v.visit_status === 'completed').map(v => v.leadId).filter(Boolean));
    const closedLeads = leads.filter(l => l.status === 'closed').length;

    // Missed opportunities
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const notContactedDays = leads.filter(l => {
      if (l.quality === 'disq' || l.status === 'closed' || l.status === 'lost') return false;
      return new Date(l.updated_at) < sevenDaysAgo;
    });
    const overdueFollowupsCount = followUps.filter(f => f.status === 'pending' && f.date < todayStr).length;
    const visitedNoFollowup = visits.filter(v => {
      if (v.visit_status !== 'completed') return false;
      return !followUps.some(f => f.visitId === v.id || f.leadId === v.leadId);
    });

    // Funnel rates
    const visitRate = leads.length > 0 ? Math.round((visitedCount / leads.length) * 100) : 0;
    const completionRate = visitedCount > 0 ? Math.round((completedLeadIds.size / visitedCount) * 100) : 0;
    const closureRate = completedLeadIds.size > 0 ? Math.round((closedLeads / completedLeadIds.size) * 100) : 0;

    return {
      hotLeads, warmLeads, coldLeads, disqLeads, activeLeadsCount,
      completedToday, completedYesterday, completedThisWeek, completedThisMonth, completedVisitsList,
      scheduledToday, scheduledThisWeek, scheduledThisMonth, scheduledVisitsList,
      filteredVisitsList, filteredLeadsList,
      visitsInRangeDataList, upcoming, followUpRemindersList,
      followupsDueToday: followUps.filter(f => f.status === 'pending' && f.date === todayStr).length,
      followupsOverdue: overdueFollowupsCount,
      // Funnel
      visitedCount, completedLeadIds, closedLeads, visitRate, completionRate, closureRate,
      // Missed
      notContactedDays, visitedNoFollowup,
    };
  }, [leads, visits, followUps, dateRange, todayStr]);

  // Leaderboard: per-user stats this month
  const leaderboard = useMemo(() => {
    if (!users.length) return [];
    return users.map(u => {
      const userLeads = leads.filter(l => String(l.assignedTo) === String(u.id));
      const userVisits = visits.filter(v => v.assigned_to === u.name);
      const userCalls = callLogs.filter(c => c.by === u.name);
      const userClosures = userLeads.filter(l => l.status === 'closed').length;
      const userVisitsDone = userVisits.filter(v => v.visit_status === 'completed').length;
      const score = userLeads.length + (userVisitsDone * 3) + (userClosures * 10) + Math.floor(userCalls.length / 5);
      return { user: u, leads: userLeads.length, visits: userVisitsDone, calls: userCalls.length, closures: userClosures, score };
    }).filter(r => r.leads > 0 || r.calls > 0).sort((a, b) => b.score - a.score).slice(0, 8);
  }, [users, leads, visits, callLogs]);

  const chartData = useMemo(() => [
    { name: 'Hot', value: calculatedStats.hotLeads, color: '#E74C3C' },
    { name: 'Warm', value: calculatedStats.warmLeads, color: '#E67E22' },
    { name: 'Cold', value: calculatedStats.coldLeads, color: '#3498DB' },
    { name: 'Disq', value: calculatedStats.disqLeads, color: '#95A5A6' },
  ], [calculatedStats]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-bold text-[#2A1C00] flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/10 rounded-xl">
              <LayoutDashboard size={24} className="text-[#C9A84C]" />
            </div>
            Performance Hub
          </h2>
          <p className="text-[#9A8262] text-sm mt-1 ml-14">Actionable insights & real estate metrics.</p>
        </div>
        <DateRangeSelector selectedRange={dateRange} onChange={setDateRange} />
      </div>

      {/* ===== TODAY'S ACTION TRAY ===== */}
      <div className="bg-gradient-to-r from-[#1C1207] to-[#2A1D0E] border border-amber-900/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-amber-400 font-bold text-sm uppercase tracking-widest">Today's Action Tray</h3>
            <p className="text-amber-200/30 text-[10px]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={() => onNavigate('followups')} className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl p-4 text-left transition-all group">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle size={18} className="text-red-400" />
              <span className="text-2xl font-bold text-red-300">{calculatedStats.followupsOverdue}</span>
            </div>
            <p className="text-red-300 text-xs font-bold">Overdue Follow-ups</p>
            <p className="text-red-400/60 text-[10px] mt-0.5">Action required immediately</p>
          </button>
          <button onClick={() => onNavigate('followups')} className="bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl p-4 text-left transition-all">
            <div className="flex items-center justify-between mb-2">
              <CalendarIcon size={18} className="text-amber-400" />
              <span className="text-2xl font-bold text-amber-300">{calculatedStats.followupsDueToday}</span>
            </div>
            <p className="text-amber-300 text-xs font-bold">Follow-ups Due Today</p>
            <p className="text-amber-400/60 text-[10px] mt-0.5">Complete before EOD</p>
          </button>
          <button onClick={() => onNavigate('visits', undefined, { period: 'today', visitStatus: 'scheduled' })} className="bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-xl p-4 text-left transition-all">
            <div className="flex items-center justify-between mb-2">
              <CalendarDays size={18} className="text-blue-400" />
              <span className="text-2xl font-bold text-blue-300">{calculatedStats.scheduledToday}</span>
            </div>
            <p className="text-blue-300 text-xs font-bold">Visits Scheduled Today</p>
            <p className="text-blue-400/60 text-[10px] mt-0.5">Confirm with clients</p>
          </button>
          <button onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} className="bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 rounded-xl p-4 text-left transition-all">
            <div className="flex items-center justify-between mb-2">
              <FireExtinguisher size={18} className="text-orange-400" />
              <span className="text-2xl font-bold text-orange-300">{calculatedStats.hotLeads}</span>
            </div>
            <p className="text-orange-300 text-xs font-bold">Hot Leads</p>
            <p className="text-orange-400/60 text-[10px] mt-0.5">High priority — call now</p>
          </button>
        </div>
      </div>

      {/* ===== CONVERSION FUNNEL ===== */}
      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center"><TrendingUp size={20} /></div>
          <div>
            <h3 className="font-serif text-xl font-bold text-[#2A1C00]">Conversion Funnel</h3>
            <p className="text-[10px] text-[#9A8262] font-bold uppercase tracking-widest">Lead → Visit → Booking pipeline</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads', value: leads.length, rate: '100%', color: 'bg-slate-200', text: 'text-slate-700', width: 'w-full', nav: () => onNavigate('leads') },
            { label: 'Visited', value: calculatedStats.visitedCount, rate: `${calculatedStats.visitRate}%`, color: 'bg-purple-400', text: 'text-purple-700', width: `w-[${calculatedStats.visitRate}%]`, nav: () => onNavigate('visits') },
            { label: 'Visit Done', value: calculatedStats.completedLeadIds.size, rate: `${calculatedStats.completionRate}%`, color: 'bg-blue-400', text: 'text-blue-700', width: `w-[${calculatedStats.completionRate}%]`, nav: () => onNavigate('visits', undefined, { visitStatus: 'completed' }) },
            { label: 'Closed / Booked', value: calculatedStats.closedLeads, rate: `${calculatedStats.closureRate}%`, color: 'bg-emerald-500', text: 'text-emerald-700', width: `w-[${calculatedStats.closureRate}%]`, nav: () => onNavigate('leads', undefined, { status: 'closed' }) },
          ].map((stage, i) => (
            <button key={i} onClick={stage.nav} className="bg-white border border-[#E6D8B8] rounded-xl p-4 text-left hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">{stage.label}</span>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", stage.color.replace('bg-', 'bg-').replace('400','100').replace('500','100').replace('200','100'), stage.text)}>{stage.rate}</span>
              </div>
              <div className="text-3xl font-serif font-bold text-[#2A1C00] group-hover:text-[#C9A84C] transition-colors">{stage.value}</div>
              <div className="mt-3 h-1.5 bg-[#F5EDD4] rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", stage.color)} style={{ width: stage.rate }} />
              </div>
            </button>
          ))}
        </div>
        {leads.length > 0 && (
          <p className="mt-4 text-center text-[11px] text-[#9A8262]">
            Overall conversion: <span className="font-bold text-[#C9A84C]">{leads.length > 0 ? ((calculatedStats.closedLeads / leads.length) * 100).toFixed(1) : 0}%</span> of leads become bookings
          </p>
        )}
      </div>

      {/* ===== MISSED OPPORTUNITIES ===== */}
      {(calculatedStats.notContactedDays.length > 0 || calculatedStats.visitedNoFollowup.length > 0) && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center"><Target size={18} /></div>
            <div>
              <h3 className="font-bold text-rose-900 text-sm">⚠️ Missed Opportunities — Needs Attention</h3>
              <p className="text-rose-600/60 text-[10px]">Act now to prevent lead loss</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {calculatedStats.notContactedDays.length > 0 && (
              <button onClick={() => onNavigate('leads')} className="bg-white border border-rose-200 rounded-xl p-4 text-left hover:bg-rose-50 transition-all flex items-center justify-between">
                <div>
                  <p className="font-bold text-rose-800 text-sm">{calculatedStats.notContactedDays.length} Leads — No Activity in 7+ Days</p>
                  <p className="text-rose-600/70 text-[11px] mt-0.5">Reassign or schedule follow-up</p>
                </div>
                <ChevronRight size={18} className="text-rose-400" />
              </button>
            )}
            {calculatedStats.visitedNoFollowup.length > 0 && (
              <button onClick={() => onNavigate('visits', undefined, { visitStatus: 'completed' })} className="bg-white border border-rose-200 rounded-xl p-4 text-left hover:bg-rose-50 transition-all flex items-center justify-between">
                <div>
                  <p className="font-bold text-rose-800 text-sm">{calculatedStats.visitedNoFollowup.length} Visits Done — No Follow-up Scheduled</p>
                  <p className="text-rose-600/70 text-[11px] mt-0.5">Schedule post-visit follow-up</p>
                </div>
                <ChevronRight size={18} className="text-rose-400" />
              </button>
            )}
          </div>
        </div>
      )}

      <AIAdvisor 
        leads={leads} 
        visits={visits} 
        followUps={followUps} 
        user={user} 
      />

      {(calculatedStats.followupsDueToday > 0 || calculatedStats.followupsOverdue > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {calculatedStats.followupsOverdue > 0 && (
            <div 
              onClick={() => onNavigate('followups')}
              className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-red-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800">{calculatedStats.followupsOverdue} Overdue Follow-ups</p>
                  <p className="text-xs text-red-600">Action required immediately</p>
                </div>
              </div>
              <Plus className="text-red-400 rotate-45" size={20} />
            </div>
          )}
          {calculatedStats.followupsDueToday > 0 && (
            <div 
              onClick={() => onNavigate('followups')}
              className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-800">{calculatedStats.followupsDueToday} Follow-ups Due Today</p>
                  <p className="text-xs text-blue-600">Check your schedule</p>
                </div>
              </div>
              <Plus className="text-blue-400" size={20} />
            </div>
          )}
        </div>
      )}

      {stats && (
        <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-2xl p-6 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <LayoutDashboard size={80} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-serif text-amber-500">Quick Pulse</h3>
                <p className="text-amber-200/40 text-[10px] uppercase tracking-widest font-mono">Live Database Summary</p>
              </div>
              <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <span className="text-xs font-bold text-amber-500">Today: +{stats.todayCount} Leads</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-6">
              <div className="space-y-3 min-w-[140px]">
                <p className="text-[9px] text-amber-200/20 font-bold uppercase">By Status</p>
                <div className="flex flex-wrap gap-2">
                  {stats.statusStats?.map(s => (
                    <div key={s.status} className="px-2 py-1 bg-white/5 rounded border border-white/10 flex items-center gap-2">
                      <span className="text-[10px] text-amber-200/60 capitalize">{s.status?.replace('_', ' ') || 'Unknown'}</span>
                      <span className="text-[10px] font-bold text-white">{s.count}</span>
                    </div>
                  ))}
                  {(!stats.statusStats || stats.statusStats.length === 0) && <span className="text-[10px] text-white/30 italic">No status data</span>}
                </div>
              </div>

              <div className="space-y-3 min-w-[140px]">
                <p className="text-[9px] text-amber-200/20 font-bold uppercase">By Quality</p>
                <div className="flex flex-wrap gap-2">
                  {stats.qualityStats?.map(q => (
                    <div key={q.quality} className="px-2 py-1 bg-white/5 rounded border border-white/10 flex items-center gap-2">
                      <span className="text-[10px] text-amber-200/60 capitalize">{q.quality || 'Unknown'}</span>
                      <span className="text-[10px] font-bold text-white">{q.count}</span>
                    </div>
                  ))}
                  {(!stats.qualityStats || stats.qualityStats.length === 0) && <span className="text-[10px] text-white/30 italic">No quality data</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays} label="Total Leads (Overall)" value={leads.length} color="gold" onClick={() => onNavigate('leads')} />
        <StatCard icon={CheckCircle2} label="Active Leads" value={calculatedStats.activeLeadsCount} subLabel="Overall - Disqualified" color="green" onClick={() => onNavigate('leads', undefined, { status: '' })} />
        <StatCard icon={CalendarRange} label="Visits Completed" value={calculatedStats.completedVisitsList.length} color="blue" onClick={() => onNavigate('visits', undefined, { visitStatus: 'completed' })} />
        <StatCard icon={Clock} label="Leads (In Range)" value={calculatedStats.filteredLeadsList.length} color="orange" onClick={() => onNavigate('leads')} />
      </div>

      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-3xl p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><CheckCircle2 size={24} /></div>
            <div>
              <h3 className="font-serif text-2xl text-[#2A1C00]">Visit Performance</h3>
              <p className="text-[10px] text-[#9A8262] font-black uppercase tracking-[0.2em] mt-1">Completed engagement history</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <TimelineStat label="Done Today" value={calculatedStats.completedToday} onClick={() => onNavigate('visits', undefined, { period: 'today', visitStatus: 'completed' })} />
            <TimelineStat label="Done Yesterday" value={calculatedStats.completedYesterday} onClick={() => onNavigate('visits', undefined, { visitStatus: 'completed' })} />
            <TimelineStat label="Done This Week" value={calculatedStats.completedThisWeek} onClick={() => onNavigate('visits', undefined, { period: 'week', visitStatus: 'completed' })} />
            <TimelineStat label="Done This Month" value={calculatedStats.completedThisMonth} onClick={() => onNavigate('visits', undefined, { period: 'month', visitStatus: 'completed' })} />
          </div>
        </div>
      </div>

      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-3xl p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><CalendarIcon size={24} /></div>
            <div>
              <h3 className="font-serif text-2xl text-[#2A1C00]">Upcoming Schedule</h3>
              <p className="text-[10px] text-[#9A8262] font-black uppercase tracking-[0.2em] mt-1">Forecasted engagement schedule</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <TimelineStat label="Scheduled Today" value={calculatedStats.scheduledToday} onClick={() => onNavigate('visits', undefined, { period: 'today', visitStatus: 'scheduled' })} />
            <TimelineStat label="Soon (This Week)" value={calculatedStats.scheduledThisWeek} onClick={() => onNavigate('visits', undefined, { period: 'week', visitStatus: 'scheduled' })} />
            <TimelineStat label="This Month" value={calculatedStats.scheduledThisMonth} onClick={() => onNavigate('visits', undefined, { period: 'month', visitStatus: 'scheduled' })} />
            <TimelineStat label="Total Scheduled" value={calculatedStats.scheduledVisitsList.length} onClick={() => onNavigate('visits', undefined, { visitStatus: 'scheduled' })} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FireExtinguisher} label="Hot Leads" value={calculatedStats.hotLeads} color="red" compact onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} />
        <StatCard icon={Thermometer} label="Warm Leads" value={calculatedStats.warmLeads} color="orange" compact onClick={() => onNavigate('leads', undefined, { quality: 'warm' })} />
        <StatCard icon={Snowflake} label="Cold Leads" value={calculatedStats.coldLeads} color="blue" compact onClick={() => onNavigate('leads', undefined, { quality: 'cold' })} />
        <StatCard icon={Ban} label="Disqualified" value={calculatedStats.disqLeads} color="gray" compact onClick={() => onNavigate('leads', undefined, { quality: 'disq' })} />
      </div>

      {/* ===== TEAM LEADERBOARD (admin/manager only) ===== */}
      {(isAdmin || isManager) && leaderboard.length > 0 && (
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E6D8B8] flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><Trophy size={18} /></div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#2A1C00]">Team Leaderboard</h3>
              <p className="text-[10px] text-[#9A8262] font-bold uppercase tracking-widest">Performance across all users</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#FDFAF2] border-b border-[#E6D8B8]">
                  <th className="px-5 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">#</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider text-center">Leads</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider text-center">Calls</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider text-center">Visits Done</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider text-center">Closures</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D8B8]/50">
                {leaderboard.map((row, i) => (
                  <tr key={row.user.id} className="hover:bg-[#FEFCF5] transition-colors">
                    <td className="px-5 py-3">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold", i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-[#F5EDD4] text-[#9A8262]')}>{i + 1}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700">{row.user.name[0]}</div>
                        <span className="font-semibold text-[#2A1C00] text-sm">{row.user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center font-bold text-[#2A1C00]">{row.leads}</td>
                    <td className="px-5 py-3 text-center font-bold text-[#2A1C00]">{row.calls}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", row.visits > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>{row.visits}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", row.closures > 0 ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-slate-100 text-slate-400')}>{row.closures}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#F5EDD4] rounded-full overflow-hidden w-20">
                          <div className="h-full bg-[#C9A84C] rounded-full" style={{ width: `${Math.min(100, (row.score / (leaderboard[0]?.score || 1)) * 100)}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-[#9A8262]">{row.score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl p-7 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-serif text-xl text-[#2A1C00] font-bold">Quality Profile</h3>
            <span className="text-[9px] bg-[#FDFAF2] border border-[#E6D8B8] px-2 py-1 rounded-md font-black text-[#9A8262] uppercase tracking-[0.1em]">Total Database</span>
          </div>
          <div className="w-full min-w-0 h-[260px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6D8B8" opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9A8262', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9A8262', fontWeight: 600 }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(201,168,76,0.03)' }}
                  contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-7 py-5 border-b border-[#E6D8B8] flex items-center justify-between bg-[#FDFAF2]/30">
            <div>
              <h3 className="font-serif text-xl text-[#2A1C00] font-bold flex items-center gap-2"><CalendarIcon className="text-[#C9A84C]" size={20} />Activity Context</h3>
              <p className="text-[10px] text-[#9A8262] font-bold uppercase tracking-widest mt-1">Timeline filtered by selected range</p>
            </div>
            <button onClick={() => onNavigate('visits')} className="text-[#C9A84C] text-[13px] font-bold hover:text-[#B0923D] transition-colors flex items-center gap-1.5">Examine All <Plus className="rotate-45" size={14} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#FDFAF2]/50 border-b border-[#E6D8B8]">
                  <th className="px-7 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Target Opportunity</th>
                  <th className="px-7 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Follow-up Status</th>
                  <th className="px-7 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Temporal Data</th>
                  <th className="px-7 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Status Node</th>
                  <th className="px-7 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em] text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D8B8]/30">
                {calculatedStats.visitsInRangeDataList.length > 0 ? calculatedStats.visitsInRangeDataList.map(v => (
                  <tr key={v.id} className="hover:bg-[#FEFCF5] transition-colors group">
                    <td className="px-7 py-5">
                      <p className="font-bold text-[#2A1C00] text-[14px] group-hover:text-[#C9A84C] transition-colors">{v.client_name}</p>
                      <p className="text-[#9A8262] text-[11px] font-mono tracking-tighter mt-1">{v.mobile}</p>
                    </td>
                    <td className="px-7 py-5">
                      <FollowUpStatusBadge 
                        status={getFollowUpDisplayStatus(getLeadFollowUp(followUps, v.leadId, v.id, visits))}
                        date={getLeadFollowUp(followUps, v.leadId, v.id, visits)?.date}
                        onClick={() => onNavigate('detail', v.id)}
                      />
                    </td>
                    <td className="px-7 py-5">
                      <div className="flex items-center gap-2 text-[#5C4820]">
                        <CalendarIcon size={13} className="text-[#C9A84C]" />
                        <span className="text-[13px] font-bold">
                          {(() => {
                            try {
                              const d = parseISO(v.visit_date);
                              return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                            } catch {
                              return v.visit_date || 'N/A';
                            }
                          })()}
                        </span>
                      </div>
                      <p className="text-[#9A8262] text-[11px] font-medium ml-5 mt-1">{v.visit_time || 'Pending Schedule'}</p>
                    </td>
                    <td className="px-7 py-5 text-[10px]"><StatusBadge status={v.status} /><br /><VisitBadge status={v.visit_status} /></td>
                    <td className="px-7 py-5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => onNavigate('detail', v.id)} className="p-2 text-[#9A8262] hover:bg-[#C9A84C] hover:text-white rounded-[10px]"><Eye size={17} /></button>
                        <button onClick={() => onNavigate('whatsapp', v.id)} className="p-2 text-[#9A8262] hover:bg-emerald-600 hover:text-white rounded-[10px]"><MessageSquare size={17} /></button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-7 py-20 text-center text-[#9A8262] italic opacity-50">Stagnant interval.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl shadow-sm">
          <div className="px-7 py-5 border-b border-[#E6D8B8] bg-rose-50/20"><h3 className="font-serif text-xl font-bold text-rose-900 flex items-center gap-2"><AlertCircle size={20} className="text-rose-600" />Follow-ups</h3></div>
          <div className="divide-y divide-[#E6D8B8]/30">
            {calculatedStats.followUpRemindersList.map(v => (
              <div key={v.id} className="px-7 py-5 flex items-center justify-between">
                <div><p className="font-bold text-[#2A1C00]">{v.client_name}</p><p className="text-rose-600/70 text-[11px] font-bold">Missed on {v.visit_date}</p></div>
                <button onClick={() => onNavigate('detail', v.id)} className="bg-rose-100 text-rose-800 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Retrieve</button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl shadow-sm">
          <div className="px-7 py-5 border-b border-[#E6D8B8]"><h3 className="font-serif text-xl font-bold text-[#2A1C00] flex items-center gap-2"><Clock size={20} className="text-[#C9A84C]" />Upcoming</h3></div>
          <div className="divide-y divide-[#E6D8B8]/30">
            {calculatedStats.upcoming.map(v => (
              <div key={v.id} className="px-7 py-5 flex items-center justify-between">
                <div><p className="font-bold text-[#2A1C00]">{v.client_name}</p><p className="text-[#9A8262] text-[11px] font-bold">{v.visit_date}</p></div>
                <button onClick={() => onNavigate('detail', v.id)} className="p-2 text-[#9A8262] hover:text-[#C9A84C]"><Eye size={17} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

function StatCard({ icon: Icon, label, value, subLabel, color, compact = false, onClick }: any) {
  const colors: any = {
    gold: 'bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/20',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-500/10',
    blue: 'bg-indigo-50 text-indigo-600 border-indigo-500/10',
    orange: 'bg-amber-50 text-amber-600 border-amber-500/10',
    red: 'bg-rose-50 text-rose-600 border-rose-500/10',
    gray: 'bg-slate-50 text-slate-600 border-slate-500/10',
  };
  return (
    <div onClick={onClick} className={cn("bg-white border border-[#E6D8B8] rounded-2xl p-5 flex items-center gap-4 shadow-sm relative overflow-hidden transition-all hover:scale-[1.02] group", onClick && "cursor-pointer")}>
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border", colors[color].split(' ').slice(0, 3).join(' '))}>
        <Icon size={26} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-3xl font-serif font-bold text-[#2A1C00] leading-none tabular-nums truncate group-hover:text-[#C9A84C] transition-colors">{value}</div>
        <div className="text-[10px] text-[#9A8262] font-black uppercase tracking-[0.15em] mt-2">{label}</div>
        {subLabel && <div className="text-[9px] text-[#B0923D] font-bold italic mt-1 leading-tight">{subLabel}</div>}
      </div>
    </div>
  );
}

function TimelineStat({ label, value, onClick }: { label: string, value: number, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("group bg-white/40 border border-[#E6D8B8]/30 rounded-2xl p-5 hover:bg-white hover:shadow-xl transition-all", onClick && "cursor-pointer")}>
      <div className="text-4xl font-serif font-bold text-[#2A1C00] mb-2 group-hover:text-[#C9A84C] tabular-nums">{value}</div>
      <div className="text-[10px] text-[#9A8262] font-black uppercase tracking-[0.1em]">{label}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    hot: 'bg-rose-50 text-rose-600 border border-rose-100',
    warm: 'bg-amber-50 text-amber-600 border border-amber-100',
    cold: 'bg-indigo-600 text-white shadow-sm',
    pending: 'bg-slate-50 text-slate-500 border border-slate-200',
    disq: 'bg-slate-100 text-slate-400',
    visit_scheduled: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    visit_done: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };
  const emojis: any = { hot: '🔥', warm: '🌡️', cold: '❄️', pending: '⏳', disq: '🚫', visit_scheduled: '📅', visit_done: '✅' };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", styles[status])}>
      <span className="text-[12px]">{emojis[status]}</span> {status}
    </span>
  );
}

export function VisitBadge({ status }: { status: string }) {
  const styles: any = {
    scheduled: 'bg-indigo-600 text-white shadow-sm',
    completed: 'bg-emerald-600 text-white shadow-sm',
    rescheduled: 'bg-amber-50 text-amber-700 border border-amber-200',
    cancelled: 'bg-rose-50 text-rose-600 border border-rose-200',
  };
  const icons: any = { scheduled: '📅', completed: '✅', rescheduled: '🔄', cancelled: '❌' };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", styles[status])}>
      <span className="text-[12px]">{icons[status]}</span> {status.replace('_', ' ')}
    </span>
  );
}
