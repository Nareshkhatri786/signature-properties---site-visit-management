import React, { useState } from 'react';
import { 
  UserPlus, 
  X, 
  Phone, 
  User, 
  Tag, 
  Info,
  AlertCircle,
  Star
} from 'lucide-react';
import { Lead, LeadQuality, LeadStatus, User as AppUser } from '../types';
import { generateId } from '../lib/storage';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { normalizePhoneNumber } from '../lib/phoneUtils';

interface LeadFormProps {
  onSave: (lead: Lead) => void;
  onClose: () => void;
  existingLeads: Lead[];
  sources: string[];
  projectId: string;
  users: AppUser[];
  currentUser: AppUser;
}

export default function LeadForm({ onSave, onClose, existingLeads, sources, projectId, users, currentUser }: LeadFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    source: sources[0] || 'Manual Entry',
    quality: 'pending' as LeadQuality,
    status: 'new' as LeadStatus,
    assignedTo: currentUser.id as number | null,
    priority: 0,
    property_interest: ''
  });

  // Project defaults mapping
  const projectDefaults: Record<string, string> = {
    'p1': '3 BHK', // Signature Properties
    'p2': '3 BHK', // Shreemad Family
    'p3': '4 BHK', // Devi Bungalows
    'p4': '3 BHK', // Royal Rudraksha
    'p5': '4 BHK'  // Kalash Heritage
  };

  const handleProjectChange = (id: string) => {
    setFormData(prev => ({
      ...prev,
      property_interest: projectDefaults[id] || prev.property_interest
    }));
  };

  // Set initial default if needed
  React.useEffect(() => {
    if (projectId && !formData.property_interest) {
      handleProjectChange(projectId);
    }
  }, [projectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.mobile) {
      toast.error('Name and Mobile are required');
      return;
    }

    const digitsOnly = formData.mobile.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      toast.error('Mobile number must be exactly 10 digits');
      return;
    }

    const normalizedMobile = normalizePhoneNumber(digitsOnly);

    // Deduplication with normalized numbers
    const isDuplicate = existingLeads.some(l => normalizePhoneNumber(l.mobile) === normalizedMobile);
    if (isDuplicate) {
      toast.error('A lead with this mobile number already exists!');
      return;
    }

    const newLead: Lead = {
      id: generateId(),
      name: formData.name,
      mobile: normalizedMobile,
      email: formData.email,
      source: formData.source,
      quality: formData.quality,
      status: formData.status,
      assignedTo: formData.assignedTo || null,
      property_interest: formData.property_interest || projectDefaults[projectId] || '',
      priority: formData.priority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stats: {
        visits_planned: 0,
        visits_done: 0,
        calls_attempted: 0,
        calls_answered: 0,
        followups_done: 0
      }
    };

    onSave(newLead);
    toast.success('Lead added successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
          <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00] flex items-center gap-2">
            <UserPlus className="text-[#C9A84C]" />
            Add New Lead
          </h3>
          <button onClick={onClose} className="text-[#9A8262] hover:text-[#2A1C00] transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex items-center justify-between bg-[#FDFAF2] p-3 rounded-xl border border-[#E6D8B8]">
            <label className="text-xs font-bold text-[#9A8262] uppercase tracking-wider">Priority / Stars</label>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: formData.priority === star ? 0 : star })}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star 
                    size={24} 
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
            <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Full Name *</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8262]" />
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Client's full name"
                className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Mobile Number *</label>
            <div className="relative flex items-center">
              <Phone size={14} className="absolute left-3.5 text-[#9A8262]" />
              <span className="absolute left-9 text-[10px] font-bold text-[#9A8262]/50 bg-[#F5F1E6] px-1 py-0.5 rounded border border-[#E6D8B8]/30 pointer-events-none">+91</span>
              <input 
                type="tel" 
                required
                maxLength={10}
                value={formData.mobile.replace(/^\+91/, '')}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, mobile: val.substring(0, 10) });
                }}
                placeholder="10-digit mobile"
                className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 pl-16 pr-4 text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Property Interest (BHK)</label>
            <select 
              value={formData.property_interest}
              onChange={(e) => setFormData({ ...formData, property_interest: e.target.value })}
              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
            >
              <option value="">Select interest</option>
              <option value="2 BHK">2 BHK</option>
              <option value="3 BHK">3 BHK</option>
              <option value="4 BHK">4 BHK</option>
              <option value="Penthouse">Penthouse</option>
              <option value="Shop">Shop</option>
              <option value="Office">Office</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Quality</label>
              <select 
                value={formData.quality}
                onChange={(e) => setFormData({ ...formData, quality: e.target.value as LeadQuality })}
                className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
              >
                <option value="pending">Pending</option>
                <option value="hot">🔥 Hot</option>
                <option value="warm">🌡️ Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Assign To</label>
              <select 
                value={formData.assignedTo || ''}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
              >
                <option value="">Unassigned</option>
                {users.filter(u => {
                  const isAdmin = currentUser.role.toLowerCase() === 'admin' || currentUser.role.toLowerCase() === 'adm';
                  return isAdmin || u.projectId === projectId;
                }).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Info size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8262]" />
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@email.com"
                className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#C9A84C]"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              <strong>Deduplication:</strong> The system will automatically check if a lead with the same mobile number already exists to prevent duplicates.
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 text-sm font-bold text-[#9A8262] hover:text-[#2A1C00] transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#1C1207] font-bold py-3 rounded-xl shadow-lg hover:translate-y-[-1px] transition-all"
            >
              Save Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
