// Quick verification script to check test environment setup
(globalThis as any).__name = (globalThis as any).__name || ((target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {}
});

console.log('🔍 [Setup Verification] Checking test environment...\n');

// Check environment variables
const env = {
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY ? '✅ Set' : '❌ Missing',
  YOU_API_KEY: process.env.YOU_API_KEY ? '✅ Set' : '⚠️  Missing (optional)',
  BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY ? '✅ Set' : '⚠️  Missing (optional)',
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? '✅ Set' : '⚠️  Missing (optional)',
};

console.log('Environment Variables:');
Object.entries(env).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Check imports
console.log('\n🔍 [Setup Verification] Testing imports...');

try {
  const { planningStep } = await import('../steps/planning-step.js');
  console.log('  ✅ planning-step imported');
} catch (e: any) {
  console.error('  ❌ planning-step import failed:', e.message);
}

try {
  const { runDeepSearch } = await import('../deepsearch.js');
  console.log('  ✅ deepsearch imported');
} catch (e: any) {
  console.error('  ❌ deepsearch import failed:', e.message);
}

try {
  const { runYouAdvancedAgentSummary } = await import('../youAgent.js');
  console.log('  ✅ youAgent imported');
} catch (e: any) {
  console.error('  ❌ youAgent import failed:', e.message);
}

try {
  const { browserAutomationWorkflow } = await import('../workflows/browser-automation-workflow.js');
  console.log('  ✅ browser-automation-workflow imported');
} catch (e: any) {
  console.error('  ❌ browser-automation-workflow import failed:', e.message);
}

// Check polyfill
console.log('\n🔍 [Setup Verification] Checking polyfills...');
if (typeof (globalThis as any).__name === 'function') {
  console.log('  ✅ __name polyfill available');
} else {
  console.error('  ❌ __name polyfill missing');
}

console.log('\n✅ [Setup Verification] Complete!\n');

