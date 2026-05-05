import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  UserPlus, 
  User,
  Phone, 
  Calendar, 
  ChevronDown, 
  X,
  MoreVertical,
  Mail,
  ExternalLink,
  Plus,
  CheckSquare,
  Square,
  MessageSquare,
  Check,
  Sparkles,
  LayoutList,
  Trello,
  Star
} from 'lucide-react';
import { Lead, Page, LeadStatus, LeadQuality, User as AppUser, Project, FollowUp, Visit } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import KanbanBoard from './KanbanBoard';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';
import { getLeadFollowUp, getFollowUpDisplayStatus } from '../lib/followupUtils';

interface LeadListProps {
  leads: Lead[];
  users: AppUser[];
  projects: Project[];
  onNavigate: (page: Page, id?: string, filters?: any) => void;
  onAddLead: () => void;
  onCall: (lead: Lead) => void;
  onWhatsApp: (lead: Lead) => void;
  onBulkScore: (ids: string[]) => void;
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkAssign: (ids: string[], userId: number, userName: string) => void;
  followUps: FollowUp[];
  visits: Visit[];
  initialFilters?: LeadFilters | null;
}

export default React.memo(function LeadList({ leads, users, projects, onNavigate, onAddLead, onCall, onWhatsApp, onBulkScore, onUpdateStatus, onBulkDelete, onBulkAssign, followUps, visits, initialFilters }: LeadListProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [quality, setQuality] = useState<LeadQuality | ''>('');
  const [source, setSource] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'kanban' : 'list'
  );
  const [projectIdFilter, setProjectIdFilter] = useState<string>('');
  const [assignedToFilter, setAssignedToFilter] = useState<number | ''>('');
  const [followUpFilter, setFollowUpFilter] = useState<string>('');

  React.useEffect(() => {
    if (initialFilters) {
      if (initialFilters.quality) setQuality(initialFilters.quality);
      if (initialFilters.status) setStatus(initialFilters.status);
      if (initialFilters.source) setSource(initialFilters.source);
      if (initialFilters.search) setSearch(initialFilters.search);
    }
  }, [initialFilters]);

  const sources = Array.from(new Set(leads.map(l => l.source))).filter(Boolean).sort();

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.mobile.includes(search);
    const matchesStatus = status === '' || l.status === status;
    const matchesQuality = quality === '' || l.quality === quality;
    const matchesSource = source === '' || l.source === source;
    const matchesProject = projectIdFilter === '' || l.projectId === projectIdFilter;
    const matchesUser = assignedToFilter === '' || l.assignedTo === assignedToFilter;
    const matchesFollowUp = followUpFilter === '' || getFollowUpDisplayStatus(getLeadFollowUp(followUps, l.id, undefined, visits)) === followUpFilter;
    return matchesSearch && matchesStatus && matchesQuality && matchesSource && matchesProject && matchesUser && matchesFollowUp;
  }).sort((a, b) => {
    // Sort by priority (stars) first
    const priA = a.priority || 0;
    const priB = b.priority || 0;
    if (priA !== priB) return priB - priA;
    // Then by creation date
    return b.created_at.localeCompare(a.created_at);
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map(l => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkWhatsApp = () => {
    if (selectedIds.length === 0) return;
    
    const selectedLeads = leads.filter(l => selectedIds.includes(l.id));
    
    // For bulk, we can't open multiple windows at once reliably due to browser blocks
    // So we'll open the first one and show a toast for the rest, or navigate to a bulk sender page
    // For now, let's open the first one and suggest using the WhatsApp page for more complex bulk tasks
    const firstLead = selectedLeads[0];
    const num = firstLead.mobile.replace(/[^0-9]/g, '');
    const finalNum = num.length === 10 ? `91${num}` : num;
    
    window.open(`https://wa.me/${finalNum}?text=${encodeURIComponent(`Hello ${firstLead.name}, `)}`, '_blank');
    toast.success(`Opening WhatsApp for ${firstLead.name}. ${selectedIds.length - 1} more selected.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] flex items-center gap-2">
          <UserPlus className="text-[#C9A84C]" />
          Lead Management
        </h2>
        <button 
          onClick={onAddLead}
          className="bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:translate-y-[-1px] transition-all"
        >
          <Plus size={18} /> Add Manual Lead
        </button>
      </div>

      {/* View Switcher & Filters Row */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
        {/* View Switcher */}
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

        {/* Filters */}
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end flex-1">
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
            <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Status</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus | '')}
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="new">🆕 New</option>
              <option value="contacted">📞 Contacted</option>
              <option value="visit_scheduled">📅 Visit Scheduled</option>
              <option value="visit_done">✅ Visit Done</option>
              <option value="closed">🤝 Closed</option>
              <option value="lost">❌ Lost</option>
            </select>
          </div>
  
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Quality</label>
            <select 
              value={quality}
              onChange={(e) => setQuality(e.target.value as LeadQuality | '')}
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
            >
              <option value="">All Quality</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">🌡️ Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>
          </div>
  
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Source</label>
            <select 
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
            >
              <option value="">All Sources</option>
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
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
              onChange={(e) => setAssignedToFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => { 
                setSearch(''); 
                setStatus(''); 
                setQuality(''); 
                setSource(''); 
                setProjectIdFilter(''); 
                setAssignedToFilter(''); 
                setFollowUpFilter('');
                setSelectedIds([]); 
              }}
              className="flex-1 h-[38px] flex items-center justify-center gap-2 text-[#9A8262] text-sm font-semibold hover:text-[#2A1C00] transition-colors"
            >
              <X size={14} /> Reset
            </button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-[#C9A84C] text-white px-6 py-3 rounded-xl flex items-center justify-between shadow-lg animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-4">
            <span className="font-bold">{selectedIds.length} Leads Selected</span>
            <div className="w-px h-4 bg-white/30" />
            <button 
              onClick={handleBulkWhatsApp}
              className="flex items-center gap-2 bg-white text-[#C9A84C] px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/90 transition-colors"
            >
              <MessageSquare size={16} /> Bulk WhatsApp
            </button>
            <button 
              onClick={() => onBulkScore(selectedIds)}
              className="flex items-center gap-2 bg-white/20 text-white border border-white/30 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-white/30 transition-colors"
            >
              <Sparkles size={16} /> AI Bulk Score
            </button>
            
            <div className="flex items-center gap-2 border-l border-white/30 pl-4">
              <select 
                onChange={(e) => {
                  const u = users.find(u => u.id === Number(e.target.value));
                  if (u) {
                    onBulkAssign(selectedIds, u.id, u.name);
                    setSelectedIds([]);
                  }
                }}
                className="bg-white/20 text-white border border-white/30 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus:bg-white/30"
              >
                <option value="" className="text-gray-900">Assign To...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="text-gray-900">{u.name}</option>
                ))}
              </select>
              
              <button 
                onClick={() => {
                  onBulkDelete(selectedIds);
                  setSelectedIds([]);
                }}
                className="flex items-center gap-2 bg-rose-500/80 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-rose-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
          <button 
            onClick={() => setSelectedIds([])}
            className="text-white/80 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {viewMode === 'kanban' ? (
        <KanbanBoard 
          leads={filteredLeads}
          users={users}
          followUps={followUps}
          visits={visits}
          onUpdateStatus={onUpdateStatus}
          onSelectLead={(l) => onNavigate('lead-detail', l.id)}
          onCall={onCall}
          onWhatsApp={onWhatsApp}
        />
      ) : (
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
        {/* Mobile View: Card List */}
        <div className="md:hidden divide-y divide-[#E6D8B8]/50">
          {filteredLeads.map(l => (
            <div 
              key={l.id} 
              className={cn(
                "p-4 active:bg-[#C9A84C]/5 transition-colors",
                selectedIds.includes(l.id) && "bg-[#C9A84C]/5"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0" onClick={() => onNavigate('lead-detail', l.id)}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleSelect(l.id); }}
                    className="mt-1 text-[#C9A84C]"
                  >
                    {selectedIds.includes(l.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#2A1C00] truncate">{l.name}</p>
                      <LeadQualityBadge quality={l.quality} />
                      <div className="flex gap-0.5 ml-1">
                        {[1, 2, 3].map(s => (
                          <Star key={s} size={10} className={cn((l.priority || 0) >= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200")} />
                        ))}
                      </div>
                    </div>
                    <p className="text-green-600 text-sm font-medium mt-0.5">{l.mobile}</p>
                    <div className="mt-2">
                      <FollowUpStatusBadge 
                        status={getFollowUpDisplayStatus(getLeadFollowUp(followUps, l.id, undefined, visits))}
                        date={getLeadFollowUp(followUps, l.id, undefined, visits)?.date}
                        isLost={l.status === 'lost'}
                        onClick={() => onNavigate('lead-detail', l.id)}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <LeadStatusBadge status={l.status} />
                      <span className="text-[10px] font-medium text-[#9A8262] bg-[#F5EDD4] px-2 py-0.5 rounded-md">
                        {l.source}
                      </span>
                      {l.assignedTo && (
                        <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <User size={10} /> {users.find(u => u.id === l.assignedTo)?.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => onCall(l)}
                    className="p-2.5 bg-green-50 text-green-600 rounded-full shadow-sm active:scale-95 transition-all"
                  >
                    <Phone size={18} fill="currentColor" />
                  </button>
                  <button 
                    onClick={() => onNavigate('lead-detail', l.id)}
                    className="p-2.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded-full active:scale-95 transition-all"
                  >
                    <Eye size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#FDFAF2] border-b border-[#E6D8B8]">
                <th className="px-6 py-4 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className="text-[#C9A84C] hover:scale-110 transition-transform"
                  >
                    {selectedIds.length === filteredLeads.length && filteredLeads.length > 0 
                      ? <CheckSquare size={20} /> 
                      : <Square size={20} />
                    }
                  </button>
                </th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Details</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Follow-up</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider text-center">Owner</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Source</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Quality</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lifecycle</th>
                <th className="px-6 py-4 text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D8B8]/50">
              {filteredLeads.map(l => (
                <tr key={l.id} className={cn("hover:bg-[#FEFCF5] transition-colors", selectedIds.includes(l.id) && "bg-[#C9A84C]/5")}>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleSelect(l.id)}
                      className="text-[#C9A84C] hover:scale-110 transition-transform"
                    >
                      {selectedIds.includes(l.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[13.5px]">{l.name}</p>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(s => (
                          <Star key={s} size={10} className={cn((l.priority || 0) >= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200")} />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-green-600 text-[11.5px] font-medium flex items-center gap-1">
                        <Phone size={10} /> {l.mobile}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <FollowUpStatusBadge 
                      status={getFollowUpDisplayStatus(getLeadFollowUp(followUps, l.id, undefined, visits))}
                      date={getLeadFollowUp(followUps, l.id, undefined, visits)?.date}
                      isLost={l.status === 'lost'}
                      onClick={() => onNavigate('lead-detail', l.id)}
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 border border-amber-200">
                        {users.find(u => u.id === l.assignedTo)?.name?.[0] || '?'}
                      </div>
                      <span className="text-[10px] font-bold text-[#2A1C00] truncate max-w-[80px]">
                        {users.find(u => u.id === l.assignedTo)?.name || 'Unassigned'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] font-medium text-[#5C4820] bg-[#F5EDD4] px-2 py-0.5 rounded-md">
                      {l.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td className="px-6 py-4">
                    <LeadQualityBadge quality={l.quality} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      <div className="text-blue-600" title="Visits Planned/Done">
                        📅 {l.stats?.visits_planned || 0}/{l.stats?.visits_done || 0}
                      </div>
                      <div className="text-green-600" title="Calls Attempted/Answered">
                        📞 {l.stats?.calls_attempted || 0}/{l.stats?.calls_answered || 0}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => onCall(l)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Call"
                      >
                        <Phone size={18} />
                      </button>
                      <button 
                        onClick={() => onWhatsApp(l)}
                        className="p-2 text-[#25D366] hover:bg-[#25D366]/10 rounded-lg transition-colors"
                        title="WhatsApp"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button 
                        onClick={() => onNavigate('lead-detail', l.id)}
                        className="p-2 text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-[#9A8262] italic text-sm">
                    No leads found. Start by adding one or setting up a webhook.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);
});

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const styles: any = {
    new: 'bg-blue-600 text-white shadow-sm',
    contacted: 'bg-orange-50 text-orange-600',
    visit_scheduled: 'bg-purple-50 text-purple-600',
    visit_done: 'bg-green-600 text-white shadow-sm',
    closed: 'bg-green-600 text-white shadow-sm',
    lost: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", styles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
}

function LeadQualityBadge({ quality }: { quality: LeadQuality }) {
  const styles: any = {
    hot: 'bg-red-50 text-red-600',
    warm: 'bg-orange-50 text-orange-600',
    cold: 'bg-blue-600 text-white shadow-sm',
    pending: 'bg-gray-50 text-gray-400',
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", styles[quality])}>
      {quality}
    </span>
  );
}
