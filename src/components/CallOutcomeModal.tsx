import React from 'react';
import { Phone, CheckCircle2, XCircle, Clock, Ban, X } from 'lucide-react';
import { CallOutcome } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface CallOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (outcome: CallOutcome, note?: string) => void;
  clientName: string;
}

export default function CallOutcomeModal({ isOpen, onClose, onSelect, clientName }: CallOutcomeModalProps) {
  const [note, setNote] = React.useState('');
  const outcomes: { value: CallOutcome; label: string; icon: any; color: string; bg: string }[] = [
    { value: 'answered', label: 'Answered', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { value: 'not_answered', label: 'Not Answered', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { value: 'busy', label: 'Busy', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { value: 'switched_off', label: 'Switched Off', icon: Ban, color: 'text-gray-600', bg: 'bg-gray-50' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between shrink-0">
              <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00]">
                Call Outcome
              </h3>
              <button onClick={onClose} className="text-[#9A8262] hover:text-[#2A1C00]"><X size={24} /></button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <p className="text-sm text-[#5C4820] mb-4">
                How was the call with <span className="font-bold">{clientName}</span>?
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                {outcomes.map((outcome) => (
                  <button
                    key={outcome.value}
                    onClick={() => onSelect(outcome.value, note)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border border-transparent transition-all hover:translate-x-1",
                      outcome.bg,
                      "hover:border-[#C9A84C]/30"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm", outcome.color)}>
                      <outcome.icon size={20} />
                    </div>
                    <span className="font-bold text-[#2A1C00]">{outcome.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-2 pb-2">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Add a note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Client asked to call back in the evening..."
                  className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none h-24"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FDFAF2] border-t border-[#E6D8B8] flex justify-end shrink-0">
              <button 
                onClick={onClose}
                className="text-sm font-black uppercase tracking-widest text-[#9A8262] hover:text-[#2A1C00] py-2 px-4"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
