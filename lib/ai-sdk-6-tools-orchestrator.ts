// AI SDK 6 Enhanced Tool Orchestrator
// Comprehensive tool execution with error handling, repair, and multi-step support

import { generateText, streamText, tool, type LanguageModel, type ToolSet, type CoreTool } from 'ai';
import { z } from 'zod';
import type {
  TypedToolCall,
  TypedToolResult,
  TypedToolExecutionStep,
  TypedToolExecutionResult,
  ToolRepairStrategy,
  StopCondition,
  PrepareStepCallback,
  ToolCallRecord,
  ToolExecutionOptions,
} from './ai-sdk-6-tools-types';
import {
  NoSuchToolError,
  InvalidToolInputError,
  ToolCallRepairError,
  ToolExecutionTimeoutError,
  validateToolInput,
  stepCountIs,
} from './ai-sdk-6-tools-types';

/**
 * Enhanced tool orchestrator configuration
 */
export interface ToolOrchestratorConfig<TOOLS extends ToolSet> {
  maxSteps?: number;
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: keyof TOOLS };
  stopWhen?: StopCondition<TOOLS>;
  prepareStep?: PrepareStepCallback<TOOLS>;
  activeTools?: Array<keyof TOOLS>;

  // Error handling
  repairStrategy?: ToolRepairStrategy<TOOLS>;
  maxRetries?: number;
  retryDelay?: number;
  continueOnError?: boolean;

  // Callbacks
  onStepStart?: (step: TypedToolExecutionStep<TOOLS>) => void | Promise<void>;
  onStepFinish?: (step: TypedToolExecutionStep<TOOLS>) => void | Promise<void>;
  onToolCall?: (toolCall: TypedToolCall<TOOLS>) => void | Promise<void>;
  onToolResult?: (result: TypedToolResult<TOOLS>) => void | Promise<void>;
  onToolError?: (error: Error, toolCall: TypedToolCall<TOOLS>) => void | Promise<void>;

  // Performance
  experimental_telemetry?: {
    isEnabled?: boolean;
    recordInputs?: boolean;
    recordOutputs?: boolean;
    functionId?: string;
    metadata?: Record<string, string | number | boolean>;
  };

  // Context
  experimental_context?: unknown;
}

/**
 * Enhanced tool orchestrator with comprehensive reliability features
 */
export class EnhancedToolOrchestrator<TOOLS extends ToolSet> {
  private config: Required<ToolOrchestratorConfig<TOOLS>>;
  private steps: Array<TypedToolExecutionStep<TOOLS>> = [];
  private toolCallRecords: Map<string, ToolCallRecord<TOOLS>> = new Map();
  private abortController = new AbortController();

