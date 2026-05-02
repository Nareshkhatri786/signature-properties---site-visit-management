import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, ChevronDown, LogOut, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Attendance } from '../types';
import { calculateDistance, getCurrentPosition } from '../lib/geo';
import { apiService } from '../lib/api-service';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface QuickAttendanceProps {
  user: User;
  attendance: Attendance[];
}

export const QuickAttendance: React.FC<QuickAttendanceProps> = ({ user, attendance }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [clockingInProgress, setClockingInProgress] = useState(false);
  const loading = false;

  const today = format(new Date(), 'yyyy-MM-dd');

  const currentAttendance = attendance.find((a: Attendance) => a.userId === user.id && a.date === today) || null;

  const validateLocation = async () => {
    if (!user.assignedLocation) {
       toast.error("No work location assigned.");
       return null;
    }
    try {
      toast.loading("Locating...", { id: 'geo-quick', duration: 1500 });
      const pos = await getCurrentPosition();
      const distance = calculateDistance(
        pos.coords.latitude, 
        pos.coords.longitude, 
        user.assignedLocation.lat, 
        user.assignedLocation.lng
      );
      if (distance > (user.assignedLocation.radius || 100)) {
        toast.error(`${Math.round(distance)}m away`, { id: 'geo-quick' });
        return null;
      }
      toast.success("Nearby", { id: 'geo-quick' });
      return pos.coords;
    } catch (error) {
      toast.error("Location disabled", { id: 'geo-quick' });
      return null;
    }
  };

  const handleClockIn = async () => {
    setClockingInProgress(true);
    const coords = await validateLocation();
    if (coords) {
      const now = new Date();
      const startTime = user.workingHours?.start || "10:00";
      const [startH, startM] = startTime.split(':').map(Number);
      const scheduledStart = new Date();
      scheduledStart.setHours(startH, startM, 0, 0);
      const onTime = now <= scheduledStart;
      const record: Partial<Attendance> = {
        userId: user.id,
        date: today,
        checkIn: { time: now.toISOString(), lat: coords.latitude, lng: coords.longitude, onTime },
        status: 'present'
      };
      await apiService.save("attendance", {...record, id: `${user.id}_${today}`});
      toast.success(onTime ? "Clocked in!" : "Clocked in (Late)");
    }
    setClockingInProgress(false);
  };

  const handleClockOut = async () => {
    if (!currentAttendance) return;
    setClockingInProgress(true);
    const coords = await validateLocation();
    if (coords) {
      const now = new Date();
      const record: Partial<Attendance> = {
        ...currentAttendance,
        checkOut: { time: now.toISOString(), lat: coords.latitude, lng: coords.longitude, forced: false }
      };
      await apiService.save("attendance", {...record, id: currentAttendance.id});
      toast.success("Clocked out!");
    }
    setClockingInProgress(false);
  };

  if (loading) return null;

  const isClockedIn = !!currentAttendance?.checkIn;
  const isClockedOut = !!currentAttendance?.checkOut;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
            "p-2 rounded-full transition-all flex items-center gap-2",
            isClockedOut ? "text-blue-500 bg-blue-50" : isClockedIn ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50"
        )}
      >
        <Clock size={18} className={clsx(!isClockedIn && !isClockedOut && "animate-pulse")} />
        <span className="hidden md:block text-[10px] font-bold uppercase tracking-tighter">
            {isClockedOut ? "Finish" : isClockedIn ? "Active" : "Clock In"}
        </span>
        <ChevronDown size={14} className={clsx("transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-[260px] bg-[#FFFDF6] border border-[#E6D8B8] rounded-xl shadow-2xl z-50 p-4"
            >
              <h4 className="text-[10px] font-bold uppercase text-[#9A8262] tracking-widest mb-3">Attendance Quick Action</h4>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5C4820]">Shift Timing</span>
                    <span className="font-mono text-[#2A1C00]">{user.workingHours?.start || '10:00'} - {user.workingHours?.end || '19:00'}</span>
                </div>
                {currentAttendance?.checkIn && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5C4820]">Clock-in Time</span>
                    <span className="font-mono text-green-600 font-bold">{format(new Date(currentAttendance.checkIn.time), 'HH:mm')}</span>
                  </div>
                )}
              </div>

              {!isClockedIn ? (
                <button
                  onClick={handleClockIn}
                  disabled={clockingInProgress}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle2 size={14} />
                  {clockingInProgress ? "Validating..." : "Clock In Now"}
                </button>
              ) : !isClockedOut ? (
                <button
                  onClick={handleClockOut}
                  disabled={clockingInProgress}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogOut size={14} />
                  {clockingInProgress ? "Validating..." : "Clock Out Now"}
                </button>
              ) : (
                <div className="bg-green-100 text-green-700 p-2.5 rounded-lg text-center text-[11px] font-bold border border-green-200 flex items-center justify-center gap-2">
                   <Check size={14} /> Work Day Completed
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-[#F0E6D2] flex items-center gap-2">
                 <MapPin size={12} className="text-[#C9A84C]" />
                 <span className="text-[10px] text-[#9A8262] truncate">{user.assignedLocation?.address || 'Location not verified'}</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};


