// Enhanced Tool Component Example
// Shows how to integrate AI Elements with existing tool display

import React, { useState } from 'react';
import { Actions, Action } from './actions';
import { CodeBlock, CodeBlockCopyButton } from './code-block';
import { Reasoning, ReasoningTrigger, ReasoningContent } from './reasoning';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Loader2, Settings, RefreshCcw, ChevronDown } from 'lucide-react';

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
  thinking?: string; // AI reasoning about the tool execution
};

export type EnhancedToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
  onRetry?: () => void;
};

/**
 * Enhanced Tool Component using AI Elements patterns
 * 
 * Features:
 * - Syntax-highlighted code blocks with copy buttons
 * - AI reasoning display for transparent decision-making
 * - Action buttons for retry/copy
 * - Smooth animations and transitions
 * - Full dark mode support
 */
export const EnhancedTool = ({ 
  toolPart, 
  defaultOpen = false, 
  className,
  onRetry 
}: EnhancedToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { state, input, output, toolCallId, thinking } = toolPart;

  const getStateIcon = () => {
    switch (state) {
      case 'input-streaming':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'input-available':
        return <Settings className="h-4 w-4 text-orange-500" />;
      case 'output-available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'output-error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStateBadge = () => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (state) {
      case 'input-streaming':
        return (
          <span className={cn(baseClasses, 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')}>
            Processing
          </span>
        );
      case 'input-available':
        return (
          <span className={cn(baseClasses, 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400')}>
            Ready
          </span>
        );
      case 'output-available':
        return (
          <span className={cn(baseClasses, 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
            Completed
          </span>
        );
      case 'output-error':
        return (
          <span className={cn(baseClasses, 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
            Error
          </span>
        );
      default:
        return (
          <span className={cn(baseClasses, 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400')}>
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
    <div className={cn('mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700', className)}>
      {/* Header with trigger */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className="bg-gray-50 dark:bg-gray-800 h-auto w-full justify-between rounded-b-none px-3 py-1.5 font-normal hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center text-left"
        >
          <div className="flex items-center gap-2">
            {getStateIcon()}
            <span className="font-mono font-medium text-sm">
              {toolPart.type}
            </span>
            {getStateBadge()}
          </div>
          <div className="flex items-center gap-2">
            {/* Action buttons */}
            {(state === 'output-error' && onRetry) && (
              <Actions>
                <Action 
                  tooltip="Retry" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry();
                  }}
                  size="sm"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                </Action>
              </Actions>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isOpen ? 'rotate-180' : ''
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="space-y-3 p-3">
            {/* AI Reasoning Section */}
            {thinking && (
              <Reasoning 
                isStreaming={state === 'input-streaming'} 
                defaultOpen={state === 'input-streaming'}
              >
                <ReasoningTrigger title="AI Reasoning" />
                <ReasoningContent>
                  {thinking}
                </ReasoningContent>
              </Reasoning>
            )}

            {/* Input Section with Syntax Highlighting */}
            {input && Object.keys(input).length > 0 && (
              <div>
                <h4 className="text-gray-600 dark:text-gray-400 mb-1.5 font-medium text-xs">
                  Input
                </h4>
                <CodeBlock 
                  code={formatValue(input)} 
                  language="json"
                  className="text-xs"
                >
                  <CodeBlockCopyButton />
                </CodeBlock>
              </div>
            )}

            {/* Output Section with Syntax Highlighting */}
            {output && (
              <div>
                <h4 className="text-gray-600 dark:text-gray-400 mb-1.5 font-medium text-xs">
                  Output
                </h4>
                <CodeBlock 
                  code={formatValue(output)} 
                  language="json"
                  className="text-xs max-h-60 overflow-auto"
                >
                  <CodeBlockCopyButton />
                </CodeBlock>
              </div>
            )}

            {/* Error Section */}
            {state === 'output-error' && toolPart.errorText && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-red-500">Error</h4>
                <div className="bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 p-2 text-sm text-red-900 dark:text-red-200">
                  {toolPart.errorText}
                </div>
              </div>
            )}

            {/* Processing State */}
            {state === 'input-streaming' && (
              <div className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing tool call...
              </div>
            )}

            {/* Metadata */}
            {toolCallId && (
              <div className="text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2 text-xs">
                <span className="font-mono">Call ID: {toolCallId}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

/**
 * Usage Example in ToolExecutionDisplay component:
 * 
 * import { EnhancedTool } from '@/components/ai-elements/tool-enhanced-example';
 * 
 * export const ToolExecutionDisplay = ({ toolExecutions }) => {
 *   return (
 *     <div className="space-y-2">
 *       {toolExecutions.map((execution) => (
 *         <EnhancedTool
 *           key={execution.toolCallId}
 *           toolPart={{
 *             type: execution.toolName,
 *             state: execution.state,
 *             input: execution.input,
 *             output: execution.output,
 *             toolCallId: execution.toolCallId,
 *             errorText: execution.errorText,
 *             thinking: execution.thinking, // Add AI reasoning
 *           }}
 *           defaultOpen={execution.state === 'output-error'}
 *           onRetry={() => handleRetry(execution.toolCallId)}
 *         />
 *       ))}
 *     </div>
 *   );
 * };
 */

