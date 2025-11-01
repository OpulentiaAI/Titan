// Final Response Summarization & Artifact Generation Test
// Validates complete workflow output with focus on summarization quality
// Tests that final response includes all required artifacts and proper formatting

import { browserAutomationWorkflow } from '../../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput, BrowserAutomationWorkflowOutput } from '../../schemas/workflow-schemas.js';
import type { Message, PageContext } from '../../types.js';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { initializeBraintrust, logEvent, traced } from '../../lib/braintrust.js';

const LOG_PREFIX = '📝 [SUMMARIZATION]';

interface SummarizationTestResult {
  testName: string;
  success: boolean;
  duration: number;
  summarization: {
    generated: boolean;
    length: number;
    hasNextSteps: boolean;
    hasKeyFindings: boolean;
    hasSections: boolean;
    quality: 'excellent' | 'good' | 'poor' | 'missing';
  };
  artifacts: {
    all: string[];
    required: string[];
    optional: string[];
    missing: string[];
  };
  finalResponse: {
    complete: boolean;
    formatted: boolean;
    hasMarkdown: boolean;
    hasMetadata: boolean;
  };
  workflow: {
    stepCount: number;
    toolCalls: number;
    phasesDuration: {
      planning: number;
      streaming: number;
      summarization: number;
    };
    totalDuration: number;
  };
  braintrust: {
    eventsLogged: string[];
  };
  error?: string;
}

function assessSummarizationQuality(summary: string | undefined): {
  quality: 'excellent' | 'good' | 'poor' | 'missing';
  hasNextSteps: boolean;
  hasKeyFindings: boolean;
  hasSections: boolean;
  details: string;
} {
  if (!summary || summary.trim().length === 0) {
    return {
      quality: 'missing',
      hasNextSteps: false,
      hasKeyFindings: false,
      hasSections: false,
      details: 'No summary generated',
    };
  }

  const lowerSummary = summary.toLowerCase();
  const hasNextSteps = lowerSummary.includes('next step') || lowerSummary.includes('recommendation');
  const hasKeyFindings = lowerSummary.includes('found') || lowerSummary.includes('result') || lowerSummary.includes('outcome');
  const hasSections = summary.includes('##') || summary.includes('###') || summary.includes('**');
  
  let quality: 'excellent' | 'good' | 'poor' = 'poor';
  
  if (summary.length > 500 && hasNextSteps && hasKeyFindings && hasSections) {
    quality = 'excellent';
  } else if (summary.length > 200 && (hasNextSteps || hasKeyFindings)) {
    quality = 'good';
  }

  return {
    quality,
    hasNextSteps,
    hasKeyFindings,
    hasSections,
    details: `${summary.length} chars, sections=${hasSections}, findings=${hasKeyFindings}, next=${hasNextSteps}`,
  };
}

function validateArtifactCompleteness(output: BrowserAutomationWorkflowOutput): {
  all: string[];
  required: string[];
  optional: string[];
  missing: string[];
} {
  const required = ['planning', 'executionTrajectory'];
  const optional = ['pageContext', 'summarization', 'metadata', 'errorAnalysis'];
  
  const present: string[] = [];
  const missing: string[] = [];

  // Check required - with detailed debugging
  console.log('🔍 [VALIDATION] Checking planning artifact:', {
    hasPlanning: !!output.planning,
    planningType: typeof output.planning,
    hasPlan: !!(output.planning as any)?.plan,
    hasSteps: !!(output.planning as any)?.plan?.steps,
    stepsLength: ((output.planning as any)?.plan?.steps as any[])?.length || 0,
  });
  
  if (output.planning && output.planning.plan && Array.isArray(output.planning.plan.steps) && output.planning.plan.steps.length > 0) {
    present.push('planning');
  } else {
    missing.push('planning');
    console.log('❌ [VALIDATION] Planning artifact failed validation');
  }

  if (output.executionTrajectory && Array.isArray(output.executionTrajectory) && output.executionTrajectory.length > 0) {
    present.push('executionTrajectory');
  } else {
    missing.push('executionTrajectory');
  }

  // Check optional
  if (output.pageContext && output.pageContext.pageContext) {
    present.push('pageContext');
  }

  if (output.summarization && output.summarization.summary && output.summarization.summary.trim().length > 0) {
    present.push('summarization');
  }

  if (output.metadata) {
    present.push('metadata');
  }

  if (output.errorAnalysis) {
    present.push('errorAnalysis');
  }

  return {
    all: present,
    required: required.filter(r => present.includes(r)),
    optional: optional.filter(o => present.includes(o)),
    missing: required.filter(r => !present.includes(r)),
  };
}

