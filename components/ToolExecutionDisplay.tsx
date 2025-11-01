// Tool Execution Display Component
// Renders tool calls using prompt-kit Tool component with real-time state tracking

import React from 'react';
import { Tool, type ToolPart } from '@/components/ui/tool';
import type { Message } from '../types';

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  timestamp?: number;
}

interface ToolExecutionDisplayProps {
  toolExecutions: ToolExecution[];
  className?: string;
}

// Track if we've logged for this message to avoid excessive logging
const loggedMessages = new Set<string>();

export const ToolExecutionDisplay: React.FC<ToolExecutionDisplayProps> = ({ 
  toolExecutions, 
  className 
}) => {
  if (!toolExecutions || toolExecutions.length === 0) {
    return null;
  }

  // Only log once per unique set of tool executions (use first tool's ID as key)
  const logKey = toolExecutions[0]?.toolCallId || '';
  if (!loggedMessages.has(logKey)) {
    loggedMessages.add(logKey);
    console.log('🔧 [ToolExecutionDisplay] Rendering tool executions:', {
      count: toolExecutions.length,
      tools: toolExecutions.map(e => ({
        name: e.toolName,
        state: e.state,
        hasInput: !!e.input,
        hasOutput: !!e.output,
        hasError: !!e.errorText,
      })),
    });
  }

  return (
    <div className={className}>
      {toolExecutions.map((execution) => {
        const toolPart: ToolPart = {
          type: execution.toolName,
          state: execution.state,
          input: execution.input,
          output: execution.output,
          toolCallId: execution.toolCallId,
          errorText: execution.errorText,
        };

        // Only log state transitions, not every render
        if (execution.state === 'input-streaming' || execution.state === 'output-available' || execution.state === 'output-error') {
          const stateKey = `${execution.toolCallId}-${execution.state}`;
          if (!loggedMessages.has(stateKey)) {
            loggedMessages.add(stateKey);
            console.log(`🛠️ [ToolExecutionDisplay] Tool: ${execution.toolName}`, {
              state: execution.state,
              stateTransition: 
                execution.state === 'input-streaming' ? '→ Processing (spinning icon)' :
                execution.state === 'output-available' ? '→ Completed' :
                execution.state === 'output-error' ? '→ Error' : 'Unknown',
            });
          }
        }

        return (
          <Tool
            key={execution.toolCallId}
            toolPart={toolPart}
            defaultOpen={execution.state === 'output-error' || execution.state === 'output-available'}
            className="mb-2"
          />
        );
      })}
    </div>
  );
};

// Helper to extract tool executions from message
export function extractToolExecutions(message: Message): ToolExecution[] {
  if (!message.toolExecutions) return [];

  return message.toolExecutions.map((exec) => ({
    toolCallId: exec.toolCallId,
    toolName: exec.toolName,
    state: exec.state,
    input: exec.input,
    output: exec.output,
    errorText: exec.errorText,
    timestamp: exec.timestamp,
  }));
}

