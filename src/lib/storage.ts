export const storage = {
  // Auth is local for session persistence across refreshes
  getAuth: (): any | null => {
    try {
      const data = localStorage.getItem('sf_auth');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn("localStorage access denied:", e);
      return null;
    }
  },
  saveAuth: (auth: any | null) => {
    try {
      if (auth) {
        localStorage.setItem('sf_auth', JSON.stringify(auth));
      } else {
        localStorage.removeItem('sf_auth');
      }
    } catch (e) {
      console.warn("localStorage write failed:", e);
    }
  },
  
  // Legacy method placeholders to prevent breakages if called
  saveData: async (data: any) => {
    console.log("storage.saveData is deprecated. Use direct API calls.");
  },
  fetchData: async () => {
    console.log("storage.fetchData is deprecated. Use direct API calls.");
    return {};
  }
};

export const generateId = () => Date.now() + Math.random().toString(36).slice(2, 7);
