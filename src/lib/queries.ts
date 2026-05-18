import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from './api-service';
import { Lead, Visit, FollowUp, Activity, User, Project, Settings, Template, Workflow, CallLog, AttendanceEntry, WebhookConfig } from '../types';
import { toast } from 'react-hot-toast';

export const queryKeys = {
  all: ['appData'] as const,
  init: ['initData'] as const,
  stats: ['stats'] as const,
  compliance: ['compliance'] as const,
  funnel: ['funnel'] as const,
  sla: ['sla'] as const,
  priorityQueue: ['priorityQueue'] as const,
  leads: ['leads'] as const,
  visits: ['visits'] as const,
};

/**
 * Hook to fetch all initial and bulk data.
 */
export function useAppData() {
  return useQuery({
    queryKey: queryKeys.all,
    queryFn: async () => {
      const [initData, fullData] = await Promise.all([
        apiService.getInit(),
        apiService.getData()
      ]);
      return { initData, fullData };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!localStorage.getItem('crm_token'),
  });
}

/**
 * Hook to fetch stats.
 */
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => apiService.getStats(),
    refetchInterval: 1000 * 60 * 2, // Every 2 mins
    enabled: !!localStorage.getItem('crm_token'),
  });
}

export function useComplianceReport(range: 'today' | 'week' = 'today', enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.compliance, range],
    queryFn: () => apiService.getComplianceReport(range),
    refetchInterval: 1000 * 60 * 3,
    enabled: !!localStorage.getItem('crm_token') && enabled,
  });
}

export function useFunnelReport(range: 'today' | 'week' | 'month' = 'month', enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.funnel, range],
    queryFn: () => apiService.getFunnelReport(range),
    refetchInterval: 1000 * 60 * 5,
    enabled: !!localStorage.getItem('crm_token') && enabled,
  });
}

export function useSlaStatus(range: 'today' | 'week' = 'today', enabled = true, notify = false) {
  return useQuery({
    queryKey: [...queryKeys.sla, range],
    queryFn: () => apiService.getSlaStatus(range, notify),
    refetchInterval: 1000 * 60 * 2,
    enabled: !!localStorage.getItem('crm_token') && enabled,
  });
}

export function usePriorityQueue(limit = 20, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.priorityQueue, limit],
    queryFn: () => apiService.getPriorityQueue(limit),
    refetchInterval: 1000 * 60 * 3,
    enabled: !!localStorage.getItem('crm_token') && enabled,
  });
}

/**
 * Hook to save any collection data.
 */
export function useSaveData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collection, data }: { collection: string, data: any }) => 
      apiService.save(collection, data),
    
    // Optimistic Update logic
    onMutate: async (newRecord) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.all });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKeys.all);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKeys.all, (old: any) => {
        if (!old || !newRecord.data) return old;
        const { collection, data } = newRecord;
        
        // Deep copy of the state
        const newState = JSON.parse(JSON.stringify(old));
        const fullData = newState.fullData;
        const initData = newState.initData;

        const target = fullData[collection] ? fullData : (initData[collection] ? initData : null);
        if (!target) return newState;

        const collectionData = target[collection];

        // Handle Array collections (Leads, Visits, etc.)
        if (Array.isArray(collectionData)) {
          const index = collectionData.findIndex((item: any) => item.id === data.id);
          if (index > -1) {
            collectionData[index] = { ...collectionData[index], ...data };
          } else {
            collectionData.unshift(data);
          }
        } 
        // Handle Object collections (Remarks)
        else if (typeof collectionData === 'object' && collectionData !== null) {
          // Remarks are usually nested by targetId, but in 'api.save' we pass the remark itself
          // We don't optimistically update remarks for now as the structure is complex
          // but we prevent it from crashing.
        }

        return newState;
      });

      // Return a context object with the snapshotted value
      return { previousData };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(queryKeys.all, context?.previousData);
      toast.error(err.message || 'Failed to sync with server');
    },

    // Always refetch after error or success to ensure we are in sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

/**
 * Hook for deletion.
 */
export function useDeleteData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collection, id }: { collection: string, id: string }) => 
      apiService.delete(collection, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete');
    }
  });
}