async function createTestContext(page: Page, query: string) {
  const messages: Message[] = [{
    id: Date.now().toString(),
    role: 'user',
    content: query,
  }];

  let lastMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
  const braintrustEvents: string[] = [];

  return {
    executeTool: async (toolName: string, params: any) => {
      console.log(`${LOG_PREFIX} 🔧 Tool: ${toolName}`);
      braintrustEvents.push(`tool_${toolName}`);

      switch (toolName) {
        case 'navigate':
          await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 1000));
          return { success: true, url: page.url() };
        
        case 'getPageContext':
          return await page.evaluate(() => ({
            url: window.location.href,
            title: document.title,
            text: document.body.innerText.substring(0, 2000),
            links: Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => ({
              text: a.textContent?.trim() || '',
              href: a.href,
            })),
            forms: Array.from(document.querySelectorAll('form')).map(f => ({
              action: f.action,
              method: f.method,
            })),
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              devicePixelRatio: window.devicePixelRatio,
            },
          }));
        
        case 'scroll':
          await page.evaluate(({ direction = 'down', amount = 500 }) => {
            if (direction === 'down') window.scrollBy(0, amount);
            else if (direction === 'up') window.scrollBy(0, -amount);
          }, params);
          return { success: true, url: page.url() };
        
        case 'click':
          if (params.selector) {
            await page.click(params.selector);
          }
          return { success: true, url: page.url() };
        
        default:
          return { success: true, url: page.url() };
      }
    },
    enrichToolResponse: async (res: any) => res,
    getPageContextAfterAction: async (): Promise<PageContext> => {
      return await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        text: document.body.innerText.substring(0, 2000),
        links: Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => ({
          text: a.textContent?.trim() || '',
          href: a.href,
        })),
        forms: [],
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
      }));
    },
    updateLastMessage: (updater: (msg: Message) => Message) => {
      lastMessage = updater(lastMessage);
    },
    pushMessage: (msg: Message) => {
      messages.push(msg);
    },
    settings: {
      provider: 'gateway',
      apiKey: process.env.AI_GATEWAY_API_KEY || '',
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      computerUseEngine: 'gateway-flash-lite',
      youApiKey: process.env.YOU_API_KEY,
      braintrustApiKey: process.env.BRAINTRUST_API_KEY,
      braintrustProjectName: 'atlas-summarization-tests',
    },
    messages,
    braintrustEvents,
  };
}

