import React, { useState, useMemo } from 'react';
import { 
  Calendar, Users, Target, ArrowLeft, Filter, 
  Search, Download, ChevronRight, Projector as Project,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Star
} from 'lucide-react';
import { Visit, Lead, Project as AppProject, LeadQuality, LeadStatus } from '../types';
import { cn, getLocalDateString } from '../lib/utils';
import { 
  startOfToday, endOfToday, startOfYesterday, endOfYesterday,
  startOfWeek, endOfWeek, subWeeks,
  startOfMonth, endOfMonth, subMonths,
  isWithinInterval, parseISO, isSameDay, format, eachDayOfInterval, subDays
} from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';

interface VisitAnalysisProps {
  visits: Visit[];
  leads: Lead[];
  projects: AppProject[];
  onBack: () => void;
  onNavigate: (page: any, id: string) => void;
}

type Period = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all';

export default function VisitAnalysis({ visits, leads, projects, onBack, onNavigate }: VisitAnalysisProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('this_month');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedQuality, setSelectedQuality] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to get the most accurate date for a visit
  const getRelevantDate = (v: Visit) => {
    // For footfall, we prioritize when it was actually completed
    if (v.visit_status === 'completed' && v.completed_at) {
      return parseISO(v.completed_at);
    }
    // Fallback to visit_date (scheduled date)
    return v.visit_date ? parseISO(v.visit_date) : new Date(0);
  };

  // 1. Filter logic
  const filteredVisits = useMemo(() => {
    let result = visits.filter(v => v.visit_status === 'completed'); // Focusing on physical footfall

    // Period Filter
    const now = new Date();
    const intervals: Record<Period, { start: Date, end: Date } | null> = {
      today: { start: startOfToday(), end: endOfToday() },
      yesterday: { start: startOfYesterday(), end: endOfYesterday() },
      this_week: { start: startOfWeek(now), end: endOfWeek(now) },
      last_week: { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) },
      this_month: { start: startOfMonth(now), end: endOfMonth(now) },
      last_month: { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) },
      all: null
    };

    const interval = intervals[selectedPeriod];
    if (interval) {
      result = result.filter(v => {
        const d = getRelevantDate(v);
        return isWithinInterval(d, interval);
      });
    }

    // Project Filter
    if (selectedProject !== 'all') {
      result = result.filter(v => v.projectId === selectedProject);
    }

    // Quality Filter (From Lead)
    if (selectedQuality !== 'all' || searchQuery) {
      result = result.filter(v => {
        const lead = leads.find(l => l.id === v.leadId);
        const matchesQuality = selectedQuality === 'all' || lead?.quality === selectedQuality;
        const matchesSearch = !searchQuery || 
          v.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.mobile?.includes(searchQuery);
        return matchesQuality && matchesSearch;
      });
    }

    return result.sort((a, b) => {
      const dateA = getRelevantDate(a).getTime();
      const dateB = getRelevantDate(b).getTime();
      return dateB - dateA;
    });
  }, [visits, leads, selectedPeriod, selectedProject, selectedQuality, searchQuery]);

  // 2. Summary Stats based on filtered data
  const stats = useMemo(() => {
    const counts = { hot: 0, warm: 0, cold: 0, disq: 0, total: filteredVisits.length };
    filteredVisits.forEach(v => {
      const lead = leads.find(l => l.id === v.leadId);
      if (lead?.quality === 'hot') counts.hot++;
      else if (lead?.quality === 'warm') counts.warm++;
      else if (lead?.quality === 'cold') counts.cold++;
      else counts.disq++;
    });
    return counts;
  }, [filteredVisits, leads]);

  // 3. Comparison Stats (Period-based)
  const analyticsData = useMemo(() => {
    // Trend Data (Last 14 days)
    const last14Days = eachDayOfInterval({
      start: subDays(new Date(), 13),
      end: new Date()
    });

    const trend = last14Days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayVisits = visits.filter(v => v.visit_status === 'completed' && v.visit_date?.startsWith(dayStr));
      return {
        name: format(day, 'dd MMM'),
        visits: dayVisits.length,
        hot: dayVisits.filter(v => leads.find(l => l.id === v.leadId)?.quality === 'hot').length
      };
    });

    // Project Data
    const projectDist = projects.map(p => {
      const pVisits = visits.filter(v => v.projectId === p.id && v.visit_status === 'completed');
      return {
        name: p.name,
        value: pVisits.length
      };
    }).filter(p => p.value > 0).sort((a, b) => b.value - a.value);

    // Visit to Booking Ratio
    const totalCompletedVisits = visits.filter(v => v.visit_status === 'completed').length;
    const closedLeadsFromVisits = leads.filter(l => l.status === 'closed' && visits.some(v => v.leadId === l.id && v.visit_status === 'completed')).length;
    const conversionRatio = totalCompletedVisits > 0 ? Math.round((closedLeadsFromVisits / totalCompletedVisits) * 100) : 0;

    return {
      trend,
      projectDist,
      conversionRatio,
      closedLeadsFromVisits,
      totalCompletedVisits,
      today: visits.filter(v => v.visit_status === 'completed' && v.visit_date?.startsWith(format(new Date(), 'yyyy-MM-dd'))).length,
      yesterday: visits.filter(v => v.visit_status === 'completed' && v.visit_date?.startsWith(format(subDays(new Date(), 1), 'yyyy-MM-dd'))).length,
      thisWeek: visits.filter(v => v.visit_status === 'completed' && isWithinInterval(parseISO(v.visit_date || ''), { start: startOfWeek(new Date()), end: endOfWeek(new Date()) })).length,
      thisMonth: visits.filter(v => v.visit_status === 'completed' && isWithinInterval(parseISO(v.visit_date || ''), { start: startOfMonth(new Date()), end: endOfMonth(new Date()) })).length
    };
  }, [visits, leads, projects]);

  const COLORS = ['#C9A84C', '#B59640', '#9A8262', '#5C4820', '#2A1C00'];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-[#9A8262] hover:text-[#C9A84C] text-sm font-bold mb-2 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h2 className="font-serif text-3xl font-bold text-[#2A1C00] flex items-center gap-3">
            <div className="p-2 bg-[#C9A84C]/10 rounded-xl">
              <TrendingUp size={24} className="text-[#C9A84C]" />
            </div>
            Visit Analysis Report
          </h2>
          <p className="text-[#9A8262] text-sm mt-1">Detailed footfall analytics and conversion tracking.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" size={16} />
            <input 
              type="text"
              placeholder="Search client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-[#E6D8B8] rounded-xl text-sm focus:outline-none focus:border-[#C9A84C] w-64"
            />
          </div>
          <button className="p-2.5 bg-white border border-[#E6D8B8] text-[#9A8262] rounded-xl hover:bg-[#FDFBF7] transition-all">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-[#1C1207] border border-[#C9A84C]/20 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <TrendingUp size={120} className="text-[#C9A84C]" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-white font-serif text-xl font-bold">Footfall Velocity</h3>
                <p className="text-[#C9A84C] text-[10px] font-black uppercase tracking-widest mt-1">Daily completed visits trend</p>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-white font-serif text-2xl font-black">{analyticsData.totalCompletedVisits}</p>
                  <p className="text-white/40 text-[9px] font-bold uppercase">Total Volume</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-right">
                  <p className="text-[#C9A84C] font-serif text-2xl font-black">{analyticsData.conversionRatio}%</p>
                  <p className="text-white/40 text-[9px] font-bold uppercase">Conversion Rate</p>
                </div>
              </div>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.trend}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#C9A84C" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1C1207', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px', color: '#C9A84C' }}
                  />
                  <Area type="monotone" dataKey="visits" stroke="#C9A84C" strokeWidth={3} fillOpacity={1} fill="url(#colorVisits)" />
                  <Area type="monotone" dataKey="hot" stroke="#E74C3C" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6D8B8] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-[#2A1C00] font-serif text-lg font-bold">Quick Pulse</h3>
            <p className="text-[#9A8262] text-[10px] font-black uppercase tracking-widest mt-1">Visit frequency</p>
          </div>
          <div className="space-y-4 my-6">
            <MiniStatItem label="Today" value={analyticsData.today} trend="+12%" />
            <MiniStatItem label="Yesterday" value={analyticsData.yesterday} />
            <MiniStatItem label="This Week" value={analyticsData.thisWeek} />
            <MiniStatItem label="This Month" value={analyticsData.thisMonth} />
          </div>
          <select 
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full bg-[#FDFBF7] border border-[#E6D8B8] rounded-xl py-3 px-4 text-[10px] font-black text-[#2A1C00] focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer text-center"
          >
            <option value="all">🏢 ALL PROJECTS</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {/* Deep Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <QualityCard label="Hot Potential" value={stats.hot} color="red" icon={Star} active={selectedQuality === 'hot'} onClick={() => setSelectedQuality(prev => prev === 'hot' ? 'all' : 'hot')} />
          <QualityCard label="Warm Interest" value={stats.warm} color="orange" icon={TrendingUp} active={selectedQuality === 'warm'} onClick={() => setSelectedQuality(prev => prev === 'warm' ? 'all' : 'warm')} />
          <QualityCard label="Cold / New" value={stats.cold} color="blue" icon={Clock} active={selectedQuality === 'cold'} onClick={() => setSelectedQuality(prev => prev === 'cold' ? 'all' : 'cold')} />
        </div>
        
        <div className="bg-white border border-[#E6D8B8] rounded-[2rem] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black text-[#9A8262] uppercase tracking-widest">Project Popularity</h4>
            <div className="w-2 h-2 bg-[#C9A84C] rounded-full animate-pulse" />
          </div>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.projectDist}
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {analyticsData.projectDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFDF6', border: '1px solid #E6D8B8', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#E6D8B8] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFBF7] flex items-center justify-between">
          <h3 className="font-bold text-[#2A1C00] flex items-center gap-2">
            <Users size={18} className="text-[#C9A84C]" />
            Footfall Log <span className="text-[#9A8262] font-normal text-sm">({filteredVisits.length} Records)</span>
          </h3>
          <div className="flex gap-2">
            {(['today', 'yesterday', 'this_week', 'this_month', 'all'] as Period[]).map(p => (
              <button 
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  selectedPeriod === p ? "bg-[#C9A84C] text-white shadow-md" : "bg-[#F5F1E6] text-[#9A8262] hover:bg-[#E6D8B8]"
                )}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#FDFBF7] border-b border-[#E6D8B8]">
                <th className="px-6 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Visit Date</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Client Details</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Project</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Lead Quality</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em]">Current Stage</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#9A8262] uppercase tracking-[0.1em] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D8B8]/30">
              {filteredVisits.length > 0 ? filteredVisits.map(v => {
                const lead = leads.find(l => l.id === v.leadId);
                const project = projects.find(p => p.id === v.projectId);
                return (
                  <tr key={v.id} className="hover:bg-[#FFFDF6] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className={cn(v.completed_at ? "text-emerald-500" : "text-[#C9A84C]")} />
                        <span className="font-bold text-[#2A1C00] text-sm">
                          {getRelevantDate(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {v.completed_at && (
                           <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded border border-emerald-100">Completed</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9A8262] ml-6 mt-0.5">
                        {v.completed_at 
                          ? new Date(v.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : (v.visit_time || '--:--')}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-[#2A1C00] group-hover:text-[#C9A84C] transition-colors">{v.client_name}</p>
                      <p className="text-[#9A8262] text-[11px] font-mono">{v.mobile}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2 py-1 bg-white border border-[#E6D8B8] rounded text-[10px] font-bold text-[#5C4820]">
                        {project?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <QualityBadge quality={lead?.quality || 'pending'} />
                    </td>
                    <td className="px-6 py-5">
                      <StageBadge status={lead?.status || 'new'} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => onNavigate('detail', v.id)}
                        className="p-2 text-[#9A8262] hover:bg-[#C9A84C] hover:text-white rounded-xl transition-all"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-[#9A8262] italic">
                    No physical visits found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStatItem({ label, value, trend }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F5F1E6] last:border-0">
      <div>
        <p className="text-[10px] font-bold text-[#9A8262] uppercase">{label}</p>
        <p className="text-xl font-serif font-black text-[#2A1C00]">{value}</p>
      </div>
      {trend && (
        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          {trend}
        </span>
      )}
    </div>
  );
}

function MiniStatCard({ label, value, color, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex flex-col items-center justify-center p-4 border rounded-xl transition-all h-full",
        active ? "bg-[#C9A84C] border-[#C9A84C] text-white shadow-lg scale-105" : "bg-white border-[#E6D8B8] text-[#2A1C00] hover:border-[#C9A84C]",
        color === 'gold' && !active && "bg-[#FDFBF7] border-[#C9A84C]/30"
      )}
    >
      <span className={cn("text-2xl font-serif font-bold", active ? "text-white" : color === 'gold' ? "text-[#C9A84C]" : "text-[#2A1C00]")}>{value}</span>
      <span className={cn("text-[9px] font-black uppercase tracking-wider mt-1 text-center", active ? "text-white/80" : "text-[#9A8262]")}>{label}</span>
    </button>
  );
}

function QualityCard({ label, value, color, icon: Icon, active, onClick }: any) {
  const colors: any = {
    red: active ? 'bg-rose-600 border-rose-600 text-white' : 'bg-rose-50 border-rose-100 text-rose-700 hover:border-rose-300',
    orange: active ? 'bg-amber-600 border-amber-600 text-white' : 'bg-amber-50 border-amber-100 text-amber-700 hover:border-amber-300',
    blue: active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:border-indigo-300',
  };

  return (
    <button onClick={onClick} className={cn("p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-all group", colors[color])}>
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", active ? "bg-white/20" : "bg-white shadow-sm")}>
          <Icon size={24} />
        </div>
        <div className="text-left">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.1em]", active ? "text-white/70" : "text-[#9A8262]")}>{label}</p>
          <p className="text-3xl font-serif font-bold">{value}</p>
        </div>
      </div>
      <ChevronRight className={cn("opacity-0 group-hover:opacity-100 transition-opacity", active ? "text-white" : "text-[#9A8262]")} />
    </button>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const styles: any = {
    hot: 'bg-rose-100 text-rose-700 border-rose-200',
    warm: 'bg-amber-100 text-amber-700 border-amber-200',
    cold: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
    disq: 'bg-slate-200 text-slate-400 border-slate-300',
  };
  return <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase border", styles[quality])}>{quality}</span>;
}

function StageBadge({ status }: { status: string }) {
  const styles: any = {
    new: 'bg-blue-50 text-blue-600',
    contacted: 'bg-purple-50 text-purple-600',
    visit_scheduled: 'bg-indigo-50 text-indigo-600',
    visit_done: 'bg-emerald-50 text-emerald-600',
    closed: 'bg-[#C9A84C]/10 text-[#C9A84C]',
    lost: 'bg-rose-50 text-rose-600',
  };
  return <span className={cn("px-2 py-1 rounded text-[9px] font-bold uppercase", styles[status])}>{status.replace('_', ' ')}</span>;
}
