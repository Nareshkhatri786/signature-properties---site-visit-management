import React, { useState } from 'react';
import { 
  Building, 
  Phone, 
  MapPin, 
  Key, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Save, 
  Info,
  AlertTriangle,
  Lock,
  CheckCircle2,
  User as UserIcon,
  Plus,
  Briefcase,
  X
} from 'lucide-react';
import { Settings, User, Visit, Remark, Template, CallLog, Lead, WebhookConfig, Project } from '../types';
import { toast } from 'react-hot-toast';
import { generateId } from '../lib/storage';

interface SettingsProps {
  user: User | null;
  settings: Settings;
  users: User[];
  projects: Project[];
  onSaveSettings: (settings: Settings) => void;
  onAddUser: (user: User) => void;
  onRemoveUser: (id: number) => void;
  onAddProject: (project: Project) => void;
  onRemoveProject: (id: string) => void;
  onImportData: (data: any) => void;
  allData: {
    visits: Visit[];
    remarks: Record<string, Remark[]>;
    templates: Template[];
    leads: Lead[];
    callLogs: CallLog[];
    webhookConfigs: WebhookConfig[];
  };
}

export default function SettingsPage({ 
  user,
  settings, 
  users, 
  projects, 
  onSaveSettings, 
  onAddUser, 
  onRemoveUser, 
  onAddProject, 
  onRemoveProject, 
  onImportData, 
  allData 
}: SettingsProps) {
  const [formData, setFormData] = useState(settings);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', projectId: projects[0]?.id || '', role: 'user' as 'admin' | 'user' });

  const userRole = user?.role?.toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'adm';

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
  };

  const handleAddProject = () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = { 
      id: generateId(), 
      name: newProjectName.trim(),
      location: { lat: 0, lng: 0, address: '', radius: 100 }
    };
    onAddProject(newProject);
    setNewProjectName('');
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    onAddProject(editingProject);
    setEditingProject(null);
    toast.success(`Project ${editingProject.name} updated`);
  };

  const handleRemoveProject = (id: string) => {
    if (projects.length <= 1) {
      toast.error('At least one project must exist');
      return;
    }
    if (confirm('Delete this project?')) {
      onRemoveProject(id);
    }
  };

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  
  const handleAddUser = () => {
    if (!newUser.username || (!editingUserId && !newUser.password) || !newUser.name || !newUser.projectId) {
      toast.error('All fields are required');
      return;
    }
    const newUserObj: User = {
      id: editingUserId || Date.now(),
      ...newUser
    };
    onAddUser(newUserObj);
    setNewUser({ username: '', password: '', name: '', projectId: projects[0]?.id || '', role: 'user' });
    setEditingUserId(null);
    toast.success(editingUserId ? 'User updated successfully' : 'User added successfully');
  };

  const handleEditUser = (u: User) => {
    setNewUser({
      username: u.username,
      password: '', // Keep blank unless changing
      name: u.name,
      projectId: u.projectId || projects[0]?.id || '',
      role: u.role as any
    });
    setEditingUserId(u.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveUser = (id: number) => {
    if (id === 1) {
      toast.error('Cannot remove primary administrator');
      return;
    }
    if (confirm('Delete this user?')) {
      onRemoveUser(id);
    }
  };

  const handleAddOption = (field: 'sources' | 'budgets' | 'propertyInterests', value: string) => {
    if (!value.trim()) return;
    if (formData[field].includes(value.trim())) {
      toast.error('Option already exists');
      return;
    }
    const newSettings = { ...formData, [field]: [...formData[field], value.trim()] };
    setFormData(newSettings);
    onSaveSettings(newSettings);
    toast.success('Option added');
  };

  const handleRemoveOption = (field: 'sources' | 'budgets' | 'propertyInterests', value: string) => {
    const newSettings = { ...formData, [field]: formData[field].filter(o => o !== value) };
    setFormData(newSettings);
    onSaveSettings(newSettings);
    toast.success('Option removed');
  };

  const handleChangePass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (user.password !== passwords.current) {
      toast.error('Current password incorrect');
      return;
    }
    if (passwords.new.length < 4) {
      toast.error('New password must be at least 4 chars');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }

    const updatedUser = { ...user, password: passwords.new };
    onAddUser(updatedUser);
    setPasswords({ current: '', new: '', confirm: '' });
    toast.success('Password changed successfully');
  };

  const handleExport = () => {
    const data = {
      ...allData,
      settings,
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shreemad_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success('Backup exported successfully');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm('This will REPLACE all current data. Continue?')) {
          onImportData(data);
        }
      } catch (err) {
        toast.error('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Profile Settings */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center gap-2">
              <UserIcon className="text-[#C9A84C]" size={18} />
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Personal Profile</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Your Display Name</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" />
                    <input 
                      type="text" 
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (!formData.name?.trim()) return;
                      onAddUser({ ...user!, name: formData.name.trim() });
                      toast.success('Name updated successfully');
                    }}
                    className="bg-[#C9A84C] text-white font-bold px-4 py-2 rounded-lg hover:bg-[#B0923D] transition-all text-sm shadow-sm flex items-center gap-2"
                  >
                    <Save size={14} /> Update
                  </button>
                </div>
                <p className="text-[10px] text-[#9A8262] italic mt-1 px-1">This name appears on the dashboard and all logs you create.</p>
              </div>
            </div>
          </div>

          {/* Company Settings */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center gap-2">
              <Building className="text-[#C9A84C]" size={18} />
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Company Settings</h3>
            </div>
            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Company Name</label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" />
                  <input 
                    type="text" 
                    disabled={!isAdmin}
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C] disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Company Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8262]" />
                  <input 
                    type="tel" 
                    disabled={!isAdmin}
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C] disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Company Address</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3 text-[#9A8262]" />
                  <textarea 
                    value={formData.address}
                    disabled={!isAdmin}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-[#C9A84C] resize-none disabled:opacity-50"
                  />
                </div>
              </div>
              {isAdmin && (
                <button 
                  type="submit"
                  className="bg-[#C9A84C] text-white font-bold px-6 py-2 rounded-lg hover:bg-[#B0923D] transition-all flex items-center gap-2 text-sm shadow-sm"
                >
                  <Save size={16} /> Save Settings
                </button>
              )}
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center gap-2">
              <Key className="text-[#C9A84C]" size={18} />
              <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Change Password</h3>
            </div>
            <form onSubmit={handleChangePass} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Current Password</label>
                <input 
                  type="password" 
                  value={passwords.current}
                  onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">New Password</label>
                <input 
                  type="password" 
                  value={passwords.new}
                  onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider">Confirm New Password</label>
                <input 
                  type="password" 
                  value={passwords.confirm}
                  onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                  className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <button 
                type="submit"
                className="bg-[#C9A84C] text-white font-bold px-6 py-2 rounded-lg hover:bg-[#B0923D] transition-all flex items-center gap-2 text-sm shadow-sm"
              >
                <Lock size={16} /> Change Password
              </button>
            </form>
          </div>

          {/* Dynamic Options */}
          {isAdmin && (
            <div className="space-y-6">
              <OptionManager 
                title="Lead Sources" 
                options={formData.sources} 
                onAdd={(val) => handleAddOption('sources', val)} 
                onRemove={(val) => handleRemoveOption('sources', val)} 
              />
              <OptionManager 
                title="Budget Ranges" 
                options={formData.budgets} 
                onAdd={(val) => handleAddOption('budgets', val)} 
                onRemove={(val) => handleRemoveOption('budgets', val)} 
              />
              <OptionManager 
                title="Property Interests" 
                options={formData.propertyInterests} 
                onAdd={(val) => handleAddOption('propertyInterests', val)} 
                onRemove={(val) => handleRemoveOption('propertyInterests', val)} 
              />
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Project Management */}
          {isAdmin && (
            <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center gap-2">
                <Building className="text-[#C9A84C]" size={18} />
                <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Project Management</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="New project name"
                    className="flex-1 bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                  <button 
                    onClick={handleAddProject}
                    className="bg-[#C9A84C] text-white font-bold px-4 py-2 rounded-lg hover:bg-[#B0923D] transition-all text-sm"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-3">
                  {projects.map(p => (
                    <div key={p.id} className="space-y-3 p-3 bg-white border border-[#E6D8B8] rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#2A1C00]">{p.name}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingProject(p)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider"
                          >
                            Edit Location
                          </button>
                          <button onClick={() => handleRemoveProject(p.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {p.location && p.location.lat !== 0 && (
                        <div className="text-[10px] text-[#9A8262] font-mono flex items-center gap-2">
                          <MapPin size={10} />
                          {p.location.address || 'Location Set'} ({p.location.lat?.toFixed(4) || '0'}, {p.location.lng?.toFixed(4) || '0'})
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Edit Project Modal/Form */}
                {editingProject && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white border border-[#E6D8B8] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                      <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
                        <h3 className="font-['Cormorant_Garamond'] text-xl font-bold text-[#2A1C00]">Edit Project Location</h3>
                        <button onClick={() => setEditingProject(null)} className="text-[#9A8262] hover:text-[#2A1C00]">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                          <Info className="text-amber-600 shrink-0" size={18} />
                          <p className="text-xs text-amber-800">
                            Enter the Google Map coordinates for this project. Staff assigned to this project will only be able to clock in within 100 meters of this location.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Project Name</label>
                          <input 
                            type="text" 
                            value={editingProject.name}
                            onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Latitude</label>
                            <input 
                              type="number" 
                              step="any"
                              value={editingProject.location?.lat || 0}
                              onChange={(e) => setEditingProject({
                                ...editingProject, 
                                location: { ...(editingProject.location || { address: '', radius: 100, lng: 0 }), lat: parseFloat(e.target.value) }
                              })}
                              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Longitude</label>
                            <input 
                              type="number" 
                              step="any"
                              value={editingProject.location?.lng || 0}
                              onChange={(e) => setEditingProject({
                                ...editingProject, 
                                location: { ...(editingProject.location || { address: '', radius: 100, lat: 0 }), lng: parseFloat(e.target.value) }
                              })}
                              className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#9A8262] uppercase tracking-wider">Site Address (Google Maps)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 123 Business Park, Mumbai"
                            value={editingProject.location?.address || ''}
                            onChange={(e) => setEditingProject({
                              ...editingProject, 
                              location: { ...(editingProject.location || { lat: 0, lng: 0, radius: 100 }), address: e.target.value }
                            })}
                            className="w-full bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm"
                          />
                        </div>
                        <div className="flex gap-3 mt-6">
                          <button 
                            onClick={() => setEditingProject(null)}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-[#9A8262] hover:bg-gray-50 rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleUpdateProject}
                            className="flex-1 bg-[#C9A84C] text-white px-4 py-2.5 rounded-lg font-bold hover:bg-[#B0923D] transition-all shadow-md text-sm flex items-center justify-center gap-2"
                          >
                            <Save size={18} /> Update Project
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Management */}
          {isAdmin && (
            <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center gap-2">
                <UserIcon className="text-[#C9A84C]" size={18} />
                <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">{editingUserId ? 'Edit User' : 'User Management'}</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Username"
                    disabled={!!editingUserId}
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C] disabled:opacity-50"
                  />
                  <input 
                    type="password" 
                    placeholder={editingUserId ? "Leave blank to keep same" : "Password"}
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                  <input 
                    type="text" 
                    placeholder="Full Name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                  <select 
                    value={newUser.projectId}
                    onChange={(e) => setNewUser({...newUser, projectId: e.target.value})}
                    className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  >
                    <option value="">Select Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                    className="bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="flex gap-2 col-span-2">
                    <button 
                      onClick={handleAddUser}
                      className="flex-1 bg-[#C9A84C] text-white font-bold px-4 py-2 rounded-lg hover:bg-[#B0923D] transition-all text-sm"
                    >
                      {editingUserId ? 'Update User' : 'Add User'}
                    </button>
                    {editingUserId && (
                      <button 
                        onClick={() => {
                          setEditingUserId(null);
                          setNewUser({ username: '', password: '', name: '', projectId: projects[0]?.id || '', role: 'user' });
                        }}
                        className="bg-gray-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-gray-600 transition-all text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {users.map(u => (
                    <div key={u.id} className="p-3 bg-white border border-[#E6D8B8] rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{u.name}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEditUser(u)}
                            className="text-[#C9A84C] hover:text-[#B0923D] p-1"
                          >
                            <Key size={16} />
                          </button>
                          <button onClick={() => handleRemoveUser(u.id)} className="text-red-500 hover:text-red-700 p-1">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#9A8262]">
                        <span>@{u.username} • {u.role}</span>
                        <span>{projects.find(p => p.id === u.projectId)?.name || 'No Project'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data Management */}
          {isAdmin && (
            <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center gap-2">
                <Database className="text-[#C9A84C]" size={18} />
                <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">Data Backup & Restore</h3>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-sm text-[#5C4820] leading-relaxed">
                  Export all your data as a JSON file for backup, or import a previously exported backup to restore data.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={handleExport}
                    className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-sm shadow-sm"
                  >
                    <Download size={16} /> Export Backup
                  </button>
                  <label className="bg-white border border-[#E6D8B8] text-[#9A8262] font-bold px-4 py-2 rounded-lg hover:text-[#2A1C00] transition-all flex items-center gap-2 text-sm shadow-sm cursor-pointer">
                    <Upload size={16} /> Import Backup
                    <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                  </label>
                </div>
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-blue-800 leading-relaxed">
                    Backup includes all visits, remarks, templates, and settings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionManager({ title, options, onAdd, onRemove }: { title: string, options: string[], onAdd: (v: string) => void, onRemove: (v: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E6D8B8] bg-[#FDFAF2]">
        <h3 className="font-['Cormorant_Garamond'] text-lg font-bold text-[#2A1C00]">{title}</h3>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={`Add new ${title.toLowerCase()}`}
            className="flex-1 bg-white border border-[#E6D8B8] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]"
          />
          <button 
            onClick={() => { onAdd(val); setVal(''); }}
            className="bg-[#C9A84C] text-white font-bold px-4 py-2 rounded-lg hover:bg-[#B0923D] transition-all text-sm"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map(o => (
            <div key={o} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#E6D8B8] rounded-full text-xs font-medium">
              {o}
              <button onClick={() => onRemove(o)} className="text-red-400 hover:text-red-600">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
