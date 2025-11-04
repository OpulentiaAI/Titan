// Dedicated Auto-Recovery Agent
// Builds an adjusted query for a full end-to-end rerun when the task was not completed

import { generateObject } from 'ai';
import { renderAddendum } from './system-addendum';
import { z } from 'zod';

export interface RecoveryAgentInput {
  provider: 'google' | 'gateway' | 'nim' | 'openrouter';
  apiKey: string;
  model: string; // model name; the caller may resolve to a provider-specific model instance
  modelInstance?: any; // optional, if caller already built a model instance
  originalQuery: string;
  summaryMarkdown: string; // summarizer output (includes diagnostics and next steps)
  executionSteps: Array<{ step: number; action: string; url?: string; success: boolean; error?: string }>; // recent steps
  finalUrl?: string;
}

export interface RecoveryAgentOutput {
  adjustedQuery: string;
  rationale: string;
}

/**
 * Builds a refined query and rationale for an automatic retry.
 * The prompt is aligned with the local llms.txt guidelines (AI SDK tool usage, structured outputs).
 */
export async function buildRecoveryQuery(input: RecoveryAgentInput): Promise<RecoveryAgentOutput> {
  const schema = z.object({
    adjustedQuery: z.string().min(1).max(5000),
    rationale: z.string().min(1).max(4000),
  });

  // System prompt designed to: (a) be deterministic, (b) keep context tight, (c) define a bounded loop.
  // Note: The project includes llms.txt with AI SDK guidelines; this agent follows those patterns:
  // - Use concise reasoning
  // - Return structured output via generateObject
  // - Avoid infinite loops; produce a single rerun plan only
  const baseSystem = [
    'ROLE',
    'You are the Auto-Recovery Agent for a browser automation workflow.',
    'Your only job is to propose a single improved query for a full end-to-end rerun when the previous attempt did not complete the task.',
    '',
    'CONSTRAINTS',
    '- Be concise and specific about the exact browsing goal.',
    '- Incorporate concrete learnings from the last run (errors, failing steps, final URL).',
    '- Avoid repeating failing patterns and add clarifying details when necessary.',
    '- Keep guidance site-agnostic: no brittle, hardcoded selectors or assumptions.',
    '- Output structured JSON only (no markdown), matching the provided schema.',
    '- Think silently; do not expose chain-of-thought.',
    '- This is a single retry attempt; do not instruct further retries.',
  ].join('\n');

  const system = [baseSystem, renderAddendum('ADDENDUM')].join('\n\n');

  const user = [
    `Original Query:\n${input.originalQuery}`,
    '',
    'Last Run Summary (Markdown):',
    input.summaryMarkdown,
    '',
    'Recent Execution Steps (most recent last):',
    input.executionSteps.slice(-10).map(s => `- Step ${s.step}: ${s.action}${s.url ? ` @ ${s.url}` : ''} ${s.success ? '✅' : `❌${s.error ? ` - ${s.error}` : ''}`}`).join('\n'),
    '',
    input.finalUrl ? `Final URL: ${input.finalUrl}` : 'Final URL: (unknown)',
    '',
    'Return a refined query that will maximize the chance of completing the original task in one pass.',
  ].join('\n');

  const model = input.modelInstance || input.model;

  const result = await generateObject({
    model,
    system,
    prompt: user,
    schema,
    maxTokens: 400,
    temperature: 0.3,
  });

  return result.object as RecoveryAgentOutput;
}
