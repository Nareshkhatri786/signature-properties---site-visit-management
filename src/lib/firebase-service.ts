import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { WhatsAppMessage } from '../types';

export const firebaseService = {
  // Generic CRUD
  getAll: async (colName: string): Promise<any[]> => {
    const querySnapshot = await getDocs(collection(db, colName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  getAllOnce: async (colName: string): Promise<any[]> => {
    const querySnapshot = await getDocs(collection(db, colName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  listen: (colName: string, callback: (data: any[]) => void, onError?: (err: any) => void, filters?: { projectId?: string, managedProjectIds?: string[] }) => {
    let q = query(collection(db, colName));
    
    if (filters?.projectId && colName !== 'users' && colName !== 'projects' && colName !== 'settings') {
       q = query(collection(db, colName), where('projectId', '==', filters.projectId));
    } else if (filters?.managedProjectIds && filters.managedProjectIds.length > 0 && colName !== 'users' && colName !== 'projects' && colName !== 'settings') {
       q = query(collection(db, colName), where('projectId', 'in', filters.managedProjectIds));
    }

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (error) => {
      console.error(`Error in snapshot listener for ${colName}:`, error);
      if (onError) onError(error);
    });
  },

  save: async (colName: string, id: string, data: any) => {
    try {
      const docRef = doc(db, colName, id);
      await setDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error(`Error saving to ${colName}/${id}:`, error);
      throw error;
    }
  },

  delete: async (colName: string, id: string) => {
    await deleteDoc(doc(db, colName, id));
  },

  // Specific helpers
  getRemarks: (targetId: string, callback: (remarks: any[]) => void, onError?: (err: any) => void) => {
    const q = collection(db, 'remarks', targetId, 'entries');
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error(`Error in remarks sync for ${targetId}:`, error);
      if (onError) onError(error);
    });
  },

  saveRemark: async (targetId: string, remark: any) => {
    const docRef = doc(collection(db, 'remarks', targetId, 'entries'), remark.id);
    await setDoc(docRef, { ...remark, at: new Date().toISOString() });
  },

  listenWebhooks: (callback: (data: any[]) => void) => {
    return onSnapshot(collection(db, 'webhook_configs'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  },

  listenToWhatsAppMessages: (targetId: string, callback: (msgs: WhatsAppMessage[]) => void) => {
    const q = query(
      collection(db, 'whatsapp_messages'),
      where('leadId', '==', targetId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhatsAppMessage)));
    }, (err) => {
      console.error("WhatsApp sync error:", err);
      // If index is missing, it will fail silently or log error
    });
  },

  logActivity: async (activity: any) => {
    try {
      const docRef = doc(collection(db, 'activities'), activity.id);
      await setDoc(docRef, {
        ...activity,
        timestamp: activity.timestamp || new Date().toISOString()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error("Error logging activity:", error);
      throw error;
    }
  }
};
