import React, { useState, useEffect, useMemo } from 'react';
import { storage } from './lib/storage';
import { User, Visit, Remark, Template, Settings, Page, CallLog, CallOutcome, Lead, LeadQuality, WebhookConfig, FollowUp, Activity, ActivityType, Project, LeadStatus, VisitStatus, VisitFilters, FollowUpMethod, Workflow } from './types';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { Toaster, toast } from 'react-hot-toast';
import { CalendarCheck, Plus, Phone, MessageSquare, Home } from 'lucide-react';

// Lazy load non-critical components for faster initial load
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const LeadList = React.lazy(() => import('./components/LeadList'));
const LeadDetail = React.lazy(() => import('./components/LeadDetail'));
const LeadForm = React.lazy(() => import('./components/LeadForm'));
const VisitList = React.lazy(() => import('./components/VisitList'));
const VisitForm = React.lazy(() => import('./components/VisitForm'));
const VisitDetail = React.lazy(() => import('./components/VisitDetail'));
const FollowUpList = React.lazy(() => import('./components/FollowUpList'));
const FollowUpForm = React.lazy(() => import('./components/FollowUpForm'));
const TemplateManager = React.lazy(() => import('./components/TemplateManager'));
const SettingsPage = React.lazy(() => import('./components/Settings'));
const Reports = React.lazy(() => import('./components/Reports'));
const WebhookSettings = React.lazy(() => import('./components/WebhookSettings'));
const HRMS = React.lazy(() => import('./components/HRMS'));
const WorkflowBuilder = React.lazy(() => import('./components/WorkflowBuilder'));
const VisitAnalysis = React.lazy(() => import('./components/VisitAnalysis'));
const VisitCompletionModal = React.lazy(() => import('./components/VisitCompletionModal'));
import TodayOverview from './components/TodayOverview';
import CallOutcomeModal from './components/CallOutcomeModal';
import PostCallWhatsAppModal from './components/PostCallWhatsAppModal';
import WhatsAppSender from './components/WhatsAppSender';
import Login from './components/Login';
import { aiService } from './lib/ai';
import { generateId } from './lib/storage';
import { cn } from './lib/utils';
import { normalizePhoneNumber } from './lib/phoneUtils';
import { QUICK_ACTION_CHIPS, QuickActionChipKey, addDaysISO, getLeadPendingNextAction, isLeadActiveForDiscipline } from './lib/workflowDiscipline';
import { useQueryClient } from '@tanstack/react-query';

import { apiService } from './lib/api-service';
import { syncEngine } from './lib/syncEngine';
import { useAppData, useStats, useSaveData } from './lib/queries';
import { pushService, urlBase64ToUint8Array } from './lib/push-service';
import ErrorBoundary from './components/ErrorBoundary';
import { socketService } from './lib/socket';

// (Logic moved inside App component to use React Query hooks)


