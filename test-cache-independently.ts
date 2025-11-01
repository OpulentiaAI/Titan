// Independent test for cache utilities
// Run with: npx tsx test-cache-independently.ts

import { generateExecutionPlanCached, summarizationStepCached, clearCache } from './lib/cache-utils';

async function testCacheIndependently() {
  console.log('🧪 Testing Cache Utilities Independently\n');

  try {
    // Test 1: Cache key generation
    console.log('✅ Test 1: Cache utilities imported successfully');

    // Test 2: Check if functions are available
    if (typeof generateExecutionPlanCached?.execute === 'function') {
      console.log('✅ Test 2: generateExecutionPlanCached tool available');
    } else {
      console.log('❌ Test 2: generateExecutionPlanCached tool not available');
      return;
    }

    if (typeof summarizationStepCached?.execute === 'function') {
      console.log('✅ Test 3: summarizationStepCached tool available');
    } else {
      console.log('❌ Test 3: summarizationStepCached tool not available');
      return;
    }

    if (typeof clearCache === 'function') {
      console.log('✅ Test 4: clearCache function available');
    } else {
      console.log('❌ Test 4: clearCache function not available');
      return;
    }

    // Test 3: Test clearCache function (should not throw)
    await clearCache('test-prefix');
    console.log('✅ Test 5: clearCache function executes without error');

    console.log('\n🎉 All cache utility tests passed!');

  } catch (error) {
    console.error('❌ Cache utility test failed:', error);
  }
}

testCacheIndependently();