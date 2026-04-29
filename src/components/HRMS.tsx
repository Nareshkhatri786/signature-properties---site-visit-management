import React from 'react';
import { User, Page, Project } from '../types';
import { AttendanceWidget } from './AttendanceWidget';
import { AttendanceReport } from './AttendanceReport';
import { AttendanceSettings } from './AttendanceSettings';
import { LayoutGrid, Users, Settings as SettingsIcon, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';

interface HRMSProps {
  user: User;
  users: User[];
  projects: Project[];
  attendance: Attendance[];
  onNavigate: (page: Page) => void;
}

export default React.memo(function HRMS({ user, users, projects, attendance, onNavigate }: HRMSProps) {
  const userRole = user.role.toLowerCase();
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';

  const managedProjectIds = user.assignedProjectIds || (user.projectId ? [user.projectId] : []);

  const displayUsers = isAdmin
    ? users
    : isManager
      ? users.filter(u => managedProjectIds.includes(u.projectId))
      : users.filter(u => u.id === user.id);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-[#2A1C00] flex items-center gap-3">
            <Users className="text-[#C9A84C]" size={28} />
            HRMS & Attendance
          </h2>
          <p className="text-[#9A8262] mt-1">Manage your professional schedule and workforce presence.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-4 py-2 bg-white border border-[#E6D8B8] text-[#5C4820] rounded-lg text-sm font-medium hover:bg-[#F5EDD4] transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <AttendanceWidget user={user} attendance={attendance} />

          <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-serif text-[#2A1C00] mb-4 flex items-center gap-2">
              <ClipboardList className="text-[#C9A84C]" size={18} />
              My Shift Profile
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[#F0E6D2]">
                <span className="text-xs text-[#9A8262] uppercase font-mono">Working Hours</span>
                <span className="text-sm font-medium text-[#2A1C00]">{user.workingHours?.start || '10:00'} - {user.workingHours?.end || '19:00'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#F0E6D2]">
                <span className="text-xs text-[#9A8262] uppercase font-mono">My Base Site</span>
                <span className="text-sm font-medium text-[#2A1C00]">{user.assignedLocation?.address || 'Not Assigned'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-[#9A8262] uppercase font-mono">Geofence</span>
                <span className="text-sm font-medium text-[#2A1C00]">{user.assignedLocation?.radius || 100}m radius</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl p-1 shadow-sm">
                <div className="bg-amber-500/10 p-4 rounded-xl flex items-center gap-4 border border-amber-500/20">
                  <SettingsIcon className="text-amber-600" size={20} />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 leading-none">Administration Access</h4>
                    <p className="text-xs text-amber-700 mt-1">You are viewing the global workforce configuration.</p>
                  </div>
                </div>
              </div>
              <AttendanceSettings users={users} projects={projects} />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <AttendanceReport users={displayUsers} />
          </motion.div>
        </div>
      </div>
    </div>
  );
});
