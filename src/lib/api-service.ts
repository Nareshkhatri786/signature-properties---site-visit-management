// REST API Service — replaces firebase-service.ts
// All data goes through /api/* endpoints with JWT auth

const getToken = () => localStorage.getItem("crm_token") || "";
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, headers: { ...headers(), ...(options?.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const apiService = {
  // -- AUTH ------------------------------------------------
  login: async (username: string, password: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Login failed"); }
    return res.json() as Promise<{ token: string; user: any }>;
  },

  changePassword: (userId: number, currentPassword: string, newPassword: string) =>
    apiFetch("/api/change-password", { method: "POST", body: JSON.stringify({ userId, currentPassword, newPassword }) }),

  // -- DATA ------------------------------------------------
  getData: (): Promise<any> => apiFetch("/api/data"),

  // -- SAVE (upsert) ---------------------------------------
  save: (collection: string, data: any): Promise<any> =>
    apiFetch("/api/save", { method: "POST", body: JSON.stringify({ collection, data }) }),

  // -- DELETE ----------------------------------------------
  delete: (collection: string, id: string): Promise<any> =>
    apiFetch("/api/delete", { method: "POST", body: JSON.stringify({ collection, id }) }),

  // -- REMARKS ---------------------------------------------
  getRemarks: (targetId: string): Promise<any[]> => apiFetch(`/api/remarks/${targetId}`),

  saveRemark: (targetId: string, remark: any): Promise<any> =>
    apiFetch("/api/remarks", { method: "POST", body: JSON.stringify({ targetId, remark }) }),

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

// Polling helper — replaces Firestore onSnapshot
export function createPoller(intervalMs: number, fn: () => Promise<void>): () => void {
  let timer: ReturnType<typeof setInterval>;
  fn(); // immediate call
  timer = setInterval(fn, intervalMs);
  return () => clearInterval(timer);
}

export default apiService;
