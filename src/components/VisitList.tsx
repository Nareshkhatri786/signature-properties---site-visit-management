import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  MessageSquare, 
  Trash2, 
  Plus,
  ChevronDown,
  X,
  CalendarCheck,
  Phone,
  Calendar,
  Star,
  RefreshCw,
  Clock,
  Save,
  LayoutList,
  Trello
} from 'lucide-react';
import { Visit, Remark, Page, LeadStatus, VisitStatus, LeadQuality, VisitFilters, User, Project, FollowUp, Lead } from '../types';
import { cn, getLocalDateString } from '../lib/utils';
import { StatusBadge, VisitBadge } from './Dashboard';
import { User as UserIcon } from 'lucide-react';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';
import { getLeadFollowUp, getFollowUpDisplayStatus } from '../lib/followupUtils';
import { motion, AnimatePresence } from 'motion/react';
import VisitKanbanBoard from './VisitKanbanBoard';

interface VisitListProps {
  visits: Visit[];
  remarks: Record<string, Remark[]>;
  users: User[];
  projects: Project[];
  leads: Lead[];
  followUps: FollowUp[];
  initialFilters?: VisitFilters | null;
  onNavigate: (page: Page, id?: string) => void;
  onCall: (visit: Visit) => void;
  onWhatsApp: (visit: Visit) => void;
  onDelete: (id: string) => void;
  onUpdateVisit?: (visit: Visit) => void;
}