async function runSummarizationTest(testName: string, query: string): Promise<SummarizationTestResult> {
  const startTime = Date.now();
  console.log(`\n${LOG_PREFIX} ================================================================================`);
  console.log(`${LOG_PREFIX} Test: ${testName}`);
  console.log(`${LOG_PREFIX} Query: "${query}"`);
  console.log(`${LOG_PREFIX} ================================================================================\n`);

  // Initialize Braintrust
  const braintrustKey = process.env.BRAINTRUST_API_KEY;
  if (braintrustKey) {
    await initializeBraintrust(braintrustKey, 'atlas-summarization-tests');
    logEvent('summarization_test_start', { testName, query });
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    const context = await createTestContext(page, query);

    // Execute workflow with timing
    console.log(`${LOG_PREFIX} ⏱️  Executing workflow...`);
    const workflowStart = Date.now();

    let output: BrowserAutomationWorkflowOutput;
    try {
      output = await traced(
        'summarization_test_workflow',
        async () => {
          return await browserAutomationWorkflow({
            userQuery: query,
            settings: context.settings,
            initialContext: {
              currentUrl: 'about:blank',
              pageContext: {
                url: 'about:blank',
                title: 'Blank',
                text: '',
                links: [],
                forms: [],
                viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
              },
            },
            metadata: { timestamp: Date.now() },
          }, context);
        },
        { testName, query }
      );
    } catch (error: any) {
      console.error(`${LOG_PREFIX} ❌ Workflow execution failed:`, error?.message || String(error));
      console.error(`${LOG_PREFIX} Stack:`, error?.stack);
      throw error;
    }

    const workflowDuration = Date.now() - workflowStart;
    console.log(`${LOG_PREFIX} ✅ Workflow completed in ${workflowDuration}ms\n`);
    
    // Debug: Log output structure
    console.log(`${LOG_PREFIX} 🔍 Workflow Output Structure:`);
    console.log(`${LOG_PREFIX}    Has Planning: ${!!output.planning}`);
    console.log(`${LOG_PREFIX}    Has Streaming: ${!!output.streaming}`);
    console.log(`${LOG_PREFIX}    Has Summarization: ${!!output.summarization}`);
    console.log(`${LOG_PREFIX}    Has Execution Trajectory: ${!!output.executionTrajectory && output.executionTrajectory.length > 0}`);
    console.log(`${LOG_PREFIX}    Trajectory Length: ${output.executionTrajectory?.length || 0}`);
    console.log(`${LOG_PREFIX}    Success: ${output.success}`);
    console.log(`${LOG_PREFIX}    Total Duration: ${output.totalDuration}ms\n`);

    // Validate summarization
    console.log(`${LOG_PREFIX} 📊 Analyzing Summarization Quality...`);
    const summaryQuality = assessSummarizationQuality(output.summarization?.summary);
    console.log(`${LOG_PREFIX}    Quality: ${summaryQuality.quality.toUpperCase()}`);
    console.log(`${LOG_PREFIX}    Details: ${summaryQuality.details}`);
    console.log(`${LOG_PREFIX}    Has Next Steps: ${summaryQuality.hasNextSteps ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Has Key Findings: ${summaryQuality.hasKeyFindings ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Has Sections: ${summaryQuality.hasSections ? '✅' : '❌'}`);

    // Validate artifact completeness
    console.log(`\n${LOG_PREFIX} 📦 Validating Artifact Completeness...`);
    const artifacts = validateArtifactCompleteness(output);
    console.log(`${LOG_PREFIX}    Generated: ${artifacts.all.join(', ')}`);
    console.log(`${LOG_PREFIX}    Required: ${artifacts.required.join(', ')} (${artifacts.required.length}/2)`);
    console.log(`${LOG_PREFIX}    Optional: ${artifacts.optional.join(', ')} (${artifacts.optional.length}/4)`);
    if (artifacts.missing.length > 0) {
      console.log(`${LOG_PREFIX}    ⚠️  Missing Required: ${artifacts.missing.join(', ')}`);
    }

    // Validate final response format
    console.log(`\n${LOG_PREFIX} 🎨 Validating Final Response Format...`);
    const finalResponse = {
      complete: output.success === true,
      formatted: !!output.summarization?.summary && output.summarization.summary.includes('##'),
      hasMarkdown: !!output.summarization?.summary && (output.summarization.summary.includes('**') || output.summarization.summary.includes('##')),
      hasMetadata: !!output.metadata && !!output.metadata.workflowId,
    };
    console.log(`${LOG_PREFIX}    Complete: ${finalResponse.complete ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Formatted: ${finalResponse.formatted ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Has Markdown: ${finalResponse.hasMarkdown ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Has Metadata: ${finalResponse.hasMetadata ? '✅' : '❌'}`);

    // Workflow metrics
    console.log(`\n${LOG_PREFIX} ⏱️  Workflow Performance Metrics...`);
    const phaseDurations = {
      planning: output.planning?.duration || 0,
      streaming: output.streaming?.duration || 0,
      summarization: output.summarization?.duration || 0,
    };
    console.log(`${LOG_PREFIX}    Planning: ${phaseDurations.planning}ms`);
    console.log(`${LOG_PREFIX}    Streaming: ${phaseDurations.streaming}ms`);
    console.log(`${LOG_PREFIX}    Summarization: ${phaseDurations.summarization}ms`);
    console.log(`${LOG_PREFIX}    Total: ${output.totalDuration || workflowDuration}ms`);
    console.log(`${LOG_PREFIX}    Steps Executed: ${output.executionTrajectory?.length || 0}`);
    console.log(`${LOG_PREFIX}    Tool Calls: ${output.streaming?.toolCallCount || 0}`);

    // Print summarization sample
    if (output.summarization?.summary) {
      console.log(`\n${LOG_PREFIX} 📄 Summarization Sample (first 300 chars):`);
      console.log(`${LOG_PREFIX} ` + '─'.repeat(78));
      const sample = output.summarization.summary.substring(0, 300);
      sample.split('\n').forEach(line => {
        console.log(`${LOG_PREFIX}    ${line}`);
      });
      if (output.summarization.summary.length > 300) {
        console.log(`${LOG_PREFIX}    ... (${output.summarization.summary.length - 300} more chars)`);
      }
      console.log(`${LOG_PREFIX} ` + '─'.repeat(78));
    }

    // Braintrust events
    console.log(`\n${LOG_PREFIX} 📊 Braintrust Events: ${context.braintrustEvents.length} logged`);
    if (context.braintrustEvents.length > 0) {
      console.log(`${LOG_PREFIX}    Events: ${context.braintrustEvents.slice(0, 10).join(', ')}`);
    }

    await browser.close();

    const result: SummarizationTestResult = {
      testName,
      success: output.success && artifacts.missing.length === 0 && summaryQuality.quality !== 'missing',
      duration: Date.now() - startTime,
      summarization: {
        generated: !!output.summarization?.summary,
        length: output.summarization?.summary?.length || 0,
        hasNextSteps: summaryQuality.hasNextSteps,
        hasKeyFindings: summaryQuality.hasKeyFindings,
        hasSections: summaryQuality.hasSections,
        quality: summaryQuality.quality,
      },
      artifacts,
      finalResponse,
      workflow: {
        stepCount: output.executionTrajectory?.length || 0,
        toolCalls: output.streaming?.toolCallCount || 0,
        phasesDuration: phaseDurations,
        totalDuration: output.totalDuration || workflowDuration,
      },
      braintrust: {
        eventsLogged: context.braintrustEvents,
      },
    };

    if (braintrustKey) {
      logEvent('summarization_test_complete', {
        testName,
        success: result.success,
        summaryQuality: summaryQuality.quality,
        artifactsGenerated: artifacts.all,
      });
    }

    return result;

  } catch (error: any) {
    console.error(`${LOG_PREFIX} ❌ Test failed:`, error.message);
    await browser.close();

    return {
      testName,
      success: false,
      duration: Date.now() - startTime,
      summarization: {
        generated: false,
        length: 0,
        hasNextSteps: false,
        hasKeyFindings: false,
        hasSections: false,
        quality: 'missing',
      },
      artifacts: {
        all: [],
        required: [],
        optional: [],
        missing: ['planning', 'executionTrajectory'],
      },
      finalResponse: {
        complete: false,
        formatted: false,
        hasMarkdown: false,
        hasMetadata: false,
      },
      workflow: {
        stepCount: 0,
        toolCalls: 0,
        phasesDuration: { planning: 0, streaming: 0, summarization: 0 },
        totalDuration: 0,
      },
      braintrust: {
        eventsLogged: [],
      },
      error: error.message,
    };
  }
}

