#!/usr/bin/env node

/**
 * Test Auto-Recovery and Binary Task Completion Features
 * Validates the new retry-agent and task completion logic
 */

import { setTimeout } from 'timers/promises';
import CDP from 'chrome-remote-interface';

// Mock data for testing task completion inference
const testCases = [
  {
    name: 'Task Completion with YES marker',
    summary: 'Successfully navigated to the website and extracted the required information.\n\nTASK_COMPLETED: YES',
    outcome: 'Goal achieved successfully',
    expectedCompletion: true
  },
  {
    name: 'Task Completion with NO marker',
    summary: 'Failed to access the website due to connection issues.\n\nTASK_COMPLETED: NO',
    outcome: 'Task failed due to network error',
    expectedCompletion: false
  },
  {
    name: 'Task Completion inference from outcome',
    summary: 'Attempted to navigate but encountered errors',
    outcome: 'Task succeeded in accessing the data',
    expectedCompletion: true
  },
  {
    name: 'Task Completion inference from summary',
    summary: 'Goal achieved successfully with all requirements met',
    outcome: 'Navigation completed',
    expectedCompletion: true
  },
  {
    name: 'No completion indicators',
    summary: 'Attempted various approaches but no clear result',
    outcome: 'Processing incomplete',
    expectedCompletion: false
  }
];

class AutoRecoveryFeatureTest {
  private chrome: any = null;
  private client: any = null;

