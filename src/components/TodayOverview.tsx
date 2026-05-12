import React, { useMemo } from 'react';
import { CheckCircle2, Calendar, Phone, AlertCircle, TrendingUp, Users, ArrowRight, ChevronRight, Clock, Target, Sparkles, MessageSquare, TrendingDown } from 'lucide-react';
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
    const normalizeDate = (d: string) => {
      if (!d) return '';
      if (d.includes('T') || d.includes('Z')) {
        try {
          return getLocalDateString(new Date(d));
        } catch {
          return d.split('T')[0];
        }
      }
      return d;
    };

    const todayVisits = visits.filter(v => v.visit_date === todayStr);
    const visitsDone = todayVisits.filter(v => v.visit_status === 'completed').length;
    const visitsScheduled = todayVisits.filter(v => v.visit_status === 'scheduled' || v.visit_status === 'rescheduled').length;
    const followupsDone = followUps.filter(f => f.status === 'completed' && (f.completed_at?.startsWith(todayStr) || normalizeDate(f.date) === todayStr)).length;
    const followupsPending = followUps.filter(f => f.status === 'pending' && normalizeDate(f.date) === todayStr).length;
    const followupsOverdue = followUps.filter(f => f.status === 'pending' && normalizeDate(f.date) < todayStr).length;
    const todayCalls = callLogs.filter(c => c.timestamp?.startsWith(todayStr));
    const callsMade = todayCalls.length;
    const bookings = leads.filter(l => l.status === 'closed' && l.updated_at?.startsWith(todayStr)).length;
    const hotLeads = leads.filter(l => l.quality === 'hot').length;

    // Yesterday stats for trend indicators
    const d = new Date(); d.setDate(d.getDate() - 1);
    const yStr = getLocalDateString(d);
    const yCalls = callLogs.filter(c => c.timestamp?.startsWith(yStr)).length;
    const yVisits = visits.filter(v => v.visit_date === yStr && v.visit_status === 'completed').length;
    const yFollowups = followUps.filter(f => f.status === 'completed' && (f.completed_at?.startsWith(yStr) || normalizeDate(f.date) === yStr)).length;
    const trend = { calls: callsMade - yCalls, visits: visitsDone - yVisits, followups: followupsDone - yFollowups };

    // Team performance today
    const teamPerf = users.filter(u => u.role !== 'admin' && u.role !== 'adm').map(u => {
      const uFollowups = followUps.filter(f => f.userName === u.name && f.status === 'completed' && (f.completed_at?.startsWith(todayStr) || normalizeDate(f.date) === todayStr)).length;
      const uFollowupsTarget = followUps.filter(f => f.userName === u.name && normalizeDate(f.date) === todayStr).length || 1;
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

    const todayFollowUps = followUps.filter(f => 
      f.userName === user.name && 
      f.status === 'pending' && 
      normalizeDate(f.date) <= todayStr
    ).sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 3);

    const todayVisitsNext = visits.filter(v => 
      v.assigned_to === user.name && 
      v.visit_status === 'scheduled' && 
      v.visit_date === todayStr
    ).slice(0, 2);

    return { 
      visitsDone, visitsScheduled, followupsDone, followupsPending, followupsOverdue, 
      callsMade, bookings, hotLeads, teamPerf, visitPieData, followupPieData, 
      todayVisitsTotal: todayVisits.length, todayCalls,
      nextActions: [...todayFollowUps, ...todayVisitsNext], trend
    };
  }, [leads, visits, followUps, callLogs, users, todayStr, user.name]);

  const kpiCards = [
    { label: 'Follow-ups Done', value: s.followupsDone, target: s.followupsDone + s.followupsPending || 20, color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500', icon: CheckCircle2, nav: () => onNavigate('followups') },
    { label: 'Visits Done', value: s.visitsDone, target: s.todayVisitsTotal || 6, color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500', icon: Calendar, nav: () => onNavigate('visits', undefined, { period: 'today', visitStatus: 'completed' }) },
    { label: 'Bookings', value: s.bookings, target: 2, color: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-500', icon: Target, nav: () => onNavigate('leads', undefined, { status: 'closed' }) },
    { label: 'Calls Made', value: s.callsMade, target: 60, color: 'text-orange-600', bg: 'bg-orange-50', bar: 'bg-orange-500', icon: Phone, nav: () => onNavigate('reports') },
  ];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Premium Command Center Header */}
      <div className="relative overflow-hidden bg-[#1C1207] rounded-[2.5rem] p-8 lg:p-10 border border-[#C9A84C]/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A84C]/10 rounded-full -mr-48 -mt-48 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full -ml-32 -mb-32 blur-2xl" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded-full text-[#C9A84C] text-[10px] font-black uppercase tracking-[0.2em]">
              <Sparkles size={12} />
              Mission Command
            </div>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold text-white tracking-tight">
              Hello, <span className="text-[#C9A84C]">{user.name.split(' ')[0]}</span>
            </h2>
            <p className="text-white/60 text-base font-medium">
              You have <span className="text-white font-bold">{s.followupsPending + s.visitsScheduled} actions</span> scheduled for today.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-xl p-4 rounded-3xl border border-white/10">
            <div className="text-right">
              <p className="text-[10px] text-[#C9A84C] font-black uppercase tracking-widest">Today's Progress</p>
              <p className="text-2xl font-serif font-black text-white">{Math.round((s.followupsDone / (s.followupsDone + s.followupsPending || 1)) * 100)}%</p>
            </div>
            <div className="w-16 h-16 relative">
               <svg className="w-full h-full" viewBox="0 0 36 36">
                 <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
                 <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" 
                   strokeDasharray={`${Math.round((s.followupsDone / (s.followupsDone + s.followupsPending || 1)) * 100)}, 100`} 
                   className="text-[#C9A84C]" strokeLinecap="round" transform="rotate(-90 18 18)" />
               </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Mission Control & Stats */}
        <div className="lg:col-span-2 space-y-8">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map((k, i) => {
              const pct = Math.min(100, k.target > 0 ? Math.round((k.value / k.target) * 100) : 0);
              return (
                <button 
                  key={i} 
                  onClick={k.nav} 
                  className="bg-white border border-[#E6D8B8] rounded-[2rem] p-6 text-left hover:border-[#C9A84C] hover:shadow-xl transition-all group relative overflow-hidden"
                >
                  <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110', k.bg)}>
                    <k.icon size={20} className={k.color} />
                  </div>
                  <div className="text-3xl font-serif font-black text-[#2A1C00]">{k.value}</div>
                  <div className="text-[10px] text-[#9A8262] font-black uppercase tracking-widest mt-1">{k.label}</div>
                  
                  {/* Subtle bar */}
                  <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-1000', k.bar)} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Activity Flow Section */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-serif text-2xl font-bold text-[#2A1C00] mb-8 flex items-center gap-3">
               <TrendingUp size={24} className="text-[#C9A84C]" />
               Business Velocity
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              {[
                { label: 'Pipeline', value: leads.length, icon: Users, color: 'bg-indigo-50 text-indigo-600', trend: null, nav: () => onNavigate('leads') },
                { label: 'Calls Today', value: s.callsMade, icon: Phone, color: 'bg-orange-50 text-orange-600', trend: s.trend.calls, nav: () => onNavigate('reports') },
                { label: 'Visits Done', value: s.visitsDone, icon: Calendar, color: 'bg-emerald-50 text-emerald-600', trend: s.trend.visits, nav: () => onNavigate('visits') },
                { label: 'Closures', value: s.bookings, icon: Target, color: 'bg-purple-50 text-purple-600', trend: null, nav: () => onNavigate('leads') },
              ].map((item, i, arr) => (
                <React.Fragment key={i}>
                  <button 
                    onClick={item.nav} 
                    className={cn('flex-1 min-w-[140px] rounded-[2rem] p-6 text-left hover:shadow-lg transition-all border border-transparent hover:border-[#E6D8B8]', item.color)}
                  >
                    <item.icon size={18} className="mb-2 opacity-60" />
                    <div className="flex items-end gap-2">
                      <div className="text-3xl font-serif font-black">{item.value}</div>
                      {item.trend !== null && item.trend !== undefined && (
                        <span className={cn('text-[10px] font-black mb-1 flex items-center gap-0.5', item.trend > 0 ? 'text-emerald-600' : item.trend < 0 ? 'text-red-500' : 'opacity-40')}>
                          {item.trend > 0 ? <TrendingUp size={10}/> : item.trend < 0 ? <TrendingDown size={10}/> : null}
                          {item.trend > 0 ? `+${item.trend}` : item.trend === 0 ? '—' : item.trend} vs yday
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">{item.label}</div>
                  </button>
                  {i < arr.length - 1 && <ChevronRight size={20} className="text-[#E6D8B8] hidden xl:block" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Team Performance Table */}
          {(isAdmin || s.teamPerf.length > 0) && (
            <div className="bg-white border border-[#E6D8B8] rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-[#E6D8B8] flex items-center justify-between bg-[#FDFAF2]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#C9A84C]/10 text-[#C9A84C] rounded-2xl flex items-center justify-center shadow-sm border border-[#C9A84C]/20">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#2A1C00]">Team Leaderboard (Today)</h3>
                    <p className="text-[10px] text-[#9A8262] font-bold uppercase tracking-widest">Real-time stats</p>
                  </div>
                </div>
                <button onClick={() => onNavigate('reports')} className="bg-white border border-[#E6D8B8] text-[#C9A84C] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#FDFAF2] transition-all flex items-center gap-2 shadow-sm">
                  View Analytics <ArrowRight size={14} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#FDFAF2]/50 border-b border-[#E6D8B8]">
                      {['Rank', 'Salesman', 'F-Ups', 'Visits', 'Calls', 'Deals', 'Grade', 'Score'].map(h => (
                        <th key={h} className="px-4 py-4 text-[10px] font-black text-[#9A8262] uppercase tracking-[0.15em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6D8B8]/30">
                    {s.teamPerf.map((row, i) => {
                      const grade = row.perfPct >= 90 ? 'A' : row.perfPct >= 70 ? 'B' : row.perfPct >= 50 ? 'C' : 'D';
                      const gradeColor = row.perfPct >= 90 ? 'bg-emerald-100 text-emerald-700' : row.perfPct >= 70 ? 'bg-blue-100 text-blue-700' : row.perfPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
                      const avgCalls = s.teamPerf.reduce((a, r) => a + r.calls, 0) / (s.teamPerf.length || 1);
                      return (
                      <tr key={row.user.id} className={cn('hover:bg-[#FDFAF2]/40 transition-colors', row.perfPct >= 70 ? 'border-l-2 border-l-emerald-400' : row.perfPct < 50 ? 'border-l-2 border-l-red-300' : '')}>
                        <td className="px-4 py-4">
                          <span className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-sm', i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400')}>{i + 1}</span>
                        </td>
                        <td className="px-4 py-4 font-bold text-[#2A1C00] text-sm">{row.user.name}</td>
                        <td className="px-4 py-4">
                          <span className={cn('text-sm font-bold', row.followupsDone === 0 ? 'text-[#9A8262] italic text-[11px]' : 'text-[#2A1C00]')}>{row.followupsDone === 0 ? 'Pending' : row.followupsDone}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('text-sm font-bold', row.visitsDone === 0 ? 'text-[#9A8262] italic text-[11px]' : 'text-emerald-600')}>{row.visitsDone === 0 ? 'Pending' : row.visitsDone}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('text-sm font-bold', row.calls > avgCalls ? 'text-emerald-600' : row.calls === 0 ? 'text-[#9A8262] italic text-[11px]' : 'text-[#2A1C00]')}>{row.calls === 0 ? 'Pending' : row.calls}</span>
                        </td>
                        <td className="px-4 py-4 font-black text-emerald-600">{row.bookings || <span className="text-[#9A8262] font-normal text-[11px] italic">—</span>}</td>
                        <td className="px-4 py-4">
                          <span className={cn('px-2 py-0.5 rounded-lg text-xs font-black', gradeColor)}>{grade}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', row.perfPct >= 70 ? 'bg-emerald-500' : row.perfPct >= 50 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${row.perfPct}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-[#9A8262]">{row.perfPct}%</span>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Personal Assistant & Intelligence */}
        <div className="space-y-8">
          {/* My Next Actions (Floating Card Style) */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl font-bold text-[#2A1C00] flex items-center gap-2">
                <Clock className="text-[#C9A84C]" size={20} />
                My Next Actions
              </h3>
              <div className="w-6 h-6 rounded-full bg-[#C9A84C] text-white text-[10px] font-black flex items-center justify-center">
                {s.nextActions.length}
              </div>
            </div>
            
            <div className="space-y-3">
              {s.nextActions.map((action: any, idx) => {
                const name = action.client_name || action.name || 'Client';
                const mobile = action.mobile || '';
                const isVisit = 'visit_date' in action;
                return (
                <div key={idx} className="p-4 bg-white border border-[#E6D8B8] rounded-2xl hover:border-[#C9A84C] hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FDFAF2] flex items-center justify-center group-hover:bg-[#C9A84C]/10 transition-colors shrink-0">
                        {isVisit ? <Calendar size={14} className="text-purple-500" /> : <Phone size={14} className="text-blue-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#2A1C00] line-clamp-1 cursor-pointer hover:text-[#C9A84C]" onClick={() => onNavigate(isVisit ? 'detail' : 'followups', action.id || action.leadId)}>{name}</p>
                        {mobile && <p className="text-[10px] text-[#9A8262] font-mono">{mobile}</p>}
                        <p className="text-[10px] text-[#9A8262] font-bold mt-0.5">{isVisit ? (action.visit_time || 'All Day Visit') : action.method === 'call' ? '📞 Call' : '✅ Follow-up'}</p>
                      </div>
                    </div>
                    {mobile && (
                      <div className="flex gap-1.5 shrink-0">
                        <a href={`tel:${mobile}`} onClick={e => e.stopPropagation()} className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                          <Phone size={13} />
                        </a>
                        <a href={`https://wa.me/91${mobile.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                          <MessageSquare size={13} />
                        </a>
                      </div>
                    )}
                  </div>
                  {action.purpose && <p className="text-[11px] text-[#5C4820] italic line-clamp-1 bg-[#FDFAF2] px-2 py-1 rounded-lg mt-1">{action.purpose}</p>}
                </div>
                );
              })}
              {s.nextActions.length === 0 && (
                <div className="text-center py-10">
                  <CheckCircle2 size={32} className="mx-auto text-[#C9A84C] opacity-20 mb-3" />
                  <p className="text-xs text-[#9A8262] font-medium">All clear for now!</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => onNavigate('followups')}
              className="w-full mt-6 bg-[#C9A84C] text-[#1C1207] py-3 rounded-2xl font-bold text-xs hover:bg-[#B59640] transition-all flex items-center justify-center gap-2"
            >
              Go to Daily Planner <ArrowRight size={14} />
            </button>
          </div>

          {/* Intelligence Alerts */}
          <div className="bg-[#FDFAF2] border border-[#E6D8B8] rounded-[2.5rem] p-8 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2 mb-6">
              <AlertCircle size={20} className="text-red-500" />
              <h3 className="font-bold text-[#2A1C00] text-sm uppercase tracking-widest">Urgent Alerts</h3>
            </div>
            <div className="space-y-4">
              {s.followupsOverdue > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-2xl border border-red-100">
                  <span className="text-xs font-bold text-red-700">{s.followupsOverdue} Overdue Tasks</span>
                  <button onClick={() => onNavigate('followups')} className="text-[10px] font-black text-red-700 underline">RESOLVE</button>
                </div>
              )}
              {s.hotLeads > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-2xl border border-orange-100">
                  <span className="text-xs font-bold text-orange-700">{s.hotLeads} Hot Leads Waiting</span>
                  <button onClick={() => onNavigate('leads', undefined, { quality: 'hot' })} className="text-[10px] font-black text-orange-700 underline">ACTION</button>
                </div>
              )}
              {s.followupsOverdue === 0 && s.hotLeads === 0 && (
                <p className="text-xs text-[#9A8262] italic py-4 text-center">System healthy. No urgent alerts.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
