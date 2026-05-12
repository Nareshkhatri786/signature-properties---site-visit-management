import React, { useState, useEffect } from 'react';
import { Menu, Calendar, User as UserIcon } from 'lucide-react';
import { User, Page, Attendance, UserNotification } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { QuickAttendance } from './QuickAttendance';
import { motion } from 'motion/react';
import { socketService } from '../lib/socket';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface TopbarProps {
  user: User;
  title: string;
  onMenuClick: () => void;
  onNavigate: (page: Page, id?: string) => void;
  notifications: UserNotification[];
  attendance: Attendance[];
  onAttendanceUpdate: (attendance: Attendance) => void;
}

export default function Topbar({ user, title, onMenuClick, onNavigate, notifications, attendance, onAttendanceUpdate }: TopbarProps) {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const [isSocketConnected, setIsSocketConnected] = useState(socketService.getSocket()?.connected || false);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <header className="h-[58px] bg-[#FFFDF6] border-b border-[#E6D8B8] flex items-center px-4 lg:px-7 gap-4 sticky top-0 z-30 shadow-[0_1px_0_#E6D8B8]">
      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={onMenuClick}
        className="lg:hidden p-2 text-[#5C4820] hover:bg-[#F5EDD4] rounded-lg transition-colors"
      >
        <Menu size={20} />
      </motion.button>
      
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <h1 className="font-['Cormorant_Garamond'] text-xl font-semibold text-[#2A1C00] truncate">
          {title}
        </h1>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-full border hidden sm:flex transition-all duration-500",
          isSocketConnected ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
        )}>
          <span className="relative flex h-2 w-2">
            {isSocketConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
            <span className={cn("relative inline-flex rounded-full h-2 w-2", isSocketConnected ? "bg-green-500" : "bg-red-500")}></span>
          </span>
          <span className={cn("text-[9px] font-black uppercase tracking-widest", isSocketConnected ? "text-green-600" : "text-red-600")}>
            {isSocketConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-6">
        <QuickAttendance user={user} attendance={attendance} onUpdate={onAttendanceUpdate} />
        <NotificationCenter user={user} onNavigate={onNavigate} notifications={notifications} />

        <div className="hidden md:flex items-center gap-2 text-[#9A8262] text-[12.5px]">
          <Calendar size={14} />
          <span>{today}</span>
        </div>
        
        <div className="flex items-center gap-3 ml-2 border-l border-[#E6D8B8] pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-[#5C4820] text-[13px] font-medium leading-none">{user.name}</p>
            <p className="text-[#9A8262] text-[10px] mt-1 capitalize">{user.role}</p>
          </div>
          <div className="w-[33px] h-[33px] bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] rounded-full flex items-center justify-center text-[#1C1207] font-bold text-xs shadow-sm capitalize">
            {user.name ? user.name.charAt(0).toUpperCase() : user.username?.charAt(0).toUpperCase() || '?'}
          </div>
        </div>
      </div>
    </header>
  );
}

