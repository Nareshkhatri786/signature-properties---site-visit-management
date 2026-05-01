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

  save: (collection: string, data: any): Promise<any> =>
    apiFetch("/api/save", { method: "POST", body: JSON.stringify({ collection, data }) }),

  delete: (collection: string, id: string): Promise<any> =>
    apiFetch("/api/delete", { method: "POST", body: JSON.stringify({ collection, id }) }),

  // -- DETAILS FETCHING ------------------------------------
  getRemarks: (targetId: string): Promise<any> =>
    apiFetch(`/api/remarks/${targetId}`),

  getActivities: (targetId: string): Promise<any> =>
    apiFetch(`/api/activities/${targetId}`),

  getWhatsAppMessages: (targetId: string): Promise<any> =>
    apiFetch(`/api/whatsapp/${targetId}`),

  saveRemark: (targetId: string, data: any): Promise<any> =>
    apiFetch("/api/remarks", { method: "POST", body: JSON.stringify({ targetId, remark: data }) }),

  // -- NOTIFICATIONS ---------------------------------------
  markNotifRead: (id: string): Promise<any> =>
    apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ id }) }),

  // -- REPORTS ---------------------------------------------
  getReportStatus: (): Promise<any> => apiFetch("/api/reports/status"),

  triggerReport: (type: "daily" | "weekend"): Promise<any> =>
    apiFetch("/api/reports/trigger", { method: "POST", body: JSON.stringify({ type }) }),

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
