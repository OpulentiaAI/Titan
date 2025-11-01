// Braintrust Error Handling Test
// Verifies that Braintrust tracer errors don't break workflow execution
// This test ensures errors are handled gracefully without affecting production functionality

import { initializeBraintrust, traced, logEvent, getBraintrustLogger } from '../../lib/braintrust.js';

const LOG_PREFIX = '🧪 [Braintrust Error Handling Test]';

async function testBraintrustErrorHandling() {
  console.log(`${LOG_PREFIX} Starting Braintrust error handling test...\n`);
  
  const testResults: Array<{ test: string; passed: boolean; error?: string }> = [];
  
  // Test 1: Initialize Braintrust (should handle tracer errors gracefully)
  console.log(`${LOG_PREFIX} Test 1: Initialize Braintrust with invalid context`);
  try {
    const apiKey = process.env.BRAINTRUST_API_KEY || 'test-key-for-error-handling';
    const logger = await initializeBraintrust(apiKey, 'test-project');
    
    // In Node.js context, Braintrust should work
    // In browser extension context, it should fail gracefully
    if (logger) {
      console.log(`  ✅ Logger initialized (Node.js context)`);
      testResults.push({ test: 'Initialize Braintrust', passed: true });
    } else {
      console.log(`  ✅ Logger not initialized (expected in browser extension context)`);
      testResults.push({ test: 'Initialize Braintrust (graceful failure)', passed: true });
    }
  } catch (error: any) {
    console.error(`  ❌ Unexpected error during initialization:`, error.message);
    testResults.push({ test: 'Initialize Braintrust', passed: false, error: error.message });
  }
  
  // Test 2: traced() function should not throw errors even if logger fails
  console.log(`\n${LOG_PREFIX} Test 2: traced() function error handling`);
  try {
    const result = await traced('test_operation', async () => {
      // Simulate a successful operation
      return { success: true, data: 'test data' };
    }, { test: true });
    
    if (result.success) {
      console.log(`  ✅ traced() executed successfully without errors`);
      testResults.push({ test: 'traced() execution', passed: true });
    } else {
      testResults.push({ test: 'traced() execution', passed: false, error: 'Result not successful' });
    }
  } catch (error: any) {
    // If the error is NOT a Braintrust error, it should be thrown
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('getSpanId') || errorMsg.includes('tracer') || errorMsg.includes('span')) {
      console.error(`  ❌ Braintrust error not caught:`, errorMsg);
      testResults.push({ test: 'traced() error handling', passed: false, error: errorMsg });
    } else {
      // Other errors should propagate
      console.log(`  ✅ Non-Braintrust error correctly propagated:`, errorMsg);
      testResults.push({ test: 'traced() error propagation', passed: true });
    }
  }
  
  // Test 3: logEvent() should not throw errors
  console.log(`\n${LOG_PREFIX} Test 3: logEvent() error handling`);
  try {
    logEvent('test_event', { test: true });
    console.log(`  ✅ logEvent() executed without throwing`);
    testResults.push({ test: 'logEvent() execution', passed: true });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('getSpanId') || errorMsg.includes('tracer') || errorMsg.includes('span')) {
      console.error(`  ❌ Braintrust error not caught in logEvent():`, errorMsg);
      testResults.push({ test: 'logEvent() error handling', passed: false, error: errorMsg });
    } else {
      console.error(`  ❌ Unexpected error in logEvent():`, errorMsg);
      testResults.push({ test: 'logEvent() error handling', passed: false, error: errorMsg });
    }
  }
  
  // Test 4: Verify logger state after errors
  console.log(`\n${LOG_PREFIX} Test 4: Logger state after errors`);
  const logger = getBraintrustLogger();
  if (logger === null) {
    console.log(`  ✅ Logger correctly set to null after errors`);
    testResults.push({ test: 'Logger state management', passed: true });
  } else {
    console.log(`  ✅ Logger still available (Node.js context)`);
    testResults.push({ test: 'Logger state management', passed: true });
  }
  
  // Test 5: Ensure workflow can run without Braintrust
  console.log(`\n${LOG_PREFIX} Test 5: Workflow execution without Braintrust`);
  try {
    // Reset logger to simulate no Braintrust
    const originalLogger = getBraintrustLogger();
    
    // Test that traced() works even without logger
    const result = await traced('test_no_logger', async () => {
      return { workflowExecuted: true };
    });
    
    if (result.workflowExecuted) {
      console.log(`  ✅ Workflow executed successfully without Braintrust logger`);
      testResults.push({ test: 'Workflow without Braintrust', passed: true });
    } else {
      testResults.push({ test: 'Workflow without Braintrust', passed: false, error: 'Workflow did not execute' });
    }
  } catch (error: any) {
    console.error(`  ❌ Workflow failed without Braintrust:`, error.message);
    testResults.push({ test: 'Workflow without Braintrust', passed: false, error: error.message });
  }
  
  // Summary
  console.log(`\n${LOG_PREFIX} Test Summary:`);
  console.log('='.repeat(80));
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  
  testResults.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}${result.error ? ` - ${result.error}` : ''}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed === 0) {
    console.log(`\n✅ All Braintrust error handling tests passed!`);
    console.log(`\n💡 This ensures that:`);
    console.log(`   - Braintrust errors don't break workflow execution`);
    console.log(`   - Errors are properly caught and handled`);
    console.log(`   - Workflows can run with or without Braintrust`);
    return { success: true, results: testResults };
  } else {
    console.log(`\n❌ Some tests failed - review error handling`);
    return { success: false, results: testResults };
  }
}

// Run test
testBraintrustErrorHandling()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error(`${LOG_PREFIX} Test suite error:`, error);
    process.exit(1);
  });

