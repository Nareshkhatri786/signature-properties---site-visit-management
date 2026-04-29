import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Info, AlertTriangle, UserPlus, Calendar, Clock, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../lib/api-service';
import { UserNotification, User, Page } from '../types';
import { format } from 'date-fns';
import { clsx } from 'clsx';

interface NotificationCenterProps {
  user: User;
  onNavigate: (page: Page, id?: string) => void;
  notifications: UserNotification[];
  onUnreadCount?: (count: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ user, onNavigate, notifications, onUnreadCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // iOS detection helper
  const isIOS = () => {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  };

  const userNotifs = notifications.filter((n: UserNotification) => {
    if (user.role.toLowerCase() === 'admin') return n.isAdmin || n.userId === user.id;
    return n.userId === user.id;
  }).sort((a: UserNotification, b: UserNotification) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    const unreadCount = userNotifs.filter((n: UserNotification) => !n.read).length;
    onUnreadCount?.(unreadCount);
  }, [userNotifs.length]);

  const showPushNotification = (notif: UserNotification) => {
    if (isIOS()) return; // Extra safety: disable push for iOS
    
    const winNotif = (window as any).Notification;
    if (!winNotif || winNotif.permission !== "granted") return;

    try {
      // Logic for mobile: must use service worker registration for showNotification
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          (registration as any).showNotification(notif.title, {
            body: notif.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            vibrate: [100, 50, 100]
          });
        }).catch(err => {
          console.warn("ServiceWorker showNotification failed, falling back:", err);
          // Fallback to basic constructor if SW fails
          if (winNotif) {
            new winNotif(notif.title, { body: notif.message, icon: '/favicon.ico' });
          }
        });
      } else if (winNotif) {
        // Desktop or environment without active Service Worker
        new winNotif(notif.title, {
          body: notif.message,
          icon: '/favicon.ico'
        });
      }
    } catch (e) {
      console.error("Failed to show browser notification:", e);
    }
  };

  const requestPermission = () => {
    if (isIOS()) return; // Disable permission request for iOS
    const winNotif = (window as any).Notification;
    if (winNotif && winNotif.requestPermission) {
      try {
        winNotif.requestPermission();
      } catch (e) {
        console.error("Failed to request notification permission:", e);
      }
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    apiService.markNotifRead(id).catch(console.error);
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    apiService.markNotifRead('all').catch(console.error);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'NEW_LEAD': return <UserPlus className="text-blue-500" size={16} />;
      case 'MISSED_PUNCH_IN':
      case 'MISSED_PUNCH_OUT': return <AlertTriangle className="text-red-500" size={16} />;
      case 'FOLLOW_UP_REMINDER': return <Calendar className="text-amber-500" size={16} />;
      case 'VISIT_REMINDER': return <Clock className="text-green-500" size={16} />;
      case 'CLIENT_VISIT_REMINDER': return <Calendar className="text-purple-500" size={16} />;
      default: return <Info className="text-[#C9A84C]" size={16} />;
    }
  };

  const handleAction = (notif: UserNotification) => {
    setIsOpen(false);
    markAsRead(notif.id);
    
    if (notif.type === 'NEW_LEAD') onNavigate('leads');
    if (notif.type.includes('PUNCH')) onNavigate('hrms');
    if (notif.type === 'FOLLOW_UP_REMINDER') onNavigate('followups');
    if (notif.type === 'VISIT_REMINDER') onNavigate('detail', notif.metadata?.visitId);
    if (notif.type === 'CLIENT_VISIT_REMINDER') onNavigate('whatsapp', notif.metadata?.visitId);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[#9A8262] hover:bg-[#F5EDD4] rounded-full transition-colors"
      >
        <Bell size={18} />
        {notifications.filter(n => !n.read).length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
            {notifications.filter(n => !n.read).length}
          </span>
        )}
      </button>

      {(window as any).Notification?.permission === "default" && !isIOS() && (
         <button 
            onClick={requestPermission}
            className="hidden lg:block absolute -bottom-12 right-0 whitespace-nowrap text-[10px] bg-amber-500/10 text-amber-600 px-2 py-1 rounded border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all uppercase tracking-tighter font-bold"
         >
            Enable Push
         </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/5 lg:bg-transparent" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-[320px] bg-[#FFFDF6] border border-[#E6D8B8] rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#E6D8B8] bg-[#FDFAF2] flex items-center justify-between">
                <h3 className="font-['Cormorant_Garamond'] font-bold text-[#2A1C00]">Notifications</h3>
                <div className="flex items-center gap-2">
                    <button 
                         onClick={markAllRead}
                         className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider hover:text-[#B0923D]"
                    >
                        Mark All Read
                    </button>
                    <button onClick={() => setIsOpen(false)} className="text-[#9A8262] hover:text-[#5C4820]">
                        <X size={16} />
                    </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-[#FFFDF6]">
                {loading ? (
                  <div className="p-8 text-center text-[#9A8262] text-xs">Loading alerts...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-[#F5EDD4] rounded-full flex items-center justify-center mx-auto mb-3">
                         <Bell className="text-[#C9A84C] opacity-30" size={20} />
                    </div>
                    <p className="text-[#9A8262] text-xs">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0E6D2]">
                    {notifications.map(notif => (
                      <div 
                        key={notif.id}
                        className={clsx(
                          "p-4 transition-all hover:bg-[#FDF9EA] cursor-pointer relative group",
                          !notif.read && "bg-[#FDF9EA]"
                        )}
                        onClick={() => handleAction(notif)}
                      >
                        {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C9A84C]" />}
                        <div className="flex gap-3">
                          <div className="mt-1 shrink-0">{getIcon(notif.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <p className={clsx("text-xs truncate", notif.read ? "text-[#5C4820] font-medium" : "text-[#2A1C00] font-bold")}>
                                {notif.title}
                                </p>
                                <span className="text-[9px] text-[#9A8262] whitespace-nowrap font-mono">{format(new Date(notif.createdAt), 'HH:mm')}</span>
                            </div>
                            <p className="text-[11px] text-[#5C4820] mt-1 line-clamp-2 leading-relaxed opacity-80">{notif.message}</p>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-[9px] text-[#C9A84C] font-bold uppercase tracking-wider flex items-center gap-1">
                                    View Details <ExternalLink size={8} />
                                </span>
                                {!notif.read && (
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                      className="p-1 hover:bg-[#C9A84C] hover:text-white rounded-full transition-all text-[#C9A84C]"
                                      title="Mark as read"
                                   >
                                      <Check size={10} />
                                   </button>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                  <div className="p-3 bg-[#FDFAF2] border-t border-[#E6D8B8] text-center">
                     <p className="text-[10px] text-[#9A8262]">Showing last {notifications.length} notifications</p>
                  </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

