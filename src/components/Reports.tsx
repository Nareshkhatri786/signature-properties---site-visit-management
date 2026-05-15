import React, { useState } from 'react';
import AIReportLab from './AIReportLab';
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
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Users,
  Clock,
  Building2,
  User as UserIcon,
  X,
  MessageSquare,
  Phone,
  CheckCircle2,
  TrendingDown,
  AlertCircle,
  Share2,
  Trophy,
  History as HistoryIcon,
  ChevronRight,
  PlusCircle,
  Sparkles
} from 'lucide-react';
import { 
  format, 
  subDays, 
  isToday, 
  isYesterday, 
  isThisWeek, 
  isThisMonth, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  differenceInDays
} from 'date-fns';
import { cn } from '../lib/utils';
import DateRangeSelector, { DateRange } from './DateRangeSelector';
import { motion, AnimatePresence } from 'motion/react';

interface ReportsProps {
  leads: any[];
  visits: any[];
  users: any[];
  projects: any[];
  onNavigate: (page: string, id?: string) => void;
  currentUserRole?: string;
}

export default function Reports({ leads, visits, users, projects, onNavigate, currentUserRole }: ReportsProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    type: 'thisMonth',
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [drillDownType, setDrillDownType] = useState<'leads' | 'calls' | 'visits' | 'whatsapp' | null>(null);
  const [misLastSent, setMisLastSent] = useState<Record<string, Date | null>>({ daily: null, weekend: null, detailed_monthly: null });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai-lab'>('dashboard');

  const getMisLastSentLabel = (type: string) => {
    const d = misLastSent[type];
    if (!d) return null;
    return format(d, 'hh:mm a');
  };

  const now = new Date();
  
  // Filter leads by date range, project, and user
  const filteredLeadsGlobal = leads.filter(l => {
    const leadDate = new Date(l.created_at);
    const inRange = leadDate >= dateRange.start && leadDate <= dateRange.end;
    const matchesProject = !selectedProject || l.projectId === selectedProject;
    const matchesUser = !selectedUser || l.assignedTo?.toString() === selectedUser;
    return inRange && matchesProject && matchesUser;
  });

  const filteredVisitsGlobal = visits.filter(v => {
    const visitDate = new Date(v.visit_date);
    const inRange = visitDate >= dateRange.start && visitDate <= dateRange.end;
    const matchesProject = !selectedProject || v.projectId === selectedProject;
    const matchesUser = !selectedUser || v.assignedTo?.toString() === selectedUser;
    return inRange && matchesProject && matchesUser;
  });

  // Calculate Metrics
  const stats = {
    leads: filteredLeadsGlobal.length,
    calls: filteredLeadsGlobal.reduce((acc, l) => acc + (l.callCount || 0), 0),
    answered: filteredLeadsGlobal.reduce((acc, l) => acc + (l.answeredCount || 0), 0),
    whatsapp: filteredLeadsGlobal.reduce((acc, l) => acc + (l.whatsappCount || 0), 0),
    visits: filteredVisitsGlobal.length,
    visitsDone: filteredVisitsGlobal.filter(v => v.visit_status === 'completed').length,
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, h:mm a');
    } catch (e) {
      return 'N/A';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lead_created': return <PlusCircle className="text-blue-500" size={14} />;
      case 'status_update': return <TrendingUp className="text-purple-500" size={14} />;
      case 'call_logged': return <Phone className="text-orange-500" size={14} />;
      case 'visit_scheduled': return <Calendar className="text-indigo-500" size={14} />;
      case 'visit_status_update': return <CheckCircle2 className="text-green-500" size={14} />;
      case 'whatsapp_sent': return <MessageSquare className="text-emerald-500" size={14} />;
      default: return <HistoryIcon className="text-gray-400" size={14} />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'lead_created': return 'New Lead Created';
      case 'status_update': return 'Status Changed';
      case 'call_logged': return 'Call Recorded';
      case 'visit_scheduled': return 'Site Visit Scheduled';
      case 'visit_status_update': return 'Visit Status Updated';
      case 'whatsapp_sent': return 'WhatsApp Sent';
      default: return 'System Activity';
    }
  };

  // 1. Source ROI Chart
  const sourceQualityStats = Object.entries(
    filteredLeadsGlobal.reduce((acc: any, l) => {
      const source = l.source || 'Unknown';
      if (!acc[source]) acc[source] = { leads: 0, visits: 0 };
      acc[source].leads++;
      const hasVisit = filteredVisitsGlobal.some(v => v.leadId === l.id);
      if (hasVisit) acc[source].visits++;
      return acc;
    }, {})
  ).map(([name, data]: any) => ({
    name,
    leads: data.leads,
    visits: data.visits,
    rate: data.leads > 0 ? Math.round((data.visits / data.leads) * 100) : 0
  })).sort((a, b) => b.leads - a.leads).slice(0, 8);

  // 2. Project Distribution
  const projectStats = Object.entries(
    filteredLeadsGlobal.reduce((acc: any, l) => {
      const proj = projects.find(p => p.id === l.projectId)?.name || 'Other';
      acc[proj] = (acc[proj] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // 3. User Performance
  const userPerformance = users.map(u => {
    const userLeads = filteredLeadsGlobal.filter(l => l.assignedTo?.toString() === u.id.toString());
    const userVisits = filteredVisitsGlobal.filter(v => v.assignedTo?.toString() === u.id.toString());
    return {
      name: u.name,
      leads: userLeads.length,
      visitsScheduled: userVisits.length,
      visitsDone: userVisits.filter(v => v.visit_status === 'completed').length,
      rate: userLeads.length > 0 ? Math.round((userVisits.filter(v => v.visit_status === 'completed').length / userLeads.length) * 100) : 0
    };
  }).sort((a, b) => b.rate - a.rate);

  // 4. Activity Audit Log (Last 20)
  const allActivities = leads.flatMap(l => (l.activities || []).map((a: any) => ({
    ...a,
    leadId: l.id,
    targetName: l.name,
    userName: users.find(u => u.id === a.userId)?.name || 'System'
  })));

  const filteredActivities = allActivities
    .filter(a => {
      const aDate = new Date(a.timestamp);
      return aDate >= dateRange.start && aDate <= dateRange.end;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  // 5. Leaderboard Ranking Logic
  const leaderboardData = users.map(u => {
    const userLeads = leads.filter(l => l.assignedTo?.toString() === u.id.toString());
    const userVisits = visits.filter(v => v.assignedTo?.toString() === u.id.toString() && v.visit_status === 'completed');
    const closedLeads = userLeads.filter(l => l.status === 'closed');
    
    // Weighted Score: Closure = 50pts, Visit = 10pts, Active Lead = 2pts
    const score = (closedLeads.length * 50) + (userVisits.length * 10) + (userLeads.filter(l => l.quality === 'hot').length * 5);
    
    return {
      name: u.name,
      score,
      converted: closedLeads.length,
      visits: userVisits.length,
      hotLeads: userLeads.filter(l => l.quality === 'hot').length
    };
  }).sort((a, b) => b.score - a.score);

  const topThree = leaderboardData.slice(0, 3);

  // 6. Lead Aging Stats
  const agingStats = [
    { name: '0-3 Days', value: leads.filter(l => l.quality !== 'disq' && differenceInDays(now, new Date(l.updated_at || l.created_at)) <= 3).length, color: '#27AE60' },
    { name: '4-7 Days', value: leads.filter(l => l.quality !== 'disq' && differenceInDays(now, new Date(l.updated_at || l.created_at)) > 3 && differenceInDays(now, new Date(l.updated_at || l.created_at)) <= 7).length, color: '#F1C40F' },
    { name: '8-15 Days', value: leads.filter(l => l.quality !== 'disq' && differenceInDays(now, new Date(l.updated_at || l.created_at)) > 7 && differenceInDays(now, new Date(l.updated_at || l.created_at)) <= 15).length, color: '#E67E22' },
    { name: '30+ Days', value: leads.filter(l => l.quality !== 'disq' && differenceInDays(now, new Date(l.updated_at || l.created_at)) > 30).length, color: '#E74C3C' }
  ];

  // 7. Visit Status Distribution
  const visitStatusStats = [
    { name: 'Visit Done', value: visits.filter(v => v.visit_status === 'completed').length, color: '#27AE60' },
    { name: 'Pending', value: visits.filter(v => v.visit_status === 'scheduled').length, color: '#3498DB' },
    { name: 'Cancelled', value: visits.filter(v => v.visit_status === 'cancelled').length, color: '#E74C3C' },
    { name: 'No Show', value: visits.filter(v => v.visit_status === 'no_show').length, color: '#95A5A6' }
  ];

  // 8. Call Outcome Distribution
  const callStats = [
    { name: 'Interested', value: leads.reduce((acc, l) => acc + (l.answeredCount || 0), 0), color: '#27AE60' },
    { name: 'Busy/No Answer', value: leads.reduce((acc, l) => acc + ((l.callCount || 0) - (l.answeredCount || 0)), 0), color: '#F1C40F' }
  ];

  // 9. Daily Trends (Last 7 Days)
  const dailyData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(now, i);
    const dayLeads = leads.filter(l => isToday(new Date(l.created_at)) || format(new Date(l.created_at), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'));
    return {
      date: format(d, 'MMM d'),
      calls: leads.reduce((acc, l) => acc + (l.activities?.filter((a: any) => a.type === 'call_logged' && format(new Date(a.timestamp), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')).length || 0), 0),
      answered: leads.reduce((acc, l) => acc + (l.activities?.filter((a: any) => a.type === 'call_logged' && a.details?.includes('Interested') && format(new Date(a.timestamp), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')).length || 0), 0)
    };
  }).reverse();

  const renderDrillDown = () => {
    if (!drillDownType) return null;
    return (
      <div className="bg-white border border-[#E6D8B8] rounded-2xl p-6 shadow-sm mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#2A1C00] capitalize">Detailed View: {drillDownType}</h3>
          <button onClick={() => setDrillDownType(null)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="text-sm text-[#9A8262] italic">
          Showing data analysis for {drillDownType} within the selected date range.
        </div>
      </div>
    );
  };

  const staleLeads = leads
    .filter(l => l.quality !== 'disq' && l.status !== 'closed')
    .sort((a, b) => new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime())
    .slice(0, 10);

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

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-4 border-b border-[#E6D8B8]/30 pb-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "pb-3 px-2 text-sm font-bold tracking-tight transition-all relative",
              activeTab === 'dashboard' ? "text-[#C9A84C]" : "text-[#9A8262] hover:text-[#2A1C00]"
            )}
          >
            Traditional Dashboard
            {activeTab === 'dashboard' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C]" />}
          </button>
          {(currentUserRole?.toLowerCase() === 'admin' || currentUserRole?.toLowerCase() === 'adm') && (
            <button 
              onClick={() => setActiveTab('ai-lab')}
              className={cn(
                "pb-3 px-2 text-sm font-bold tracking-tight transition-all relative flex items-center gap-2",
                activeTab === 'ai-lab' ? "text-[#C9A84C]" : "text-[#9A8262] hover:text-[#2A1C00]"
              )}
            >
              <Sparkles size={14} className={activeTab === 'ai-lab' ? "animate-pulse" : ""} />
              AI Report Lab
              {activeTab === 'ai-lab' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C]" />}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'ai-lab' ? (
        <AIReportLab leads={leads} visits={visits} users={users} />
      ) : (
        <div className="space-y-8">
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
                    {/* Daily MIS */}
                    <div className="flex flex-col gap-1.5">
                      <button 
                        onClick={async () => {
                          toast.loading('Generating Daily MIS Report...', { id: 'mis-daily' });
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
                            setMisLastSent(prev => ({ ...prev, daily: new Date() }));
                            toast.success('Daily MIS sent to email', { id: 'mis-daily' });
                          } catch (e: any) {
                            toast.error(e.message || 'Failed to trigger report', { id: 'mis-daily', duration: 5000 });
                          }
                        }}
                        className="px-6 py-4 bg-[#C9A84C] text-[#1C1207] rounded-2xl font-bold flex flex-col items-start gap-1 hover:bg-[#E8C97A] transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-[0px]"
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 size={18} />
                          <span>Daily MIS</span>
                        </div>
                        <span className="text-[10px] opacity-60">📅 Schedule: 8 PM Daily · Send Now →</span>
                      </button>
                      <span className="text-[10px] pl-1 text-[#C9A84C]/70">
                        {getMisLastSentLabel('daily') ? `✅ Last Sent: ${getMisLastSentLabel('daily')}` : '⏳ Not sent this session'}
                      </span>
                    </div>

                    {/* Weekly MIS */}
                    <div className="flex flex-col gap-1.5">
                      <button 
                        onClick={async () => {
                          toast.loading('Generating Weekend Performance Planning...', { id: 'mis-weekend' });
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
                            setMisLastSent(prev => ({ ...prev, weekend: new Date() }));
                            toast.success('Weekend Planning sent to email', { id: 'mis-weekend' });
                          } catch (e: any) {
                            toast.error(e.message || 'Failed to trigger report', { id: 'mis-weekend', duration: 5000 });
                          }
                        }}
                        className="px-6 py-4 bg-white/10 text-white border border-white/20 backdrop-blur-md rounded-2xl font-bold flex flex-col items-start gap-1 hover:bg-white/20 transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-[0px]"
                      >
                        <div className="flex items-center gap-2">
                          <TrendingUp size={18} />
                          <span>Weekend Planning</span>
                        </div>
                        <span className="text-[10px] opacity-60">📅 Schedule: Sat 9 AM · Send Now →</span>
                      </button>
                      <span className="text-[10px] pl-1 text-white/40">
                        {getMisLastSentLabel('weekend') ? `✅ Last Sent: ${getMisLastSentLabel('weekend')}` : '⏳ Not sent this session'}
                      </span>
                    </div>

                    {/* Monthly Detailed */}
                    <div className="flex flex-col gap-1.5">
                      <button 
                        onClick={async () => {
                          toast.loading('Generating Detailed Monthly Report...', { id: 'mis-monthly' });
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
                            setMisLastSent(prev => ({ ...prev, detailed_monthly: new Date() }));
                            toast.success('Detailed Monthly Report sent to email', { id: 'mis-monthly' });
                          } catch (e: any) {
                            toast.error(e.message || 'Failed to trigger report', { id: 'mis-monthly', duration: 5000 });
                          }
                        }}
                        className="px-6 py-4 bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30 backdrop-blur-md rounded-2xl font-bold flex flex-col items-start gap-1 hover:bg-[#C9A84C]/30 transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-[0px]"
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 size={18} />
                          <span>Monthly Detailed</span>
                        </div>
                        <span className="text-[10px] opacity-60">📅 Schedule: Mon 10 AM · Send Now →</span>
                      </button>
                      <span className="text-[10px] pl-1 text-[#C9A84C]/70">
                        {getMisLastSentLabel('detailed_monthly') ? `✅ Last Sent: ${getMisLastSentLabel('detailed_monthly')}` : '⏳ Not sent this session'}
                      </span>
                    </div>
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
                          <p className="font-bold text-white">{topThree[1].converted}</p>
                          <p>Closures</p>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl">
                          <p className="font-bold text-white">{topThree[1].visits}</p>
                          <p>Visits</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rank 1 */}
                  {topThree[0] && (
                    <div className="bg-gradient-to-b from-[#C9A84C]/20 to-[#C9A84C]/5 border border-[#C9A84C]/40 rounded-3xl p-8 text-center h-[320px] flex flex-col justify-center relative group hover:from-[#C9A84C]/30 transition-all shadow-2xl shadow-[#C9A84C]/10">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#C9A84C] rounded-full flex items-center justify-center text-[#1C1207] font-black border-4 border-[#1C1207] shadow-lg">
                        <Trophy size={20} />
                      </div>
                      <div className="w-24 h-24 bg-[#C9A84C]/20 rounded-full mx-auto mb-4 flex items-center justify-center text-[#C9A84C] text-4xl font-black border-2 border-[#C9A84C]/30 relative">
                        {topThree[0].name.charAt(0)}
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#C9A84C] rounded-full flex items-center justify-center border-4 border-[#1C1207]">
                           <Sparkles size={14} className="text-[#1C1207]" />
                        </div>
                      </div>
                      <h4 className="text-white font-bold text-xl mb-1">{topThree[0].name}</h4>
                      <p className="text-[#C9A84C] font-black text-lg mb-4">{topThree[0].score} PTS</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-white/60">
                        <div className="bg-white/10 p-2 rounded-xl border border-[#C9A84C]/20">
                          <p className="font-bold text-white">{topThree[0].converted}</p>
                          <p>Closures</p>
                        </div>
                        <div className="bg-white/10 p-2 rounded-xl border border-[#C9A84C]/20">
                          <p className="font-bold text-white">{topThree[0].visits}</p>
                          <p>Visits</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rank 3 */}
                  {topThree[2] && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center h-[250px] flex flex-col justify-center relative group hover:bg-white/10 transition-all">
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-orange-700 rounded-full flex items-center justify-center text-white font-black border-4 border-[#1C1207]">3</div>
                      <div className="w-20 h-20 bg-orange-700/20 rounded-full mx-auto mb-4 flex items-center justify-center text-orange-700 text-3xl font-black">
                        {topThree[2].name.charAt(0)}
                      </div>
                      <h4 className="text-white font-bold text-lg mb-1">{topThree[2].name}</h4>
                      <p className="text-[#C9A84C] font-black text-sm mb-4">{topThree[2].score} PTS</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-white/60">
                        <div className="bg-white/5 p-2 rounded-xl">
                          <p className="font-bold text-white">{topThree[2].converted}</p>
                          <p>Closures</p>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl">
                          <p className="font-bold text-white">{topThree[2].visits}</p>
                          <p>Visits</p>
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

              <div className="bg-white border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden mt-8">
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
                            {user.leads < 5 ? (
                              <span className="text-[10px] font-bold text-[#9A8262] italic bg-slate-50 px-2 py-1 rounded-full border border-slate-200">Insufficient Data</span>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-[#C9A84C]">{user.rate}%</span>
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                                  <div 
                                    className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] rounded-full" 
                                    style={{ width: `${Math.min(user.rate, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
              <div className="mt-4 space-y-2">
                {agingStats.map(s => (
                  <div key={s.name} className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E6D8B8]/40 hover:border-[#C9A84C]/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-bold text-[#2A1C00]">{s.name}</span>
                      <span className="text-xs font-black" style={{ color: s.color }}>({s.value} leads)</span>
                    </div>
                    {s.name === '30+ Days' && s.value > 0 ? (
                      <button
                        onClick={() => onNavigate('leads')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-[10px] font-black hover:bg-green-600 transition-all shadow-sm"
                      >
                        <MessageSquare size={11} />
                        Send Bulk WhatsApp
                      </button>
                    ) : s.name === '15-30 Days' && s.value > 0 ? (
                      <button
                        onClick={() => onNavigate('leads')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-[10px] font-black hover:bg-orange-600 transition-all shadow-sm"
                      >
                        <Phone size={11} />
                        Priority Call
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ On track</span>
                    )}
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
              
              {sourceQualityStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
                  <div className="text-5xl">📊</div>
                  <div>
                    <p className="font-bold text-[#2A1C00] text-base">No source data available</p>
                    <p className="text-xs text-[#9A8262] mt-1 max-w-xs mx-auto">Update lead sources to see ROI analysis and find your best-performing acquisition channels.</p>
                  </div>
                  <button
                    onClick={() => onNavigate('leads')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#1C1207] rounded-xl text-xs font-black hover:bg-[#D4BC7D] transition-all shadow-md"
                  >
                    <PlusCircle size={13} />
                    Bulk-edit Leads →
                  </button>
                </div>
              ) : (
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
                  </div>
                </div>
              )}
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
              <p className="text-[11px] text-[#9A8262] mb-4">Top 10 leads with no activity for <span className="font-bold text-red-500">3+ days</span>. Take action immediately.</p>
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] custom-scrollbar pr-2">
                {staleLeads.map((l, idx) => {
                  const daysIdle = Math.floor((now.getTime() - new Date(l.updated_at || l.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  const urgencyColor = daysIdle > 15 ? 'red' : daysIdle > 7 ? 'orange' : 'amber';
                  const urgencyClasses = {
                    red: 'bg-red-50 border-red-200 hover:border-red-400',
                    orange: 'bg-orange-50 border-orange-200 hover:border-orange-400',
                    amber: 'bg-amber-50 border-amber-200 hover:border-amber-400',
                  };
                  return (
                    <div
                      key={l.id}
                      className={cn("p-3 border rounded-xl transition-all", urgencyClasses[urgencyColor])}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <button
                          onClick={() => onNavigate('lead-detail', l.id)}
                          className="font-bold text-xs text-[#2A1C00] hover:text-[#C9A84C] text-left"
                        >
                          #{idx + 1} {l.name}
                        </button>
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-full",
                          urgencyColor === 'red' ? 'bg-red-500 text-white' :
                          urgencyColor === 'orange' ? 'bg-orange-500 text-white' :
                          'bg-amber-500 text-white'
                        )}>
                          {daysIdle}d Idle
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-[10px] text-[#9A8262]">
                          <span className="uppercase font-bold">{l.status}</span>
                          <span>•</span>
                          <span><UserIcon size={9} className="inline" /> {users.find(u => u.id === l.assignedTo)?.name || 'Unassigned'}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const phone = l.mobile || '';
                            if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
                            else toast.error('No mobile number for this lead');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-green-500 text-white rounded-lg text-[9px] font-black hover:bg-green-600 transition-all"
                        >
                          <MessageSquare size={10} />
                          WhatsApp
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                          {formatDateTime(activity.timestamp)}
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
      )}
    </div>
  );
}