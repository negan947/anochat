"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error("Error caught by boundary:", error);
      console.error("Error info:", errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleBurnNotice = () => {
    if (typeof window !== 'undefined') {
      // Clear all local storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear IndexedDB (simplified)
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('AnoChat');
      }
      
      // Reload the page
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-anon-900 flex items-center justify-center p-4">
          <Card className="max-w-md w-full" variant="elevated">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 mb-4 text-red-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-full h-full">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <CardTitle className="text-red-400">Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Your anonymity is preserved.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-anon-950 border border-anon-700 rounded-lg p-3">
                  <div className="text-xs font-mono text-red-300 break-all">
                    <div className="font-semibold mb-2">Error:</div>
                    <div className="mb-2">{this.state.error.message}</div>
                    {this.state.error.stack && (
                      <>
                        <div className="font-semibold mb-1">Stack:</div>
                        <pre className="whitespace-pre-wrap text-2xs">
                          {this.state.error.stack}
                        </pre>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Button 
                    variant="anon" 
                    onClick={this.handleRetry}
                    className="flex-1"
                  >
                    Try Again
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={this.handleReload}
                    className="flex-1"
                  >
                    Reload Page
                  </Button>
                </div>
                
                <Button 
                  variant="danger" 
                  onClick={this.handleBurnNotice}
                  size="sm"
                  className="w-full"
                >
                  🔥 Emergency Reset (Burn Notice)
                </Button>
              </div>

              <div className="text-center text-xs text-anon-500 mt-6">
                <div className="flex items-center justify-center space-x-2">
                  <span>🔒</span>
                  <span>Your data remains encrypted and anonymous</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Simple error fallback component
export function ErrorFallback({ 
  error, 
  resetError 
}: { 
  error: Error; 
  resetError: () => void;
}) {
  return (
    <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 my-4">
      <div className="flex items-start space-x-3">
        <div className="text-red-400 mt-0.5">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-red-300 font-medium mb-1">Error occurred</h3>
          <p className="text-red-200 text-sm mb-3">{error.message}</p>
          <Button 
            variant="danger" 
            size="sm" 
            onClick={resetError}
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
} 