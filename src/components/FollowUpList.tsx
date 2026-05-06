import React, { useState, useMemo } from 'react';
import { 
  Calendar, Clock, AlertCircle, CheckCircle2, XCircle, Search, Phone, MessageSquare, 
  ChevronRight, User, Star, MoreVertical, Plus, Settings, Filter, PieChart as PieChartIcon, 
  Download, RefreshCw, Bell, BellRing, ChevronDown, CheckSquare, Users, Edit3, Zap
} from 'lucide-react';
import { FollowUp, Lead, Visit, Page, VisitFilters, User as UserType } from '../types';
import { cn, getLocalDateString } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';

interface FollowUpListProps {
  followUps: FollowUp[];
  leads: Lead[];
  visits: Visit[];
  user: UserType;
  users?: UserType[];
  onUpdateStatus: (id: string, status: 'completed' | 'cancelled', note?: string) => void;
  onNavigate: (page: Page, id?: string, filters?: VisitFilters) => void;
  onCall: (v: Visit | Lead) => void;
}

type TabType = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed' | 'cancelled';

export default function FollowUpList({ followUps, leads, visits, user, users = [], onUpdateStatus, onNavigate, onCall }: FollowUpListProps) {
  const [filter, setFilter] = useState<TabType>('pending' as any); // using 'pending' initially, we'll map tabs properly
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  const today = getLocalDateString();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'adm';

  const processedData = useMemo(() => {
    return followUps.map(f => {
      const lead = leads.find(l => l.id === f.leadId);
      const visit = visits.find(v => v.id === f.visitId);
      const clientName = lead?.name || visit?.client_name || 'Unknown Client';
      const phone = lead?.mobile || visit?.mobile || '';
      const source = lead?.source || visit?.source || 'Manual';
      const quality = (lead?.quality || visit?.status || 'normal').toLowerCase();
      
      const priorityStr = quality === 'hot' ? 'HOT' : quality === 'warm' ? 'WARM' : 'NORMAL';
      
      let statusGroup: TabType = 'upcoming';
      if (f.status === 'completed') statusGroup = 'completed';
      else if (f.status === 'cancelled') statusGroup = 'cancelled';
      else if (f.date < today) statusGroup = 'overdue';
      else if (f.date === today) statusGroup = 'today';
      
      const daysOverdue = statusGroup === 'overdue' ? Math.abs(differenceInDays(new Date(), parseISO(f.date))) : 0;
      
      let stage = lead?.status || visit?.visit_status || 'New Lead';
      if (stage === 'visit_scheduled') stage = 'Site Visit Pending';
      else if (stage === 'visit_done') stage = 'Site Visit Done';
      else if (stage === 'new') stage = 'New Lead';
      
      // Last contact
      const lastContactDate = lead?.updated_at || visit?.updated_at;
      
      return {
        ...f, clientName, phone, source, priorityStr, statusGroup, daysOverdue, stage,
        lead, visit, lastContactDate, quality
      };
    }).sort((a, b) => {
      // Sort by overdue first, then date
      if (a.statusGroup === 'overdue' && b.statusGroup !== 'overdue') return -1;
      if (b.statusGroup === 'overdue' && a.statusGroup !== 'overdue') return 1;
      if (a.statusGroup === 'overdue' && b.statusGroup === 'overdue') return b.daysOverdue - a.daysOverdue;
      return a.date.localeCompare(b.date);
    });
  }, [followUps, leads, visits, today]);

  const filteredData = useMemo(() => {
    return processedData.filter(f => {
      if (activeTab !== 'all' && f.statusGroup !== activeTab) return false;
      
      if (assigneeFilter === 'me' && f.userId !== user.id) return false;
      if (assigneeFilter !== 'all' && assigneeFilter !== 'me' && f.userId?.toString() !== assigneeFilter) return false;
      
      if (priorityFilter !== 'all' && f.priorityStr !== priorityFilter) return false;
      
      if (search) {
        const q = search.toLowerCase();
        return f.clientName.toLowerCase().includes(q) || 
               f.phone.includes(q) || 
               f.purpose.toLowerCase().includes(q);
      }
      return true;
    });
  }, [processedData, activeTab, search, assigneeFilter, priorityFilter, user.id]);

  const stats = {
    all: processedData.length,
    overdue: processedData.filter(f => f.statusGroup === 'overdue').length,
    today: processedData.filter(f => f.statusGroup === 'today').length,
    upcoming: processedData.filter(f => f.statusGroup === 'upcoming').length,
    completed: processedData.filter(f => f.statusGroup === 'completed').length,
    cancelled: processedData.filter(f => f.statusGroup === 'cancelled').length,
    hotOverdue: processedData.filter(f => f.statusGroup === 'overdue' && f.priorityStr === 'HOT').length,
    warmOverdue: processedData.filter(f => f.statusGroup === 'overdue' && f.priorityStr === 'WARM').length,
  };

  const pieData = [
    { name: 'Overdue', value: stats.overdue, color: '#ef4444' },
    { name: 'Today', value: stats.today, color: '#3b82f6' },
    { name: 'Upcoming', value: stats.upcoming, color: '#22c55e' }
  ].filter(d => d.value > 0);
  
  const totalPending = stats.overdue + stats.today + stats.upcoming;

  const getPriorityColors = (p: string) => {
    if (p === 'HOT') return 'border-l-red-500 text-red-600 bg-red-50';
    if (p === 'WARM') return 'border-l-orange-500 text-orange-600 bg-orange-50';
    return 'border-l-green-500 text-green-600 bg-green-50';
  };

  const getStageBadge = (stage: string) => {
    if (stage.includes('Pending') || stage.includes('scheduled')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (stage.includes('Done') || stage.includes('completed')) return 'bg-green-50 text-green-700 border-green-200';
    if (stage.includes('Interested') || stage.includes('Quote')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (stage.includes('Negotiation')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 max-w-[1600px] mx-auto pb-12">
      
      {/* Main Content (Left) */}
      <div className="flex-1 space-y-6 min-w-0">
        
        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => setActiveTab('overdue')} className={cn("bg-red-50 border border-red-100 rounded-xl p-4 text-left transition-all hover:shadow-md", activeTab === 'overdue' && "ring-2 ring-red-400")}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={20} className="text-red-500" />
              <span className="text-3xl font-bold text-red-950">{stats.overdue}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-800 mb-2">Overdue</p>
            <div className="flex items-center gap-3 text-[10px] font-bold text-red-600">
              <span className="flex items-center gap-1"><Star size={10} className="fill-current" /> {stats.hotOverdue} Hot</span>
              <span className="flex items-center gap-1"><AlertCircle size={10} /> {stats.warmOverdue} Warm</span>
            </div>
          </button>

          <button onClick={() => setActiveTab('today')} className={cn("bg-blue-50 border border-blue-100 rounded-xl p-4 text-left transition-all hover:shadow-md", activeTab === 'today' && "ring-2 ring-blue-400")}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={20} className="text-blue-500" />
              <span className="text-3xl font-bold text-blue-950">{stats.today}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-2">Today</p>
            <p className="text-[10px] font-bold text-blue-600">Due today</p>
          </button>

          <button onClick={() => setActiveTab('upcoming')} className={cn("bg-green-50 border border-green-100 rounded-xl p-4 text-left transition-all hover:shadow-md", activeTab === 'upcoming' && "ring-2 ring-green-400")}>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={20} className="text-green-500" />
              <span className="text-3xl font-bold text-green-950">{stats.upcoming}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-800 mb-2">Upcoming</p>
            <p className="text-[10px] font-bold text-green-600">Next 7 days & beyond</p>
          </button>

          <button onClick={() => setActiveTab('completed')} className={cn("bg-purple-50 border border-purple-100 rounded-xl p-4 text-left transition-all hover:shadow-md", activeTab === 'completed' && "ring-2 ring-purple-400")}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={20} className="text-purple-500" />
              <span className="text-3xl font-bold text-purple-950">{stats.completed}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800 mb-2">Completed</p>
            <p className="text-[10px] font-bold text-purple-600">All time</p>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white border border-[#E6D8B8] rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" size={16} />
            <input 
              type="text" 
              placeholder="Search by client, phone or purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#FDFAF2] border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C]"
            />
          </div>
          
          <select 
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-[#FDFAF2] border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm text-[#2A1C00] font-medium outline-none focus:border-[#C9A84C]"
          >
            <option value="all">All Users</option>
            <option value="me">Assigned to me</option>
            {isAdmin && users.filter(u => u.id !== user.id).map(u => (
              <option key={u.id} value={u.id.toString()}>{u.name}</option>
            ))}
          </select>

          <select 
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#FDFAF2] border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm text-[#2A1C00] font-medium outline-none focus:border-[#C9A84C]"
          >
            <option value="all">All Priorities</option>
            <option value="HOT">Hot Leads</option>
            <option value="WARM">Warm Leads</option>
            <option value="NORMAL">Normal Leads</option>
          </select>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#E6D8B8] flex gap-6 overflow-x-auto custom-scrollbar">
          {(['all', 'overdue', 'today', 'upcoming', 'completed', 'cancelled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-colors relative",
                activeTab === tab ? "text-[#2A1C00]" : "text-[#9A8262] hover:text-[#C9A84C]"
              )}
            >
              {tab} ({stats[tab]})
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C] rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Table/List View */}
        <div className="bg-white border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-[#FDFAF2] border-b border-[#E6D8B8]">
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider w-24">Priority</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Lead / Details</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Next Action</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Follow-Up</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Last Contact</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A8262] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D8B8]/30">
                {filteredData.length > 0 ? filteredData.map(f => (
                  <tr key={f.id} className="hover:bg-[#FFFDF6] transition-colors group">
                    <td className="px-0 py-3 relative">
                      <div className={cn("absolute left-0 top-3 bottom-3 border-l-[3px]", getPriorityColors(f.priorityStr))} />
                      <div className="pl-4 flex flex-col items-center justify-center text-center">
                        {f.priorityStr === 'HOT' && <Star size={14} className="text-red-500 fill-red-500 mb-1" />}
                        {f.priorityStr === 'WARM' && <AlertCircle size={14} className="text-orange-500 mb-1" />}
                        {f.priorityStr === 'NORMAL' && <CheckCircle2 size={14} className="text-green-500 mb-1" />}
                        <span className={cn("text-[9px] font-black tracking-widest", f.priorityStr === 'HOT' ? 'text-red-600' : f.priorityStr === 'WARM' ? 'text-orange-600' : 'text-green-600')}>{f.priorityStr}</span>
                        {f.statusGroup === 'overdue' && <span className="text-[8px] font-bold text-red-500 mt-0.5">{f.daysOverdue} DAYS OVERDUE</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[#2A1C00] cursor-pointer hover:text-[#C9A84C]" onClick={() => onNavigate(f.lead ? 'lead-detail' : 'detail', f.leadId || f.visitId)}>{f.clientName}</span>
                        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", getPriorityColors(f.priorityStr))}>{f.priorityStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#5C4820] font-medium mb-1">
                        {f.phone}
                        <MessageSquare size={12} className="text-green-500 ml-1 cursor-pointer" onClick={() => onNavigate('whatsapp', f.leadId || f.visitId)} />
                      </div>
                      <p className="text-[10px] text-[#9A8262]">Source: {f.source}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-md border", getStageBadge(f.stage))}>
                        {f.stage.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-[#2A1C00] mb-1">
                        {f.method === 'call' ? <Phone size={14} className="text-[#C9A84C]" /> : <MessageSquare size={14} className="text-[#C9A84C]" />}
                        {f.method === 'call' ? 'Call' : 'WhatsApp'}
                      </div>
                      <div className={cn("text-xs font-bold", f.statusGroup === 'overdue' ? 'text-red-500' : f.statusGroup === 'today' ? 'text-blue-500' : 'text-[#9A8262]')}>
                        {f.statusGroup === 'today' ? 'Today' : f.statusGroup === 'overdue' ? 'Overdue' : format(parseISO(f.date), 'dd MMM yyyy')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2A1C00] mb-1">
                        <Calendar size={14} className="text-[#9A8262]" />
                        {format(parseISO(f.date), 'dd MMM yyyy')}
                      </div>
                      {f.statusGroup === 'overdue' && <p className="text-[10px] font-bold text-red-500">Overdue by {f.daysOverdue} days</p>}
                      {f.status === 'completed' && f.completed_at && <p className="text-[10px] font-bold text-green-600">Done: {format(parseISO(f.completed_at), 'dd MMM')}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700">
                          {(f.userName || 'U')[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#2A1C00]">{f.userName || 'Unassigned'}</p>
                          <p className="text-[10px] text-[#9A8262]">Sales Executive</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {f.lastContactDate ? (
                        <>
                          <p className="text-xs font-semibold text-[#2A1C00]">{format(parseISO(f.lastContactDate), 'dd MMM yyyy')}</p>
                          <p className="text-[10px] text-[#9A8262]">{differenceInDays(new Date(), parseISO(f.lastContactDate))} days ago</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-[#9A8262]">No prior contact</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onCall(f.lead || f.visit!)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Phone size={16} /></button>
                        <button onClick={() => onNavigate('whatsapp', f.leadId || f.visitId)} className="p-1.5 text-[#25D366] hover:bg-green-50 rounded-lg transition-colors"><MessageSquare size={16} /></button>
                        {f.status === 'pending' && (
                          <button onClick={() => onUpdateStatus(f.id, 'completed')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Mark Done"><CheckCircle2 size={16} /></button>
                        )}
                        <button className="p-1.5 text-[#9A8262] hover:bg-[#F5F1E6] rounded-lg transition-colors"><MoreVertical size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FDFAF2] border border-[#E6D8B8] mb-4">
                        <Calendar className="text-[#C9A84C]" size={24} />
                      </div>
                      <p className="text-lg font-bold text-[#2A1C00]">No follow-ups found</p>
                      <p className="text-sm text-[#9A8262]">Try adjusting your filters or search terms.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-4 py-3 border-t border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
            <span className="text-xs text-[#9A8262] font-semibold">Showing {filteredData.length} entries</span>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-white border border-[#E6D8B8] rounded text-xs font-bold text-[#9A8262] hover:bg-[#F5F1E6]">Prev</button>
              <button className="px-3 py-1 bg-[#C9A84C] border border-[#C9A84C] rounded text-xs font-bold text-white shadow-sm">1</button>
              <button className="px-3 py-1 bg-white border border-[#E6D8B8] rounded text-xs font-bold text-[#9A8262] hover:bg-[#F5F1E6]">Next</button>
            </div>
          </div>
        </div>

      </div>

      {/* Right Sidebar */}
      <div className="w-full xl:w-80 space-y-6">
        
        {/* Quick Follow Up Summary Donut */}
        <div className="bg-white border border-[#E6D8B8] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#2A1C00] uppercase tracking-wider mb-4 flex items-center gap-2">
            <PieChartIcon size={16} className="text-[#C9A84C]" /> Follow Up Summary
          </h3>
          
          <div className="relative h-40 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData.length ? pieData : [{value:1, color:'#e5e7eb'}]} innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                  {(pieData.length ? pieData : [{value:1, color:'#e5e7eb'}]).map((e: any, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-[#2A1C00]">{totalPending}</span>
              <span className="text-[10px] font-bold text-[#9A8262] uppercase tracking-widest">Total</span>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { label: 'Overdue', value: stats.overdue, color: 'bg-red-500' },
              { label: 'Today', value: stats.today, color: 'bg-blue-500' },
              { label: 'Upcoming', value: stats.upcoming, color: 'bg-green-500' }
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", item.color)} />
                  <span className="font-semibold text-[#5C4820]">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#2A1C00]">({item.value})</span>
                  <span className="text-[#9A8262] w-8 text-right">{totalPending ? Math.round((item.value / totalPending) * 100) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-[#E6D8B8] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#2A1C00] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Zap size={16} className="text-[#C9A84C]" /> Quick Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#FDFAF2] text-sm font-bold text-[#5C4820] transition-colors group border border-transparent hover:border-[#E6D8B8]">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors"><Plus size={16} className="text-blue-600" /></div>
              Add New Follow Up
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#FDFAF2] text-sm font-bold text-[#5C4820] transition-colors group border border-transparent hover:border-[#E6D8B8]">
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors"><CheckSquare size={16} className="text-green-600" /></div>
              Bulk Mark as Completed
            </button>
            {isAdmin && (
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#FDFAF2] text-sm font-bold text-[#5C4820] transition-colors group border border-transparent hover:border-[#E6D8B8]">
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors"><RefreshCw size={16} className="text-orange-600" /></div>
                Reassign Follow Ups
              </button>
            )}
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#FDFAF2] text-sm font-bold text-[#5C4820] transition-colors group border border-transparent hover:border-[#E6D8B8]">
              <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors"><Download size={16} className="text-purple-600" /></div>
              Export Follow Ups
            </button>
          </div>
        </div>

        {/* Smart Alerts */}
        <div className="bg-white border border-[#E6D8B8] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#2A1C00] uppercase tracking-wider mb-4 flex items-center gap-2">
            <BellRing size={16} className="text-[#C9A84C]" /> Smart Alerts
          </h3>
          <div className="space-y-3">
            {stats.hotOverdue > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-900">{stats.hotOverdue} hot leads are overdue!</p>
                  <p className="text-[10px] text-red-700 mt-0.5">High risk of dropping out.</p>
                </div>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
              <Users size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-900">12 leads have no follow-up scheduled</p>
                <p className="text-[10px] text-blue-700 mt-0.5">Keep them engaged.</p>
              </div>
            </div>
            {isAdmin && (
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex items-start gap-3">
                <RefreshCw size={16} className="text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-orange-900">8 leads to reassign</p>
                  <p className="text-[10px] text-orange-700 mt-0.5">(Overdue &gt; 3 days)</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Automation */}
        <div className="bg-white border border-[#E6D8B8] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#2A1C00] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Settings size={16} className="text-[#C9A84C]" /> Automation
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#9A8262]" />
                <span className="text-sm font-bold text-[#5C4820]">Auto Reminders</span>
              </div>
              <div className="w-10 h-5 bg-green-500 rounded-full relative cursor-pointer shadow-inner">
                <div className="absolute right-1 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-[#9A8262]" />
                <span className="text-sm font-bold text-[#5C4820]">Auto WhatsApp</span>
              </div>
              <div className="w-10 h-5 bg-green-500 rounded-full relative cursor-pointer shadow-inner">
                <div className="absolute right-1 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}