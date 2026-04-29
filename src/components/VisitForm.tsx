import React, { useState } from 'react';
import { ArrowLeft, Save, User, Phone, Calendar, Clock, Share2, UserCheck, Wallet, Home, StickyNote, UserPlus, MessageSquare, Star } from 'lucide-react';
import { Visit, Remark, LeadQuality, VisitStatus, Lead, LeadStatus, Settings, User as AppUser } from '../types';
import { generateId } from '../lib/storage';
import { toast } from 'react-hot-toast';
import { cn, getLocalDateString } from '../lib/utils';
import { normalizePhoneNumber } from '../lib/phoneUtils';

interface VisitFormProps {
  onSave: (visit: Visit, initialRemark?: Remark, leadStatus?: LeadStatus) => void;
  onCancel: () => void;
  initialLeadId?: string;
  leads?: Lead[];
  settings: Settings;
  projectId: string;
  currentUser: AppUser;
  users?: AppUser[]; // Making users optional just in case, but it's better to pass them
}

export default function VisitForm({ onSave, onCancel, initialLeadId, leads = [], settings, projectId, currentUser, users = [] }: VisitFormProps) {
  const initialLead = leads.find(l => l.id === initialLeadId);

  const [formData, setFormData] = useState({
    leadId: initialLeadId || '',
    client_name: initialLead?.name || '',
    mobile: initialLead?.mobile || '',
    email: initialLead?.email || '',
    visit_date: getLocalDateString(),
    visit_time: '',
    purpose: '',
    status: (initialLead?.quality || 'pending') as LeadQuality,
    lead_status: (initialLead?.status || 'visit_scheduled') as LeadStatus,
    visit_status: 'scheduled' as VisitStatus,
    assigned_to: currentUser.name,
    source: initialLead?.source || settings.sources[0] || '',
    budget: settings.budgets[0] || '',
    property_interest: settings.propertyInterests[0] || '',
    priority: initialLead?.priority || 0,
    initial_remark: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_name || !formData.mobile) {
      toast.error('Client Name and Mobile are required');
      return;
    }

    const digitsOnly = formData.mobile.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      toast.error('Mobile number must be exactly 10 digits');
      return;
    }

    const normalizedMobile = normalizePhoneNumber(digitsOnly);
    
    if (normalizedMobile.length < 13) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    // Deduplication check for new lead creation within visit form
    if (!formData.leadId) {
      const isDuplicate = (leads || []).some(l => normalizePhoneNumber(l.mobile) === normalizedMobile);
      if (isDuplicate) {
        toast.error('A lead with this mobile number already exists! Please select it from the list.');
        return;
      }
    }
    
    const visit: Visit = {
      id: generateId(),
      leadId: formData.leadId || null,
      client_name: formData.client_name,
      mobile: normalizedMobile,
      email: formData.email,
      visit_date: formData.visit_date,
      visit_time: formData.visit_time,
      purpose: formData.purpose,
      status: formData.status,
      visit_status: formData.visit_status,
      assigned_to: formData.assigned_to,
      source: formData.source,
      budget: formData.budget,
      property_interest: formData.property_interest,
      priority: formData.priority,
      created_at: new Date().toISOString(),
      projectId
    };

    let initialRemark: Remark | undefined;
    if (formData.initial_remark.trim()) {
      initialRemark = {
        id: generateId(),
        text: formData.initial_remark.trim(),
        by: currentUser.name,
        at: new Date().toISOString()
      };
    }

    onSave(visit, initialRemark, formData.lead_status);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] flex items-center gap-2">
          <UserPlus className="text-[#C9A84C]" />
          Add New Site Visit
        </h2>
        <button 
          onClick={onCancel}
          className="text-[#9A8262] hover:text-[#2A1C00] flex items-center gap-1.5 text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} /> Back to List
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2]">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Client Information</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {leads.length > 0 && (
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                    <User size={12} /> Select Existing Lead (Optional)
                  </label>
                  <select 
                    name="leadId"
                    value={formData.leadId}
                    onChange={(e) => {
                      const l = leads.find(lead => lead.id === e.target.value);
                      if (l) {
                        setFormData(prev => ({
                          ...prev,
                          leadId: l.id,
                          client_name: l.name,
                          mobile: l.mobile,
                          source: l.source,
                          status: l.quality,
                          priority: l.priority || 0,
                          lead_status: l.status === 'new' ? 'visit_scheduled' : l.status
                        }));
                      } else {
                        setFormData(prev => ({ ...prev, leadId: '' }));
                      }
                    }}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                  >
                    <option value="">– New Lead –</option>
                    {leads.sort((a, b) => a.name.localeCompare(b.name)).map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.mobile})</option>
                    ))}
                  </select>
                </div>
              )}

              <FormField label="Client Name *" icon={User}>
                <input 
                  type="text" 
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  required
                  placeholder="Full name"
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </FormField>

              <FormField label="Mobile Number *" icon={Phone}>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-bold text-[#9A8262] bg-[#F5F1E6] px-2 py-0.5 rounded border border-[#E6D8B8] pointer-events-none">+91</span>
                  <input 
                    type="tel" 
                    name="mobile"
                    required
                    maxLength={10}
                    value={formData.mobile.replace(/^\+91/, '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      handleChange({ target: { name: 'mobile', value: val.substring(0, 10) } } as any);
                    }}
                    placeholder="10-digit mobile"
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-[4.5rem] pr-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
              </FormField>

              <FormField label="Email Address" icon={MessageSquare}>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="client@email.com"
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </FormField>

              <FormField label="Visit Date *" icon={Calendar}>
                <input 
                  type="date" 
                  name="visit_date"
                  value={formData.visit_date}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </FormField>

              <FormField label="Visit Time" icon={Clock}>
                <input 
                  type="time" 
                  name="visit_time"
                  value={formData.visit_time}
                  onChange={handleChange}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </FormField>

              <FormField label="Source" icon={Share2}>
                <select 
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="">Select source</option>
                  {settings.sources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>

              <FormField label="Assigned To" icon={UserCheck}>
                <select 
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleChange}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {users.filter(u => u.projectId === projectId || u.role === 'admin').map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Budget" icon={Wallet}>
                <select 
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="">Select budget</option>
                  {settings.budgets.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </FormField>

              <FormField label="Property Interest" icon={Home}>
                <select 
                  name="property_interest"
                  value={formData.property_interest}
                  onChange={handleChange}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="">Select interest</option>
                  {settings.propertyInterests.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </FormField>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
                  <StickyNote size={12} /> Notes / Purpose
                </label>
                <textarea 
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  rows={3}
                  placeholder="What is the client looking for..."
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2]">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Initial Remark</h3>
            </div>
            <div className="p-6">
              <textarea 
                name="initial_remark"
                value={formData.initial_remark}
                onChange={handleChange}
                rows={3}
                placeholder="Add an initial note about the visit..."
                className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] resize-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2]">
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Status</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#E6D8B8]">
                <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Priority</label>
                <div className="flex gap-1">
                  {[1, 2, 3].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: formData.priority === star ? 0 : star })}
                      className="transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star 
                        size={20} 
                        className={cn(
                          star <= formData.priority 
                            ? "text-yellow-400 fill-yellow-400" 
                            : "text-gray-300"
                        )} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Quality</label>
                <select 
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
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
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Lead Status</label>
                <select 
                  name="lead_status"
                  value={formData.lead_status}
                  onChange={handleChange}
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
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Visit Status</label>
                <select 
                  name="visit_status"
                  value={formData.visit_status}
                  onChange={handleChange}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
                >
                  <option value="scheduled">📅 Scheduled</option>
                  <option value="completed">✅ Completed</option>
                  <option value="rescheduled">🔄 Rescheduled</option>
                  <option value="cancelled">❌ Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#F0FAF5] to-[#E8F8EF] border border-[#A9DFBF] rounded-xl p-6 shadow-sm">
            <p className="text-[#1A6B3C] text-sm leading-relaxed mb-6">
              <span className="font-bold flex items-center gap-2 mb-2">
                <MessageSquare size={16} className="text-[#25D366]" /> WhatsApp Ready
              </span>
              After saving, you can send a personalized welcome message or follow-up directly to the client.
            </p>
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] font-bold py-3 rounded-lg shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} /> Save Visit
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, icon: Icon, children }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </label>
      {children}
    </div>
  );
}
