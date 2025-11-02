#!/usr/bin/env tsx

/**
 * Test NVIDIA NIM provider integration in actual workflow
 */

import { planningStep } from './steps/planning-step.js';
import type { BrowserAutomationWorkflowInput } from './schemas/workflow-schemas.js';

const LOG_PREFIX = '🧪 [NIM Workflow Test]';

async function testNIMWorkflow() {
  const testStartTime = Date.now();
  console.log(`${LOG_PREFIX} Starting NIM workflow integration test...`);
  console.log(`${LOG_PREFIX} Timestamp: ${new Date().toISOString()}`);

  const testInput: BrowserAutomationWorkflowInput = {
    userQuery: 'Navigate to https://example.com and extract the page title',
    settings: {
      provider: 'nim',
      apiKey: process.env.NIM_API_KEY || '',
      model: 'deepseek-ai/deepseek-r1', // Using working model
      braintrustApiKey: process.env.BRAINTRUST_API_KEY,
      braintrustProjectName: process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension',
    },
    initialContext: {
      currentUrl: 'about:blank',
    },
    metadata: {
      timestamp: Date.now(),
    },
  };

  console.log(`${LOG_PREFIX} Configuration:`);
  console.log(`  Provider: ${testInput.settings.provider}`);
  console.log(`  Model: ${testInput.settings.model}`);
  console.log(`  API Key: ${testInput.settings.apiKey ? `${testInput.settings.apiKey.substring(0, 10)}...` : 'MISSING'}`);
  console.log(`  Braintrust: ${testInput.settings.braintrustApiKey ? 'Enabled' : 'Disabled'}`);

  if (!testInput.settings.apiKey) {
    console.error(`${LOG_PREFIX} ❌ Missing NIM_API_KEY - skipping test`);
    return { success: false, error: 'Missing NIM API key', duration: Date.now() - testStartTime };
  }

  try {
    console.log(`${LOG_PREFIX} 🚀 Executing planning step with NIM provider...`);

    const result = await planningStep(testInput);

    console.log(`${LOG_PREFIX} ✅ Planning step completed successfully!`);
    console.log(`${LOG_PREFIX} 📋 Result summary:`);
    console.log(`  Plan steps: ${result.plan?.length || 0}`);
    console.log(`  Reasoning: ${result.reasoning ? 'Present' : 'Missing'}`);
    console.log(`  Duration: ${Date.now() - testStartTime}ms`);

    if (result.plan && result.plan.length > 0) {
      console.log(`${LOG_PREFIX} 📝 First plan step:`, result.plan[0]);
    }

    return {
      success: true,
      planSteps: result.plan?.length || 0,
      hasReasoning: !!result.reasoning,
      duration: Date.now() - testStartTime
    };

  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Planning step failed:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      duration: Date.now() - testStartTime
    };
  }
}

// Run the test
testNIMWorkflow().then(result => {
  console.log(`${LOG_PREFIX} 🎯 Test completed:`, result);
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error(`${LOG_PREFIX} 💥 Test crashed:`, error);
  process.exit(1);
});