import React, { useMemo } from 'react';
import { CheckCircle2, Calendar, Phone, AlertCircle, TrendingUp, Users, ArrowRight, ChevronRight, Clock, Target } from 'lucide-react';
import { Lead, Visit, FollowUp, CallLog, User, Page } from '../types';
import { cn, getLocalDateString } from '../lib/utils';
import { isToday, parseISO } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface TodayOverviewProps {
  leads: Lead[];
  visits: Visit[];
  followUps: FollowUp[];
  callLogs: CallLog[];
  users: User[];
  user: User;
  onNavigate: (page: Page, id?: string, filters?: any) => void;
}

const safeDate = (s: string | undefined) => { try { const d = parseISO(s || ''); return isNaN(d.getTime()) ? null : d; } catch { return null; } };

export default function TodayOverview({ leads, visits, followUps, callLogs, users, user, onNavigate }: TodayOverviewProps) {
  const todayStr = getLocalDateString();
  const role = user?.role?.toLowerCase();
  const isAdmin = role === 'admin' || role === 'adm';

  const s = useMemo(() => {
    const todayVisits = visits.filter(v => v.visit_date === todayStr);
    const visitsDone = todayVisits.filter(v => v.visit_status === 'completed').length;
    const visitsScheduled = todayVisits.filter(v => v.visit_status === 'scheduled' || v.visit_status === 'rescheduled').length;
    const followupsDone = followUps.filter(f => f.status === 'completed' && (f.completed_at?.startsWith(todayStr) || f.date === todayStr)).length;
    const followupsPending = followUps.filter(f => f.status === 'pending' && f.date === todayStr).length;
    const followupsOverdue = followUps.filter(f => f.status === 'pending' && f.date < todayStr).length;
    const todayCalls = callLogs.filter(c => c.timestamp?.startsWith(todayStr));
    const callsMade = todayCalls.length;
    const bookings = leads.filter(l => l.status === 'closed' && l.updated_at?.startsWith(todayStr)).length;
    const hotLeads = leads.filter(l => l.quality === 'hot').length;

    // Team performance today
    const teamPerf = users.filter(u => u.role !== 'admin' && u.role !== 'adm').map(u => {
      const uFollowups = followUps.filter(f => f.userName === u.name && f.status === 'completed' && (f.completed_at?.startsWith(todayStr) || f.date === todayStr)).length;
      const uFollowupsTarget = followUps.filter(f => f.userName === u.name && f.date === todayStr).length || 1;
      const uVisitsDone = visits.filter(v => v.assigned_to === u.name && v.visit_status === 'completed' && v.visit_date === todayStr).length;
      const uVisitsTarget = visits.filter(v => v.assigned_to === u.name && (v.visit_status === 'scheduled' || v.visit_status === 'completed') && v.visit_date === todayStr).length || 1;
      const uCalls = callLogs.filter(c => c.by === u.name && c.timestamp?.startsWith(todayStr)).length;
      const uCallsTarget = 10;
      const uBookings = leads.filter(l => l.assignedToName === u.name && l.status === 'closed' && l.updated_at?.startsWith(todayStr)).length;
      const perfPct = Math.round(((uFollowups / uFollowupsTarget) * 0.4 + (uVisitsDone / uVisitsTarget) * 0.4 + Math.min(uCalls / uCallsTarget, 1) * 0.2) * 100);
      const perfLabel = perfPct >= 90 ? 'Excellent' : perfPct >= 70 ? 'Good' : perfPct >= 50 ? 'Average' : 'Needs Work';
      const perfColor = perfPct >= 90 ? 'text-green-600' : perfPct >= 70 ? 'text-blue-600' : perfPct >= 50 ? 'text-amber-600' : 'text-red-600';
      return { user: u, followupsDone: uFollowups, followupsTarget: uFollowupsTarget, visitsDone: uVisitsDone, visitsTarget: uVisitsTarget, calls: uCalls, callsTarget: uCallsTarget, bookings: uBookings, perfPct, perfLabel, perfColor };
    }).sort((a, b) => b.perfPct - a.perfPct);

    // Visit status for donut
    const visitPieData = [
      { name: 'Completed', value: visitsDone, color: '#22c55e' },
      { name: 'Pending', value: visitsScheduled, color: '#f59e0b' },
      { name: 'Cancelled', value: todayVisits.filter(v => v.visit_status === 'cancelled').length, color: '#ef4444' },
    ].filter(d => d.value > 0);

    const followupPieData = [
      { name: 'Done', value: followupsDone, color: '#22c55e' },
      { name: 'Pending', value: followupsPending, color: '#f59e0b' },
      { name: 'Missed', value: followupsOverdue, color: '#ef4444' },
    ].filter(d => d.value > 0);

    return { visitsDone, visitsScheduled, followupsDone, followupsPending, followupsOverdue, callsMade, bookings, hotLeads, teamPerf, visitPieData, followupPieData, todayVisitsTotal: todayVisits.length, todayCalls };
  }, [leads, visits, followUps, callLogs, users, todayStr]);

  const kpiCards = [
    { label: 'Follow-ups Done', value: s.followupsDone, target: s.followupsDone + s.followupsPending || 20, color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500', icon: CheckCircle2, nav: () => onNavigate('followups') },
    { label: 'Visits Done', value: s.visitsDone, target: s.todayVisitsTotal || 6, color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500', icon: Calendar, nav: () => onNavigate('visits', undefined, { period: 'today', visitStatus: 'completed' }) },
    { label: 'Bookings', value: s.bookings, target: 2, color: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-500', icon: Target, nav: () => onNavigate('leads', undefined, { status: 'closed' }) },
    { label: 'Calls Made', value: s.callsMade, target: 60, color: 'text-orange-600', bg: 'bg-orange-50', bar: 'bg-orange-500', icon: Phone, nav: () => onNavigate('reports') },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-3xl font-bold text-[#2A1C00]">Today Overview</h2>
          <p className="text-[#9A8262] text-sm mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((k, i) => {
          const pct = Math.min(100, k.target > 0 ? Math.round((k.value / k.target) * 100) : 0);
          return (
            <button key={i} onClick={k.nav} className="bg-white border border-[#E6D8B8] rounded-2xl p-5 text-left hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', k.bg)}>
                  <k.icon size={16} className={k.color} />
                </div>
                <span className={cn('text-xs font-bold', k.color)}>{pct}%</span>
              </div>
              <div className="text-3xl font-serif font-bold text-[#2A1C00] group-hover:text-[#C9A84C] transition-colors">{k.value}</div>
              <div className="text-[10px] text-[#9A8262] font-bold uppercase tracking-wider mt-1">{k.label}</div>
              <div className="text-[10px] text-[#9A8262] mt-1">Target: {k.target}</div>
              <div className="mt-3 h-1.5 bg-[#F5EDD4] rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', k.bar)} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Team Performance */}
      {(isAdmin || s.teamPerf.length > 0) && (
        <div className="bg-white border border-[#E6D8B8] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E6D8B8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><Users size={18} /></div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2A1C00]">Team Performance (Today)</h3>
              </div>
            </div>
            <button onClick={() => onNavigate('reports')} className="text-[#C9A84C] text-xs font-bold hover:underline flex items-center gap-1">View Full Report <ChevronRight size={14} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#FDFAF2] border-b border-[#E6D8B8]">
                  {['#', 'Team Member', 'Follow-ups Done', 'Visits Done', 'Calls Made', 'Bookings', 'Performance'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D8B8]/50">
                {s.teamPerf.map((row, i) => (
                  <tr key={row.user.id} className="hover:bg-[#FEFCF5] transition-colors">
                    <td className="px-4 py-3">
                      <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold', i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-[#F5EDD4] text-[#9A8262]')}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700">{row.user.name[0]}</div>
                        <span className="font-semibold text-[#2A1C00] text-sm whitespace-nowrap">{row.user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-[#2A1C00]">{row.followupsDone}/{row.followupsTarget}</div>
                      <div className={cn('text-[10px] font-bold', row.followupsDone >= row.followupsTarget ? 'text-green-600' : 'text-amber-600')}>{Math.round((row.followupsDone / row.followupsTarget) * 100)}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-[#2A1C00]">{row.visitsDone}/{row.visitsTarget}</div>
                      <div className={cn('text-[10px] font-bold', row.visitsDone >= row.visitsTarget ? 'text-green-600' : 'text-amber-600')}>{Math.round((row.visitsDone / row.visitsTarget) * 100)}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-[#2A1C00]">{row.calls}/{row.callsTarget}</div>
                      <div className={cn('text-[10px] font-bold', row.calls >= row.callsTarget ? 'text-green-600' : 'text-amber-600')}>{Math.round(Math.min(100, (row.calls / row.callsTarget) * 100))}%</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#2A1C00]">{row.bookings}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', row.perfPct >= 90 ? 'bg-green-100 text-green-700' : row.perfPct >= 70 ? 'bg-blue-100 text-blue-700' : row.perfPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{row.perfLabel}</span>
                    </td>
                  </tr>
                ))}
                {s.teamPerf.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[#9A8262] text-sm">No team data for today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Today Activity Flow */}
      <div className="bg-white border border-[#E6D8B8] rounded-2xl p-6">
        <h3 className="font-serif text-lg font-bold text-[#2A1C00] mb-4">Today Activity Flow</h3>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Total Leads', value: leads.length, sub: '(Active)', color: 'bg-slate-100 text-slate-700', nav: () => onNavigate('leads') },
            { label: 'Calls Made', value: s.callsMade, sub: `${s.callsMade > 0 ? Math.round((s.callsMade / 60) * 100) : 0}% vs target`, color: 'bg-blue-50 text-blue-700', nav: () => onNavigate('reports') },
            { label: 'Follow-ups Done', value: s.followupsDone, sub: `${s.followupsDone + s.followupsPending > 0 ? Math.round((s.followupsDone / (s.followupsDone + s.followupsPending)) * 100) : 0}% vs target`, color: 'bg-green-50 text-green-700', nav: () => onNavigate('followups') },
            { label: 'Visits Done', value: s.visitsDone, sub: `${s.todayVisitsTotal > 0 ? Math.round((s.visitsDone / s.todayVisitsTotal) * 100) : 0}% vs target`, color: 'bg-amber-50 text-amber-700', nav: () => onNavigate('visits', undefined, { period: 'today', visitStatus: 'completed' }) },
            { label: 'Bookings', value: s.bookings, sub: `${Math.round((s.bookings / 2) * 100)}% vs target`, color: 'bg-purple-50 text-purple-700', nav: () => onNavigate('leads', undefined, { status: 'closed' }) },
          ].map((item, i, arr) => (
            <React.Fragment key={i}>
              <button onClick={item.nav} className={cn('rounded-xl px-4 py-3 text-left hover:shadow-md transition-all', item.color)}>
                <div className="text-2xl font-serif font-bold">{item.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{item.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{item.sub}</div>
              </button>
              {i < arr.length - 1 && <ArrowRight size={16} className="text-[#9A8262] flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* What's Good / What Needs Attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E6D8B8] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-green-500" />
            <h3 className="font-bold text-[#2A1C00] text-sm uppercase tracking-wider">What's Good Today</h3>
          </div>
          <div className="space-y-3">
            {s.visitsDone > 0 && <div className="flex items-start gap-3"><div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5"><CheckCircle2 size={12} className="text-green-600" /></div><div><p className="text-sm font-semibold text-[#2A1C00]">{s.visitsDone} visits completed today</p><p className="text-[11px] text-[#9A8262]">Great job team!</p></div></div>}
            {s.followupsDone > 0 && <div className="flex items-start gap-3"><div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5"><CheckCircle2 size={12} className="text-green-600" /></div><div><p className="text-sm font-semibold text-[#2A1C00]">{s.followupsDone} follow-ups completed</p><p className="text-[11px] text-[#9A8262]">On track for the day</p></div></div>}
            {s.bookings > 0 && <div className="flex items-start gap-3"><div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5"><CheckCircle2 size={12} className="text-green-600" /></div><div><p className="text-sm font-semibold text-[#2A1C00]">{s.bookings} booking confirmed today</p><p className="text-[11px] text-[#9A8262]">Excellent conversion!</p></div></div>}
            {s.visitsDone === 0 && s.followupsDone === 0 && s.bookings === 0 && <p className="text-sm text-[#9A8262] italic py-4 text-center">Start your day — complete first action!</p>}
          </div>
        </div>
        <div className="bg-white border border-[#E6D8B8] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-amber-500" />
            <h3 className="font-bold text-[#2A1C00] text-sm uppercase tracking-wider">What Needs Attention</h3>
          </div>
          <div className="space-y-3">
            {s.followupsOverdue > 0 && <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center"><AlertCircle size={12} className="text-red-600" /></div><div><p className="text-sm font-semibold text-[#2A1C00]">{s.followupsOverdue} overdue follow-ups</p><p className="text-[11px] text-[#9A8262]">Action required</p></div></div><button onClick={() => onNavigate('followups')} className="text-[10px] text-[#C9A84C] font-bold hover:underline">View</button></div>}
            {s.hotLeads > 0 && <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center"><AlertCircle size={12} className="text-orange-600" /></div><div><p className="text-sm font-semibold text-[#2A1C00]">{s.hotLeads} hot leads need attention</p><p className="text-[11px] text-[#9A8262]">Potential loss</p></div></div><button onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} className="text-[10px] text-[#C9A84C] font-bold hover:underline">View</button></div>}
            {s.followupsOverdue === 0 && s.hotLeads === 0 && <p className="text-sm text-green-600 font-semibold py-4 text-center">✅ All clear — great performance!</p>}
          </div>
        </div>
      </div>

      {/* Visit & Follow-up Status Donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E6D8B8] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#2A1C00] text-sm uppercase tracking-wider">Visits Status (Today)</h3>
            <button onClick={() => onNavigate('visits', undefined, { period: 'today' })} className="text-[10px] text-[#C9A84C] font-bold hover:underline flex items-center gap-1">View Visit List <ChevronRight size={12} /></button>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={s.visitPieData.length > 0 ? s.visitPieData : [{ name: 'None', value: 1, color: '#E6D8B8' }]} innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={2}>{(s.visitPieData.length > 0 ? s.visitPieData : [{ name: 'None', value: 1, color: '#E6D8B8' }]).map((e: any, i: number) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="text-center mb-2"><span className="text-2xl font-serif font-bold text-[#2A1C00]">{s.todayVisitsTotal}</span><p className="text-[10px] text-[#9A8262]">Total Scheduled</p></div>
              {[{ label: 'Completed', value: s.visitsDone, color: 'bg-green-500' }, { label: 'Pending', value: s.visitsScheduled, color: 'bg-amber-400' }].map(r => <div key={r.label} className="flex items-center gap-2 text-xs"><div className={cn('w-2 h-2 rounded-full', r.color)} /><span className="text-[#2A1C00] font-semibold">{r.value}</span><span className="text-[#9A8262]">{r.label} ({s.todayVisitsTotal > 0 ? Math.round((r.value / s.todayVisitsTotal) * 100) : 0}%)</span></div>)}
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#E6D8B8] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#2A1C00] text-sm uppercase tracking-wider">Follow-up Status (Today)</h3>
            <button onClick={() => onNavigate('followups')} className="text-[10px] text-[#C9A84C] font-bold hover:underline flex items-center gap-1">View Follow-ups <ChevronRight size={12} /></button>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={s.followupPieData.length > 0 ? s.followupPieData : [{ name: 'None', value: 1, color: '#E6D8B8' }]} innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={2}>{(s.followupPieData.length > 0 ? s.followupPieData : [{ name: 'None', value: 1, color: '#E6D8B8' }]).map((e: any, i: number) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="text-center mb-2"><span className="text-2xl font-serif font-bold text-[#2A1C00]">{s.followupsDone + s.followupsPending}</span><p className="text-[10px] text-[#9A8262]">Total Scheduled</p></div>
              {[{ label: 'Done', value: s.followupsDone, color: 'bg-green-500' }, { label: 'Pending', value: s.followupsPending, color: 'bg-amber-400' }, { label: 'Missed', value: s.followupsOverdue, color: 'bg-red-500' }].map(r => { const total = s.followupsDone + s.followupsPending + s.followupsOverdue; return <div key={r.label} className="flex items-center gap-2 text-xs"><div className={cn('w-2 h-2 rounded-full', r.color)} /><span className="text-[#2A1C00] font-semibold">{r.value}</span><span className="text-[#9A8262]">{r.label} ({total > 0 ? Math.round((r.value / total) * 100) : 0}%)</span></div>; })}
            </div>
          </div>
        </div>
      </div>

      {/* Tip bar */}
      <div className="bg-[#2A1D0E] rounded-2xl p-4 flex items-center justify-between">
        <p className="text-amber-200/80 text-sm">💡 <span className="font-bold">Tip for Today:</span> {s.followupsOverdue > 0 ? `Focus on clearing ${s.followupsOverdue} overdue follow-ups.` : s.hotLeads > 0 ? `You have ${s.hotLeads} hot leads — call them first!` : 'Great work! Keep the momentum going.'}</p>
        <button onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} className="bg-[#C9A84C] text-[#1C1207] text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#B59640] transition-all whitespace-nowrap ml-4">Launch Daily Plan →</button>
      </div>
    </div>
  );
}
