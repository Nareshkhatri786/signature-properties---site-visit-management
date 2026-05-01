import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Phone, 
  Calendar, 
  Clock, 
  MessageSquare, 
  UserCircle, 
  TrendingUp, 
  CheckCircle2, 
  XCircle,
  Plus,
  CalendarCheck,
  History as HistoryIcon,
  Mail,
  MapPin,
  ExternalLink,
  Bell,
  Ban,
  X,
  Save,
  Sparkles,
  ArrowRightLeft,
  Star
} from 'lucide-react';
import { Lead, Visit, Remark, CallLog, Page, LeadStatus, LeadQuality, FollowUp, CallOutcome, Project, User, RemarkCategory, RemarkSentiment, Activity, ActivityType, WhatsAppMessage } from '../types';
import { cn } from '../lib/utils';
import { StatusBadge, VisitBadge } from './Dashboard';
import FollowUpForm from './FollowUpForm';
import ActivityTimeline from './ActivityTimeline';
import WhatsAppHistory from './WhatsAppHistory';
import { toast } from 'react-hot-toast';
import { generateId } from '../lib/storage';
import { apiService } from '../lib/api-service';
import { format, isToday } from 'date-fns';
import { normalizePhoneNumber } from '../lib/phoneUtils';
import { getLeadFollowUp, getFollowUpDisplayStatus } from '../lib/followupUtils';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';

interface LeadDetailProps {
  user: User;
  lead: Lead;
  visits: Visit[];
  remarks: Remark[]; // We still take this as initial but we will sync locally
  callLogs: CallLog[];
  followUps: FollowUp[];
  onUpdateFollowUp: (id: string, updates: Partial<FollowUp>) => void;
  projects: Project[];
  users: User[];
  onUpdateLead: (lead: Lead) => void;
  onAddVisit: (lead: Lead) => void;
  onAddFollowUp: (followUp: FollowUp) => void;
  onAddRemark: (remark: Remark) => void;
  onAIScore: () => void;
  onCall: (lead: Lead) => void;
  onWhatsApp: (lead: Lead) => void;
  onLogCallOutcome: (outcome: CallOutcome, note?: string) => void;
  onNavigate: (page: Page, id?: string) => void;
  onTransferLead: (leadId: string, projectId: string) => void;
}