  constructor(config: ToolOrchestratorConfig<TOOLS> = {}) {
    this.config = {
      maxSteps: 10,
      toolChoice: 'auto',
      stopWhen: stepCountIs(10),
      prepareStep: async () => {},
      activeTools: undefined as any,
      repairStrategy: undefined as any,
      maxRetries: 3,
      retryDelay: 1000,
      continueOnError: false,
      onStepStart: async () => {},
      onStepFinish: async () => {},
      onToolCall: async () => {},
      onToolResult: async () => {},
      onToolError: async () => {},
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
      },
      experimental_context: undefined,
      ...config,
    };
  }

  /**
   * Execute tools with comprehensive error handling and repair
   */
  async execute(params: {
    model: LanguageModel;
    system: string;
    messages: Array<{ role: string; content: string }>;
    tools: TOOLS;
  }): Promise<TypedToolExecutionResult<TOOLS>> {
    const startTime = Date.now();
    let currentStep = 0;
    let allMessages = [...params.messages];

    try {
      const result = await streamText({
        model: params.model,
        system: params.system,
        messages: allMessages,
        tools: params.tools,
        toolChoice: this.config.toolChoice as any,
        maxSteps: this.config.maxSteps,
        abortSignal: this.abortController.signal,
        experimental_telemetry: this.config.experimental_telemetry,

        // Dynamic step preparation
        experimental_prepareStep: async (context: any) => {
          const prepareResult = await this.config.prepareStep({
            model: context.model,
            stopWhen: this.config.stopWhen,
            stepNumber: context.stepNumber,
            steps: this.steps,
            messages: context.messages,
          });

          return prepareResult || {};
        },

        // Tool call repair
        experimental_repairToolCall: this.config.repairStrategy
          ? async (context: any) => {
              try {
                return await this.repairToolCall(context, params.tools);
              } catch (error) {
                console.error('❌ Tool repair failed:', error);
                return null;
              }
            }
          : undefined,

        // Real-time step monitoring
        onStepFinish: async (event: any) => {
          currentStep++;

          const step: TypedToolExecutionStep<TOOLS> = {
            stepNumber: currentStep,
            toolCalls: event.toolCalls?.map((tc: any) => this.mapToTypedToolCall(tc, params.tools)) || [],
            toolResults: event.toolResults?.map((tr: any) => this.mapToTypedToolResult(tr, params.tools)) || [],
            text: event.text,
            finishReason: event.finishReason,
            usage: event.usage,
            timestamp: Date.now(),
            activeTools: this.config.activeTools,
          };

          // Record tool calls
          for (const toolCall of step.toolCalls) {
            this.recordToolCall(toolCall);
            await this.config.onToolCall(toolCall);
          }

          // Record tool results
          for (const toolResult of step.toolResults) {
            this.recordToolResult(toolResult);
            await this.config.onToolResult(toolResult);

            // Handle errors
            if (toolResult.error) {
              const matchingCall = step.toolCalls.find(
                tc => tc.toolCallId === toolResult.toolCallId
              );
              if (matchingCall) {
                await this.config.onToolError(toolResult.error, matchingCall);
              }
            }
          }

          this.steps.push(step);
          await this.config.onStepFinish(step);

          // Check stop condition
          if (this.config.stopWhen({ steps: this.steps, currentStep: step })) {
            console.log('✅ Stop condition met, ending execution');
          }
        },
      });

      // Collect final text
      let finalText = '';
      for await (const textPart of result.textStream) {
        finalText += textPart;
      }

      const finalUsage = await result.usage;
      const finalResponse = await result.response;

      // Compile all tool calls and results
      const allToolCalls = this.steps.flatMap(s => s.toolCalls);
      const allToolResults = this.steps.flatMap(s => s.toolResults);

      return {
        text: finalText,
        steps: this.steps,
        response: finalResponse as any,
        usage: finalUsage,
        finishReason: this.steps[this.steps.length - 1]?.finishReason || 'stop',
        duration: Date.now() - startTime,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
      };
    } catch (error) {
      console.error('❌ Tool execution failed:', error);
      throw this.wrapError(error);
    }
  }

  /**
   * Repair tool call with specified strategy
   */
  private async repairToolCall(
    context: any,
    tools: TOOLS
  ): Promise<any> {
    if (!this.config.repairStrategy) return null;

    const { toolCall, error } = context;

    // Don't repair invalid tool names
    if (NoSuchToolError.isInstance(error)) {
      return null;
    }

    console.log(`🔧 Attempting to repair tool call: ${toolCall.toolName}`);

    try {
      const repairedCall = await this.config.repairStrategy.repair({
        toolCall: this.mapToTypedToolCall(toolCall, tools),
        tools,
        error,
        inputSchema: (tc) => {
          const tool = tools[tc.toolName as keyof TOOLS];
          return (tool as any).inputSchema;
        },
        messages: context.messages,
        system: context.system,
      });

      if (repairedCall) {
        console.log('✅ Tool call repaired successfully');
        return {
          toolCallType: 'function',
          toolCallId: repairedCall.toolCallId,
          toolName: repairedCall.toolName as string,
          input: JSON.stringify(repairedCall.input),
        };
      }

      return null;
    } catch (repairError) {
      console.error('❌ Tool repair failed:', repairError);
      throw new ToolCallRepairError(
        toolCall.toolName,
        error,
        this.config.repairStrategy.maxAttempts
      );
    }
  }

  /**
   * Map AI SDK tool call to typed tool call
   */
  private mapToTypedToolCall(toolCall: any, tools: TOOLS): TypedToolCall<TOOLS> {
    const isDynamic = !(toolCall.toolName in tools);

    if (isDynamic) {
      return {
        dynamic: true,
        toolCallType: 'function',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        input: toolCall.args,
      } as TypedToolCall<TOOLS>;
    }

    return {
      dynamic: false,
      toolCallType: 'function',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: toolCall.args,
    } as TypedToolCall<TOOLS>;
  }

  /**
   * Map AI SDK tool result to typed tool result
   */
  private mapToTypedToolResult(toolResult: any, tools: TOOLS): TypedToolResult<TOOLS> {
    const isDynamic = !(toolResult.toolName in tools);

    if (toolResult.error) {
      return {
        dynamic: false,
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        input: toolResult.input,
        error: toolResult.error,
      } as TypedToolResult<TOOLS>;
    }

    if (isDynamic) {
      return {
        dynamic: true,
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        input: toolResult.input,
        result: toolResult.result,
      } as TypedToolResult<TOOLS>;
    }

    return {
      dynamic: false,
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      input: toolResult.input,
      result: toolResult.result,
    } as TypedToolResult<TOOLS>;
  }

  /**
   * Record tool call for tracking and analytics
   */
  private recordToolCall(toolCall: TypedToolCall<TOOLS>): void {
    this.toolCallRecords.set(toolCall.toolCallId, {
      id: toolCall.toolCallId,
      timestamp: Date.now(),
      state: 'input-available',
      toolCall,
      retryCount: 0,
    });
  }

  /**
   * Record tool result and update tracking
   */
  private recordToolResult(toolResult: TypedToolResult<TOOLS>): void {
    const record = this.toolCallRecords.get(toolResult.toolCallId);
    if (record) {
      record.state = toolResult.error ? 'output-error' : 'output-available';
      record.result = toolResult;
      record.duration = Date.now() - record.timestamp;
    }
  }

  /**
   * Wrap error with appropriate type
   */
  private wrapError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  /**
   * Abort ongoing execution
   */
  abort(): void {
    this.abortController.abort();
  }

  /**
   * Get execution summary
   */
  getSummary() {
    const totalToolCalls = this.steps.reduce((sum, step) => sum + step.toolCalls.length, 0);
    const successfulCalls = this.steps.reduce(
      (sum, step) => sum + step.toolResults.filter(r => !r.error).length,
      0
    );
    const failedCalls = this.steps.reduce(
      (sum, step) => sum + step.toolResults.filter(r => r.error).length,
      0
    );

    const toolUsage: Record<string, number> = {};
    for (const step of this.steps) {
      for (const toolCall of step.toolCalls) {
        const name = toolCall.toolName as string;
        toolUsage[name] = (toolUsage[name] || 0) + 1;
      }
    }

    return {
      totalSteps: this.steps.length,
      totalToolCalls,
      successfulCalls,
      failedCalls,
      successRate: totalToolCalls > 0 ? successfulCalls / totalToolCalls : 0,
      toolUsage,
      averageDuration:
        Array.from(this.toolCallRecords.values())
          .filter(r => r.duration)
          .reduce((sum, r) => sum + (r.duration || 0), 0) /
        Math.max(this.toolCallRecords.size, 1),
    };
  }

  /**
   * Get tool call records for debugging
   */
  getToolCallRecords(): Map<string, ToolCallRecord<TOOLS>> {
    return this.toolCallRecords;
  }

  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.steps = [];
    this.toolCallRecords.clear();
    this.abortController = new AbortController();
  }
}

