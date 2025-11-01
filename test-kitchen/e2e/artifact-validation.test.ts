// Artifact Generation E2E Test Suite
// Validates that all workflow outputs produce proper artifacts
// Tests tool calling, execution, and artifact structure

import { browserAutomationWorkflow } from '../../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput, BrowserAutomationWorkflowOutput } from '../../schemas/workflow-schemas.js';
import type { Message, PageContext } from '../../types.js';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { initializeBraintrust, logEvent, traced } from '../../lib/braintrust.js';

const LOG_PREFIX = '🎨 [ARTIFACT]';

interface ArtifactTestResult {
  testName: string;
  success: boolean;
  duration: number;
  artifactsGenerated: {
    planning: boolean;
    pageContext: boolean;
    executionTrajectory: boolean;
    summarization: boolean;
    metadata: boolean;
  };
  artifactValidation: {
    planningValid: boolean;
    pageContextValid: boolean;
    trajectoryValid: boolean;
    summarizationValid: boolean;
    metadataValid: boolean;
  };
  toolCalling: {
    toolsInvoked: string[];
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
  };
  braintrustTracking: {
    initialized: boolean;
    eventsLogged: number;
  };
  error?: string;
}

async function validatePlanningArtifact(output: BrowserAutomationWorkflowOutput): Promise<{ valid: boolean; details: string }> {
  if (!output.planning) {
    return { valid: false, details: 'No planning artifact generated' };
  }

  const plan = output.planning.plan;
  if (!plan || !Array.isArray(plan.steps)) {
    return { valid: false, details: 'Planning artifact missing steps array' };
  }

  if (plan.steps.length === 0) {
    return { valid: false, details: 'Planning artifact has empty steps' };
  }

  if (output.planning.confidence === undefined || output.planning.confidence < 0 || output.planning.confidence > 1) {
    return { valid: false, details: `Invalid confidence score: ${output.planning.confidence}` };
  }

  return { 
    valid: true, 
    details: `Planning artifact valid: ${plan.steps.length} steps, confidence ${output.planning.confidence}` 
  };
}

async function validatePageContextArtifact(output: BrowserAutomationWorkflowOutput): Promise<{ valid: boolean; details: string }> {
  if (!output.pageContext) {
    return { valid: true, details: 'Page context is optional' }; // Not required for all workflows
  }

  const ctx = output.pageContext.pageContext;
  if (!ctx || !ctx.url) {
    return { valid: false, details: 'Page context missing URL' };
  }

  return { 
    valid: true, 
    details: `Page context valid: ${ctx.url}, ${ctx.text?.length || 0} chars, ${ctx.links?.length || 0} links` 
  };
}

async function validateTrajectoryArtifact(output: BrowserAutomationWorkflowOutput): Promise<{ valid: boolean; details: string }> {
  if (!output.executionTrajectory || output.executionTrajectory.length === 0) {
    return { valid: false, details: 'No execution trajectory generated' };
  }

  const hasSteps = output.executionTrajectory.every(step => 
    step.step !== undefined && step.action && step.success !== undefined
  );

  if (!hasSteps) {
    return { valid: false, details: 'Trajectory steps missing required fields' };
  }

  const successCount = output.executionTrajectory.filter(s => s.success).length;
  return { 
    valid: true, 
    details: `Trajectory valid: ${output.executionTrajectory.length} steps, ${successCount} successful` 
  };
}

async function validateSummarizationArtifact(output: BrowserAutomationWorkflowOutput): Promise<{ valid: boolean; details: string }> {
  if (!output.summarization) {
    return { valid: true, details: 'Summarization is optional' }; // Not required for all workflows
  }

  if (!output.summarization.summary || output.summarization.summary.trim().length === 0) {
    return { valid: false, details: 'Summarization artifact has empty summary' };
  }

  return { 
    valid: true, 
    details: `Summarization valid: ${output.summarization.summary.length} chars, ${output.summarization.stepCount || 0} steps` 
  };
}

