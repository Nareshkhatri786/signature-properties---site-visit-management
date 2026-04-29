import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Phone, 
  MessageSquare,
  ChevronRight,
  User,
  Star
} from 'lucide-react';
import { FollowUp, Lead, Visit, Page, VisitFilters, User as UserType } from '../types';
import { cn, getLocalDateString } from '../lib/utils';
// Import the badge component we updated earlier
import { FollowUpStatusBadge } from './FollowUpStatusBadge';

interface FollowUpListProps {
  followUps: FollowUp[];
  leads: Lead[];
  visits: Visit[];
  user: UserType;
  onUpdateStatus: (id: string, status: 'completed' | 'cancelled', note?: string) => void;
  onNavigate: (page: Page, id?: string, filters?: VisitFilters) => void;
  onCall: (v: Visit | Lead) => void;
}

export default function FollowUpList({ followUps, leads, visits, user, onUpdateStatus, onNavigate, onCall }: FollowUpListProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled' | 'overdue' | 'today' | 'upcoming'>('pending');
  const [search, setSearch] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'completed' | 'cancelled' | null>(null);
  const [note, setNote] = useState('');

  const today = getLocalDateString();

  const filteredFollowUps = followUps
    .filter(f => {
      if (filter === 'overdue') return f.status === 'pending' && f.date < today;
      if (filter === 'today') return f.status === 'pending' && f.date === today;
      if (filter === 'upcoming') return f.status === 'pending' && f.date > today;
      if (filter !== 'all' && f.status !== filter) return false;
      
      const lead = leads.find(l => l.id === f.leadId);
      const visit = visits.find(v => v.id === f.visitId);
      const clientName = lead?.name || visit?.client_name || '';
      
      return clientName.toLowerCase().includes(search.toLowerCase()) || 
             f.purpose.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const leadA = leads.find(l => l.id === a.leadId);
      const visitA = visits.find(v => v.id === a.visitId);
      const priA = leadA?.priority || visitA?.priority || 0;
      const leadB = leads.find(l => l.id === b.leadId);
      const visitB = visits.find(v => v.id === b.visitId);
      const priB = leadB?.priority || visitB?.priority || 0;

      if (priA !== priB) return priB - priA;
      return a.date.localeCompare(b.date);
    });

  const stats = {
    today: followUps.filter(f => f.status === 'pending' && f.date === today).length,
    overdue: followUps.filter(f => f.status === 'pending' && f.date < today).length,
    upcoming: followUps.filter(f => f.status === 'pending' && f.date > today).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['overdue', 'today', 'upcoming'].map((type) => (
          <button 
            key={type}
            onClick={() => setFilter(type as any)}
            className={cn(
              "border p-4 rounded-xl flex items-center gap-4 transition-all hover:shadow-md text-left w-full",
              type === 'overdue' ? "bg-red-50 border-red-100" : type === 'today' ? "bg-blue-50 border-blue-100" : "bg-green-50 border-green-100",
              filter === type && "ring-2 ring-offset-1 ring-current"
            )}
          >
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", 
              type === 'overdue' ? "bg-red-100 text-red-600" : type === 'today' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600")}>
              {type === 'overdue' ? <AlertCircle size={20} /> : type === 'today' ? <Calendar size={20} /> : <Clock size={20} />}
            </div>
            <div>
              <p className="text-2xl font-bold">{stats[type as keyof typeof stats]}</p>
              <p className="text-[11px] uppercase font-bold tracking-wider opacity-70">{type}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#FFFDF6] border border-[#E6D8B8] p-4 rounded-xl shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" size={16} />
          <input 
            type="text" 
            placeholder="Search by client or purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#C9A84C]"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['pending', 'completed', 'cancelled', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                filter === s ? "bg-[#C9A84C] text-white" : "bg-white border border-[#E6D8B8] text-[#9A8262]"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List Items */}
      <div className="space-y-4">
        {filteredFollowUps.length > 0 ? filteredFollowUps.map(f => {
          const lead = leads.find(l => l.id === f.leadId);
          const visit = visits.find(v => v.id === f.visitId);
          
          const clientName = lead?.name || visit?.client_name || 'Unknown Client';
          const quality = lead?.quality || visit?.status || 'pending';
          
          // Determine logic for the Badge
          const isLost = lead?.quality === 'disq' || lead?.status === 'lost';
          const visitStatus = visit?.visit_status; 
          
          const displayStatus = f.status === 'completed' ? 'completed' : 
                                f.date < today ? 'overdue' : 
                                f.date === today ? 'today' : 'upcoming';

          return (
            <div key={f.id} className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Reuse our smart badge here */}
                  <FollowUpStatusBadge 
                    status={displayStatus as any}
                    date={f.date}
                    isLost={isLost}
                    visitStatus={visitStatus}
                    className="shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-[#2A1C00] truncate">{clientName}</h4>
                      <QualityBadge quality={quality} />
                    </div>
                    <p className="text-sm text-[#5C4820] line-clamp-1">{f.purpose}</p>
                    <div className="flex gap-3 mt-2">
                      <span className="text-[10px] text-[#9A8262] font-bold uppercase flex items-center gap-1">
                        <User size={10} /> {lead ? 'Lead' : 'Visit'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => onCall(lead || visit!)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Phone size={18} /></button>
                  <button onClick={() => onNavigate('whatsapp', f.visitId || f.leadId)} className="p-2 text-[#25D366] hover:bg-green-50 rounded-lg"><MessageSquare size={18} /></button>
                  
                  {f.status === 'pending' && !isLost && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onUpdateStatus(f.id, 'completed')}
                        className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    </div>
                  )}
                  
                  <button onClick={() => onNavigate(lead ? 'lead-detail' : 'detail', lead?.id || visit?.id)} className="p-2 text-[#C9A84C]"><ChevronRight size={18} /></button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] border-dashed rounded-xl p-12 text-center">
            <Calendar className="mx-auto text-[#E6D8B8] mb-4" size={48} />
            <p className="text-[#9A8262] font-medium">No follow-ups found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const styles: Record<string, string> = {
    hot: 'bg-red-50 text-red-600 border-red-100',
    warm: 'bg-orange-50 text-orange-600 border-orange-100',
    cold: 'bg-blue-50 text-blue-600 border-blue-100',
    pending: 'bg-purple-50 text-purple-600 border-purple-100',
    disq: 'bg-gray-50 text-gray-500 border-gray-100',
  };
  return (
    <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider", styles[quality] || styles.pending)}>
      {quality}
    </span>
  );
}