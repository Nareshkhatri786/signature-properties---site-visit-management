import React, { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Play, 
  Settings2, 
  AlertCircle,
  Clock,
  UserPlus,
  MessageSquare,
  RefreshCw,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Activity,
  Filter
} from 'lucide-react';
import { Workflow, WorkflowTrigger, WorkflowAction, Project, User as AppUser } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface WorkflowBuilderProps {
  projects: Project[];
  users: AppUser[];
  onSave: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
  workflows: Workflow[];
}

export default function WorkflowBuilder({ projects, users, onSave, onDelete, workflows }: WorkflowBuilderProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Partial<Workflow> | null>(null);
  const [search, setSearch] = useState('');

  const handleCreate = () => {
    const newWorkflow: Partial<Workflow> = {
      id: 'wf_' + Date.now(),
      name: '',
      description: '',
      isActive: true,
      trigger: 'lead_created',
      conditions: [],
      actions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingWorkflow(newWorkflow);
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!editingWorkflow?.name) {
      toast.error('Workflow name is required');
      return;
    }
    if (editingWorkflow.actions?.length === 0) {
      toast.error('Add at least one action');
      return;
    }
    onSave(editingWorkflow as Workflow);
    setIsAdding(false);
    setEditingWorkflow(null);
  };

  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    w.trigger.includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-['Cormorant_Garamond'] font-bold text-[#2A1C00]">Workflow Builder</h2>
          <p className="text-sm text-[#9A8262]">Automate your lead routing and follow-up processes</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-[#C9A84C] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#B0923D] transition-all shadow-lg shadow-[#C9A84C]/20"
        >
          <Plus size={18} /> Create Workflow
        </button>
      </div>

      {!isAdding ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A8262]" size={18} />
            <input 
              type="text"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-[#E6D8B8] rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-[#C9A84C] shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredWorkflows.map((w) => (
              <motion.div 
                key={w.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-[#E6D8B8] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border",
                      w.isActive ? "bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/20" : "bg-gray-100 text-gray-400 border-gray-200"
                    )}>
                      <Zap size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2A1C00]">{w.name}</h3>
                      <p className="text-[11px] text-[#9A8262] uppercase tracking-wider font-bold">Trigger: {w.trigger.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingWorkflow(w);
                        setIsAdding(true);
                      }}
                      className="p-2 text-[#9A8262] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] rounded-lg transition-colors"
                    >
                      <Settings2 size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(w.id)}
                      className="p-2 text-[#9A8262] hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-[#9A8262] mb-4 line-clamp-2 leading-relaxed">{w.description || 'No description provided.'}</p>

                <div className="flex items-center justify-between pt-4 border-t border-[#F2ECD8]">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#9A8262]">
                      <Activity size={14} />
                      {w.actions.length} Actions
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#9A8262]">
                      <Filter size={14} />
                      {w.conditions.length} Conditions
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-[1px] px-2 py-1 rounded-full",
                      w.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                    )}>
                      {w.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredWorkflows.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white/50 border-2 border-dashed border-[#E6D8B8] rounded-3xl">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-[#E6D8B8]">
                  <Zap size={32} className="text-[#E6D8B8]" />
                </div>
                <p className="text-[#9A8262] font-medium">No workflows found. Let's build your first automation!</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-[#E6D8B8] rounded-[2rem] shadow-xl overflow-hidden"
        >
          <div className="p-6 md:p-8 border-b border-[#F2ECD8] flex items-center justify-between bg-[#FCFAF5]">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingWorkflow(null);
                }}
                className="p-2 hover:bg-[#E6D8B8]/50 rounded-xl transition-colors"
              >
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <div>
                <h3 className="text-xl font-bold text-[#2A1C00]">Workflow Configuration</h3>
                <p className="text-xs text-[#9A8262] uppercase tracking-widest font-black opacity-60">Building: {editingWorkflow?.name || 'Untitled Workflow'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-bold text-[#9A8262] uppercase tracking-wider">Active</span>
                <div 
                  onClick={() => setEditingWorkflow(prev => ({ ...prev, isActive: !prev?.isActive }))}
                  className={cn(
                    "w-12 h-6 rounded-full p-1 transition-colors",
                    editingWorkflow?.isActive ? "bg-[#C9A84C]" : "bg-gray-200"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full transition-transform",
                    editingWorkflow?.isActive ? "translate-x-6" : "translate-x-0"
                  )} />
                </div>
              </label>
              <button 
                onClick={handleSave}
                className="bg-[#C9A84C] text-white px-8 py-2.5 rounded-xl font-bold hover:bg-[#B0923D] transition-all shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Step 1: Trigger */}
            <div className="lg:col-span-4 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#C9A84C] text-white rounded-lg flex items-center justify-center font-black text-sm">1</div>
                  <h4 className="font-bold text-[#2A1C00] uppercase tracking-wider text-sm">Trigger Event</h4>
                </div>
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-[#9A8262] uppercase tracking-wider">Workflow Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Auto-Assign Facebook Leads"
                    value={editingWorkflow?.name || ''}
                    onChange={(e) => setEditingWorkflow(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-[#FAF9F6] border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-[#9A8262] uppercase tracking-wider">Description</label>
                  <textarea 
                    placeholder="Describe what this workflow does..."
                    value={editingWorkflow?.description || ''}
                    onChange={(e) => setEditingWorkflow(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-[#FAF9F6] border border-[#E6D8B8] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-[#C9A84C] h-24 resize-none"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-[#9A8262] uppercase tracking-wider">When this happens...</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'lead_created', label: 'New Lead Created', icon: UserPlus },
                      { id: 'status_changed', label: 'Lead Status Changed', icon: RefreshCw },
                      { id: 'visit_scheduled', label: 'Site Visit Scheduled', icon: Clock },
                      { id: 'no_activity', label: 'No Activity (Stale)', icon: AlertCircle },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setEditingWorkflow(prev => ({ ...prev, trigger: t.id as WorkflowTrigger }))}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                          editingWorkflow?.trigger === t.id 
                            ? "bg-[#C9A84C]/5 border-[#C9A84C] text-[#C9A84C]" 
                            : "bg-[#FAF9F6] border-[#E6D8B8] text-[#9A8262] hover:border-[#C9A84C]/30"
                        )}
                      >
                        <t.icon size={18} />
                        <span className="text-sm font-bold">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 & 3: Conditions & Actions */}
            <div className="lg:col-span-8 space-y-8">
              {/* Conditions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#C9A84C] text-white rounded-lg flex items-center justify-center font-black text-sm">2</div>
                    <h4 className="font-bold text-[#2A1C00] uppercase tracking-wider text-sm">Conditions (Optional)</h4>
                  </div>
                  <button 
                    onClick={() => setEditingWorkflow(prev => ({ 
                      ...prev, 
                      conditions: [...(prev?.conditions || []), { field: 'source', operator: 'equals', value: '' }] 
                    }))}
                    className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> Add Condition
                  </button>
                </div>

                <div className="space-y-3">
                  {editingWorkflow?.conditions?.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-[#FAF9F6] p-4 rounded-xl border border-[#E6D8B8]">
                      <select 
                        value={c.field}
                        onChange={(e) => {
                          const newConds = [...(editingWorkflow.conditions || [])];
                          newConds[idx].field = e.target.value;
                          setEditingWorkflow(prev => ({ ...prev, conditions: newConds }));
                        }}
                        className="bg-white border border-[#E6D8B8] rounded-lg px-3 py-2 text-sm focus:outline-none"
                      >
                        <option value="source">Source</option>
                        <option value="projectId">Project</option>
                        <option value="status">Status</option>
                        <option value="quality">Quality</option>
                      </select>
                      <select 
                        value={c.operator}
                        onChange={(e) => {
                          const newConds = [...(editingWorkflow.conditions || [])];
                          newConds[idx].operator = e.target.value as any;
                          setEditingWorkflow(prev => ({ ...prev, conditions: newConds }));
                        }}
                        className="bg-white border border-[#E6D8B8] rounded-lg px-3 py-2 text-sm focus:outline-none"
                      >
                        <option value="equals">Equals</option>
                        <option value="contains">Contains</option>
                      </select>
                      <input 
                        type="text"
                        value={c.value}
                        onChange={(e) => {
                          const newConds = [...(editingWorkflow.conditions || [])];
                          newConds[idx].value = e.target.value;
                          setEditingWorkflow(prev => ({ ...prev, conditions: newConds }));
                        }}
                        placeholder="Value..."
                        className="flex-1 bg-white border border-[#E6D8B8] rounded-lg px-3 py-2 text-sm focus:outline-none"
                      />
                      <button 
                        onClick={() => setEditingWorkflow(prev => ({ 
                          ...prev, 
                          conditions: prev?.conditions?.filter((_, i) => i !== idx) 
                        }))}
                        className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {editingWorkflow?.conditions?.length === 0 && (
                    <div className="bg-[#FAF9F6]/50 border border-dashed border-[#E6D8B8] rounded-xl p-4 text-center text-xs text-[#9A8262] font-medium italic">
                      This workflow will run for every trigger event.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#C9A84C] text-white rounded-lg flex items-center justify-center font-black text-sm">3</div>
                    <h4 className="font-bold text-[#2A1C00] uppercase tracking-wider text-sm">Actions to Perform</h4>
                  </div>
                  <button 
                    onClick={() => setEditingWorkflow(prev => ({ 
                      ...prev, 
                      actions: [...(prev?.actions || []), { type: 'assign_user', params: {} }] 
                    }))}
                    className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> Add Action
                  </button>
                </div>

                <div className="space-y-4">
                  {editingWorkflow?.actions?.map((a, idx) => (
                    <div key={idx} className="bg-[#FAF9F6] p-6 rounded-2xl border border-[#E6D8B8] space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#C9A84C]"></div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white border border-[#E6D8B8] rounded-lg flex items-center justify-center text-[#C9A84C]">
                            {a.type === 'assign_user' && <UserPlus size={16} />}
                            {a.type === 'send_whatsapp' && <MessageSquare size={16} />}
                            {a.type === 'schedule_followup' && <Clock size={16} />}
                            {a.type === 'change_status' && <RefreshCw size={16} />}
                          </div>
                          <select 
                            value={a.type}
                            onChange={(e) => {
                              const newType = e.target.value as WorkflowAction;
                              const newActions = [...(editingWorkflow.actions || [])];
                              newActions[idx].type = newType;
                              
                              // Set default params based on type
                              if (newType === 'assign_user') newActions[idx].params = { userId: users[0]?.id };
                              if (newType === 'change_status') newActions[idx].params = { status: 'contacted' };
                              if (newType === 'send_whatsapp') newActions[idx].params = { message: 'Hello {name}, thank you for your enquiry!' };
                              if (newType === 'schedule_followup') newActions[idx].params = { days: 1, purpose: 'General Follow-up' };
                              
                              setEditingWorkflow(prev => ({ ...prev, actions: newActions }));
                            }}
                            className="bg-transparent font-bold text-[#2A1C00] text-sm focus:outline-none"
                          >
                            <option value="assign_user">Assign to User</option>
                            <option value="send_whatsapp">Send WhatsApp Message</option>
                            <option value="schedule_followup">Schedule Follow-up</option>
                            <option value="change_status">Change Lead Status</option>
                          </select>
                        </div>
                        <button 
                          onClick={() => setEditingWorkflow(prev => ({ 
                            ...prev, 
                            actions: prev?.actions?.filter((_, i) => i !== idx) 
                          }))}
                          className="p-2 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {a.type === 'assign_user' && (
                          <div className="col-span-full space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#9A8262] opacity-70">Target User</label>
                            <select 
                              value={a.params.userId || ''}
                              onChange={(e) => {
                                const newActions = [...(editingWorkflow.actions || [])];
                                newActions[idx].params.userId = parseInt(e.target.value);
                                setEditingWorkflow(prev => ({ ...prev, actions: newActions }));
                              }}
                              className="w-full bg-white border border-[#E6D8B8] rounded-xl px-4 py-2.5 text-sm"
                            >
                              <option value="">Select User...</option>
                              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                            </select>
                          </div>
                        )}
                        {a.type === 'send_whatsapp' && (
                          <div className="col-span-full space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#9A8262] opacity-70">Message Content</label>
                            <textarea 
                              placeholder="Type your automated message..."
                              value={a.params.message || ''}
                              onChange={(e) => {
                                const newActions = [...(editingWorkflow.actions || [])];
                                newActions[idx].params.message = e.target.value;
                                setEditingWorkflow(prev => ({ ...prev, actions: newActions }));
                              }}
                              className="w-full bg-white border border-[#E6D8B8] rounded-xl px-4 py-2.5 text-sm h-24 resize-none"
                            />
                          </div>
                        )}
                        {a.type === 'change_status' && (
                          <div className="col-span-full space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#9A8262] opacity-70">New Status</label>
                            <select 
                              value={a.params.status || ''}
                              onChange={(e) => {
                                const newActions = [...(editingWorkflow.actions || [])];
                                newActions[idx].params.status = e.target.value;
                                setEditingWorkflow(prev => ({ ...prev, actions: newActions }));
                              }}
                              className="w-full bg-white border border-[#E6D8B8] rounded-xl px-4 py-2.5 text-sm"
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="visit_scheduled">Visit Scheduled</option>
                              <option value="visit_done">Visit Done</option>
                              <option value="closed">Closed</option>
                              <option value="lost">Lost</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
