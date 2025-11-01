/**
 * Comprehensive Braintrust Evaluation for Opulent Browser Extension
 * 
 * This eval demonstrates:
 * - Multiple scoring functions (success, efficiency, quality, LLM-based)
 * - Custom metrics (steps, duration, tokens, planning confidence)
 * - Detailed tracing with nested spans
 * - Conditional scoring based on test case type
 * - Trials for variance analysis
 * - Rich metadata tracking
 * - Custom reporter for CI/CD integration
 * - Error handling with fallback scores
 */

import { Eval, traced, currentSpan, Reporter } from 'braintrust';
import { atlasTask } from './atlasTask.js';
import type { AtlasModel, AtlasSettings, AtlasResult } from './types.js';
import { extractUrls, countActions } from './utils.js';

// Optional autoevals imports with graceful fallback
let Factuality: any = null;
let ClosedQA: any = null;

// Load autoevals if available (async loading)
(async () => {
  try {
    const autoevals = await import('autoevals');
    Factuality = autoevals.Factuality;
    ClosedQA = autoevals.ClosedQA;
  } catch (error) {
    // Will use fallbacks in scorers
  }
})();

const ATLAS_PROJECT = 'opulent-browser';

/**
 * Comprehensive test dataset with rich metadata
 */
function getEvaluationDataset() {
  return [
    {
      input: 'Navigate to https://example.com',
      expected: {
        url: 'https://example.com',
        success: true,
        maxSteps: 5,
        categories: ['navigation', 'simple'],
      },
      metadata: {
        difficulty: 'easy',
        expectedActions: ['navigate', 'wait'],
        requiresInteraction: false,
        timeout: 30000,
      },
      tags: ['navigation', 'basic', 'smoke'],
    },
    {
      input: 'Go to google.com and search for "test automation"',
      expected: {
        url: 'https://www.google.com',
        contains: 'test automation',
        success: true,
        maxSteps: 15,
        categories: ['navigation', 'search', 'interaction'],
      },
      metadata: {
        difficulty: 'medium',
        expectedActions: ['navigate', 'type', 'press', 'wait'],
        requiresInteraction: true,
        timeout: 45000,
      },
      tags: ['search', 'interaction', 'integration'],
    },
    {
      input: 'Open https://github.com and scroll down to see more repositories',
      expected: {
        url: 'https://github.com',
        success: true,
        maxSteps: 10,
        categories: ['navigation', 'scrolling'],
      },
      metadata: {
        difficulty: 'medium',
        expectedActions: ['navigate', 'scroll', 'wait'],
        requiresInteraction: true,
        timeout: 40000,
      },
      tags: ['scrolling', 'interaction'],
    },
    {
      input: 'Navigate to https://wikipedia.org and search for "artificial intelligence"',
      expected: {
        url: 'https://www.wikipedia.org',
        contains: 'artificial intelligence',
        success: true,
        maxSteps: 20,
        categories: ['navigation', 'search', 'complex'],
      },
      metadata: {
        difficulty: 'hard',
        expectedActions: ['navigate', 'type', 'press', 'wait'],
        requiresInteraction: true,
        timeout: 60000,
      },
      tags: ['search', 'complex', 'wikipedia'],
    },
    {
      input: 'Go to https://example.com and click on any link',
      expected: {
        url: 'https://example.com',
        success: true,
        maxSteps: 8,
        categories: ['navigation', 'clicking'],
      },
      metadata: {
        difficulty: 'medium',
        expectedActions: ['navigate', 'getPageContext', 'click', 'wait'],
        requiresInteraction: true,
        timeout: 35000,
      },
      tags: ['clicking', 'interaction'],
    },
    {
      input: 'Open https://reddit.com, scroll down, and look for posts about technology',
      expected: {
        url: 'https://www.reddit.com',
        success: true,
        maxSteps: 25,
        categories: ['navigation', 'scrolling', 'complex'],
      },
      metadata: {
        difficulty: 'hard',
        expectedActions: ['navigate', 'scroll', 'wait', 'getPageContext'],
        requiresInteraction: true,
        timeout: 90000,
      },
      tags: ['complex', 'scrolling', 'real-world'],
    },
  ];
}

/**
 * Enhanced task function with detailed tracing
 */