export default function App() {
  const [user, setUser] = useState<User | null>(storage.getAuth());
  const [currentPage, setCurrentPage] = useState<Page>('today');
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data Fetching via React Query
  const queryClient = useQueryClient();
  const { data: appData, isLoading: isDataLoading, error: dataError } = useAppData();
  const { data: statsData } = useStats();
  const isInitialLoadDone = !isDataLoading;
  
  const leads = appData?.fullData.leads || [];
  const visits = appData?.fullData.visits || [];
  const remarks = appData?.fullData.remarks || {};
  const templates = appData?.initData.templates || [];
  const callLogs = appData?.fullData.call_logs || [];
  const followups = appData?.fullData.followups || [];
  const webhookConfigs = appData?.fullData.webhook_configs || [];
  const settings = appData?.initData.settings || {
    company: 'Signature Properties', 
    phone: '', 
    address: '',
    sources: [],
    budgets: [],
    propertyInterests: []
  };
  const users = appData?.fullData.users || [];
  const projects = appData?.initData.projects || [];
  const activities = appData?.fullData.activities || [];
  const attendance = appData?.fullData.attendance || [];
  const notifications = appData?.fullData.notifications || [];
  const workflows = appData?.initData.workflows || [];
  const stats = statsData || null;

  // Mutation for saving
  const saveDataMutation = useSaveData();
  // Centralized API helper inside component
  const api = {
    fetchRemarks: (targetId: string) => apiService.getRemarks(targetId),
    save: async (collection: string, h1: any, h2?: any) => {
      const data = h2 || h1;
      
      // Specialized remark handling
      if (collection === 'remarks' && data.targetId) {
        const res = await apiService.saveRemark(data.targetId, data);
        saveDataMutation.mutate({ collection: 'remarks', data }); // Trigger refresh
        return res;
      }

      const res = await saveDataMutation.mutateAsync({ collection, data });
      
      // Push notifications logic
      try {
        const currentUser = storage.getAuth();
        if (collection === 'leads' && data.assignedTo && data.assignedTo !== currentUser?.id) {
          pushService.sendPushNotification([data.assignedTo.toString()], "New Lead Assigned", `Lead ${data.name} has been assigned to you.`).catch(console.error);
        } else if (collection === 'visits' && data.assigned_to && data.assigned_to !== currentUser?.id && data.visit_status === 'scheduled') {
          pushService.sendPushNotification([data.assigned_to.toString()], "New Visit Scheduled", `Visit with ${data.client_name} is scheduled for ${data.visit_date}.`).catch(console.error);
        }
      } catch (e) {
        console.error("Push notify error:", e);
      }
      
      return res;
    },
    delete: async (collection: string, id: string) => {
      return apiService.delete(collection, id).then(() => {
        saveDataMutation.mutate({ collection, data: null }); // Trigger refresh
      });
    }
  };

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isPostCallWhatsAppOpen, setIsPostCallWhatsAppOpen] = useState(false);
  const [postCallOutcome, setPostCallOutcome] = useState<CallOutcome | null>(null);
  const [postCallTarget, setPostCallTarget] = useState<Lead | Visit | null>(null);
  const [activeCallVisit, setActiveCallVisit] = useState<Visit | null>(null);
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeVisitFilters, setActiveVisitFilters] = useState<VisitFilters | null>(null);
  const [activeLeadFilters, setActiveLeadFilters] = useState<LeadFilters | null>(null);
  const [followUpPromptData, setFollowUpPromptData] = useState<{ leadId?: string, visitId?: string, projectId: string, clientName: string, mandatory?: boolean } | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [preferredFollowUpMethod, setPreferredFollowUpMethod] = useState<FollowUpMethod>('call');
  const [isVisitCompletionModalOpen, setIsVisitCompletionModalOpen] = useState(false);
  const [completionVisit, setCompletionVisit] = useState<Visit | null>(null);
  const [completionLead, setCompletionLead] = useState<Lead | null>(null);

  const [loadStartTime] = useState(Date.now());
  const [showEmergencyReset, setShowEmergencyReset] = useState(false);

  useEffect(() => {
    if (isDataLoading) {
      const timer = setTimeout(() => setShowEmergencyReset(true), 8000);
      return () => clearTimeout(timer);
    } else {
      setShowEmergencyReset(false);
    }
  }, [isDataLoading]);

  const handleEmergencyReset = () => {
    localStorage.clear();
    window.location.replace('/');
  };

  useEffect(() => {
    if (appData?.fullData?.currentUser) {
      const serverUser = appData.fullData.currentUser;
      const currentAuth = storage.getAuth();
      if (!currentAuth || serverUser.id !== currentAuth.id || serverUser.updated_at !== currentAuth.updated_at) {
        setUser(serverUser);
        storage.saveAuth(serverUser);
      }
    }
  }, [appData?.fullData?.currentUser]);
  useEffect(() => {
    if (isInitialLoadDone && user) {
      const preLoad = () => {
        import('./components/Dashboard');
        import('./components/LeadList');
        import('./components/VisitList');
        import('./components/LeadDetail');
      };
      const timer = setTimeout(preLoad, 2000);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoadDone, user]);

  useEffect(() => {
    if (user) {
      storage.saveAuth(user);
    } else {
      storage.clearAuth();
    }
  }, [user]);




  useEffect(() => {
    // Viewport height fix for iOS Safari
    const setHeight = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    setHeight();
    window.addEventListener('resize', setHeight);

    // Check JWT token in localStorage
    const token = localStorage.getItem('crm_token');
    const authData = storage.getAuth();

    if (token && authData && !user) {
      setUser(authData as any);
    }

    return () => {
      window.removeEventListener('resize', setHeight);
    };
  }, []);

  // Real-time Socket Integration
  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token || !user) {
      socketService.disconnect();
      return;
    }

    const socket = socketService.connect(token);

    socket.on('data_update', ({ type, data }) => {
      console.log(`[Real-time] Update received for ${type}`, data);
      
      // Invalidate specific queries based on update type
      if (type === 'leads' || type === 'all') {
        queryClient.invalidateQueries({ queryKey: ['appData'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
      } else if (type === 'visits') {
        queryClient.invalidateQueries({ queryKey: ['appData'] });
      } else if (type === 'followups') {
        queryClient.invalidateQueries({ queryKey: ['appData'] });
      } else if (type === 'remarks') {
        // Remarks are often fetched on-demand, but appData might contain them
        queryClient.invalidateQueries({ queryKey: ['appData'] });
        if (data.targetId) {
          queryClient.invalidateQueries({ queryKey: ['remarks', data.targetId] });
        }
      } else {
        // Fallback for any other data type
        queryClient.invalidateQueries({ queryKey: ['appData'] });
      }

      // Show a subtle toast for background updates if they are important
      // (e.g., if a new lead is assigned to current user)
      if (type === 'leads' && data.assignedTo === user.id && !data.deleted) {
        toast.success(`New lead assigned: ${data.name || 'New Lead'}`, { icon: '🔔', duration: 5000 });
      }
    });

    return () => {
      socket.off('data_update');
    };
  }, [user?.id, queryClient]);

  // Handle Push Registration separately
  useEffect(() => {
    if (!isInitialLoadDone || !user) return;
    
    let isMounted = true;
    const registerPush = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        // If no registration, try to register
        const activeReg = registration || await navigator.serviceWorker.register('/sw.js');
        
        if (!isMounted) return;

        const permission = await Notification.requestPermission();
        if (permission === 'granted' && isMounted) {
          const { publicKey } = await pushService.getPublicKey();
          const subscription = await activeReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
          });
          await pushService.subscribeToPush(subscription);
        }
      } catch (error) { 
        console.warn('[Push] Registration/Subscription failed:', error); 
      }
    };
    
    // Delay slightly to not block initial render
    const timer = setTimeout(registerPush, 3000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isInitialLoadDone, user?.id]);

  // User synchronization is handled by React Query appData query

  // Fetch remarks when leads or visits change
  useEffect(() => {
     if (!leads.length && !visits.length) return;
     const allIds = [...leads.map(l => l.id), ...visits.map(v => v.id)];
     
     // REMOVED: Global remarks listener loop (Performance bottleneck on mobile)
    // Remarks are now handled on-demand in Detail components
    return () => {};
  }, [leads.length, visits.length]);

  const userRole = (user?.role || '').toLowerCase();
  const isAdminRole = userRole === 'admin' || userRole === 'adm';
  const isManagerRole = userRole === 'manager';
  const managedProjectIds = useMemo(() => user?.assignedProjectIds || (user?.projectId ? [user.projectId] : []), [user]);

  const filteredLeads = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return leads;
    if (isManagerRole) return leads.filter(l =>
      managedProjectIds.includes(l.projectId) || String(l.assignedTo) === String(user.id)
    );
    
    // Regular user: see their project's unassigned leads + any lead directly assigned to them
    return leads.filter(l => {
      const isAssignedToMe = String(l.assignedTo) === String(user.id);
      const isMyProjectUnassigned = l.projectId === user.projectId && !l.assignedTo;
      return isAssignedToMe || isMyProjectUnassigned;
    });
  }, [leads, user, isAdminRole, isManagerRole, managedProjectIds]);

  const filteredVisits = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return visits;
    // Manager: sees all visits in their project(s)
    if (isManagerRole) return visits.filter(v =>
      managedProjectIds.includes(v.projectId) ||
      v.assigned_to === user.name
    );
    
    // Regular user: visits assigned to them (by NAME) OR unassigned visits in their project
    return visits.filter(v => {
      const isAssignedToMe = v.assigned_to === user.name; // assigned_to stores NAME, not ID
      const isMyProject = v.projectId === user.projectId;
      return isAssignedToMe || (isMyProject && !v.assigned_to);
    });
  }, [visits, user, isAdminRole, isManagerRole, managedProjectIds]);

  const filteredFollowups = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return followups;
    if (isManagerRole) return followups.filter(f =>
      managedProjectIds.includes(f.projectId) || f.userName === user.name
    );
    
    const ownedLeadIds = new Set(filteredLeads.map(l => l.id));
    const ownedVisitIds = new Set(filteredVisits.map(v => v.id));
    
    return followups.filter(f => {
      // Match by userName (name-based) OR by owned lead/visit
      const isMyFollowup = f.userName === user.name;
      const leadMatch = f.leadId ? ownedLeadIds.has(f.leadId) : false;
      const visitMatch = f.visitId ? ownedVisitIds.has(f.visitId) : false;
      return isMyFollowup || leadMatch || visitMatch;
    });
  }, [followups, user, isAdminRole, isManagerRole, managedProjectIds, filteredLeads, filteredVisits]);

  const filteredCallLogs = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return callLogs;
    if (isManagerRole) return callLogs.filter(c => managedProjectIds.includes(c.projectId));
    return callLogs.filter(c => (c.projectId === user.projectId || c.projectId === 'p1'));
  }, [callLogs, user, isAdminRole, isManagerRole, managedProjectIds]);

  const filteredActivities = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return activities;
    if (isManagerRole) return activities.filter(a => managedProjectIds.includes(a.projectId));
    return activities.filter(a => (a.projectId === user.projectId || a.projectId === 'p1') && a.userId === user.id);
  }, [activities, user, isAdminRole, isManagerRole, managedProjectIds]);

  useEffect(() => {
    if (user) {
      console.log(`[iOS Diagnostic] Filtered Views Updated: Leads=${filteredLeads.length}, Visits=${filteredVisits.length}`);
    }
  }, [filteredLeads.length, filteredVisits.length, user?.id]);

  if (isDataLoading && !appData && localStorage.getItem('crm_token')) {
    return (
      <div className="min-h-[100dvh] bg-[#1C1207] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-8 max-w-sm w-full text-center">
          {initError ? (
            <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl shadow-lg">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <X size={32} />
              </div>
              <h3 className="text-red-400 font-['Cormorant_Garamond'] text-2xl font-bold mb-4">Connection Failed</h3>
              <p className="text-red-400/70 text-sm mb-8 leading-relaxed">{initError}</p>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-red-500 text-white py-3 rounded-lg font-bold text-sm tracking-widest uppercase hover:bg-red-600 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative mb-12">
                <div className="w-24 h-24 border-2 border-[#C9A84C]/20 border-t-[#C9A84C] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Home className="text-[#C9A84C]/40" size={24} />
                </div>
              </div>
              <h2 className="font-['Cormorant_Garamond'] text-[#E8C97A] text-3xl font-bold mb-2">Signature CRM</h2>
              <div className="flex items-center gap-2 text-[#C9A84C]/40 font-['Jost'] tracking-[0.3em] uppercase text-[10px] font-bold">
                <div className="w-8 h-[1px] bg-[#C9A84C]/20" />
                Initializing
                <div className="w-8 h-[1px] bg-[#C9A84C]/20" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleLogin = async (u: User) => {
    setUser(u);
    storage.saveAuth(u);
    toast.success(`Welcome back, ${u.name}!`);
  };

  const handleUpdateFollowUp = (id: string, updates: Partial<FollowUp>) => {
    const fup = followups.find(f => f.id === id);
    if (!fup) return;

    const newFollowups = followups.map(f => f.id === id ? { ...f, ...updates } : f);
    // Manual update removed
    const updatedFup = newFollowups.find(f => f.id === id);
    if (updatedFup) api.save('followups', updatedFup);

    // Backend owns lifecycle counters and activity audit entries; frontend keeps UX-only side effects here.
    const lead = leads.find(l => l.id === fup.leadId);
    const visit = visits.find(v => v.id === fup.visitId);
    const clientName = lead?.name || visit?.client_name || 'Client';
    const targetId = fup.leadId || (fup.visitId || '');

    if (updates.status === 'completed' && fup.status !== 'completed') {
      // Also add a remark if note exists
      if (updates.outcome_note) {
        const remark: Remark = {
          id: generateId(),
          text: `Follow-up Done: ${updates.outcome_note}`,
          by: user?.name || 'System',
          at: new Date().toISOString()
        };
        api.save('remarks', { ...remark, targetId });
      }
      
      toast.success('Follow-up marked as done');

      // CENTRALIZED PROMPT: Ask for next follow-up
      setFollowUpPromptData({
        leadId: fup.leadId,
        visitId: fup.visitId,
        projectId: fup.projectId,
        clientName,
        mandatory: !!(lead && isLeadActiveForDiscipline(lead))
      });
    } else if (updates.date && updates.date !== fup.date) {
      toast.success('Follow-up rescheduled');
    } else if (updates.status === 'cancelled' && fup.status !== 'cancelled') {
      toast.success('Follow-up cancelled');
    }
  };

  const buildFollowupScheduledAt = (dateValue: string, existingScheduledAt?: string) => {
    const base = existingScheduledAt ? new Date(existingScheduledAt) : null;
    const hours = base && !Number.isNaN(base.getTime()) ? base.getHours() : 10;
    const minutes = base && !Number.isNaN(base.getTime()) ? base.getMinutes() : 0;
    const scheduled = new Date(`${dateValue}T00:00:00`);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled.toISOString();
  };

  const handleRescheduleFollowUp = (id: string, date: string, note?: string) => {
    const fup = followups.find(f => f.id === id);
    if (!fup) return;
    handleUpdateFollowUp(id, {
      date,
      scheduled_at: buildFollowupScheduledAt(date, fup.scheduled_at),
      status: 'pending',
      completed_at: undefined,
      outcome_note: note || fup.outcome_note
    });
  };

  const handleLogout = () => {
    console.log("[Auth] Logout initiated");
    try {
      storage.clearAuth();
      localStorage.removeItem('crm_token');
      localStorage.removeItem('sf_auth');
      setUser(null);
      if (queryClient) {
        queryClient.clear();
      }
      toast.success('Logged out successfully');
      // Use a hard redirect to ensure all memory state is cleared
      setTimeout(() => {
        window.location.replace('/'); 
      }, 100);
    } catch (error) {
      console.error("Logout error:", error);
      storage.clearAuth();
      window.location.replace('/');
    }
  };

  const navigate = (page: Page, id: string | null = null, filters: any = null) => {
    setCurrentPage(page);
    setSelectedVisitId(id);
    
    if (page === 'visits') {
      setActiveVisitFilters(filters || null);
    } else if (page === 'leads') {
      setActiveLeadFilters(filters || null);
    } else {
      setActiveVisitFilters(null);
      setActiveLeadFilters(null);
    }
    
    if (page !== 'whatsapp') setGeneratedMessage(null);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  const logActivity = (type: ActivityType, targetId: string, targetName: string, details?: string) => {
    if (!user) return;
    const activity: Activity = {
      id: generateId(),
      type,
      userId: user.id || 0,
      userName: user.name,
      projectId: user.projectId,
      targetId,
      targetName,
      timestamp: new Date().toISOString(),
      details: details || null
    };
    const newActivities = [activity, ...activities];
    // Manual update removed
    api.save('activities', activity);
  };

  const runWorkflowEngine = (trigger: WorkflowTrigger, targetLead: Lead): Lead => {
    const activeWorkflows = workflows.filter(wf => wf.isActive && wf.trigger === trigger);
    let updatedLead = { ...targetLead };
    let hasChangesOverall = false;

    activeWorkflows.forEach(wf => {
      // Check conditions
      const matchesConditions = wf.conditions.every(c => {
        const val = (updatedLead as any)[c.field];
        if (c.operator === 'equals') return String(val) === c.value;
        if (c.operator === 'contains') return String(val).toLowerCase().includes(c.value.toLowerCase());
        return true;
      });

      if (matchesConditions) {
        console.log(`[Workflow] Running "${wf.name}" for lead ${updatedLead.name}`);
        
        wf.actions.forEach(action => {
          if (action.type === 'assign_user') {
            const userId = action.params.userId;
            const targetUser = users.find(u => u.id === userId);
            if (targetUser) {
              updatedLead.assignedTo = userId;
              updatedLead.assignedToName = targetUser.name;
              hasChangesOverall = true;
              toast.success(`Workflow: Assigned to ${targetUser.name}`);
            }
          }
          if (action.type === 'change_status') {
            updatedLead.status = action.params.status;
            hasChangesOverall = true;
            toast.success(`Workflow: Status changed to ${action.params.status}`);
          }
          if (action.type === 'send_whatsapp') {
            logActivity('whatsapp_sent', targetLead.id, targetLead.name, `Auto-Workflow: ${action.params.message}`);
          }
        });
      }
    });

    return updatedLead;
  };

  const handleCall = (v: Visit | Lead) => {
    window.open(`tel:${v.mobile}`, '_self');

    if ('visit_date' in v) {
      setActiveCallVisit(v as Visit);
      setActiveCallLead(leads.find(l => l.id === (v as Visit).leadId) || null);
    } else {
      setActiveCallLead(v as Lead);
      setActiveCallVisit(null);
    }
    setTimeout(() => {
      setIsCallModalOpen(true);
    }, 500); // Reduced delay for better UX
  };

  const handleWhatsApp = (v: Visit | Lead) => {
    if (!user) return;
    const project = projects.find(p => p.id === v.projectId);
    const projectName = project?.name || 'Signature Properties';
    const name = 'client_name' in v ? v.client_name : v.name;
    
    const message = `Hello ${name}, this is regarding your interest in ${projectName}. How can I assist you further? \n\nWarm Regards,\n${projectName}`;
    
    const num = v.mobile.replace(/[^0-9]/g, '');
    const finalNum = num.length === 10 ? `91${num}` : num;
    window.open(`https://wa.me/${finalNum}?text=${encodeURIComponent(message)}`, '_blank');
    
    logActivity('whatsapp_sent', v.id, name, `Quick Message - Project: ${projectName}`);
  };

  const handleLogCall = (v: Visit | Lead) => {
    if ('visit_date' in v) {
      setActiveCallVisit(v as Visit);
      setActiveCallLead(leads.find(l => l.id === (v as Visit).leadId) || null);
    } else {
      setActiveCallLead(v as Lead);
      setActiveCallVisit(null);
    }
    setIsCallModalOpen(true);
  };

  const recordCallOutcome = (v: Visit | Lead, outcome: CallOutcome, note?: string, chip?: QuickActionChipKey) => {
    if (!user) return;
    
    const visitId = 'visit_date' in v ? v.id : '';
    const leadId = 'visit_date' in v ? v.leadId : v.id;
    const lead = leads.find(l => l.id === leadId);

    const log: CallLog = {
      id: generateId(),
      visitId: visitId || '',
      leadId: leadId || '',
      projectId: v.projectId,
      outcome,
      note: note || null,
      timestamp: new Date().toISOString(),
      by: user.name
    };

    const newLogs = [log, ...callLogs];
    // Manual update removed
    api.save('call_logs', log);
    
    // Log activity
    logActivity(
      outcome === 'answered' ? 'call_answered' : 'call_attempted',
      leadId,
      'client_name' in v ? v.client_name : v.name,
      `Outcome: ${outcome.replace('_', ' ')}`
    );

    // Update Lead Stats and check for "Switched Off" logic
    if (lead) {
      const leadLogs = newLogs.filter(l => l.leadId === lead.id);
      const last3Outcomes = leadLogs.slice(0, 3).map(l => l.outcome);
      const shouldMoveToCold = last3Outcomes.length === 3 && last3Outcomes.every(o => o === 'switched_off');

      const updatedLead = {
        ...lead,
        quality: shouldMoveToCold ? 'cold' as LeadQuality : lead.quality,
        priority: chip && QUICK_ACTION_CHIPS[chip]?.suggestedPriority
          ? Math.max(Number(lead.priority || 0), Number(QUICK_ACTION_CHIPS[chip].suggestedPriority || 0))
          : lead.priority,
        stats: {
          ...lead.stats,
          calls_attempted: lead.stats.calls_attempted + 1,
          calls_answered: outcome === 'answered' ? lead.stats.calls_answered + 1 : lead.stats.calls_answered
        },
        updated_at: new Date().toISOString()
      };

      const newLeads = leads.map(l => l.id === lead.id ? updatedLead : l);
      // Manual state update removed; TanStack Query will handle refetch
      api.save('leads', updatedLead);

      if (shouldMoveToCold) {
        toast.error('Lead moved to Cold due to 3 consecutive Switched Off calls');
      }

      if (chip && isLeadActiveForDiscipline(lead) && !getLeadPendingNextAction(followups, lead.id)) {
        const cfg = QUICK_ACTION_CHIPS[chip];
        const base = getLocalDateString();
        const nextDate = addDaysISO(base, cfg.days);
        const autoFup: FollowUp = {
          id: generateId(),
          leadId: lead.id,
          projectId: lead.projectId,
          userId: lead.assignedTo || user.id,
          userName: users.find((u) => u.id === (lead.assignedTo || user.id))?.name || user.name,
          date: nextDate,
          scheduled_at: new Date(`${nextDate}T11:00:00`).toISOString(),
          purpose: cfg.actionType,
          method: cfg.method,
          status: 'pending',
          created_at: new Date().toISOString(),
          outcome_note: `Auto-created from quick chip: ${cfg.label}`
        };
        api.save('followups', autoFup);
      }

      if (!chip && isLeadActiveForDiscipline(lead) && !getLeadPendingNextAction(followups, lead.id)) {
        setFollowUpPromptData({
          leadId: lead.id,
          visitId: undefined,
          projectId: lead.projectId,
          clientName: lead.name,
          mandatory: true
        });
      }
    }

    toast.success('Call outcome recorded');

    // Trigger WhatsApp Prompt
    setPostCallOutcome(outcome);
    setPostCallTarget(v);
    setIsPostCallWhatsAppOpen(true);
  };

  const handleBulkDeleteLeads = (ids: string[]) => {
    const uRole = user?.role?.toLowerCase();
    const isActuallyAdmin = uRole === 'admin' || uRole === 'adm';
    if (!user || !isActuallyAdmin) {
      toast.error('Only admins can perform bulk delete');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${ids.length} leads?`)) return;
    
    // Manual state update removed; TanStack Query will handle refetch
    ids.forEach(id => api.delete('leads', id));
    toast.success(`${ids.length} leads deleted`);
  };

  const handleBulkAssignLeads = (ids: string[], userId: number, userName: string) => {
    const uRole = user?.role?.toLowerCase();
    const isActuallyAdmin = uRole === 'admin' || uRole === 'adm';
    if (!user || !isActuallyAdmin) {
      toast.error('Only admins can perform bulk assignment');
      return;
    }
    
    const newLeads = leads.map(l => ids.includes(l.id) ? { 
      ...l, 
      assignedTo: userId, 
      assignedToName: userName, 
      updated_at: new Date().toISOString() 
    } : l);
    
    // Manual state update removed; TanStack Query will handle refetch
    ids.forEach(id => {
      const lead = leads.find(l => l.id === id);
      if (lead) {
        api.save('leads', { ...lead, assignedTo: userId, assignedToName: userName });
        
        // Auto-schedule takeover call for the new owner
        const takeoverFup: FollowUp = {
          id: generateId(),
          leadId: lead.id,
          projectId: lead.projectId,
          userId: userId,
          userName: userName,
          date: getLocalDateString(),
          scheduled_at: new Date().toISOString(),
          purpose: 'Bulk Takeover Call: Introduce yourself to the new lead',
          method: 'call',
          status: 'pending',
          created_at: new Date().toISOString()
        };
        // Manual update removed
        api.save('followups', takeoverFup);
      }
    });
    
    logActivity('bulk_assigned', 'system', 'Multiple Leads', `Assigned ${ids.length} leads to ${userName}`);
    toast.success(`${ids.length} leads assigned to ${userName}`);
  };

  const handleTransferLead = (leadId: string, targetProjectId: string) => {
    const targetProject = projects.find(p => p.id === targetProjectId);
    if (!targetProject) return;

    const newLeads = leads.map(l => l.id === leadId ? { ...l, projectId: targetProjectId, updated_at: new Date().toISOString() } : l);
    const newVisits = visits.map(v => v.leadId === leadId ? { ...v, projectId: targetProjectId } : v);
    const newFollowups = followups.map(f => f.leadId === leadId ? { ...f, projectId: targetProjectId } : f);
    const newCallLogs = callLogs.map(c => c.leadId === leadId ? { ...c, projectId: targetProjectId } : c);
    const newActivities = activities.map(a => a.targetId === leadId || visits.some(v => v.leadId === leadId && v.id === a.targetId) ? { ...a, projectId: targetProjectId } : a);

    // Manual state update removed; TanStack Query will handle refetch
    // Manual update removed

    // Save changes for the transferred lead and its related entities
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      api.save('leads', { ...lead, projectId: targetProjectId, updated_at: new Date().toISOString() });
      visits.filter(v => v.leadId === leadId).forEach(v => api.save('visits', { ...v, projectId: targetProjectId }));
      followups.filter(f => f.leadId === leadId).forEach(f => api.save('followups', { ...f, projectId: targetProjectId }));
      callLogs.filter(c => c.leadId === leadId).forEach(c => api.save('call_logs', { ...c, projectId: targetProjectId }));
    }
    
    logActivity('lead_transferred', leadId, lead?.name || 'Lead', `Transferred to ${targetProject.name}`);
    
    toast.success(`Lead transferred to ${targetProject.name}`);
    navigate('leads');
  };

  const handlePostCallWhatsApp = (templateId: string) => {
    if (!postCallTarget) return;
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const leadId = 'leadId' in postCallTarget ? postCallTarget.leadId : postCallTarget.id;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const project = projects.find(p => p.id === lead.projectId);
    const projectName = project?.name || '';

    // Log activity
    logActivity('whatsapp_sent', lead.id, lead.name, `Template: ${template.name}`);

    // Prepare message
    let message = template.message
      .replace(/{client_name}/g, lead.name)
      .replace(/{mobile}/g, lead.mobile)
      .replace(/{source}/g, lead.source)
      .replace(/{project_name}/g, projectName)
      .replace(/{budget}/g, lead.budget || '')
      .replace(/{property_interest}/g, lead.property_interest || '')
      .replace(/{sample_house_link}/g, project?.sample_house_video || '')
      .replace(/{walkthrough_link}/g, project?.walkthrough_video || '')
      .replace(/{testimonials_link}/g, project?.testimonial_video || '')
      .replace(/{brochure_link}/g, project?.brochure_link || '')
      .replace(/{location_link}/g, project?.google_maps_link || '');

    if ('visit_date' in postCallTarget) {
      message = message.replace(/{visit_date}/g, postCallTarget.visit_date)
                       .replace(/{visit_status}/g, postCallTarget.visit_status?.replace('_', ' ').toUpperCase() || '');
    }

    const num = lead.mobile.replace(/[^0-9]/g, '');
    const finalNum = num.length === 10 ? `91${num}` : num;
    
    // Save to whatsapp_messages for the WhatsApp tab history
    const waMsg: WhatsAppMessage = {
      id: 'msg_out_' + Date.now(),
      leadId: lead.id,
      senderName: user.name,
      senderPhoneNumber: 'System',
      content: message,
      timestamp: new Date().toISOString(),
      type: 'outgoing',
      projectId: lead.projectId
    };
    api.save('whatsapp_messages', waMsg);
    
    window.open(`https://wa.me/${finalNum}?text=${encodeURIComponent(message)}`, '_blank');
    
    // Add remark for WhatsApp message
    const remark: Remark = {
      id: generateId(),
      text: `WhatsApp Sent: ${template.name}`,
      by: user.name,
      at: new Date().toISOString()
    };
    // Manual update removed
    api.save('remarks', { ...remark, targetId: lead.id });

    setIsPostCallWhatsAppOpen(false);
  };

  const handleAIScoreLead = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const leadRemarks = remarks[leadId] || [];
    toast.loading('Analyzing lead with AI...', { id: 'ai-scoring' });

    const newQuality = await aiService.scoreLead(lead, leadRemarks);
    
    if (newQuality) {
      const updatedLead = { ...lead, quality: newQuality, updated_at: new Date().toISOString() };
      // Manual state update removed
      api.save('leads', updatedLead);
      
      const remark: Remark = {
        id: generateId(),
        text: `AI Lead Scoring: Updated quality to ${newQuality.toUpperCase()} based on conversation analysis.`,
        by: "Gemini AI",
        at: new Date().toISOString()
      };
      // Manual update removed
      api.save('remarks', { ...remark, targetId: leadId });
      
      toast.success(`AI updated lead quality to ${newQuality}`, { id: 'ai-scoring' });
    } else {
      toast.error('AI could not determine lead quality', { id: 'ai-scoring' });
    }
  };

  const handleBulkAIScore = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    
    toast.loading(`Analyzing ${leadIds.length} leads with AI...`, { id: 'bulk-ai' });
    
    let updatedLeads = [...leads];
    let updatedRemarks = { ...remarks };
    let successCount = 0;

    for (const leadId of leadIds) {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) continue;

      const leadRemarks = remarks[leadId] || [];
      const newQuality = await aiService.scoreLead(lead, leadRemarks);

      if (newQuality) {
        const updatedLead = { ...lead, quality: newQuality, updated_at: new Date().toISOString() };
        updatedLeads = updatedLeads.map(l => l.id === leadId ? updatedLead : l);
        api.save('leads', updatedLead);
        
        const remark: Remark = {
          id: generateId(),
          text: `AI Bulk Scoring: Quality set to ${newQuality.toUpperCase()}.`,
          by: "Gemini AI",
          at: new Date().toISOString()
        };
        api.save('remarks', { ...remark, targetId: leadId });
        successCount++;
      }
    }

    // Manual state update removed
    toast.success(`Successfully analyzed ${successCount} leads`, { id: 'bulk-ai' });
  };

  const handleCallOutcome = (outcome: CallOutcome, note?: string, chip?: QuickActionChipKey) => {
    const target = activeCallVisit || activeCallLead;
    if (target) {
      recordCallOutcome(target, outcome, note, chip);
    }
    setIsCallModalOpen(false);
    setActiveCallVisit(null);
    setActiveCallLead(null);
  };

  if (isDataLoading) {
    return (
      <div className="fixed inset-0 bg-[#1C1207] flex flex-col items-center justify-center z-[100] p-6 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] rounded-3xl flex items-center justify-center text-[#1C1207] shadow-md mb-8">
          <Home size={40} />
        </div>
        <h2 className="font-['Cormorant_Garamond'] text-[#E8C97A] text-2xl font-bold mb-2">Signature Properties</h2>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce" />
        </div>
        
        {showEmergencyReset && (
          <div className="mt-12 space-y-4">
            <p className="text-[#C9A84C]/60 text-xs max-w-[200px]">Taking longer than usual? Stale data might be causing a conflict.</p>
            <button 
              onClick={handleEmergencyReset}
              className="bg-white/10 hover:bg-white/20 text-[#E8C97A] border border-[#C9A84C]/30 px-6 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              Clear Cache & Reset
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#1C1207] flex flex-col">
          <Login onLogin={handleLogin} users={users} />
          <Toaster position="bottom-right" />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F2ECD8] flex text-[#2A1C00] font-['Jost']">
      <Sidebar 
        user={user}
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        currentPage={currentPage} 
        onNavigate={navigate}
        onLogout={handleLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0 ml-0 lg:ml-64">
        <Topbar 
          user={user} 
          title={currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace('-', ' ')} 
          onMenuClick={() => setIsSidebarOpen(true)}
          onNavigate={navigate}
          notifications={notifications}
          attendance={attendance}
          onAttendanceUpdate={(record) => {
            // Manual update removed
          }}
        />
        
        <main className="p-4 lg:p-8 flex-1 overflow-x-hidden">
          <React.Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
              <div className="w-10 h-10 border-4 border-[#C9A84C]/20 border-t-[#C9A84C] rounded-full animate-spin" />
              <p className="text-[10px] font-black text-[#C9A84C] uppercase tracking-[0.2em] animate-pulse">Loading Module...</p>
            </div>
          }>
            <div key={currentPage + (selectedVisitId || '')}>
            {currentPage === 'today' && (
            <TodayOverview
              leads={filteredLeads}
              visits={filteredVisits}
              followUps={filteredFollowups}
              callLogs={filteredCallLogs}
              users={users}
              user={user}
              onNavigate={navigate}
            />
          )}
          {currentPage === 'dashboard' && (
            <Dashboard 
              visits={filteredVisits} 
              leads={filteredLeads}
              followUps={filteredFollowups}
              user={user}
              users={users}
              projects={projects}
              callLogs={filteredCallLogs}
              stats={stats}
              onNavigate={navigate} 
            />
          )}
          {currentPage === 'hrms' && (
            <HRMS 
              user={user} 
              users={users} 
              projects={projects}
              attendance={attendance}
              onNavigate={navigate} 
            />
          )}
          {currentPage === 'leads' && (
            <LeadList 
              leads={filteredLeads} 
              users={users}
              projects={projects}
              initialFilters={activeLeadFilters}
              onNavigate={navigate} 
              onAddLead={() => setIsLeadFormOpen(true)}
              onCall={handleCall}
              onWhatsApp={handleWhatsApp}
              onBulkScore={handleBulkAIScore}
              onUpdateStatus={(id, status) => {
                const lead = leads.find(l => l.id === id);
                if (lead && lead.status !== status) {
                  // BUG-LESS SYNC: Trigger modal if status is changed to 'visit_done'
                  if (status === 'visit_done') {
                    const pendingVisits = visits.filter(v => v.leadId === id && (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled'));
                    if (pendingVisits.length > 0) {
                      const latestVisit = [...pendingVisits].sort((a, b) => b.visit_date.localeCompare(a.visit_date))[0];
                      setCompletionVisit(latestVisit);
                      setCompletionLead(lead);
                      setIsVisitCompletionModalOpen(true);
                      return;
                    } else {
                      // No pending visit found? Create a "ghost" visit to complete so it shows in analytics
                      const ghostVisit: Visit = {
                        id: generateId(),
                        leadId: id,
                        client_name: lead.name,
                        mobile: lead.mobile,
                        email: lead.email || '',
                        visit_date: new Date().toISOString().split('T')[0],
                        visit_status: 'scheduled', // Will be completed by modal
                        projectId: lead.projectId,
                        created_at: new Date().toISOString(),
                        assigned_to: user?.name || 'System',
                        source: lead.source,
                        budget: lead.budget || '',
                        property_interest: lead.property_interest || '',
                        priority: lead.priority
                      };
                      setCompletionVisit(ghostVisit);
                      setCompletionLead(lead);
                      setIsVisitCompletionModalOpen(true);
                      return;
                    }
                  }

                  const initialUpdate = { ...lead, status, updated_at: new Date().toISOString() };
                  const processedLead = runWorkflowEngine('status_changed', initialUpdate);
                  
                  // Manual update removed
                  api.save('leads', processedLead);
                  logActivity('lead_status_changed', id, lead.name, `Status changed from ${lead.status} to ${status}`);
                  toast.success('Lead status updated');
                }
              }}
              followUps={followups}
              visits={visits}
              onBulkDelete={handleBulkDeleteLeads}
              onBulkAssign={handleBulkAssignLeads}
            />
          )}
          {currentPage === 'lead-detail' && selectedVisitId && (
            <LeadDetail 
              user={user}
              lead={leads.find(l => l.id === selectedVisitId) || {} as any}
              visits={visits.filter(v => v.leadId === selectedVisitId)}
              remarks={remarks[selectedVisitId] || []}
              callLogs={callLogs.filter(c => c.leadId === selectedVisitId)}
              followUps={filteredFollowups}
              projects={projects}
              users={users}
              onUpdateLead={(l) => {
                const oldLead = leads.find(lead => lead.id === l.id);
                if (oldLead?.status !== 'visit_done' && l.status === 'visit_done') {
                  const pendingVisits = visits.filter(v => v.leadId === l.id && (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled'));
                  if (pendingVisits.length > 0) {
                    const latestVisit = [...pendingVisits].sort((a, b) => b.visit_date.localeCompare(a.visit_date))[0];
                    setCompletionVisit(latestVisit);
                    setCompletionLead(l);
                    setIsVisitCompletionModalOpen(true);
                  } else {
                    const ghostVisit: Visit = {
                      id: generateId(),
                      leadId: l.id,
                      client_name: l.name,
                      mobile: l.mobile,
                      email: l.email || '',
                      visit_date: new Date().toISOString().split('T')[0],
                      visit_status: 'scheduled',
                      projectId: l.projectId,
                      created_at: new Date().toISOString(),
                      assigned_to: user?.name || 'System',
                      source: l.source,
                      budget: l.budget || '',
                      property_interest: l.property_interest || '',
                      priority: l.priority
                    };
                    setCompletionVisit(ghostVisit);
                    setCompletionLead(l);
                    setIsVisitCompletionModalOpen(true);
                  }
                  return;
                }
                // Manual state update removed
                api.save('leads', l);
              }}
              onAddVisit={(l) => navigate('add-visit', l.id)}
              onAddFollowUp={(f) => {
                const isDuplicate = followups.some(existing => 
                  existing.leadId === f.leadId && 
                  existing.status === 'pending' && 
                  existing.date === f.date
                );
                if (isDuplicate) return;

                // Manual update removed
                api.save('followups', f);
                toast.success('Follow-up scheduled');
              }}
              onUpdateFollowUp={handleUpdateFollowUp}
              onAddRemark={(r) => {
                // Manual update removed
                api.save('remarks', { ...r, targetId: selectedVisitId });
              }}
              onAIScore={() => {
                if (selectedVisitId) handleAIScoreLead(selectedVisitId);
              }}
              onCall={handleCall}
              onWhatsApp={handleWhatsApp}
              onLogCallOutcome={(outcome, note) => {
                const lead = leads.find(l => l.id === selectedVisitId);
                if (lead) recordCallOutcome(lead, outcome, note);
              }}
              onNavigate={navigate}
              onTransferLead={handleTransferLead}
              onQuickVisitSave={(v) => {
                // Manual update removed
                api.save('visits', v);
                logActivity('visit_scheduled', v.id, v.client_name, `Quick Schedule: ${v.visit_date}`);
              }}
            />
          )}
          {currentPage === 'visits' && (
            <VisitList 
              visits={filteredVisits} 
              remarks={remarks}
              users={users}
              projects={projects}
              leads={leads}
              initialFilters={activeVisitFilters}
              onNavigate={navigate} 
              onCall={handleCall}
              onWhatsApp={handleWhatsApp}
              onDelete={(id) => {
                // Manual state update removed
                api.delete('visits', id);
                toast.success('Visit deleted');
              }}
              onUpdateVisit={(v) => {
                const oldVisit = visits.find(vis => vis.id === v.id);
                // Manual state update removed
                api.save('visits', v);
                
                if (v.leadId && oldVisit) {
                  const lead = leads.find(l => l.id === v.leadId);
                  if (lead) {
                    let updatedLead = { ...lead };
                    let leadChanged = false;
                    const oldStatus = oldVisit.visit_status;
                    const newStatus = v.visit_status;

                    // Handle Rescheduled
                    if (oldStatus !== 'rescheduled' && newStatus === 'rescheduled') {
                      logActivity('visit_rescheduled', v.id, v.client_name);
                      // Don't change lead status yet, but could update activity
                    }

                    if (leadChanged) {
                      // Manual state update removed
                      api.save('leads', updatedLead);
                    }
                  }
                }
                toast.success('Visit updated');
              }}
              followUps={followups}
            />
          )}
          {currentPage === 'add-visit' && user && (
            <VisitForm 
              initialLeadId={selectedVisitId || undefined}
              leads={filteredLeads}
              settings={settings}
              projectId={user.projectId}
              currentUser={user}
              users={users}
              onSave={async (v, r, leadStatus) => {
                if (!v.projectId && user?.projectId) v.projectId = user.projectId;
                let targetLeadId = v.leadId;

                // Auto-create lead if missing
                if (!targetLeadId || targetLeadId === 'null' || targetLeadId === 'undefined') {
                  // Final safety check: see if a lead with this mobile already exists locally
                  const normalizedMob = (v.mobile || '').replace(/\D/g, '').slice(-10);
                  const existingLead = leads.find(l => (l.mobile || '').replace(/\D/g, '').slice(-10) === normalizedMob);
                  
                  if (existingLead) {
                    v.leadId = existingLead.id;
                    targetLeadId = existingLead.id;
                  } else {
                    const newLead: Lead = {
                      id: generateId(),
                      name: v.client_name,
                      mobile: v.mobile,
                      email: v.email,
                      source: v.source || 'Direct Site Visit',
                      projectId: v.projectId,
                      assignedTo: user.id,
                      assignedToName: user.name,
                      quality: v.status,
                      status: (v.visit_status === 'completed' ? 'visit_done' : 'visit_scheduled') as LeadStatus,
                      budget: v.budget,
                      property_interest: v.property_interest,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      stats: {
                        visits_planned: (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled') ? 1 : 0,
                        visits_done: v.visit_status === 'completed' ? 1 : 0,
                        calls_attempted: 0,
                        calls_answered: 0,
                        followups_done: 0
                      }
                    };
                    
                    await api.save('leads', newLead);
                    // Manual state update removed
                    targetLeadId = newLead.id;
                    v.leadId = newLead.id;
                    
                    // Add auto-creation remark
                    const autoRemark: Remark = {
                      id: generateId(),
                      text: `Auto lead create as site visit ${v.visit_status === 'completed' ? 'completed' : 'scheduled'}`,
                      by: user.name,
                      at: new Date().toISOString()
                    };
                    await api.save('remarks', { ...autoRemark, targetId: newLead.id });
                    // Manual update removed
                  }
                }

                await api.save('visits', v);
                // Manual update removed
                
                if (targetLeadId) {
                  const lead = leads.find(l => l.id === targetLeadId);
                  if (lead) {
                    const currentStats = lead.stats || { visits_planned: 0, visits_done: 0, calls_attempted: 0, calls_answered: 0, followups_done: 0 };
                    const updatedLead = {
                      ...lead,
                      status: leadStatus || (v.visit_status === 'completed' ? 'visit_done' : 'visit_scheduled'),
                      stats: { 
                        ...currentStats, 
                        visits_planned: (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled') ? currentStats.visits_planned + 1 : currentStats.visits_planned,
                        visits_done: v.visit_status === 'completed' ? currentStats.visits_done + 1 : currentStats.visits_done
                      }
                    };
                    // Manual state update removed
                    api.save('leads', updatedLead);
                  }
                }

                logActivity('visit_scheduled', v.id, v.client_name, `Date: ${v.visit_date}`);

                if (r) {
                  // Manual update removed
                  api.save('remarks', { ...r, targetId: v.id });
                }
                navigate('detail', v.id);
                toast.success('Visit saved successfully');
              }}
              onCancel={() => navigate('visits')}
            />
          )}
          {currentPage === 'detail' && selectedVisitId && (
            <VisitDetail 
              user={user}
              visit={visits.find(v => v.id === selectedVisitId)!}
              lead={leads.find(l => l.id === (visits.find(v => v.id === selectedVisitId)?.leadId)) || null}
              remarks={remarks[selectedVisitId] || []}
              callLogs={callLogs.filter(c => c.visitId === selectedVisitId)}
              followUps={filteredFollowups}
              onUpdateFollowUp={handleUpdateFollowUp}
              onAddVisit={async (newVis) => {
                // Ensure lead linkage even for re-visits
                if (!newVis.leadId) {
                   const normalizedMob = (newVis.mobile || '').replace(/\D/g, '').slice(-10);
                   const existingLead = leads.find(l => (l.mobile || '').replace(/\D/g, '').slice(-10) === normalizedMob);
                   if (existingLead) {
                     newVis.leadId = existingLead.id;
                   }
                }
                
                await api.save('visits', newVis);
                // Manual update removed
                // Update lead stats if necessary
                if (newVis.leadId) {
                  const lead = leads.find(l => l.id === newVis.leadId);
                  if (lead) {
                    const currentStats = lead.stats || { visits_planned: 0, visits_done: 0, calls_attempted: 0, calls_answered: 0, followups_done: 0 };
                    const updatedLead = {
                      ...lead,
                      stats: {
                        ...currentStats,
                        visits_planned: currentStats.visits_planned + 1
                      }
                    };
                    // Manual state update removed
                    api.save('leads', updatedLead);
                  }
                }
              }}
              onUpdateVisit={(v) => {
                const oldVisit = visits.find(vis => vis.id === v.id);
                // Manual update removed
                api.save('visits', v);
                
                if (v.leadId && oldVisit) {
                  const lead = leads.find(l => l.id === v.leadId);
                  if (lead) {
                    let updatedLead = { ...lead };
                    let leadChanged = false;
                    const oldStatus = oldVisit.visit_status;
                    const newStatus = v.visit_status;

                    // Handle Completed
                    if (oldStatus !== 'completed' && newStatus === 'completed') {
                      v.completed_at = new Date().toISOString();
                      updatedLead.status = 'visit_done';
                      updatedLead.stats.visits_done += 1;
                      leadChanged = true;
                      logActivity('visit_completed', v.id, v.client_name);
                    } else if (oldStatus === 'completed' && newStatus !== 'completed') {
                      v.completed_at = undefined;
                      updatedLead.status = 'visit_scheduled';
                      updatedLead.stats.visits_done -= 1;
                      leadChanged = true;
                    }

                    // Handle Cancelled
                    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
                      updatedLead.status = 'contacted';
                      updatedLead.stats.visits_planned -= 1;
                      leadChanged = true;
                      logActivity('visit_cancelled', v.id, v.client_name);
                    } else if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
                      updatedLead.status = 'visit_scheduled';
                      updatedLead.stats.visits_planned += 1;
                      leadChanged = true;
                    }

                    // Handle Rescheduled
                    if (oldStatus !== 'rescheduled' && newStatus === 'rescheduled') {
                      logActivity('visit_rescheduled', v.id, v.client_name);
                    }

                    if (leadChanged) {
                      // Manual state update removed
                      api.save('leads', updatedLead);
                    }
                  }
                }
              }}
              onUpdateLead={(updatedLead) => {
                // Manual state update removed
                api.save('leads', updatedLead);
              }}
              onAddFollowUp={(f) => {
                const isDuplicate = followups.some(existing => 
                  existing.leadId === f.leadId && 
                  existing.status === 'pending' && 
                  existing.date === f.date
                );
                if (isDuplicate) return;

                // Manual update removed
                api.save('followups', f);
                logActivity('followup_scheduled', selectedVisitId, visits.find(v => v.id === selectedVisitId)?.client_name || 'Visit', `Follow-up scheduled for ${f.date}${f.purpose ? `: ${f.purpose}` : ''}`);
                
                // Add a remark so notes are visible in history
                if (f.purpose) {
                  const remark: Remark = {
                    id: generateId(),
                    text: `Scheduled Follow-up (${new Date(f.date).toLocaleDateString()}): ${f.purpose}`,
                    by: user.name,
                    at: new Date().toISOString(),
                    type: 'remark'
                  };
                  // Manual update removed
                  api.save('remarks', { ...remark, targetId: selectedVisitId });
                }
                
                toast.success('Follow-up scheduled');
              }}
              onCall={() => {
                const v = visits.find(v => v.id === selectedVisitId);
                if (v) handleCall(v);
              }}
              onLogCallOutcome={(outcome, note) => {
                const v = visits.find(v => v.id === selectedVisitId);
                if (v) recordCallOutcome(v, outcome, note);
              }}
              onNavigate={navigate}
              onSetGeneratedMessage={setGeneratedMessage}
            />
          )}
          {currentPage === 'reports' && (
            <Reports 
              callLogs={filteredCallLogs} 
              visits={filteredVisits} 
              leads={filteredLeads}
              activities={filteredActivities}
              users={users}
              projects={projects}
              onNavigate={navigate}
              currentUserRole={user?.role}
            />
          )}
          {currentPage === 'followups' && (
            <FollowUpList 
              followUps={filteredFollowups}
              leads={leads}
              visits={visits}
              projects={projects}
              user={user}
              users={users}
              onUpdateStatus={(id, status, note) => {
                handleUpdateFollowUp(id, {
                  status,
                  outcome_note: note,
                  completed_at: status === 'completed' ? new Date().toISOString() : undefined
                });
              }}
              onReschedule={handleRescheduleFollowUp}
              onNavigate={navigate}
              onCall={handleCall}
            />
          )}
          {currentPage === 'webhooks' && (
            <WebhookSettings 
              configs={webhookConfigs}
              projects={projects}
              users={users}
              onSave={(c) => {
                const exists = webhookConfigs.find(conf => conf.id === c.id);
                // Manual update removed
                api.save('webhook_configs', c);
                toast.success(exists ? 'Webhook updated' : 'Webhook created');
              }}
              onDelete={(id) => {
                // Manual update removed
                api.delete('webhook_configs', id);
                toast.success('Webhook deleted');
              }}
            />
          )}
          {currentPage === 'whatsapp' && (
            <WhatsAppSender 
              visits={visits} 
              projects={projects}
              templates={templates}
              initialVisitId={selectedVisitId}
              initialMessage={generatedMessage}
              onLogActivity={(targetId, targetName, details) => logActivity('whatsapp_sent', targetId, targetName, details)}
              onSaveMessage={(leadId, content) => {
                const lead = leads.find(l => l.id === leadId);
                const waMsg: WhatsAppMessage = {
                  id: 'msg_out_' + Date.now(),
                  leadId,
                  senderName: user?.name || 'System',
                  senderPhoneNumber: 'System',
                  content,
                  timestamp: new Date().toISOString(),
                  type: 'outgoing',
                  projectId: lead?.projectId || user?.projectId || ''
                };
                api.save('whatsapp_messages', waMsg);
              }}
            />
          )}
          {currentPage === 'templates' && (
            <TemplateManager 
              templates={templates}
              onSave={(t) => {
                const exists = templates.find(temp => temp.id === t.id);
                // Manual update removed
                api.save('templates', t);
                toast.success(exists ? 'Template updated' : 'Template created');
              }}
              onDelete={(id) => {
                // Manual update removed
                api.delete('templates', id);
                toast.success('Template deleted');
              }}
            />
          )}
          {currentPage === 'settings' && (
            <SettingsPage 
              user={user}
              settings={settings}
              users={users}
              projects={projects}
              allData={{
                visits,
                remarks,
                templates,
                leads,
                callLogs,
                webhookConfigs
              }}
              onSaveSettings={(s) => {
                // Manual update removed
                api.save('settings', s);
                toast.success('Settings saved');
              }}
              onAddUser={(nu) => {
                // Manual update removed
                
                // If it's the currently logged-in user, update local state immediately for fast UI
                if (user && nu.id === user.id) {
                  setUser(nu);
                  storage.saveAuth(nu);
                }

                toast.promise(api.save('users', nu.id.toString(), nu), {
                  loading: 'Saving user details...',
                  success: 'Changes saved to database',
                  error: (err) => `Failed to save: ${err.message}`
                });
              }}
              onRemoveUser={(id) => {
                // Manual update removed
                api.delete('users', id.toString());
                toast.success('User removed');
              }}
              onAddProject={(np) => {
                // Manual update removed
                toast.promise(api.save('projects', np.id, np), {
                  loading: 'Saving project...',
                  success: 'Project saved to database',
                  error: (err) => `Failed to save project: ${err.message}`
                });
              }}
              onRemoveProject={(id) => {
                // Manual update removed
                api.delete('projects', id);
                toast.success('Project removed');
              }}
              onImportData={(data) => {
                // Bulk import could be handled by a dedicated API if needed
                toast.error('Import not supported in current backend phase');
              }}
            />
          )}
          {currentPage === 'workflow' && isAdminRole && (
            <WorkflowBuilder 
              projects={projects}
              users={users}
              workflows={workflows}
              onSave={(wf) => {
                const exists = workflows.find(w => w.id === wf.id);
                // Manual update removed
                api.save('workflows', wf);
                toast.success(exists ? 'Workflow updated' : 'Workflow created');
              }}
              onDelete={(id) => {
                // Manual update removed
                api.delete('workflows', id);
                toast.success('Workflow deleted');
              }}
            />
          )}
          {currentPage === 'visit-analysis' && (
            <VisitAnalysis 
              visits={filteredVisits}
              leads={leads}
              projects={projects}
              onBack={() => navigate('dashboard')}
              onNavigate={navigate}
            />
          )}
          </div>
          </React.Suspense>
        </main>
      </div>
      
      <Toaster position="bottom-right" />

      {isLeadFormOpen && user && (
        <LeadForm 
          onSave={async (l) => {
            if (!l.projectId && user?.projectId) l.projectId = user.projectId;
            
            // Run workflow engine BEFORE saving to avoid race conditions
            const processedLead = runWorkflowEngine('lead_created', l);
            
            // Manual state update removed
            toast.promise(api.save('leads', processedLead), {
              loading: 'Saving lead...',
              success: 'Lead saved to database',
              error: (err) => `Failed to save: ${err.message}`
            });
            logActivity('lead_created', processedLead.id, processedLead.name, `Source: ${processedLead.source}`);
            setIsLeadFormOpen(false);
            navigate('lead-detail', processedLead.id);
          }}
          onClose={() => setIsLeadFormOpen(false)}
          existingLeads={leads}
          sources={settings.sources}
          projectId={user.projectId}
          users={users}
          currentUser={user}
        />
      )}
      
      <CallOutcomeModal 
        isOpen={isCallModalOpen}
        onClose={() => {
          setIsCallModalOpen(false);
          setActiveCallVisit(null);
          setActiveCallLead(null);
        }}
        onSelect={handleCallOutcome}
        clientName={activeCallVisit?.client_name || activeCallLead?.name || ''}
      />

      {/* Follow-up Prompt Portal */}
      {followUpPromptData && !isFollowUpModalOpen && (
        <div className="fixed inset-0 bg-black/45 z-[60] flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white border border-[#E6D8B8] rounded-xl shadow-lg w-full max-w-sm overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 bg-[#FDF8E6] text-[#C9A84C] rounded-xl flex items-center justify-center mx-auto mb-4 border border-[#F2ECD8]">
                <CalendarCheck size={32} />
              </div>
              <h3 className="font-bold text-lg text-[#2A1C00] mb-1">Schedule Next Step?</h3>
              <p className="text-xs text-[#9A8262] mb-4 leading-relaxed">
                The follow-up for <span className="font-bold text-[#5C4820]">{followUpPromptData.clientName}</span> is complete. 
                {followUpPromptData.mandatory ? ' Next action is required to keep this lead active.' : ' Would you like to schedule the next follow-up now?'}
              </p>

              <div className="space-y-2 mb-5">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider block text-left mb-1">Follow-up Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'call', label: 'Call', icon: Phone },
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPreferredFollowUpMethod(m.id as FollowUpMethod)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 border rounded-lg transition-colors",
                        preferredFollowUpMethod === m.id 
                          ? "bg-[#C9A84C] border-[#C9A84C] text-white" 
                          : "bg-white border-[#E6D8B8] text-[#9A8262] hover:border-[#C9A84C]/50"
                      )}
                    >
                      <m.icon size={16} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="w-full bg-[#C9A84C] text-white font-bold py-2.5 rounded-lg hover:bg-[#B59640] transition-colors active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Schedule Next Follow-up
                </button>
                {!followUpPromptData.mandatory && (
                  <button 
                    onClick={() => {
                      setFollowUpPromptData(null);
                      setPreferredFollowUpMethod('call');
                    }}
                    className="w-full bg-white border border-[#E6D8B8] text-[#9A8262] font-semibold py-2.5 rounded-lg hover:bg-[#FDFAF2] transition-colors"
                  >
                    Not now, maybe later
                  </button>
                )}
              </div>
            </div>
            <div className="bg-[#FAF9F6] px-4 py-2 border-t border-[#F2ECD8] flex justify-center">
              <p className="text-[10px] text-[#9A8262] uppercase font-black tracking-widest opacity-60">Signature CRM Follow-up System</p>
            </div>
          </div>
        </div>
      )}

      {isFollowUpModalOpen && followUpPromptData && (
        <FollowUpForm 
          leadId={followUpPromptData.leadId}
          visitId={followUpPromptData.visitId}
          projectId={followUpPromptData.projectId}
          clientName={followUpPromptData.clientName}
          user={user}
          initialMethod={preferredFollowUpMethod}
          onSave={(f) => {
            // Manual update removed
            api.save('followups', f);
            
            setIsFollowUpModalOpen(false);
            setFollowUpPromptData(null);
            setPreferredFollowUpMethod('call');
            toast.success('Next follow-up scheduled');
          }}
          onClose={() => {
            setIsFollowUpModalOpen(false);
            setFollowUpPromptData(null);
            setPreferredFollowUpMethod('call');
          }}
        />
      )}

      <PostCallWhatsAppModal 
        isOpen={isPostCallWhatsAppOpen}
        onClose={() => setIsPostCallWhatsAppOpen(false)}
        onSend={handlePostCallWhatsApp}
        clientName={postCallTarget && ('client_name' in postCallTarget ? postCallTarget.client_name : postCallTarget.name) || ''}
        outcome={postCallOutcome || 'answered'}
        templates={templates}
      />

      {isVisitCompletionModalOpen && completionVisit && user && (
        <VisitCompletionModal 
          isOpen={isVisitCompletionModalOpen}
          onClose={() => {
            setIsVisitCompletionModalOpen(false);
            setCompletionVisit(null);
            setCompletionLead(null);
          }}
          visit={completionVisit}
          lead={completionLead}
          user={user}
          onComplete={async (data) => {
            try {
              const { updatedLead, updatedVisit, activity } = syncEngine.handleVisitCompletion(
                completionLead!,
                completionVisit!,
                data.outcome,
                data.feedback,
                data.interest,
                user
              );

              const savePromise = (async () => {
                // 1. Update State & Save
                await api.save('leads', updatedLead);
                await api.save('visits', updatedVisit);
                await api.save('activities', activity);

                // 2. Handle Next Followup
                if ((data.nextStep === 'callback' || data.nextStep === 'negotiation') && data.nextDate) {
                  const f: FollowUp = {
                    id: generateId(),
                    leadId: updatedLead.id,
                    visitId: updatedVisit.id,
                    projectId: updatedVisit.projectId,
                    date: data.nextDate,
                    purpose: data.nextStep === 'negotiation' ? 'Negotiation Call' : 'Follow-up Call',
                    status: 'pending',
                    userId: user.id,
                    userName: user.name,
                    method: 'call',
                    created_at: new Date().toISOString()
                  };
                  // Manual update removed
                  await api.save('followups', f);
                }

                // 3. Handle Re-visit scheduling as next action
                if (data.nextStep === 'revisit' && data.nextDate) {
                  const revisit: Visit = {
                    id: generateId(),
                    leadId: updatedLead.id,
                    client_name: updatedVisit.client_name,
                    mobile: updatedVisit.mobile,
                    email: updatedVisit.email,
                    visit_date: data.nextDate,
                    visit_time: data.nextTime || '',
                    purpose: 'Re-visit (auto from visit completion)',
                    status: updatedLead.quality || 'warm',
                    visit_status: 'scheduled',
                    projectId: updatedVisit.projectId,
                    created_at: new Date().toISOString(),
                    assigned_to: user.name,
                    source: updatedVisit.source || 'Revisit',
                    budget: updatedVisit.budget,
                    property_interest: updatedVisit.property_interest,
                    priority: updatedVisit.priority || updatedLead.priority || 0
                  };
                  await api.save('visits', revisit);
                }

                if (data.nextStep === 'close_lead') {
                  await api.save('leads', {
                    ...updatedLead,
                    status: data.outcome === 'booked' ? 'closed' : 'lost',
                    updated_at: new Date().toISOString()
                  });
                }
              })();

              await toast.promise(savePromise, {
                loading: 'Syncing visit details...',
                success: 'Visit and Lead synchronized successfully!',
                error: 'Error during synchronization. Please check your network.'
              });

            } catch (error) {
              console.error('Sync Error:', error);
              toast.error('Failed to sync data');
            } finally {
              setIsVisitCompletionModalOpen(false);
              setCompletionVisit(null);
              setCompletionLead(null);
            }
          }}
        />
      )}
      </div>
    </ErrorBoundary>
  );
}
