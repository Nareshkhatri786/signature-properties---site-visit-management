import React, { useState } from 'react';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  Settings2, 
  ToggleLeft as Toggle, 
  ToggleRight,
  ChevronRight,
  Info,
  X
} from 'lucide-react';
import { WebhookConfig, Project, User } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { generateId } from '../lib/storage';

interface WebhookSettingsProps {
  configs: WebhookConfig[];
  projects: Project[];
  users: User[];
  onSave: (config: WebhookConfig) => void;
  onDelete: (id: string) => void;
}

export default function WebhookSettings({ configs, projects, users, onSave, onDelete }: WebhookSettingsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WebhookConfig | null>(null);

  const [formData, setFormData] = useState<Partial<WebhookConfig>>({
    name: '',
    mapping: {
      'full_name': 'name',
      'phone_number': 'mobile',
      'email_address': 'email'
    },
    projectId: undefined,
    assignedTo: undefined,
    active: true
  });

  const handleOpenModal = (config?: WebhookConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData(config);
    } else {
      setEditingConfig(null);
      setFormData({
        name: '',
        token: Math.random().toString(36).slice(2, 15),
        mapping: {
          'full_name': 'name',
          'phone_number': 'mobile',
          'email_address': 'email'
        },
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) return toast.error('Name is required');
    onSave({
      ...formData as WebhookConfig,
      id: editingConfig?.id || generateId()
    });
    setIsModalOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Webhook URL copied!');
  };

  const updateMapping = (key: string, value: string) => {
    setFormData({
      ...formData,
      mapping: { ...formData.mapping, [key]: value }
    });
  };

  const addMappingRow = () => {
    setFormData({
      ...formData,
      mapping: { ...formData.mapping, '': '' }
    });
  };

  const removeMappingRow = (key: string) => {
    const newMapping = { ...formData.mapping };
    delete newMapping[key];
    setFormData({ ...formData, mapping: newMapping });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] flex items-center gap-2">
          <Webhook className="text-[#C9A84C]" />
          Webhook Integrations
        </h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[#C9A84C] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-[#B0923D] transition-all text-sm"
        >
          <Plus size={18} /> Create Webhook
        </button>
      </div>

      <div className="bg-[#F8FFF8] border border-[#A9DFBF] rounded-xl p-4 flex gap-3 items-start">
        <Info size={18} className="text-[#1A6B3C] shrink-0 mt-0.5" />
        <div className="text-[12px] text-[#1A6B3C] leading-relaxed">
          <strong>How Webhooks Work:</strong><br />
          Use these URLs to receive leads from external sources like Facebook Ads, Website Forms, or Zapier. 
          Map the incoming JSON fields to our internal Lead fields (name, mobile, email) to ensure smooth data import.
          Duplicates are automatically prevented based on the mobile number.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Dedicated WhatsApp Webhook Card */}
        <div className="bg-[#FFFDF6] border-2 border-dashed border-[#C9A84C]/30 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute top-0 right-0">
            <div className="bg-[#C9A84C] text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-lg">
              Dedicated Integration
            </div>
          </div>
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-[#2A1C00]">WhatsApp Automated Receiver</h3>
                <p className="text-[11px] text-[#9A8262] font-medium">Maps recipient IDs to Projects & Users (Devi, Royal, Shreemad)</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[#968262] uppercase tracking-wider">Webhook Endpoint URL</label>
              <div className="flex items-center gap-2 bg-white border border-[#E6D8B8] rounded-lg p-2 pr-1 shadow-inner">
                <code className="text-[11px] text-[#C9A84C] font-mono font-bold truncate flex-1">
                  {window.location.origin}/api/webhook/whatsapp
                </code>
                <button 
                  onClick={() => copyToClipboard(`${window.location.origin}/api/webhook/whatsapp`)}
                  className="p-1.5 hover:bg-gray-100 rounded-md text-[#C9A84C] transition-colors"
                  title="Copy URL"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
               <div className="bg-white/50 border border-[#E6D8B8] rounded-lg p-2 text-center">
                 <div className="text-[9px] font-black text-[#9A8262] uppercase mb-1">Devi Bungalows</div>
                 <div className="text-[10px] text-[#2A1C00] font-bold">Assigned: Hemant</div>
               </div>
               <div className="bg-white/50 border border-[#E6D8B8] rounded-lg p-2 text-center">
                 <div className="text-[9px] font-black text-[#9A8262] uppercase mb-1">Royal Rudraksha</div>
                 <div className="text-[10px] text-[#2A1C00] font-bold">Assigned: Priyank</div>
               </div>
               <div className="bg-white/50 border border-[#E6D8B8] rounded-lg p-2 text-center">
                 <div className="text-[9px] font-black text-[#9A8262] uppercase mb-1">Shreemad Family</div>
                 <div className="text-[10px] text-[#2A1C00] font-bold">Assigned: Megha</div>
               </div>
            </div>
          </div>
          <div className="md:w-64 bg-[#FDFAF2] rounded-xl p-4 border border-[#E6D8B8] space-y-3">
            <h4 className="text-[10px] font-black text-[#2A1C00] uppercase tracking-widest border-b border-[#E6D8B8] pb-1.5">Logic Applied</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[10px] text-[#9A8262]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-1 shrink-0" />
                Existing lead? New follow-up created for today.
              </li>
              <li className="flex items-start gap-2 text-[10px] text-[#9A8262]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-1 shrink-0" />
                New lead? Automated project and user assignment.
              </li>
              <li className="flex items-start gap-2 text-[10px] text-[#9A8262]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-1 shrink-0" />
                WhatsApp messages logged in activity timeline.
              </li>
            </ul>
          </div>
        </div>

        {configs.map(config => (
          <div key={config.id} className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-[#2A1C00]">{config.name}</h3>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                  config.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                )}>
                  {config.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white border border-[#E6D8B8] rounded-lg p-2 pr-1">
                <code className="text-[11px] text-[#9A8262] truncate max-w-[300px]">
                  {window.location.origin}/api/webhooks/{config.token}
                </code>
                <button 
                  onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/${config.token}`)}
                  className="p-1.5 hover:bg-gray-100 rounded-md text-[#C9A84C] transition-colors"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleOpenModal(config)}
                className="flex items-center gap-2 px-4 py-2 border border-[#E6D8B8] rounded-lg text-sm font-semibold text-[#9A8262] hover:bg-white hover:text-[#2A1C00] transition-all"
              >
                <Settings2 size={16} /> Configure Mapping
              </button>
              <button 
                onClick={() => onDelete(config.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {configs.length === 0 && (
          <div className="text-center py-20 bg-[#FFFDF6] border border-dashed border-[#E6D8B8] rounded-xl">
            <Webhook size={48} className="mx-auto text-[#E6D8B8] mb-4" />
            <p className="text-[#9A8262] italic">No webhooks configured yet.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
              <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00]">
                {editingConfig ? 'Configure Webhook' : 'Create New Webhook'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#9A8262] hover:text-[#2A1C00]"><X size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Source Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Facebook Ads, Website Form"
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <button 
                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                      formData.active ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                    )}
                  >
                    {formData.active ? <ToggleRight size={20} /> : <Toggle size={20} />}
                    {formData.active ? 'Webhook Active' : 'Webhook Inactive'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Default Project</label>
                  <select 
                    value={formData.projectId || ''}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                  >
                    <option value="">No Project Mapping</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Assign To (Select multiple for Round Robin)</label>
                  <div className="bg-white border border-[#E6D8B8] rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-3 cursor-pointer hover:bg-[#FDFAF2] p-1 rounded transition-colors">
                        <input 
                          type="checkbox"
                          checked={(formData.assignedUserIds || []).includes(u.id) || formData.assignedTo === u.id}
                          onChange={(e) => {
                            const currentIds = formData.assignedUserIds || (formData.assignedTo ? [formData.assignedTo] : []);
                            let newIds: number[];
                            if (e.target.checked) {
                              newIds = [...currentIds, u.id];
                            } else {
                              newIds = currentIds.filter(id => id !== u.id);
                            }
                            setFormData({ 
                              ...formData, 
                              assignedUserIds: newIds,
                              assignedTo: newIds.length === 1 ? newIds[0] : undefined 
                            });
                          }}
                          className="rounded border-[#C9A84C] text-[#C9A84C] focus:ring-[#C9A84C]"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#2A1C00]">{u.name}</span>
                          <span className="text-[10px] text-[#9A8262]">{projects.find(p => p.id === u.projectId)?.name || 'No Project'}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {(formData.assignedUserIds?.length || 0) > 1 && (
                    <p className="text-[10px] text-green-600 font-bold italic mt-1 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Round Robin Enabled ({formData.assignedUserIds?.length} users)
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Field Mapping</label>
                  <button 
                    onClick={addMappingRow}
                    className="text-[11px] font-bold text-[#C9A84C] hover:underline"
                  >
                    + Add Field
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-4 text-[10px] font-bold text-[#9A8262] uppercase tracking-widest px-2">
                    <div className="col-span-3">Incoming JSON Key</div>
                    <div className="col-span-1 flex justify-center"><ChevronRight size={12} /></div>
                    <div className="col-span-3">Internal Lead Field</div>
                  </div>
                  {Object.entries(formData.mapping || {}).map(([key, value], idx) => (
                    <div key={idx} className="grid grid-cols-7 gap-4 items-center">
                      <div className="col-span-3">
                        <input 
                          type="text" 
                          defaultValue={key}
                          onBlur={(e) => {
                            const newKey = e.target.value;
                            if (newKey === key) return;
                            const newMapping = { ...formData.mapping };
                            delete newMapping[key];
                            newMapping[newKey] = value;
                            setFormData({ ...formData, mapping: newMapping });
                          }}
                          placeholder="e.g. full_name"
                          className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center text-[#C9A84C]">
                        <ChevronRight size={16} />
                      </div>
                      <div className="col-span-2">
                        <select 
                          value={value}
                          onChange={(e) => updateMapping(key, e.target.value)}
                          className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                        >
                          <option value="name">Name</option>
                          <option value="mobile">Mobile</option>
                          <option value="email">Email</option>
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button 
                          onClick={() => removeMappingRow(key)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-[#E6D8B8] flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-[#9A8262] hover:text-[#2A1C00]"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="bg-[#C9A84C] text-white px-8 py-2 rounded-lg font-bold shadow-md hover:bg-[#B0923D] transition-all"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
