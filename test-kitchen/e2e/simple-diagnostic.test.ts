// Simple Diagnostic Test - Minimal test to isolate issues
// Tests workflow components in isolation

import { validatePreflight, logPreflightResults } from '../../lib/preflight-validation.js';
import { summarizationStep } from '../../steps/summarization-step.js';

const LOG_PREFIX = '🔬 [DIAGNOSTIC]';

// Set API keys
process.env.YOU_API_KEY = ''; // Coming soon - feature flagged
process.env.AI_GATEWAY_API_KEY = 'vck_0IbZbrEJ0S1AOnRjsFzIicZ8mzTfZqBLaS2PuKY5S72fLGfnKD025hVw';

async function testSummarizationStepDirectly() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 SIMPLE DIAGNOSTIC TEST - SUMMARIZATION STEP');
  console.log('='.repeat(80));
  
  // Test 1: Preflight check
  console.log(`\n${LOG_PREFIX} Test 1: Preflight Validation`);
  const preflight = validatePreflight(process.env);
  logPreflightResults(preflight, true);
  
  if (!preflight.passed) {
    console.error(`${LOG_PREFIX} ❌ Preflight failed - cannot proceed`);
    process.exit(1);
  }
  
  // Test 2: Summarization Step Directly
  console.log(`\n${LOG_PREFIX} Test 2: Summarization Step (Direct Call)`);
  console.log(`${LOG_PREFIX} Testing summarization with You.com API...\n`);
  
  const startTime = Date.now();
  
  try {
    // Create fallback model for when You.com fails
    const { createOpenAI } = await import('@ai-sdk/openai');
    const openai = createOpenAI({
      apiKey: process.env.AI_GATEWAY_API_KEY,
      baseURL: 'https://gateway.ai.vercel.com/v1',
      headers: {
        'X-Vercel-AI-Provider': 'openai',
      },
    });
    const fallbackModel = openai('gpt-4o-mini');
    
    console.log(`${LOG_PREFIX} Fallback model configured: gpt-4o-mini via AI Gateway\n`);
    
    const result = await summarizationStep({
      youApiKey: process.env.YOU_API_KEY || '',
      objective: 'Navigate to example.com and extract information',
      trajectory: `- step 1: navigate to https://example.com (ok)
- step 2: getPageContext (ok)
- step 3: scroll down 500px (ok)`,
      outcome: 'Successfully navigated to example.com. Page title is "Example Domain". Found 1 link to "More information...". Page contains simple demonstration text.',
      enableStreaming: false,
      enableFinalization: false,
      fallbackModel: fallbackModel,
      fallbackApiKey: process.env.AI_GATEWAY_API_KEY,
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`${LOG_PREFIX} ✅ Summarization completed in ${duration}ms`);
    console.log(`${LOG_PREFIX} Results:`);
    console.log(`${LOG_PREFIX}    Success: ${result.success ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Duration: ${result.duration}ms`);
    console.log(`${LOG_PREFIX}    Summary Length: ${result.summary?.length || 0} chars`);
    console.log(`${LOG_PREFIX}    Step Count: ${result.stepCount}`);
    console.log(`${LOG_PREFIX}    Trajectory Length: ${result.trajectoryLength}`);
    
    if (result.summary) {
      console.log(`\n${LOG_PREFIX} 📄 Generated Summary:`);
      console.log('─'.repeat(80));
      console.log(result.summary);
      console.log('─'.repeat(80));
    }
    
    // Test 3: Validate summary quality
    console.log(`\n${LOG_PREFIX} Test 3: Summary Quality Validation`);
    const hasNextSteps = result.summary?.toLowerCase().includes('next') || false;
    const hasKeyFindings = result.summary?.toLowerCase().includes('found') || result.summary?.toLowerCase().includes('result') || false;
    const hasSections = result.summary?.includes('##') || result.summary?.includes('**') || false;
    
    console.log(`${LOG_PREFIX}    Has Next Steps: ${hasNextSteps ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Has Key Findings: ${hasKeyFindings ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX}    Has Sections: ${hasSections ? '✅' : '❌'}`);
    
    const qualityScore = [hasNextSteps, hasKeyFindings, hasSections].filter(Boolean).length;
    const quality = qualityScore === 3 ? 'Excellent' : qualityScore === 2 ? 'Good' : qualityScore === 1 ? 'Fair' : 'Poor';
    console.log(`${LOG_PREFIX}    Overall Quality: ${quality} (${qualityScore}/3)`);
    
    // Summary
    console.log(`\n${LOG_PREFIX} 📊 Test Summary:`);
    console.log(`${LOG_PREFIX}    ✅ Preflight: PASSED`);
    console.log(`${LOG_PREFIX}    ${result.success ? '✅' : '❌'} Summarization: ${result.success ? 'PASSED' : 'FAILED'}`);
    console.log(`${LOG_PREFIX}    ${qualityScore >= 2 ? '✅' : '⚠️'} Quality: ${quality}`);
    console.log(`${LOG_PREFIX}    ⏱️  Duration: ${duration}ms (target: <10000ms)`);
    console.log(`${LOG_PREFIX}    ${duration < 10000 ? '✅' : '❌'} Performance: ${duration < 10000 ? 'PASSED' : 'FAILED'}`);
    
    if (result.success && duration < 10000) {
      console.log(`\n✅ ALL TESTS PASSED!`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  SOME TESTS FAILED`);
      process.exit(1);
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n${LOG_PREFIX} ❌ Summarization failed after ${duration}ms:`);
    console.error(`${LOG_PREFIX} Error:`, error?.message || String(error));
    console.error(`${LOG_PREFIX} Stack:`, error?.stack);
    process.exit(1);
  }
}

testSummarizationStepDirectly();

