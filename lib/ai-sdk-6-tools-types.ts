// AI SDK 6 Enhanced Tool Type System
// Provides complete type safety, deterministic returns, and runtime validation

import { z } from 'zod';
import type { CoreTool, ToolSet } from 'ai';

/**
 * Extract tool call types from a tool set
 * Enables type-safe tool call handling across the application
 */
export type TypedToolCall<TOOLS extends ToolSet> = {
  [K in keyof TOOLS]: {
    dynamic: false;
    toolCallType: 'function';
    toolCallId: string;
    toolName: K;
    input: TOOLS[K] extends CoreTool<infer PARAMS, any>
      ? PARAMS extends z.ZodType
        ? z.infer<PARAMS>
        : never
      : never;
  };
}[keyof TOOLS] | {
  dynamic: true;
  toolCallType: 'function';
  toolCallId: string;
  toolName: string;
  input: unknown;
};

/**
 * Extract tool result types from a tool set
 * Enables type-safe tool result handling and validation
 */
export type TypedToolResult<TOOLS extends ToolSet> = {
  [K in keyof TOOLS]: {
    dynamic: false;
    toolCallId: string;
    toolName: K;
    input: TOOLS[K] extends CoreTool<infer PARAMS, any>
      ? PARAMS extends z.ZodType
        ? z.infer<PARAMS>
        : never
      : never;
    result: TOOLS[K] extends CoreTool<any, infer RESULT> ? RESULT : never;
    error?: undefined;
  };
}[keyof TOOLS] | {
  dynamic: false;
  toolCallId: string;
  toolName: keyof TOOLS;
  input: unknown;
  result?: undefined;
  error: Error;
} | {
  dynamic: true;
  toolCallId: string;
  toolName: string;
  input: unknown;
  result: unknown;
  error?: Error;
};

/**
 * Tool execution options passed to tool's execute function
 * Includes context, abort signals, and messages for full context awareness
 */
export interface ToolExecutionOptions {
  toolCallId: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | Array<{
      type: string;
      [key: string]: unknown;
    }>;
  }>;
  abortSignal?: AbortSignal;
  experimental_context?: unknown;
}

/**
 * Preliminary tool result for streaming status updates
 * Supports AsyncIterable for multi-stage tool execution
 */
export type PreliminaryToolResult<T> = {
  status: 'loading' | 'progress' | 'success' | 'error';
  text: string;
  progress?: number;
  data?: Partial<T>;
};

/**
 * Tool result types supporting both simple and streaming results
 */
export type ToolResult<T> =
  | T
  | AsyncIterable<PreliminaryToolResult<T> | T>;

/**
 * Multi-modal tool output for complex results (images, files, etc.)
 */
export type ToolOutput =
  | { type: 'content'; value: Array<{ type: 'text'; text: string } | { type: 'media'; data: string; mediaType: string }> }
  | { type: 'text'; value: string };

/**
 * Enhanced tool definition with all AI SDK 6 features
 */
export interface EnhancedToolDefinition<TParams extends z.ZodType, TResult> {
  description: string;
  inputSchema: TParams;
  execute: (
    args: z.infer<TParams>,
    options: ToolExecutionOptions
  ) => Promise<ToolResult<TResult>> | ToolResult<TResult>;
  toModelOutput?: (result: TResult) => ToolOutput;
  validate?: {
    input?: (args: z.infer<TParams>) => true | string;
    output?: (result: TResult) => true | string;
  };
  metadata?: {
    category?: string;
    tags?: string[];
    version?: string;
    experimental?: boolean;
  };
}

/**
 * Tool call state machine for reliable state tracking
 */
export type ToolCallState =
  | 'input-streaming'
  | 'input-available'
  | 'executing'
  | 'output-streaming'
  | 'output-available'
  | 'output-error'
  | 'repair-pending'
  | 'repaired';

/**
 * Deterministic tool call record for history and debugging
 */
export interface ToolCallRecord<TOOLS extends ToolSet = ToolSet> {
  id: string;
  timestamp: number;
  state: ToolCallState;
  toolCall: TypedToolCall<TOOLS>;
  result?: TypedToolResult<TOOLS>;
  preliminaryResults?: Array<unknown>;
  duration?: number;
  retryCount?: number;
  repaired?: boolean;
}

/**
 * Tool execution step with complete type safety
 */
export interface TypedToolExecutionStep<TOOLS extends ToolSet> {
  stepNumber: number;
  toolCalls: Array<TypedToolCall<TOOLS>>;
  toolResults: Array<TypedToolResult<TOOLS>>;
  text?: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
  duration?: number;
  activeTools?: Array<keyof TOOLS>;
}

/**
 * Tool error types for comprehensive error handling
 */
export class NoSuchToolError extends Error {
  constructor(
    public toolName: string,
    public availableTools: string[]
  ) {
    super(`Tool "${toolName}" not found. Available tools: ${availableTools.join(', ')}`);
    this.name = 'NoSuchToolError';
  }

  static isInstance(error: unknown): error is NoSuchToolError {
    return error instanceof NoSuchToolError;
  }
}

