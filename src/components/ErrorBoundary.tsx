import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State & { error?: Error }> {
  public state: State & { error?: Error } = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State & { error?: Error } {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Auto-reload the page if a dynamically imported module fails to load (e.g. after a Vercel deployment)
    const msg = error.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Expected a JavaScript-or-Wasm module script')
    ) {
      if (sessionStorage.getItem('vite-chunk-reloaded') !== 'true') {
        sessionStorage.setItem('vite-chunk-reloaded', 'true');
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.error) {
         return (
           <div style={{ padding: 20, color: 'red', background: 'black', height: '100%', overflow: 'auto' }}>
             <h2>Crash!</h2>
             <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
           </div>
         );
      }
      return this.props.fallback;
    }

    return this.props.children;
  }
}
