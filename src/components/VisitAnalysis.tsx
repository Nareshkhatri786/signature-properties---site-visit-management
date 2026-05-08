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
  isWithinInterval, parseISO, isSameDay
} from 'date-fns';

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
  const periodCounts = useMemo(() => {
    const getCount = (interval: { start: Date, end: Date }) => 
      visits.filter(v => v.visit_status === 'completed' && isWithinInterval(getRelevantDate(v), interval) && (selectedProject === 'all' || v.projectId === selectedProject)).length;

    return {
      today: getCount({ start: startOfToday(), end: endOfToday() }),
      yesterday: getCount({ start: startOfYesterday(), end: endOfYesterday() }),
      thisWeek: getCount({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }),
      thisMonth: getCount({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) })
    };
  }, [visits, selectedProject]);

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MiniStatCard label="Today" value={periodCounts.today} active={selectedPeriod === 'today'} onClick={() => setSelectedPeriod('today')} />
        <MiniStatCard label="Yesterday" value={periodCounts.yesterday} active={selectedPeriod === 'yesterday'} onClick={() => setSelectedPeriod('yesterday')} />
        <MiniStatCard label="This Week" value={periodCounts.thisWeek} active={selectedPeriod === 'this_week'} onClick={() => setSelectedPeriod('this_week')} />
        <MiniStatCard label="This Month" value={periodCounts.thisMonth} active={selectedPeriod === 'this_month'} onClick={() => setSelectedPeriod('this_month')} />
        <MiniStatCard label="Total (Filtered)" value={stats.total} color="gold" />
        <select 
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="h-full bg-white border border-[#E6D8B8] rounded-xl px-4 text-xs font-bold text-[#2A1C00] focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer text-center"
        >
          <option value="all">🏢 ALL PROJECTS</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
        </select>
      </div>

      {/* Quality Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QualityCard label="Hot Potential" value={stats.hot} color="red" icon={Star} active={selectedQuality === 'hot'} onClick={() => setSelectedQuality(prev => prev === 'hot' ? 'all' : 'hot')} />
        <QualityCard label="Warm Interest" value={stats.warm} color="orange" icon={TrendingUp} active={selectedQuality === 'warm'} onClick={() => setSelectedQuality(prev => prev === 'warm' ? 'all' : 'warm')} />
        <QualityCard label="Cold / New" value={stats.cold} color="blue" icon={Clock} active={selectedQuality === 'cold'} onClick={() => setSelectedQuality(prev => prev === 'cold' ? 'all' : 'cold')} />
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
