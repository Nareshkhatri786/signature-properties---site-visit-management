import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Edit, 
  MessageSquare, 
  UserCircle, 
  Calendar, 
  Clock, 
  Home, 
  Wallet, 
  Share2, 
  UserCheck, 
  StickyNote,
  Plus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Phone,
  Bell,
  XCircle,
  Ban,
  X,
  Save,
  Star,
  RefreshCw,
  AlertCircle,
  ArrowRightLeft,
  History as HistoryIcon
} from 'lucide-react';
import { Visit, Remark, Page, LeadStatus, VisitStatus, FollowUp, CallLog, CallOutcome, Lead, User, Activity, ActivityType, VisitOutcome, LeadQuality, WhatsAppMessage } from '../types';
import { StatusBadge, VisitBadge } from './Dashboard';
import ActivityTimeline from './ActivityTimeline';
import WhatsAppHistory from './WhatsAppHistory';
import { generateId } from '../lib/storage';
import { aiService } from '../lib/ai';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { apiService } from '../lib/api-service';
import FollowUpForm from './FollowUpForm';
import { format } from 'date-fns';
import { normalizePhoneNumber } from '../lib/phoneUtils';
import { getLeadFollowUp, getFollowUpDisplayStatus } from '../lib/followupUtils';
import { FollowUpStatusBadge } from './FollowUpStatusBadge';
import { motion, AnimatePresence } from 'motion/react';

interface VisitDetailProps {
  user: User;
  visit: Visit;
  lead: Lead | null;
  remarks: Remark[];
  callLogs: CallLog[];
  followUps: FollowUp[];
  onUpdateFollowUp: (id: string, updates: Partial<FollowUp>) => void;
  onUpdateVisit: (visit: Visit) => void;
  onUpdateLead: (lead: Lead) => void;
  onAddRemark: (remark: Remark) => void;
  onAddFollowUp: (followUp: FollowUp) => void;
  onAddVisit?: (visit: Visit) => void;
  onCall: () => void;
  onLogCallOutcome: (outcome: CallOutcome, note?: string) => void;
  onNavigate: (page: Page, id?: string) => void;
  onSetGeneratedMessage: (message: string) => void;
}

