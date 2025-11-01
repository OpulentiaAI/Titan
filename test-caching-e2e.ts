// End-to-end test for caching functionality
// Run with: npx tsx test-caching-e2e.ts

import { generateExecutionPlanCached, summarizationStepCached } from './lib/cache-utils';

async function testCachingEndToEnd() {
  console.log('🚀 Testing End-to-End Caching Performance\n');

  try {
    // Test data
    const testParams = {
      userQuery: 'Navigate to example.com and find the contact information',
      currentUrl: 'about:blank',
      pageContext: { title: 'Test Page', url: 'about:blank' },
      provider: 'google' as const,
      apiKey: 'test-key', // This will fail but that's ok for timing test
      model: 'gemini-1.5-flash',
    };

    const summaryParams = {
      objective: 'Test objective',
      trajectory: 'Test trajectory data',
      outcome: 'Test outcome',
      youApiKey: '',
      fallbackModel: null,
      fallbackApiKey: 'test-key',
      enableStreaming: false,
      enableFinalization: false,
      finalizationProvider: 'google' as const,
      finalizationModel: 'gemini-1.5-flash',
    };

    // Test planning cache
    console.log('📋 Testing Planning Cache...');

    const planningStart1 = Date.now();
    try {
      await generateExecutionPlanCached.execute(testParams);
    } catch (e) {
      // Expected to fail due to invalid API key, but timing matters
    }
    const planningTime1 = Date.now() - planningStart1;

    const planningStart2 = Date.now();
    try {
      await generateExecutionPlanCached.execute(testParams);
    } catch (e) {
      // Expected to fail
    }
    const planningTime2 = Date.now() - planningStart2;

    console.log(`First planning call: ${planningTime1}ms`);
    console.log(`Second planning call: ${planningTime2}ms`);

    if (planningTime2 < planningTime1 * 0.5) {
      console.log('✅ Planning cache working - second call much faster!');
    } else {
      console.log('⚠️ Planning cache may not be working optimally');
    }

    // Test summarization cache
    console.log('\n📝 Testing Summarization Cache...');

    const summaryStart1 = Date.now();
    try {
      await summarizationStepCached.execute(summaryParams);
    } catch (e) {
      // Expected to fail due to invalid API key
    }
    const summaryTime1 = Date.now() - summaryStart1;

    const summaryStart2 = Date.now();
    try {
      await summarizationStepCached.execute(summaryParams);
    } catch (e) {
      // Expected to fail
    }
    const summaryTime2 = Date.now() - summaryStart2;

    console.log(`First summarization call: ${summaryTime1}ms`);
    console.log(`Second summarization call: ${summaryTime2}ms`);

    if (summaryTime2 < summaryTime1 * 0.5) {
      console.log('✅ Summarization cache working - second call much faster!');
    } else {
      console.log('⚠️ Summarization cache may not be working optimally');
    }

    // Check cache stats if available
    try {
      const planningStats = generateExecutionPlanCached.getStats?.();
      const summaryStats = summarizationStepCached.getStats?.();

      if (planningStats) {
        console.log(`\n📊 Planning Cache Stats:`, planningStats);
      }
      if (summaryStats) {
        console.log(`📊 Summarization Cache Stats:`, summaryStats);
      }
    } catch (e) {
      console.log('Cache stats not available');
    }

    console.log('\n🎉 End-to-end caching test completed!');

  } catch (error) {
    console.error('❌ End-to-end caching test failed:', error);
  }
}

testCachingEndToEnd();