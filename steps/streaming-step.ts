// 'use step' directive makes this a durable, resumable step

import { streamText, tool, stepCountIs, NoSuchToolError, generateObject } from 'ai';
import { z } from 'zod';
import { logEvent } from '../lib/braintrust.ts';
import { streamingDebug } from '../lib/debug-logger.ts';
import type { StreamingStepOutput } from '../schemas/workflow-schemas';
import type { Message } from '../types';

interface StreamingStepInput {
  model: any;
  system: string;
  tools: Record<string, any> | undefined;
  messages: Message[];
  execSteps: Array<{ step: number; action: string; url?: string; success: boolean }>;
  updateLastMessage: (updater: (msg: Message) => Message) => void;
  pushMessage: (msg: Message) => void;
  executeTool: (toolName: string, params: any) => Promise<any>;
  abortSignal?: AbortSignal;
}

type ToolExecutionState = {
  toolCallId: string;
  toolName: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  timestamp: number;
  duration?: number;
};

/**
 * Streaming Step - Streams AI SDK response with tool calls
 * Handles text streaming and tool execution in a durable step
 */
export async function streamingStep(
  input: StreamingStepInput
): Promise<StreamingStepOutput> {
  "use step"; // Makes this a durable step

  const startTime = Date.now();
  const stopTimer = streamingDebug.time('Streaming Step');

  try {
    streamingDebug.info('Starting AI SDK streaming step', {
      messageCount: input.messages?.length || 0,
      providedToolCount: Object.keys(input.tools || {}).length,
      hasAbortSignal: !!input.abortSignal,
      modelType: typeof input.model,
    });

    logEvent('streaming_step_start', {
      message_count: input.messages?.length || 0,
      tool_count: Object.keys(input.tools || {}).length,
    });

    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new Error('Invalid messages input - expected non-empty array');
    }

    const aiMessages = input.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const streamingTools: Record<string, any> = { ...(input.tools ?? {}) };

    if (!streamingTools.navigate) {
      streamingTools.navigate = tool({
        description: 'Navigate to a URL in the browser',
        inputSchema: z.object({
          url: z.string().url().describe('The URL to navigate to'),
        }),
        execute: async ({ url }) => {
          streamingDebug.debug('Fallback navigate tool invoked', { url });
          return input.executeTool('navigate', { url });
        },
      });
    }

    if (!streamingTools.getPageContext) {
      streamingTools.getPageContext = tool({
        description: 'Get the current page context and content',
        inputSchema: z.object({
          url: z.string().optional().describe('Optional URL to get context for'),
        }),
        execute: async ({ url }) => {
          streamingDebug.debug('Fallback getPageContext tool invoked', { url });
          return input.executeTool('getPageContext', { url: url || 'current_page' });
        },
      });
    }

    const streamingMessageId = `streaming-${Date.now()}`;
    input.pushMessage({
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      toolExecutions: [],
    });

    const toolExecutionStates = new Map<string, ToolExecutionState>();
    const toolCallInfo = new Map<string, { toolName: string; args?: Record<string, unknown> }>();
    const toolCallStartTimes = new Map<string, number>();
    const toolCallStepIndex = new Map<string, number>();
    const executionSteps: Array<{ step: number; action: string; url?: string; success: boolean }> = [];
    let lastFinishReason: string | undefined;

    const updateMessage = (content?: string) => {
      const toolExecutionsForMessage = Array.from(toolExecutionStates.values()).map((state) => ({
        toolCallId: state.toolCallId,
        toolName: state.toolName,
        state: state.state,
        input: state.input,
        output: state.output,
        errorText: state.errorText,
        timestamp: state.timestamp,
      }));

      input.updateLastMessage((msg) => {
        if (msg.role !== 'assistant') {
          return msg;
        }
        return {
          ...msg,
          content: typeof content === 'string' ? content : msg.content,
          toolExecutions: toolExecutionsForMessage,
        };
      });
    };

    // Helper: detect info-seeking intent from latest user message
    const isInfoSeeking = () => {
      const lastUser = aiMessages.slice().reverse().find((m) => m.role === 'user');
      const q = (lastUser?.content || '').toLowerCase();
      return /\b(find|search|news|latest|breaking|what is|who is|tell me about)\b/.test(q);
    };

    // Helper: determine active tools per step to guide the model
    const computeActiveTools = (stepNumber: number) => {
      const actions = input.execSteps.map((s) => s.action.split(':')[0]);
      const lastNavIdx = actions.lastIndexOf('navigate');
      const hasContextAfterNav = lastNavIdx >= 0 && actions.slice(lastNavIdx + 1).includes('getPageContext');
      const hasTyped = actions.includes('type_text');
      const info = isInfoSeeking();

      if (stepNumber === 0 && !hasContextAfterNav) {
        // Immediately verify state after navigation or at start
        return ['getPageContext', 'wait'] as const;
      }

      if (info && !hasTyped) {
        // Encourage typing search query and submitting
        return ['type_text', 'press_key', 'getPageContext', 'wait', 'scroll'] as const;
      }

      if (info && hasTyped && !actions.includes('click')) {
        // Encourage clicking a result and verifying
        return ['click', 'getPageContext', 'wait', 'scroll', 'press_key'] as const;
      }

      // Default: allow main interaction set
      return ['navigate', 'getPageContext', 'click', 'type_text', 'press_key', 'scroll', 'wait'] as const;
    };

    const stream = streamText({
      model: input.model,
      system: input.system,
      messages: aiMessages,
      tools: streamingTools,
      toolChoice: 'required',
      stopWhen: stepCountIs(8),
      experimental_context: {
        objective: aiMessages.slice().reverse().find((m) => m.role === 'user')?.content || '',
        infoSeeking: isInfoSeeking(),
        lastActions: input.execSteps.map((s) => s.action),
      },
      prepareStep: async ({ stepNumber, steps, messages }) => {
        const active = computeActiveTools(stepNumber);
        // Force first step verification if needed
        const actions = input.execSteps.map((s) => s.action.split(':')[0]);
        const lastNavIdx = actions.lastIndexOf('navigate');
        const hasContextAfterNav = lastNavIdx >= 0 && actions.slice(lastNavIdx + 1).includes('getPageContext');
        if (stepNumber === 0 && !hasContextAfterNav) {
          return {
            toolChoice: { type: 'tool', toolName: 'getPageContext' },
            activeTools: Array.from(active),
          } as any;
        }
        return { activeTools: Array.from(active) } as any;
      },
      experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error, messages, system }) => {
        // Do not attempt to fix unknown tool names
        if (NoSuchToolError.isInstance(error)) return null;
        // Attempt structured repair using the tool's input schema
        try {
          const toolEntry = tools[toolCall.toolName as keyof typeof tools] as any;
          const { object: repaired } = await generateObject({
            model: input.model as any,
            schema: (inputSchema as any)(toolCall),
            prompt: [
              `The model tried to call the tool "${toolCall.toolName}" with the following inputs:`,
              JSON.stringify(toolCall.input),
              `The tool accepts the following schema:`,
              JSON.stringify((inputSchema as any)(toolCall)),
              'Please fix the inputs to satisfy the schema.',
            ].join('\n'),
          });
          return { ...toolCall, input: JSON.stringify(repaired) } as any;
        } catch {
          return null;
        }
      },
      maxSteps: 15,
      abortSignal: input.abortSignal,
      onStepFinish: async (event) => {
        lastFinishReason = event.finishReason || lastFinishReason;

        if (event.toolCalls) {
          for (const toolCall of event.toolCalls) {
            const args =
              toolCall.args && typeof toolCall.args === 'object'
                ? (toolCall.args as Record<string, unknown>)
                : undefined;
            toolCallInfo.set(toolCall.toolCallId, {
              toolName: toolCall.toolName,
              args,
            });
            toolCallStartTimes.set(toolCall.toolCallId, Date.now());

            executionSteps.push({
              step: executionSteps.length + 1,
              action: toolCall.toolName,
              url: typeof args?.url === 'string' ? (args.url as string) : undefined,
              success: false,
            });
            toolCallStepIndex.set(toolCall.toolCallId, executionSteps.length - 1);

            toolExecutionStates.set(toolCall.toolCallId, {
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              state: 'input-available',
              input: args,
              timestamp: Date.now(),
            });
          }
        }

        if (event.toolResults) {
          for (const toolResult of event.toolResults) {
            const info = toolCallInfo.get(toolResult.toolCallId);
            const startedAt = toolCallStartTimes.get(toolResult.toolCallId) ?? startTime;
            const duration = Math.max(0, Date.now() - startedAt);
            const output =
              toolResult.result && typeof toolResult.result === 'object'
                ? (toolResult.result as Record<string, unknown>)
                : undefined;
            const errorText = toolResult.error ? String(toolResult.error) : undefined;
            const success = !toolResult.error && (output?.success !== false);

            const existingState = toolExecutionStates.get(toolResult.toolCallId);
            const toolName = toolResult.toolName || info?.toolName || 'unknown';

            if (existingState) {
              existingState.state = success ? 'output-available' : 'output-error';
              existingState.output = output;
              existingState.errorText = errorText;
              existingState.duration = duration;
            } else {
              toolExecutionStates.set(toolResult.toolCallId, {
                toolCallId: toolResult.toolCallId,
                toolName,
                state: success ? 'output-available' : 'output-error',
                input: info?.args,
                output,
                errorText,
                timestamp: Date.now(),
                duration,
              });
            }

            const stepIndex = toolCallStepIndex.get(toolResult.toolCallId);
            if (typeof stepIndex === 'number' && executionSteps[stepIndex]) {
              const prev = executionSteps[stepIndex];
              const candidateUrl =
                prev.url ||
                (typeof info?.args?.url === 'string' ? (info.args!.url as string) : undefined) ||
                (typeof output?.url === 'string' ? (output.url as string) : undefined) ||
                (typeof output?.pageContext === 'object' && output?.pageContext !== null && typeof (output.pageContext as any).url === 'string'
                  ? ((output.pageContext as any).url as string)
                  : undefined);

              executionSteps[stepIndex] = {
                ...prev,
                url: candidateUrl,
                success,
              };
            }
          }
        }

        updateMessage();
      },
    });

    let fullText = '';
    let chunkCount = 0;
    for await (const chunk of stream.textStream) {
      chunkCount += 1;
      fullText += chunk;
      updateMessage(fullText);
    }

    updateMessage(fullText);

    const usage = await stream.usage.catch(() => undefined);
    const response = await stream.response.catch(() => undefined);

    const toolExecutions = Array.from(toolExecutionStates.values()).map((state) => ({
      tool: state.toolName,
      success: state.state === 'output-available',
      duration: state.duration ?? 0,
    }));

    const toolCallCount = toolExecutions.length;

    const normalizedExecutionSteps =
      executionSteps.length > 0
        ? executionSteps.map((step, index) => ({
            step: index + 1,
            action: step.action,
            url: step.url,
            success: step.success,
          }))
        : (input.execSteps || []).map((step, index) => ({
            step: index + 1,
            action: step.action,
            url: step.url,
            success: !!step.success,
          }));

    const finishReason = lastFinishReason || response?.finishReason || 'stop';
    const duration = Date.now() - startTime;
    const resolvedChunkCount = chunkCount > 0 ? chunkCount : fullText ? 1 : 0;

    const output: StreamingStepOutput = {
      // Avoid generic completion text; leave empty if model produced no content
      fullText: fullText || '',
      textChunkCount: resolvedChunkCount,
      toolCallCount,
      toolExecutions,
      usage: usage
        ? {
            promptTokens:
              (usage as any).promptTokens ??
              usage.inputTokens ??
              0,
            completionTokens:
              (usage as any).completionTokens ??
              usage.outputTokens ??
              0,
            totalTokens:
              usage.totalTokens ??
              ((usage as any).promptTokens ?? usage.inputTokens ?? 0) +
                ((usage as any).completionTokens ?? usage.outputTokens ?? 0),
          }
        : undefined,
      finishReason: String(finishReason),
      duration,
      executionSteps: normalizedExecutionSteps,
    };

    streamingDebug.info('streamText execution completed', {
      fullTextLength: fullText.length,
      toolCallCount,
      chunkCount: resolvedChunkCount,
      finishReason: output.finishReason,
    });

    logEvent('streaming_step_complete', {
      duration,
      tool_call_count: toolCallCount,
      text_length: fullText.length,
      finish_reason: output.finishReason,
    });

    return output;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logEvent('streaming_step_error', {
      duration,
      error_type: error?.name || typeof error,
      error_message: error?.message || String(error),
    });

    streamingDebug.error('Streaming step failed', error);
    throw error;
  } finally {
    stopTimer();
  }
}
