import React from 'react';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  UserPlus, 
  Users,
  Webhook,
  MessageSquare, 
  Layers, 
  Settings, 
  LogOut,
  Home,
  X,
  BarChart2,
  Bell, History as HistoryIcon,
  UserCheck,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Page, User } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  user: User | null;
}

export default function Sidebar({ isOpen, onClose, currentPage, onNavigate, onLogout, user }: SidebarProps) {
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Main' },
    { id: 'leads', label: 'Leads', icon: Users, section: 'Main' },
    { id: 'hrms', label: 'HRMS & Attendance', icon: UserCheck, section: 'Main' },
    { id: 'followups', label: 'Follow-ups', icon: Bell, section: 'Main' },
    { id: 'visits', label: 'Site Visits', icon: CalendarCheck, section: 'Main' },
    { id: 'reports', label: 'Reports & Audit', icon: BarChart2, section: 'Main' },
    { id: 'whatsapp', label: 'WhatsApp Send', icon: MessageSquare, section: 'Communication' },
    { id: 'templates', label: 'Templates', icon: Layers, section: 'Communication' },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook, section: 'System', adminOnly: true },
    { id: 'workflow', label: 'Workflow Builder', icon: Zap, section: 'System', adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, section: 'System' },
  ].filter(item => !item.adminOnly || isAdmin);

  const sections = ['Main', 'Communication', 'System'];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-64 bg-[#1E1508] border-r border-[#C9A84C]/15 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-[#C9A84C]/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] rounded-xl flex items-center justify-center shadow-[0_4px_16px_rgba(201,168,76,0.45)]">
              <Home className="text-[#1C1207] w-5 h-5" />
            </div>
            <div>
              <h1 className="font-['Cormorant_Garamond'] text-[#E8C97A] text-lg font-bold leading-tight">Signature</h1>
              <p className="text-[#C9A84C]/45 text-[10px] tracking-[2.5px] uppercase font-medium">Properties</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-[#C9A84C]/60 hover:text-[#E8C97A]">
            <X size={20} />
          </button>
        </div>

        <nav className="py-4">
          {sections.map(section => {
            const sectionItems = navItems.filter(item => item.section === section);
            if (sectionItems.length === 0) return null;

            return (
              <div key={section} className="mb-4">
                <h2 className="px-6 py-2 text-[#C9A84C]/30 text-[9px] font-bold tracking-[2px] uppercase">
                  {section}
                </h2>
                {sectionItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id as Page)}
                    className={cn(
                      "w-full flex items-center gap-3 px-6 py-2.5 text-[13.5px] font-medium transition-all border-l-4",
                      currentPage === item.id 
                        ? "text-[#E8C97A] bg-[#C9A84C]/10 border-[#C9A84C]" 
                        : "text-white/45 border-transparent hover:text-white/80 hover:bg-white/5"
                    )}
                  >
                    <item.icon size={16} className={currentPage === item.id ? "text-[#C9A84C]" : ""} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            );
          })}

          <div className="mt-auto pt-4 border-t border-[#C9A84C]/15">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-6 py-2.5 text-[13.5px] font-medium text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}

