// AI SDK 6 Comprehensive Tool Calling Enhancements
// Implements all modern AI SDK 6 features for robust tool execution

import { z } from 'zod';
import { tool, CoreTool, generateText, streamText, LanguageModel } from 'ai';
import type { ToolExecutionOptions } from 'ai';

/**
 * AI SDK 6 Tool Calling Configuration
 * Implements all latest features from AI SDK v6
 */
export interface EnhancedToolConfig {
  // Core configuration
  maxSteps?: number; // Maximum number of tool execution rounds (default: 10)
  maxToolRoundtrips?: number; // Alternative name for maxSteps
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string }; // Force tool usage

  // Advanced features
  experimental_telemetry?: {
    isEnabled?: boolean;
    recordInputs?: boolean;
    recordOutputs?: boolean;
    functionId?: string;
    metadata?: Record<string, string | number | boolean>;
  };

  // Performance
  experimental_continueSteps?: boolean; // Continue after tool calls automatically

  // Callbacks for real-time monitoring
  onStepStart?: (step: ToolExecutionStep) => void | Promise<void>;
  onStepFinish?: (step: ToolExecutionStep) => void | Promise<void>;
  onToolCall?: (toolCall: ToolCallEvent) => void | Promise<void>;
  onToolResult?: (toolResult: ToolResultEvent) => void | Promise<void>;

  // Error handling
  experimental_repairText?: (context: { text: string; error: unknown }) => string | Promise<string>;
  maxRetries?: number; // Number of retries on tool execution failure
  retryDelay?: number; // Delay between retries in ms

  // Validation
  validateToolResults?: boolean; // Validate tool results against schemas
  failOnValidationError?: boolean; // Fail execution if validation fails
}

export interface ToolExecutionStep {
  stepNumber: number;
  toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
  }>;
  results: Array<{
    toolCallId: string;
    result: unknown;
    error?: unknown;
  }>;
  text?: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
  duration?: number;
}

export interface ToolCallEvent {
  toolCallId: string;
  toolName: string;
  args: unknown;
  timestamp: number;
}

export interface ToolResultEvent {
  toolCallId: string;
  toolName: string;
  result: unknown;
  error?: unknown;
  duration: number;
  timestamp: number;
}

/**
 * Enhanced tool wrapper with AI SDK 6 best practices
 * Adds validation, error handling, telemetry, and retry logic
 */