/**
 * Create default repair strategy using structured outputs
 */
export function createStructuredOutputRepairStrategy<TOOLS extends ToolSet>(
  repairModel: LanguageModel
): ToolRepairStrategy<TOOLS> {
  return {
    maxAttempts: 2,
    strategy: 'structured-output',
    repair: async ({ toolCall, tools, inputSchema, error }) => {
      if (NoSuchToolError.isInstance(error)) {
        return null;
      }

      const tool = tools[toolCall.toolName as keyof TOOLS];
      if (!tool) return null;

      const schema = inputSchema(toolCall);

      try {
        const { object: repairedArgs } = await (generateText as any)({
          model: repairModel,
          output: 'object',
          schema,
          prompt: [
            `The AI tried to call the tool "${toolCall.toolName as string}"`,
            `with the following inputs:`,
            JSON.stringify(toolCall.input),
            `The tool accepts the following schema:`,
            JSON.stringify(schema),
            `Please fix the inputs to match the schema.`,
          ].join('\n'),
        });

        return {
          ...toolCall,
          input: repairedArgs,
        };
      } catch (repairError) {
        console.error('Repair failed:', repairError);
        return null;
      }
    },
  };
}

/**
 * Create re-ask repair strategy
 */
export function createReAskRepairStrategy<TOOLS extends ToolSet>(
  model: LanguageModel
): ToolRepairStrategy<TOOLS> {
  return {
    maxAttempts: 1,
    strategy: 're-ask',
    repair: async ({ toolCall, tools, error, messages, system }) => {
      const result = await generateText({
        model,
        system,
        messages: [
          ...messages,
          {
            role: 'assistant' as const,
            content: JSON.stringify({
              type: 'tool-call',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName as string,
              input: toolCall.input,
            }),
          },
          {
            role: 'user' as const,
            content: `Error: ${error.message}. Please fix the tool call.`,
          },
        ],
        tools,
      });

      const newToolCall = (result as any).toolCalls?.find(
        (tc: any) => tc.toolName === toolCall.toolName
      );

      return newToolCall
        ? {
            toolCallType: 'function' as const,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: newToolCall.args,
            dynamic: false,
          }
        : null;
    },
  };
}

export default {
  EnhancedToolOrchestrator,
  createStructuredOutputRepairStrategy,
  createReAskRepairStrategy,
};
