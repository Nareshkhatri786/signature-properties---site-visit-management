import React, { useState, useEffect, useMemo } from 'react';
import { storage } from './lib/storage';
import { User, Visit, Remark, Template, Settings, Page, CallLog, CallOutcome, Lead, LeadQuality, WebhookConfig, FollowUp, Activity, ActivityType, Project, LeadStatus, VisitStatus, VisitFilters, FollowUpMethod, Workflow } from './types';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './components/Dashboard';
import LeadList from './components/LeadList';
import LeadDetail from './components/LeadDetail';
import LeadForm from './components/LeadForm';
import VisitList from './components/VisitList';
import VisitForm from './components/VisitForm';
import VisitDetail from './components/VisitDetail';
import FollowUpList from './components/FollowUpList';
import FollowUpForm from './components/FollowUpForm';
import WhatsAppSender from './components/WhatsAppSender';
import TemplateManager from './components/TemplateManager';
import SettingsPage from './components/Settings';
import Reports from './components/Reports';
import WebhookSettings from './components/WebhookSettings';
import HRMS from './components/HRMS';
import CallOutcomeModal from './components/CallOutcomeModal';
import PostCallWhatsAppModal from './components/PostCallWhatsAppModal';
import Login from './components/Login';
import WorkflowBuilder from './components/WorkflowBuilder';
import { Toaster, toast } from 'react-hot-toast';
import { CalendarCheck, Plus, Phone, MessageSquare } from 'lucide-react';
import { aiService } from './lib/ai';
import { generateId } from './lib/storage';
import { cn } from './lib/utils';
import { normalizePhoneNumber } from './lib/phoneUtils';

import { apiService } from './lib/api-service';
import { pushService, urlBase64ToUint8Array } from './lib/push-service';
import { motion } from 'motion/react';
import ErrorBoundary from './components/ErrorBoundary';

// REST API helpers — replaces Firebase service
const api = {
  fetchRemarks: (targetId: string) => apiService.getRemarks(targetId),
  save: async (collection: string, h1: any, h2?: any) => {
    const data = h2 || h1;
    if (collection === 'remarks' && data.targetId) {
      return apiService.saveRemark(data.targetId, data);
    }
    try {
      const res = await apiService.save(collection, data);
      
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
    } catch (e: any) {
      console.error(`Error saving ${collection}:`, e);
      toast.error(`Failed to save ${collection}: ${e.message}`);
      throw e;
    }
  },
  delete: (collection: string, id: string) => apiService.delete(collection, id),
};

