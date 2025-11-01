// Planning step test - runner (without auto-execution)
import { planningStep } from '../../steps/planning-step.js';
import type { BrowserAutomationWorkflowInput } from '../../schemas/workflow-schemas.js';

const LOG_PREFIX = '🧪 [Planning Test]';

export async function testPlanningStep() {
  console.log(`${LOG_PREFIX} Starting planning step unit test...`);
  
  const testInput: BrowserAutomationWorkflowInput = {
    userQuery: 'Navigate to https://example.com and click on any link',
    settings: {
      provider: 'gateway',
      apiKey: process.env.AI_GATEWAY_API_KEY || '',
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      braintrustApiKey: process.env.BRAINTRUST_API_KEY,
    },
    initialContext: {
      currentUrl: 'about:blank',
    },
    metadata: {
      timestamp: Date.now(),
    },
  };

  if (!testInput.settings.apiKey) {
    console.error(`${LOG_PREFIX} ❌ Missing AI_GATEWAY_API_KEY - skipping test`);
    return { success: false, error: 'Missing API key', skipped: true };
  }

  try {
    console.log(`${LOG_PREFIX} Input:`, {
      query: testInput.userQuery,
      provider: testInput.settings.provider,
      model: testInput.settings.model,
      hasBraintrust: !!testInput.settings.braintrustApiKey,
    });

    const startTime = Date.now();
    const result = await planningStep(testInput);
    const duration = Date.now() - startTime;

    console.log(`${LOG_PREFIX} ✅ Completed in ${duration}ms`);
    console.log(`${LOG_PREFIX} Result:`, {
      success: result.success,
      confidence: result.confidence,
      planSteps: result.plan.steps.length,
      estimatedSteps: result.plan.estimatedSteps,
      complexityScore: result.plan.complexityScore,
      planningBlockLength: result.planningBlock.length,
    });

    // Validate result structure
    if (!result.success) {
      console.error(`${LOG_PREFIX} ❌ Planning step returned success=false`);
      return { success: false, error: result.error || 'Unknown error' };
    }

    if (result.confidence < 0.1) {
      console.warn(`${LOG_PREFIX} ⚠️ Low confidence: ${result.confidence}`);
    }

    if (!result.plan.steps || result.plan.steps.length === 0) {
      console.warn(`${LOG_PREFIX} ⚠️ No steps in plan`);
    }

    console.log(`${LOG_PREFIX} ✅ Test passed`);
    return { success: true, result, duration };

  } catch (error: any) {
    console.error(`${LOG_PREFIX} ❌ Test failed:`, error.message);
    console.error(`${LOG_PREFIX} Stack:`, error.stack);
    return { success: false, error: error.message };
  }
}

