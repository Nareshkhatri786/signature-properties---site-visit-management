import React, { useMemo, useState } from 'react';
import { ExternalLink, Building2, Save } from 'lucide-react';
import { InventoryUnit, Lead, Project, User, Visit } from '../types';
import { generateId } from '../lib/storage';

interface InventoryModuleProps {
  projects: Project[];
  leads: Lead[];
  visits: Visit[];
  units: InventoryUnit[];
  user: User;
  onSave: (unit: InventoryUnit) => void;
}

const INVENTORY_LINKS: Record<string, string> = {
  "shreemad family": "https://shreemad.sigprop.in/",
  "royal rudraksha": "https://royal.sigprop.in/",
};

export default function InventoryModule({ projects, leads, visits, units, user, onSave }: InventoryModuleProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [unitCode, setUnitCode] = useState('');
  const [leadId, setLeadId] = useState('');
  const [visitId, setVisitId] = useState('');
  const [status, setStatus] = useState<InventoryUnit['status']>('shortlisted');
  const [note, setNote] = useState('');

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectNameKey = (selectedProject?.name || '').toLowerCase();
  const inventoryUrl = INVENTORY_LINKS[projectNameKey] || '';
  const isManager = (user.role || '').toLowerCase() === 'manager' || (user.role || '').toLowerCase() === 'admin' || (user.role || '').toLowerCase() === 'adm';

  const projectUnits = useMemo(
    () => units.filter(u => u.projectId === selectedProjectId).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
    [units, selectedProjectId]
  );

  const eligibleVisits = useMemo(
    () => visits.filter(v => v.projectId === selectedProjectId && v.visit_status === 'completed'),
    [visits, selectedProjectId]
  );

  const createOrUpdate = () => {
    if (!selectedProjectId || !unitCode.trim()) return;
    const existing = projectUnits.find(u => u.unitCode.toLowerCase() === unitCode.trim().toLowerCase());
    const now = new Date().toISOString();
    const next: InventoryUnit = {
      id: existing?.id || generateId(),
      projectId: selectedProjectId,
      unitCode: unitCode.trim(),
      unitTitle: existing?.unitTitle || '',
      inventoryUrl: inventoryUrl || existing?.inventoryUrl || '',
      status,
      shortlistedByLeadId: leadId || null,
      shortlistedByVisitId: visitId || null,
      note: note.trim() || null,
      updatedByUserId: user.id,
      updatedByUserName: user.name,
      created_at: existing?.created_at || now,
      updated_at: now
    };
    onSave(next);
    setUnitCode('');
    setLeadId('');
    setVisitId('');
    setStatus('shortlisted');
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {inventoryUrl && (
            <a href={inventoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[#C9A84C]">
              <ExternalLink size={14} /> Open {selectedProject?.name} Inventory
            </a>
          )}
        </div>
      </div>

      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input value={unitCode} onChange={(e) => setUnitCode(e.target.value)} placeholder="Unit no. / code" className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm" />
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm">
          <option value="">Lead (optional)</option>
          {leads.filter(l => l.projectId === selectedProjectId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={visitId} onChange={(e) => setVisitId(e.target.value)} className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm">
          <option value="">Visit Done (optional)</option>
          {eligibleVisits.map(v => <option key={v.id} value={v.id}>{v.client_name} - {v.visit_date}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as InventoryUnit['status'])} className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm">
          <option value="shortlisted">Shortlisted</option>
          <option value="available">Available</option>
          <option value="hold">Hold</option>
          <option value="booked">Booked</option>
          <option value="sold">Sold</option>
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm" />
        <button
          onClick={createOrUpdate}
          className="bg-[#C9A84C] text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-2"
        >
          <Save size={14} /> Save
        </button>
      </div>

      <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E6D8B8] text-sm font-bold text-[#2A1C00] inline-flex items-center gap-2">
          <Building2 size={14} /> Inventory Status
        </div>
        <div className="divide-y divide-[#E6D8B8]/50">
          {projectUnits.map(u => {
            const lead = u.shortlistedByLeadId ? leads.find(l => l.id === u.shortlistedByLeadId) : null;
            const canChange = isManager || u.status === 'shortlisted';
            return (
              <div key={u.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="font-bold text-[#2A1C00] min-w-[110px]">{u.unitCode}</div>
                <div className="text-xs text-[#9A8262] flex-1">{lead ? `Shortlisted by: ${lead.name}` : 'No shortlist lead'} {u.note ? `• ${u.note}` : ''}</div>
                <select
                  value={u.status}
                  disabled={!canChange}
                  onChange={(e) => onSave({ ...u, status: e.target.value as InventoryUnit['status'], updated_at: new Date().toISOString(), updatedByUserId: user.id, updatedByUserName: user.name })}
                  className="bg-white border border-[#E6D8B8] rounded-md py-1.5 px-2 text-xs"
                >
                  <option value="shortlisted">Shortlisted</option>
                  <option value="available">Available</option>
                  <option value="hold">Hold</option>
                  <option value="booked">Booked</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
            );
          })}
          {projectUnits.length === 0 && <div className="px-4 py-6 text-sm text-[#9A8262]">No inventory actions yet for this project.</div>}
        </div>
      </div>
    </div>
  );
}
