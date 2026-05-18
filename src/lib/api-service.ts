import { storage } from './storage';

async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('crm_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('crm_token');
      window.location.reload();
    }
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `Error ${response.status}`);
  }
  return response.json();
}

export const apiService = {
  login: (username: string, password: string): Promise<any> =>
    apiFetch("/api/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  getData: (): Promise<any> => apiFetch("/api/data"),
  getInit: (): Promise<any> => apiFetch("/api/init"),
  sync: (since?: string): Promise<any> => apiFetch(`/api/sync?since=${since || ''}`),
  getStats: (): Promise<any> => apiFetch("/api/stats"),
  getLeads: (page = 1, limit = 50, search = ""): Promise<any> => 
    apiFetch(`/api/leads?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

  save: (collection: string, data: any): Promise<any> => {
    // Sanitize foreign keys to avoid "null"/"undefined" string issues
    const sanitized = { ...data };
    ['leadId', 'visitId', 'projectId', 'userId', 'targetId'].forEach(key => {
      if (sanitized[key] === "null" || sanitized[key] === "undefined") {
        sanitized[key] = null;
      }
    });
    return apiFetch("/api/save", { method: "POST", body: JSON.stringify({ collection, data: sanitized }) });
  },

  delete: (collection: string, id: string): Promise<any> =>
    apiFetch("/api/delete", { method: "POST", body: JSON.stringify({ collection, id }) }),

  // -- DETAILS FETCHING ------------------------------------
  getRemarks: (targetId: string): Promise<any> =>
    apiFetch(`/api/remarks/${targetId}`),

  getActivities: (targetId: string): Promise<any> =>
    apiFetch(`/api/activities/${targetId}`),

  getWhatsAppMessages: (targetId: string): Promise<any> =>
    apiFetch(`/api/whatsapp/${targetId}`),
  sendWhatsAppMessage: (payload: {
    leadId?: string;
    visitId?: string;
    to?: string;
    type: "text" | "image" | "video" | "document";
    text?: string;
    mediaUrl?: string;
    caption?: string;
    fileName?: string;
    fromPhoneId?: string;
    projectId?: string;
  }): Promise<any> =>
    apiFetch("/api/whatsapp/send", { method: "POST", body: JSON.stringify(payload) }),
  sendOpenWindowGreeting: (payload: { leadId?: string; visitId?: string; to?: string; fromPhoneId?: string }): Promise<any> =>
    apiFetch("/api/whatsapp/send-open-window-greeting", { method: "POST", body: JSON.stringify(payload) }),

  saveRemark: (targetId: string, data: any): Promise<any> =>
    apiFetch("/api/remarks", { method: "POST", body: JSON.stringify({ targetId, remark: data }) }),

  // -- NOTIFICATIONS ---------------------------------------
  markNotifRead: (id: string): Promise<any> =>
    apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ id }) }),

  // -- REPORTS ---------------------------------------------
  getReportStatus: (): Promise<any> => apiFetch("/api/reports/status"),

  triggerReport: (type: "daily" | "weekend"): Promise<any> =>
    apiFetch("/api/reports/trigger", { method: "POST", body: JSON.stringify({ type }) }),

  getComplianceReport: (range: "today" | "week" = "today"): Promise<any> =>
    apiFetch(`/api/reports/compliance?range=${range}`),

  getFunnelReport: (range: "today" | "week" | "month" = "month"): Promise<any> =>
    apiFetch(`/api/reports/funnel?range=${range}`),

  getSlaStatus: (range: "today" | "week" = "today", notify = false): Promise<any> =>
    apiFetch(`/api/sla/status?range=${range}&notify=${notify ? 1 : 0}`),

  getPriorityQueue: (limit = 20): Promise<any> =>
    apiFetch(`/api/sales/priority-queue?limit=${limit}`),

  runComplianceBulkFix: (mode: "missed_followups" | "missed_visit_outcomes", limit = 100): Promise<any> =>
    apiFetch("/api/compliance/bulk-fix", { method: "POST", body: JSON.stringify({ mode, limit }) }),

  // -- HEALTH ----------------------------------------------
  health: (): Promise<any> => apiFetch("/api/health"),
};

// Polling helper - replaces Firestore onSnapshot
export function createPoller(intervalMs: number, fn: () => Promise<void>): () => void {
  let timer: ReturnType<typeof setInterval>;
  fn(); // immediate call
  timer = setInterval(fn, intervalMs);
  return () => clearInterval(timer);
}

export default apiService;
