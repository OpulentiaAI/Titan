import { z } from 'zod';

// DSPyground configuration for Evaluator Prompt Optimization
// Optimizes the search result evaluation agent's prompt

export default {
  systemPrompt: `You evaluate initial web+news search results for completeness and craft one optimized query.
Be concise. Return structured JSON only per schema. Aim for speed.

Validated Patterns:
- Completeness scores below 0.8 indicate gaps requiring optimization
- Optimized queries should be actionable for browser automation
- Gaps should identify specific missing information categories
- Reasoning should reflect on result quality and relevance`,

  schema: z.object({
    completeness: z.number().min(0).max(1),
    gaps: z.array(z.string()).max(5).default([]),
    optimized_query: z.string().min(3),
    additional_queries: z.array(z.string()).max(3).optional(),
    reasoning: z.string().max(280).optional(),
  }),

  selectedModel: 'https://build.nvidia.com/minimaxai/minimax-m2/modelcard',
  optimizationModel: 'https://build.nvidia.com/minimaxai/minimax-m2/modelcard',
  reflectionModel: 'https://openrouter.ai/minimax/minimax-m2:free',
  useStructuredOutput: true,
  optimizeStructuredOutput: true,
  batchSize: 3,
  numRollouts: 8,
  selectedMetrics: ['accuracy', 'efficiency', 'clarity'],

  evaluation_instructions: `Evaluate the evaluator agent's response:
- Accuracy: Correctly identifies completeness gaps and relevance issues
- Efficiency: Produces concise, actionable optimized queries quickly
- Clarity: Gaps are specific and actionable, reasoning is clear
- Relevance: Optimized queries improve search result quality`,

  dimensions: [
    {
      name: 'accuracy',
      description: 'Correctly identifies completeness gaps and result quality issues',
      weight: 1.5,
    },
    {
      name: 'efficiency',
      description: 'Produces concise evaluations and optimized queries quickly',
      weight: 1.2,
    },
    {
      name: 'clarity',
      description: 'Gaps are specific and actionable, reasoning is clear',
      weight: 1.3,
    },
    {
      name: 'relevance',
      description: 'Optimized queries improve search result quality and completeness',
      weight: 1.4,
    },
  ],

  positive_feedback_instruction: 'Use positive examples as reference quality for evaluation accuracy and query optimization.',
  negative_feedback_instruction: 'Learn from negative examples to avoid incomplete evaluations or poor query optimization.',

  comparison_positive: 'Compare how well the optimized prompt matches or exceeds evaluation quality.',
  comparison_negative: 'Ensure the optimized prompt avoids incomplete or inaccurate evaluations.',
};

