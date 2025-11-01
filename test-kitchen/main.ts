import { atlasTask } from './atlasTask.js';
import type { AtlasModel, AtlasSettings } from './types.js';
import { TEST_CASES } from './testCases.js';

// Simple test runner (without Braintrust - for quick testing)
async function main() {
  // Use first test case for quick test
  const testCase = TEST_CASES[0];
  
  // Default settings (mirror production)
  // Note: This runs without Braintrust tracing for quick debugging
  const settings: AtlasSettings = {
    provider: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'google' : 'gateway',
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.AI_GATEWAY_API_KEY || '',
    model: process.env.GOOGLE_GENERATIVE_AI_API_KEY 
      ? 'gemini-2.5-pro' 
      : 'google/gemini-2.5-flash-lite-preview-09-2025',
    computerUseEngine: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'google' : 'gateway-flash-lite',
  };

  const model: AtlasModel = {
    name: settings.provider === 'google' ? 'gemini-2.5-pro' : 'gateway-flash-lite',
    model_slug: settings.model,
    provider: settings.provider,
    computerUseEngine: settings.computerUseEngine,
    maxTokens: 8192,
  };

  const testStartTime = Date.now();
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 PRODUCTION-LIKE TEST RUN`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Test Case: ${testCase.description}`);
  console.log(`Category: ${testCase.category}`);
  console.log(`Input: "${testCase.input}"`);
  console.log(`Input Length: ${testCase.input.length} chars`);
  console.log(`\nConfiguration:`);
  console.log(`  Provider: ${settings.provider}`);
  console.log(`  Model: ${model.name} (${model.model_slug})`);
  console.log(`  Engine: ${model.computerUseEngine}`);
  console.log(`  Max Tokens: ${model.maxTokens}`);
  console.log(`  API Key: ${settings.apiKey ? `${settings.apiKey.substring(0, 10)}...` : 'MISSING'}`);
  console.log(`\nExpected:`);
  if (testCase.expectedUrl) console.log(`  URL: ${testCase.expectedUrl}`);
  if (testCase.expectedContent) console.log(`  Content: ${testCase.expectedContent.substring(0, 50)}...`);
  if (testCase.expectedActions) console.log(`  Actions: ${testCase.expectedActions.join(', ')}`);
  console.log(`${'='.repeat(70)}\n`);

  if (!settings.apiKey) {
    console.error('ERROR: No API key found!');
    console.error('Please set either GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY environment variable');
    console.error('\nCurrent env vars:');
    console.error(`  GOOGLE_GENERATIVE_AI_API_KEY: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'SET' : 'NOT SET'}`);
    console.error(`  AI_GATEWAY_API_KEY: ${process.env.AI_GATEWAY_API_KEY ? 'SET' : 'NOT SET'}`);
    process.exit(1);
  }

  try {
    const taskStartTime = Date.now();
    console.log(`🚀 Starting browser automation task...\n`);
    
    const result = await atlasTask(model, settings, testCase.input);
    
    const totalDuration = Date.now() - testStartTime;
    const taskDuration = Date.now() - taskStartTime;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 TEST RESULTS`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\n✅ Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`⏱️  Task Duration: ${taskDuration}ms`);
    console.log(`📈 Steps Executed: ${result.steps}`);
    console.log(`🌐 Final URL: ${result.finalUrl || 'N/A'}`);
    
    console.log(`\n📊 Token Usage:`);
    console.log(`  Prompt Tokens: ${result.usage.promptTokens || 0}`);
    console.log(`  Completion Tokens: ${result.usage.completionTokens || 0}`);
    console.log(`  Total Tokens: ${result.usage.totalTokens || 0}`);
    
    if (result.error) {
      console.log(`\n❌ Error: ${result.error}`);
    }
    
    console.log(`\n💬 Messages (${result.messages.length}):`);
    result.messages.forEach((msg, idx) => {
      const role = msg.role.toUpperCase().padEnd(10);
      const preview = msg.content.substring(0, 150);
      const more = msg.content.length > 150 ? '...' : '';
      console.log(`  [${idx + 1}] ${role}: ${preview}${more}`);
    });
    
    // Validation
    console.log(`\n🔍 Validation:`);
    if (testCase.expectedUrl && result.finalUrl) {
      const urlMatch = result.finalUrl.includes(testCase.expectedUrl.split('/')[2] || '');
      console.log(`  URL Match: ${urlMatch ? '✅' : '❌'} (expected: ${testCase.expectedUrl}, got: ${result.finalUrl})`);
    }
    if (testCase.expectedActions && result.steps > 0) {
      console.log(`  Actions Executed: ✅ (${result.steps} steps)`);
    }
    
    console.log(`\n${'='.repeat(70)}\n`);
    
    if (!result.success) {
      console.error(`❌ Test failed with error: ${result.error || 'Unknown error'}`);
      process.exit(1);
    }
  } catch (error: any) {
    const duration = Date.now() - testStartTime;
    console.error(`\n${'='.repeat(70)}`);
    console.error(`❌ TEST FAILED`);
    console.error(`${'='.repeat(70)}`);
    console.error(`Duration: ${duration}ms`);
    console.error(`Error Type: ${error?.name || typeof error}`);
    console.error(`Error Message: ${error?.message || String(error)}`);
    if (error?.stack) {
      console.error(`\nStack Trace:`);
      console.error(error.stack.split('\n').slice(0, 15).join('\n'));
    }
    console.error(`${'='.repeat(70)}\n`);
    process.exit(1);
  }
}

main().catch(console.error);

