import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 md:p-12 text-center selection:bg-clay selection:text-cream">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-red-500/5 to-transparent pointer-events-none" />
          
          <div className="max-w-4xl w-full bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 md:p-16 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-2xl">
              <AlertCircle className="text-red-500" size={40} />
            </div>

            <h2 className="text-3xl md:text-5xl font-heading font-black text-white tracking-tighter uppercase mb-6 leading-none">
              A Critical Component <br />
              <span className="text-red-500 italic serif font-thin">Crashed.</span>
            </h2>
            
            <p className="text-white/40 text-xs md:text-sm font-medium uppercase tracking-[0.3em] mb-12 max-w-lg mx-auto leading-relaxed">
              The application encountered a terminal exception in this sector. Diagnostic data has been logged to the console.
            </p>
            
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-left mb-12 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">System Diagnostics / V2.4B</span>
              </div>
              
              <pre className="text-[10px] md:text-[11px] text-red-400 font-mono whitespace-pre-wrap break-words opacity-80 mb-4 bg-red-500/5 p-4 rounded-lg border border-red-500/10">
                {this.state.error?.toString()}
              </pre>
              
              {this.state.errorInfo && (
                <div className="max-h-48 overflow-y-auto no-scrollbar border-t border-white/5 pt-4">
                  <pre className="text-[9px] text-white/20 font-mono whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => {
                  window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
                  window.location.reload();
                }}
                className="h-16 px-12 bg-white text-cream rounded-full text-xs font-black uppercase tracking-[0.3em] hover:bg-clay hover:scale-105 transition-all shadow-2xl group flex items-center gap-3"
              >
                Sync & Reload
              </button>
              <a 
                href="mailto:support@yureka.one"
                className="text-[10px] font-bold text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest border-b border-white/10 pb-1"
              >
                Report Node Failure
              </a>
            </div>
          </div>

          <div className="mt-12 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.5em] text-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500/40" /> Fail-Safe Protocol Active
            <span className="w-1.5 h-1.5 rounded-full bg-red-500/40" /> Node Isolation Ready
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
