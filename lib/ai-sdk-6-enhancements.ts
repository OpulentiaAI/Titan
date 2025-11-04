// AI SDK 6 Enhanced Patterns and Utilities
// Implements latest AI SDK v6 beta patterns for optimal agent performance

import { tool, Output } from 'ai';
import { z } from 'zod';
import type { CoreTool } from 'ai';

/**
 * Tool Approval Utilities
 * AI SDK 6 introduces needsApproval parameter for tools
 * See: https://v6.ai-sdk.dev/docs/ai-sdk-6-beta
 */

export interface ToolApprovalConfig {
  // Static approval - always requires approval
  static?: boolean;

  // Dynamic approval - function to determine if approval is needed based on inputs
  dynamic?: (args: Record<string, any>) => boolean | Promise<boolean>;

  // Approval message to show user
  message?: string | ((args: Record<string, any>) => string);
}

/**
 * Creates a tool with approval flow
 * Example: Navigation to sensitive URLs, data submission forms
 */
export function createToolWithApproval<T extends z.ZodType>(
  config: {
    description: string;
    parameters: T;
    execute: (args: z.infer<T>) => Promise<any>;
    approval: ToolApprovalConfig;
  }
): CoreTool {
  return tool({
    description: config.description,
    parameters: config.parameters,
    execute: config.execute,

    // AI SDK 6 needsApproval parameter
    experimental_needsApproval: async (args: z.infer<T>) => {
      // Check static approval first
      if (config.approval.static) {
        return true;
      }

      // Check dynamic approval
      if (config.approval.dynamic) {
        return await config.approval.dynamic(args as any);
      }

      return false;
    },
  } as any);
}

/**
 * Creates approval policy for sensitive navigation
 * Example: Requires approval for navigating to external domains or sensitive URLs
 */
export function createNavigationApprovalPolicy(options: {
  allowedDomains?: string[];
  blockedDomains?: string[];
  requireApprovalForExternal?: boolean;
}) {
  return (args: { url: string }): boolean => {
    try {
      const targetUrl = new URL(args.url);
      const currentDomain = new URL(window.location.href).hostname;

      // Check blocked domains
      if (options.blockedDomains?.some(domain => targetUrl.hostname.includes(domain))) {
        return true; // Requires approval
      }

      // Check if domain is in allowed list
      if (options.allowedDomains?.length) {
        const isAllowed = options.allowedDomains.some(domain =>
          targetUrl.hostname.includes(domain)
        );
        if (!isAllowed) {
          return true; // Requires approval
        }
      }

      // Check if navigating to external domain
      if (options.requireApprovalForExternal && targetUrl.hostname !== currentDomain) {
        return true; // Requires approval
      }

      return false; // No approval needed
    } catch (error) {
      // Invalid URL, require approval
      return true;
    }
  };
}

/**
 * Creates approval policy for form submissions
 * Example: Requires approval for forms with sensitive fields or large data
 */
export function createFormSubmissionApprovalPolicy(options: {
  sensitiveFields?: string[];
  maxDataSize?: number;
  alwaysRequireApproval?: boolean;
}) {
  return (args: Record<string, any>): boolean => {
    if (options.alwaysRequireApproval) {
      return true;
    }

    // Check for sensitive fields
    if (options.sensitiveFields) {
      const hasSensitiveFields = Object.keys(args).some(key =>
        options.sensitiveFields!.some(field =>
          key.toLowerCase().includes(field.toLowerCase())
        )
      );
      if (hasSensitiveFields) {
        return true;
      }
    }

    // Check data size
    if (options.maxDataSize) {
      const dataSize = JSON.stringify(args).length;
      if (dataSize > options.maxDataSize) {
        return true;
      }
    }

    return false;
  };
}

/**
 * Output Strategies for Structured Data Alongside Tool Calling
 * AI SDK 6 introduces Output.object(), Output.array(), Output.choice()
 * See: https://v6.ai-sdk.dev/docs/ai-sdk-6-beta
 */

/**
 * Creates an execution plan output schema
 * Used alongside tool execution to track plan progress
 */
