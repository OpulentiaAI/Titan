#!/usr/bin/env tsx
// Direct streaming test runner - no Braintrust CLI, just local execution with logs

// CRITICAL: Polyfill MUST be set before any imports
// Set on all possible global objects to ensure it's available everywhere
const __namePolyfill = (target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {
    // Ignore if already defined
  }
  return target;
};

(globalThis as any).__name = __namePolyfill;
(global as any).__name = __namePolyfill;
(Function.prototype as any).__name = __namePolyfill;
// Also set it as a global variable
if (typeof window !== 'undefined') {
  (window as any).__name = __namePolyfill;
}

// Verify it's set
Object.defineProperty(global, '__name', {
  value: __namePolyfill,
  writable: false,
  enumerable: true,
  configurable: false,
});

console.log('🚀 Starting direct streaming test...\n');

// Check polyfill is set
if (typeof (globalThis as any).__name !== 'function') {
  console.error('❌ __name polyfill failed to load');
  process.exit(1);
}

console.log('✅ __name polyfill loaded');

// Check API key
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error('❌ AI_GATEWAY_API_KEY not set');
  process.exit(1);
}

console.log('✅ API key found');

// NOW import modules after polyfill is set
async function run() {
  const { atlasTask } = await import('./atlasTask.js');
  const { getThreadManager } = await import('../lib/thread-manager.js');
  
  // Setup log streaming
  const threadManager = getThreadManager();
  threadManager.subscribe((event: any) => {
    const timestamp = new Date(event.timestamp).toISOString();
    const phaseEmoji = 
      event.phase === 'completed' ? '✅' :
      event.phase === 'error' ? '❌' :
      event.phase === 'executing' ? '🔄' :
      event.phase === 'starting' ? '🚀' : '⏳';
    
    console.log(`[${timestamp}] ${phaseEmoji} ${event.toolName} (${event.toolCallId.slice(0, 8)}) - ${event.phase}`);
    
    if (event.error) {
      console.error(`  ❌ Error: ${event.error}`);
    }
  });

  const model = {
    name: 'gateway-flash-lite',
    model_slug: 'google/gemini-2.5-flash-lite-preview-09-2025',
    provider: 'gateway' as const,
    computerUseEngine: 'gateway-flash-lite' as const,
    maxTokens: 8192,
  };

  const settings = {
    provider: 'gateway' as const,
    apiKey: process.env.AI_GATEWAY_API_KEY!,
    model: 'google/gemini-2.5-flash-lite-preview-09-2025',
    computerUseEngine: 'gateway-flash-lite' as const,
  };

  const testInput = 'Navigate to https://example.com';

  console.log(`\n📋 Test: ${testInput}\n`);

  try {
    console.log('🔧 Calling atlasTask...');
    const result = await atlasTask(model, settings, testInput);
    
    console.log('✅ atlasTask returned:', JSON.stringify(result, null, 2));
    const history = threadManager.getHistory();
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));
    console.log(`Success: ${result.success}`);
    console.log(`Steps: ${result.steps}`);
    console.log(`Final URL: ${result.finalUrl || 'N/A'}`);
    console.log(`Tool events: ${history.length}`);
    
    // Tool usage summary
    const toolSummary = history.reduce((acc: any, event: any) => {
      acc[event.toolName] = (acc[event.toolName] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`Tool usage: ${JSON.stringify(toolSummary, null, 2)}`);
    console.log('='.repeat(80));
    
    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error?.message || String(error));
    console.error(error?.stack);
    process.exit(1);
  }
}

run();
