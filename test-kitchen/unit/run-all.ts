// Set polyfills inline before any imports
(globalThis as any).__name = (globalThis as any).__name || ((target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {
    // Ignore if already defined
  }
});

// NOTE: Importing these causes tests to auto-execute, so we must prevent that
// We'll import from the files manually to avoid auto-execution

const LOG_PREFIX = '🧪 [Unit Tests]';

async function runAllUnitTests() {
  console.log(`${LOG_PREFIX} ==========================================`);
  console.log(`${LOG_PREFIX} Starting Comprehensive Unit Test Suite`);
  console.log(`${LOG_PREFIX} ==========================================\n`);

  const startTime = Date.now();
  const results: Record<string, any> = {};

  // Test 1: Planning Step
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${LOG_PREFIX} TEST 1: Planning Step`);
  console.log(`${'='.repeat(50)}`);
  try {
    const { testPlanningStep } = await import('./planning-step-runner.js');
    results.planning = await testPlanningStep();
  } catch (e: any) {
    console.error(`${LOG_PREFIX} ❌ Planning test failed to load:`, e.message);
    results.planning = { success: false, error: e.message };
  }
  await new Promise(r => setTimeout(r, 1000)); // Brief pause between tests

  // Test 2: Workflow Enhancements
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${LOG_PREFIX} TEST 2: Workflow Enhancements`);
  console.log(`${'='.repeat(50)}`);
  try {
    const { runAllTests } = await import('./workflow-enhancements.test.js');
    results.workflowEnhancements = await runAllTests();
  } catch (e: any) {
    console.error(`${LOG_PREFIX} ❌ Workflow Enhancements test failed to load:`, e.message);
    results.workflowEnhancements = { success: false, error: e.message };
  }
  await new Promise(r => setTimeout(r, 1000));

  // Test 3: Streamdown Streaming
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${LOG_PREFIX} TEST 3: Streamdown Streaming`);
  console.log(`${'='.repeat(50)}`);
  try {
    await import('./streamdown-streaming.test.js');
    results.streamdownStreaming = { success: true };
  } catch (e: any) {
    console.error(`${LOG_PREFIX} ❌ Streamdown Streaming test failed:`, e.message);
    results.streamdownStreaming = { success: false, error: e.message };
  }
  await new Promise(r => setTimeout(r, 1000));

  // Test 4: DeepResearch Integration
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${LOG_PREFIX} TEST 4: DeepResearch Integration`);
  console.log(`${'='.repeat(50)}`);
  try {
    const { runDeepResearchTests } = await import('./deepresearch-integration.test.js');
    results.deepresearchIntegration = await runDeepResearchTests();
  } catch (e: any) {
    console.error(`${LOG_PREFIX} ❌ DeepResearch Integration test failed:`, e.message);
    results.deepresearchIntegration = { success: false, error: e.message };
  }
  await new Promise(r => setTimeout(r, 1000));

  // Final Summary
  const totalDuration = Date.now() - startTime;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${LOG_PREFIX} FINAL SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  
  const passed = Object.values(results).filter((r: any) => r.success && !r.skipped).length;
  const failed = Object.values(results).filter((r: any) => r.success === false && !r.skipped).length;
  const skipped = Object.values(results).filter((r: any) => r.skipped).length;
  const total = Object.keys(results).length;

  console.log(`${LOG_PREFIX} Total Tests: ${total}`);
  console.log(`${LOG_PREFIX} ✅ Passed: ${passed}`);
  console.log(`${LOG_PREFIX} ❌ Failed: ${failed}`);
  console.log(`${LOG_PREFIX} ⏭️  Skipped: ${skipped}`);
  console.log(`${LOG_PREFIX} ⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`${LOG_PREFIX} ==========================================\n`);

  // Detailed results
  Object.entries(results).forEach(([name, result]: [string, any]) => {
    const status = result.skipped ? '⏭️  SKIPPED' : result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${LOG_PREFIX} ${name}: ${status}`);
    if (result.error && !result.skipped) {
      console.log(`${LOG_PREFIX}   Error: ${result.error}`);
    }
    if (result.duration) {
      console.log(`${LOG_PREFIX}   Duration: ${result.duration}ms`);
    }
  });

  const allPassed = failed === 0;
  console.log(`\n${LOG_PREFIX} Overall: ${allPassed ? '✅ ALL TESTS PASSED (excl. skipped)' : '❌ SOME TESTS FAILED'}`);

  return {
    success: allPassed,
    results,
    summary: {
      total,
      passed,
      failed,
      skipped,
      duration: totalDuration,
    },
  };
}

// Auto-run
runAllUnitTests()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error(`${LOG_PREFIX} Fatal error:`, error);
    process.exit(1);
  });

export { runAllUnitTests };