export const createExecutionPlanOutput = () => {
  return Output.object({
    schema: z.object({
      currentStep: z.number().describe('Current step being executed'),
      totalSteps: z.number().describe('Total number of steps in plan'),
      completedSteps: z.array(z.number()).describe('Steps that have been completed'),
      nextAction: z.string().describe('Description of the next action to take'),
      confidence: z.number().min(0).max(1).describe('Confidence in plan execution (0-1)'),
      blockers: z.array(z.string()).optional().describe('Any blockers preventing progress'),
    }),
    name: 'execution_plan_tracker',
    description: 'Track execution plan progress alongside tool calls',
  });
};

/**
 * Creates a tool execution summary output
 * Used to summarize tool execution results in structured format
 */
export const createToolExecutionSummaryOutput = () => {
  return Output.object({
    schema: z.object({
      toolsExecuted: z.array(z.object({
        name: z.string(),
        success: z.boolean(),
        duration: z.number(),
        outcome: z.string(),
      })),
      overallSuccess: z.boolean(),
      totalDuration: z.number(),
      nextRecommendedAction: z.string().optional(),
      issues: z.array(z.string()).optional(),
    }),
    name: 'tool_execution_summary',
    description: 'Structured summary of tool execution results',
  });
};

/**
 * Creates a page analysis output
 * Used to provide structured analysis of page state
 */
export const createPageAnalysisOutput = () => {
  return Output.object({
    schema: z.object({
      pageReady: z.boolean().describe('Whether page is ready for interaction'),
      mainContent: z.string().describe('Summary of main page content'),
      interactiveElements: z.array(z.object({
        type: z.enum(['button', 'link', 'form', 'input']),
        description: z.string(),
        selector: z.string().optional(),
      })),
      recommendations: z.array(z.string()).describe('Recommended next actions based on page state'),
      blockers: z.array(z.string()).optional().describe('Any issues preventing interaction'),
    }),
    name: 'page_analysis',
    description: 'Structured analysis of current page state',
  });
};

/**
 * Creates a choice output for decision making
 * Used when agent needs to make a decision between options
 */
export const createDecisionOutput = (choices: string[]) => {
  return Output.choice({
    choices,
    name: 'decision',
    description: 'Decision between available options',
  });
};

/**
 * Auto-submit for approval responses
 * AI SDK 6 pattern: lastAssistantMessageIsCompleteWithApprovalResponses
 * See: https://v6.ai-sdk.dev/docs/ai-sdk-6-beta
 */

export function shouldAutoSubmitForApprovals(messages: any[]): boolean {
  if (messages.length === 0) return false;

  const lastMessage = messages[messages.length - 1];

  // Check if last message is from assistant
  if (lastMessage.role !== 'assistant') return false;

  // Check if message has approval responses
  const hasApprovalResponses = lastMessage.toolExecutions?.some(
    (exec: any) => exec.status === 'approval-pending' || exec.state === 'approval-pending'
  );

  if (!hasApprovalResponses) return false;

  // Check if all approvals are resolved
  const allApprovalsResolved = lastMessage.toolExecutions?.every(
    (exec: any) =>
      exec.status !== 'approval-pending' &&
      exec.state !== 'approval-pending'
  );

  return allApprovalsResolved;
}

/**
 * Evaluator-Optimizer Pattern
 * AI SDK 6 workflow pattern for quality control loops
 * See: https://v6.ai-sdk.dev/docs/agents/workflows
 */

export interface EvaluationResult {
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  score: number; // 0-1
  issues: string[];
  recommendations: string[];
  shouldRetry: boolean;
  shouldProceed: boolean;
}