export function createEnhancedTool<TParameters extends z.ZodType, TResult>(
  config: {
    name: string;
    description: string;
    parameters: TParameters;
    execute: (args: z.infer<TParameters>) => Promise<TResult> | TResult;
    // Optional enhancements
    validateInput?: (args: z.infer<TParameters>) => boolean | string; // Return true or error message
    validateOutput?: (result: TResult) => boolean | string;
    onExecute?: (args: z.infer<TParameters>) => void | Promise<void>;
    onSuccess?: (result: TResult, args: z.infer<TParameters>) => void | Promise<void>;
    onError?: (error: unknown, args: z.infer<TParameters>) => void | Promise<void>;
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number; // Execution timeout in ms
  }
): CoreTool {
  return tool({
    description: config.description,
    parameters: config.parameters,
    execute: async (args: z.infer<TParameters>, options?: ToolExecutionOptions) => {
      const startTime = Date.now();
      const maxRetries = config.maxRetries ?? 3;
      const retryDelay = config.retryDelay ?? 1000;

      // Input validation
      if (config.validateInput) {
        const validationResult = config.validateInput(args);
        if (validationResult !== true) {
          const errorMsg = typeof validationResult === 'string'
            ? validationResult
            : 'Input validation failed';
          throw new Error(`[${config.name}] ${errorMsg}`);
        }
      }

      // Execute with retry logic
      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Call onExecute hook
          if (config.onExecute) {
            await config.onExecute(args);
          }

          // Execute with timeout if specified
          let result: TResult;
          if (config.timeout) {
            result = await Promise.race([
              config.execute(args),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Tool execution timeout after ${config.timeout}ms`)), config.timeout)
              ),
            ]);
          } else {
            result = await config.execute(args);
          }

          // Output validation
          if (config.validateOutput) {
            const validationResult = config.validateOutput(result);
            if (validationResult !== true) {
              const errorMsg = typeof validationResult === 'string'
                ? validationResult
                : 'Output validation failed';
              throw new Error(`[${config.name}] ${errorMsg}`);
            }
          }

          // Success hook
          if (config.onSuccess) {
            await config.onSuccess(result, args);
          }

          // Log successful execution
          console.log(`✅ [${config.name}] Executed successfully in ${Date.now() - startTime}ms`);

          return result;
        } catch (error) {
          lastError = error;
          console.error(`❌ [${config.name}] Execution failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);

          // Error hook
          if (config.onError) {
            await config.onError(error, args);
          }

          // Retry if not last attempt
          if (attempt < maxRetries) {
            console.log(`🔄 [${config.name}] Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      // All retries failed
      throw new Error(`[${config.name}] Failed after ${maxRetries + 1} attempts: ${lastError}`);
    },
  });
}

/**
 * Tool execution orchestrator with AI SDK 6 features
 * Manages multi-step tool calling with monitoring and error recovery
 */
export class ToolExecutionOrchestrator {
  private steps: ToolExecutionStep[] = [];
  private config: EnhancedToolConfig;
  private abortController = new AbortController();

  constructor(config: EnhancedToolConfig = {}) {
    this.config = {
      maxSteps: 10,
      toolChoice: 'auto',
      experimental_continueSteps: true,
      validateToolResults: true,
      failOnValidationError: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Execute tools with comprehensive monitoring
   */
  async execute(params: {
    model: LanguageModel;
    system: string;
    messages: Array<{ role: string; content: string }>;
    tools: Record<string, CoreTool>;
  }) {
    const startTime = Date.now();
    let stepNumber = 0;

    try {
      // Use streamText for real-time updates with onStepFinish
      const result = await streamText({
        model: params.model,
        system: params.system,
        messages: params.messages,
        tools: params.tools,
        toolChoice: this.config.toolChoice,
        maxSteps: this.config.maxSteps,
        abortSignal: this.abortController.signal,

        // AI SDK 6 telemetry
        experimental_telemetry: this.config.experimental_telemetry,

        // Real-time step monitoring
        onStepFinish: async (event) => {
          stepNumber++;

          const step: ToolExecutionStep = {
            stepNumber,
            toolCalls: event.toolCalls?.map(tc => ({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
            })) || [],
            results: event.toolResults?.map(tr => ({
              toolCallId: tr.toolCallId,
              result: tr.result,
              error: tr.error,
            })) || [],
            text: event.text,
            finishReason: event.finishReason,
            usage: event.usage,
            timestamp: Date.now(),
          };

          this.steps.push(step);

          // Call user-provided onStepStart hook
          if (this.config.onStepStart) {
            await this.config.onStepStart(step);
          }

          // Emit tool call events
          if (event.toolCalls) {
            for (const toolCall of event.toolCalls) {
              const toolCallEvent: ToolCallEvent = {
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: toolCall.args,
                timestamp: Date.now(),
              };

              if (this.config.onToolCall) {
                await this.config.onToolCall(toolCallEvent);
              }
            }
          }

          // Emit tool result events
          if (event.toolResults) {
            for (const toolResult of event.toolResults) {
              const resultEvent: ToolResultEvent = {
                toolCallId: toolResult.toolCallId,
                toolName: '', // Would need to map from toolCallId
                result: toolResult.result,
                error: toolResult.error,
                duration: 0, // Would need to track
                timestamp: Date.now(),
              };

              if (this.config.onToolResult) {
                await this.config.onToolResult(resultEvent);
              }
            }
          }

          // Call user-provided onStepFinish hook
          if (this.config.onStepFinish) {
            await this.config.onStepFinish(step);
          }

          console.log(`📊 Step ${stepNumber} completed:`, {
            toolCalls: step.toolCalls.length,
            results: step.results.length,
            finishReason: step.finishReason,
          });
        },
      });

      // Collect final result
      let finalText = '';
      for await (const textPart of result.textStream) {
        finalText += textPart;
      }

      const finalUsage = await result.usage;
      const finalResponse = await result.response;

      return {
        text: finalText,
        steps: this.steps,
        usage: finalUsage,
        response: finalResponse,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('❌ Tool execution failed:', error);
      throw error;
    }
  }

  /**
   * Abort ongoing execution
   */
  abort() {
    this.abortController.abort();
  }

  /**
   * Get execution summary
   */
  getSummary() {
    const totalToolCalls = this.steps.reduce((sum, step) => sum + step.toolCalls.length, 0);
    const successfulCalls = this.steps.reduce(
      (sum, step) => sum + step.results.filter(r => !r.error).length,
      0
    );
    const failedCalls = this.steps.reduce(
      (sum, step) => sum + step.results.filter(r => r.error).length,
      0
    );

    return {
      totalSteps: this.steps.length,
      totalToolCalls,
      successfulCalls,
      failedCalls,
      successRate: totalToolCalls > 0 ? successfulCalls / totalToolCalls : 0,
    };
  }
}

/**
 * Common browser automation tools with AI SDK 6 best practices
 */
export const browserAutomationTools = {
  navigate: createEnhancedTool({
    name: 'navigate',
    description: 'Navigate to a URL in the browser',
    parameters: z.object({
      url: z.string().url().describe('The URL to navigate to'),
      waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().describe('Wait until this event'),
    }),
    execute: async ({ url, waitUntil }) => {
      console.log(`🌐 Navigating to ${url}`);
      // Actual implementation would go here
      return { success: true, url, finalUrl: url };
    },
    validateInput: ({ url }) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'URL must start with http:// or https://';
      }
      return true;
    },
    validateOutput: (result) => {
      if (!result.success) {
        return 'Navigation failed';
      }
      return true;
    },
    timeout: 30000, // 30 second timeout
    maxRetries: 2,
  }),

  click: createEnhancedTool({
    name: 'click',
    description: 'Click an element on the page',
    parameters: z.object({
      selector: z.string().min(1).describe('CSS selector or text of element to click'),
      waitForNavigation: z.boolean().optional().default(false).describe('Wait for navigation after click'),
    }),
    execute: async ({ selector, waitForNavigation }) => {
      console.log(`🖱️ Clicking element: ${selector}`);
      // Actual implementation would go here
      return { success: true, selector, clicked: true };
    },
    validateInput: ({ selector }) => {
      if (selector.trim().length === 0) {
        return 'Selector cannot be empty';
      }
      return true;
    },
    timeout: 10000,
  }),

  type: createEnhancedTool({
    name: 'type',
    description: 'Type text into an input field',
    parameters: z.object({
      selector: z.string().min(1).describe('CSS selector of input field'),
      text: z.string().describe('Text to type'),
      delay: z.number().min(0).max(1000).optional().describe('Delay between keystrokes in ms'),
    }),
    execute: async ({ selector, text, delay }) => {
      console.log(`⌨️ Typing into ${selector}: ${text.substring(0, 50)}...`);
      // Actual implementation would go here
      return { success: true, selector, text, typed: text.length };
    },
    timeout: 15000,
  }),

  getPageContext: createEnhancedTool({
    name: 'getPageContext',
    description: 'Get the current page context including title, URL, and visible text',
    parameters: z.object({
      includeLinks: z.boolean().optional().default(true).describe('Include all links on page'),
      includeForms: z.boolean().optional().default(true).describe('Include form elements'),
      maxTextLength: z.number().min(100).max(10000).optional().default(5000).describe('Maximum text length to return'),
    }),
    execute: async ({ includeLinks, includeForms, maxTextLength }) => {
      console.log(`📄 Getting page context`);
      // Actual implementation would go here
      return {
        url: 'https://example.com',
        title: 'Example Page',
        text: 'Page content...',
        links: includeLinks ? [] : undefined,
        forms: includeForms ? [] : undefined,
      };
    },
    timeout: 5000,
  }),

  scroll: createEnhancedTool({
    name: 'scroll',
    description: 'Scroll the page',
    parameters: z.object({
      direction: z.enum(['up', 'down', 'top', 'bottom']).describe('Scroll direction'),
      amount: z.number().min(0).max(10000).optional().describe('Amount to scroll in pixels'),
    }),
    execute: async ({ direction, amount }) => {
      console.log(`📜 Scrolling ${direction}${amount ? ` by ${amount}px` : ''}`);
      // Actual implementation would go here
      return { success: true, direction, scrolledBy: amount || 0 };
    },
  }),

  wait: createEnhancedTool({
    name: 'wait',
    description: 'Wait for a duration or until an element appears',
    parameters: z.object({
      duration: z.number().min(0).max(30000).optional().describe('Duration to wait in milliseconds'),
      selector: z.string().optional().describe('CSS selector to wait for'),
      timeout: z.number().min(0).max(60000).optional().default(30000).describe('Maximum time to wait'),
    }),
    execute: async ({ duration, selector, timeout }) => {
      if (duration) {
        console.log(`⏳ Waiting for ${duration}ms`);
        await new Promise(resolve => setTimeout(resolve, duration));
        return { success: true, waited: duration, type: 'duration' };
      } else if (selector) {
        console.log(`⏳ Waiting for element: ${selector} (timeout: ${timeout}ms)`);
        // Actual implementation would go here
        return { success: true, selector, type: 'element', found: true };
      }
      return { success: false, error: 'Must specify either duration or selector' };
    },
    validateInput: ({ duration, selector }) => {
      if (!duration && !selector) {
        return 'Must specify either duration or selector';
      }
      return true;
    },
  }),
};

/**
 * Create a tool set with all browser automation tools
 */
export function createBrowserAutomationToolSet(customTools?: Record<string, CoreTool>) {
  return {
    ...browserAutomationTools,
    ...customTools,
  };
}

/**
 * Example usage with comprehensive monitoring
 */
export async function executeBrowserTask(params: {
  model: LanguageModel;
  task: string;
  currentUrl?: string;
}) {
  const orchestrator = new ToolExecutionOrchestrator({
    maxSteps: 15,
    toolChoice: 'required',
    experimental_continueSteps: true,

    // Real-time callbacks
    onStepFinish: async (step) => {
      console.log(`✅ Step ${step.stepNumber} finished:`, {
        tools: step.toolCalls.map(tc => tc.toolName),
        results: step.results.length,
        text: step.text?.substring(0, 100),
      });
    },

    onToolCall: async (event) => {
      console.log(`🔧 Tool called: ${event.toolName}`, event.args);
    },

    onToolResult: async (event) => {
      if (event.error) {
        console.error(`❌ Tool error: ${event.toolName}`, event.error);
      } else {
        console.log(`✅ Tool result: ${event.toolName}`, event.result);
      }
    },

    experimental_telemetry: {
      isEnabled: true,
      recordInputs: true,
      recordOutputs: true,
      metadata: {
        task: params.task,
        source: 'browser-automation',
      },
    },
  });

  const systemPrompt = `You are a browser automation agent. Execute the user's task using available tools.

Available tools: navigate, click, type, getPageContext, scroll, wait

CRITICAL Rules:
1. ALWAYS call getPageContext after navigate to see what's on the page
2. Use CSS selectors for click and type
3. Verify actions with getPageContext before proceeding
4. Complete the entire task - don't stop early

Current URL: ${params.currentUrl || 'about:blank'}`;

  const result = await orchestrator.execute({
    model: params.model,
    system: systemPrompt,
    messages: [{ role: 'user', content: params.task }],
    tools: browserAutomationTools,
  });

  console.log('\n📊 Execution Summary:', orchestrator.getSummary());

  return result;
}

export default {
  createEnhancedTool,
  ToolExecutionOrchestrator,
  browserAutomationTools,
  createBrowserAutomationToolSet,
  executeBrowserTask,
};
