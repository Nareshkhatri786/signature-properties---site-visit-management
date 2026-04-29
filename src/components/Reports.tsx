import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { CallLog, Visit, CallOutcome, Lead, Activity, User, ActivityType, Page, Project, VisitFilters } from '../types';
import { 
  Phone, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Ban, 
  TrendingUp, 
  Users, 
  Calendar, History as HistoryIcon,
  PlusCircle, 
  MessageSquare,
  ChevronRight,
  User as UserIcon,
  Calendar as CalendarIcon,
  Download,
  Eye,
  LayoutDashboard,
  Building2,
  Trophy,
  BarChart3,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import DateRangeSelector, { DateRange, isDateInRange } from './DateRangeSelector';
import { 
  startOfToday, 
  endOfToday, 
  isToday, 
  isYesterday, 
  isThisWeek, 
  isThisMonth,
  startOfMonth
} from 'date-fns';

interface ReportsProps {
  callLogs: CallLog[];
  visits: Visit[];
  leads: Lead[];
  activities: Activity[];
  users: User[];
  projects: Project[];
  onNavigate: (page: Page, id?: string, filters?: VisitFilters) => void;
}

export default function Reports({ callLogs, visits, leads, activities, users, projects, onNavigate }: ReportsProps) {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | ''>('');
  const [dateRange, setDateRange] = useState<DateRange>({
    type: 'thisMonth',
    start: startOfMonth(new Date()),
    end: endOfToday()
  });
  const [drillDownType, setDrillDownType] = useState<'leads' | 'calls' | 'visits' | 'whatsapp' | null>(null);

  const outcomes: Record<CallOutcome, { label: string; color: string }> = {
    answered: { label: 'Answered', color: '#22c55e' },
    not_answered: { label: 'Not Answered', color: '#ef4444' },
    busy: { label: 'Busy', color: '#f97316' },
    switched_off: { label: 'Switched Off', color: '#64748b' },
  };

  const selectedUserName = users.find(u => u.id.toString() === selectedUser)?.name || '';

  // Pre-filter data based on Sidebar Filters and Date Range
  const filteredLeadsGlobal = leads.filter(l => {
    const matchesUser = selectedUser === '' || l.assignedTo?.toString() === selectedUser;
    const matchesProject = selectedProject === '' || l.projectId === selectedProject;
    const matchesDate = isDateInRange(l.created_at, dateRange);
    return matchesUser && matchesProject && matchesDate;
  });

  const filteredVisitsGlobal = visits.filter(v => {
    const matchesUser = selectedUser === '' || v.assigned_to === selectedUserName;
    const matchesProject = selectedProject === '' || v.projectId === selectedProject;
    const matchesDate = isDateInRange(v.visit_date, dateRange);
    return matchesUser && matchesProject && matchesDate;
  });

  const filteredCallLogsGlobal = callLogs.filter(log => {
    const matchesUser = selectedUser === '' || log.by === selectedUserName;
    const matchesProject = selectedProject === '' || log.projectId === selectedProject;
    return matchesUser && matchesProject;
  });

  // Calculations for enhanced charts
  const userPerformance = users.map(user => {
    const userLeads = filteredLeadsGlobal.filter(l => l.assignedTo === user.id);
    const convertedLeads = userLeads.filter(l => l.status === 'closed' || l.status === 'visit_done').length;
    const conversionRate = userLeads.length > 0 ? (convertedLeads / userLeads.length) * 100 : 0;
    
    const userVisits = filteredVisitsGlobal.filter(v => v.assigned_to === user.name);
    const visitsScheduled = userVisits.filter(v => v.visit_status === 'scheduled').length;
    const visitsCompleted = userVisits.filter(v => v.visit_status === 'completed').length;

    return {
      name: user.name,
      leads: userLeads.length,
      converted: convertedLeads,
      rate: Math.round(conversionRate * 10) / 10,
      visitsScheduled: visitsScheduled + visitsCompleted,
      visitsDone: visitsCompleted
    };
  }).filter(u => u.leads > 0).sort((a, b) => b.rate - a.rate);

  const projectPerformance = projects.map(project => {
    const projectLeads = filteredLeadsGlobal.filter(l => l.projectId === project.id);
    const hotLeads = projectLeads.filter(l => l.quality === 'hot').length;
    const closedLeads = projectLeads.filter(l => l.status === 'closed').length;
    
    return {
      name: project.name,
      leads: projectLeads.length,
      hot: hotLeads,
      closed: closedLeads,
    };
  }).filter(p => !selectedProject || (projects.find(proj => proj.id === selectedProject)?.name === p.name)).sort((a, b) => b.leads - a.leads);

  const qualityStats = [
    { name: '🔥 Hot', value: filteredLeadsGlobal.filter(l => l.quality === 'hot').length, color: '#ef4444' },
    { name: '🌡️ Warm', value: filteredLeadsGlobal.filter(l => l.quality === 'warm').length, color: '#f97316' },
    { name: '❄️ Cold', value: filteredLeadsGlobal.filter(l => l.quality === 'cold').length, color: '#3498DB' },
    { name: '🚫 Disq', value: filteredLeadsGlobal.filter(l => l.quality === 'disq').length, color: '#64748b' },
  ].filter(q => q.value > 0);

  const visitStatusStats = [
    { name: '📅 Scheduled', value: filteredVisitsGlobal.filter(v => v.visit_status === 'scheduled').length, color: '#3182CE' },
    { name: '✅ Completed', value: filteredVisitsGlobal.filter(v => v.visit_status === 'completed').length, color: '#22c55e' },
    { name: '🔄 Rescheduled', value: filteredVisitsGlobal.filter(v => v.visit_status === 'rescheduled').length, color: '#f59e0b' },
    { name: '❌ Cancelled', value: filteredVisitsGlobal.filter(v => v.visit_status === 'cancelled').length, color: '#ef4444' },
  ].filter(s => s.value > 0);

  const filteredActivities = activities.filter(a => {
    const matchesUser = selectedUser === '' || a.userId.toString() === selectedUser;
    const matchesProject = selectedProject === '' || a.projectId === selectedProject;
    const matchesType = selectedActivityType === '' || a.type === selectedActivityType;
    const matchesDate = isDateInRange(a.timestamp, dateRange);
    return matchesUser && matchesProject && matchesType && matchesDate;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const filteredCallLogs = filteredCallLogsGlobal.filter(log => isDateInRange(log.timestamp, dateRange));

  const stats = {
    calls: filteredActivities.filter(a => a.type === 'call_attempted' || a.type === 'call_answered').length,
    answered: filteredActivities.filter(a => a.type === 'call_answered').length,
    whatsapp: filteredActivities.filter(a => a.type === 'whatsapp_sent').length,
    leads: filteredActivities.filter(a => a.type === 'lead_created').length,
    visits: filteredActivities.filter(a => a.type === 'visit_scheduled').length,
    visitsDone: filteredActivities.filter(a => a.type === 'visit_done').length,
  };

  const callStats = Object.keys(outcomes).map(key => ({
    name: outcomes[key as CallOutcome].label,
    value: filteredCallLogs.filter(log => log.outcome === key).length,
    color: outcomes[key as CallOutcome].color
  })).filter(s => s.value > 0);

  const totalCalls = callLogs.length;
  const answeredCalls = callLogs.filter(l => l.outcome === 'answered').length;
  const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const dailyData = last7Days.map(date => ({
    date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    calls: callLogs.filter(log => log.timestamp.startsWith(date)).length,
    answered: callLogs.filter(log => log.timestamp.startsWith(date) && log.outcome === 'answered').length,
  }));

  const funnelData = [
    { name: 'Total Leads', value: leads.length, color: '#9A8262' },
    { name: 'Contacted', value: leads.filter(l => l.status !== 'new').length, color: '#3498DB' },
    { name: 'Visits Done', value: leads.filter(l => l.status === 'visit_done' || l.status === 'closed').length, color: '#9B59B6' },
    { name: 'Closed', value: leads.filter(l => l.status === 'closed').length, color: '#27AE60' },
  ];

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'lead_created': return <PlusCircle className="text-blue-500" size={16} />;
      case 'lead_updated': return <PlusCircle className="text-blue-400" size={16} />;
      case 'lead_status_changed': return <TrendingUp className="text-orange-400" size={16} />;
      case 'lead_quality_changed': return <TrendingUp className="text-red-400" size={16} />;
      case 'lead_transferred': return <ChevronRight className="text-orange-500" size={16} />;
      case 'call_attempted': return <Phone className="text-orange-500" size={16} />;
      case 'call_answered': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'visit_scheduled': return <Calendar className="text-purple-500" size={16} />;
      case 'whatsapp_sent': return <MessageSquare className="text-green-600" size={16} />;
      case 'visit_done': return <CheckCircle2 className="text-green-600" size={16} />;
      case 'visit_cancelled': return <XCircle className="text-red-500" size={16} />;
      case 'visit_no_show': return <Eye className="text-orange-500" size={16} />;
      case 'remark_added': return <MessageSquare className="text-gold-500" size={16} />;
      case 'followup_scheduled': return <Clock className="text-blue-500" size={16} />;
      case 'followup_completed': return <CheckCircle2 className="text-emerald-500" size={16} />;
      default: return <HistoryIcon size={16} />;
    }
  };

  const getActivityLabel = (type: ActivityType) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderDrillDown = () => {
    if (!drillDownType) return null;

    let items: any[] = [];
    let title = "";

    if (drillDownType === 'leads') {
      items = filteredActivities.filter(a => a.type === 'lead_created');
      title = "New Leads Created";
    } else if (drillDownType === 'calls') {
      items = filteredActivities.filter(a => a.type === 'call_attempted' || a.type === 'call_answered');
      title = "Calls Made";
    } else if (drillDownType === 'visits') {
      items = filteredActivities.filter(a => a.type === 'visit_scheduled' || a.type === 'visit_done');
      title = "Visits Activity";
    } else if (drillDownType === 'answered') {
      items = filteredActivities.filter(a => a.type === 'call_answered');
      title = "Calls Answered";
    } else if (drillDownType === 'visitsDone') {
      items = filteredActivities.filter(a => a.type === 'visit_done');
      title = "Visits Completed";
    } else if (drillDownType === 'whatsapp') {
      items = filteredActivities.filter(a => a.type === 'whatsapp_sent');
      title = "WhatsApp Messages Sent";
    }

    return (
      <div className="mt-8 bg-white border border-[#C9A84C]/30 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="px-6 py-4 bg-[#FDFAF2] border-b border-[#E6D8B8] flex items-center justify-between">
          <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00] flex items-center gap-2">
            <Eye className="text-[#C9A84C]" size={20} />
            {title} ({items.length})
          </h3>
          <button 
            onClick={() => setDrillDownType(null)}
            className="text-[#9A8262] hover:text-[#2A1C00] text-sm font-bold"
          >
            Close
          </button>
        </div>
        <div className="divide-y divide-[#E6D8B8]/30 max-h-[400px] overflow-y-auto custom-scrollbar">
          {items.map(item => (
            <div key={item.id} className="p-4 hover:bg-[#FDFAF2]/50 transition-colors flex items-center justify-between">
              <div>
                <p className="font-bold text-[#2A1C00]">{item.targetName}</p>
                <p className="text-xs text-[#9A8262]">{item.userName} • {new Date(item.timestamp).toLocaleString()}</p>
                {item.details && <p className="text-[11px] text-[#5C4820] italic mt-1">{item.details}</p>}
              </div>
              <button 
                onClick={() => {
                  const isVisit = item.type.includes('visit');
                  onNavigate(isVisit ? 'detail' : 'lead-detail', item.targetId);
                }}
                className="p-2 text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="p-10 text-center text-[#9A8262] italic">No records found for this category.</div>
          )}
        </div>
      </div>
    );
  };

  const totalVisitsOverall = visits.length;
  const completedVisitsOverall = visits.filter(v => v.visit_status === 'completed');
  const visitsToday = completedVisitsOverall.filter(v => isToday(new Date(v.visit_date))).length;
  const visitsYesterday = completedVisitsOverall.filter(v => isYesterday(new Date(v.visit_date))).length;
  const visitsWeek = completedVisitsOverall.filter(v => isThisWeek(new Date(v.visit_date))).length;
  const visitsMonth = completedVisitsOverall.filter(v => isThisMonth(new Date(v.visit_date))).length;

  const overallLeads = leads.length;
  const activeLeads = leads.filter(l => l.quality !== 'disq').length;
  const lostLeads = leads.filter(l => l.quality === 'disq').length;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-bold text-[#2A1C00] flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/10 rounded-xl">
              <TrendingUp className="text-[#C9A84C]" size={24} />
            </div>
            Strategic Analytics
          </h2>
          <p className="text-[#9A8262] text-sm mt-1 ml-14">Data-driven insights & performance audits.</p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangeSelector selectedRange={dateRange} onChange={setDateRange} />
          <button className="bg-white border border-[#E6D8B8] px-4 py-2 rounded-xl text-sm font-bold text-[#C9A84C] flex items-center gap-2 hover:bg-[#FDFAF2] transition-colors shadow-sm">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Automated MIS Reports Block */}
      <div className="bg-gradient-to-br from-[#1C1207] to-[#2A1C00] rounded-[2rem] p-8 border border-[#C9A84C]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A84C]/10 rounded-full -mr-48 -mt-48 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded-full text-[#C9A84C] text-[10px] font-black uppercase tracking-widest">
                <Sparkles size={12} />
                Automation Active
              </div>
              <h3 className="font-serif text-3xl font-bold text-white leading-tight">Automated MIS Reports</h3>
              <p className="text-white/60 text-sm max-w-xl font-medium">Daily operations audit at 8 PM and Weekend performance planning every Saturday 9 AM delivered to your inbox.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={async () => {
                  toast.loading('Generating Daily MIS Report...', { id: 'mis-report' });
                  try {
                    const res = await fetch('/api/reports/trigger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'daily' })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to trigger report');
                    toast.success('Daily MIS Report sent to email', { id: 'mis-report' });
                  } catch (e: any) {
                    toast.error(e.message || 'Failed to trigger report', { id: 'mis-report', duration: 5000 });
                  }
                }}
                className="px-6 py-4 bg-[#C9A84C] text-[#1C1207] rounded-2xl font-bold flex flex-col items-start gap-1 hover:bg-[#D4BC7D] transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-[0px]"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} />
                  <span>Daily MIS</span>
                </div>
                <span className="text-[10px] opacity-60">Run Now (8 PM Cycle)</span>
              </button>
              <button 
                onClick={async () => {
                  toast.loading('Generating Weekend planning...', { id: 'mis-report' });
                  try {
                    const res = await fetch('/api/reports/trigger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'weekend' })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to trigger report');
                    toast.success('Weekend MIS Report sent to email', { id: 'mis-report' });
                  } catch (e: any) {
                    toast.error(e.message || 'Failed to trigger report', { id: 'mis-report', duration: 5000 });
                  }
                }}
                className="px-6 py-4 bg-white/10 text-white border border-white/20 backdrop-blur-md rounded-2xl font-bold flex flex-col items-start gap-1 hover:bg-white/20 transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-[0px]"
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon size={18} />
                  <span>Weekend MIS</span>
                </div>
                <span className="text-[10px] opacity-60">Run Now (Saturday 9 AM)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Metrics (Filtered by Range) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { id: 'leads', label: 'New Leads', value: stats.leads, icon: PlusCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'calls', label: 'Calls Made', value: stats.calls, icon: Phone, color: 'text-orange-600', bg: 'bg-orange-50' },
          { id: 'answered', label: 'Calls Answered', value: stats.answered, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { id: 'whatsapp', label: 'WhatsApp Sent', value: stats.whatsapp, icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { id: 'visits', label: 'Visits Planned', value: stats.visits, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
          { id: 'visitsDone', label: 'Visits Done', value: stats.visitsDone, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-100' },
        ].map((stat) => (
          <button 
            key={stat.id} 
            onClick={() => setDrillDownType(stat.id as any)}
            className={cn(
              "p-5 rounded-2xl border shadow-sm text-left transition-all hover:scale-[1.02] active:scale-95 group",
              stat.bg,
              drillDownType === stat.id ? "border-[#C9A84C] ring-4 ring-[#C9A84C]/10" : "border-[#E6D8B8]/60"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={13} strokeWidth={3} className={stat.color} />
              <span className="text-[9px] font-black text-[#9A8262] uppercase tracking-[0.1em]">{stat.label}</span>
            </div>
            <p className="text-2xl font-serif font-bold text-[#2A1C00] group-hover:text-[#C9A84C] transition-colors">{stat.value}</p>
          </button>
        ))}
      </div>

      {renderDrillDown()}

      {/* User Performance Highlights Section */}
      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-[#FDFAF2] border-b border-[#E6D8B8] flex items-center justify-between">
          <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00] flex items-center gap-2">
            <Trophy className="text-[#C9A84C]" size={20} />
            User Performance Highlights
          </h3>
          <div className="text-[10px] font-black text-[#9A8262] uppercase tracking-widest">
            Ranked by Conversion Rate
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FDFAF2]/50 border-b border-[#E6D8B8]">
                <th className="px-6 py-4 text-[11px] font-black text-[#9A8262] uppercase tracking-widest">Rank</th>
                <th className="px-6 py-4 text-[11px] font-black text-[#9A8262] uppercase tracking-widest">Salesman</th>
                <th className="px-6 py-4 text-[11px] font-black text-[#9A8262] uppercase tracking-widest">Leads Managed</th>
                <th className="px-6 py-4 text-[11px] font-black text-[#9A8262] uppercase tracking-widest text-center">Visits Scheduled</th>
                <th className="px-6 py-4 text-[11px] font-black text-[#9A8262] uppercase tracking-widest text-center">Visits Done</th>
                <th className="px-6 py-4 text-[11px] font-black text-[#9A8262] uppercase tracking-widest text-right">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D8B8]/30 text-sm">
              {userPerformance.map((user, idx) => (
                <tr key={user.name} className="hover:bg-[#FDFAF2]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                      idx === 0 ? "bg-yellow-100 text-yellow-700" :
                      idx === 1 ? "bg-gray-100 text-gray-600" :
                      idx === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-[#FDFAF2] text-[#9A8262]"
                    )}>
                      {idx + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] font-bold text-xs">
                        {user.name.charAt(0)}
                      </div>
                      <span className="font-bold text-[#2A1C00]">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#2A1C00] font-medium">{user.leads}</td>
                  <td className="px-6 py-4 text-[#2A1C00] font-medium text-center">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">{user.visitsScheduled}</span>
                  </td>
                  <td className="px-6 py-4 text-[#2A1C00] font-medium text-center">
                    <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs font-bold">{user.visitsDone}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-[#C9A84C]">{user.rate}%</span>
                      <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-[#C9A84C]" 
                          style={{ width: `${Math.min(user.rate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {userPerformance.length === 0 && (
            <div className="p-10 text-center text-[#9A8262] italic text-sm">
              No salesman performance data available for current selection.
            </div>
          )}
        </div>
      </div>

      {/* Filters for Audit Trail */}
      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Project</label>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" />
            <select 
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Salesman</label>
          <div className="relative">
            <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" />
            <select 
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
            >
              <option value="">All Salesmen</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Activity Type</label>
          <select 
            value={selectedActivityType}
            onChange={(e) => setSelectedActivityType(e.target.value as ActivityType | '')}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          >
            <option value="">All Activities</option>
            <option value="lead_created">Lead Created</option>
            <option value="lead_updated">Lead Updated</option>
            <option value="call_attempted">Call Attempted</option>
            <option value="call_answered">Call Answered</option>
            <option value="whatsapp_sent">WhatsApp Sent</option>
            <option value="visit_scheduled">Visit Scheduled</option>
            <option value="visit_done">Visit Done</option>
          </select>
        </div>

        <div className="flex gap-2 items-end">
          <button 
            onClick={() => { setSelectedUser(''); setSelectedProject(''); setSelectedActivityType(''); }}
            className="flex-1 h-[38px] flex items-center justify-center gap-2 text-[#9A8262] text-sm font-semibold hover:text-[#2A1C00] transition-colors bg-white border border-[#E6D8B8] rounded-lg"
          >
            <X size={14} /> Clear Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
            <Trophy className="text-[#C9A84C]" size={18} />
            Salesman Conversion Rate (%)
          </h3>
          <div className="w-full min-w-0 h-[300px]">
            {userPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart data={userPerformance} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E6D8B8" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#2A1C00', fontWeight: 'bold' }} width={100} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(201,168,76,0.05)' }}
                    contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                    formatter={(value: any) => [`${value}%`, 'Conversion Rate']}
                  />
                  <Bar dataKey="rate" fill="#C9A84C" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#9A8262] italic text-sm">
                No performance data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
            <Building2 className="text-[#C9A84C]" size={18} />
            Project Performance (Leads vs Closed)
          </h3>
          <div className="w-full min-w-0 h-[300px]">
            {projectPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart data={projectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6D8B8" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9A8262' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9A8262' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(201,168,76,0.05)' }}
                    contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Bar dataKey="leads" name="Total Leads" fill="#9A8262" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hot" name="Hot Leads" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="closed" name="Closed Deals" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#9A8262] italic text-sm">
                No project data available
              </div>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
            <Users className="text-[#C9A84C]" size={18} />
            Call Outcome Distribution
          </h3>
          <div className="w-full min-w-0 h-[300px]">
            {callStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <PieChart>
                  <Pie
                    data={callStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {callStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#9A8262] italic text-sm">
                No call data available yet
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
            <Sparkles className="text-[#C9A84C]" size={18} />
            Lead Quality (AI Scored)
          </h3>
          <div className="w-full min-w-0 h-[300px]">
            {qualityStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <PieChart>
                  <Pie
                    data={qualityStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {qualityStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#9A8262] italic text-sm">
                No quality data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
            <Clock className="text-[#C9A84C]" size={18} />
            Visit Status Distribution
          </h3>
          <div className="w-full min-w-0 h-[300px]">
            {visitStatusStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <PieChart>
                  <Pie
                    data={visitStatusStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {visitStatusStats.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke={entry.name.includes('Done') || entry.name.includes('Cancelled') ? entry.color : 'none'}
                        strokeWidth={entry.name.includes('Done') || entry.name.includes('Cancelled') ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#9A8262] italic text-sm">
                No visit data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
            <Calendar className="text-[#C9A84C]" size={18} />
            Daily Call Activity (Last 7 Days)
          </h3>
          <div className="w-full min-w-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6D8B8" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9A8262' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9A8262' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(201,168,76,0.05)' }}
                  contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                />
                <Bar dataKey="calls" name="Attempts" fill="#3498DB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="answered" name="Answered" fill="#27AE60" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audit Trail List */}
        <div className="bg-white border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] flex items-center gap-2">
              <HistoryIcon className="text-[#C9A84C]" size={18} />
              Detailed Audit Log
            </h3>
          </div>
          <div className="divide-y divide-[#E6D8B8]/50 max-h-[500px] overflow-y-auto custom-scrollbar">
            {filteredActivities.length > 0 ? filteredActivities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-[#FDFAF2] transition-colors flex items-start gap-4">
                <div className="mt-1 w-8 h-8 rounded-full bg-white border border-[#E6D8B8] flex items-center justify-center shadow-sm shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#2A1C00]">
                      {activity.userName} <span className="font-normal text-[#9A8262]">performed</span> {getActivityLabel(activity.type)}
                    </p>
                    <span className="text-[10px] font-bold text-[#9A8262] whitespace-nowrap">
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-[#9A8262]">Target:</span>
                    <span className="font-semibold text-[#C9A84C] flex items-center gap-1">
                      {activity.targetName}
                      <ChevronRight size={12} />
                    </span>
                    {activity.details && (
                      <>
                        <span className="text-[#9A8262] ml-2">Details:</span>
                        <span className="text-[#5C4820] italic">{activity.details}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-20 text-center text-[#9A8262] italic">
                No activities found for the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportSummaryCard({ label, value, icon: Icon, color, onClick }: any) {
  const colors: any = {
    gold: 'bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/20',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-500/10',
    blue: 'bg-indigo-50 text-indigo-600 border-indigo-500/10',
    orange: 'bg-amber-50 text-amber-600 border-amber-500/10',
    gray: 'bg-slate-50 text-slate-600 border-slate-500/10',
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border border-[#E6D8B8] rounded-2xl p-5 shadow-sm group hover:border-[#C9A84C]/40 transition-all hover:scale-[1.02]",
        onClick && "cursor-pointer"
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", colors[color])}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <div className="text-2xl font-serif font-bold text-[#2A1C00] group-hover:text-[#C9A84C] transition-colors">{value}</div>
      <div className="text-[10px] text-[#9A8262] font-black uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

function ReportTimelineStat({ label, value, onClick }: { label: string, value: number, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group bg-white/40 border border-[#E6D8B8]/30 rounded-2xl p-6 hover:bg-white hover:shadow-2xl transition-all",
        onClick && "cursor-pointer"
      )}
    >
      <div className="text-4xl font-serif font-bold text-[#2A1C00] mb-2 group-hover:text-[#C9A84C] transition-all tabular-nums">{value}</div>
      <div className="h-1 w-10 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] mb-4 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
      <div className="text-[10px] text-[#9A8262] font-black uppercase tracking-[0.15em] leading-tight">{label}</div>
    </div>
  );
}

