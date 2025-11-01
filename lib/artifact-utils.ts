// Artifacts integration for type-safe structured streaming
// Replaces custom JSON parsing with battle-tested artifacts system

import { artifact } from '@ai-sdk-tools/artifacts';
import { z } from 'zod';
import type { PlanningStepOutput } from '../schemas/workflow-schemas';

/**
 * Execution plan artifact definition
 * Provides type-safe streaming for planning results
 */
export const ExecutionPlanArtifact = artifact<PlanningStepOutput>('execution-plan', z.object({
  plan: z.object({
    objective: z.string(),
    approach: z.string(),
    steps: z.array(z.object({
      step: z.number(),
      action: z.enum(['navigate', 'click', 'type', 'scroll', 'wait', 'getPageContext']),
      target: z.string(),
      reasoning: z.string(),
      expectedOutcome: z.string(),
      validationCriteria: z.string().optional(),
      fallbackAction: z.any().optional(),
    })),
    criticalPaths: z.array(z.number()),
    estimatedSteps: z.number(),
    complexityScore: z.number(),
    potentialIssues: z.array(z.string()),
    optimizations: z.array(z.string()),
  }),
  confidence: z.number(),
  planningTime: z.number(),
}));

/**
 * Generate execution plan with artifact streaming
 * Returns an artifact stream that can be consumed by React components
 */
export async function* streamExecutionPlan(params: {
  userQuery: string;
  currentUrl?: string;
  pageContext?: any;
  model: any;
  systemPrompt: string;
  userPrompt: string;
}): AsyncGenerator<PlanningStepOutput, void, unknown> {
  // Import the actual planning function
  const { generateExecutionPlan } = await import('../planner');

  // Generate the plan
  const result = await generateExecutionPlan(
    params.userQuery,
    {
      provider: params.model?.provider || 'google',
      apiKey: params.model?.apiKey || '',
      model: params.model?.modelName,
    },
    params.currentUrl,
    params.pageContext
  );

  // Yield the complete result (artifacts handle streaming internally)
  yield result as PlanningStepOutput;
}

/**
 * Create artifact tool for structured outputs
 * Can be used in streamingStep to emit structured data
 */
export function createArtifactTool<T>(name: string, schema: any) {
  return {
    name,
    description: `Stream structured ${name} data as an artifact`,
    parameters: schema,
    execute: async (params: T) => {
      // Return artifact-compatible format
      return {
        type: 'artifact',
        name,
        data: params,
      };
    },
  };
}

