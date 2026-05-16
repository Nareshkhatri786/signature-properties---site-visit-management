import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Star, 
  AlertCircle, 
  ArrowRightLeft,
  X,
  Save
} from 'lucide-react';
import { Visit, Lead, VisitOutcome, LeadQuality, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface VisitCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: Visit;
  lead: Lead | null;
  user: User;
  onComplete: (data: any) => void;
}

export default function VisitCompletionModal({ isOpen, onClose, visit, lead, user, onComplete }: VisitCompletionModalProps) {
  const [data, setData] = useState({
    feedback: '',
    interest: (lead?.quality || 'warm') as LeadQuality,
    outcome: 'follow_up_required' as VisitOutcome,
    nextStep: 'none' as 'none' | 'followup' | 'revisit',
    nextDate: '',
    nextTime: '',
    visitDate: visit.visit_date || new Date().toISOString().split('T')[0],
    visitTime: visit.visit_time || new Date().toTimeString().slice(0, 5)
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!data.feedback.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const completedAt = new Date(`${data.visitDate}T${data.visitTime || '00:00'}:00`).toISOString();
    onComplete({ ...data, completedAt });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white border border-[#E6D8B8] rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden max-h-[95dvh] flex flex-col"
          >
            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shadow-sm border border-green-100">
                  <CheckCircle2 size={24} />
                </div>
                <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] mb-1">Log Visit Outcome</h3>
              <p className="text-sm text-[#9A8262] mb-8 leading-relaxed">
                Recording details for visit with <span className="font-bold text-[#5C4820]">{visit.client_name}</span>.
              </p>

              <div className="space-y-5 px-1 pb-4">
                {/* Back-entry Section */}
                <div className="bg-[#FDFAF2] border border-[#E6D8B8] rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calendar size={12} /> When did the visit happen?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Date *</label>
                      <input
                        type="date"
                        value={data.visitDate}
                        onChange={(e) => setData({...data, visitDate: e.target.value})}
                        className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Time</label>
                      <input
                        type="time"
                        value={data.visitTime}
                        onChange={(e) => setData({...data, visitTime: e.target.value})}
                        className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>
                  </div>
                </div>

                {/* Feedback */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={12} /> Client Feedback *
                  </label>
                  <textarea 
                    value={data.feedback}
                    onChange={(e) => setData({...data, feedback: e.target.value})}
                    placeholder="Briefly describe what happened..."
                    className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none h-24"
                    required
                  />
                </div>

                {/* Outcome & Quality */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                      <Star size={12} /> Interest
                    </label>
                    <select 
                      value={data.interest}
                      onChange={(e) => setData({...data, interest: e.target.value as LeadQuality})}
                      className="w-full bg-white border border-[#E6D8B8] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                    >
                      <option value="hot">🔥 Hot</option>
                      <option value="warm">🌡️ Warm</option>
                      <option value="cold">❄️ Cold</option>
                      <option value="pending">⏳ Pending</option>
                      <option value="disq">❌ Disqualified</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle size={12} /> Outcome
                    </label>
                    <select 
                      value={data.outcome}
                      onChange={(e) => setData({...data, outcome: e.target.value as VisitOutcome})}
                      className="w-full bg-white border border-[#E6D8B8] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                    >
                      <option value="booked">💰 Booked</option>
                      <option value="highly_interested">🌟 High Interest</option>
                      <option value="follow_up_required">📞 Follow-up</option>
                      <option value="not_interested">❌ Not Interested</option>
                    </select>
                  </div>
                </div>

                {/* Next Step */}
                <div className="pt-4 border-t border-[#E6D8B8] space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRightLeft size={12} /> Next Action
                    </label>
                    <select 
                      value={data.nextStep}
                      onChange={(e) => setData({...data, nextStep: e.target.value as any})}
                      className="w-full bg-white border border-[#E6D8B8] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                    >
                      <option value="none">No immediate action</option>
                      <option value="followup">📞 Schedule Follow-up Call</option>
                      <option value="revisit">📅 Schedule Re-Visit</option>
                    </select>
                  </div>

                  {data.nextStep !== 'none' && (
                    <div className="grid grid-cols-2 gap-3 bg-[#FDFAF2] p-3 rounded-lg border border-[#E6D8B8]">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#9A8262] uppercase">Next Date</label>
                        <input 
                          type="date" 
                          value={data.nextDate}
                          onChange={(e) => setData({...data, nextDate: e.target.value})}
                          className="w-full bg-white border border-[#E6D8B8] rounded py-1.5 px-2 text-xs focus:outline-none focus:border-[#C9A84C]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#9A8262] uppercase">Next Time</label>
                        <input 
                          type="time" 
                          value={data.nextTime}
                          onChange={(e) => setData({...data, nextTime: e.target.value})}
                          className="w-full bg-white border border-[#E6D8B8] rounded py-1.5 px-2 text-xs focus:outline-none focus:border-[#C9A84C]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-[#F2ECD8] bg-[#FDFAF2] flex gap-3 shrink-0">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 bg-white border border-[#E6D8B8] text-[#9A8262] font-bold py-3 rounded-xl hover:bg-[#FDFAF2] transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={!data.feedback.trim() || !data.outcome || isSubmitting}
                className="flex-[2] bg-[#C9A84C] text-white font-bold py-3 rounded-xl shadow-lg shadow-[#C9A84C]/20 hover:bg-[#B59640] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} /> Complete & Save
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
