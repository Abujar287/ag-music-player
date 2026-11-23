import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#0B0B0D] text-[#F5F3EE] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-[#D4AF37]">AG</span>
          </div>
          <h2 className="text-xl font-bold mb-2">AG Music Player Notice</h2>
          <p className="text-sm text-[#9E9A90] max-w-md mb-6">
            {this.state.error?.message || "An unexpected error occurred while loading the application."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-[#D4AF37] text-[#0B0B0D] font-semibold shadow-lg active:scale-95 transition-transform"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
