/**
 * Workflow Enhancements Test
 * 
 * Tests the new workflow utilities:
 * - Parallel execution
 * - Step wrapper (useStep) with retry logic
 * - Centralized metrics collection
 * - Workflow lifecycle management
 */

import { useStep, parallel, startWorkflow, endWorkflow, getWorkflowSummary } from '../../lib/workflow-utils';

async function testParallelExecution() {
  console.log('\n🧪 [Workflow Test] Testing Parallel Execution');
  console.log('='.repeat(70));
  
  const workflowId = `parallel_test_${Date.now()}`;
  startWorkflow(workflowId);
  
  const startTime = Date.now();
  
  // Simulate two independent operations running in parallel
  const [result1, result2] = await parallel([
    useStep('operation-1', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { data: 'Result 1', duration: 100 };
    }),
    useStep('operation-2', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return { data: 'Result 2', duration: 150 };
    }),
  ]);
  
  const totalTime = Date.now() - startTime;
  
  console.log('✅ Parallel execution completed');
  console.log(`   Result 1: ${result1.result.data} (${result1.duration}ms)`);
  console.log(`   Result 2: ${result2.result.data} (${result2.duration}ms)`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Expected sequential time: ~250ms`);
  console.log(`   ⚡ Speedup: ${Math.round(((250 - totalTime) / 250) * 100)}%`);
  
  // Parallel should complete in ~150ms (longest operation), not ~250ms (sum)
  const passed = totalTime < 200 && result1.success && result2.success;
  console.log(`${passed ? '✅' : '❌'} Test ${passed ? 'PASSED' : 'FAILED'}`);
  
  return passed;
}

async function testStepRetry() {
  console.log('\n🧪 [Workflow Test] Testing Step Retry Logic');
  console.log('='.repeat(70));
  
  const workflowId = `retry_test_${Date.now()}`;
  startWorkflow(workflowId);
  
  let attemptCount = 0;
  
  const result = await useStep('retry-test', async () => {
    attemptCount++;
    if (attemptCount < 2) {
      throw new Error('Simulated failure');
    }
    return { success: true, attempts: attemptCount };
  }, {
    retry: 2,
    retryDelay: 50,
  });
  
  console.log('✅ Step completed with retry');
  console.log(`   Attempts: ${result.attempts}`);
  console.log(`   Result: ${JSON.stringify(result.result)}`);
  
  const passed = result.attempts === 2 && result.success && result.result.attempts === 2;
  console.log(`${passed ? '✅' : '❌'} Test ${passed ? 'PASSED' : 'FAILED'}`);
  
  return passed;
}

async function testStepTimeout() {
  console.log('\n🧪 [Workflow Test] Testing Step Timeout');
  console.log('='.repeat(70));
  
  const workflowId = `timeout_test_${Date.now()}`;
  startWorkflow(workflowId);
  
  let timedOut = false;
  
  try {
    await useStep('timeout-test', async () => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay
      return { success: true };
    }, {
      timeout: 100, // 100ms timeout
    });
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      timedOut = true;
      console.log('✅ Timeout triggered correctly');
      console.log(`   Error: ${error.message}`);
    } else {
      throw error;
    }
  }
  
  const passed = timedOut;
  console.log(`${passed ? '✅' : '❌'} Test ${passed ? 'PASSED' : 'FAILED'}`);
  
  return passed;
}

async function testMetricsCollection() {
  console.log('\n🧪 [Workflow Test] Testing Metrics Collection');
  console.log('='.repeat(70));
  
  const workflowId = `test_wf_${Date.now()}`;
  startWorkflow(workflowId);

  // Execute several steps
  await useStep('step-1', async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { data: 1 };
  });

  await useStep('step-2', async () => {
    await new Promise(resolve => setTimeout(resolve, 75));
    return { data: 2 };
  });

  await useStep('step-3', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { data: 3 };
  });
  
  // Get metrics summary
  const summary = getWorkflowSummary(workflowId);
  
  console.log('✅ Metrics collected');
  console.log(`   Workflow ID: ${summary.workflowId}`);
  console.log(`   Total duration: ${summary.totalDuration}ms`);
  console.log(`   Step count: ${summary.stepCount}`);
  console.log(`   Successful steps: ${summary.successful}`);
  console.log(`   Failed steps: ${summary.failed}`);
  console.log(`   Average step duration: ${Math.round(summary.avgStepDuration)}ms`);
  console.log(`   Steps recorded: ${summary.steps.map(s => s.name).join(', ') || '(none)'}`);
  
  const passed = summary.stepCount === 3 && summary.successful === 3;
  console.log(`${passed ? '✅' : '❌'} Test ${passed ? 'PASSED' : 'FAILED'}`);
  
  // Also test endWorkflow which logs summary
  console.log('\n📊 [Workflow Metrics] Summary (from endWorkflow):');
  endWorkflow(workflowId);
  
  return passed;
}

async function testWorkflowLifecycle() {
  console.log('\n🧪 [Workflow Test] Testing Workflow Lifecycle');
  console.log('='.repeat(70));
  
  const workflowId = `lifecycle_wf_${Date.now()}`;
  
  startWorkflow(workflowId);
  console.log('✅ Workflow started');
  
  await useStep('lifecycle-step-1', async () => ({ result: 'step 1' }));
  await useStep('lifecycle-step-2', async () => ({ result: 'step 2' }));
  
  console.log('✅ Steps executed');
  
  const summary = endWorkflow(workflowId);
  console.log('✅ Workflow ended');
  
  const passed = summary.stepCount === 2 && summary.successful === 2;
  console.log(`${passed ? '✅' : '❌'} Test ${passed ? 'PASSED' : 'FAILED'}`);
  
  return passed;
}

async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 WORKFLOW ENHANCEMENTS TEST SUITE');
  console.log('='.repeat(70));
  console.log('\nTesting new workflow utilities:\n');
  console.log('  - Parallel execution');
  console.log('  - Step wrapper with retry logic');
  console.log('  - Step timeout protection');
  console.log('  - Centralized metrics collection');
  console.log('  - Workflow lifecycle management');
  console.log('');
  
  const results = {
    parallel: await testParallelExecution(),
    retry: await testStepRetry(),
    timeout: await testStepTimeout(),
  };
  
  // Add delay to ensure all background operations complete
  await new Promise(resolve => setTimeout(resolve, 200));
  
  results.metrics = await testMetricsCollection();
  results.lifecycle = await testWorkflowLifecycle();
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}\n`);
  
  Object.entries(results).forEach(([test, result]) => {
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
  });
  
  console.log('');
  console.log(`${passed === total ? '🎉' : '⚠️'} Overall: ${passed === total ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('');
  
  return { success: passed === total };
}

export { runAllTests };
