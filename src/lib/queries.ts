import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from './api-service';
import { Lead, Visit, FollowUp, Activity, User, Project, Settings, Template, Workflow, CallLog, AttendanceEntry, WebhookConfig } from '../types';
import { toast } from 'react-hot-toast';

export const queryKeys = {
  all: ['appData'] as const,
  init: ['initData'] as const,
  stats: ['stats'] as const,
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
        if (!old) return old;
        const { collection, data } = newRecord;
        
        // Deep copy of the state
        const newState = JSON.parse(JSON.stringify(old));
        const fullData = newState.fullData;
        const initData = newState.initData;

        // Find and update in the correct collection
        const updateInArray = (arr: any[]) => {
          const index = arr.findIndex((item: any) => item.id === data.id);
          if (index > -1) {
            arr[index] = { ...arr[index], ...data };
          } else {
            arr.unshift(data);
          }
        };

        if (fullData[collection]) updateInArray(fullData[collection]);
        else if (initData[collection]) updateInArray(initData[collection]);

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
