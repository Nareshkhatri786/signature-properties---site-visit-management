import React, { useState } from 'react';
import { User, Project } from '../types';
import { MapPin, Clock, Save, X, Briefcase, Users, Eye, EyeOff } from 'lucide-react';
import { apiService } from '../lib/api-service';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface AttendanceSettingsProps {
  users: User[];
  projects: Project[];
}

export const AttendanceSettings: React.FC<AttendanceSettingsProps> = ({ users, projects }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      username: user.username,
      role: user.role || 'user',
      projectId: user.projectId,
      assignedProjectIds: user.assignedProjectIds || [],
      workingHours: user.workingHours || { start: '10:00', end: '19:00' },
      assignedLocation: user.assignedLocation || { lat: 0, lng: 0, address: '', radius: 100 }
    });
    setShowPassword(false);
  };

  const handleAddNew = () => {
    const newUser: User = {
      id: 0, // 0 indicates a new user for auto-increment
      name: '',
      username: '',
      password: 'changeme123',
      role: 'user',
      projectId: projects[0]?.id || 'p1',
      workingHours: { start: '10:00', end: '19:00' },
      assignedLocation: { lat: 0, lng: 0, address: '', radius: 100 }
    };
    setEditingUser(newUser);
    setEditForm({ ...newUser });
    setShowPassword(true);
  };

  const toggleProject = (projectId: string) => {
    const current = editForm.assignedProjectIds || [];
    if (current.includes(projectId)) {
      setEditForm({ ...editForm, assignedProjectIds: current.filter(id => id !== projectId) });
    } else {
      setEditForm({ ...editForm, assignedProjectIds: [...current, projectId] });
    }
  };

  const handleSave = async () => {
    if (!editingUser) return;
    
    try {
      const updatedUser = {
        ...editingUser,
        ...editForm
      };
      
      // If id is 0, it's a new user, let server auto-increment
      const savePayload = {
        ...updatedUser,
        id: editingUser.id === 0 ? null : editingUser.id
      };

      await apiService.save("users", savePayload);
      toast.success(editingUser.id === 0 ? "New employee created successfully" : `User settings updated for ${updatedUser.name}`);
      setEditingUser(null);
    } catch (error) {
      toast.error("Failed to save user");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-[#3D2B1A] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-serif text-amber-500">Employee Shift & Location</h3>
            <p className="text-amber-200/40 text-sm mt-1">Set work schedules and geofence locations for your team.</p>
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all text-sm font-bold flex items-center gap-2"
          >
            <Users size={16} />
            Add New Employee
          </button>
        </div>

        <div className="divide-y divide-[#3D2B1A]">
          {users.map(user => (
            <div key={user.id} className="p-4 hover:bg-white/5 transition-colors group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 group-hover:bg-amber-500 transition-all group-hover:text-black">
                    <span className="font-serif text-lg font-bold">{user.name[0]}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{user.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-amber-200/40 font-mono uppercase px-1.5 py-0.5 bg-white/5 rounded border border-white/10">{user.role}</span>
                      {user.workingHours && (
                        <div className="flex items-center gap-1 text-xs text-amber-200/60 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{user.workingHours.start} - {user.workingHours.end}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {user.assignedLocation ? (
                    <div className="px-3 py-1.5 bg-[#1C1207] rounded-lg border border-[#3D2B1A] flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs text-amber-200/80 truncate max-w-[150px]">{user.assignedLocation.address}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-200/20 italic">No Location Set</span>
                  )}
                  <button
                    onClick={() => handleEdit(user)}
                    className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black rounded-lg border border-amber-500/20 transition-all text-sm font-medium"
                  >
                    Configure
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[#3D2B1A] flex items-center justify-between bg-[#1C1207]">
              <div>
                <h3 className="text-xl font-serif text-amber-500">Configure {editingUser.name}</h3>
                <p className="text-amber-200/40 text-xs mt-1">Attendance Policy & Geofencing</p>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-2 hover:bg-white/5 rounded-full text-amber-200/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {/* Basic Details Section */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#3D2B1A]">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Username</label>
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                      className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 pb-4 border-b border-[#3D2B1A]">
                  <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">New Password (leave empty to keep current)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={editForm.password || ''}
                      onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                      className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 pr-10 text-white focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/40 hover:text-amber-500 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pb-4 border-b border-[#3D2B1A]">
                  <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono flex items-center gap-2">
                    <Briefcase size={12} /> System Permissions & Role
                  </label>
                  <div className="flex gap-2">
                    {['admin', 'manager', 'user'].map((role) => (
                      <button
                        key={role}
                        onClick={() => setEditForm({ ...editForm, role: role as any })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                          editForm.role === role 
                            ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" 
                            : "bg-white/5 border-white/10 text-amber-200/40 hover:bg-white/10"
                        )}
                      >
                        {role === 'user' ? 'Salesman' : role}
                      </button>
                    ))}
                  </div>
                </div>

                {editForm.role === 'manager' && (
                  <div className="space-y-2 pb-4 border-b border-[#3D2B1A]">
                    <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Managed Projects (Multiple Selection)</label>
                    <div className="flex flex-wrap gap-2">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => toggleProject(p.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                            editForm.assignedProjectIds?.includes(p.id)
                              ? "bg-amber-500/20 border-amber-500 text-amber-500"
                              : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pb-4 border-b border-[#3D2B1A]">
                  <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Primary Project (Main)</label>
                  <select
                    value={editForm.projectId}
                    onChange={e => setEditForm({ ...editForm, projectId: e.target.value })}
                    className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none"
                  >
                    <option value="">No Project Assigned</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Shift Start</label>
                  <input
                    type="time"
                    value={editForm.workingHours?.start}
                    onChange={e => setEditForm({ ...editForm, workingHours: { ...editForm.workingHours!, start: e.target.value } })}
                    className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white font-mono focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Shift End</label>
                  <input
                    type="time"
                    value={editForm.workingHours?.end}
                    onChange={e => setEditForm({ ...editForm, workingHours: { ...editForm.workingHours!, end: e.target.value } })}
                    className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white font-mono focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#3D2B1A]">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Work Address / Site Name</label>
                  <input
                    type="text"
                    placeholder="Signature Heights - Main Office"
                    value={editForm.assignedLocation?.address}
                    onChange={e => setEditForm({ ...editForm, assignedLocation: { ...editForm.assignedLocation!, address: e.target.value } })}
                    className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="18.123456"
                      value={editForm.assignedLocation?.lat}
                      onChange={e => setEditForm({ ...editForm, assignedLocation: { ...editForm.assignedLocation!, lat: parseFloat(e.target.value) } })}
                      className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white font-mono focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="73.123456"
                      value={editForm.assignedLocation?.lng}
                      onChange={e => setEditForm({ ...editForm, assignedLocation: { ...editForm.assignedLocation!, lng: parseFloat(e.target.value) } })}
                      className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white font-mono focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        toast.loading("Detecting your location...");
                        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                          navigator.geolocation.getCurrentPosition(resolve, reject);
                        });
                        setEditForm({
                          ...editForm,
                          assignedLocation: {
                            ...editForm.assignedLocation!,
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            address: editForm.assignedLocation?.address || 'Current Location'
                          }
                        });
                        toast.dismiss();
                        toast.success("Location captured!");
                      } catch (err) {
                        toast.dismiss();
                        toast.error("Could not detect location. Please allow GPS access.");
                      }
                    }}
                    className="flex-1 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500 hover:text-black transition-all"
                  >
                    <MapPin size={12} className="inline mr-2" />
                    Pin My Current Location
                  </button>
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-amber-200/40 font-mono">Radius (meters)</label>
                    <input
                      type="number"
                      value={editForm.assignedLocation?.radius}
                      onChange={e => setEditForm({ ...editForm, assignedLocation: { ...editForm.assignedLocation!, radius: parseInt(e.target.value) } })}
                      className="w-full bg-[#1C1207] border border-[#3D2B1A] rounded-lg p-2.5 text-white font-mono focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={editForm.assignedLocation?.radius || 100}
                    onChange={e => setEditForm({ ...editForm, assignedLocation: { ...editForm.assignedLocation!, radius: parseInt(e.target.value) } })}
                    className="w-full h-1.5 bg-[#1C1207] rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[8px] text-amber-200/20 font-mono uppercase italic">
                    <span>Precision (50m)</span>
                    <span>Broad (1km)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#1C1207] border-t border-[#3D2B1A] flex items-center gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2.5 border border-[#3D2B1A] text-white hover:bg-white/5 rounded-xl transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 font-medium"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