export default function VisitList({ visits, remarks, users, projects, leads, followUps, initialFilters, onNavigate, onCall, onWhatsApp, onDelete, onUpdateVisit }: VisitListProps) {
  const [search, setSearch] = useState(initialFilters?.search || '');
  const [period, setPeriod] = useState<string>(initialFilters?.period || '');
  const [status, setStatus] = useState<LeadQuality | ''>(initialFilters?.status || '');
  const [visitStatus, setVisitStatus] = useState<VisitStatus | ''>(initialFilters?.visitStatus || '');
  const [projectIdFilter, setProjectIdFilter] = useState<string>('');
  const [assignedToFilter, setAssignedToFilter] = useState<string | ''>('');
  const [followUpFilter, setFollowUpFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'kanban' : 'list'
  );
  
  const [reschedulingVisit, setReschedulingVisit] = useState<Visit | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const handleQuickReschedule = () => {
    if (!reschedulingVisit || !newDate || !onUpdateVisit) return;

    const updatedVisit: Visit = {
      ...reschedulingVisit,
      visit_date: newDate,
      visit_time: newTime,
      visit_status: 'rescheduled',
      reschedule_log: [
        ...(reschedulingVisit.reschedule_log || []),
        {
          previous_date: reschedulingVisit.visit_date,
          previous_time: reschedulingVisit.visit_time,
          new_date: newDate,
          new_time: newTime,
          at: new Date().toISOString()
        }
      ]
    };

    onUpdateVisit(updatedVisit);
    setReschedulingVisit(null);
    setNewDate('');
    setNewTime('');
  };

  React.useEffect(() => {
    if (initialFilters) {
      if (initialFilters.search !== undefined) setSearch(initialFilters.search);
      if (initialFilters.period !== undefined) setPeriod(initialFilters.period);
      if (initialFilters.status !== undefined) setStatus(initialFilters.status);
      if (initialFilters.visitStatus !== undefined) setVisitStatus(initialFilters.visitStatus);
    }
  }, [initialFilters]);

  const filteredVisits = visits.filter(v => {
    const matchesSearch = v.client_name.toLowerCase().includes(search.toLowerCase()) || v.mobile.includes(search);
    const matchesStatus = status === '' || v.status === status;
    const matchesVisitStatus = visitStatus === '' || v.visit_status === visitStatus;
    
    let matchesPeriod = true;
    const today = getLocalDateString();
    if (period === 'today') matchesPeriod = v.visit_date === today;
    else if (period === 'week') {
      const d = new Date(v.visit_date);
      const now = new Date();
      const start = new Date(now.setDate(now.getDate() - now.getDay()));
      const end = new Date(now.setDate(now.getDate() + 6));
      matchesPeriod = d >= start && d <= end;
    } else if (period === 'month') {
      const d = new Date(v.visit_date);
      const now = new Date();
      matchesPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }

    const matchesProject = projectIdFilter === '' || v.projectId === projectIdFilter;
    const matchesUser = assignedToFilter === '' || v.assigned_to === assignedToFilter;
    const matchesFollowUp = followUpFilter === '' || getFollowUpDisplayStatus(getLeadFollowUp(followUps, v.leadId, v.id, visits)) === followUpFilter;

    return matchesSearch && matchesStatus && matchesVisitStatus && matchesPeriod && matchesProject && matchesUser && matchesFollowUp;
  }).sort((a, b) => {
    // Sort by priority first
    const priA = a.priority || 0;
    const priB = b.priority || 0;
    if (priA !== priB) return priB - priA;
    // Then by date
    return b.visit_date.localeCompare(a.visit_date);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] flex items-center gap-2">
          <CalendarCheck className="text-[#C9A84C]" />
          Site Visits
        </h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setPeriod('today')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              period === 'today' 
                ? "bg-[#C9A84C] text-white border-[#C9A84C]" 
                : "bg-white text-[#9A8262] border-[#E6D8B8] hover:border-[#C9A84C]"
            )}
          >
            Today's Visits ({visits.filter(v => v.visit_date === getLocalDateString()).length})
          </button>
          <button 
            onClick={() => onNavigate('add-visit')}
            className="bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:translate-y-[-1px] transition-all whitespace-nowrap"
          >
            <Plus size={18} /> Add New Visit
          </button>
        </div>
      </div>
      
      {/* View Switcher Row */}
      <div className="flex">
        <div className="bg-[#FDFAF2] border border-[#E6D8B8] rounded-xl p-1 flex shrink-0">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "flex-1 lg:flex-none flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              viewMode === 'list' ? "bg-white text-[#C9A84C] shadow-sm" : "text-[#9A8262] hover:text-[#C9A84C]"
            )}
          >
            <LayoutList size={18} /> List
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              "flex-1 lg:flex-none flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              viewMode === 'kanban' ? "bg-white text-[#C9A84C] shadow-sm" : "text-[#9A8262] hover:text-[#C9A84C]"
            )}
          >
            <Trello size={18} /> Pipeline
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or mobile..."
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Period</label>
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          >
            <option value="">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Status</label>
          <select 
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus | '')}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="hot">🔥 Hot</option>
            <option value="warm">🌡️ Warm</option>
            <option value="cold">❄️ Cold</option>
            <option value="pending">⏳ Pending</option>
            <option value="disq">🚫 Disqualified</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Visit Status</label>
          <select 
            value={visitStatus}
            onChange={(e) => setVisitStatus(e.target.value as VisitStatus | '')}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          >
            <option value="">All Visits</option>
            <option value="scheduled">📅 Scheduled</option>
            <option value="completed">✅ Completed</option>
            <option value="rescheduled">🔄 Rescheduled</option>
            <option value="cancelled">❌ Cancelled</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Project</label>
          <select 
            value={projectIdFilter}
            onChange={(e) => setProjectIdFilter(e.target.value)}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Follow-up</label>
          <select 
            value={followUpFilter}
            onChange={(e) => setFollowUpFilter(e.target.value)}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          >
            <option value="">All Follow-ups</option>
            <option value="overdue">🔴 Overdue</option>
            <option value="today">🟡 Due Today</option>
            <option value="upcoming">🔵 Upcoming</option>
            <option value="completed">🟢 Done</option>
            <option value="none">⚪ No Follow-up</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">User</label>
          <select 
            value={assignedToFilter}
            onChange={(e) => setAssignedToFilter(e.target.value)}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          >
            <option value="">All Users</option>
            {users.map(u => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => { 
            setSearch(''); 
            setPeriod(''); 
            setStatus(''); 
            setVisitStatus(''); 
            setProjectIdFilter(''); 
            setAssignedToFilter(''); 
            setFollowUpFilter('');
          }}
          className="h-[38px] flex items-center justify-center gap-2 text-[#9A8262] text-sm font-semibold hover:text-[#2A1C00] transition-colors"
        >
          <X size={14} /> Reset
        </button>
      </div>

      {viewMode === 'kanban' ? (
        <VisitKanbanBoard 
          visits={filteredVisits}
          users={users}
          leads={leads}
          followUps={followUps}
          onUpdateStatus={(id, status) => {
            const visit = visits.find(v => v.id === id);
            if (visit && onUpdateVisit) {
              onUpdateVisit({ ...visit, visit_status: status });
            }
          }}
          onSelectVisit={(v) => onNavigate('detail', v.id)}
          onCall={onCall}
          onWhatsApp={onWhatsApp}
        />
      ) : (
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-[#E6D8B8]/50">
            {filteredVisits.length > 0 ? filteredVisits.map(v => {
              const lead = leads.find(l => l.id === v.leadId);
              const isLost = lead?.status === 'lost';
              return (
                <div 
                  key={v.id} 
                  className={cn("p-4 active:bg-[#C9A84C]/5 transition-colors border-l-4", {
                    'border-red-500': v.status === 'hot',
                    'border-orange-500': v.status === 'warm',
                    'border-blue-500': v.status === 'cold',
                    'border-purple-500': v.status === 'pending',
                    'border-gray-400': v.status === 'disq',
                  })}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0" onClick={() => onNavigate('detail', v.id)}>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#2A1C00] truncate">{v.client_name}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3].map(s => (
                            <Star key={s} size={10} className={cn((v.priority || 0) >= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200")} />
                          ))}
                        </div>
                        <StatusBadge status={v.status} />
                      </div>
                      <p className="text-green-600 text-sm font-medium mt-0.5">{v.mobile}</p>
                      
                      <div className="mt-2">
                        <FollowUpStatusBadge 
                          status={getFollowUpDisplayStatus(getLeadFollowUp(followUps, v.leadId, v.id, visits))}
                          date={getLeadFollowUp(followUps, v.leadId, v.id, visits)?.date}
                          isLost={isLost}
                          onClick={() => onNavigate('detail', v.id)}
                        />
                      </div>

                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#2A1C00]">
                      <Calendar size={12} className="text-[#C9A84C]" />
                      {new Date(v.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                    <VisitBadge status={v.visit_status} />
                  </div>

                  {v.property_interest && (
                    <p className="text-[#9A8262] text-[11px] mt-2 italic truncate">
                      Interested in: {v.property_interest}
                    </p>
                  )}
                  {v.assigned_to && (
                    <div className="flex items-center gap-1.5 mt-2 bg-[#FDFAF2] border border-[#E6D8B8] w-fit px-2 py-0.5 rounded-md">
                      <UserIcon size={12} className="text-[#C9A84C]" />
                      <span className="text-[10px] font-bold text-[#2A1C00]">Owner: {v.assigned_to}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => onCall(v)}
                    className="p-2.5 bg-green-50 text-green-600 rounded-full shadow-sm active:scale-95 transition-all"
                  >
                    <Phone size={18} fill="currentColor" />
                  </button>
                  <button 
                    onClick={() => onNavigate('detail', v.id)}
                    className="p-2.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded-full active:scale-95 transition-all"
                  >
                    <Eye size={18} />
                  </button>
                </div>
              </div>
                </div>
              );
            }) : (
            <div className="p-10 text-center opacity-30">
              <CalendarCheck size={40} className="mx-auto mb-2" />
              <p className="text-sm italic">No visits found</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#FDFAF2] border-b border-[#E6D8B8]">
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider text-center">Owner</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Mobile / Source</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Follow-up</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Visit Date</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Visit Status</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Remarks</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D8B8]/50">
              {filteredVisits.length > 0 ? filteredVisits.map(v => {
                const lead = leads.find(l => l.id === v.leadId);
                const isLost = lead?.status === 'lost';
                return (
                  <tr key={v.id} className={cn("hover:bg-[#FEFCF5] transition-colors border-l-4", {
                    'border-red-500': v.status === 'hot',
                    'border-orange-500': v.status === 'warm',
                    'border-blue-500': v.status === 'cold',
                    'border-purple-500': v.status === 'pending',
                    'border-gray-400': v.status === 'disq',
                  })}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[13.5px]">{v.client_name}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3].map(s => (
                            <Star key={s} size={10} className={cn((v.priority || 0) >= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200")} />
                          ))}
                        </div>
                      </div>
                      <p className="text-[#9A8262] text-[11.5px] truncate max-w-[150px]">{v.property_interest || '–'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-7 h-7 rounded-full bg-[#FDFAF2] border border-[#E6D8B8] flex items-center justify-center text-[10px] font-bold text-[#C9A84C]">
                          {v.assigned_to?.[0] || '?'}
                        </div>
                        <span className="text-[10px] font-bold text-[#2A1C00] truncate max-w-[80px]">
                          {v.assigned_to || 'Unassigned'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-[13.5px] text-green-600">{v.mobile}</p>
                      <p className="text-[#9A8262] text-[11.5px]">{v.source || '–'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <FollowUpStatusBadge 
                        status={getFollowUpDisplayStatus(getLeadFollowUp(followUps, v.leadId, v.id, visits))}
                        date={getLeadFollowUp(followUps, v.leadId, v.id, visits)?.date}
                        isLost={isLost}
                        onClick={() => onNavigate('detail', v.id)}
                      />
                    </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-[13.5px]">{new Date(v.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[#9A8262] text-[11.5px]">{v.visit_time || '–'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-6 py-4">
                    <VisitBadge status={v.visit_status} />
                  </td>
                  <td className="px-6 py-4">
                    {(remarks[v.id] || []).length > 0 ? (
                      <span className="bg-[#C9A84C]/10 text-[#C9A84C] px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit">
                        <MessageSquare size={10} /> {(remarks[v.id] || []).length}
                      </span>
                    ) : (
                      <span className="text-[#9A8262] text-xs">–</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => onCall(v)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Call Client"
                      >
                        <Phone size={16} />
                      </button>
                      <button 
                        onClick={() => onWhatsApp(v)}
                        className="p-2 text-[#25D366] hover:bg-[#25D366]/10 rounded-lg transition-colors"
                        title="Send WhatsApp"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setReschedulingVisit(v);
                          setNewDate(v.visit_date);
                          setNewTime(v.visit_time || '');
                        }}
                        className="p-2 text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg transition-colors"
                        title="Reschedule Visit"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button 
                        onClick={() => onNavigate('detail', v.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => { if(confirm('Delete this visit?')) onDelete(v.id); }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <CalendarCheck size={48} />
                      <p className="text-sm italic">No visits found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <AnimatePresence>
        {reschedulingVisit && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-[#E6D8B8] rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-[#FDF8E6] text-[#C9A84C] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#F2ECD8]">
                  <RefreshCw size={32} />
                </div>
                <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] mb-2 text-center">Quick Reschedule</h3>
                <p className="text-sm text-[#9A8262] mb-6 text-center leading-relaxed">
                  Change visit date and time for <span className="font-bold text-[#5C4820]">{reschedulingVisit.client_name}</span>
                </p>

                <div className="space-y-4 mb-8">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={12} /> New Date
                    </label>
                    <input 
                      type="date" 
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={12} /> New Time (Optional)
                    </label>
                    <input 
                      type="time" 
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleQuickReschedule}
                    className="w-full bg-[#C9A84C] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#C9A84C]/20 hover:bg-[#B59640] transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> Update Schedule
                  </button>
                  <button 
                    onClick={() => setReschedulingVisit(null)}
                    className="w-full bg-white border border-[#E6D8B8] text-[#9A8262] font-semibold py-3 rounded-xl hover:bg-[#FDFAF2] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
