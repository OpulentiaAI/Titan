// Error Boundary for Component Isolation
// Prevents cascading failures when individual components crash
// Provides graceful degradation and error recovery

"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCcw, XCircle } from "lucide-react";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  level?: "critical" | "warning" | "minor";
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Call error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error caught by boundary:", error);
      console.error("Error info:", errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback based on error level
      return this.renderDefaultFallback();
    }

    return this.props.children;
  }

  private renderDefaultFallback() {
    const { level = "warning", componentName } = this.props;
    const { error } = this.state;

    // Critical level - prominent error display
    if (level === "critical") {
      return (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950/20">
          <div className="max-w-md space-y-4 text-center">
            <div className="flex justify-center">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">
                {componentName || "Component"} Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error?.message || "An unexpected error occurred"}
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                onClick={this.reset}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Warning level - medium error display
    if (level === "warning") {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {componentName || "Component"} failed to render
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {error?.message || "An error occurred while rendering this component"}
                </p>
              </div>
              <Button
                onClick={this.reset}
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
              >
                <RefreshCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Minor level - minimal error display
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/20">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {componentName || "Component"} unavailable
          </p>
          <button
            onClick={this.reset}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}

// Convenience wrapper components for different error levels
export const CriticalErrorBoundary = ({ children, componentName, onError }: {
  children: ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) => (
  <ErrorBoundary level="critical" componentName={componentName} onError={onError}>
    {children}
  </ErrorBoundary>
);

export const WarningErrorBoundary = ({ children, componentName, onError }: {
  children: ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) => (
  <ErrorBoundary level="warning" componentName={componentName} onError={onError}>
    {children}
  </ErrorBoundary>
);

export const MinorErrorBoundary = ({ children, componentName, onError }: {
  children: ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) => (
  <ErrorBoundary level="minor" componentName={componentName} onError={onError}>
    {children}
  </ErrorBoundary>
);
