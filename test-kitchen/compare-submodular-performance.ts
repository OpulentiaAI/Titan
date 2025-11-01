/**
 * Performance Comparison: Baseline vs Submodular Optimization
 * Compares latency and pass/fail rates between:
 * 1. Baseline (without submodular optimization)
 * 2. Enhanced (with submodular optimization)
 */

import { traced } from 'braintrust';
import { browserAutomationWorkflow } from '../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput } from '../schemas/workflow-schemas.js';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';

interface TestCase {
  input: string;
  expected: {
    success: boolean;
    maxSteps?: number;
    contains?: string;
  };
}

const TEST_CASES: TestCase[] = [
  {
    input: 'Navigate to https://example.com',
    expected: { success: true, maxSteps: 5 },
  },
  {
    input: 'Go to https://example.com and get the page context',
    expected: { success: true, maxSteps: 8 },
  },
  {
    input: 'Navigate to https://example.com, scroll down, and find a link',
    expected: { success: true, maxSteps: 15 },
  },
];

interface TestResult {
  testCase: string;
  success: boolean;
  duration: number;
  steps: number;
  toolCalls: number;
  error?: string;
  latency: {
    planning: number;
    execution: number;
    total: number;
  };
}

interface ComparisonResult {
  baseline: {
    results: TestResult[];
    avgDuration: number;
    avgSteps: number;
    successRate: number;
    avgPlanningLatency: number;
    avgExecutionLatency: number;
  };
  enhanced: {
    results: TestResult[];
    avgDuration: number;
    avgSteps: number;
    successRate: number;
    avgPlanningLatency: number;
    avgExecutionLatency: number;
  };
  improvement: {
    durationChange: number; // percentage
    stepsChange: number; // percentage
    successRateChange: number; // percentage
    planningLatencyChange: number; // percentage
    executionLatencyChange: number; // percentage
  };
}

/**
 * Create browser context for testing
 */
async function createBrowserContext(page: Page) {
  let messages: any[] = [];
  let lastMessage: any = {
    id: Date.now().toString(),
    role: 'assistant',
    content: '',
  };

  return {
    executeTool: async (toolName: string, params: any) => {
      switch (toolName) {
        case 'navigate':
          await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 2500));
          return { success: true, url: page.url() };
        case 'getPageContext':
          return await page.evaluate(() => ({
            url: window.location.href,
            title: document.title,
            text: document.body.innerText.substring(0, 1000),
            links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
              text: a.textContent?.trim() || '',
              href: a.href,
            })),
            forms: [],
            viewport: { width: window.innerWidth, height: window.innerHeight },
          }));
        case 'click':
          if (params.selector) {
            await page.click(params.selector);
          } else if (params.x !== undefined && params.y !== undefined) {
            await page.mouse.click(params.x, params.y);
          }
          await new Promise(r => setTimeout(r, 500));
          return { success: true, url: page.url() };
        case 'scroll':
          await page.evaluate(({ direction = 'down', amount = 500 }) => {
            if (direction === 'down') window.scrollBy(0, amount);
            else if (direction === 'up') window.scrollBy(0, -amount);
          }, params);
          await new Promise(r => setTimeout(r, 500));
          return { success: true, url: page.url() };
        default:
          return { success: true, url: page.url() };
      }
    },
    enrichToolResponse: async (res: any) => ({ ...res, url: page.url() }),
    getPageContextAfterAction: async () => ({
      url: page.url(),
      title: await page.title(),
      text: (await page.evaluate(() => document.body.innerText)).substring(0, 1000),
      links: [],
      forms: [],
      viewport: { width: 1280, height: 720 },
    }),
    updateLastMessage: (updater: (msg: any) => any) => {
      lastMessage = updater(lastMessage);
    },
    pushMessage: (msg: any) => {
      messages.push(msg);
    },
    settings: {
      provider: 'gateway',
      apiKey: process.env.AI_GATEWAY_API_KEY || '',
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      computerUseEngine: 'gateway-flash-lite',
      braintrustApiKey: process.env.BRAINTRUST_API_KEY,
      braintrustProjectName: 'atlas-extension',
    },
    messages,
  };
}

/**
 * Run a single test case
 */
