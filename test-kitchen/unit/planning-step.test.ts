// Set polyfills inline before any imports
(globalThis as any).__name = (globalThis as any).__name || ((target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {
    // Ignore if already defined
  }
});

// Unit test for planning step - Critical path component
import { planningStep } from '../../steps/planning-step.js';
import type { BrowserAutomationWorkflowInput } from '../../schemas/workflow-schemas.js';

const LOG_PREFIX = '🧪 [Planning Test]';

async function testPlanningStep() {
  const testStartTime = Date.now();
  console.log(`${LOG_PREFIX} Starting planning step unit test...`);
  console.log(`${LOG_PREFIX} Timestamp: ${new Date().toISOString()}`);
  
  const testInput: BrowserAutomationWorkflowInput = {
    userQuery: 'Navigate to https://example.com and click on any link',
    settings: {
      provider: 'gateway',
      apiKey: process.env.AI_GATEWAY_API_KEY || '',
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
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
  console.log(`  Braintrust Project: ${testInput.settings.braintrustProjectName || 'N/A'}`);

  if (!testInput.settings.apiKey) {
    console.error(`${LOG_PREFIX} ❌ Missing AI_GATEWAY_API_KEY - skipping test`);
    return { success: false, error: 'Missing API key', duration: Date.now() - testStartTime };
  }

  try {
    console.log(`${LOG_PREFIX} Input Details:`);
    console.log(`  Query: "${testInput.userQuery}"`);
    console.log(`  Query Length: ${testInput.userQuery.length} chars`);
    console.log(`  Initial URL: ${testInput.initialContext.currentUrl}`);

    const startTime = Date.now();
    const result = await planningStep(testInput);
    const duration = Date.now() - startTime;

    console.log(`${LOG_PREFIX} ✅ Completed in ${duration}ms`);
    console.log(`${LOG_PREFIX} Result Summary:`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`  Plan Steps: ${result.plan.steps.length}`);
    console.log(`  Estimated Steps: ${result.plan.estimatedSteps}`);
    console.log(`  Complexity Score: ${(result.plan.complexityScore * 100).toFixed(1)}%`);
    console.log(`  Planning Block Length: ${result.planningBlock.length} chars`);
    console.log(`  Has Optimized Query: ${result.plan.hasOptimizedQuery || false}`);
    console.log(`  Information Gaps: ${result.plan.informationGaps?.length || 0}`);
    
    if (result.plan.steps && result.plan.steps.length > 0) {
      console.log(`${LOG_PREFIX} Plan Steps Breakdown:`);
      result.plan.steps.slice(0, 5).forEach((step: any, idx: number) => {
        console.log(`  ${idx + 1}. ${step.action || 'N/A'} - ${step.description?.substring(0, 50) || 'N/A'}...`);
      });
      if (result.plan.steps.length > 5) {
        console.log(`  ... and ${result.plan.steps.length - 5} more steps`);
      }
    }

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

// Auto-run if executed directly
testPlanningStep().then(result => {
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

export { testPlanningStep };