export default function App() {
  const [user, setUser] = useState<User | null>(storage.getAuth());
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [remarks, setRemarks] = useState<Record<string, Remark[]>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfig[]>([]);
  const [settings, setSettings] = useState<Settings>({ 
    company: 'Signature Properties', 
    phone: '', 
    address: '',
    sources: [],
    budgets: [],
    propertyInterests: []
  });
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isPostCallWhatsAppOpen, setIsPostCallWhatsAppOpen] = useState(false);
  const [postCallOutcome, setPostCallOutcome] = useState<CallOutcome | null>(null);
  const [postCallTarget, setPostCallTarget] = useState<Lead | Visit | null>(null);
  const [activeCallVisit, setActiveCallVisit] = useState<Visit | null>(null);
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initStep, setInitStep] = useState<string>("Initializing...");
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [activeVisitFilters, setActiveVisitFilters] = useState<VisitFilters | null>(null);
  const [followUpPromptData, setFollowUpPromptData] = useState<{ leadId?: string, visitId?: string, projectId: string, clientName: string } | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [preferredFollowUpMethod, setPreferredFollowUpMethod] = useState<FollowUpMethod>('call');
  const [stats, setStats] = useState<any>(null);
  const lastSyncTime = React.useRef<string | null>(null);
  const isFetching = React.useRef(false);
  const repairRun = React.useRef(false);

  useEffect(() => {
    if (isInitialLoadDone && user && visits.length > 0 && leads.length > 0 && !repairRun.current) {
      const visitsWithoutLeads = visits.filter(v => !v.leadId);
      if (visitsWithoutLeads.length > 0) {
        repairRun.current = true;
        console.log(`Found ${visitsWithoutLeads.length} visits without leads. Repairing...`);
        
        visitsWithoutLeads.forEach(async (v) => {
          const normalizedMobile = normalizePhoneNumber(v.mobile);
          const newLead: Lead = {
            id: generateId(),
            name: v.client_name,
            mobile: normalizedMobile,
            email: v.email || '',
            source: v.source || 'Direct Site Visit',
            projectId: v.projectId,
            assignedTo: user.id || 0,
            assignedToName: user.name,
            quality: v.status || 'pending',
            status: (v.visit_status === 'completed' ? 'visit_done' : 'visit_scheduled') as LeadStatus,
            budget: v.budget || '',
            property_interest: v.property_interest || '',
            created_at: v.visit_date + 'T00:00:00Z',
            updated_at: new Date().toISOString(),
            stats: {
              calls_attempted: 0,
              calls_answered: 0,
              visits_planned: (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled') ? 1 : 0,
              visits_done: v.visit_status === 'completed' ? 1 : 0,
              followups_done: 0
            }
          };

          // Update visit with new leadId
          const updatedVisit = { ...v, leadId: newLead.id };
          
          await api.save('leads', newLead);
          await api.save('visits', updatedVisit);
          
          // Add auto-creation remark
          const autoRemark: Remark = {
            id: generateId(),
            text: `Manual repair: Auto lead create as site visit ${v.visit_status === 'completed' ? 'completed' : 'scheduled'}`,
            by: 'System Repair',
            at: new Date().toISOString()
          };
          await api.save('remarks', { ...autoRemark, targetId: newLead.id });

          setLeads(prev => [newLead, ...prev]);
          setVisits(prev => prev.map(vis => vis.id === v.id ? updatedVisit : vis));
        });
      }
    }
  }, [isInitialLoadDone, user, visits, leads]);

  const loadAllData = React.useCallback(async (force = false) => {
    const token = localStorage.getItem('crm_token');
    if (!token) return;
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      if (!lastSyncTime.current || force) {
        setInitStep('Fetching Global Data...');
        const [initData, fullData] = await Promise.all([
          apiService.getInit(),
          apiService.getData()
        ]);
        
        setProjects(initData.projects || []);
        setTemplates(initData.templates || []);
        setSettings(initData.settings || {});
        setWorkflows(initData.workflows || []);
        
        setLeads(fullData.leads || []);
        setVisits(fullData.visits || []);
        setFollowups(fullData.followups || []);
        setCallLogs(fullData.call_logs || []);
        setActivities(fullData.activities || []);
        setAttendance(fullData.attendance || []);
        setNotifications(fullData.notifications || []);
        setWebhookConfigs(fullData.webhook_configs || []);
        setUsers(fullData.users || []);
        
        lastSyncTime.current = new Date().toISOString();
        
        // Fetch stats separately
        apiService.getStats().then(setStats).catch(console.error);
      } else {
        const delta = await apiService.sync(lastSyncTime.current);
        
        if (delta.leads?.length > 0) {
          setLeads(prev => {
            const next = [...prev];
            delta.leads.forEach((l: Lead) => {
              const idx = next.findIndex(p => p.id === l.id);
              if (idx > -1) next[idx] = l;
              else next.unshift(l);
            });
            return next;
          });
        }
        
        if (delta.visits?.length > 0) {
          setVisits(prev => {
            const next = [...prev];
            delta.visits.forEach((v: Visit) => {
              const idx = next.findIndex(p => p.id === v.id);
              if (idx > -1) next[idx] = v;
              else next.unshift(v);
            });
            return next;
          });
        }

        if (delta.followups?.length > 0) {
          setFollowups(prev => {
            const next = [...prev];
            delta.followups.forEach((f: FollowUp) => {
              const idx = next.findIndex(p => p.id === f.id);
              if (idx > -1) next[idx] = f;
              else next.unshift(f);
            });
            return next;
          });
        }

        if (delta.notifications?.length > 0) {
          setNotifications(prev => [...delta.notifications, ...prev].slice(0, 50));
        }

        lastSyncTime.current = delta.serverTime;
        
        // Refresh stats on changes
        if (delta.leads?.length > 0) {
          apiService.getStats().then(setStats).catch(console.error);
        }
      }
      
      setIsInitialLoadDone(true);
    } catch (e: any) {
      console.error('[Sync] Failed:', e.message);
      if (e.message.includes('401')) handleLogout();
    } finally {
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    // Viewport height fix for iOS Safari
    const setHeight = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    setHeight();
    window.addEventListener('resize', setHeight);

    // Check JWT token in localStorage
    setInitStep('Verifying Authentication...');
    const token = localStorage.getItem('crm_token');
    const authData = storage.getAuth();

    if (token && authData) {
      setUser(authData as any);
      setInitStep('Loading Data...');
      loadAllData().finally(() => {
        setIsAuthReady(true);
        setIsInitialLoadDone(true);
      });
    } else {
      setIsAuthReady(true);
      setIsInitialLoadDone(true);
    }

    // Recursive polling (Faster for changes, lighter for server)
    let pollTimer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const t = localStorage.getItem('crm_token');
      if (t) await loadAllData();
      pollTimer = setTimeout(poll, 15000); // Poll every 15s for delta changes
    };
    
    pollTimer = setTimeout(poll, 15000);

    return () => {
      clearTimeout(pollTimer);
      window.removeEventListener('resize', setHeight);
    };
  }, [loadAllData]);

  // Handle Push Registration separately
  useEffect(() => {
    if (!isInitialLoadDone || !user) return;
    
    const registerPush = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const { publicKey } = await pushService.getPublicKey();
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
            await pushService.subscribeToPush(subscription);
          }
        } catch (error) { console.warn('Push registration failed:', error); }
      }
    };
    
    registerPush();
  }, [isInitialLoadDone, user?.id]);

  // Reload data when user changes
  useEffect(() => {
    if (user?.id && isInitialLoadDone) {
       // Only trigger a new fetch if the user object changed after the initial load
       loadAllData();
    }
  }, [user?.id]);

  // Fetch remarks when leads or visits change
  useEffect(() => {
     if (!leads.length && !visits.length) return;
     const allIds = [...leads.map(l => l.id), ...visits.map(v => v.id)];
     
     // REMOVED: Global remarks listener loop (Performance bottleneck on mobile)
    // Remarks are now handled on-demand in Detail components
    return () => {};
  }, [leads.length, visits.length]);

  const userRole = user?.role?.toLowerCase();
  const isAdminRole = userRole === 'admin' || userRole === 'adm';
  const isManagerRole = userRole === 'manager';
  const managedProjectIds = useMemo(() => user?.assignedProjectIds || (user?.projectId ? [user.projectId] : []), [user]);

  const filteredLeads = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return leads;
    if (isManagerRole) return leads.filter(l => managedProjectIds.includes(l.projectId));
    
    return leads.filter(l => {
      const isAssignedToMe = String(l.assignedTo) === String(user.id);
      const isMyProject = l.projectId === user.projectId || l.projectId === 'p1';
      return isAssignedToMe || (isMyProject && !l.assignedTo);
    });
  }, [leads, user, isAdminRole, isManagerRole, managedProjectIds]);

  const filteredVisits = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return visits;
    if (isManagerRole) return visits.filter(v => managedProjectIds.includes(v.projectId));
    
    return visits.filter(v => {
      const isAssignedToMe = String(v.assigned_to) === String(user.id);
      const isMyProject = v.projectId === user.projectId || v.projectId === 'p1';
      return isAssignedToMe || (isMyProject && !v.assigned_to);
    });
  }, [visits, user, isAdminRole, isManagerRole, managedProjectIds]);

  const filteredFollowups = useMemo(() => {
    if (!user) return [];
    if (isAdminRole) return followups;
    if (isManagerRole) return followups.filter(f => managedProjectIds.includes(f.projectId));
    
    // Optimize: include follow-ups for leads user owns OR visits user owns
    const ownedLeadIds = new Set(filteredLeads.map(l => l.id));
    const ownedVisitIds = new Set(filteredVisits.map(v => v.id));
    
    return followups.filter(f => {
      const basicProjectMatch = (f.projectId === user.projectId || f.projectId === 'p1');
      if (!basicProjectMatch) return false;
      
      const leadMatch = !f.leadId || ownedLeadIds.has(f.leadId);
      const visitMatch = !f.visitId || ownedVisitIds.has(f.visitId);
      
      // If a follow-up has leadId, it must belong to an owned lead.
      // If it only has visitId, it must belong to an owned visit.
      return leadMatch || visitMatch;
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

  if (!isAuthReady || !isInitialLoadDone) {
    return (
      <div className="min-h-[100dvh] bg-[#1C1207] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          {initError ? (
            <>
              <div className="text-red-500 mb-2">⚠️</div>
              <p className="text-red-400 font-['Jost'] text-md font-medium">{initError}</p>
              <div className="flex gap-4 mt-6">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-[#C9A84C] text-[#1C1207] rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#D4BC7D] transition-colors"
                >
                  Retry
                </button>
                <button 
                  onClick={() => {
                    toast.loading('Checking backend health...', { id: 'health-check' });
                    fetch('/api/config-test')
                      .then(async r => {
                        if (!r.ok) {
                          const text = await r.text();
                          if (text.includes('<!doctype')) {
                             throw new Error("Server returned HTML Error Page");
                          }
                          throw new Error(`HTTP ${r.status}`);
                        }
                        return r.json();
                      })
                      .then(d => {
                        if (d.firestoreCode === 5 || (d.firestoreError && d.firestoreError.includes('NOT_FOUND'))) {
                          toast.error("Critical: Firestore Database Not Found.", { id: 'health-check', duration: 10000 });
                          console.error("Troubleshooting:", d.troubleshooting);
                        } else if (d.firestoreCode === 7 || (d.firestoreError && d.firestoreError.includes('PERMISSION_DENIED'))) {
                          toast.error("Permission Denied (IAM Error)", { id: 'health-check', duration: 10000 });
                          alert(`PERMISSION ERROR\n\nApp Identity: ${d.identity}\n\nYou MUST grant 'Cloud Datastore User' role to this email in your Google Cloud IAM console for project ${d.projectId}.`);
                        } else {
                          const state = d.firestoreConnection === 'ok' ? 'Online' : 'Database Error';
                          const dbId = d.activeDatabaseId || d.databaseId || '(default)';
                          toast.success(`Server: ${state} | Project: ${d.projectId} | DB: ${dbId}`, { 
                            id: 'health-check',
                            duration: 5000 
                          });
                        }
                        console.log("Diagnostic Data:", d);
                      })
                      .catch(e => {
                        toast.error(`Server Unreachable: ${e.message}`, { id: 'health-check' });
                        console.error("Diagnostic Fetch Failed:", e);
                      });
                  }}
                  className="px-6 py-2 border border-[#C9A84C] text-[#C9A84C] rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#C9A84C]/10 transition-colors"
                >
                  Check Server
                </button>
              </div>
            </>
          ) : (
            <>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin"
              />
              <p className="text-[#C9A84C] font-['Jost'] tracking-[0.2em] uppercase text-xs font-semibold animate-pulse mt-4">
                {initStep}
              </p>
            </>
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
    setFollowups(newFollowups);
    const updatedFup = newFollowups.find(f => f.id === id);
    if (updatedFup) api.save('followups', updatedFup);

    // Increment followups_done stats if completed
    if (updates.status === 'completed' && fup.status !== 'completed') {
       const lead = leads.find(l => l.id === fup.leadId);
       if (lead) {
         const newStats = {
           ...lead.stats,
           followups_done: (lead.stats.followups_done || 0) + 1
         };
         const updatedLead = { ...lead, stats: newStats, updated_at: new Date().toISOString() };
         setLeads(leads.map(l => l.id === lead.id ? updatedLead : l));
         api.save('leads', updatedLead);
       }
    }

    // Activity Logging
    const lead = leads.find(l => l.id === fup.leadId);
    const visit = visits.find(v => v.id === fup.visitId);
    const clientName = lead?.name || visit?.client_name || 'Client';
    const targetId = fup.leadId || (fup.visitId || '');

    if (updates.status === 'completed' && fup.status !== 'completed') {
      logActivity('followup_done', targetId, clientName, `Outcome: ${updates.outcome_note || 'Completed'}`);
      
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
        clientName
      });
    } else if (updates.date && updates.date !== fup.date) {
      logActivity('followup_rescheduled', targetId, clientName, `New Date: ${updates.date}`);
      toast.success('Follow-up rescheduled');
    } else if (updates.status === 'cancelled' && fup.status !== 'cancelled') {
      logActivity('followup_cancelled', targetId, clientName, updates.outcome_note ? `Reason: ${updates.outcome_note}` : '');
      toast.success('Follow-up cancelled');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('crm_token');
    storage.saveAuth(null);
    toast.success('Logged out successfully');
  };

  const navigate = (page: Page, id?: string, filters?: VisitFilters) => {
    setCurrentPage(page);
    if (id) setSelectedVisitId(id);
    if (filters) setActiveVisitFilters(filters);
    else setActiveVisitFilters(null);
    if (page !== 'whatsapp') setGeneratedMessage(null);
    setIsSidebarOpen(false);
    window.scrollTo(0, 0);
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
    setActivities(newActivities);
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
    
    // Don't open modal if we're already on a detail page that has inline logging
    if (currentPage === 'detail' || currentPage === 'lead-detail') {
      return;
    }

    if ('visit_date' in v) {
      setActiveCallVisit(v as Visit);
      setActiveCallLead(leads.find(l => l.id === (v as Visit).leadId) || null);
    } else {
      setActiveCallLead(v as Lead);
      setActiveCallVisit(null);
    }
    setTimeout(() => {
      setIsCallModalOpen(true);
    }, 1500);
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

  const recordCallOutcome = (v: Visit | Lead, outcome: CallOutcome, note?: string) => {
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
    setCallLogs(newLogs);
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
        stats: {
          ...lead.stats,
          calls_attempted: lead.stats.calls_attempted + 1,
          calls_answered: outcome === 'answered' ? lead.stats.calls_answered + 1 : lead.stats.calls_answered
        },
        updated_at: new Date().toISOString()
      };

      const newLeads = leads.map(l => l.id === lead.id ? updatedLead : l);
      setLeads(newLeads);
      api.save('leads', updatedLead);

      if (shouldMoveToCold) {
        toast.error('Lead moved to Cold due to 3 consecutive Switched Off calls');
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
    
    setLeads(leads.filter(l => !ids.includes(l.id)));
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
    
    setLeads(newLeads);
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
        setFollowups(prev => [takeoverFup, ...prev]);
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

    setLeads(newLeads);
    setVisits(newVisits);
    setFollowups(newFollowups);
    setCallLogs(newCallLogs);
    setActivities(newActivities);

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
      .replace(/{property_interest}/g, lead.property_interest || '');

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
    setRemarks(prev => ({ ...prev, [lead.id]: [remark, ...(prev[lead.id] || [])] }));
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
      setLeads(leads.map(l => l.id === leadId ? updatedLead : l));
      api.save('leads', updatedLead);
      
      const remark: Remark = {
        id: generateId(),
        text: `AI Lead Scoring: Updated quality to ${newQuality.toUpperCase()} based on conversation analysis.`,
        by: "Gemini AI",
        at: new Date().toISOString()
      };
      setRemarks(prev => ({ ...prev, [leadId]: [remark, ...(prev[leadId] || [])] }));
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

    setLeads(updatedLeads);
    toast.success(`Successfully analyzed ${successCount} leads`, { id: 'bulk-ai' });
  };

  const handleCallOutcome = (outcome: CallOutcome, note?: string) => {
    const target = activeCallVisit || activeCallLead;
    if (target) {
      recordCallOutcome(target, outcome, note);
    }
    setIsCallModalOpen(false);
    setActiveCallVisit(null);
    setActiveCallLead(null);
  };

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
        />
        
        <main className="p-4 lg:p-8 flex-1">
          {currentPage === 'dashboard' && (
            <Dashboard 
              visits={filteredVisits} 
              leads={filteredLeads}
              followUps={filteredFollowups}
              user={user}
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
              onNavigate={navigate} 
              onAddLead={() => setIsLeadFormOpen(true)}
              onCall={handleCall}
              onWhatsApp={handleWhatsApp}
              onBulkScore={handleBulkAIScore}
               onUpdateStatus={(id, status) => {
                const lead = leads.find(l => l.id === id);
                if (lead && lead.status !== status) {
                  const initialUpdate = { ...lead, status, updated_at: new Date().toISOString() };
                  
                  // Run workflow engine on the updated status
                  const processedLead = runWorkflowEngine('status_changed', initialUpdate);
                  
                  setLeads(leads.map(l => l.id === id ? processedLead : l));
                  apiService.save('leads', processedLead);
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
                setLeads(leads.map(lead => lead.id === l.id ? l : lead));
                api.save('leads', l);
              }}
              onAddVisit={(l) => navigate('add-visit', l.id)}
              onAddFollowUp={(f) => {
                setFollowups([f, ...followups]);
                api.save('followups', f);
                toast.success('Follow-up scheduled');
              }}
              onUpdateFollowUp={handleUpdateFollowUp}
              onAddRemark={(r) => {
                setRemarks(prev => ({ ...prev, [selectedVisitId]: [r, ...(prev[selectedVisitId] || [])] }));
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
                setVisits(visits.filter(v => v.id !== id));
                api.delete('visits', id);
                toast.success('Visit deleted');
              }}
              onUpdateVisit={(v) => {
                const oldVisit = visits.find(vis => vis.id === v.id);
                setVisits(visits.map(vis => vis.id === v.id ? v : vis));
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
                      setLeads(leads.map(l => l.id === lead.id ? updatedLead : l));
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
                if (!targetLeadId) {
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
                    created_at: v.visit_date + 'T00:00:00Z',
                    updated_at: new Date().toISOString(),
                    stats: {
                      calls_attempted: 0,
                      calls_answered: 0,
                      visits_planned: (v.visit_status === 'scheduled' || v.visit_status === 'rescheduled') ? 1 : 0,
                      visits_done: v.visit_status === 'completed' ? 1 : 0,
                      followups_done: 0
                    }
                  };
                  
                  await api.save('leads', newLead);
                  setLeads(prev => [newLead, ...prev]);
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
                  setRemarks(prev => ({ ...prev, [newLead.id]: [autoRemark] }));
                }

                await api.save('visits', v);
                setVisits(prev => {
                  const exists = prev.some(vis => vis.id === v.id);
                  return exists ? prev : [v, ...prev];
                });
                
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
                    setLeads(leads.map(l => l.id === targetLeadId ? updatedLead : l));
                    api.save('leads', updatedLead);
                  }
                }

                logActivity('visit_scheduled', v.id, v.client_name, `Date: ${v.visit_date}`);

                if (r) {
                  setRemarks(prev => ({ ...prev, [v.id]: [r] }));
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
                await api.save('visits', newVis);
                setVisits(prev => [newVis, ...prev]);
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
                    setLeads(leads.map(l => l.id === newVis.leadId ? updatedLead : l));
                    api.save('leads', updatedLead);
                  }
                }
              }}
              onUpdateVisit={(v) => {
                const oldVisit = visits.find(vis => vis.id === v.id);
                setVisits(visits.map(vis => vis.id === v.id ? v : vis));
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
                      updatedLead.status = 'visit_done';
                      updatedLead.stats.visits_done += 1;
                      leadChanged = true;
                      logActivity('visit_completed', v.id, v.client_name);
                    } else if (oldStatus === 'completed' && newStatus !== 'completed') {
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
                      setLeads(leads.map(l => l.id === lead.id ? updatedLead : l));
                      api.save('leads', updatedLead);
                    }
                  }
                }
              }}
              onUpdateLead={(updatedLead) => {
                setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
                api.save('leads', updatedLead);
                logActivity('lead_updated', updatedLead.id, updatedLead.name, 'Updated details');
              }}
              onAddRemark={(r) => {
                setRemarks(prev => ({ ...prev, [selectedVisitId]: [r, ...(prev[selectedVisitId] || [])] }));
                api.save('remarks', { ...r, targetId: selectedVisitId });
              }}
              onAddFollowUp={(f) => {
                setFollowups([f, ...followups]);
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
                  setRemarks(prev => ({ ...prev, [selectedVisitId]: [remark, ...(prev[selectedVisitId] || [])] }));
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
            />
          )}
          {currentPage === 'followups' && (
            <FollowUpList 
              followUps={filteredFollowups}
              leads={leads}
              visits={visits}
              user={user}
              onUpdateStatus={(id, status, note) => {
                handleUpdateFollowUp(id, {
                  status,
                  outcome_note: note,
                  completed_at: status === 'completed' ? new Date().toISOString() : undefined
                });
              }}
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
                setWebhookConfigs(exists 
                  ? webhookConfigs.map(conf => conf.id === c.id ? c : conf)
                  : [...webhookConfigs, c]
                );
                api.save('webhook_configs', c);
                toast.success(exists ? 'Webhook updated' : 'Webhook created');
              }}
              onDelete={(id) => {
                setWebhookConfigs(webhookConfigs.filter(c => c.id !== id));
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
                setTemplates(exists 
                  ? templates.map(temp => temp.id === t.id ? t : temp)
                  : [...templates, t]
                );
                api.save('templates', t);
                toast.success(exists ? 'Template updated' : 'Template created');
              }}
              onDelete={(id) => {
                setTemplates(templates.filter(t => t.id !== id));
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
                setSettings(s);
                api.save('settings', s);
                toast.success('Settings saved');
              }}
              onAddUser={(nu) => {
                setUsers(prev => {
                  const exists = prev.find(u => u.id === nu.id);
                  if (exists) {
                    return prev.map(u => u.id === nu.id ? nu : u);
                  }
                  return [...prev, nu];
                });
                
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
                setUsers(prev => prev.filter(u => u.id !== id));
                api.delete('users', id.toString());
                toast.success('User removed');
              }}
              onAddProject={(np) => {
                setProjects(prev => {
                  const exists = prev.find(p => p.id === np.id);
                  if (exists) {
                    return prev.map(p => p.id === np.id ? np : p);
                  }
                  return [...prev, np];
                });
                toast.promise(api.save('projects', np.id, np), {
                  loading: 'Saving project...',
                  success: 'Project saved to database',
                  error: (err) => `Failed to save project: ${err.message}`
                });
              }}
              onRemoveProject={(id) => {
                setProjects(prev => prev.filter(p => p.id !== id));
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
                setWorkflows(exists ? workflows.map(w => w.id === wf.id ? wf : w) : [wf, ...workflows]);
                api.save('workflows', wf);
                toast.success(exists ? 'Workflow updated' : 'Workflow created');
              }}
              onDelete={(id) => {
                setWorkflows(workflows.filter(w => w.id !== id));
                api.delete('workflows', id);
                toast.success('Workflow deleted');
              }}
            />
          )}
        </main>
      </div>
      
      <Toaster position="bottom-right" />

      {isLeadFormOpen && user && (
        <LeadForm 
          onSave={async (l) => {
            if (!l.projectId && user?.projectId) l.projectId = user.projectId;
            
            // Run workflow engine BEFORE saving to avoid race conditions
            const processedLead = runWorkflowEngine('lead_created', l);
            
            setLeads([processedLead, ...leads]);
            toast.promise(api.save('leads', processedLead), {
              loading: 'Saving lead...',
              success: 'Lead saved to database',
              error: (err) => `Failed to save: ${err.message}`
            });
            logActivity('lead_created', processedLead.id, processedLead.name, `Source: ${processedLead.source}`);
            setIsLeadFormOpen(false);
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6D8B8] rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-[#FDF8E6] text-[#C9A84C] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#F2ECD8]">
                <CalendarCheck size={32} />
              </div>
              <h3 className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#2A1C00] mb-2">Schedule Next Step?</h3>
              <p className="text-sm text-[#9A8262] mb-6 leading-relaxed">
                The follow-up for <span className="font-bold text-[#5C4820]">{followUpPromptData.clientName}</span> is complete. 
                Would you like to schedule the next follow-up now?
              </p>

              <div className="space-y-3 mb-8">
                <label className="text-[10.5px] font-bold text-[#9A8262] uppercase tracking-wider block text-left mb-1">Follow-up Method</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'call', label: 'Call', icon: Phone },
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPreferredFollowUpMethod(m.id as FollowUpMethod)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2.5 border rounded-xl transition-all",
                        preferredFollowUpMethod === m.id 
                          ? "bg-[#C9A84C] border-[#C9A84C] text-white shadow-md shadow-[#C9A84C]/20" 
                          : "bg-white border-[#E6D8B8] text-[#9A8262] hover:border-[#C9A84C]/50"
                      )}
                    >
                      <m.icon size={16} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="w-full bg-[#C9A84C] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#C9A84C]/20 hover:bg-[#B59640] transition-all transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Schedule Next Follow-up
                </button>
                <button 
                  onClick={() => {
                    setFollowUpPromptData(null);
                    setPreferredFollowUpMethod('call');
                  }}
                  className="w-full bg-white border border-[#E6D8B8] text-[#9A8262] font-semibold py-3 rounded-xl hover:bg-[#FDFAF2] transition-colors"
                >
                  Not now, maybe later
                </button>
              </div>
            </div>
            <div className="bg-[#FAF9F6] px-8 py-4 border-t border-[#F2ECD8] flex justify-center">
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
            setFollowups([f, ...followups]);
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
      </div>
    </ErrorBoundary>
  );
}