async function validateMetadataArtifact(output: BrowserAutomationWorkflowOutput): Promise<{ valid: boolean; details: string }> {
  if (!output.metadata) {
    return { valid: true, details: 'Metadata is optional' };
  }

  return { 
    valid: true, 
    details: `Metadata present: workflowId=${output.metadata.workflowId}, conversationId=${output.metadata.conversationId}` 
  };
}

async function createMockContext(page: Page, query: string) {
  const messages: Message[] = [{
    id: Date.now().toString(),
    role: 'user',
    content: query,
  }];

  let lastMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
  const toolExecutions: Array<{ tool: string; success: boolean }> = [];

  return {
    executeTool: async (toolName: string, params: any) => {
      console.log(`${LOG_PREFIX} 🔧 Executing tool: ${toolName}`, params);
      logEvent(`tool_execution_${toolName}`, { tool: toolName, params });

      try {
        let result: any;
        switch (toolName) {
          case 'navigate':
            await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 1000));
            result = { success: true, url: page.url() };
            break;
          case 'getPageContext':
            result = await page.evaluate(() => ({
              url: window.location.href,
              title: document.title,
              text: document.body.innerText.substring(0, 1000),
              links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
                text: a.textContent?.trim() || '',
                href: a.href,
              })),
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio,
              },
            }));
            break;
          case 'click':
            if (params.selector) {
              await page.click(params.selector);
            }
            result = { success: true, url: page.url() };
            break;
          case 'type':
            if (params.selector && params.text) {
              await page.type(params.selector, params.text);
            }
            result = { success: true, url: page.url() };
            break;
          case 'scroll':
            await page.evaluate(({ direction = 'down', amount = 500 }) => {
              if (direction === 'down') window.scrollBy(0, amount);
              else if (direction === 'up') window.scrollBy(0, -amount);
            }, params);
            result = { success: true, url: page.url() };
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        toolExecutions.push({ tool: toolName, success: true });
        logEvent(`tool_success_${toolName}`, { result });
        return result;
      } catch (error: any) {
        toolExecutions.push({ tool: toolName, success: false });
        logEvent(`tool_error_${toolName}`, { error: error.message });
        throw error;
      }
    },
    enrichToolResponse: async (res: any, toolName: string) => {
      const { url } = await page.evaluate(() => ({ url: window.location.href }));
      return { ...res, url };
    },
    getPageContextAfterAction: async (): Promise<PageContext> => {
      return await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        text: document.body.innerText.substring(0, 1000),
        links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
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
      braintrustProjectName: 'atlas-extension-artifact-tests',
    },
    messages,
    toolExecutions,
  };
}

