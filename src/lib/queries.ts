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
    onSuccess: (res, variables) => {
      // Optimistically invalidate/refetch relevant data
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save data');
    }
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