export class InvalidToolInputError extends Error {
  constructor(
    public toolName: string,
    public input: unknown,
    public validationError: z.ZodError
  ) {
    super(`Invalid input for tool "${toolName}": ${validationError.message}`);
    this.name = 'InvalidToolInputError';
  }

  static isInstance(error: unknown): error is InvalidToolInputError {
    return error instanceof InvalidToolInputError;
  }
}

export class ToolCallRepairError extends Error {
  constructor(
    public toolName: string,
    public originalError: Error,
    public repairAttempts: number
  ) {
    super(`Failed to repair tool call "${toolName}" after ${repairAttempts} attempts: ${originalError.message}`);
    this.name = 'ToolCallRepairError';
  }

  static isInstance(error: unknown): error is ToolCallRepairError {
    return error instanceof ToolCallRepairError;
  }
}

export class ToolExecutionTimeoutError extends Error {
  constructor(
    public toolName: string,
    public timeout: number
  ) {
    super(`Tool "${toolName}" execution timeout after ${timeout}ms`);
    this.name = 'ToolExecutionTimeoutError';
  }

  static isInstance(error: unknown): error is ToolExecutionTimeoutError {
    return error instanceof ToolExecutionTimeoutError;
  }
}

/**
 * Tool repair strategy for automatic error recovery
 */
export interface ToolRepairStrategy<TOOLS extends ToolSet> {
  maxAttempts: number;
  strategy: 'structured-output' | 're-ask' | 'custom';
  repair: (context: {
    toolCall: TypedToolCall<TOOLS>;
    tools: TOOLS;
    error: Error;
    inputSchema: (toolCall: TypedToolCall<TOOLS>) => z.ZodType;
    messages: Array<{ role: string; content: string }>;
    system?: string;
  }) => Promise<TypedToolCall<TOOLS> | null>;
}

/**
 * Stop condition for multi-step execution
 */
export type StopCondition<TOOLS extends ToolSet> = (context: {
  steps: Array<TypedToolExecutionStep<TOOLS>>;
  currentStep: TypedToolExecutionStep<TOOLS>;
}) => boolean;

/**
 * Helper function to create step count condition
 */
export function stepCountIs(count: number): StopCondition<any> {
  return ({ steps }) => steps.length >= count;
}

/**
 * Helper function to create tool usage condition
 */
export function noToolCallsInLastStep<TOOLS extends ToolSet>(): StopCondition<TOOLS> {
  return ({ currentStep }) => currentStep.toolCalls.length === 0;
}

/**
 * Prepare step callback for dynamic configuration
 */
export interface PrepareStepCallback<TOOLS extends ToolSet> {
  (context: {
    model: any;
    stopWhen?: StopCondition<TOOLS>;
    stepNumber: number;
    steps: Array<TypedToolExecutionStep<TOOLS>>;
    messages: Array<{ role: string; content: string }>;
  }): Promise<{
    model?: any;
    toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: keyof TOOLS };
    activeTools?: Array<keyof TOOLS>;
    messages?: Array<{ role: string; content: string }>;
  } | void>;
}

/**
 * Tool execution result with complete type information
 */
export interface TypedToolExecutionResult<TOOLS extends ToolSet> {
  text: string;
  steps: Array<TypedToolExecutionStep<TOOLS>>;
  response: {
    messages: Array<{
      role: 'assistant' | 'tool';
      content: string | Array<{ type: string; [key: string]: unknown }>;
    }>;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  duration: number;
  toolCalls: Array<TypedToolCall<TOOLS>>;
  toolResults: Array<TypedToolResult<TOOLS>>;
}

/**
 * Validate tool call input with detailed error reporting
 */
export function validateToolInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
  toolName: string
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new InvalidToolInputError(toolName, input, result.error);
  }
  return result.data;
}

/**
 * Type guard for typed tool calls
 */
export function isTypedToolCall<TOOLS extends ToolSet>(
  toolCall: unknown,
  tools: TOOLS
): toolCall is TypedToolCall<TOOLS> {
  if (typeof toolCall !== 'object' || toolCall === null) return false;
  const tc = toolCall as any;
  return (
    typeof tc.toolCallId === 'string' &&
    typeof tc.toolName === 'string' &&
    (tc.dynamic === true || tc.toolName in tools)
  );
}

/**
 * Type guard for typed tool results
 */
export function isTypedToolResult<TOOLS extends ToolSet>(
  toolResult: unknown,
  tools: TOOLS
): toolResult is TypedToolResult<TOOLS> {
  if (typeof toolResult !== 'object' || toolResult === null) return false;
  const tr = toolResult as any;
  return (
    typeof tr.toolCallId === 'string' &&
    typeof tr.toolName === 'string' &&
    (tr.dynamic === true || tr.toolName in tools) &&
    ('result' in tr || 'error' in tr)
  );
}

export default {
  NoSuchToolError,
  InvalidToolInputError,
  ToolCallRepairError,
  ToolExecutionTimeoutError,
  validateToolInput,
  isTypedToolCall,
  isTypedToolResult,
  stepCountIs,
  noToolCallsInLastStep,
};
