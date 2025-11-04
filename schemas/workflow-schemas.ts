// Structured input/output schemas for browser automation workflow
// Uses Zod for runtime validation and type safety

import { z } from 'zod';

/**
 * Workflow Input Schema
 * Defines the structured input for the browser automation workflow
 */
export const BrowserAutomationWorkflowInputSchema = z.object({
  userQuery: z.string().min(1, 'User query cannot be empty').max(5000, 'User query too long').describe('The user\'s browser automation request'),
  settings: z.object({
    provider: z.enum(['google', 'gateway', 'nim', 'openrouter'], { errorMap: () => ({ message: 'Provider must be "google", "gateway", "nim", or "openrouter"' }) }),
    apiKey: z.string().min(1, 'API key is required'),
    model: z.string().min(1, 'Model name is required').max(200),
    braintrustApiKey: z.string().min(1).optional(),
    braintrustProjectName: z.string().min(1).max(200).optional(),
    youApiKey: z.string().min(1).optional(),
    computerUseEngine: z.enum(['google', 'gateway', 'gateway-flash-lite', 'openrouter']).optional(),
  }).strict(),
  initialContext: z.object({
    currentUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
    pageContext: z.any().optional(), // PageContext type
  }).optional(),
  metadata: z.object({
    conversationId: z.string().uuid('Invalid conversation ID format').optional(),
    userId: z.string().min(1).max(200).optional(),
    timestamp: z.number().positive('Timestamp must be positive').int().optional(),
  }).optional(),
}).strict();

export type BrowserAutomationWorkflowInput = z.infer<typeof BrowserAutomationWorkflowInputSchema>;

/**
 * Planning Step Output Schema
 */
export const PlanningStepOutputSchema = z.object({
  plan: z.object({
    objective: z.string().min(1, 'Objective cannot be empty').max(1000),
    approach: z.string().min(1, 'Approach cannot be empty').max(2000),
    steps: z.array(z.object({
      step: z.number().int().positive('Step number must be positive'),
      action: z.enum(['navigate', 'click', 'type', 'scroll', 'wait', 'getPageContext'], {
        errorMap: () => ({ message: 'Invalid action type' })
      }),
      target: z.string().min(1, 'Target cannot be empty').max(1000),
      reasoning: z.string().min(1, 'Reasoning cannot be empty').max(2000),
      expectedOutcome: z.string().min(1, 'Expected outcome cannot be empty').max(1000),
      validationCriteria: z.string().max(500).optional(),
      fallbackAction: z.any().optional(),
    })).min(1, 'Plan must have at least one step').max(100, 'Plan cannot exceed 100 steps'),
    criticalPaths: z.array(z.number().int().positive()).max(50, 'Too many critical paths'),
    estimatedSteps: z.number().int().positive().max(1000),
    complexityScore: z.number().min(0, 'Complexity must be >= 0').max(1, 'Complexity must be <= 1'),
    potentialIssues: z.array(z.string().max(500)).max(50, 'Too many potential issues'),
    optimizations: z.array(z.string().max(500)).max(50, 'Too many optimizations'),
  }).strict(),
  optimizedQuery: z.string().max(5000).optional(),
  gaps: z.array(z.string().max(500)).max(20, 'Too many gaps').optional(),
  confidence: z.number().min(0, 'Confidence must be >= 0').max(1, 'Confidence must be <= 1'),
  planningBlock: z.string().min(1, 'Planning block cannot be empty'),
  duration: z.number().nonnegative('Duration cannot be negative'),
  success: z.boolean(),
  error: z.string().max(2000).optional(),
}).strict();

export type PlanningStepOutput = z.infer<typeof PlanningStepOutputSchema>;

/**
 * Page Context Step Output Schema
 */
export const PageContextStepOutputSchema = z.object({
  pageContext: z.object({
    url: z.string().url('Invalid URL format').min(1),
    title: z.string().min(1).max(500),
    text: z.string().max(100000).optional(),
    links: z.array(z.object({
      text: z.string().max(500),
      href: z.string().url('Invalid link URL').max(2000),
    })).max(10000, 'Too many links').optional(),
    forms: z.array(z.any()).max(1000, 'Too many forms').optional(),
    viewport: z.object({
      width: z.number().int().positive('Width must be positive').max(100000),
      height: z.number().int().positive('Height must be positive').max(100000),
    }).optional(),
  }).strict(),
  duration: z.number().nonnegative('Duration cannot be negative'),
  success: z.boolean(),
}).strict();

