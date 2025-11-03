// Tool Component - Displays tool call details with input, output, status, and errors
// Compatible with AI SDK v5 architecture

import React, { useState } from 'react';

export type ToolPart = {
  type: string;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolCallId?: string;
  errorText?: string;
};

export type ToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
};

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { state, input, output, toolCallId } = toolPart;

  const getStateIcon = () => {
    switch (state) {
      case 'input-streaming':
        return (
          <svg className="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'input-available':
        return <span className="text-orange-500">⚙️</span>;
      case 'output-available':
        return <span className="text-green-500">✅</span>;
      case 'output-error':
        return <span className="text-red-500">❌</span>;
      default:
        return <span className="text-gray-500">⚙️</span>;
    }
  };

  const getStateBadge = () => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (state) {
      case 'input-streaming':
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`}>
            Processing
          </span>
        );
      case 'input-available':
        return (
          <span className={`${baseClasses} bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400`}>
            Ready
          </span>
        );
      case 'output-available':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`}>
            Completed
          </span>
        );
      case 'output-error':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`}>
            Error
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400`}>
            Pending
          </span>
        );
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className={`mt-2 overflow-hidden rounded-md border border-border/40 bg-accent/5 backdrop-blur-sm ${className || ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-transparent h-auto w-full justify-between rounded-b-none px-3 py-1.5 font-normal hover:bg-muted/30 transition-colors flex items-center text-left"
        style={{ fontSize: '13px' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '14px' }}>{getStateIcon()}</span>
          <span className="font-mono font-medium" style={{ fontSize: '13px' }}>
            {toolPart.type}
          </span>
          {getStateBadge()}
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-border/30 bg-transparent">
          <div className="space-y-3 p-3">
            {input && Object.keys(input).length > 0 && (
              <div>
                <h4 className="text-muted-foreground mb-1.5 font-medium" style={{ fontSize: '11px' }}>
                  Input
                </h4>
                <div className="bg-muted/50 rounded border border-border/30 p-2 font-mono" style={{ fontSize: '11px' }}>
                  {Object.entries(input).map(([key, value]) => (
                    <div key={key} className="mb-1" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-muted-foreground">{key}:</span>{' '}
                      <span className="text-foreground">
                        {typeof value === 'string' && value.length > 50
                          ? value.substring(0, 50) + '...'
                          : formatValue(value).substring(0, 100)
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {output && (
              <div>
                <h4 className="text-muted-foreground mb-1.5 font-medium" style={{ fontSize: '11px' }}>
                  Output
                </h4>
                <div className="bg-muted/50 max-h-40 overflow-auto rounded border border-border/30 p-2 font-mono" style={{ fontSize: '11px' }}>
                  <pre className="whitespace-pre-wrap text-foreground">
                    {(() => {
                      const formatted = formatValue(output);
                      // Limit output display to 500 chars
                      return formatted.length > 500 ? formatted.substring(0, 500) + '\n\n... (truncated)' : formatted;
                    })()}
                  </pre>
                </div>
              </div>
            )}

            {state === 'output-error' && toolPart.errorText && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">Error</h4>
                <div className="bg-red-50/50 dark:bg-red-950/20 rounded border border-red-200/50 dark:border-red-800/30 p-2 text-sm text-red-900 dark:text-red-200">
                  {toolPart.errorText}
                </div>
              </div>
            )}

            {state === 'input-streaming' && (
              <div className="text-muted-foreground text-sm">
                Processing tool call...
              </div>
            )}

            {toolCallId && (
              <div className="text-muted-foreground border-t border-border/20 pt-2 text-xs">
                <span className="font-mono">Call ID: {toolCallId}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { Tool };

