import React, { useState } from 'react';
import { 
  Plus, 
  Layers, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Paperclip, 
  FileText, 
  Image as ImageIcon, 
  Video,
  Save,
  MessageSquare
} from 'lucide-react';
import { Template, TemplateType } from '../types';
import { generateId } from '../lib/storage';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface TemplateManagerProps {
  templates: Template[];
  onSave: (template: Template) => void;
  onDelete: (id: string) => void;
}

export default function TemplateManager({ templates, onSave, onDelete }: TemplateManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'custom' as TemplateType,
    message: '',
    fileData: null as string | null,
    fileName: '',
    fileType: 'none' as Template['fileType']
  });

  const openModal = (t?: Template) => {
    if (t) {
      setEditingTemplate(t);
      setFormData({
        name: t.name,
        type: t.type,
        message: t.message,
        fileData: t.fileData || null,
        fileName: t.fileName || '',
        fileType: t.fileType
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        type: 'custom',
        message: '',
        fileData: null,
        fileName: '',
        fileType: 'none'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File too large (max 5MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      const ext = file.name.split('.').pop()?.toLowerCase();
      let type: Template['fileType'] = 'none';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) type = 'image';
      else if (ext === 'pdf') type = 'pdf';
      else if (['mp4', 'mov', 'avi'].includes(ext || '')) type = 'video';

      setFormData(prev => ({
        ...prev,
        fileData: data,
        fileName: file.name,
        fileType: type
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const template: Template = {
      id: editingTemplate?.id || generateId(),
      name: formData.name,
      type: formData.type,
      message: formData.message,
      fileData: formData.fileData,
      fileName: formData.fileName,
      fileType: formData.fileType,
      active: editingTemplate ? editingTemplate.active : true
    };
    onSave(template);
    closeModal();
  };

  const types: Record<TemplateType, string> = {
    reminder: '📅 Reminder',
    welcome: '👋 Welcome',
    thank_you: '🙏 Thank You',
    follow_up: '🔄 Follow Up',
    custom: '✏️ Custom'
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] flex items-center gap-2">
          <Layers className="text-[#C9A84C]" />
          WhatsApp Templates
        </h2>
        <button 
          onClick={() => openModal()}
          className="bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:translate-y-[-1px] transition-all"
        >
          <Plus size={18} /> New Template
        </button>
      </div>

      <div className="bg-gradient-to-r from-[#FFFBF0] to-[#FFF8E1] border border-[#E8C97A] rounded-xl p-4 text-[13px] text-[#5C4820] leading-relaxed flex items-start gap-3">
        <div className="w-8 h-8 bg-[#C9A84C]/10 rounded-lg flex items-center justify-center text-[#C9A84C] shrink-0">
          <Layers size={16} />
        </div>
        <div>
          <strong className="text-[#C9A84C]">Variables:</strong> &nbsp;
          <code className="bg-[#C9A84C]/10 px-1.5 py-0.5 rounded text-[#C9A84C] font-bold">{"{client_name}"}</code> &nbsp;
          <code className="bg-[#C9A84C]/10 px-1.5 py-0.5 rounded text-[#C9A84C] font-bold">{"{visit_date}"}</code> &nbsp;
          <code className="bg-[#C9A84C]/10 px-1.5 py-0.5 rounded text-[#C9A84C] font-bold">{"{mobile}"}</code>
          <p className="mt-1 opacity-70">These will be replaced with actual client data when sending messages.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(t => (
          <div 
            key={t.id} 
            className={cn(
              "bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm flex flex-col transition-all hover:shadow-md",
              !t.active && "opacity-60 grayscale-[0.5]"
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                {types[t.type]}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => openModal(t)}
                  className="p-1.5 text-[#9A8262] hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg transition-all"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={() => {
                    const newT = { ...t, active: !t.active };
                    onSave(newT);
                  }}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    t.active ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"
                  )}
                >
                  {t.active ? <Check size={16} /> : <X size={16} />}
                </button>
                <button 
                  onClick={() => { if(confirm('Delete this template?')) onDelete(t.id); }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className="font-bold text-[15px] text-[#2A1C00] mb-2">{t.name}</h3>
            <p className="text-[#9A8262] text-[12.5px] leading-relaxed line-clamp-4 flex-1">
              {t.message}
            </p>

            {t.fileType !== 'none' && (
              <div className="mt-4 pt-4 border-t border-[#E6D8B8]/50 flex items-center gap-2 text-[11px] font-bold text-blue-600">
                {t.fileType === 'image' && <ImageIcon size={14} />}
                {t.fileType === 'pdf' && <FileText size={14} />}
                {t.fileType === 'video' && <Video size={14} />}
                <span className="truncate">{t.fileName || t.fileType}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
                <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00]">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h3>
                <button onClick={closeModal} className="text-[#9A8262] hover:text-[#2A1C00]"><X size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Template Name *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Visit Reminder"
                      className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Type</label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as TemplateType }))}
                      className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                    >
                      {Object.entries(types).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Message Content *</label>
                  <textarea 
                    required
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    rows={5}
                    placeholder="Dear {client_name}, your visit on {visit_date}..."
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Attach File (Image/PDF/Video)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-[#E6D8B8] rounded-xl p-4 cursor-pointer hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 transition-all">
                      <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf,video/*" />
                      <Paperclip size={18} className="text-[#C9A84C]" />
                      <span className="text-sm text-[#9A8262]">
                        {formData.fileName ? formData.fileName : 'Click to upload (Max 5MB)'}
                      </span>
                    </label>
                    {formData.fileData && (
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, fileData: null, fileName: '', fileType: 'none' }))}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={closeModal}
                    className="flex-1 bg-white border border-[#E6D8B8] text-[#9A8262] font-bold py-3 rounded-xl hover:text-[#2A1C00] transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] font-bold py-3 rounded-xl shadow-md hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> {editingTemplate ? 'Update Template' : 'Save Template'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