async function runArtifactTest(testName: string, query: string): Promise<ArtifactTestResult> {
  const startTime = Date.now();
  console.log(`\n${LOG_PREFIX} Starting test: ${testName}`);
  console.log(`${LOG_PREFIX} Query: "${query}"`);

  // Initialize Braintrust
  const braintrustKey = process.env.BRAINTRUST_API_KEY;
  let braintrustInitialized = false;
  let eventsLogged = 0;

  if (braintrustKey) {
    const btLogger = await initializeBraintrust(braintrustKey, 'atlas-extension-artifact-tests');
    braintrustInitialized = !!btLogger;
    if (braintrustInitialized) {
      console.log(`${LOG_PREFIX} ✅ Braintrust initialized`);
      logEvent('artifact_test_start', { testName, query });
      eventsLogged++;
    } else {
      console.log(`${LOG_PREFIX} ⚠️  Braintrust not available (running without telemetry)`);
    }
  }

  // Initialize browser
  console.log(`${LOG_PREFIX} Launching browser...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let result: ArtifactTestResult;

  try {
    // Create context
    const context = await createMockContext(page, query);

    // Execute workflow
    console.log(`${LOG_PREFIX} Executing workflow...`);
    const workflowResult: BrowserAutomationWorkflowOutput = await traced(
      'artifact_test_workflow',
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
    eventsLogged++;

    console.log(`${LOG_PREFIX} Workflow completed`);

    // Validate artifacts
    console.log(`${LOG_PREFIX} Validating artifacts...`);

    const planningCheck = await validatePlanningArtifact(workflowResult);
    console.log(`${LOG_PREFIX} ${planningCheck.valid ? '✅' : '❌'} Planning: ${planningCheck.details}`);

    const pageContextCheck = await validatePageContextArtifact(workflowResult);
    console.log(`${LOG_PREFIX} ${pageContextCheck.valid ? '✅' : '❌'} Page Context: ${pageContextCheck.details}`);

    const trajectoryCheck = await validateTrajectoryArtifact(workflowResult);
    console.log(`${LOG_PREFIX} ${trajectoryCheck.valid ? '✅' : '❌'} Trajectory: ${trajectoryCheck.details}`);

    const summarizationCheck = await validateSummarizationArtifact(workflowResult);
    console.log(`${LOG_PREFIX} ${summarizationCheck.valid ? '✅' : '❌'} Summarization: ${summarizationCheck.details}`);

    const metadataCheck = await validateMetadataArtifact(workflowResult);
    console.log(`${LOG_PREFIX} ${metadataCheck.valid ? '✅' : '❌'} Metadata: ${metadataCheck.details}`);

    // Tool calling validation
    const toolsInvoked = context.toolExecutions.map(t => t.tool);
    const successfulTools = context.toolExecutions.filter(t => t.success).length;
    const failedTools = context.toolExecutions.length - successfulTools;

    console.log(`${LOG_PREFIX} 🔧 Tools: ${toolsInvoked.length} total, ${successfulTools} successful, ${failedTools} failed`);
    console.log(`${LOG_PREFIX} 🔧 Tools invoked: ${toolsInvoked.join(', ')}`);

    const allValid = planningCheck.valid && trajectoryCheck.valid;

    result = {
      testName,
      success: workflowResult.success && allValid,
      duration: Date.now() - startTime,
      artifactsGenerated: {
        planning: !!workflowResult.planning,
        pageContext: !!workflowResult.pageContext,
        executionTrajectory: !!workflowResult.executionTrajectory && workflowResult.executionTrajectory.length > 0,
        summarization: !!workflowResult.summarization,
        metadata: !!workflowResult.metadata,
      },
      artifactValidation: {
        planningValid: planningCheck.valid,
        pageContextValid: pageContextCheck.valid,
        trajectoryValid: trajectoryCheck.valid,
        summarizationValid: summarizationCheck.valid,
        metadataValid: metadataCheck.valid,
      },
      toolCalling: {
        toolsInvoked,
        totalCalls: context.toolExecutions.length,
        successfulCalls: successfulTools,
        failedCalls: failedTools,
      },
      braintrustTracking: {
        initialized: braintrustInitialized,
        eventsLogged,
      },
      error: workflowResult.success ? undefined : workflowResult.error,
    };

    if (braintrustInitialized) {
      logEvent('artifact_test_complete', {
        testName,
        success: result.success,
        artifactsGenerated: result.artifactsGenerated,
        artifactValidation: result.artifactValidation,
        toolCalling: result.toolCalling,
      });
      eventsLogged++;
    }

  } catch (error: any) {
    console.error(`${LOG_PREFIX} ❌ Test failed:`, error.message);
    
    result = {
      testName,
      success: false,
      duration: Date.now() - startTime,
      artifactsGenerated: {
        planning: false,
        pageContext: false,
        executionTrajectory: false,
        summarization: false,
        metadata: false,
      },
      artifactValidation: {
        planningValid: false,
        pageContextValid: false,
        trajectoryValid: false,
        summarizationValid: false,
        metadataValid: false,
      },
      toolCalling: {
        toolsInvoked: [],
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
      },
      braintrustTracking: {
        initialized: braintrustInitialized,
        eventsLogged,
      },
      error: error.message,
    };

    if (braintrustInitialized) {
      logEvent('artifact_test_error', {
        testName,
        error: error.message,
        stack: error.stack,
      });
      eventsLogged++;
    }
  } finally {
    await browser.close();
  }

  return result;
}

async function runAllArtifactTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🎨 ARTIFACT GENERATION & VALIDATION TEST SUITE');
  console.log('='.repeat(80));
  console.log('\nValidating proper tool calling, execution, and artifact generation\n');

  const TEST_CASES = [
    {
      name: 'Basic Navigation - Planning & Trajectory Artifacts',
      query: 'Navigate to https://example.com',
    },
    {
      name: 'Navigation with Context - All Artifacts',
      query: 'Go to https://example.com and get the page context',
    },
    {
      name: 'Multi-Step Workflow - Complete Artifact Suite',
      query: 'Navigate to https://example.com, scroll down, and get page details',
    },
  ];

  const results: ArtifactTestResult[] = [];

  for (const testCase of TEST_CASES) {
    const result = await runArtifactTest(testCase.name, testCase.query);
    results.push(result);
    await new Promise(r => setTimeout(r, 2000)); // Pause between tests
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 ARTIFACT TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  // Artifact generation statistics
  console.log('\n📦 Artifact Generation Statistics:');
  const artifacts = {
    planning: results.filter(r => r.artifactsGenerated.planning).length,
    pageContext: results.filter(r => r.artifactsGenerated.pageContext).length,
    trajectory: results.filter(r => r.artifactsGenerated.executionTrajectory).length,
    summarization: results.filter(r => r.artifactsGenerated.summarization).length,
    metadata: results.filter(r => r.artifactsGenerated.metadata).length,
  };

  Object.entries(artifacts).forEach(([name, count]) => {
    const percentage = (count / results.length * 100).toFixed(0);
    console.log(`  ${name}: ${count}/${results.length} (${percentage}%)`);
  });

  // Artifact validation statistics
  console.log('\n✅ Artifact Validation Statistics:');
  const validation = {
    planning: results.filter(r => r.artifactValidation.planningValid).length,
    pageContext: results.filter(r => r.artifactValidation.pageContextValid).length,
    trajectory: results.filter(r => r.artifactValidation.trajectoryValid).length,
    summarization: results.filter(r => r.artifactValidation.summarizationValid).length,
    metadata: results.filter(r => r.artifactValidation.metadataValid).length,
  };

  Object.entries(validation).forEach(([name, count]) => {
    const total = artifacts[name as keyof typeof artifacts];
    const percentage = total > 0 ? (count / total * 100).toFixed(0) : '0';
    console.log(`  ${name}: ${count}/${total} valid (${percentage}%)`);
  });

  // Tool calling statistics
  console.log('\n🔧 Tool Calling Statistics:');
  const totalToolCalls = results.reduce((sum, r) => sum + r.toolCalling.totalCalls, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.toolCalling.successfulCalls, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.toolCalling.failedCalls, 0);

  console.log(`  Total Calls: ${totalToolCalls}`);
  console.log(`  Successful: ${totalSuccessful} (${(totalSuccessful / totalToolCalls * 100).toFixed(0)}%)`);
  console.log(`  Failed: ${totalFailed} (${(totalFailed / totalToolCalls * 100).toFixed(0)}%)`);

  // Braintrust tracking
  console.log('\n📊 Braintrust Tracking:');
  const braintrustTests = results.filter(r => r.braintrustTracking.initialized).length;
  const totalEvents = results.reduce((sum, r) => sum + r.braintrustTracking.eventsLogged, 0);
  console.log(`  Tests with Braintrust: ${braintrustTests}/${results.length}`);
  console.log(`  Total Events Logged: ${totalEvents}`);

  // Detailed results
  console.log('\n📋 Detailed Results:\n');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.testName}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Artifacts: Planning=${result.artifactsGenerated.planning}, Trajectory=${result.artifactsGenerated.executionTrajectory}, Summary=${result.artifactsGenerated.summarization}`);
    console.log(`   Validation: P=${result.artifactValidation.planningValid}, T=${result.artifactValidation.trajectoryValid}, S=${result.artifactValidation.summarizationValid}`);
    console.log(`   Tools: ${result.toolCalling.totalCalls} calls, ${result.toolCalling.successfulCalls} successful`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // Exit
  if (failed > 0) {
    console.error(`\n❌ ${failed} artifact test(s) failed`);
    process.exit(1);
  } else {
    console.log('\n✅ All artifact tests passed!');
    process.exit(0);
  }
}

runAllArtifactTests();

