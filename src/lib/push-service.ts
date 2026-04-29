// Service for handling Web Push Notifications

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

export const pushService = {
  subscribeToPush: async (subscription: any) => {
    return apiFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    });
  },

  sendPushNotification: async (userIds: string[], title: string, body: string, url?: string) => {
    return apiFetch("/api/push/send", {
      method: "POST",
      body: JSON.stringify({ userIds, title, body, url }),
    });
  },

  getPublicKey: async () => {
    return apiFetch("/api/push/public-key");
  }
};

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