async function runTestCase(
  testCase: TestCase,
  page: Page,
  useSubmodular: boolean = true
): Promise<TestResult> {
  const startTime = Date.now();
  let planningStart = 0;
  let planningEnd = 0;
  let executionStart = 0;
  let executionEnd = 0;

  try {
    // Create context
    const context = await createBrowserContext(page);

    // Set environment flag to control submodular optimization
    const originalValue = process.env.USE_SUBMODULAR_OPTIMIZATION;
    if (useSubmodular) {
      process.env.USE_SUBMODULAR_OPTIMIZATION = 'true';
    } else {
      delete process.env.USE_SUBMODULAR_OPTIMIZATION;
    }

    planningStart = Date.now();
    
    const input: BrowserAutomationWorkflowInput = {
      userQuery: testCase.input,
      settings: context.settings as any,
    };

    executionStart = Date.now();
    planningEnd = executionStart;

    const result = await browserAutomationWorkflow(input, context as any);
    executionEnd = Date.now();

    // Restore environment
    if (originalValue !== undefined) {
      process.env.USE_SUBMODULAR_OPTIMIZATION = originalValue;
    } else {
      delete process.env.USE_SUBMODULAR_OPTIMIZATION;
    }

    const totalDuration = Date.now() - startTime;

    const toolCallCount = result.executionTrajectory?.length || 0;

    return {
      testCase: testCase.input,
      success: result.success,
      duration: totalDuration,
      steps: result.executionTrajectory?.length || 0,
      toolCalls: toolCallCount,
      latency: {
        planning: planningEnd - planningStart,
        execution: executionEnd - executionStart,
        total: totalDuration,
      },
    };
  } catch (error: any) {
    executionEnd = Date.now();
    const totalDuration = Date.now() - startTime;

    // Restore environment
    const originalValue = process.env.USE_SUBMODULAR_OPTIMIZATION;
    if (originalValue !== undefined) {
      process.env.USE_SUBMODULAR_OPTIMIZATION = originalValue;
    } else {
      delete process.env.USE_SUBMODULAR_OPTIMIZATION;
    }

    return {
      testCase: testCase.input,
      success: false,
      duration: totalDuration,
      steps: 0,
      toolCalls: 0,
      error: error?.message || String(error),
      latency: {
        planning: planningEnd - planningStart || 0,
        execution: executionEnd - executionStart || 0,
        total: totalDuration,
      },
    };
  }
}

/**
 * Run all test cases for a configuration
 */
async function runConfiguration(
  testCases: TestCase[],
  useSubmodular: boolean
): Promise<TestResult[]> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${useSubmodular ? '🔬 ENHANCED (With Submodular Optimization)' : '📊 BASELINE (Without Submodular Optimization)'}`);
  console.log(`${'='.repeat(60)}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const results: TestResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n[${i + 1}/${testCases.length}] Testing: ${testCase.input.substring(0, 50)}...`);
    
    const result = await runTestCase(testCase, page, useSubmodular);
    results.push(result);

    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} Duration: ${(result.duration / 1000).toFixed(2)}s | Steps: ${result.steps} | Planning: ${(result.latency.planning / 1000).toFixed(2)}s | Execution: ${(result.latency.execution / 1000).toFixed(2)}s`);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }

    // Brief pause between tests
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();
  return results;
}

/**
 * Calculate comparison metrics
 */
function calculateComparison(baseline: TestResult[], enhanced: TestResult[]): ComparisonResult {
  const baselineMetrics = {
    avgDuration: baseline.reduce((sum, r) => sum + r.duration, 0) / baseline.length,
    avgSteps: baseline.reduce((sum, r) => sum + r.steps, 0) / baseline.length,
    successRate: baseline.filter(r => r.success).length / baseline.length,
    avgPlanningLatency: baseline.reduce((sum, r) => sum + r.latency.planning, 0) / baseline.length,
    avgExecutionLatency: baseline.reduce((sum, r) => sum + r.latency.execution, 0) / baseline.length,
  };

  const enhancedMetrics = {
    avgDuration: enhanced.reduce((sum, r) => sum + r.duration, 0) / enhanced.length,
    avgSteps: enhanced.reduce((sum, r) => sum + r.steps, 0) / enhanced.length,
    successRate: enhanced.filter(r => r.success).length / enhanced.length,
    avgPlanningLatency: enhanced.reduce((sum, r) => sum + r.latency.planning, 0) / enhanced.length,
    avgExecutionLatency: enhanced.reduce((sum, r) => sum + r.latency.execution, 0) / enhanced.length,
  };

  const improvement = {
    durationChange: ((enhancedMetrics.avgDuration - baselineMetrics.avgDuration) / baselineMetrics.avgDuration) * 100,
    stepsChange: ((enhancedMetrics.avgSteps - baselineMetrics.avgSteps) / baselineMetrics.avgSteps) * 100,
    successRateChange: (enhancedMetrics.successRate - baselineMetrics.successRate) * 100,
    planningLatencyChange: ((enhancedMetrics.avgPlanningLatency - baselineMetrics.avgPlanningLatency) / baselineMetrics.avgPlanningLatency) * 100,
    executionLatencyChange: ((enhancedMetrics.avgExecutionLatency - baselineMetrics.avgExecutionLatency) / baselineMetrics.avgExecutionLatency) * 100,
  };

  return {
    baseline: { results: baseline, ...baselineMetrics },
    enhanced: { results: enhanced, ...enhancedMetrics },
    improvement,
  };
}

/**
 * Print comparison report
 */