export async function evaluateExecutionQuality(
  executionResult: {
    toolExecutions: any[];
    text: string;
    plan: any;
  },
  evaluationCriteria: {
    requiredTools?: string[];
    minSuccessRate?: number;
    maxErrors?: number;
    textMinLength?: number;
  }
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 1.0;

  // Check tool execution success rate
  const totalTools = executionResult.toolExecutions.length;
  const successfulTools = executionResult.toolExecutions.filter(t => t.success).length;
  const successRate = totalTools > 0 ? successfulTools / totalTools : 0;

  if (evaluationCriteria.minSuccessRate && successRate < evaluationCriteria.minSuccessRate) {
    issues.push(`Tool success rate (${(successRate * 100).toFixed(0)}%) below threshold (${(evaluationCriteria.minSuccessRate * 100).toFixed(0)}%)`);
    recommendations.push('Retry failed tool executions with better error handling');
    score *= 0.7;
  }

  // Check for required tools
  if (evaluationCriteria.requiredTools) {
    const executedToolNames = executionResult.toolExecutions.map(t => t.tool || t.toolName);
    const missingTools = evaluationCriteria.requiredTools.filter(
      tool => !executedToolNames.includes(tool)
    );

    if (missingTools.length > 0) {
      issues.push(`Missing required tools: ${missingTools.join(', ')}`);
      recommendations.push(`Execute missing tools: ${missingTools.join(', ')}`);
      score *= 0.6;
    }
  }

  // Check error count
  const errorCount = executionResult.toolExecutions.filter(t => !t.success).length;
  if (evaluationCriteria.maxErrors && errorCount > evaluationCriteria.maxErrors) {
    issues.push(`Too many errors (${errorCount}), exceeds maximum (${evaluationCriteria.maxErrors})`);
    recommendations.push('Review error patterns and adjust execution strategy');
    score *= 0.5;
  }

  // Check text output quality
  if (evaluationCriteria.textMinLength && executionResult.text.length < evaluationCriteria.textMinLength) {
    issues.push(`Output text too short (${executionResult.text.length} chars, min ${evaluationCriteria.textMinLength})`);
    recommendations.push('Provide more detailed explanation of actions taken');
    score *= 0.8;
  }

  // Determine quality level
  let quality: EvaluationResult['quality'];
  if (score >= 0.9) quality = 'excellent';
  else if (score >= 0.75) quality = 'good';
  else if (score >= 0.6) quality = 'acceptable';
  else quality = 'poor';

  // Determine if should retry or proceed
  const shouldRetry = quality === 'poor' && issues.length > 0;
  const shouldProceed = quality !== 'poor';

  return {
    quality,
    score,
    issues,
    recommendations,
    shouldRetry,
    shouldProceed,
  };
}

/**
 * Sequential Generation Pattern
 * AI SDK 6 pattern for chaining generations
 * See: https://v6.ai-sdk.dev/docs/advanced/sequential-generations
 */

export async function sequentialGeneration<T>(
  steps: Array<{
    name: string;
    generate: (previousResult?: any) => Promise<T>;
    transform?: (result: T) => any;
  }>,
  options?: {
    onStepComplete?: (stepName: string, result: any, stepIndex: number) => void;
    onError?: (stepName: string, error: Error, stepIndex: number) => void;
  }
): Promise<any[]> {
  const results: any[] = [];
  let previousResult: any = undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    try {
      // Generate with previous result as context
      const result = await step.generate(previousResult);

      // Transform if specified
      const transformedResult = step.transform ? step.transform(result) : result;

      results.push(transformedResult);
      previousResult = transformedResult;

      // Callback
      options?.onStepComplete?.(step.name, transformedResult, i);
    } catch (error) {
      options?.onError?.(step.name, error as Error, i);
      throw error;
    }
  }

  return results;
}

/**
 * Reasoning Token Support
 * AI SDK 6 supports reasoning tokens for models like o1, DeepSeek, Gemini 2.5
 */

export interface ReasoningConfig {
  enabled: boolean;
  effort?: 'low' | 'medium' | 'high'; // Percentage of tokens for reasoning
  exclude?: boolean; // Whether to exclude reasoning from response
}

export function createReasoningConfig(
  modelName: string,
  options?: Partial<ReasoningConfig>
): ReasoningConfig {
  // Determine if model supports reasoning
  const supportsReasoning =
    modelName.includes('o1') ||
    modelName.includes('deepseek') ||
    modelName.includes('gemini-2.5') ||
    modelName.includes('gemini-2.5-flash') ||
    modelName.includes('gemini-2.5-pro');

  return {
    enabled: supportsReasoning && (options?.enabled ?? true),
    effort: options?.effort ?? 'medium',
    exclude: options?.exclude ?? false,
  };
}