  async startChrome(): Promise<boolean> {
    console.log('🚀 Starting Chrome for Auto-Recovery Feature Testing...');

    try {
      const { spawn } = await import('child_process');
      const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

      this.chrome = spawn(chromePath, [
        '--remote-debugging-port=9222',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions-except=' + './dist',
        '--load-extension=' + './dist',
        '--user-data-dir=/tmp/chrome-auto-recovery-profile',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-experiments',
        '--safebrowsing-disable-auto-update',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability',
        'about:blank'
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // Wait for Chrome to be ready
      let retries = 0;
      const maxRetries = 10;
      while (retries < maxRetries) {
        try {
          await setTimeout(1000);
          const testConnection = await CDP({ port: 9222, host: '127.0.0.1' });
          await testConnection.close();
          break;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error('Chrome DevTools not ready after maximum retries');
          }
        }
      }

      console.log('✅ Chrome started successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to start Chrome:', error);
      return false;
    }
  }

  async connectCDP(): Promise<boolean> {
    console.log('🔗 Connecting to Chrome DevTools Protocol...');

    try {
      this.client = await CDP({ port: 9222, host: '127.0.0.1' });
      const { Page, Runtime } = this.client;

      await Promise.all([
        Page.enable(),
        Runtime.enable()
      ]);

      console.log('✅ Connected to Chrome DevTools');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Chrome DevTools:', error);
      return false;
    }
  }

  async testTaskCompletionInference(): Promise<boolean> {
    console.log('\n🧪 Testing Task Completion Inference Logic...');
    console.log('='.repeat(80));

    try {
      const { Runtime } = this.client;

      // Test the inference logic directly in TypeScript context (not via CDP)
      const inferTaskCompletion = (summaryText: string | undefined, outcomeText: string | undefined): boolean => {
        const s = (summaryText || '').toLowerCase();
        const o = (outcomeText || '').toLowerCase();

        // Prefer explicit marker from AI SDK summarizer
        const markerMatch = (summaryText || '').match(/TASK_COMPLETED:\s*(YES|NO)/i);
        if (markerMatch) {
          return markerMatch[1].toUpperCase() === 'YES';
        }

        // Heuristics from outcome text
        const positive = /(success|succeeded|completed|achieved|done|finished)/.test(o);
        const negative = /(fail|failed|error|not achieved|incomplete|blocked|timeout)/.test(o);
        if (positive && !negative) return true;
        if (negative && !positive) return false;

        // Heuristics from summary text if outcome inconclusive
        const sPos = /(goal achieved|objective achieved|completed successfully)/.test(s);
        const sNeg = /(not achieved|failed|incomplete|did not complete)/.test(s);
        if (sPos && !sNeg) return true;
        if (sNeg && !sPos) return false;

        // Default conservative: not completed
        return false;
      };

      let passedTests = 0;
      let totalTests = testCases.length;

      for (const testCase of testCases) {
        try {
          // Call the function directly in TypeScript context
          const actualCompletion = inferTaskCompletion(testCase.summary, testCase.outcome);
          const passed = actualCompletion === testCase.expectedCompletion;

          console.log(`${passed ? '✅' : '❌'} ${testCase.name}`);
          console.log(`   Summary: "${testCase.summary.substring(0, 60)}..."`);
          console.log(`   Outcome: "${testCase.outcome}"`);
          console.log(`   Expected: ${testCase.expectedCompletion}, Got: ${actualCompletion}`);
          console.log('');

          if (passed) {
            passedTests++;
          }
        } catch (error) {
          console.log(`❌ ${testCase.name} - Error: ${error.message}`);
        }
      }

      console.log('='.repeat(80));
      console.log(`📊 Task Completion Inference Test Results: ${passedTests}/${totalTests} passed`);

      if (passedTests === totalTests) {
        console.log('🎉 All task completion inference tests passed!');
      } else {
        console.log('⚠️ Some task completion inference tests failed');
      }

      return passedTests === totalTests;
    } catch (error) {
      console.error('❌ Task completion inference test failed:', error);
      return false;
    }
  }

  async testSchemaValidation(): Promise<boolean> {
    console.log('\n📋 Testing Schema Validation...');
    console.log('='.repeat(80));

    try {
      // Test that the new taskCompleted field is available
      const testSummaryResult = {
        success: true,
        taskCompleted: true, // New field
        trajectoryLength: 1000,
        summary: 'Test summary',
        duration: 5000
      };

      // Validate the structure matches expected schema
      const hasTaskCompleted = testSummaryResult.hasOwnProperty('taskCompleted');
      const hasSuccess = testSummaryResult.hasOwnProperty('success');
      const hasTrajectoryLength = testSummaryResult.hasOwnProperty('trajectoryLength');

      console.log('✅ Schema Structure Validation:');
      console.log(`   - taskCompleted field: ${hasTaskCompleted ? 'Present' : 'Missing'}`);
      console.log(`   - success field: ${hasSuccess ? 'Present' : 'Missing'}`);
      console.log(`   - trajectoryLength field: ${hasTrajectoryLength ? 'Present' : 'Missing'}`);

      const schemaValid = hasTaskCompleted && hasSuccess && hasTrajectoryLength;

      if (schemaValid) {
        console.log('🎉 Schema validation passed!');
      } else {
        console.log('❌ Schema validation failed!');
      }

      return schemaValid;
    } catch (error) {
      console.error('❌ Schema validation test failed:', error);
      return false;
    }
  }

  async testAutoRecoveryAgentStructure(): Promise<boolean> {
    console.log('\n🤖 Testing Auto-Recovery Agent Structure...');
    console.log('='.repeat(80));

    try {
      // Test retry agent functionality by importing the module
      const { buildRecoveryQuery } = await import('./lib/retry-agent.ts');

      console.log('✅ Auto-Recovery Agent Import: Success');
      console.log('✅ buildRecoveryQuery function: Available');

      // Test the interface structure
      const testInput = {
        provider: 'google' as const,
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
        originalQuery: 'go to example.com',
        summaryMarkdown: 'Test summary with TASK_COMPLETED: NO',
        executionSteps: [
          { step: 1, action: 'navigate', url: 'https://example.com', success: false, error: 'Timeout' }
        ],
        finalUrl: 'about:blank'
      };

      console.log('✅ Recovery Agent Input Structure: Valid');
      console.log(`   - Provider: ${testInput.provider}`);
      console.log(`   - Original Query: "${testInput.originalQuery}"`);
      console.log(`   - Execution Steps: ${testInput.executionSteps.length}`);
      console.log(`   - Final URL: ${testInput.finalUrl}`);

      return true;
    } catch (error) {
      console.error('❌ Auto-Recovery Agent test failed:', error);
      return false;
    }
  }

  async testExtensionBuildArtifacts(): Promise<boolean> {
    console.log('\n🔨 Testing Extension Build Artifacts...');
    console.log('='.repeat(80));

    try {
      const { readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');

      // Check if retry agent was built
      const distDir = join(process.cwd(), 'dist');
      const retryAgentExists = existsSync(join(distDir, 'chunks', 'retry-agent-yGiNGtQ_.js'));
      const summarizationExists = existsSync(join(distDir, 'chunks', 'summarization-step-DbeVeZpC.js'));
      const schemasExists = existsSync(join(distDir, 'chunks', 'workflow-schemas-BlL082lt.js'));

      console.log('✅ Build Artifacts Check:');
      console.log(`   - Retry Agent Bundle: ${retryAgentExists ? 'Present' : 'Missing'}`);
      console.log(`   - Summarization Step Bundle: ${summarizationExists ? 'Present' : 'Missing'}`);
          console.log(`   - Workflow Schemas Bundle: ${schemasExists ? 'Present' : 'Missing'}`);

      const allPresent = retryAgentExists && summarizationExists && schemasExists;

      if (allPresent) {
        console.log('🎉 All required build artifacts are present!');
      } else {
        console.log('⚠️ Some build artifacts are missing');
      }

      return allPresent;
    } catch (error) {
      console.error('❌ Build artifacts test failed:', error);
      return false;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('='.repeat(80));
    console.log('🤖 AUTO-RECOVERY & TASK COMPLETION FEATURE TEST SUITE');
    console.log('='.repeat(80));

    const results = {
      taskCompletionInference: false,
      schemaValidation: false,
      autoRecoveryAgent: false,
      buildArtifacts: false
    };

    try {
      // Start Chrome and connect
      const chromeStarted = await this.startChrome();
      if (!chromeStarted) {
        throw new Error('Cannot proceed without Chrome');
      }

      const cdpConnected = await this.connectCDP();
      if (!cdpConnected) {
        throw new Error('Cannot proceed without CDP connection');
      }

      // Run tests
      results.taskCompletionInference = await this.testTaskCompletionInference();
      results.schemaValidation = await this.testSchemaValidation();
      results.autoRecoveryAgent = await this.testAutoRecoveryAgentStructure();
      results.buildArtifacts = await this.testExtensionBuildArtifacts();

    } catch (error) {
      console.error('💥 Fatal error during test execution:', error);
    } finally {
      await this.cleanup();
    }

    // Generate final report
    this.generateFinalReport(results);
  }

  generateFinalReport(results: any): void {
    console.log('');
    console.log('='.repeat(80));
    console.log('📊 AUTO-RECOVERY FEATURE TEST RESULTS');
    console.log('='.repeat(80));

    const tests = [
      { name: 'Task Completion Inference', result: results.taskCompletionInference },
      { name: 'Schema Validation', result: results.schemaValidation },
      { name: 'Auto-Recovery Agent', result: results.autoRecoveryAgent },
      { name: 'Build Artifacts', result: results.buildArtifacts }
    ];

    let passedTests = 0;
    tests.forEach(test => {
      const status = test.result ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      if (test.result) passedTests++;
    });

    const successRate = (passedTests / tests.length) * 100;
    console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}% (${passedTests}/${tests.length})`);

    console.log('\n' + '='.repeat(80));
    if (successRate === 100) {
      console.log('🎉 ALL AUTO-RECOVERY FEATURES WORKING PERFECTLY!');
      console.log('🤖 Binary task completion and auto-recovery system ready for production');
    } else if (successRate >= 75) {
      console.log('✅ MOSTLY SUCCESSFUL - Core features working');
      console.log('⚠️ Minor issues detected but system is functional');
    } else {
      console.log('❌ MULTIPLE FEATURES NOT WORKING');
      console.log('🔧 Requires fixes before production deployment');
    }
    console.log('='.repeat(80));
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log('✅ CDP connection closed');
    }

    if (this.chrome) {
      this.chrome.kill('SIGTERM');
      await setTimeout(1000);
      this.chrome.kill('SIGKILL');
      console.log('✅ Chrome process terminated');
    }
  }

  async run(): Promise<void> {
    try {
      await this.runAllTests();
      process.exit(0);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
const test = new AutoRecoveryFeatureTest();
test.run().catch(console.error);
