import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  User, 
  Phone, 
  Calendar, 
  Layers, 
  Send, 
  Download, 
  Paperclip,
  Sparkles,
  Info
} from 'lucide-react';
import { Visit, Template, Page, Project } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface WhatsAppSenderProps {
  visits: Visit[];
  projects: Project[];
  templates: Template[];
  initialVisitId: string | null;
  initialMessage?: string | null;
  onLogActivity?: (targetId: string, targetName: string, details?: string) => void;
  onSaveMessage?: (leadId: string, content: string) => void;
}

export default function WhatsAppSender({ visits, projects, templates, initialVisitId, initialMessage, onLogActivity, onSaveMessage }: WhatsAppSenderProps) {
  const [selectedVisitId, setSelectedVisitId] = useState(initialVisitId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [message, setMessage] = useState(initialMessage || '');
  const [manualNumber, setManualNumber] = useState('');
  
  const selectedVisit = visits.find(v => v.id === selectedVisitId);
  const activeTemplates = templates.filter(t => t.active);

  useEffect(() => {
    if (initialVisitId) setSelectedVisitId(initialVisitId);
  }, [initialVisitId]);

  useEffect(() => {
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage]);

  const fillVars = (text: string, v: Partial<Visit>) => {
    const project = projects.find(p => p.id === v.projectId);
    const projectName = project?.name || '';
    
    return text
      .replace(/{client_name}/g, v.client_name || '')
      .replace(/{visit_date}/g, v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
      .replace(/{visit_status}/g, v.visit_status?.replace('_', ' ').toUpperCase() || '')
      .replace(/{mobile}/g, v.mobile || '')
      .replace(/{property_interest}/g, v.property_interest || '')
      .replace(/{budget}/g, v.budget || '')
      .replace(/{source}/g, v.source || '')
      .replace(/{project_name}/g, projectName)
      .replace(/{followup_date}/g, v.visit_date ? new Date(new Date(v.visit_date).getTime() + 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '')
      .replace(/{assigned_to}/g, v.assigned_to || '');
  };

  const handleTemplateSelect = (t: Template) => {
    setSelectedTemplateId(t.id);
    setMessage(fillVars(t.message, selectedVisit || {}));
  };

  const handleSend = () => {
    const num = (manualNumber || selectedVisit?.mobile || '').replace(/[^0-9]/g, '');
    if (!num) {
      toast.error('Please select a client or enter a mobile number');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    const finalNum = num.length === 10 ? `91${num}` : num;
    window.open(`https://wa.me/${finalNum}?text=${encodeURIComponent(message)}`, '_blank');
    
    if (selectedVisit) {
      if (onLogActivity) {
        onLogActivity(selectedVisit.id, selectedVisit.client_name, `Template: ${selectedTemplate?.name || 'Custom'}`);
      }
      if (onSaveMessage) {
        onSaveMessage(selectedVisit.leadId || selectedVisit.id, message);
      }
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] flex items-center gap-2">
          <MessageSquare className="text-[#25D366]" />
          Send WhatsApp Message
        </h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Left Column: Selection */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2]">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Select Client</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Client / Visit</label>
                <select 
                  value={selectedVisitId}
                  onChange={(e) => {
                    setSelectedVisitId(e.target.value);
                    if (selectedTemplateId) {
                      const t = templates.find(temp => temp.id === selectedTemplateId);
                      const v = visits.find(vis => vis.id === e.target.value);
                      if (t && v) setMessage(fillVars(t.message, v));
                    }
                  }}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="">– Select Client –</option>
                  {visits.sort((a, b) => a.client_name.localeCompare(b.client_name)).map(v => (
                    <option key={v.id} value={v.id}>{v.client_name} – {v.mobile}</option>
                  ))}
                </select>
              </div>

              {selectedVisit && (
                <div className="p-4 bg-[#F5EDD4]/50 border border-[#E6D8B8] rounded-xl space-y-2">
                  <p className="font-bold text-[#2A1C00] flex items-center gap-2">
                    <User size={14} className="text-[#C9A84C]" /> {selectedVisit.client_name}
                  </p>
                  <p className="text-green-600 font-semibold flex items-center gap-2 text-sm">
                    <Phone size={14} /> {selectedVisit.mobile}
                  </p>
                  <p className="text-[#9A8262] text-xs flex items-center gap-2">
                    <Calendar size={14} /> Visit: {new Date(selectedVisit.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              )}

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-[#E6D8B8]/50"></span></div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-[#9A8262]"><span className="bg-[#FFFDF6] px-2">Or</span></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Enter Number Manually</label>
                <input 
                  type="tel" 
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2]">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Select Template</h3>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
              {activeTemplates.length > 0 ? activeTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateSelect(t)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all group",
                    selectedTemplateId === t.id 
                      ? "bg-[#C9A84C]/10 border-[#C9A84C] shadow-sm" 
                      : "bg-white border-[#E6D8B8] hover:border-[#C9A84C]/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest bg-[#C9A84C]/10 px-2 py-0.5 rounded-full">
                      {t.type}
                    </span>
                    {t.fileType !== 'none' && (
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Paperclip size={10} /> {t.fileType}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-[13.5px] text-[#2A1C00] group-hover:text-[#C9A84C] transition-colors">{t.name}</p>
                  <p className="text-[#9A8262] text-[11.5px] line-clamp-2 mt-1">{t.message}</p>
                </button>
              )) : (
                <div className="text-center py-8 text-[#9A8262] opacity-40 italic text-sm">
                  No active templates found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Composer */}
        <div className="xl:col-span-3">
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden sticky top-24">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00] flex items-center gap-2">
                <Layers className="text-[#C9A84C]" size={18} />
                Message Composer
              </h3>
              {selectedTemplate && (
                <span className="text-[11.5px] font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-3 py-1 rounded-full">
                  {selectedTemplate.name}
                </span>
              )}
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Message</label>
                  <span className="text-[10px] text-[#9A8262] font-medium">
                    Variables: <code className="bg-[#F5EDD4] px-1 rounded">{"{client_name}"}</code> <code className="bg-[#F5EDD4] px-1 rounded">{"{visit_date}"}</code> <code className="bg-[#F5EDD4] px-1 rounded">{"{visit_status}"}</code> <code className="bg-[#F5EDD4] px-1 rounded">{"{project_name}"}</code>
                  </span>
                </div>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Select a template or type custom message..."
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                />
              </div>

              {selectedTemplate?.fileData && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-500 shadow-sm">
                      <Paperclip size={20} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-blue-900">{selectedTemplate.fileName || 'Attached File'}</p>
                      <p className="text-[11px] text-blue-700">Download and attach manually in WhatsApp</p>
                    </div>
                  </div>
                  <a 
                    href={selectedTemplate.fileData} 
                    download={selectedTemplate.fileName || 'file'}
                    className="bg-white text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  >
                    <Download size={18} />
                  </a>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Recipient Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8262]" />
                  <input 
                    type="text" 
                    readOnly
                    value={manualNumber || selectedVisit?.mobile || ''}
                    placeholder="Auto-filled from selection"
                    className="w-full bg-[#FDFAF2] border border-[#E6D8B8] rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#2A1C00] font-medium"
                  />
                </div>
              </div>

              <button 
                onClick={handleSend}
                className="w-full bg-[#25D366] text-white font-bold py-4 rounded-xl shadow-lg hover:translate-y-[-1px] hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
              >
                <Send size={20} /> Open WhatsApp & Send
              </button>

              <div className="bg-[#F8FFF8] border border-[#A9DFBF] rounded-xl p-4 flex gap-3 items-start">
                <Info size={18} className="text-[#1A6B3C] shrink-0 mt-0.5" />
                <div className="text-[12px] text-[#1A6B3C] leading-relaxed">
                  <strong>How it works:</strong><br />
                  1. Select client → 2. Pick template → 3. Click Send<br />
                  4. WhatsApp opens with message pre-filled → hit Send<br />
                  5. For files — download using the button above and attach in WhatsApp.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