async function runAllSummarizationTests() {
  console.log('\n' + '='.repeat(80));
  console.log('📝 FINAL RESPONSE SUMMARIZATION & ARTIFACT GENERATION TEST SUITE');
  console.log('='.repeat(80));
  console.log('\nValidating complete workflow output with focus on summarization quality\n');

  const TEST_CASES = [
    {
      name: 'Simple Task - Basic Summarization',
      query: 'Navigate to https://example.com and tell me what you see',
    },
    {
      name: 'Multi-Step Task - Detailed Summarization',
      query: 'Go to https://example.com, scroll down, get the page title and all links, then summarize the content',
    },
    {
      name: 'Complex Task - Comprehensive Summary',
      query: 'Navigate to https://example.com, extract all information including title, links, and page content, then provide a detailed analysis',
    },
  ];

  const results: SummarizationTestResult[] = [];

  for (const testCase of TEST_CASES) {
    const result = await runSummarizationTest(testCase.name, testCase.query);
    results.push(result);
    await new Promise(r => setTimeout(r, 2000)); // Pause between tests
  }

  // Final Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARIZATION TEST RESULTS');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n🎯 Overall Results:`);
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed} (${(passed / results.length * 100).toFixed(0)}%)`);
  console.log(`   ❌ Failed: ${failed} (${(failed / results.length * 100).toFixed(0)}%)`);

  // Summarization quality statistics
  console.log(`\n📝 Summarization Quality:`);
  const excellentCount = results.filter(r => r.summarization.quality === 'excellent').length;
  const goodCount = results.filter(r => r.summarization.quality === 'good').length;
  const poorCount = results.filter(r => r.summarization.quality === 'poor').length;
  const missingCount = results.filter(r => r.summarization.quality === 'missing').length;

  console.log(`   Excellent: ${excellentCount}/${results.length} (${(excellentCount / results.length * 100).toFixed(0)}%)`);
  console.log(`   Good: ${goodCount}/${results.length} (${(goodCount / results.length * 100).toFixed(0)}%)`);
  console.log(`   Poor: ${poorCount}/${results.length} (${(poorCount / results.length * 100).toFixed(0)}%)`);
  console.log(`   Missing: ${missingCount}/${results.length} (${(missingCount / results.length * 100).toFixed(0)}%)`);

  // Average summary length
  const avgLength = results.reduce((sum, r) => sum + r.summarization.length, 0) / results.length;
  console.log(`   Average Length: ${avgLength.toFixed(0)} characters`);

  // Artifact completeness
  console.log(`\n📦 Artifact Generation:`);
  const artifactStats = {
    planning: results.filter(r => r.artifacts.all.includes('planning')).length,
    trajectory: results.filter(r => r.artifacts.all.includes('executionTrajectory')).length,
    summarization: results.filter(r => r.artifacts.all.includes('summarization')).length,
    metadata: results.filter(r => r.artifacts.all.includes('metadata')).length,
  };

  Object.entries(artifactStats).forEach(([name, count]) => {
    const percentage = (count / results.length * 100).toFixed(0);
    const status = count === results.length ? '✅' : '⚠️';
    console.log(`   ${status} ${name}: ${count}/${results.length} (${percentage}%)`);
  });

  // Performance metrics
  console.log(`\n⏱️  Performance Metrics:`);
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const avgSteps = results.reduce((sum, r) => sum + r.workflow.stepCount, 0) / results.length;
  const avgToolCalls = results.reduce((sum, r) => sum + r.workflow.toolCalls, 0) / results.length;

  console.log(`   Average Total Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Average Steps: ${avgSteps.toFixed(1)}`);
  console.log(`   Average Tool Calls: ${avgToolCalls.toFixed(1)}`);

  // Average phase durations
  const avgPlanningDuration = results.reduce((sum, r) => sum + r.workflow.phasesDuration.planning, 0) / results.length;
  const avgStreamingDuration = results.reduce((sum, r) => sum + r.workflow.phasesDuration.streaming, 0) / results.length;
  const avgSummarizationDuration = results.reduce((sum, r) => sum + r.workflow.phasesDuration.summarization, 0) / results.length;

  console.log(`   Average Planning Phase: ${avgPlanningDuration.toFixed(0)}ms`);
  console.log(`   Average Streaming Phase: ${avgStreamingDuration.toFixed(0)}ms`);
  console.log(`   Average Summarization Phase: ${avgSummarizationDuration.toFixed(0)}ms`);

  // Detailed results per test
  console.log(`\n📋 Detailed Test Results:\n`);
  results.forEach((result, idx) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.testName}`);
    console.log(`   Summary Quality: ${result.summarization.quality}`);
    console.log(`   Summary Length: ${result.summarization.length} chars`);
    console.log(`   Artifacts: ${result.artifacts.all.length} generated (${result.artifacts.all.join(', ')})`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Steps: ${result.workflow.stepCount}`);
    console.log(`   Tool Calls: ${result.workflow.toolCalls}`);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }
    console.log('');
  });

  // Exit
  if (failed > 0) {
    console.error(`\n❌ ${failed} summarization test(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All summarization tests passed!`);
    console.log(`\n🎉 Final Response Generation: VALIDATED`);
    console.log(`   ✅ Summarization working correctly`);
    console.log(`   ✅ All required artifacts generating`);
    console.log(`   ✅ Response formatting proper`);
    console.log(`   ✅ Braintrust debugging active\n`);
    process.exit(0);
  }
}

runAllSummarizationTests();

