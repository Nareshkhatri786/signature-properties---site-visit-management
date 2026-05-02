import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Attendance } from '../types';
import { calculateDistance, getCurrentPosition } from '../lib/geo';
import { apiService } from '../lib/api-service';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface AttendanceWidgetProps {
  user: User;
  attendance: Attendance[];
}

export const AttendanceWidget: React.FC<AttendanceWidgetProps> = ({ user, attendance }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockingInProgress, setClockingInProgress] = useState(false);
  const loading = false;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasLocation = user.assignedLocation && user.assignedLocation.lat !== 0;
  const isPendingRequest = !!user.locationRequest;

  const handleSetInitialLocation = async () => {
    setClockingInProgress(true);
    try {
      toast.loading("Capturing your work location...");
      const pos = await getCurrentPosition();
      const newLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radius: 100,
        address: "My Assigned Work Site"
      };
      
      await apiService.save("users", { ...user, id: user.id, assignedLocation: newLocation });
      toast.dismiss();
      toast.success("Work location frozen! You can now clock in.");
      window.location.reload(); // Reload to get fresh user data
    } catch (error) {
      toast.dismiss();
      toast.error("Could not capture location. Please ensure GPS is enabled.");
    }
    setClockingInProgress(false);
  };

  const handleRequestChange = async () => {
    setClockingInProgress(true);
    try {
      toast.loading("Capturing new location for request...");
      const pos = await getCurrentPosition();
      const request = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radius: 100,
        address: "New Requested Site",
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      
      await apiService.save("users", { ...user, id: user.id, locationRequest: request });
      toast.dismiss();
      toast.success("Location change request sent to Admin!");
      window.location.reload();
    } catch (error) {
      toast.dismiss();
      toast.error("Could not capture location for request.");
    }
    setClockingInProgress(false);
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const currentAttendance = attendance.find(a => a.userId === user.id && a.date === today) || null;

  const validateLocation = async () => {
    if (!user.assignedLocation) {
       toast.error("No work location assigned.");
       return null;
    }

    try {
      toast.loading("Verifying your location...", { id: 'geo-check', duration: 2000 });
      const pos = await getCurrentPosition();
      const distance = calculateDistance(
        pos.coords.latitude, 
        pos.coords.longitude, 
        user.assignedLocation.lat, 
        user.assignedLocation.lng
      );

      if (distance > (user.assignedLocation.radius || 100)) {
        toast.error(`Location validation failed: You are ${Math.round(distance)}m away.`, { id: 'geo-check' });
        return null;
      }

      toast.success("Location verified", { id: 'geo-check' });
      return pos.coords;
    } catch (error) {
      toast.error("Could not verify location. Please enable GPS.", { id: 'geo-check' });
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
        checkIn: {
          time: now.toISOString(),
          lat: coords.latitude,
          lng: coords.longitude,
          onTime
        },
        status: 'present'
      };

      try {
        const id = `${user.id}_${today}`;
        await apiService.save("attendance", {...record, id: id});
        toast.success(onTime ? "Clocked in on time!" : "Clocked in (Late)");
        window.location.reload();
      } catch (error) {
        toast.error("Failed to clock in");
      }
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
        checkOut: {
          time: now.toISOString(),
          lat: coords.latitude,
          lng: coords.longitude,
          forced: false
        }
      };

      try {
        await apiService.save("attendance", {...record, id: currentAttendance.id});
        toast.success("Clocked out successfully!");
        window.location.reload();
      } catch (error) {
        toast.error("Failed to clock out");
      }
    }
    setClockingInProgress(false);
  };

  if (loading) return null;

  const isClockedIn = !!currentAttendance?.checkIn;
  const isClockedOut = !!currentAttendance?.checkOut;

  return (
    <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-2xl p-6 shadow-xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <Clock className="w-24 h-24 text-amber-500" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-serif text-amber-500 mb-1">Attendance</h3>
            <p className="text-amber-200/60 text-sm font-mono">{format(currentTime, 'EEEE, MMM do')}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono text-white tracking-wider">{format(currentTime, 'HH:mm:ss')}</p>
          </div>
        </div>

        {!hasLocation ? (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6 text-center space-y-4">
            <div className="bg-amber-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
              <MapPin className="text-amber-500" size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold">Location Not Set</h4>
              <p className="text-amber-200/40 text-xs mt-1">Please stand at your assigned work site and click below to freeze your location.</p>
            </div>
            <button
              onClick={handleSetInitialLocation}
              disabled={clockingInProgress}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {clockingInProgress ? "Capturing..." : "Set My Work Site"}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#1C1207] rounded-xl p-4 border border-[#3D2B1A]">
                <p className="text-amber-200/40 text-xs uppercase tracking-widest mb-2 font-mono">Shift Hours</p>
                <p className="text-white font-medium">
                  {user.workingHours?.start || "10:00"} - {user.workingHours?.end || "19:00"}
                </p>
              </div>
              <div className="bg-[#1C1207] rounded-xl p-4 border border-[#3D2B1A] relative group/loc">
                <p className="text-amber-200/40 text-xs uppercase tracking-widest mb-2 font-mono">Work Site</p>
                <div className="flex items-center gap-2 text-white font-medium">
                  <MapPin className="w-4 h-4 text-amber-500" />
                  <span className="truncate">{user.assignedLocation?.address || "Frozen Site"}</span>
                </div>
                
                {isPendingRequest ? (
                  <div className="absolute top-2 right-2 bg-blue-500/20 text-blue-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-blue-500/30 uppercase tracking-widest">
                    Request Pending
                  </div>
                ) : (
                  <button 
                    onClick={handleRequestChange}
                    className="absolute top-2 right-2 opacity-0 group-hover/loc:opacity-100 text-[8px] font-bold text-amber-500/60 hover:text-amber-500 uppercase tracking-widest transition-all"
                  >
                    Request Change
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-200/60 font-mono uppercase tracking-wider">Check-in</span>
                {currentAttendance?.checkIn ? (
                  <div className="flex items-center gap-2 text-green-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{format(new Date(currentAttendance.checkIn.time), 'HH:mm')}</span>
                    {!currentAttendance.checkIn.onTime && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 uppercase tracking-tighter">Late</span>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-200/40 italic">Waiting...</span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-200/60 font-mono uppercase tracking-wider">Check-out</span>
                {currentAttendance?.checkOut ? (
                  <div className="flex items-center gap-2 text-blue-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{format(new Date(currentAttendance.checkOut.time), 'HH:mm')}</span>
                  </div>
                ) : (
                  <span className="text-amber-200/40 italic">Waiting...</span>
                )}
              </div>
            </div>

            <div className="mt-8">
              {!isClockedIn ? (
                <button
                  onClick={handleClockIn}
                  disabled={clockingInProgress}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-amber-900/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Clock className="w-5 h-5" />
                  {clockingInProgress ? "Verifying..." : "Clock In"}
                </button>
              ) : !isClockedOut ? (
                <button
                  onClick={handleClockOut}
                  disabled={clockingInProgress}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Clock className="w-5 h-5" />
                  {clockingInProgress ? "Verifying..." : "Clock Out"}
                </button>
              ) : (
                <div className="w-full bg-green-500/10 border border-green-500/30 text-green-400 font-medium py-3 rounded-xl text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Work Day Completed
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};


