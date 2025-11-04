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
        onInputStart: () => {
          streamingDebug.debug('navigate.onInputStart');
        },
        onInputDelta: ({ inputTextDelta }) => {
          if (inputTextDelta?.trim()) streamingDebug.debug('navigate.onInputDelta', { delta: inputTextDelta.slice(0, 200) });
        },
        onInputAvailable: ({ input }) => {
          streamingDebug.debug('navigate.onInputAvailable', { input });
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
        onInputStart: () => {
          streamingDebug.debug('getPageContext.onInputStart');
        },
        onInputDelta: ({ inputTextDelta }) => {
          if (inputTextDelta?.trim()) streamingDebug.debug('getPageContext.onInputDelta', { delta: inputTextDelta.slice(0, 200) });
        },
        onInputAvailable: ({ input }) => {
          streamingDebug.debug('getPageContext.onInputAvailable', { input });
        },
      });
    }

    // Guarantee core browser tools are always present to avoid capability loss
    if (!streamingTools.click) {
      streamingTools.click = tool({
        description: 'Click an element on the page by selector or coordinates',
        inputSchema: z.object({
          selector: z.string().optional(),
          x: z.number().optional(),
          y: z.number().optional(),
        }),
        execute: async ({ selector, x, y }) => input.executeTool('click', { selector, x, y }),
        onInputStart: () => streamingDebug.debug('click.onInputStart'),
        onInputAvailable: ({ input }) => streamingDebug.debug('click.onInputAvailable', { input }),
      });
    }

    if (!streamingTools.type) {
      streamingTools.type = tool({
        description: 'Type text into the focused element or selector',
        inputSchema: z.object({
          selector: z.string().optional(),
          text: z.string(),
          submit: z.boolean().optional(),
        }),
        execute: async ({ selector, text, submit }) => input.executeTool('type', { selector, text, submit }),
        onInputStart: () => streamingDebug.debug('type.onInputStart'),
        onInputAvailable: ({ input }) => streamingDebug.debug('type.onInputAvailable', { input }),
      });
    }

    if (!streamingTools.pressKey) {
      streamingTools.pressKey = tool({
        description: 'Press a keyboard key (e.g., Enter)',
        inputSchema: z.object({ key: z.string() }),
        execute: async ({ key }) => input.executeTool('pressKey', { key }),
        onInputStart: () => streamingDebug.debug('pressKey.onInputStart'),
        onInputAvailable: ({ input }) => streamingDebug.debug('pressKey.onInputAvailable', { input }),
      });
    }

    if (!streamingTools.scroll) {
      streamingTools.scroll = tool({
        description: 'Scroll the page by pixels or to top/bottom',
        inputSchema: z.object({
          direction: z.enum(['up', 'down']).optional(),
          px: z.number().optional(),
        }),
        execute: async ({ direction, px }) => input.executeTool('scroll', { direction, px }),
        onInputStart: () => streamingDebug.debug('scroll.onInputStart'),
        onInputAvailable: ({ input }) => streamingDebug.debug('scroll.onInputAvailable', { input }),
      });
    }

    if (!streamingTools.wait) {
      streamingTools.wait = tool({
        description: 'Wait for a number of milliseconds',
        inputSchema: z.object({ milliseconds: z.number().min(0).default(1000) }),
        execute: async ({ milliseconds }) => input.executeTool('wait', { milliseconds }),
        onInputStart: () => streamingDebug.debug('wait.onInputStart'),
        onInputAvailable: ({ input }) => streamingDebug.debug('wait.onInputAvailable', { input }),
      });
    }

    if (!streamingTools.screenshot) {
      streamingTools.screenshot = tool({
        description: 'Capture a screenshot of the current page',
        inputSchema: z.object({}),
        execute: async () => input.executeTool('screenshot', {}),
        onInputStart: () => streamingDebug.debug('screenshot.onInputStart'),
        onInputAvailable: () => streamingDebug.debug('screenshot.onInputAvailable'),
      });
    }

    if (!streamingTools.getBrowserHistory) {
      streamingTools.getBrowserHistory = tool({
        description: 'Retrieve recent browser history for context',
        inputSchema: z.object({ limit: z.number().optional() }),
        execute: async ({ limit }) => input.executeTool('getBrowserHistory', { limit }),
      });
    }

    if (!streamingTools.keyCombo) {
      streamingTools.keyCombo = tool({
        description: 'Press a combination of keys (e.g., Ctrl+L)',
        inputSchema: z.object({ combo: z.string() }),
        execute: async ({ combo }) => input.executeTool('keyCombo', { combo }),
      });
    }

    if (!streamingTools.dragDrop) {
      streamingTools.dragDrop = tool({
        description: 'Drag an element from one selector to another',
        inputSchema: z.object({ from: z.string(), to: z.string() }),
        execute: async ({ from, to }) => input.executeTool('dragDrop', { from, to }),
      });
    }

    // Task management and reflection tools inspired by Capy.ai primitives
    if (!streamingTools.todo) {
      streamingTools.todo = tool({
        description: 'Create or update task list with statuses for better orchestration visibility',
        inputSchema: z.object({
          tasks: z
            .array(
              z.object({
                id: z.string().min(1),
                title: z.string().min(1),
                status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
                description: z.string().optional(),
              })
            )
            .min(1),
          request_user_approval: z.boolean().optional().default(false),
        }),
        execute: async ({ tasks, request_user_approval }) => {
          // Apply single in_progress rule and merge into last assistant message
          const normalized = [...tasks];
          const inProgressCount = normalized.filter(t => t.status === 'in_progress').length;
          if (inProgressCount > 1) {
            // Keep the first as in_progress, demote the rest to pending
            let kept = false;
            for (const t of normalized) {
              if (t.status === 'in_progress') {
                if (!kept) kept = true; else t.status = 'pending';
              }
            }
          }

          input.updateLastMessage((msg) => {
            if (msg.role !== 'assistant') return msg;
            const existing = Array.isArray(msg.workflowTasks) ? msg.workflowTasks : [];
            const byId = new Map(existing.map((t: any) => [t.id, t]));
            for (const t of normalized) {
              if (byId.has(t.id)) {
                const prev = byId.get(t.id);
                byId.set(t.id, { ...prev, ...t });
              } else {
                byId.set(t.id, t);
              }
            }
            const merged = Array.from(byId.values());
            return {
              ...msg,
              workflowTasks: merged,
              metadata: {
                ...msg.metadata,
                requiresApproval: !!request_user_approval,
                lastTodoUpdate: Date.now(),
              },
            } as any;
          });

          streamingDebug.info('todo tool updated tasks', { count: tasks.length, request_user_approval });
          return {
            todo_created: true,
            tasks_count: tasks.length,
            requires_approval: !!request_user_approval,
          };
        },
      });
    }

    if (!streamingTools.message_update) {
      streamingTools.message_update = tool({
        description: 'Send a concise live status update to the user (1-5 sentences).',
        inputSchema: z.object({
          message: z.string().min(1),
          status: z.string().min(5).max(80),
          status_emoji: z.string().min(1).max(4),
        }),
        execute: async ({ message, status, status_emoji }) => {
          input.updateLastMessage((msg) => {
            if (msg.role !== 'assistant') return msg;
            const statusLine = `> ${status_emoji} ${status}`;
            const block = `\n\n${statusLine}\n${message}`;
            return {
              ...msg,
              content: typeof msg.content === 'string' ? (msg.content + block) : block,
              metadata: { ...msg.metadata, lastStatus: status, lastStatusEmoji: status_emoji, lastStatusAt: Date.now() },
            } as any;
          });
          streamingDebug.info('message_update tool appended status');
          return { success: true };
        },
      });
    }

    const streamingMessageId = `streaming-${Date.now()}`;
    streamingDebug.info('Streaming step toolset ready', {
      toolsAvailable: Object.keys(streamingTools),
    });
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

    // We no longer restrict activeTools. All base tools remain available every step.

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
      prepareStep: async ({ stepNumber }) => {
        // Only guide the first step to verify context; do not restrict tool availability
        const actions = input.execSteps.map((s) => s.action.split(':')[0]);
        const lastNavIdx = actions.lastIndexOf('navigate');
        const hasContextAfterNav = lastNavIdx >= 0 && actions.slice(lastNavIdx + 1).includes('getPageContext');
        if (stepNumber === 0 && !hasContextAfterNav) {
          return { toolChoice: { type: 'tool', toolName: 'getPageContext' } } as any;
        }
        return {} as any;
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
