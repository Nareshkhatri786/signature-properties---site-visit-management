import React, { useState, useEffect } from 'react';
import { Menu, Calendar, User as UserIcon } from 'lucide-react';
import { User, Page } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { apiService } from '../lib/api-service';
import { format } from 'date-fns';

interface TopbarProps {
  user: User;
  title: string;
  onMenuClick: () => void;
  onNavigate: (page: Page, id?: string) => void;
  notifications: UserNotification[];
}

export default function Topbar({ user, title, onMenuClick, onNavigate, notifications }: TopbarProps) {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="h-[58px] bg-[#FFFDF6] border-b border-[#E6D8B8] flex items-center px-4 lg:px-7 gap-4 sticky top-0 z-30 shadow-[0_1px_0_#E6D8B8]">
      <button 
        onClick={onMenuClick}
        className="lg:hidden p-2 text-[#5C4820] hover:bg-[#F5EDD4] rounded-lg transition-colors"
      >
        <Menu size={20} />
      </button>
      
      <h1 className="font-['Cormorant_Garamond'] text-xl font-semibold text-[#2A1C00] flex-1 truncate">
        {title}
      </h1>

      <div className="flex items-center gap-2 sm:gap-6">
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