function printComparisonReport(comparison: ComparisonResult) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 PERFORMANCE COMPARISON REPORT`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`BASELINE (Without Submodular Optimization):`);
  console.log(`  ✅ Success Rate: ${(comparison.baseline.successRate * 100).toFixed(1)}%`);
  console.log(`  ⏱️  Avg Duration: ${(comparison.baseline.avgDuration / 1000).toFixed(2)}s`);
  console.log(`  📝 Avg Steps: ${comparison.baseline.avgSteps.toFixed(1)}`);
  console.log(`  🧠 Avg Planning Latency: ${(comparison.baseline.avgPlanningLatency / 1000).toFixed(2)}s`);
  console.log(`  ⚡ Avg Execution Latency: ${(comparison.baseline.avgExecutionLatency / 1000).toFixed(2)}s`);

  console.log(`\nENHANCED (With Submodular Optimization):`);
  console.log(`  ✅ Success Rate: ${(comparison.enhanced.successRate * 100).toFixed(1)}%`);
  console.log(`  ⏱️  Avg Duration: ${(comparison.enhanced.avgDuration / 1000).toFixed(2)}s`);
  console.log(`  📝 Avg Steps: ${comparison.enhanced.avgSteps.toFixed(1)}`);
  console.log(`  🧠 Avg Planning Latency: ${(comparison.enhanced.avgPlanningLatency / 1000).toFixed(2)}s`);
  console.log(`  ⚡ Avg Execution Latency: ${(comparison.enhanced.avgExecutionLatency / 1000).toFixed(2)}s`);

  console.log(`\n📈 IMPROVEMENT:`);
  const durationIcon = comparison.improvement.durationChange < 0 ? '⬇️' : '⬆️';
  const stepsIcon = comparison.improvement.stepsChange < 0 ? '⬇️' : '⬆️';
  const successIcon = comparison.improvement.successRateChange > 0 ? '⬆️' : '⬇️';
  
  console.log(`  ${successIcon} Success Rate: ${comparison.improvement.successRateChange > 0 ? '+' : ''}${comparison.improvement.successRateChange.toFixed(1)}%`);
  console.log(`  ${durationIcon} Duration: ${comparison.improvement.durationChange > 0 ? '+' : ''}${comparison.improvement.durationChange.toFixed(1)}%`);
  console.log(`  ${stepsIcon} Steps: ${comparison.improvement.stepsChange > 0 ? '+' : ''}${comparison.improvement.stepsChange.toFixed(1)}%`);
  console.log(`  🧠 Planning Latency: ${comparison.improvement.planningLatencyChange > 0 ? '+' : ''}${comparison.improvement.planningLatencyChange.toFixed(1)}%`);
  console.log(`  ⚡ Execution Latency: ${comparison.improvement.executionLatencyChange > 0 ? '+' : ''}${comparison.improvement.executionLatencyChange.toFixed(1)}%`);

  // Overall verdict
  const better = 
    comparison.enhanced.successRate >= comparison.baseline.successRate &&
    comparison.improvement.durationChange <= 10; // Allow up to 10% latency increase for better success rate

  console.log(`\n${'='.repeat(60)}`);
  if (better) {
    console.log(`✅ VERDICT: Submodular optimization ${comparison.improvement.successRateChange > 0 ? 'improves' : 'maintains'} success rate with ${Math.abs(comparison.improvement.durationChange).toFixed(1)}% ${comparison.improvement.durationChange < 0 ? 'faster' : 'slower'} performance`);
  } else {
    console.log(`⚠️  VERDICT: Needs optimization - consider trade-offs`);
  }
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Main comparison function
 */
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔬 SUBMODULAR OPTIMIZATION PERFORMANCE TEST`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Run baseline (without submodular optimization)
    const baselineResults = await runConfiguration(TEST_CASES, false);

    // Brief pause between configurations
    await new Promise(r => setTimeout(r, 2000));

    // Run enhanced (with submodular optimization)
    const enhancedResults = await runConfiguration(TEST_CASES, true);

    // Calculate and print comparison
    const comparison = calculateComparison(baselineResults, enhancedResults);
    printComparisonReport(comparison);

    // Log to Braintrust if available
    try {
      await traced('submodular_performance_comparison', async (span) => {
        span.log({
          input: { testCases: TEST_CASES.length },
          output: comparison,
          metadata: {
            baseline_avg_duration_ms: comparison.baseline.avgDuration,
            enhanced_avg_duration_ms: comparison.enhanced.avgDuration,
            success_rate_improvement: comparison.improvement.successRateChange,
            duration_change_percent: comparison.improvement.durationChange,
          },
        });
      });
    } catch (e) {
      // Braintrust not available, continue
    }

    process.exit(0);
  } catch (error: any) {
    console.error(`❌ Error running comparison:`, error);
    process.exit(1);
  }
}

main();

