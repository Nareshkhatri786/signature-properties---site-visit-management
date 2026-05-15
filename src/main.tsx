import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,        // 3 min — data stays fresh
      gcTime: 1000 * 60 * 30,           // 30 min — keep in memory
      retry: 2,                          // Retry failed requests twice
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,       // Don't refetch on tab switch
      refetchOnReconnect: true,          // Refetch when back online
      networkMode: 'offlineFirst',       // Allow cached data when offline
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
