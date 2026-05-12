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
  X,
  Share2,
  AlertCircle
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
  currentUserRole?: string;
}

export default function Reports({ callLogs, visits, leads, activities, users, projects, onNavigate, currentUserRole }: ReportsProps) {
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
    const salesmanName = users.find(u => u.id.toString() === selectedUser)?.name;
    const matchesUser = selectedUser === '' || v.assigned_to === salesmanName;
    const matchesProject = selectedProject === '' || v.projectId === selectedProject;
    const matchesDate = isDateInRange(v.visit_date, dateRange);
    return matchesUser && matchesProject && matchesDate;
  });

  const filteredCallLogsGlobal = callLogs.filter(log => {
    const salesmanName = users.find(u => u.id.toString() === selectedUser)?.name;
    const matchesUser = selectedUser === '' || log.by === salesmanName;
    const matchesProject = selectedProject === '' || log.projectId === selectedProject;
    const matchesDate = isDateInRange(log.timestamp, dateRange);
    return matchesUser && matchesProject && matchesDate;
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
  }).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

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
    { name: 'Total Leads', value: filteredLeadsGlobal.length, color: '#9A8262', icon: Users },
    { name: 'Contacted', value: filteredLeadsGlobal.filter(l => l.status !== 'new').length, color: '#3498DB', icon: Phone },
    { name: 'Visits Done', value: filteredLeadsGlobal.filter(l => l.status === 'visit_done' || l.status === 'closed').length, color: '#9B59B6', icon: Calendar },
    { name: 'Closed', value: filteredLeadsGlobal.filter(l => l.status === 'closed').length, color: '#27AE60', icon: Trophy },
  ];

  // Lead Aging Calculations
  const now = new Date();
  const agingStats = [
    { name: '0-7 Days', value: 0, color: '#22c55e', range: [0, 7] },
    { name: '7-15 Days', value: 0, color: '#eab308', range: [7, 15] },
    { name: '15-30 Days', value: 0, color: '#f97316', range: [15, 30] },
    { name: '30+ Days', value: 0, color: '#ef4444', range: [30, 9999] },
  ];

  filteredLeadsGlobal.forEach(lead => {
    const created = new Date(lead.created_at);
    const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    const stat = agingStats.find(s => diffDays >= s.range[0] && diffDays < s.range[1]);
    if (stat) stat.value++;
  });

  const staleLeads = filteredLeadsGlobal.filter(l => {
    if (l.status === 'closed' || l.status === 'lost') return false;
    const lastUpdate = new Date(l.updated_at || l.created_at);
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate > 7; // No activity for 7+ days
  }).sort((a, b) => {
     const dateA = new Date(a.updated_at || a.created_at).getTime();
     const dateB = new Date(b.updated_at || b.created_at).getTime();
     return dateA - dateB; // Oldest first
  });

  // Source Quality Calculations
  const sourceQualityStats = projects[0]?.sources?.map(source => {
    const sourceLeads = filteredLeadsGlobal.filter(l => l.source === source);
    const sourceVisits = sourceLeads.filter(l => l.status === 'visit_done' || l.status === 'closed').length;
    const sourceClosed = sourceLeads.filter(l => l.status === 'closed').length;
    const visitRate = sourceLeads.length > 0 ? Math.round((sourceVisits / sourceLeads.length) * 100) : 0;
    
    return {
      name: source,
      leads: sourceLeads.length,
      visits: sourceVisits,
      closed: sourceClosed,
      rate: visitRate
    };
  }).filter(s => s.leads > 0).sort((a, b) => b.leads - a.leads) || [];

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

  // Leaderboard Scoring Logic
  const leaderboardData = userPerformance.map((user, idx) => {
    // Simple Score: (Visits * 10) + (Converted * 50)
    const score = (user.visitsDone * 10) + (user.converted * 50);
    return { ...user, score };
  }).sort((a, b) => b.score - a.score);

  const topThree = leaderboardData.slice(0, 3);

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
      title = "Visits Completed";
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
      <div className="flex flex-col gap-6">
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
            <button className="bg-white border border-[#E6D8B8] px-4 py-2 rounded-xl text-sm font-bold text-[#C9A84C] flex items-center gap-2 hover:bg-[#FDFAF2] transition-colors shadow-sm">
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* Top Filters Bar */}
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
             <DateRangeSelector selectedRange={dateRange} onChange={setDateRange} />
          </div>
          
          <div className="h-8 w-px bg-[#E6D8B8]/50 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C9A84C]" />
              <select 
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-white border border-[#E6D8B8] rounded-xl py-2 pl-9 pr-8 text-xs font-bold text-[#5C4820] focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="relative">
              <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C9A84C]" />
              <select 
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-white border border-[#E6D8B8] rounded-xl py-2 pl-9 pr-8 text-xs font-bold text-[#5C4820] focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
              >
                <option value="">All Salesmen</option>
                {users.map(u => <option key={u.id} value={u.id.toString()}>{u.name}</option>)}
              </select>
            </div>

            {(selectedProject || selectedUser) && (
              <button 
                onClick={() => { setSelectedProject(''); setSelectedUser(''); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Clear Filters"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Automated MIS Reports Block - Only for Admin and Manager */}
      {(currentUserRole?.toLowerCase() === 'admin' || currentUserRole?.toLowerCase() === 'adm' || currentUserRole?.toLowerCase() === 'manager') && (
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
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                        },
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
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                        },
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
                  <span className="text-[10px] opacity-60">Saturday 9 AM</span>
                </button>
                <button 
                  onClick={async () => {
                    toast.loading('Generating Detailed Monthly Report...', { id: 'mis-report' });
                    try {
                      const res = await fetch('/api/reports/trigger', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                        },
                        body: JSON.stringify({ type: 'detailed_monthly' })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to trigger report');
                      toast.success('Detailed Monthly Report sent to email', { id: 'mis-report' });
                    } catch (e: any) {
                      toast.error(e.message || 'Failed to trigger report', { id: 'mis-report', duration: 5000 });
                    }
                  }}
                  className="px-6 py-4 bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30 backdrop-blur-md rounded-2xl font-bold flex flex-col items-start gap-1 hover:bg-[#C9A84C]/30 transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-[0px]"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 size={18} />
                    <span>Monthly Detailed</span>
                  </div>
                  <span className="text-[10px] opacity-60">Monday 10 AM</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Team Leaderboard Section */}
      <div className="bg-[#1C1207] rounded-[2rem] p-8 border border-[#C9A84C]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
          <Trophy size={150} className="text-[#C9A84C]" />
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h3 className="font-serif text-3xl font-bold text-white flex items-center gap-3">
                <Trophy className="text-[#C9A84C]" size={32} />
                Elite Performance Leaderboard
              </h3>
              <p className="text-white/60 text-sm mt-1">Celebrating our top sales warriors.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 backdrop-blur-sm">
              <span className="text-[10px] font-black text-[#C9A84C] uppercase tracking-widest block mb-1">Total Team Closures</span>
              <span className="text-2xl font-serif font-black text-white">{filteredLeadsGlobal.filter(l => l.status === 'closed').length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top 3 Podium */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* Rank 2 */}
              {topThree[1] && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center h-[280px] flex flex-col justify-center relative group hover:bg-white/10 transition-all">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-slate-400 rounded-full flex items-center justify-center text-white font-black border-4 border-[#1C1207]">2</div>
                  <div className="w-20 h-20 bg-slate-400/20 rounded-full mx-auto mb-4 flex items-center justify-center text-slate-400 text-3xl font-black">
                    {topThree[1].name.charAt(0)}
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">{topThree[1].name}</h4>
                  <p className="text-[#C9A84C] font-black text-sm mb-4">{topThree[1].score} PTS</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-white/60">
                    <div className="bg-white/5 p-2 rounded-xl">
                      <span className="block font-bold text-white">{topThree[1].visitsDone}</span> Visits
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl">
                      <span className="block font-bold text-white">{topThree[1].converted}</span> Deals
                    </div>
                  </div>
                </div>
              )}

              {/* Rank 1 */}
              {topThree[0] && (
                <div className="bg-gradient-to-b from-[#C9A84C]/20 to-white/5 border-2 border-[#C9A84C]/50 rounded-[2.5rem] p-8 text-center h-[340px] flex flex-col justify-center relative shadow-2xl shadow-[#C9A84C]/20 group hover:scale-[1.02] transition-all">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-[#C9A84C] rounded-full flex items-center justify-center text-[#1C1207] text-xl font-black border-4 border-[#1C1207] shadow-xl">1</div>
                  <div className="w-24 h-24 bg-[#C9A84C]/20 rounded-full mx-auto mb-6 flex items-center justify-center text-[#C9A84C] text-4xl font-black border-2 border-[#C9A84C]/30">
                    {topThree[0].name.charAt(0)}
                  </div>
                  <h4 className="text-white font-serif text-2xl font-bold mb-1">{topThree[0].name}</h4>
                  <p className="text-[#C9A84C] font-black text-lg mb-6">{topThree[0].score} PTS</p>
                  <div className="grid grid-cols-2 gap-3 text-xs text-white/80">
                    <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                      <span className="block font-black text-white text-lg">{topThree[0].visitsDone}</span> Visits Done
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                      <span className="block font-black text-white text-lg">{topThree[0].converted}</span> Deals Closed
                    </div>
                  </div>
                </div>
              )}

              {/* Rank 3 */}
              {topThree[2] && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center h-[240px] flex flex-col justify-center relative group hover:bg-white/10 transition-all">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-orange-700 rounded-full flex items-center justify-center text-white font-black border-4 border-[#1C1207]">3</div>
                  <div className="w-16 h-16 bg-orange-700/20 rounded-full mx-auto mb-4 flex items-center justify-center text-orange-700 text-2xl font-black">
                    {topThree[2].name.charAt(0)}
                  </div>
                  <h4 className="text-white font-bold text-base mb-1">{topThree[2].name}</h4>
                  <p className="text-[#C9A84C] font-black text-xs mb-4">{topThree[2].score} PTS</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-white/60">
                    <div className="bg-white/5 p-2 rounded-xl">
                      <span className="block font-bold text-white">{topThree[2].visitsDone}</span> Visits
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl">
                      <span className="block font-bold text-white">{topThree[2].converted}</span> Deals
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Runner Ups List */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col">
              <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                Rising Stars
                <span className="text-[10px] text-[#C9A84C]">Points System</span>
              </h4>
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                {leaderboardData.slice(3).map((user, idx) => (
                  <div key={user.name} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 font-bold text-xs w-4">{idx + 4}</span>
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xs">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-bold text-xs">{user.name}</p>
                        <p className="text-[9px] text-[#C9A84C] font-black uppercase">{user.score} Points</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-white/60 font-medium">{user.converted} Closures</span>
                    </div>
                  </div>
                ))}
                {leaderboardData.length <= 3 && (
                   <div className="h-full flex items-center justify-center text-center p-10 opacity-30">
                     <p className="text-xs text-white italic">Competition is heating up!</p>
                   </div>
                )}
              </div>
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

        {/* Conversion Funnel Chart */}
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-8 shadow-sm lg:col-span-2 overflow-hidden relative">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] flex items-center gap-2">
                <BarChart3 className="text-[#C9A84C]" size={22} />
                Sales Conversion Funnel
              </h3>
              <p className="text-xs text-[#9A8262] mt-1">Measuring the journey from lead to closure.</p>
            </div>
            <div className="flex gap-4">
               {funnelData.slice(1).map((step, idx) => {
                 const prevValue = funnelData[idx].value;
                 const dropRate = prevValue > 0 ? Math.round(((prevValue - step.value) / prevValue) * 100) : 0;
                 return (
                   <div key={idx} className="text-right">
                     <div className="text-[10px] font-black text-red-500 uppercase tracking-tighter">Drop Rate</div>
                     <div className="text-sm font-bold text-red-600">{dropRate}%</div>
                   </div>
                 );
               })}
            </div>
          </div>

          <div className="relative flex flex-col items-center gap-2 max-w-2xl mx-auto">
            {funnelData.map((step, idx) => {
              const maxWidth = 100 - (idx * 15); // Funnel shape narrowing
              const percentage = funnelData[0].value > 0 ? Math.round((step.value / funnelData[0].value) * 100) : 0;
              
              return (
                <div key={step.name} className="w-full flex flex-col items-center group">
                  <div 
                    className="h-16 relative flex items-center justify-center transition-all duration-500 hover:scale-[1.02] shadow-sm overflow-hidden"
                    style={{ 
                      width: `${maxWidth}%`, 
                      backgroundColor: step.color,
                      borderRadius: '8px',
                      opacity: 0.9 + (idx * 0.03)
                    }}
                  >
                    {/* Glass effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 flex items-center justify-between w-full px-8 text-white">
                      <div className="flex items-center gap-3">
                        <step.icon size={20} className="opacity-80" />
                        <span className="font-bold text-sm uppercase tracking-widest">{step.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-serif font-black">{step.value}</span>
                        {idx > 0 && (
                          <div className="bg-white/20 px-2 py-1 rounded text-[10px] font-black">
                            {percentage}% of Total
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Transition arrow/connector */}
                  {idx < funnelData.length - 1 && (
                    <div className="h-6 w-px bg-gradient-to-b from-[#E6D8B8] to-transparent my-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Background Decorative */}
          <div className="absolute -bottom-10 -right-10 opacity-[0.03] rotate-12 pointer-events-none">
            <BarChart3 size={300} />
          </div>
        </div>

        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
            <Building2 className="text-[#C9A84C]" size={18} />
            Project Lead Volume
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

        {/* Lead Aging Section */}
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] flex items-center gap-2">
              <Clock className="text-[#C9A84C]" size={18} />
              Lead Aging Audit
            </h3>
            <span className="text-[10px] font-bold text-[#9A8262] uppercase bg-[#E6D8B8]/20 px-2 py-0.5 rounded">
              Time in System
            </span>
          </div>
          <div className="w-full min-w-0 h-[250px]">
            {agingStats.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6D8B8" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9A8262' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9A8262' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                    cursor={{ fill: 'rgba(201,168,76,0.05)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {agingStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#9A8262] italic text-sm">
                No aging data available
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {agingStats.map(s => (
               <div key={s.name} className="flex items-center justify-between p-2 bg-white rounded border border-[#E6D8B8]/30">
                 <span className="text-[10px] font-bold text-[#9A8262]">{s.name}</span>
                 <span className="text-xs font-black" style={{ color: s.color }}>{s.value}</span>
               </div>
            ))}
          </div>
        </div>

        {/* Source Quality Analysis */}
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00] flex items-center gap-2">
                <Share2 className="text-[#C9A84C]" size={20} />
                Source Quality & ROI Analysis
              </h3>
              <p className="text-xs text-[#9A8262] mt-1">Comparing lead volume vs. site visit conversion per source.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#9A8262]" />
                <span className="text-[10px] font-bold text-[#9A8262]">LEADS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#C9A84C]" />
                <span className="text-[10px] font-bold text-[#C9A84C]">VISITS</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceQualityStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6D8B8" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9A8262', fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9A8262' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '8px' }}
                    cursor={{ fill: 'rgba(201,168,76,0.05)' }}
                  />
                  <Bar dataKey="leads" fill="#9A8262" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="visits" fill="#C9A84C" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-4">
               <h4 className="text-[10px] font-black text-[#9A8262] uppercase tracking-widest border-b border-[#E6D8B8] pb-2">Top Performing Sources</h4>
               {sourceQualityStats.map(source => (
                 <div key={source.name} className="p-3 bg-white border border-[#E6D8B8]/40 rounded-xl">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-sm text-[#2A1C00]">{source.name}</span>
                     <span className="text-xs font-bold text-[#C9A84C]">{source.rate}% Visit Rate</span>
                   </div>
                   <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                     <div 
                       className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]" 
                       style={{ width: `${source.rate}%` }}
                     />
                   </div>
                   <div className="mt-2 flex justify-between text-[10px] text-[#9A8262]">
                     <span>{source.leads} Leads</span>
                     <span className="font-bold text-[#2A1C00]">{source.visits} Visits</span>
                   </div>
                 </div>
               ))}
               {sourceQualityStats.length === 0 && (
                 <div className="p-10 text-center text-[#9A8262] italic text-xs">No source data available.</div>
               )}
            </div>
          </div>
        </div>

        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] flex items-center gap-2">
              <AlertCircle className="text-red-500" size={18} />
              Stale Leads Alert
            </h3>
            <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
              {staleLeads.length} ACTION REQUIRED
            </span>
          </div>
          <p className="text-[11px] text-[#9A8262] mb-4">Leads with no activity or updates for more than 7 days.</p>
          <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] custom-scrollbar pr-2">
            {staleLeads.map(l => (
              <div 
                key={l.id} 
                onClick={() => onNavigate('lead-detail', l.id)}
                className="p-3 bg-white border border-[#E6D8B8]/50 rounded-xl hover:border-red-200 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-xs text-[#2A1C00] group-hover:text-[#C9A84C]">{l.name}</span>
                  <span className="text-[9px] text-red-500 font-bold">
                    {Math.floor((now.getTime() - new Date(l.updated_at || l.created_at).getTime()) / (1000 * 60 * 60 * 24))} Days Idle
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#9A8262]">
                  <span>Status: {l.status.toUpperCase()}</span>
                  <span className="flex items-center gap-1"><UserIcon size={10} /> {users.find(u => u.id === l.assignedTo)?.name || 'Unassigned'}</span>
                </div>
              </div>
            ))}
            {staleLeads.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-10">
                <CheckCircle2 size={32} className="text-green-500 mb-2 opacity-30" />
                <p className="text-xs text-[#9A8262] italic">Great! All leads have been contacted recently.</p>
              </div>
            )}
          </div>
        </div>

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

