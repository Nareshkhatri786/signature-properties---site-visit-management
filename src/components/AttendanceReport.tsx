import React, { useState, useEffect } from 'react';
import { User, Attendance } from '../types';
import { apiService } from '../lib/api-service';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Calendar, User as UserIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface AttendanceReportProps {
  users: User[];
}

export const AttendanceReport: React.FC<AttendanceReportProps> = ({ users }) => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadAttendance();
  }, []);

  const loadAttendance = async () => {
    try {
      const data = await apiService.getData().then((d:any)=>d["attendance"]||[]);
      setAttendance(data);
    } catch (error) {
      console.error("Failed to load report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getAttendanceForUserAndDay = (userId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendance.find(a => a.userId === userId && a.date === dateStr);
  };

  const calculateUserStats = (userId: number) => {
    const userAttendance = attendance.filter(a => 
      a.userId === userId && 
      new Date(a.date) >= monthStart && 
      new Date(a.date) <= monthEnd
    );
    
    const present = userAttendance.filter(a => a.checkIn).length;
    const onTime = userAttendance.filter(a => a.checkIn?.onTime).length;
    const late = present - onTime;
    
    return { present, onTime, late };
  };

  if (loading) return <div>Loading reports...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-amber-500">Attendance Report</h2>
        <div className="flex items-center gap-2 bg-[#2A1D0E] p-1 rounded-lg border border-[#3D2B1A]">
          <button 
            onClick={() => setSelectedMonth(prev => new Date(prev.setMonth(prev.getMonth() - 1)))}
            className="p-1.5 hover:bg-[#3D2B1A] rounded text-amber-500 transition-colors"
          >
            &larr;
          </button>
          <span className="px-4 font-mono text-amber-200 text-sm">{format(selectedMonth, 'MMMM yyyy')}</span>
          <button 
            onClick={() => setSelectedMonth(prev => new Date(prev.setMonth(prev.getMonth() + 1)))}
            className="p-1.5 hover:bg-[#3D2B1A] rounded text-amber-500 transition-colors"
          >
            &rarr;
          </button>
        </div>
      </div>

      <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1C1207] border-bottom border-[#3D2B1A]">
                <th className="p-4 text-xs uppercase tracking-widest text-amber-200/40 font-mono sticky left-0 bg-[#1C1207] z-20">Employee</th>
                <th className="p-4 text-xs uppercase tracking-widest text-amber-200/40 font-mono text-center">Stats</th>
                {days.map(day => (
                  <th key={day.toString()} className="p-2 text-center text-[10px] uppercase tracking-tighter text-amber-200/40 font-mono min-w-[40px]">
                    {format(day, 'dd')}<br/>{format(day, 'EEE')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D2B1A]">
              {users.map(user => {
                const stats = calculateUserStats(user.id);
                return (
                  <tr key={user.id} className="hover:bg-[#3D2B1A]/30 transition-colors">
                    <td className="p-4 sticky left-0 bg-[#2A1D0E] z-10 border-r border-[#3D2B1A]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.name}</p>
                          <p className="text-[10px] text-amber-200/40 font-mono uppercase">{user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-4 justify-center">
                        <div className="text-center">
                          <p className="text-xs text-white font-mono">{stats.present}</p>
                          <p className="text-[9px] text-amber-200/40 uppercase">Days</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-green-400 font-mono">{stats.onTime}</p>
                          <p className="text-[9px] text-amber-200/40 uppercase">OnTime</p>
                        </div>
                      </div>
                    </td>
                    {days.map(day => {
                      const record = getAttendanceForUserAndDay(user.id, day);
                      return (
                        <td key={day.toString()} className="p-1">
                          <div className="flex items-center justify-center">
                            {!record ? (
                               <div className="w-6 h-6 rounded-md bg-white/5 border border-white/5" />
                            ) : record.checkIn ? (
                              <div className={clsx(
                                "w-6 h-6 rounded-md flex items-center justify-center",
                                record.checkIn.onTime ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              )}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-amber-200/40 uppercase tracking-widest font-mono">On Time</p>
            <p className="text-lg text-white font-serif">Punctual Entry</p>
          </div>
        </div>
        <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-amber-200/40 uppercase tracking-widest font-mono">Late</p>
            <p className="text-lg text-white font-serif">Delayed Entry</p>
          </div>
        </div>
        <div className="bg-[#2A1D0E] border border-[#3D2B1A] rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-amber-200/40 uppercase tracking-widest font-mono">Absent</p>
            <p className="text-lg text-white font-serif">No Record</p>
          </div>
        </div>
      </div>
    </div>
  );
};


