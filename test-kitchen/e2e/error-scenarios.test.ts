// Error Scenario Tests - Proactively test failure cases
// Ensures error handling works correctly and provides useful debugging info

import { browserAutomationWorkflow } from '../../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput } from '../../schemas/workflow-schemas.js';
import type { Message, PageContext } from '../../types.js';

const LOG_PREFIX = '🧪 [Error Tests]';

interface ErrorTestResult {
  scenario: string;
  expectedError: boolean;
  errorDetected: boolean;
  errorType?: string;
  errorMessage?: string;
  logs: string[];
  passed: boolean;
}

const ERROR_SCENARIOS = [
  {
    name: 'Missing API Key',
    input: {
      userQuery: 'Navigate to example.com',
      settings: {
        provider: 'gateway' as const,
        apiKey: '', // Missing
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        computerUseEngine: 'gateway-flash-lite' as const,
      },
    },
    expectedError: true,
    expectedErrorType: 'Missing API key',
  },
  {
    name: 'Invalid Model',
    input: {
      userQuery: 'Navigate to example.com',
      settings: {
        provider: 'gateway' as const,
        apiKey: process.env.AI_GATEWAY_API_KEY || 'test-key',
        model: 'invalid/model-name',
        computerUseEngine: 'gateway-flash-lite' as const,
      },
    },
    expectedError: true,
    expectedErrorType: 'Model error',
  },
  {
    name: 'Empty Query',
    input: {
      userQuery: '',
      settings: {
        provider: 'gateway' as const,
        apiKey: process.env.AI_GATEWAY_API_KEY || '',
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        computerUseEngine: 'gateway-flash-lite' as const,
      },
    },
    expectedError: false, // Should handle gracefully
    expectedErrorType: null,
  },
  {
    name: 'Very Long Query',
    input: {
      userQuery: 'Navigate to example.com '.repeat(100), // 2500+ chars
      settings: {
        provider: 'gateway' as const,
        apiKey: process.env.AI_GATEWAY_API_KEY || '',
        model: 'google/gemini-2.5-flash-lite-preview-09-2025',
        computerUseEngine: 'gateway-flash-lite' as const,
      },
    },
    expectedError: false, // Should handle gracefully
    expectedErrorType: null,
  },
];

async function testErrorScenario(scenario: typeof ERROR_SCENARIOS[0]): Promise<ErrorTestResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`${LOG_PREFIX} ${msg}`);
  };

  log(`Testing: ${scenario.name}`);
  log(`Expected Error: ${scenario.expectedError}`);
  if (scenario.expectedErrorType) {
    log(`Expected Error Type: ${scenario.expectedErrorType}`);
  }

  const mockContext = {
    executeTool: async () => ({ success: true }),
    enrichToolResponse: async (res: any) => res,
    getPageContextAfterAction: async (): Promise<PageContext> => ({
      url: 'about:blank',
      title: '',
      text: '',
      links: [],
      forms: [],
      viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
    }),
    updateLastMessage: () => {},
    pushMessage: () => {},
    settings: scenario.input.settings,
    messages: [],
  };

  let errorDetected = false;
  let errorType: string | undefined;
  let errorMessage: string | undefined;

  try {
    const workflowInput: BrowserAutomationWorkflowInput = {
      ...scenario.input,
      initialContext: {
        currentUrl: 'about:blank',
        pageContext: {
          url: 'about:blank',
          title: '',
          text: '',
          links: [],
          forms: [],
          viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        },
      },
      metadata: { timestamp: Date.now() },
    };

    log('Executing workflow...');
    const result = await browserAutomationWorkflow(workflowInput, mockContext);
    
    log(`Workflow completed: success=${result.success}`);
    
    if (!result.success) {
      errorDetected = true;
      errorType = 'WorkflowFailure';
      errorMessage = result.error || 'Unknown error';
      log(`Error detected: ${errorMessage}`);
    } else {
      log('No error detected (workflow succeeded)');
    }

  } catch (e: any) {
    errorDetected = true;
    errorType = e?.name || 'Exception';
    errorMessage = e?.message || String(e);
    log(`Exception caught: ${errorType} - ${errorMessage}`);
    
    // Don't throw - we're testing error scenarios
    if (e?.stack) {
      log(`Stack trace: ${e.stack.split('\n').slice(0, 5).join('\n')}`);
    }
    
    // For expected errors, this is fine - return the result
    if (scenario.expectedError) {
      // This is expected - don't fail the test
    }
  }

  const passed = scenario.expectedError === errorDetected &&
    (!scenario.expectedErrorType || errorMessage?.includes(scenario.expectedErrorType));

  log(`Test ${passed ? 'PASSED' : 'FAILED'}`);
  log(`Expected error: ${scenario.expectedError}, Detected: ${errorDetected}`);

  return {
    scenario: scenario.name,
    expectedError: scenario.expectedError,
    errorDetected,
    errorType,
    errorMessage,
    logs,
    passed,
  };
}

async function runErrorScenarioTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 ERROR SCENARIO TEST SUITE');
  console.log('='.repeat(80));
  console.log(`\n📋 Testing ${ERROR_SCENARIOS.length} error scenarios\n`);

  const results: ErrorTestResult[] = [];
  const allLogs: string[] = [];

  for (const scenario of ERROR_SCENARIOS) {
    const result = await testErrorScenario(scenario);
    results.push(result);
    allLogs.push(...result.logs);
    
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 ERROR SCENARIO TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\nTotal Scenarios: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}\n`);

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.scenario}`);
    console.log(`   Expected Error: ${result.expectedError}`);
    console.log(`   Error Detected: ${result.errorDetected}`);
    if (result.errorType) {
      console.log(`   Error Type: ${result.errorType}`);
    }
    if (result.errorMessage) {
      console.log(`   Error Message: ${result.errorMessage.substring(0, 100)}`);
    }
    console.log('');
  });

  // Export logs
  const fs = await import('fs/promises');
  await fs.mkdir('test-output', { recursive: true }).catch(() => {});
  await fs.writeFile('test-output/error-scenario-logs.txt', allLogs.join('\n'));
  
  console.log(`📝 Error scenario logs saved to: test-output/error-scenario-logs.txt`);

  if (failed > 0) {
    console.error(`\n❌ ${failed} error scenario test(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All error scenario tests passed!`);
    process.exit(0);
  }
}

runErrorScenarioTests();