async function executeBrowserTask(
  input: string,
  model: AtlasModel,
  settings: AtlasSettings,
  hooks: { metadata: Record<string, any> }
): Promise<AtlasResult> {
  return traced(
    async (span) => {
      // Log initial input
      span.log({
        input: {
          query: input,
          model: model.name,
          provider: model.provider,
          engine: model.computerUseEngine,
        },
        metadata: {
          timestamp: Date.now(),
          environment: process.env.ENVIRONMENT || 'test',
        },
      });

      // Update hooks metadata
      hooks.metadata.taskStarted = Date.now();
      hooks.metadata.model = model.name;
      hooks.metadata.engine = model.computerUseEngine;

      try {
        // Execute browser automation with nested tracing
        const result = await traced(
          async (taskSpan) => {
            const startTime = Date.now();
            
            taskSpan.log({
              input: { query: input },
              metadata: { phase: 'execution_start' },
            });

            const taskResult = await atlasTask(model, settings, input);
            const duration = Date.now() - startTime;

            // Log execution metrics
            taskSpan.log({
              output: {
                success: taskResult.success,
                steps: taskResult.steps,
                finalUrl: taskResult.finalUrl,
              },
              metrics: {
                execution_duration_ms: duration,
                steps_executed: taskResult.steps,
                token_usage: taskResult.usage.totalTokens,
                prompt_tokens: taskResult.usage.promptTokens,
                completion_tokens: taskResult.usage.completionTokens,
              },
              metadata: {
                phase: 'execution_complete',
                hasError: !!taskResult.error,
                hasScreenshot: !!taskResult.screenshot,
              },
            });

            return taskResult;
          },
          { name: 'browser_automation_execution' }
        );

        // Log final result with planning metrics
        span.log({
          output: result,
          metrics: {
            total_duration_ms: result.executionTime,
            success: result.success ? 1 : 0,
            steps: result.steps,
            token_efficiency: result.usage.totalTokens > 0 
              ? result.steps / result.usage.totalTokens 
              : 0,
          },
          metadata: {
            finalUrl: result.finalUrl,
            hasMessages: result.messages.length > 0,
            errorOccurred: !!result.error,
          },
        });

        hooks.metadata.taskCompleted = Date.now();
        hooks.metadata.success = result.success;
        hooks.metadata.finalSteps = result.steps;

        return result;
      } catch (error: any) {
        // Log error with context
        span.log({
          output: {
            success: false,
            error: error.message,
          },
          metadata: {
            errorType: error.constructor.name,
            errorStack: error.stack,
            phase: 'error',
          },
        });

        hooks.metadata.taskFailed = true;
        hooks.metadata.error = error.message;

        // Return fallback result
        return {
          success: false,
          steps: 0,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          executionTime: 0,
          error: error.message,
          messages: [],
        };
      }
    },
    {
      name: 'atlas_browser_task',
      metadata: {
        model: model.name,
        provider: model.provider,
        engine: model.computerUseEngine,
      },
    }
  );
}

/**
 * Success Scorer - Binary success/failure
 */
function successScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: { success: boolean };
}) {
  const score = args.output.success ? 1 : 0;
  
  return {
    name: 'success',
    score,
    metadata: {
      success: args.output.success,
      error: args.output.error || null,
      steps: args.output.steps,
    },
  };
}

/**
 * Efficiency Scorer - Reward fewer steps for successful tasks
 */
function efficiencyScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: { maxSteps: number };
}) {
  if (!args.output.success) {
    return {
      name: 'efficiency',
      score: 0,
      metadata: { reason: 'task_failed' },
    };
  }

  const maxSteps = args.expected?.maxSteps || 30;
  const stepEfficiency = Math.max(0, 1 - args.output.steps / maxSteps);
  
  // Also consider token efficiency
  const tokenEfficiency = args.output.usage.totalTokens > 0
    ? Math.max(0, 1 - args.output.usage.totalTokens / 50000)
    : 0;

  const efficiency = (stepEfficiency * 0.7 + tokenEfficiency * 0.3);

  return {
    name: 'efficiency',
    score: efficiency,
    metadata: {
      stepEfficiency,
      tokenEfficiency,
      steps: args.output.steps,
      tokens: args.output.usage.totalTokens,
    },
  };
}

/**
 * URL Correctness Scorer - Verify final URL matches expected
 */
function urlCorrectnessScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: { url: string };
}) {
  if (!args.expected?.url || !args.output.finalUrl) {
    return null; // Skip if no expected URL
  }

  const expectedDomain = args.expected.url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  
  const actualDomain = args.output.finalUrl
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  const score = expectedDomain === actualDomain ? 1 : 0;

  return {
    name: 'url_correctness',
    score,
    metadata: {
      expectedDomain,
      actualDomain,
      expectedUrl: args.expected.url,
      actualUrl: args.output.finalUrl,
    },
  };
}

