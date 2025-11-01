import * as braintrust from 'braintrust';
import type { AtlasResult } from './types.js';
import { extractUrls, countActions } from './utils.js';

export async function atlasScorer(
  props: braintrust.EvalScorerArgs<string, AtlasResult, void>
) {
  const { input, output } = props;
  const scores: braintrust.Score[] = [];

  // Success score (1 if successful, 0 if not)
  scores.push({
    name: 'success',
    score: output.success ? 1 : 0,
  });

  // Efficiency score (fewer steps = better, normalized to 0-1)
  const maxSteps = 30;
  const efficiencyScore = output.success
    ? Math.max(0, 1 - output.steps / maxSteps)
    : 0;
  scores.push({
    name: 'efficiency',
    score: efficiencyScore,
  });

  // URL correctness (if expected URL is provided)
  const extractedUrls = extractUrls(input);
  if (extractedUrls.length > 0) {
    const expectedUrl = extractedUrls[0];
    const urlMatch = output.finalUrl
      ? output.finalUrl.includes(expectedUrl.replace('https://', '').replace('http://', ''))
      : false;
    scores.push({
      name: 'url_correctness',
      score: urlMatch ? 1 : 0,
    });
  }

  // Action execution score (higher = better, but penalize excessive steps)
  const actionCount = countActions(output.messages.map(m => m.content).join(' '));
  const actionScore = output.success
    ? Math.max(0, 1 - Math.max(0, actionCount - 5) / 20) // Prefer 5-25 actions
    : 0;
  scores.push({
    name: 'action_execution',
    score: actionScore,
  });

  // Token efficiency (lower token usage = better)
  const tokenScore = output.usage.totalTokens > 0
    ? Math.max(0, 1 - output.usage.totalTokens / 100000) // Normalize to 100k tokens
    : 0;
  scores.push({
    name: 'token_efficiency',
    score: tokenScore,
  });

  // Composite score (weighted average)
  const compositeScore =
    (output.success ? 0.4 : 0) +
    efficiencyScore * 0.2 +
    (scores.find(s => s.name === 'url_correctness')?.score || 0) * 0.1 +
    actionScore * 0.15 +
    tokenScore * 0.15;

  scores.push({
    name: 'composite',
    score: compositeScore,
  });

  return scores;
}

