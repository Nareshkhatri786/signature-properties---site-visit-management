import React from 'react';
import { WhatsAppMessage } from '../types';
import { cn } from '../lib/utils';
import { MessageSquare, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

interface WhatsAppHistoryProps {
  messages: WhatsAppMessage[];
}

export default function WhatsAppHistory({ messages }: WhatsAppHistoryProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
        <MessageSquare size={48} className="mb-4 text-[#9A8262]" />
        <h4 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00]">No WhatsApp History</h4>
        <p className="text-sm max-w-[200px]">Conversations via the official webhook will appear here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((msg) => (
        <div key={msg.id} className="relative pl-6">
           {/* Connection Line */}
           <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[#C9A84C]/50 to-transparent" />
           
           <div className={cn(
             "relative p-4 rounded-2xl shadow-sm border animate-in fade-in slide-in-from-left-2",
             msg.type === 'incoming' 
               ? "bg-white border-[#E6D8B8] rounded-tl-none mr-8" 
               : "bg-[#FDF6E3] border-[#C9A84C]/30 rounded-tr-none ml-8"
           )}>
             {/* Indicator Icon */}
             <div className={cn(
               "absolute -left-3 top-4 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm",
               msg.type === 'incoming' ? "bg-blue-500 text-white" : "bg-green-500 text-white"
             )}>
               {msg.type === 'incoming' ? <ArrowRight size={10} /> : <ArrowLeft size={10} />}
             </div>

             <div className="flex justify-between items-start mb-2">
               <span className="text-[10px] font-black text-[#9A8262] uppercase tracking-widest">
                 {msg.type === 'incoming' ? msg.senderName || 'Client' : 'System / Automated'}
               </span>
               <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#9A8262] bg-white/50 px-1.5 py-0.5 rounded shadow-inner">
                 <Clock size={10} />
                 {format(new Date(msg.timestamp), 'dd MMM, hh:mm a')}
               </div>
             </div>

             <p className="text-sm text-[#2A1C00] font-medium leading-relaxed whitespace-pre-wrap">
               {msg.content}
             </p>
           </div>
        </div>
      ))}
    </div>
  );
}
