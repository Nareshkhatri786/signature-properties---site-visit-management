import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 bg-[#FFFDF6] text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 className="text-xl font-['Cormorant_Garamond'] font-bold text-[#2A1C00] mb-2">Something went wrong</h2>
          <p className="text-sm text-[#9A8262] mb-6 max-w-sm font-['Jost']">
            We encountered a critical error on your device. This might be due to an incompatible browser setting or cache issue.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => window.location.reload()}
              className="bg-[#C9A84C] text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg"
            >
              Refresh App
            </button>
            <button
              onClick={() => {
                  localStorage.clear();
                  window.location.reload();
              }}
              className="bg-white border border-[#E6D8B8] text-[#9A8262] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest"
            >
              Clear Storage & Restart
            </button>
          </div>
          {this.state.error && (
            <div className="mt-8 p-4 bg-[#F2ECD8]/30 text-[10px] text-left overflow-auto max-w-full rounded-lg text-[#5C4820] font-mono border border-[#E6D8B8]/50">
                {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