/**
 * Content Match Scorer - LLM-based content verification
 */
async function contentMatchScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: { contains?: string };
}) {
  if (!args.expected?.contains) {
    return null; // Skip if no expected content
  }

  const messages = args.output.messages.map(m => m.content).join(' ');
  const containsExpected = messages.toLowerCase().includes(
    args.expected.contains.toLowerCase()
  );

  // Use ClosedQA for semantic verification if available
  // Try to load it dynamically if not already loaded
  if (!ClosedQA) {
    try {
      const autoevals = await import('autoevals');
      ClosedQA = autoevals.ClosedQA;
    } catch {
      // Fallback below
    }
  }

  if (ClosedQA) {
    try {
      const closedQAResult = await ClosedQA({
        input: args.input,
        output: messages,
        criteria: `Does the output mention or contain information about "${args.expected.contains}"?`,
      });

      return {
        name: 'content_match',
        score: containsExpected ? 1 : closedQAResult.score,
        metadata: {
          exactMatch: containsExpected,
          semanticScore: closedQAResult.score,
          expectedContent: args.expected.contains,
          usedLLM: !containsExpected,
        },
      };
    } catch (error) {
      // Fallback to exact match if ClosedQA fails
    }
  }
  
  // Fallback to exact match
  return {
    name: 'content_match',
    score: containsExpected ? 1 : 0,
    metadata: {
      exactMatch: containsExpected,
      expectedContent: args.expected.contains,
      llmAvailable: !!ClosedQA,
    },
  };
}

/**
 * Quality Scorer - Assess overall execution quality
 */
function qualityScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: { categories: string[] };
}) {
  if (!args.output.success) {
    return {
      name: 'quality',
      score: 0,
      metadata: { reason: 'task_failed' },
    };
  }

  let qualityScore = 0.5; // Base score

  // Reward appropriate step count
  const optimalSteps = args.output.steps >= 2 && args.output.steps <= 15;
  if (optimalSteps) qualityScore += 0.2;

  // Reward URL correctness
  if (args.output.finalUrl) qualityScore += 0.15;

  // Reward message completion
  if (args.output.messages.length >= 2) qualityScore += 0.1;

  // Penalize excessive token usage
  if (args.output.usage.totalTokens > 50000) {
    qualityScore -= 0.1;
  }

  // Reward reasonable execution time
  const executionTimeMinutes = args.output.executionTime / 60000;
  if (executionTimeMinutes < 2) qualityScore += 0.05;

  return {
    name: 'quality',
    score: Math.max(0, Math.min(1, qualityScore)),
    metadata: {
      steps: args.output.steps,
      hasFinalUrl: !!args.output.finalUrl,
      messageCount: args.output.messages.length,
      tokenUsage: args.output.usage.totalTokens,
      executionTimeMinutes: executionTimeMinutes.toFixed(2),
    },
  };
}

/**
 * Factuality Scorer - Use autoevals Factuality for assistant messages
 */
async function factualityScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: { contains?: string };
}) {
  if (!args.output.success || args.output.messages.length === 0) {
    return null; // Skip if task failed or no messages
  }

  const assistantMessages = args.output.messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content)
    .join('\n');

  if (!assistantMessages) {
    return null;
  }

  // Try to load Factuality if not already loaded
  if (!Factuality) {
    try {
      const autoevals = await import('autoevals');
      Factuality = autoevals.Factuality;
    } catch {
      // Fallback below
    }
  }

  if (!Factuality) {
    // Return neutral score if Factuality not available
    return {
      name: 'factuality',
      score: 0.5,
      metadata: {
        fallback: true,
        reason: 'autoevals not available',
        assistantMessageLength: assistantMessages.length,
      },
    };
  }

  try {
    const factualityResult = await Factuality({
      input: args.input,
      output: assistantMessages,
      expected: args.expected?.contains || 'The task should be completed successfully.',
    });

    return {
      name: 'factuality',
      score: factualityResult.score,
      metadata: {
        reasoning: factualityResult.reasoning,
        assistantMessageLength: assistantMessages.length,
      },
    };
  } catch (error) {
    // Return neutral score if factuality check fails
    return {
      name: 'factuality',
      score: 0.5,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        fallback: true,
        assistantMessageLength: assistantMessages.length,
      },
    };
  }
}

/**
 * Conditional Action Scorer - Score based on test case category
 */
function actionExecutionScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: { categories: string[] };
  metadata?: { expectedActions?: string[] };
}) {
  if (!args.output.success) {
    return null;
  }

  const messageText = args.output.messages.map(m => m.content).join(' ');
  const expectedActions = args.metadata?.expectedActions || [];
  
  if (expectedActions.length === 0) {
    return null; // Skip if no expected actions
  }

  let matchedActions = 0;
  for (const action of expectedActions) {
    if (messageText.toLowerCase().includes(action.toLowerCase())) {
      matchedActions++;
    }
  }

  const score = matchedActions / expectedActions.length;

  return {
    name: 'action_execution',
    score,
    metadata: {
      matchedActions,
      totalExpected: expectedActions.length,
      expectedActions,
    },
  };
}

/**
 * Composite Scorer - Weighted combination based on output quality
 * Note: In Braintrust, scorers don't have access to other scorers' results.
 * Instead, we compute a composite score from the output directly.
 */
function compositeScorer(args: {
  input: string;
  output: AtlasResult;
  expected?: any;
}) {
  if (!args.output.success) {
    return {
      name: 'composite',
      score: 0,
      metadata: { reason: 'task_failed' },
    };
  }

  // Calculate individual components
  const successScore = args.output.success ? 1 : 0;
  
  // Efficiency (steps and tokens)
  const maxSteps = args.expected?.maxSteps || 30;
  const stepEfficiency = Math.max(0, 1 - args.output.steps / maxSteps);
  const tokenEfficiency = args.output.usage.totalTokens > 0
    ? Math.max(0, 1 - args.output.usage.totalTokens / 50000)
    : 0;
  const efficiencyScore = stepEfficiency * 0.7 + tokenEfficiency * 0.3;
  
  // URL correctness
  const expectedUrl = args.expected?.url;
  let urlScore = 0.5; // Neutral if no expected URL
  if (expectedUrl && args.output.finalUrl) {
    const expectedDomain = expectedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const actualDomain = args.output.finalUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    urlScore = expectedDomain === actualDomain ? 1 : 0;
  }
  
  // Quality (step count, execution time, messages)
  let qualityScore = 0.5;
  if (args.output.steps >= 2 && args.output.steps <= 15) qualityScore += 0.2;
  if (args.output.finalUrl) qualityScore += 0.15;
  if (args.output.messages.length >= 2) qualityScore += 0.1;
  qualityScore = Math.max(0, Math.min(1, qualityScore));

  // Weighted combination
  const weights: Record<string, number> = {
    success: 0.35,
    efficiency: 0.20,
    url_correctness: 0.15,
    quality: 0.30,
  };

  const compositeScore =
    successScore * weights.success +
    efficiencyScore * weights.efficiency +
    urlScore * weights.url_correctness +
    qualityScore * weights.quality;

  return {
    name: 'composite',
    score: Math.max(0, Math.min(1, compositeScore)),
    metadata: {
      components: {
        success: successScore,
        efficiency: efficiencyScore,
        url_correctness: urlScore,
        quality: qualityScore,
      },
    },
  };
}

/**
 * Custom Reporter for CI/CD integration
 */