export default React.memo(function LeadDetail({ user, lead, visits, remarks: initialRemarks, callLogs, followUps, projects, users, onUpdateLead, onAddVisit, onAddFollowUp, onUpdateFollowUp, onAddRemark, onAIScore, onCall, onWhatsApp, onLogCallOutcome, onNavigate, onTransferLead }: LeadDetailProps) {
  const [syncedRemarks, setSyncedRemarks] = useState<Remark[]>(initialRemarks);
  const [syncedActivities, setSyncedActivities] = useState<Activity[]>([]);
  const [syncedWhatsApp, setSyncedWhatsApp] = useState<WhatsAppMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'whatsapp'>('timeline');
  
  useEffect(() => {
    if (!lead.id) return;
    
    // Fetch Remarks
    apiService.getRemarks(lead.id).then((data: Remark[]) => {
      setSyncedRemarks(data.sort((a, b) => b.at.localeCompare(a.at)));
    }).catch(console.error);

    // Fetch Activities
    apiService.getActivities(lead.id).then((data: Activity[]) => {
      setSyncedActivities(data);
    }).catch(console.error);

    // Fetch WhatsApp Messages
    apiService.getWhatsAppMessages(lead.id).then((data: WhatsAppMessage[]) => {
      setSyncedWhatsApp(data);
    }).catch(console.error);
  }, [lead.id]);

  const logActivity = (type: ActivityType, details?: string) => {
    const activity: Activity = {
      id: generateId(),
      type,
      userId: user.id,
      userName: user.name,
      projectId: lead.projectId,
      targetId: lead.id,
      targetName: lead.name,
      timestamp: new Date().toISOString(),
      details: details || ''
    };
    setSyncedActivities(prev => [activity, ...prev]);
    apiService.save('activities', activity).catch(console.error);
  };

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [callNote, setCallNote] = useState('');
  
  // Remark state
  const [remarkText, setRemarkText] = useState('');
  const [remarkCategory, setRemarkCategory] = useState<RemarkCategory>('general');
  const [remarkSentiment, setRemarkSentiment] = useState<RemarkSentiment>('neutral');

  const handleUpdateStatus = (field: 'status' | 'quality', value: string) => {
    if (lead[field] === value) return;
    const oldVal = lead[field];
    onUpdateLead({ ...lead, [field]: value, updated_at: new Date().toISOString() });
    logActivity(field === 'status' ? 'lead_status_changed' : 'lead_quality_changed', `Changed ${field} from ${oldVal} to ${value}`);
  };

  const handleAddRemark = () => {
    if (!remarkText.trim()) return;
    const newRemark: Remark = {
      id: generateId(),
      text: remarkText,
      by: user.name,
      at: new Date().toISOString(),
      type: 'remark',
      category: remarkCategory,
      sentiment: remarkSentiment
    };
    setSyncedRemarks(prev => [newRemark, ...prev]);
    apiService.saveRemark(lead.id, newRemark).catch(console.error);
    onAddRemark(newRemark);
    setRemarkText('');
    toast.success('Note added to timeline');
  };

  const nextFollowUp = getLeadFollowUp(followUps, lead.id, undefined, visits);
  const followUpStatus = getFollowUpDisplayStatus(nextFollowUp);

  const nextScheduledVisit = visits
    .filter(v => v.visit_status === 'scheduled' || v.visit_status === 'rescheduled')
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0];

  const lastVisit = visits
    .filter(v => v.visit_status === 'completed' || v.visit_status === 'cancelled')
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date))[0];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('leads')} className="p-2 hover:bg-[#C9A84C]/10 rounded-full text-[#9A8262]">
            <ArrowLeft size={24} />
          </button>
          <div>
            {isEditMode ? (
              <div className="flex flex-col gap-2">
                <input 
                  type="text"
                  value={editedLead.name}
                  onChange={(e) => setEditedLead({ ...editedLead, name: e.target.value })}
                  className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] bg-white border border-[#E6D8B8] rounded px-2 py-1 focus:outline-none focus:border-[#C9A84C]"
                />
                <div className="flex gap-1">
                  {[1, 2, 3].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditedLead({ ...editedLead, priority: editedLead.priority === star ? 0 : star })}
                      className="transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star 
                        size={18} 
                        className={cn(
                          star <= (editedLead.priority || 0) 
                            ? "text-yellow-400 fill-yellow-400" 
                            : "text-gray-300"
                        )} 
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00]">{lead.name}</h2>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(s => (
                    <Star key={s} size={16} className={cn((lead.priority || 0) >= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200")} />
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              {isEditMode ? (
                <input 
                  type="tel"
                  value={editedLead.mobile}
                  onChange={(e) => setEditedLead({ ...editedLead, mobile: e.target.value })}
                  className="text-green-600 font-bold text-sm bg-white border border-[#E6D8B8] rounded px-2 focus:outline-none focus:border-[#C9A84C]"
                />
              ) : (
                <span className="text-green-600 font-bold text-sm">{lead.mobile}</span>
              )}
              <span className="text-[#9A8262] text-xs">• Source: {lead.source}</span>
              <div className="flex items-center gap-1">
                <span className="text-[#9A8262] text-xs">• Assigned:</span>
                {user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'adm' ? (
                  <select
                    value={lead.assignedTo || ''}
                    onChange={(e) => {
                      const newUserId = e.target.value === '' ? null : Number(e.target.value);
                      const newUserObj = users.find(u => u.id === newUserId);
                      onUpdateLead({ ...lead, assignedTo: newUserId as any });
                      logActivity('lead_updated', `Reassigned to ${newUserObj?.name || 'Unassigned'}`);
                      toast.success(`Lead assigned to ${newUserObj?.name || 'Unassigned'}`);
                    }}
                    className="text-[#C9A84C] font-bold text-[11px] bg-transparent border-none focus:ring-0 cursor-pointer hover:underline"
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[#C9A84C] font-bold text-xs ml-1">
                    {users.find(u => u.id === lead.assignedTo)?.name || 'Unassigned'}
                  </span>
                )}
              </div>
            </div>
            {/* Follow-up & Scheduled Visit Highlight */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="bg-[#FFFDF6] border border-[#E6D8B8] px-3 py-2 rounded-xl shadow-sm flex items-center gap-3">
                <span className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Next Follow-up:</span>
                <FollowUpStatusBadge 
                  status={followUpStatus}
                  date={nextFollowUp?.date}
                  isLost={lead.status === 'lost'}
                  onClick={() => setIsFollowUpModalOpen(true)}
                />
                {nextFollowUp?.purpose && (
                  <span className="text-xs text-[#5C4820] border-l border-[#E6D8B8] pl-3 italic truncate max-w-[200px]">
                    "{nextFollowUp.purpose}"
                  </span>
                )}
              </div>

              {nextScheduledVisit && (
                <div className="bg-[#F0F9FF] border border-blue-200 px-3 py-2 rounded-xl shadow-sm flex items-center gap-3">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                    <CalendarCheck size={12} /> Next Visit:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-900">
                      {new Date(nextScheduledVisit.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                    {nextScheduledVisit.visit_time && (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Clock size={10} /> {nextScheduledVisit.visit_time}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => onNavigate('detail', nextScheduledVisit.id)}
                    className="text-[10px] font-bold text-blue-600 hover:underline border-l border-blue-200 pl-3"
                  >
                    Reschedule
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditMode ? (
            <button 
              onClick={() => {
                const normalizedMobile = normalizePhoneNumber(editedLead.mobile);
                if (normalizedMobile.length < 13) {
                  toast.error('Please enter a valid 10-digit mobile number');
                  return;
                }
                const finalLead = { ...editedLead, mobile: normalizedMobile, updated_at: new Date().toISOString() };
                const changedFields = [];
                if (lead.name !== finalLead.name) changedFields.push(`Name to ${finalLead.name}`);
                if (lead.mobile !== finalLead.mobile) changedFields.push(`Mobile to ${finalLead.mobile}`);
                if (lead.priority !== finalLead.priority) changedFields.push(`Priority to ${finalLead.priority}`);
                
                onUpdateLead(finalLead);
                setIsEditMode(false);
                toast.success('Lead updated');
                if (changedFields.length > 0) {
                  logActivity('lead_updated', `Changed: ${changedFields.join(', ')}`);
                }
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-green-700 transition-all text-sm"
            >
              <Save size={18} /> Save Changes
            </button>
          ) : (
            <button 
              onClick={() => {
                setEditedLead(lead);
                setIsEditMode(true);
              }}
              className="bg-white border border-[#C9A84C] text-[#C9A84C] px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-[#FDF6E3] transition-all text-sm"
            >
              Edit Details
            </button>
          )}
          <button 
            onClick={() => {
              onCall(lead);
              // Small delay to ensure the user actually clicks the tel link before showing modal
              setTimeout(() => setIsLoggingCall(true), 2000);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-green-700 transition-all text-sm"
          >
            <Phone size={18} /> Call
          </button>
          <button 
            onClick={() => onWhatsApp(lead)}
            className="bg-[#25D366] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-[#1EBE55] transition-all text-sm"
          >
            <MessageSquare size={18} /> WhatsApp
          </button>
          <button 
            onClick={onAIScore}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:opacity-90 transition-all text-sm"
          >
            <Sparkles size={18} /> AI Score
          </button>
          <button 
            onClick={() => setIsLoggingCall(!isLoggingCall)}
            className={cn(
              "px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all text-sm",
              isLoggingCall 
                ? "bg-[#C9A84C] text-white" 
                : "bg-white border border-green-600 text-green-600 hover:bg-green-50"
            )}
          >
            <HistoryIcon size={18} /> {isLoggingCall ? 'Cancel Log' : 'Log Call'}
          </button>
          <button 
            onClick={() => onAddVisit(lead)}
            className="bg-[#C9A84C] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-[#B0923D] transition-all text-sm"
          >
            <CalendarCheck size={18} /> Schedule Site Visit
          </button>
          <div className="relative group">
            <button 
              onClick={() => setIsFollowUpModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-all text-sm"
            >
              <Bell size={18} /> Follow-up
            </button>
            {followUpStatus !== 'none' && (
              <div className="absolute -top-2 -right-2 transform translate-x-1/4 -translate-y-1/4">
                 <span className={cn(
                   "flex h-4 w-4 rounded-full border-2 border-white shadow-sm",
                   followUpStatus === 'overdue' ? "bg-red-500 animate-pulse" : 
                   followUpStatus === 'today' ? "bg-yellow-500" : 
                   followUpStatus === 'completed' ? "bg-green-500" : "bg-blue-500"
                 )} />
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-orange-700 transition-all text-sm"
          >
            <ArrowRightLeft size={18} /> Transfer
          </button>
        </div>
      </div>

      {/* Inline Call Logging Section */}
      {isLoggingCall && (
        <div className="bg-white border border-[#E6D8B8] rounded-xl p-6 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00]">Record Call Outcome</h3>
            <button onClick={() => setIsLoggingCall(false)} className="text-[#9A8262] hover:text-[#2A1C00]">
              <X size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Select Outcome</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'answered', label: 'Answered', icon: CheckCircle2, color: 'text-green-600', border: 'border-green-200' },
                  { value: 'not_answered', label: 'No Answer', icon: XCircle, color: 'text-red-600', border: 'border-red-200' },
                  { value: 'busy', label: 'Busy', icon: Clock, color: 'text-orange-600', border: 'border-orange-200' },
                  { value: 'switched_off', label: 'Off', icon: Ban, color: 'text-gray-600', border: 'border-gray-200' },
                ].map((outcome) => (
                  <button
                    key={outcome.value}
                    onClick={() => setSelectedOutcome(outcome.value as CallOutcome)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      selectedOutcome === outcome.value 
                        ? cn(outcome.border, "bg-white/50 ring-2 ring-[#C9A84C]/20") 
                        : "bg-white border-[#E6D8B8] hover:border-[#C9A84C]/50"
                    )}
                  >
                    <outcome.icon size={16} className={outcome.color} />
                    <span className="text-sm font-bold text-[#2A1C00]">{outcome.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Call Notes (Optional)</label>
              <textarea 
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                placeholder="What happened during the call?"
                className="w-full bg-white border border-[#E6D8B8] rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none h-[88px]"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button 
              onClick={() => setIsLoggingCall(false)}
              className="px-6 py-2 text-sm font-bold text-[#9A8262] hover:text-[#2A1C00]"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                if (!selectedOutcome) {
                  toast.error('Please select an outcome');
                  return;
                }
                onLogCallOutcome(selectedOutcome, callNote);
                setIsLoggingCall(false);
                setSelectedOutcome(null);
                setCallNote('');
              }}
              className="bg-[#C9A84C] text-white px-8 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#B0923D] transition-all shadow-sm"
            >
              <Save size={18} /> Save Call Log
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Info */}
        <div className="space-y-8">
          {/* Site Visit Summary */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] flex items-center gap-2">
                <CalendarCheck className="text-[#C9A84C]" size={18} />
                Visit Summary
              </h3>
              <button 
                onClick={() => onAddVisit(lead)}
                className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest hover:underline"
              >
                + New Visit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-[#E6D8B8]/50 rounded-xl p-4 text-center">
                <div className="text-xl font-black text-[#2A1C00]">{visits.length}</div>
                <div className="text-[9px] font-bold text-[#9A8262] uppercase tracking-wider">Total Visits</div>
              </div>
              <div className="bg-white border border-[#E6D8B8]/50 rounded-xl p-4 text-center text-xs">
                <div className="flex justify-center">
                  {lastVisit ? <VisitBadge status={lastVisit.visit_status} /> : <span className="text-[#9A8262]">No history</span>}
                </div>
                <div className="text-[9px] font-bold text-[#9A8262] uppercase tracking-wider mt-1">Last Status</div>
              </div>
              <div className="col-span-2 bg-[#FDFAF2] border border-[#E6D8B8]/50 rounded-xl p-4 flex items-center justify-between">
                 <div className="text-left">
                   <div className="text-[9px] font-bold text-[#9A8262] uppercase tracking-wider">Next Visit Date</div>
                   <div className="text-[13px] font-bold text-[#5C4820]">
                     {nextScheduledVisit ? format(new Date(nextScheduledVisit.visit_date), 'dd MMM yyyy') : 'No upcoming visit'}
                   </div>
                 </div>
                 {nextScheduledVisit && (
                   <button 
                     onClick={() => onNavigate('detail', nextScheduledVisit.id)}
                     className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest flex items-center gap-1"
                   >
                     Manage <Plus size={12} className="rotate-45" />
                   </button>
                 )}
              </div>
            </div>
          </div>

          {/* Lifecycle Stats */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-6 flex items-center gap-2">
              <TrendingUp className="text-[#C9A84C]" size={18} />
              Communication Performance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Calls Attempted" value={lead.stats?.calls_attempted || 0} icon={Phone} color="orange" />
              <StatBox label="Calls Answered" value={lead.stats?.calls_answered || 0} icon={CheckCircle2} color="green" />
            </div>
          </div>

          {/* Status Controls */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Manage Status</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Status</label>
                <select 
                  value={lead.status}
                  onChange={(e) => handleUpdateStatus('status', e.target.value)}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="new">🆕 New</option>
                  <option value="contacted">📞 Contacted</option>
                  <option value="visit_scheduled">📅 Visit Scheduled</option>
                  <option value="visit_done">✅ Visit Done</option>
                  <option value="closed">🤝 Closed</option>
                  <option value="lost">❌ Lost</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Quality</label>
                <select 
                  value={lead.quality}
                  onChange={(e) => handleUpdateStatus('quality', e.target.value)}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">🌡️ Warm</option>
                  <option value="cold">❄️ Cold</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="disq">❌ Disqualified</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Assign To</label>
                <select 
                  value={lead.assignedTo || ''}
                  onChange={(e) => onUpdateLead({ ...lead, assignedTo: e.target.value ? Number(e.target.value) : undefined, updated_at: new Date().toISOString() })}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {users.filter(u => u.projectId === lead.projectId || u.role === 'admin').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Notes */}
        <div className="lg:col-span-2 space-y-8">
          {/* Add Remark Section */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-4 flex items-center gap-2">
              <MessageSquare className="text-[#C9A84C]" size={18} />
              Expert Notes
            </h3>
            
            <div className="space-y-4">
              <textarea 
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                placeholder="What did the client say? Be specific about property needs or objections..."
                className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none h-[100px]"
              />
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Note Category</label>
                  <select 
                    value={remarkCategory}
                    onChange={(e) => setRemarkCategory(e.target.value as RemarkCategory)}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                  >
                    <option value="general">General Note</option>
                    <option value="price">Price/Budget discussed</option>
                    <option value="location">Location feedback</option>
                    <option value="amenities">Amentities/Flat specs</option>
                    <option value="legal">Legal/Payment terms</option>
                    <option value="competitor">Competitor mention</option>
                    <option value="negotiation">Negotiation stage</option>
                  </select>
                </div>
                
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Client Sentiment</label>
                  <select 
                    value={remarkSentiment}
                    onChange={(e) => setRemarkSentiment(e.target.value as RemarkSentiment)}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                  >
                    <option value="neutral">Neutral 😐</option>
                    <option value="positive">Positive 😊</option>
                    <option value="negative">Negative 😞</option>
                    <option value="excited">Excited 🤩</option>
                    <option value="skeptical">Skeptical 🧐</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={handleAddRemark}
                  disabled={!remarkText.trim()}
                  className="bg-[#C9A84C] text-[#1C1207] px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#B0923D] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={18} /> Save Note
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#FDFAF2]/50 border border-[#E6D8B8] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00] flex items-center gap-2">
                <HistoryIcon className="text-[#C9A84C]" size={20} />
                Audit Trail & History
              </h3>
              <div className="flex bg-[#E6D8B8]/30 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveTab('timeline')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2",
                    activeTab === 'timeline' ? "bg-white text-[#5C4820] shadow-sm" : "text-[#9A8262] hover:text-[#5C4820]"
                  )}
                >
                  <HistoryIcon size={14} /> Timeline
                </button>
                <button 
                  onClick={() => setActiveTab('whatsapp')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2",
                    activeTab === 'whatsapp' ? "bg-white text-[#5C4820] shadow-sm" : "text-[#9A8262] hover:text-[#5C4820]"
                  )}
                >
                  <MessageSquare size={14} /> WhatsApp {syncedWhatsApp.length > 0 && <span className="bg-green-500 text-white text-[10px] px-1 rounded-full">{syncedWhatsApp.length}</span>}
                </button>
              </div>
            </div>

            {activeTab === 'timeline' ? (
              <div className="space-y-6">
                {nextFollowUp && nextFollowUp.status === 'pending' && (
                  <div className="bg-[#FFFDF6] border-2 border-amber-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Clock size={40} className="text-amber-600" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600">Priority Follow-up</h4>
                        </div>
                        <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                          Due {isToday(new Date(nextFollowUp.date)) ? 'Today' : format(new Date(nextFollowUp.date), 'dd MMM')}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#2A1C00] mb-2">{nextFollowUp.purpose || 'Follow-up regarding property interest'}</p>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#9A8262] capitalize">Via: {nextFollowUp.method}</span>
                         </div>
                         <button 
                           onClick={() => setIsFollowUpModalOpen(true)}
                           className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1"
                         >
                           Action Required <ArrowRightLeft size={12} className="rotate-45" />
                         </button>
                      </div>
                    </div>
                  </div>
                )}
                <ActivityTimeline 
                  activities={syncedActivities} 
                  remarks={syncedRemarks}
                  callLogs={callLogs}
                  followUps={followUps}
                />
              </div>
            ) : (
              <WhatsAppHistory messages={syncedWhatsApp} />
            )}
          </div>
        </div>
      </div>

      {isFollowUpModalOpen && (
        <FollowUpForm 
          followUp={nextFollowUp && nextFollowUp.status === 'pending' ? nextFollowUp : undefined}
          leadId={lead.id}
          projectId={lead.projectId}
          clientName={lead.name}
          user={user}
          onSave={(f) => {
            if (nextFollowUp && f.id === nextFollowUp.id) {
              onUpdateFollowUp(f.id, {
                date: f.date,
                purpose: f.purpose,
                method: f.method
              });
            } else {
              onAddFollowUp(f);
            }
            setIsFollowUpModalOpen(false);
          }}
          onComplete={(id, note) => {
            onUpdateFollowUp(id, {
              status: 'completed',
              completed_at: new Date().toISOString(),
              outcome_note: note
            });
            // Immediately log locally for instant UI update
            logActivity('followup_done', `Outcome: ${note || 'Completed'}`);
            setIsFollowUpModalOpen(false);
          }}
          onClose={() => setIsFollowUpModalOpen(false)}
        />
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E6D8B8] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
              <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00]">Transfer Lead</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-[#9A8262] hover:text-[#2A1C00]">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#5C4820]">
                Transferring this lead will also move all associated site visits and history to the selected project.
              </p>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Select Target Project</label>
                <select 
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                >
                  <option value="">Select Project</option>
                  {projects.filter(p => p.id !== lead.projectId).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-bold text-[#9A8262] hover:bg-gray-50 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!targetProjectId) {
                      toast.error('Please select a project');
                      return;
                    }
                    onTransferLead(lead.id, targetProjectId);
                    setIsTransferModalOpen(false);
                  }}
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 transition-all shadow-sm text-sm"
                >
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function StatBox({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white border border-[#E6D8B8]/50 rounded-xl p-4 text-center">
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2", colors[color])}>
        <Icon size={18} />
      </div>
      <div className="text-xl font-bold text-[#2A1C00]">{value}</div>
      <div className="text-[9px] font-bold text-[#9A8262] uppercase tracking-wider">{label}</div>
    </div>
  );
}


