import React from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { CallOutcome, Template } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PostCallWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (templateId: string) => void;
  clientName: string;
  outcome: CallOutcome;
  templates: Template[];
}

export default function PostCallWhatsAppModal({ isOpen, onClose, onSend, clientName, outcome, templates }: PostCallWhatsAppModalProps) {
  // Filter and sort templates to show relevant ones first
  const relevantTemplates = templates
    .filter(t => t.active)
    .sort((a, b) => {
      const aMatch = a.name.toLowerCase().includes(outcome.replace('_', ' ')) || a.name.toLowerCase().includes('answered');
      const bMatch = b.name.toLowerCase().includes(outcome.replace('_', ' ')) || b.name.toLowerCase().includes('answered');
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
              <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00] flex items-center gap-2">
                <MessageSquare className="text-green-600" size={20} />
                Follow-up WhatsApp
              </h3>
              <button onClick={onClose} className="text-[#9A8262] hover:text-[#2A1C00]"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="text-sm text-green-800">
                  The call with <span className="font-bold">{clientName}</span> was marked as <span className="font-bold uppercase">{outcome.replace('_', ' ')}</span>. 
                  Would you like to send a follow-up WhatsApp message?
                </p>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Select a Template</label>
                {relevantTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onSend(template.id)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-[#E6D8B8] bg-white hover:border-[#C9A84C] hover:bg-[#FDFAF2] transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#2A1C00] text-sm">{template.name}</p>
                      <p className="text-[#9A8262] text-xs truncate mt-0.5">{template.message}</p>
                    </div>
                    <Send size={16} className="text-[#C9A84C] opacity-0 group-hover:opacity-100 transition-opacity ml-3" />
                  </button>
                ))}
                {relevantTemplates.length === 0 && (
                  <p className="text-center text-[#9A8262] text-sm italic py-4">No active templates found.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
              <button 
                onClick={onClose}
                className="text-sm font-semibold text-[#9A8262] hover:text-[#2A1C00]"
              >
                No, thanks
              </button>
              <p className="text-[10px] text-[#9A8262] italic">Click a template to send</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