export default function VisitDetail({ user, visit, lead, remarks: initialRemarks, callLogs, followUps, onUpdateFollowUp, onUpdateVisit, onUpdateLead, onAddRemark, onAddFollowUp, onAddVisit, onCall, onLogCallOutcome, onNavigate, onSetGeneratedMessage }: VisitDetailProps) {
  const [syncedRemarks, setSyncedRemarks] = useState<Remark[]>(initialRemarks);
  const [syncedActivities, setSyncedActivities] = useState<Activity[]>([]);
  const [syncedWhatsApp, setSyncedWhatsApp] = useState<WhatsAppMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'whatsapp'>('timeline');
  
  if (!visit || !visit.id) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-[#E6D8B8]">
        <Loader2 className="w-10 h-10 text-[#C9A84C] animate-spin mb-4" />
        <p className="text-[#9A8262] font-medium">Synchronizing visit data...</p>
        <button onClick={() => onNavigate('visits')} className="mt-4 text-[#C9A84C] font-bold">Return to Visits</button>
      </div>
    );
  }
  
  // Load remarks from REST API
  useEffect(() => {
    apiService.getRemarks(visit.id).then((data: Remark[]) => {
      setSyncedRemarks(data.sort((a, b) => b.at.localeCompare(a.at)));
    }).catch(console.error);
  }, [visit.id]);

  const logActivity = (type: ActivityType, details?: string) => {
    const activity: Activity = {
      id: generateId(),
      type,
      userId: user.id,
      userName: user.name,
      projectId: visit.projectId,
      targetId: visit.id,
      targetName: visit.client_name,
      timestamp: new Date().toISOString(),
      details: details || ''
    };
    setSyncedActivities(prev => [activity, ...prev]);
    apiService.save('activities', activity).catch(console.error);
  };

  const [newRemark, setNewRemark] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedVisit, setEditedVisit] = useState<Visit>(visit);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [callNote, setCallNote] = useState('');

  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [newDate, setNewDate] = useState(visit.visit_date);
  const [newTime, setNewTime] = useState(visit.visit_time || '');

  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionData, setCompletionData] = useState({
    feedback: '',
    interest: 'warm' as LeadQuality,
    outcome: 'follow_up_required' as VisitOutcome,
    nextStep: 'none' as 'none' | 'followup' | 'revisit',
    nextDate: '',
    nextTime: ''
  });

  const handleReschedule = () => {
    if (!newDate) return;
    
    const updatedVisit: Visit = {
      ...visit,
      visit_date: newDate,
      visit_time: newTime,
      visit_status: 'rescheduled',
      reschedule_log: [
        ...(visit.reschedule_log || []),
        {
          previous_date: visit.visit_date,
          previous_time: visit.visit_time,
          new_date: newDate,
          new_time: newTime,
          at: new Date().toISOString()
        }
      ]
    };
    onUpdateVisit(updatedVisit);
    logActivity('visit_rescheduled', `Rescheduled from ${visit.visit_date} to ${newDate}`);
    
    // Add remark for reschedule
    const remark: Remark = {
      id: generateId(),
      text: `Visit Rescheduled: ${visit.visit_date} → ${newDate} ${newTime ? `at ${newTime}` : ''}`,
      by: user.name,
      at: new Date().toISOString(),
      type: 'visit_note'
    };
    setSyncedRemarks(prev => [remark, ...prev]);
    apiService.saveRemark(visit.id, remark).catch(console.error);
    onAddRemark(remark);

    setIsRescheduleModalOpen(false);
    toast.success('Visit rescheduled');
  };

  const handleCompleteVisit = () => {
    const updatedVisit: Visit = {
      ...visit,
      visit_status: 'completed',
      client_feedback: completionData.feedback,
      interest_level: completionData.interest,
      outcome: completionData.outcome,
      completed_at: new Date().toISOString()
    };
    onUpdateVisit(updatedVisit);
    logActivity('visit_completed', `Outcome: ${completionData.outcome.replace(/_/g, ' ')}`);
    
    // Add remark for completion
    const remark: Remark = {
      id: generateId(),
      text: `Visit Completed! Outcome: ${completionData.outcome.toUpperCase()} | Feedback: ${completionData.feedback}`,
      by: user.name,
      at: new Date().toISOString(),
      type: 'visit_note'
    };
    setSyncedRemarks(prev => [remark, ...prev]);
    apiService.saveRemark(visit.id, remark).catch(console.error);
    onAddRemark(remark);

    setIsCompletionModalOpen(false);
    toast.success('Visit marked as completed');
    
    // Post-visit action
    if (completionData.nextStep === 'followup') {
      const newFollowUp: FollowUp = {
        id: generateId(),
        leadId: visit.leadId || '',
        visitId: visit.id,
        projectId: visit.projectId,
        date: completionData.nextDate,
        purpose: 'Follow up post-visit',
        status: 'pending',
        userId: user.id,
        userName: user.name,
        method: 'call',
        created_at: new Date().toISOString()
      };
      onAddFollowUp(newFollowUp);
      toast.success('Follow-up scheduled');
    } else if (completionData.nextStep === 'revisit') {
      // Actually creating a new visit as a re-visit
      const reVisit: Visit = {
        ...visit,
        id: generateId(),
        visit_date: completionData.nextDate,
        visit_time: completionData.nextTime,
        visit_status: 'scheduled',
        purpose: 'Re-visit: ' + completionData.feedback,
        created_at: new Date().toISOString(),
        completed_at: undefined,
        reschedule_log: []
      };
      
      if (onAddVisit) {
        onAddVisit(reVisit);
      } else {
        apiService.save('visits', reVisit).catch(console.error);
      }
      toast.success('Re-visit scheduled');
      onNavigate('visits');
    }
  };

  const history = [
    ...syncedRemarks.map(r => ({ type: 'remark', date: r.at, data: r })),
    ...callLogs.map(c => ({ type: 'call', date: c.timestamp, data: c })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const handleUpdateStatus = (field: 'status' | 'visit_status', value: string) => {
    onUpdateVisit({ ...visit, [field]: value });
    
    let activityType: ActivityType = 'lead_updated';
    if (field === 'status') {
      activityType = 'lead_quality_changed';
    } else if (field === 'visit_status') {
      if (value === 'completed') activityType = 'visit_completed';
      else if (value === 'cancelled') activityType = 'visit_cancelled';
      else if (value === 'rescheduled') activityType = 'visit_rescheduled';
      else activityType = 'visit_scheduled';
    }
    
    logActivity(activityType, `Updated ${field.replace('_', ' ')} to ${value}`);
    toast.success('Visit status updated');
  };

  const handleUpdateLeadStatus = (value: LeadStatus) => {
    if (lead) {
      onUpdateLead({ ...lead, status: value, updated_at: new Date().toISOString() });
      logActivity('lead_status_changed', `Changed lead status to ${value}`);
      toast.success('Lead status updated');
    }
  };

  const handleUpdateLeadSource = (value: string) => {
    if (lead) {
      onUpdateLead({ ...lead, source: value, updated_at: new Date().toISOString() });
      onUpdateVisit({ ...visit, source: value });
      toast.success('Source updated');
    }
  };

  const handleAddRemark = () => {
    if (!newRemark.trim()) return;
    const remark: Remark = {
      id: generateId(),
      text: newRemark.trim(),
      by: user.name,
      at: new Date().toISOString(),
      type: 'visit_note'
    };
    setSyncedRemarks(prev => [remark, ...prev]);
    apiService.saveRemark(visit.id, remark).catch(console.error);
    onAddRemark(remark);
    setNewRemark('');
    toast.success('Visit note saved');
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const message = await aiService.generateFollowUp(visit, syncedRemarks);
    setIsGenerating(false);
    
    if (message) {
      onSetGeneratedMessage(message);
      try {
        await navigator.clipboard.writeText(message);
        toast.success('AI Message generated and copied to clipboard!');
      } catch (err) {
        console.warn('Clipboard write failed:', err);
        toast.success('AI Message generated!');
      }
      onNavigate('whatsapp', visit.id);
    } else {
      toast.error('Failed to generate AI message. Check your API key.');
    }
  };

  const infoRows = [
    { icon: UserCircle, label: 'Client Name', value: visit.client_name },
    { icon: Phone, label: 'Mobile', value: visit.mobile, isMobile: true },
    { 
      icon: Calendar, 
      label: 'Visit Date', 
      value: new Date(visit.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      // visit_date is now read-only once scheduled
    },
    { 
      icon: Clock, 
      label: 'Visit Time', 
      value: visit.visit_time || '–',
      // visit_time is now read-only once scheduled
    },
    { icon: Home, label: 'Property Interest', value: visit.property_interest || '–' },
    { icon: Wallet, label: 'Budget', value: visit.budget || '–' },
    { icon: Share2, label: 'Source', value: visit.source || '–' },
    { icon: UserCheck, label: 'Assigned To', value: visit.assigned_to || '–' },
    ...(visit.completed_at ? [{ 
      icon: CheckCircle2, 
      label: 'Completed On', 
      value: new Date(visit.completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    }] : []),
  ];

  const nextFollowUp = getLeadFollowUp(followUps, visit.leadId, visit.id, undefined); // In VisitDetail, followUps is already filtered to THIS visit, but passing leadId/visitId is enough. Actually, let's keep it consistent.
  const followUpStatus = getFollowUpDisplayStatus(nextFollowUp);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] rounded-full flex items-center justify-center text-[#1C1207] shadow-md">
            <UserCircle size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              {isEditMode ? (
                <div className="flex flex-col gap-2">
                  <input 
                    type="text"
                    value={editedVisit.client_name}
                    onChange={(e) => setEditedVisit({ ...editedVisit, client_name: e.target.value })}
                    className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] bg-white border border-[#E6D8B8] rounded px-2 py-0.5 focus:outline-none focus:border-[#C9A84C]"
                  />
                  <div className="flex gap-1">
                    {[1, 2, 3].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setEditedVisit({ ...editedVisit, priority: editedVisit.priority === star ? 0 : star })}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star 
                          size={18} 
                          className={cn(
                            star <= (editedVisit.priority || 0) 
                              ? "text-yellow-400 fill-yellow-400" 
                              : "text-gray-300"
                          )} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00]">{visit.client_name}</h2>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <Star 
                        key={s} 
                        size={18} 
                        className={cn(
                          s <= (visit.priority || 0) 
                            ? "text-yellow-400 fill-yellow-400" 
                            : "text-gray-200"
                        )} 
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isEditMode ? (
                <input 
                  type="text"
                  value={editedVisit.mobile}
                  onChange={(e) => setEditedVisit({ ...editedVisit, mobile: e.target.value })}
                  className="text-green-600 font-bold text-sm bg-white border border-[#E6D8B8] rounded px-2 focus:outline-none focus:border-[#C9A84C]"
                />
              ) : (
                <StatusBadge status={visit.status} />
              )}
              {!isEditMode && <VisitBadge status={visit.visit_status} />}
            </div>
            {/* Follow-up Highlight */}
            <div className="mt-3 flex items-center gap-3 bg-[#FFFDF6] border border-[#E6D8B8] px-3 py-2 rounded-xl shadow-sm w-fit">
              <span className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Next Follow-up:</span>
              <FollowUpStatusBadge 
                status={followUpStatus}
                date={nextFollowUp?.date}
                onClick={() => setIsFollowUpModalOpen(true)}
              />
              {nextFollowUp?.purpose && (
                <span className="text-xs text-[#5C4820] border-l border-[#E6D8B8] pl-3 italic truncate max-w-[200px]">
                  "{nextFollowUp.purpose}"
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditMode ? (
            <button 
              onClick={() => {
                const normalizedMobile = normalizePhoneNumber(editedVisit.mobile);
                if (normalizedMobile.length < 13) {
                  toast.error('Please enter a valid 10-digit mobile number');
                  return;
                }
                const finalVisit = { ...editedVisit, mobile: normalizedMobile };
                onUpdateVisit(finalVisit);
                setIsEditMode(false);
                toast.success('Visit details updated');
                logActivity('lead_updated', `Updated client info (Mobile: ${normalizedMobile}) and priority`);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-green-700 transition-all text-sm"
            >
              <Save size={18} /> Save Changes
            </button>
          ) : (
            <button 
              onClick={() => {
                setEditedVisit(visit);
                setIsEditMode(true);
              }}
              className="bg-white border border-[#C9A84C] text-[#C9A84C] px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-[#FDF6E3] transition-all text-sm"
            >
              <Edit size={18} /> Edit Details
            </button>
          )}
          <button 
            onClick={onCall}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-green-700 transition-all text-sm"
          >
            <Phone size={18} /> Call
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
            <Phone size={18} className="rotate-12" /> {isLoggingCall ? 'Cancel Log' : 'Log Call'}
          </button>
          <button 
            onClick={() => onNavigate('whatsapp', visit.id)}
            className="bg-[#25D366] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-[#1DA851] transition-all text-sm"
          >
            <MessageSquare size={18} /> WhatsApp
          </button>
          
          {(visit.visit_status === 'scheduled' || visit.visit_status === 'rescheduled') && (
            <>
              <button 
                onClick={() => setIsRescheduleModalOpen(true)}
                className="bg-white border border-[#C9A84C] text-[#C9A84C] px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-[#FDF6E3] transition-all text-sm"
              >
                <RefreshCw size={18} /> Reschedule
              </button>
              <button 
                onClick={() => setIsCompletionModalOpen(true)}
                className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-green-200 transition-all text-sm"
              >
                <CheckCircle2 size={18} /> Mark Completed
              </button>
            </>
          )}

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
            onClick={() => onNavigate('visits')}
            className="bg-white border border-[#E6D8B8] text-[#9A8262] px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:text-[#2A1C00] transition-all text-sm"
          >
            <ArrowLeft size={18} /> Back
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
                  { value: 'answered', label: 'Answered', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
                  { value: 'not_answered', label: 'No Answer', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                  { value: 'busy', label: 'Busy', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                  { value: 'switched_off', label: 'Off', icon: Ban, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
                ].map((outcome) => (
                  <button
                    key={outcome.value}
                    onClick={() => setSelectedOutcome(outcome.value as CallOutcome)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      selectedOutcome === outcome.value 
                        ? cn(outcome.bg, outcome.border, "ring-2 ring-[#C9A84C]/20") 
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Info Card */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Visit Information</h3>
            </div>
            <div className="divide-y divide-[#E6D8B8]/50">
              {infoRows.map((row: any, idx) => (
                <div key={idx} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="w-8 flex justify-center text-[#9A8262]">
                    <row.icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">{row.label}</p>
                    {isEditMode && row.editField ? (
                      <input 
                        type={row.inputType || 'text'}
                        value={(editedVisit as any)[row.editField] || ''}
                        onChange={(e) => setEditedVisit({ ...editedVisit, [row.editField]: e.target.value })}
                        className="w-full bg-white border border-[#E6D8B8] rounded px-2 py-0.5 mt-1 text-sm focus:outline-none focus:border-[#C9A84C]"
                      />
                    ) : (
                      <p className={cn("text-[14px] font-medium", row.isMobile ? "text-green-600" : "text-[#2A1C00]")}>
                        {row.value}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {visit.purpose && (
                <div className="px-6 py-4 bg-[#F5EDD4]/30">
                  <p className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <StickyNote size={12} /> Notes / Purpose
                  </p>
                  <p className="text-[13.5px] text-[#5C4820] leading-relaxed italic">
                    "{visit.purpose}"
                  </p>
                </div>
              )}
            </div>
          </div>



          {/* Dedicated Visit Notes Section */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] flex items-center gap-2">
                <StickyNote className="text-[#C9A84C]" size={18} />
                Visit Notes
              </h3>
              <span className="bg-[#C9A84C]/10 text-[#C9A84C] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {syncedRemarks.length} Notes
              </span>
            </div>
            
            <div className="p-6 border-b border-[#E6D8B8] bg-white/50">
              <div className="space-y-3">
                <textarea 
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Type a new note for this visit..."
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none h-24 shadow-inner"
                />
                <button 
                  onClick={handleAddRemark}
                  className="w-full bg-[#C9A84C] text-white font-bold py-3 rounded-lg hover:bg-[#B0923D] transition-all flex items-center justify-center gap-2 text-sm shadow-md"
                >
                  <Plus size={16} /> Save Visit Note
                </button>
              </div>
            </div>

            <div className="p-0 max-h-[450px] overflow-y-auto custom-scrollbar">
              {syncedRemarks.filter(r => r.type === 'visit_note').length === 0 ? (
                <div className="text-center py-16 opacity-30">
                  <StickyNote size={40} className="mx-auto mb-3" />
                  <p className="font-['Cormorant_Garamond'] text-lg font-bold">No visit notes yet</p>
                  <p className="text-xs">Notes recorded here specifically for this visit appear in this log.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E6D8B8]/30">
                  {syncedRemarks.filter(r => r.type === 'visit_note').map(remark => (
                    <div key={remark.id} className="px-6 py-4 bg-white hover:bg-[#FFFDF6] transition-colors group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#1C1207] text-[#E8C97A] flex items-center justify-center text-[11px] font-bold shadow-sm">
                            {remark.by[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-[#2A1C00] uppercase tracking-widest leading-none mb-1">Author</p>
                            <p className="text-[13px] font-bold text-[#9A8262]">{remark.by}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-black text-[#2A1C00] uppercase tracking-widest leading-none mb-1">Timestamp</p>
                          <time className="text-[12px] font-bold text-[#9A8262] flex items-center justify-end gap-1.5 px-2 py-0.5 rounded-md bg-[#F5F1E6]">
                            <Clock size={12} className="text-[#C9A84C]" />
                            {format(new Date(remark.at), 'dd MMM yyyy, hh:mm a')}
                          </time>
                        </div>
                      </div>
                      <div className="pl-11 pt-2 border-t border-[#F5F1E6]/50">
                        <p className="text-[11px] font-black text-[#2A1C00] uppercase tracking-widest leading-none mb-2">Note Content</p>
                        <p className="text-[#5C4820] text-[14.5px] leading-relaxed whitespace-pre-wrap font-medium">
                          {remark.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status Update Card */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Update Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Quality</label>
                <select 
                  value={visit.status}
                  onChange={(e) => handleUpdateStatus('status', e.target.value)}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="pending">⏳ Pending</option>
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">🌡️ Warm</option>
                  <option value="cold">❄️ Cold</option>
                  <option value="disq">🚫 Disqualified</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Visit Status</label>
                <select 
                  value={visit.visit_status}
                  onChange={(e) => handleUpdateStatus('visit_status', e.target.value)}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="scheduled">📅 Scheduled</option>
                  <option value="completed">✅ Completed</option>
                  <option value="rescheduled">🔄 Rescheduled</option>
                  <option value="cancelled">❌ Cancelled</option>
                </select>
              </div>

              {lead && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Status</label>
                    <select 
                      value={lead.status}
                      onChange={(e) => handleUpdateLeadStatus(e.target.value as LeadStatus)}
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
                    <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Source</label>
                    <select 
                      value={lead.source}
                      onChange={(e) => handleUpdateLeadSource(e.target.value)}
                      className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                    >
                      <option>Walk-in</option>
                      <option>Phone Call</option>
                      <option>Website</option>
                      <option>Reference</option>
                      <option>Social Media</option>
                      <option>Hoarding</option>
                      <option>Newspaper</option>
                      <option>Event</option>
                      <option>Other</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* AI Assistant Card */}
          <div className="bg-gradient-to-br from-[#1C1207] to-[#2A1F08] border border-[#C9A84C]/30 rounded-xl p-6 shadow-lg text-[#E8C97A]">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-[#C9A84C]" size={20} />
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold">AI Follow-up Assistant</h3>
            </div>
            <p className="text-[#C9A84C]/70 text-sm leading-relaxed mb-6">
              Let AI analyze your visit remarks and generate a perfectly tailored luxury follow-up message for this client.
            </p>
            <button 
              onClick={handleGenerateAI}
              disabled={isGenerating || syncedRemarks.length === 0}
              className="w-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] font-bold py-3 rounded-lg shadow-md hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Generate AI Message
                </>
              )}
            </button>
            {syncedRemarks.length === 0 && (
              <p className="text-[10px] text-center mt-2 text-red-400/80 uppercase tracking-widest">
                Add at least one remark to use AI
              </p>
            )}
          </div>

          {/* WhatsApp Reminders Section */}
          <div className="bg-white border border-[#E6D8B8] rounded-xl p-6 shadow-sm">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] mb-4 flex items-center gap-2">
              <MessageSquare className="text-[#25D366]" size={18} />
              WhatsApp Reminders
            </h3>
            <p className="text-xs text-[#9A8262] mb-4">Send timely reminders to ensure the client arrives as planned.</p>
            
            <div className="space-y-3">
              {[
                { label: '24h Before', id: '24h', icon: Calendar },
                { label: 'Today (Morning)', id: 'morning', icon: Clock },
                { label: '2h Before', id: '2h', icon: Clock },
              ].map((rem) => {
                const isSent = (visit.reminders_sent || []).includes(rem.id);
                return (
                  <div key={rem.id} className="flex items-center justify-between p-3 bg-[#FDF6E3]/30 border border-[#E6D8B8]/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <rem.icon size={16} className="text-[#C9A84C]" />
                      <span className="text-sm font-bold text-[#2A1C00]">{rem.label}</span>
                    </div>
                    {isSent ? (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase flex items-center gap-1">
                        <CheckCircle2 size={10} /> Sent
                      </span>
                    ) : (
                      <button 
                        onClick={() => {
                          const updatedVisit = {
                            ...visit,
                            reminders_sent: [...(visit.reminders_sent || []), rem.id]
                          };
                          onUpdateVisit(updatedVisit);
                          onNavigate('whatsapp', visit.id);
                          toast.success(`Sending ${rem.label} reminder...`);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full uppercase transition-colors"
                      >
                        Send Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity & Audit Trail Column */}
        <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm flex flex-col overflow-hidden h-fit max-h-[824px]">
          <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
            <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] flex items-center gap-2">
              <HistoryIcon className="text-[#C9A84C]" size={18} />
              Audit Trail
            </h3>
            <div className="flex bg-[#E6D8B8]/30 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('timeline')}
                className={cn(
                  "px-4 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-2",
                  activeTab === 'timeline' ? "bg-white text-[#5C4820] shadow-sm" : "text-[#9A8262] hover:text-[#5C4820]"
                )}
              >
                Timeline
              </button>
              <button 
                onClick={() => setActiveTab('whatsapp')}
                className={cn(
                  "px-4 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-2",
                  activeTab === 'whatsapp' ? "bg-white text-[#5C4820] shadow-sm" : "text-[#9A8262] hover:text-[#5C4820]"
                )}
              >
                WhatsApp {syncedWhatsApp.length > 0 && <span className="bg-green-500 text-white text-[8px] px-1 rounded-full">{syncedWhatsApp.length}</span>}
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white/20">
            {activeTab === 'timeline' ? (
              <ActivityTimeline 
                activities={syncedActivities}
                remarks={syncedRemarks}
                callLogs={callLogs}
                followUps={followUps}
              />
            ) : (
              <WhatsAppHistory messages={syncedWhatsApp} />
            )}
          </div>
        </div>
      </div>

      {isFollowUpModalOpen && (
        <FollowUpForm 
          followUp={nextFollowUp && nextFollowUp.status === 'pending' ? nextFollowUp : undefined}
          visitId={visit.id}
          leadId={visit.leadId}
          projectId={visit.projectId}
          clientName={visit.client_name}
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
            setIsFollowUpModalOpen(false);
          }}
          onClose={() => setIsFollowUpModalOpen(false)}
        />
      )}

      {/* Reschedule Modal */}
      <AnimatePresence>
        {isRescheduleModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E6D8B8] rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-[#FDF8E6] text-[#C9A84C] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#F2ECD8]">
                  <RefreshCw size={32} />
                </div>
                <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] mb-2 text-center">Reschedule Visit</h3>
                <p className="text-sm text-[#9A8262] mb-6 text-center leading-relaxed">
                  Select a new date and time for <span className="font-bold text-[#5C4820]">{visit.client_name}</span>
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
                    onClick={handleReschedule}
                    className="w-full bg-[#C9A84C] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#C9A84C]/20 hover:bg-[#B59640] transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> Update Schedule
                  </button>
                  <button 
                    onClick={() => setIsRescheduleModalOpen(false)}
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

      {/* Completion Modal */}
      <AnimatePresence>
        {isCompletionModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E6D8B8] rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-green-100">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] mb-2 text-center">Visit Completed</h3>
                <p className="text-sm text-[#9A8262] mb-8 text-center leading-relaxed">
                  Please provide feedback and outcome details for <span className="font-bold text-[#5C4820]">{visit.client_name}</span>.
                </p>

                <div className="space-y-6 mb-8">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare size={12} /> Client Feedback *
                    </label>
                    <textarea 
                      value={completionData.feedback}
                      onChange={(e) => setCompletionData({...completionData, feedback: e.target.value})}
                      placeholder="What did the client say about the property?"
                      className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none h-24"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                        <Star size={12} /> Interest Level
                      </label>
                      <select 
                        value={completionData.interest}
                        onChange={(e) => setCompletionData({...completionData, interest: e.target.value as LeadQuality})}
                        className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                      >
                        <option value="hot">🔥 Hot Interest</option>
                        <option value="warm">🌡️ Warm Interest</option>
                        <option value="cold">❄️ Cold Interest</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle size={12} /> Final Outcome
                      </label>
                      <select 
                        value={completionData.outcome}
                        onChange={(e) => setCompletionData({...completionData, outcome: e.target.value as VisitOutcome})}
                        className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                      >
                        <option value="booked">💰 Booked / Token Ready</option>
                        <option value="highly_interested">🌟 Highly Interested</option>
                        <option value="follow_up_required">📞 Needs Follow-up</option>
                        <option value="shared_quotation">📄 Quotation Shared</option>
                        <option value="negotiation">🤝 In Negotiation</option>
                        <option value="not_interested">❌ Not Interested</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-[#E6D8B8]">
                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowRightLeft size={12} /> Next Action Step
                      </label>
                      <select 
                        value={completionData.nextStep}
                        onChange={(e) => setCompletionData({...completionData, nextStep: e.target.value as any})}
                        className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                      >
                        <option value="none">No immediate action required</option>
                        <option value="followup">📞 Schedule Follow-up Call</option>
                        <option value="revisit">📅 Schedule Re-Visit</option>
                      </select>
                    </div>

                    {completionData.nextStep !== 'none' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FDFAF2] p-4 rounded-xl border border-[#E6D8B8]">
                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={12} /> Date
                          </label>
                          <input 
                            type="date" 
                            value={completionData.nextDate}
                            onChange={(e) => setCompletionData({...completionData, nextDate: e.target.value})}
                            className="w-full bg-white border border-[#E6D8B8] rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={12} /> Time (Optional)
                          </label>
                          <input 
                            type="time" 
                            value={completionData.nextTime}
                            onChange={(e) => setCompletionData({...completionData, nextTime: e.target.value})}
                            className="w-full bg-white border border-[#E6D8B8] rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleCompleteVisit}
                    disabled={!completionData.feedback.trim() || (completionData.nextStep !== 'none' && !completionData.nextDate)}
                    className="w-full bg-[#C9A84C] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#C9A84C]/20 hover:bg-[#B59640] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} /> Complete Visit & Log Feedback
                  </button>
                  <button  
                    onClick={() => setIsCompletionModalOpen(false)}
                    className="w-full bg-white border border-[#E6D8B8] text-[#9A8262] font-semibold py-3 rounded-xl hover:bg-[#FDFAF2] transition-colors"
                  >
                    Go Back
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


