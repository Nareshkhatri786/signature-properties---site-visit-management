import React, { useState } from 'react';
import { Calendar, Clock, StickyNote, Save, X, Phone, MessageSquare, CheckCircle2 } from 'lucide-react';
import { FollowUp, FollowUpMethod, User, Page, VisitFilters } from '../types';
import { generateId } from '../lib/storage';
import { cn, getLocalDateString } from '../lib/utils';
import { NEXT_ACTION_TYPES, QUICK_ACTION_CHIPS, QuickActionChipKey, addDaysISO } from '../lib/workflowDiscipline';

interface FollowUpFormProps {
  followUp?: FollowUp;
  leadId?: string;
  visitId?: string;
  projectId: string;
  clientName: string;
  user: User;
  initialMethod?: FollowUpMethod;
  onSave: (followUp: FollowUp) => void;
  onComplete?: (id: string, note: string) => void;
  onClose: () => void;
}

export default function FollowUpForm({ 
  followUp, 
  leadId, 
  visitId, 
  projectId, 
  clientName, 
  user, 
  initialMethod, 
  onSave, 
  onComplete, 
  onClose 
}: FollowUpFormProps) {
  const buildScheduledAt = (dateValue: string, previousScheduledAt?: string) => {
    const timeSource = previousScheduledAt ? new Date(previousScheduledAt) : null;
    const hours = timeSource && !Number.isNaN(timeSource.getTime()) ? timeSource.getHours() : 10;
    const minutes = timeSource && !Number.isNaN(timeSource.getTime()) ? timeSource.getMinutes() : 0;
    const scheduled = new Date(`${dateValue}T00:00:00`);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled.toISOString();
  };
  
  const [formData, setFormData] = useState({
    date: followUp?.date 
      ? (typeof followUp.date === 'string' ? followUp.date.split('T')[0] : getLocalDateString(new Date(followUp.date)))
      : getLocalDateString(),
    purpose: followUp?.purpose || '',
    method: followUp?.method || initialMethod || 'call' as FollowUpMethod,
    note: '',
    actionType: (followUp?.purpose && NEXT_ACTION_TYPES.includes(followUp.purpose as any) ? followUp.purpose : 'Follow-up Call') as string,
  });

  const [isCompleting, setIsCompleting] = useState(false);
  const [selectedChip, setSelectedChip] = useState<QuickActionChipKey | null>(null);

  // Auto-reset note when entering completion mode to prevent repetition
  React.useEffect(() => {
    if (isCompleting) {
      setFormData(prev => ({ ...prev, note: '' }));
    }
  }, [isCompleting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Case 1: Marking an existing follow-up as Complete
    if (isCompleting && followUp && onComplete) {
      onComplete(followUp.id, formData.note);
      return;
    }

    // Case 2: Updating/Rescheduling an existing follow-up
    if (followUp && !isCompleting) {
      const updatedFollowUp: FollowUp = {
        ...followUp,
        date: formData.date,
        scheduled_at: buildScheduledAt(formData.date, followUp.scheduled_at),
        purpose: formData.purpose || formData.actionType,
        method: formData.method,
      };
      onSave(updatedFollowUp);
      return;
    }

    // Case 3: Creating a brand new follow-up
    const newFollowUp: FollowUp = {
      id: generateId(),
      leadId,
      visitId,
      projectId,
      userId: user.id,
      userName: user.name,
      date: formData.date,
      purpose: formData.purpose || formData.actionType,
      method: formData.method,
      status: 'pending',
      created_at: new Date().toISOString(),
      scheduled_at: buildScheduledAt(formData.date),
    };

    onSave(newFollowUp);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-3">
      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-lg w-full max-w-md overflow-hidden max-h-[95dvh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between shrink-0">
          <h3 className="font-bold text-[#2A1C00]">
            {isCompleting ? 'Complete Follow-up' : followUp ? 'Reschedule Follow-up' : 'Schedule Follow-up'}
          </h3>
          <button onClick={onClose} className="text-[#9A8262] hover:text-[#2A1C00] transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 safe-action-pad">
            {/* Client Context Info */}
            <div className="p-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg">
              <p className="text-[10px] text-[#9A8262] uppercase font-bold tracking-wider mb-0.5">Client Name</p>
              <p className="text-sm font-bold text-[#2A1C00]">{clientName}</p>
            </div>

            {!isCompleting ? (
              <>
                {/* Method Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'call', label: 'Call', icon: Phone },
                      { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, method: m.id as FollowUpMethod }))}
                    className={cn(
                          "flex items-center justify-center gap-2 p-2 border rounded-lg transition-colors",
                          formData.method === m.id 
                            ? "bg-[#C9A84C] border-[#C9A84C] text-white" 
                            : "bg-white border-[#E6D8B8] text-[#9A8262] hover:border-[#C9A84C]/50"
                        )}
                      >
                        <m.icon size={14} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={12} /> Schedule Date
                  </label>
                  <input 
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                    min={getLocalDateString()}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>

                {/* Purpose Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                    <StickyNote size={12} /> Purpose
                  </label>
                    <textarea 
                      value={formData.purpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                    required
                    rows={3}
                    placeholder="E.g., Discuss pricing..."
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                    />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Next Action Type</label>
                  <select
                    value={formData.actionType}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData(prev => ({ ...prev, actionType: v, purpose: prev.purpose || v }));
                    }}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  >
                    {NEXT_ACTION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Quick Chips</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(QUICK_ACTION_CHIPS) as QuickActionChipKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          const cfg = QUICK_ACTION_CHIPS[k];
                          const nextDate = addDaysISO(getLocalDateString(), cfg.days);
                          setSelectedChip(k);
                          setFormData(prev => ({
                            ...prev,
                            method: cfg.method,
                            actionType: cfg.actionType,
                            purpose: cfg.actionType,
                            date: nextDate
                          }));
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                          selectedChip === k ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#5C4820]" : "border-[#E6D8B8] text-[#9A8262] bg-white"
                        )}
                      >
                        {QUICK_ACTION_CHIPS[k].label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Completion Note (Outcome) */
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Outcome / Summary
                </label>
                <textarea 
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  required
                  rows={4}
                  placeholder="What was the result?"
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 left-0 right-0 p-3 border-t border-[#E6D8B8] bg-[#FDFAF2] flex flex-col gap-2 shrink-0 safe-bottom">
            {!isCompleting && followUp && (
              <button 
                type="button"
                onClick={() => setIsCompleting(true)}
                className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle2 size={18} /> Mark as Completed
              </button>
            )}

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => isCompleting ? setIsCompleting(false) : onClose()}
                className="flex-1 px-4 py-2.5 border border-[#E6D8B8] text-[#9A8262] font-bold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                {isCompleting ? 'Back' : 'Cancel'}
              </button>
              <button 
                type="submit"
                className={cn(
                  "flex-1 font-bold py-2.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 text-sm",
                  isCompleting 
                    ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                    : "bg-[#C9A84C] text-white hover:bg-[#B69741]"
                )}
              >
                <Save size={18} /> {isCompleting ? 'Save' : followUp ? 'Update' : 'Schedule'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