export type PageContextStepOutput = z.infer<typeof PageContextStepOutputSchema>;

/**
 * Tool Execution Step Output Schema
 */
export const ToolExecutionStepOutputSchema = z.object({
  toolName: z.string(),
  toolArgs: z.record(z.any()),
  result: z.any(),
  success: z.boolean(),
  duration: z.number(),
  enrichedResult: z.object({
    url: z.string().optional(),
    success: z.boolean(),
    pageContext: z.any().optional(),
  }).optional(),
  error: z.string().optional(),
});

export type ToolExecutionStepOutput = z.infer<typeof ToolExecutionStepOutputSchema>;

/**
 * Streaming Step Output Schema
 */
export const StreamingStepOutputSchema = z.object({
  fullText: z.string(),
  textChunkCount: z.number(),
  toolCallCount: z.number(),
  toolExecutions: z.array(z.object({
    tool: z.string(),
    success: z.boolean(),
    duration: z.number(),
  })),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
  finishReason: z.string(),
  duration: z.number(),
  executionSteps: z.array(z.object({
    step: z.number(),
    action: z.string(),
    url: z.string().optional(),
    success: z.boolean(),
  })),
});

export type StreamingStepOutput = z.infer<typeof StreamingStepOutputSchema>;

/**
 * Summarization Step Output Schema
 */
export const SummarizationStepOutputSchema = z.object({
  summary: z.string().min(1, 'Summary cannot be empty').max(50000, 'Summary too long'),
  duration: z.number().nonnegative('Duration cannot be negative'),
  success: z.boolean(),
  // Binary determination of whether the original task/objective was achieved
  taskCompleted: z.boolean().describe('Binary determination if the task was completed successfully'),
  trajectoryLength: z.number().int().nonnegative('Trajectory length cannot be negative').max(100000),
  stepCount: z.number().int().nonnegative('Step count cannot be negative').max(10000),
}).strict();

export type SummarizationStepOutput = z.infer<typeof SummarizationStepOutputSchema>;

/**
 * Workflow Output Schema
 * Complete workflow result with all phases
 */
export const BrowserAutomationWorkflowOutputSchema = z.object({
  success: z.boolean(),
  planning: PlanningStepOutputSchema,
  pageContext: PageContextStepOutputSchema.optional(),
  streaming: StreamingStepOutputSchema,
  summarization: SummarizationStepOutputSchema.optional(),
  executionTrajectory: z.array(z.object({
    step: z.number().int().positive(),
    action: z.string().min(1).max(100),
    url: z.string().url('Invalid trajectory URL').max(2000).optional(),
    success: z.boolean(),
    timestamp: z.number().int().nonnegative('Timestamp cannot be negative'),
  }).strict()).max(10000, 'Trajectory too long'),
  totalDuration: z.number().nonnegative('Total duration cannot be negative'),
  finalUrl: z.string().url('Invalid final URL').max(2000).optional(),
  error: z.string().max(2000).optional(),
  errorAnalysis: z.object({
    recap: z.string().min(1, 'Recap cannot be empty').max(5000),
    blame: z.string().min(1, 'Blame cannot be empty').max(5000),
    improvement: z.string().min(1, 'Improvement cannot be empty').max(5000),
  }).strict().optional(),
  metadata: z.object({
    workflowId: z.string().min(1).max(200).optional(),
    conversationId: z.string().uuid('Invalid conversation ID').max(200).optional(),
    braintrustRunId: z.string().min(1).max(200).optional(),
  }).strict().optional(),
  // Task management functions for UI interaction
  taskManager: z.any().optional(), // TaskManager instance for retry/cancel operations
}).strict();

export type BrowserAutomationWorkflowOutput = z.infer<typeof BrowserAutomationWorkflowOutputSchema>;

/**
 * Workflow Telemetry Schema
 * For Braintrust and observability logging
 */
export const WorkflowTelemetrySchema = z.object({
  workflowId: z.string(),
  phase: z.enum(['planning', 'page_context', 'streaming', 'tool_execution', 'summarization', 'complete', 'error']),
  duration: z.number(),
  success: z.boolean(),
  metrics: z.record(z.any()),
  metadata: z.record(z.any()),
  error: z.string().optional(),
});

export type WorkflowTelemetry = z.infer<typeof WorkflowTelemetrySchema>;
