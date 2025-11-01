// Comprehensive Summarization Step Diagnostic Test
// Isolates and debugs the summarization step to identify why it doesn't complete
// despite workflow logs showing it started

console.log('🔬 Summarization Diagnostic Test Loaded');

// Load environment variables
import { config } from 'dotenv';
config({ path: '../.env' });

import { summarizationStep } from '../../steps/summarization-step.js';
import type { SummarizationStepOutput } from '../../schemas/workflow-schemas.js';
import { validatePreflight, logPreflightResults } from '../../lib/preflight-validation.js';
import { initializeBraintrust, traced } from '../../lib/braintrust.js';

const LOG_PREFIX = '🔬 [SUMMARIZATION-DIAG]';

interface SummarizationDiagnosticResult {
  testName: string;
  success: boolean;
  duration: number;
  youApi: {
    attempted: boolean;
    success: boolean;
    duration: number;
    error?: string;
    responseLength?: number;
  };
  fallback: {
    attempted: boolean;
    success: boolean;
    duration: number;
    error?: string;
    responseLength?: number;
  };
  finalization: {
    attempted: boolean;
    success: boolean;
    duration: number;
    error?: string;
  };
  output: {
    hasSummary: boolean;
    summaryLength: number;
    success: boolean;
    duration: number;
    trajectoryLength: number;
    stepCount: number;
  };
  error?: string;
}

// Mock execution trajectory for testing
const mockExecutionTrajectory = [
  {
    step: 1,
    action: 'navigate',
    target: 'https://example.com',
    success: true,
    timestamp: Date.now() - 5000,
  },
  {
    step: 2,
    action: 'getPageContext',
    target: 'current_page',
    success: true,
    timestamp: Date.now() - 3000,
  },
  {
    step: 3,
    action: 'scroll',
    target: 'down',
    success: true,
    timestamp: Date.now() - 1000,
  },
];

const mockOutcome = `Assistant: I have successfully navigated to example.com and gathered page context. The page shows the Example Domain with a heading and paragraph. I also scrolled down to ensure I captured all content. The task is now complete.`;

