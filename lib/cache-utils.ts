// Cache utilities using @ai-sdk-tools/cache
// Provides zero-config caching for expensive operations

import { cached } from '@ai-sdk-tools/cache';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Generate a cache key from input parameters
 */
function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const key = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('|');
  return `${prefix}:${key}`;
}

/**
 * Cached execution plan generation tool
 * Caches based on userQuery + context for 1 hour
 */
const generateExecutionPlanTool = tool({
  description: 'Generate a structured execution plan for browser automation tasks',
  parameters: z.object({
    userQuery: z.string(),
    currentUrl: z.string().optional(),
    pageContext: z.any().optional(),
    provider: z.enum(['google', 'gateway']),
    apiKey: z.string(),
    model: z.string().optional(),
  }),
  execute: async (params: {
    userQuery: string;
    currentUrl?: string;
    pageContext?: any;
    provider: 'google' | 'gateway';
    apiKey: string;
    model?: string;
  }) => {
    // Import the actual function to avoid circular dependencies
    const { generateExecutionPlan } = await import('../planner');
    return generateExecutionPlan(
      params.userQuery,
      {
        provider: params.provider,
        apiKey: params.apiKey,
        model: params.model,
      },
      params.currentUrl,
      params.pageContext
    );
  },
});

export const generateExecutionPlanCached = cached(generateExecutionPlanTool, {
  ttl: 3600, // 1 hour cache
  keyGenerator: (params) => generateCacheKey('execution-plan', {
    query: params.userQuery,
    url: params.currentUrl || '',
    contextHash: params.pageContext ? JSON.stringify(params.pageContext).substring(0, 100) : '',
    provider: params.provider,
    model: params.model || 'default',
  }),
});

/**
 * Cached summarization step tool
 * Caches based on objective + trajectory + outcome for 30 minutes
 */
const summarizationStepTool = tool({
  description: 'Summarize execution trajectory and suggest next actions',
  parameters: z.object({
    objective: z.string(),
    trajectory: z.string(),
    outcome: z.string(),
    youApiKey: z.string().optional(),
    fallbackModel: z.any().optional(),
    fallbackApiKey: z.string().optional(),
    enableStreaming: z.boolean().optional(),
    updateLastMessage: z.any().optional(),
    enableFinalization: z.boolean().optional(),
    finalizationProvider: z.enum(['google', 'gateway']).optional(),
    finalizationModel: z.string().optional(),
    knowledgeItems: z.array(z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      url: z.string().optional(),
    })).optional(),
  }),
  execute: async (params: {
    objective: string;
    trajectory: string;
    outcome: string;
    youApiKey?: string;
    fallbackModel?: any;
    fallbackApiKey?: string;
    enableStreaming?: boolean;
    updateLastMessage?: any;
    enableFinalization?: boolean;
    finalizationProvider?: 'google' | 'gateway';
    finalizationModel?: string;
    knowledgeItems?: Array<{ title?: string; content?: string; url?: string }>;
  }) => {
    const { summarizationStep } = await import('../steps/summarization-step');
    return summarizationStep({
      ...params,
      youApiKey: params.youApiKey || '',
      fallbackApiKey: params.fallbackApiKey || '',
    });
  },
});

export const summarizationStepCached = cached(summarizationStepTool, {
  ttl: 1800, // 30 minutes cache
  keyGenerator: (params) => generateCacheKey('summarization', {
    objective: params.objective,
    trajectoryHash: params.trajectory.substring(0, 200),
    outcomeHash: params.outcome.substring(0, 200),
  }),
});

/**
 * Cached execution plan generation with telemetry
 * Caches based on userQuery + context for 1 hour (includes tracing)
 */
const generateExecutionPlanWithTelemetryTool = tool({
  description: 'Generate a structured execution plan with telemetry for browser automation tasks',
  parameters: z.object({
    userQuery: z.string(),
    currentUrl: z.string().optional(),
    pageContext: z.any().optional(),
    provider: z.enum(['google', 'gateway']),
    apiKey: z.string(),
    model: z.string().optional(),
    braintrustApiKey: z.string().optional(),
  }),
  execute: async (params: {
    userQuery: string;
    currentUrl?: string;
    pageContext?: any;
    provider: 'google' | 'gateway';
    apiKey: string;
    model?: string;
    braintrustApiKey?: string;
  }) => {
    // Import the telemetry wrapper function
    const { generateExecutionPlanWithTelemetry } = await import('../planner');
    return generateExecutionPlanWithTelemetry(
      params.userQuery,
      {
        provider: params.provider,
        apiKey: params.apiKey,
        model: params.model,
        braintrustApiKey: params.braintrustApiKey,
      },
      params.currentUrl,
      params.pageContext
    );
  },
});

export const generateExecutionPlanWithTelemetryCached = cached(generateExecutionPlanWithTelemetryTool, {
  ttl: 3600, // 1 hour cache
  keyGenerator: (params) => generateCacheKey('execution-plan-telemetry', {
    query: params.userQuery,
    url: params.currentUrl || '',
    contextHash: params.pageContext ? JSON.stringify(params.pageContext).substring(0, 100) : '',
    provider: params.provider,
    model: params.model || 'default',
    apiKeyHash: params.apiKey ? params.apiKey.substring(0, 8) : 'no-key', // Include API key availability in cache key
  }),
});

/**
 * Clear cache for a specific operation
 */
export async function clearCache(prefix: string): Promise<void> {
  // Implementation depends on cache backend
  // For now, this is a placeholder - actual implementation would use cache.clear()
  console.log(`[Cache] Clearing cache for prefix: ${prefix}`);
}