Reporter('Opulent Browser CI Reporter', {
  reportEval: async (evaluator, result, opts) => {
    const { results, summary } = result;
    
    // Calculate summary statistics
    const totalTests = results.length;
    const successfulTests = results.filter((r: any) => r.output?.success).length;
    const avgCompositeScore = summary.scores?.composite?.score || 0;
    const avgSuccessRate = summary.scores?.success?.score || 0;
    const avgEfficiency = summary.scores?.efficiency?.score || 0;

    // Find failures - check for errors or low composite scores
    const failures = results.filter((r: any) => {
      if (r.error) return true;
      if (!r.output?.success) return true;
      // Check if composite score exists and is below threshold
      const compositeScore = r.scores?.composite?.score;
      if (compositeScore !== undefined && compositeScore < 0.5) return true;
      return false;
    });

    // Log summary
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Opulent Browser Evaluation Summary  ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful: ${successfulTests}/${totalTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failures.length}/${totalTests}`);
    console.log(`\nAverage Scores:`);
    console.log(`  Composite: ${(avgCompositeScore * 100).toFixed(1)}%`);
    console.log(`  Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`);
    console.log(`  Efficiency: ${(avgEfficiency * 100).toFixed(1)}%`);

    if (failures.length > 0) {
      console.log(`\n⚠️  Failures Detected:`);
      failures.forEach((f: any, idx: number) => {
        const input = typeof f.input === 'string' ? f.input : f.input?.input || JSON.stringify(f.input).substring(0, 50);
        console.log(`  ${idx + 1}. ${input.substring(0, 50)}...`);
        if (f.error) {
          console.log(`     Error: ${f.error}`);
        } else if (!f.output?.success) {
          console.log(`     Task Failed: ${f.output?.error || 'Unknown error'}`);
        } else {
          const compositeScore = f.scores?.composite?.score;
          if (compositeScore !== undefined) {
            console.log(`     Composite Score: ${(compositeScore * 100).toFixed(1)}% (below 50% threshold)`);
          }
        }
      });
    }

    // Log detailed metrics
    const avgDuration = summary.metrics?.total_duration_ms?.mean || 0;
    const avgSteps = summary.metrics?.steps?.mean || 0;
    const avgTokens = summary.metrics?.token_usage?.mean || 0;

    console.log(`\nPerformance Metrics:`);
    console.log(`  Avg Duration: ${(avgDuration / 1000).toFixed(1)}s`);
    console.log(`  Avg Steps: ${avgSteps.toFixed(1)}`);
    console.log(`  Avg Tokens: ${avgTokens.toFixed(0)}`);

    // Return pass/fail for CI
    const allPassed = failures.length === 0 && avgCompositeScore >= 0.7;

    if (!allPassed) {
      console.log(`\n❌ Evaluation FAILED - Composite score below threshold or failures detected`);
    } else {
      console.log(`\n✅ Evaluation PASSED - All tests successful with good scores`);
    }

    return allPassed;
  },

  reportRun: async (evalReports: boolean[]) => {
    const allPassed = evalReports.every((r) => r);
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║        Overall Run Summary            ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`Experiments Run: ${evalReports.length}`);
    console.log(`All Passed: ${allPassed ? '✅ YES' : '❌ NO'}`);
    
    return allPassed;
  },
});

/**
 * Main Evaluation Function
 */
function createComprehensiveEval(model: AtlasModel, settings: AtlasSettings) {
  const experimentName = `${ATLAS_PROJECT}-${model.name}-${model.computerUseEngine}-comprehensive`;
  const environment = process.env.ENVIRONMENT || 'test';

  return Eval(
    ATLAS_PROJECT,
    {
      experimentName,
      data: getEvaluationDataset,
      task: async (input, hooks) => {
        return await executeBrowserTask(input, model, settings, hooks);
      },
      scores: [
        successScorer,
        efficiencyScorer,
        urlCorrectnessScorer,
        contentMatchScorer,
        qualityScorer,
        factualityScorer,
        actionExecutionScorer,
        compositeScorer,
      ],
      maxConcurrency: 1, // Sequential execution to avoid browser conflicts
      trialCount: process.env.TRIAL_COUNT ? parseInt(process.env.TRIAL_COUNT) : 1, // Use trials for variance analysis
      metadata: {
        model: model.name,
        model_slug: model.model_slug,
        provider: model.provider,
        computer_use_engine: model.computerUseEngine,
        environment,
        eval_version: '1.0.0',
        features: [
          'comprehensive_scoring',
          'tracing',
          'custom_metrics',
          'conditional_scoring',
          'llm_based_verification',
        ],
      },
    }
  );
}

// Execute evaluations based on available API keys

// AI Gateway Flash Lite engine (recommended)
if (process.env.AI_GATEWAY_API_KEY) {
  const settings: AtlasSettings = {
    provider: 'gateway',
    apiKey: process.env.AI_GATEWAY_API_KEY,
    model: 'google/gemini-2.5-flash-lite-preview-09-2025',
    computerUseEngine: 'gateway-flash-lite',
    braintrustApiKey: process.env.BRAINTRUST_API_KEY,
    braintrustProjectName: ATLAS_PROJECT,
    youApiKey: process.env.YOU_API_KEY, // Optional
  };

  createComprehensiveEval(
    {
      name: 'gateway-flash-lite',
      model_slug: 'google/gemini-2.5-flash-lite-preview-09-2025',
      provider: 'gateway',
      computerUseEngine: 'gateway-flash-lite',
      maxTokens: 8192,
    },
    settings
  );
}

// Google Computer Use engine (alternative)
if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  const settings: AtlasSettings = {
    provider: 'google',
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: 'gemini-2.5-pro',
    computerUseEngine: 'google',
    braintrustApiKey: process.env.BRAINTRUST_API_KEY,
    braintrustProjectName: ATLAS_PROJECT,
    youApiKey: process.env.YOU_API_KEY, // Optional
  };

  createComprehensiveEval(
    {
      name: 'gemini-2.5-pro',
      model_slug: 'gemini-2.5-pro',
      provider: 'google',
      computerUseEngine: 'google',
      maxTokens: 8192,
    },
    settings
  );
}