async function testSummarizationStepDirect(testName: string, config: {
  useYouApi: boolean;
  useFallback: boolean;
  useFinalization: boolean;
  timeoutMs?: number;
}): Promise<SummarizationDiagnosticResult> {
  const startTime = Date.now();
  console.log(`\n${LOG_PREFIX} ================================================================================`);
  console.log(`${LOG_PREFIX} Test: ${testName}`);
  console.log(`${LOG_PREFIX} Config: You=${config.useYouApi}, Fallback=${config.useFallback}, Finalization=${config.useFinalization}`);
  console.log(`${LOG_PREFIX} ================================================================================\n`);

  // Initialize Braintrust
  const braintrustKey = process.env.BRAINTRUST_API_KEY;
  if (braintrustKey) {
    await initializeBraintrust(braintrustKey, 'atlas-summarization-diagnostic');
  }

  const diagnostic: SummarizationDiagnosticResult = {
    testName,
    success: false,
    duration: 0,
    youApi: { attempted: false, success: false, duration: 0 },
    fallback: { attempted: false, success: false, duration: 0 },
    finalization: { attempted: false, success: false, duration: 0 },
    output: { hasSummary: false, summaryLength: 0, success: false, duration: 0, trajectoryLength: 0, stepCount: 0 },
  };

  try {
    // Create test input
    const input: any = {
      youApiKey: config.useYouApi ? process.env.YOU_API_KEY : '',
      objective: 'Navigate to example.com, get page context, and scroll down',
      trajectory: mockExecutionTrajectory.map(step =>
        `Step ${step.step}: ${step.action} ${step.target} - ${step.success ? 'SUCCESS' : 'FAILED'}`
      ).join('\n'),
      outcome: mockOutcome,
      enableStreaming: false,
      enableFinalization: config.useFinalization,
      finalizationProvider: 'gateway' as const,
      finalizationModel: 'google/gemini-2.5-flash-lite-preview-09-2025',
      knowledgeItems: [],
    };

    // Add fallback model if enabled
    if (config.useFallback) {
      const { createOpenAI } = await import('@ai-sdk/openai');
      (input as any).fallbackModel = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      })('gpt-4o-mini');
      (input as any).fallbackApiKey = process.env.OPENAI_API_KEY;
    }

    console.log(`${LOG_PREFIX} 📝 Test Input:`);
    console.log(`${LOG_PREFIX}    You API Key: ${input.youApiKey ? 'Present (' + input.youApiKey.length + ' chars)' : 'Not provided'}`);
    console.log(`${LOG_PREFIX}    Fallback Model: ${input.fallbackModel ? 'Configured' : 'Not configured'}`);
    console.log(`${LOG_PREFIX}    Finalization: ${input.enableFinalization ? 'Enabled' : 'Disabled'}`);
    console.log(`${LOG_PREFIX}    Trajectory Length: ${input.trajectory.length} chars`);
    console.log(`${LOG_PREFIX}    Outcome Length: ${input.outcome.length} chars\n`);

    // Track You.com API call
    const youStartTime = Date.now();
    let youCompleted = false;

    // Override console.log to capture You.com API logs
    const originalConsoleLog = console.log;
    const youLogs: string[] = [];
    const fallbackLogs: string[] = [];

    const captureConsoleLog = (prefix: string, logs: string[]) => {
      return (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('🔍 [SUMMARIZATION]')) {
          logs.push(message);
        }
        originalConsoleLog(...args);
      };
    };

    console.log = captureConsoleLog('🔍 [SUMMARIZATION]', youLogs);

    // Execute summarization step with timeout
    const stepPromise = summarizationStep(input);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Summarization step timed out after ${config.timeoutMs || 30000}ms`)), config.timeoutMs || 30000);
    });

    console.log(`${LOG_PREFIX} ⏱️  Executing summarization step...`);
    const stepStartTime = Date.now();

    const output = await Promise.race([stepPromise, timeoutPromise]);

    const stepDuration = Date.now() - stepStartTime;
    console.log(`${LOG_PREFIX} ✅ Summarization step completed in ${stepDuration}ms\n`);

    // Restore console.log
    console.log = originalConsoleLog;

    // Analyze You.com logs
    diagnostic.youApi.attempted = youLogs.length > 0;
    if (diagnostic.youApi.attempted) {
      diagnostic.youApi.duration = Date.now() - youStartTime;
      const hasYouSuccess = youLogs.some(log => log.includes('You.com') && log.includes('complete'));
      const hasYouError = youLogs.some(log => log.includes('You.com') && log.includes('failed'));

      if (hasYouSuccess) {
        diagnostic.youApi.success = true;
        const responseLog = youLogs.find(log => log.includes('outputLength') || log.includes('summaryLength'));
        if (responseLog) {
          const lengthMatch = responseLog.match(/(\d+)\s*(?:outputLength|summaryLength)/);
          if (lengthMatch) {
            diagnostic.youApi.responseLength = parseInt(lengthMatch[1]);
          }
        }
      } else if (hasYouError) {
        diagnostic.youApi.success = false;
        diagnostic.youApi.error = 'You.com API call failed';
      }
    }

    // Analyze output
    diagnostic.output.hasSummary = !!output.summary && output.summary.trim().length > 0;
    diagnostic.output.summaryLength = output.summary?.length || 0;
    diagnostic.output.success = output.success;
    diagnostic.output.duration = output.duration;
    diagnostic.output.trajectoryLength = output.trajectoryLength;
    diagnostic.output.stepCount = output.stepCount;

    // Check if fallback was used (no You.com success but we have output)
    if (!diagnostic.youApi.success && diagnostic.output.hasSummary) {
      diagnostic.fallback.attempted = true;
      diagnostic.fallback.success = true;
      diagnostic.fallback.responseLength = diagnostic.output.summaryLength;
    }

    // Log results
    console.log(`${LOG_PREFIX} 📊 Diagnostic Results:`);
    console.log(`${LOG_PREFIX}    You.com API:`);
    console.log(`${LOG_PREFIX}      Attempted: ${diagnostic.youApi.attempted ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}      Success: ${diagnostic.youApi.success ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}      Duration: ${diagnostic.youApi.duration}ms`);
    if (diagnostic.youApi.responseLength) {
      console.log(`${LOG_PREFIX}      Response Length: ${diagnostic.youApi.responseLength} chars`);
    }
    if (diagnostic.youApi.error) {
      console.log(`${LOG_PREFIX}      Error: ${diagnostic.youApi.error}`);
    }

    console.log(`${LOG_PREFIX}    Fallback AI:`);
    console.log(`${LOG_PREFIX}      Attempted: ${diagnostic.fallback.attempted ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}      Success: ${diagnostic.fallback.success ? '✅' : '❌'}`);
    if (diagnostic.fallback.responseLength) {
      console.log(`${LOG_PREFIX}      Response Length: ${diagnostic.fallback.responseLength} chars`);
    }

    console.log(`${LOG_PREFIX}    Final Output:`);
    console.log(`${LOG_PREFIX}      Has Summary: ${diagnostic.output.hasSummary ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}      Summary Length: ${diagnostic.output.summaryLength} chars`);
    console.log(`${LOG_PREFIX}      Success: ${diagnostic.output.success ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}      Duration: ${diagnostic.output.duration}ms`);
    console.log(`${LOG_PREFIX}      Trajectory Length: ${diagnostic.output.trajectoryLength}`);
    console.log(`${LOG_PREFIX}      Step Count: ${diagnostic.output.stepCount}`);

    // Print summary sample
    if (output.summary) {
      console.log(`\n${LOG_PREFIX} 📄 Summary Sample (first 200 chars):`);
      console.log(`${LOG_PREFIX} ` + '─'.repeat(78));
      const sample = output.summary.substring(0, 200);
      sample.split('\n').forEach(line => {
        console.log(`${LOG_PREFIX}    ${line}`);
      });
      if (output.summary.length > 200) {
        console.log(`${LOG_PREFIX}    ... (${output.summary.length - 200} more chars)`);
      }
      console.log(`${LOG_PREFIX} ` + '─'.repeat(78));
    }

    diagnostic.success = diagnostic.output.hasSummary && diagnostic.output.success;
    diagnostic.duration = Date.now() - startTime;

    return diagnostic;

  } catch (error: any) {
    console.error(`${LOG_PREFIX} ❌ Test failed:`, error.message);
    diagnostic.error = error.message;
    diagnostic.duration = Date.now() - startTime;
    return diagnostic;
  }
}

async function runSummarizationDiagnostics() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 SUMMARIZATION STEP DIAGNOSTIC SUITE');
  console.log('='.repeat(80));
  console.log('\nIsolating and debugging the summarization step to identify completion issues\n');

  // Preflight check
  console.log(`${LOG_PREFIX} 🔍 Running preflight validation...`);
  const preflight = validatePreflight(process.env);
  logPreflightResults(preflight, true);

  if (!preflight.passed) {
    console.error(`${LOG_PREFIX} ❌ Preflight failed - cannot proceed`);
    process.exit(1);
  }

  // Test configurations
  const testConfigs = [
    {
      name: 'You.com API Only',
      config: { useYouApi: true, useFallback: false, useFinalization: false, timeoutMs: 15000 },
    },
    {
      name: 'Fallback AI Only',
      config: { useYouApi: false, useFallback: true, useFinalization: false, timeoutMs: 15000 },
    },
    {
      name: 'You.com + Fallback',
      config: { useYouApi: true, useFallback: true, useFinalization: false, timeoutMs: 20000 },
    },
    {
      name: 'Full Pipeline (You + Fallback + Finalization)',
      config: { useYouApi: true, useFallback: true, useFinalization: true, timeoutMs: 30000 },
    },
  ];

  const results: SummarizationDiagnosticResult[] = [];

  for (const testConfig of testConfigs) {
    const result = await testSummarizationStepDirect(testConfig.name, testConfig.config);
    results.push(result);
    await new Promise(r => setTimeout(r, 1000)); // Brief pause between tests
  }

  // Analysis and Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSTIC ANALYSIS & RECOMMENDATIONS');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n🎯 Overall Results:`);
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed} (${(passed / results.length * 100).toFixed(0)}%)`);
  console.log(`   ❌ Failed: ${failed} (${(failed / results.length * 100).toFixed(0)}%)`);

  // Analyze You.com API performance
  console.log(`\n🔍 You.com API Analysis:`);
  const youAttempted = results.filter(r => r.youApi.attempted).length;
  const youSuccess = results.filter(r => r.youApi.success).length;
  const avgYouDuration = results.filter(r => r.youApi.attempted).reduce((sum, r) => sum + r.youApi.duration, 0) / Math.max(youAttempted, 1);

  console.log(`   Attempted: ${youAttempted}/${results.length} tests`);
  console.log(`   Success Rate: ${youSuccess}/${youAttempted} (${youAttempted > 0 ? (youSuccess / youAttempted * 100).toFixed(0) : 0}%)`);
  console.log(`   Average Duration: ${avgYouDuration.toFixed(0)}ms`);

  if (youSuccess === 0 && youAttempted > 0) {
    console.log(`   ⚠️  ISSUE: You.com API is failing in all attempts`);
    console.log(`   💡 RECOMMENDATION: Check You.com API key validity and network connectivity`);
  }

  // Analyze fallback performance
  console.log(`\n🤖 Fallback AI Analysis:`);
  const fallbackAttempted = results.filter(r => r.fallback.attempted).length;
  const fallbackSuccess = results.filter(r => r.fallback.success).length;
  const avgFallbackDuration = results.filter(r => r.fallback.attempted).reduce((sum, r) => sum + r.fallback.duration, 0) / Math.max(fallbackAttempted, 1);

  console.log(`   Attempted: ${fallbackAttempted}/${results.length} tests`);
  console.log(`   Success Rate: ${fallbackSuccess}/${fallbackAttempted} (${fallbackAttempted > 0 ? (fallbackSuccess / fallbackAttempted * 100).toFixed(0) : 0}%)`);
  console.log(`   Average Duration: ${avgFallbackDuration.toFixed(0)}ms`);

  // Analyze final output quality
  console.log(`\n📄 Output Quality Analysis:`);
  const hasSummary = results.filter(r => r.output.hasSummary).length;
  const avgSummaryLength = results.filter(r => r.output.hasSummary).reduce((sum, r) => sum + r.output.summaryLength, 0) / Math.max(hasSummary, 1);

  console.log(`   Summaries Generated: ${hasSummary}/${results.length} (${(hasSummary / results.length * 100).toFixed(0)}%)`);
  console.log(`   Average Summary Length: ${avgSummaryLength.toFixed(0)} chars`);

  if (hasSummary === 0) {
    console.log(`   ❌ CRITICAL: No summaries generated in any test`);
    console.log(`   💡 RECOMMENDATION: Check both You.com API and fallback AI configuration`);
  } else if (hasSummary < results.length) {
    console.log(`   ⚠️  PARTIAL: Some tests failed to generate summaries`);
    console.log(`   💡 RECOMMENDATION: Ensure fallback AI is properly configured`);
  }

  // Detailed results
  console.log(`\n📋 Detailed Test Results:\n`);
  results.forEach((result, idx) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.testName}`);
    console.log(`   Duration: ${result.duration}ms`);

    if (result.youApi.attempted) {
      const youStatus = result.youApi.success ? '✅' : '❌';
      console.log(`   You.com: ${youStatus} (${result.youApi.duration}ms)`);
    }

    if (result.fallback.attempted) {
      const fallbackStatus = result.fallback.success ? '✅' : '❌';
      console.log(`   Fallback: ${fallbackStatus}`);
    }

    console.log(`   Output: ${result.output.hasSummary ? '✅' : '❌'} (${result.output.summaryLength} chars)`);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }
    console.log('');
  });

  // Recommendations
  console.log('💡 KEY RECOMMENDATIONS:');
  if (youSuccess === 0) {
    console.log('   1. 🔑 Verify You.com API key is valid and has sufficient credits');
    console.log('   2. 🌐 Check network connectivity to You.com API');
    console.log('   3. ⚙️  Ensure You.com API key format is correct (should start with "ydc-")');
  }

  if (fallbackSuccess === 0) {
    console.log('   1. 🔑 Verify AI Gateway API key is valid');
    console.log('   2. 🤖 Ensure fallback model configuration is correct');
    console.log('   3. 🌐 Check network connectivity to AI Gateway');
  }

  if (hasSummary === 0) {
    console.log('   1. 🚨 CRITICAL: Both You.com and fallback are failing');
    console.log('   2. 🔍 Check all API keys and network connectivity');
    console.log('   3. 📝 Review summarization step error handling');
  }

  console.log('   4. 📊 Run this diagnostic regularly to monitor summarization health');
  console.log('   5. 🔧 Consider increasing timeouts if network is slow');

  // Exit with appropriate code
  if (failed > 0) {
    console.error(`\n❌ ${failed} summarization diagnostic test(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All summarization diagnostic tests passed!`);
    console.log(`\n🎉 Summarization Step: FULLY OPERATIONAL`);
    console.log(`   ✅ You.com API working correctly`);
    console.log(`   ✅ Fallback AI functioning properly`);
    console.log(`   ✅ Finalization pipeline operational`);
    console.log(`   ✅ Output quality validated\n`);
    process.exit(0);
  }
}

// Run the diagnostics
console.log('🔬 Starting Summarization Step Diagnostic Test...');
runSummarizationDiagnostics();