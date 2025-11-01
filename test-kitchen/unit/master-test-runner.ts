// Master Test Runner - Runs ALL tests and aggregates comprehensive results
// Catches every possible error scenario proactively with full execution traces

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface TestSuiteResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
  exitCode: number;
}

interface MasterTestSummary {
  totalSuites: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  suites: TestSuiteResult[];
  criticalFailures: string[];
  recommendations: string[];
}

const TEST_SUITES = [
  // Phase 1: Unit Tests
  {
    name: 'Planning Step Tests',
    command: 'npm run test:planning',
    phase: 'unit',
    critical: false,
  },
  {
    name: 'Workflow Enhancements',
    command: 'npm run test:workflow-enhancements',
    phase: 'unit',
    critical: false,
  },

  // Phase 2: Production Config Tests
  {
    name: 'Production Configurations',
    command: 'npm run test:prod',
    phase: 'production',
    critical: true,
  },

  // Phase 3: End-to-End Tests
  {
    name: 'Comprehensive E2E Tests',
    command: 'npm run test:e2e:comprehensive',
    phase: 'e2e',
    critical: false,
  },
  {
    name: 'Error Scenario Tests',
    command: 'npm run test:e2e:errors',
    phase: 'e2e',
    critical: false,
  },

  // Phase 4: Trace Capture
  {
    name: 'Full Trace Capture',
    command: 'npm run test:trace',
    phase: 'trace',
    critical: false,
  },
];

async function runTestSuite(suite: typeof TEST_SUITES[0]): Promise<TestSuiteResult> {
  const startTime = Date.now();

  console.log(`\n${'━'.repeat(80)}`);
  console.log(`🧪 Running: ${suite.name}`);
  console.log(`   Command: ${suite.command}`);
  console.log(`   Phase: ${suite.phase}`);
  console.log(`   Critical: ${suite.critical ? 'Yes ⚠️' : 'No'}`);
  console.log('━'.repeat(80));

  try {
    const { stdout, stderr } = await execAsync(suite.command, {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const duration = Date.now() - startTime;
    const output = stdout + (stderr ? '\n\nSTDERR:\n' + stderr : '');

    console.log(`✅ ${suite.name} PASSED (${duration}ms)`);

    return {
      name: suite.name,
      command: suite.command,
      passed: true,
      duration,
      output,
      exitCode: 0,
    };

  } catch (e: any) {
    const duration = Date.now() - startTime;
    const output = (e.stdout || '') + (e.stderr ? '\n\nSTDERR:\n' + e.stderr : '');
    const error = e.message || String(e);

    console.log(`❌ ${suite.name} FAILED (${duration}ms)`);
    console.log(`   Error: ${error.substring(0, 200)}`);

    return {
      name: suite.name,
      command: suite.command,
      passed: false,
      duration,
      output,
      error,
      exitCode: e.code || 1,
    };
  }
}

function analyzeCriticalFailures(results: TestSuiteResult[]): {
  criticalFailures: string[];
  recommendations: string[];
} {
  const criticalFailures: string[] = [];
  const recommendations: string[] = [];

  results.forEach((result, idx) => {
    if (!result.passed && TEST_SUITES[idx].critical) {
      criticalFailures.push(`${result.name}: ${result.error || 'Unknown error'}`);

      // Analyze error and provide recommendations
      const errorText = (result.output + (result.error || '')).toLowerCase();

      if (errorText.includes('bedrock') || errorText.includes('toolconfig') || errorText.includes('inputschema')) {
        recommendations.push(
          `⚠️  Bedrock Schema Issue Detected in "${result.name}":\n` +
          `   - Use Google models instead of Anthropic for browser automation\n` +
          `   - Recommended: google/gemini-2.5-flash-lite-preview-09-2025\n` +
          `   - Root cause: Zod schemas not converting correctly for Bedrock format`
        );
      }

      if (errorText.includes('api key') || errorText.includes('missing') && errorText.includes('key')) {
        recommendations.push(
          `🔑 API Key Issue Detected in "${result.name}":\n` +
          `   - Check environment variables are set\n` +
          `   - Required: AI_GATEWAY_API_KEY, GOOGLE_API_KEY (optional), YOU_API_KEY (optional)\n` +
          `   - Run: npm run env:validate`
        );
      }

      if (errorText.includes('timeout') || errorText.includes('timed out')) {
        recommendations.push(
          `⏱️  Timeout Issue Detected in "${result.name}":\n` +
          `   - Increase timeout settings in test configuration\n` +
          `   - Check network connectivity\n` +
          `   - Consider using faster models for tests`
        );
      }

      if (errorText.includes('schema') && errorText.includes('properties')) {
        recommendations.push(
          `📋 Schema Properties Issue Detected in "${result.name}":\n` +
          `   - Tool schemas may have empty properties\n` +
          `   - Check Zod schema definitions in tool definitions\n` +
          `   - Ensure shape() is called for wrapped schemas`
        );
      }
    }
  });

  // Remove duplicates
  return {
    criticalFailures,
    recommendations: [...new Set(recommendations)],
  };
}

async function exportMasterTestReport(summary: MasterTestSummary) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Generate comprehensive report
  const report = [
    '═'.repeat(80),
    'MASTER TEST SUITE REPORT',
    '═'.repeat(80),
    '',
    `Timestamp: ${new Date().toISOString()}`,
    `Total Test Suites: ${summary.totalSuites}`,
    `✅ Passed: ${summary.passed}`,
    `❌ Failed: ${summary.failed}`,
    `⏭️  Skipped: ${summary.skipped}`,
    `Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s`,
    '',
    '═'.repeat(80),
    'DETAILED RESULTS',
    '═'.repeat(80),
    '',
  ];

  summary.suites.forEach((suite, idx) => {
    report.push(`${suite.passed ? '✅' : '❌'} ${suite.name}`);
    report.push(`   Command: ${suite.command}`);
    report.push(`   Duration: ${suite.duration}ms`);
    report.push(`   Exit Code: ${suite.exitCode}`);

    if (!suite.passed) {
      report.push(`   Error: ${suite.error || 'Unknown'}`);
      report.push('');
      report.push('   Output (last 1000 chars):');
      report.push('   ' + suite.output.substring(suite.output.length - 1000).replace(/\n/g, '\n   '));
    }

    report.push('');
  });

  // Critical failures
  if (summary.criticalFailures.length > 0) {
    report.push('═'.repeat(80));
    report.push('🚨 CRITICAL FAILURES');
    report.push('═'.repeat(80));
    report.push('');
    summary.criticalFailures.forEach(failure => {
      report.push(`❌ ${failure}`);
    });
    report.push('');
  }

  // Recommendations
  if (summary.recommendations.length > 0) {
    report.push('═'.repeat(80));
    report.push('💡 RECOMMENDATIONS');
    report.push('═'.repeat(80));
    report.push('');
    summary.recommendations.forEach(rec => {
      report.push(rec);
      report.push('');
    });
  }

  report.push('═'.repeat(80));
  report.push('END OF REPORT');
  report.push('═'.repeat(80));

  const reportContent = report.join('\n');

  // Save report
  await fs.mkdir('test-output', { recursive: true });
  await fs.writeFile(`test-output/master-test-report-${timestamp}.txt`, reportContent);
  await fs.writeFile('test-output/master-test-report-latest.txt', reportContent);

  // Save individual suite outputs
  for (const suite of summary.suites) {
    const filename = `test-output/${suite.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.txt`;
    await fs.writeFile(filename, suite.output);
  }

  return reportContent;
}

async function runMasterTestSuite() {
  console.log('\n' + '═'.repeat(80));
  console.log('🚀 MASTER TEST SUITE - COMPREHENSIVE VALIDATION');
  console.log('═'.repeat(80));
  console.log('\n📋 Running ALL test suites with full execution tracing');
  console.log('📋 This will catch every possible error scenario proactively\n');

  const startTime = Date.now();
  const results: TestSuiteResult[] = [];

  // Run each test suite
  for (const suite of TEST_SUITES) {
    const result = await runTestSuite(suite);
    results.push(result);

    // Brief pause between suites
    await new Promise(r => setTimeout(r, 2000));
  }

  const totalDuration = Date.now() - startTime;

  // Analyze results
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = 0; // We don't skip tests in this runner

  const { criticalFailures, recommendations } = analyzeCriticalFailures(results);

  const summary: MasterTestSummary = {
    totalSuites: TEST_SUITES.length,
    passed,
    failed,
    skipped,
    totalDuration,
    suites: results,
    criticalFailures,
    recommendations,
  };

  // Print summary
  console.log('\n' + '═'.repeat(80));
  console.log('📊 MASTER TEST SUITE SUMMARY');
  console.log('═'.repeat(80));
  console.log(`\nTotal Suites: ${summary.totalSuites}`);
  console.log(`✅ Passed: ${summary.passed}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⏭️  Skipped: ${summary.skipped}`);
  console.log(`Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s`);
  console.log('');

  // Detailed results by phase
  const phases = ['unit', 'production', 'e2e', 'trace'];
  phases.forEach(phase => {
    const phaseResults = results.filter((_, idx) => TEST_SUITES[idx].phase === phase);
    if (phaseResults.length > 0) {
      console.log(`\n📋 ${phase.toUpperCase()} Phase:`);
      phaseResults.forEach((result, idx) => {
        const suiteIdx = results.indexOf(result);
        const status = result.passed ? '✅' : '❌';
        const critical = TEST_SUITES[suiteIdx].critical ? ' ⚠️' : '';
        console.log(`   ${status} ${result.name}${critical} (${result.duration}ms)`);
      });
    }
  });

  // Critical failures
  if (criticalFailures.length > 0) {
    console.log('\n' + '═'.repeat(80));
    console.log('🚨 CRITICAL FAILURES');
    console.log('═'.repeat(80));
    criticalFailures.forEach(failure => {
      console.log(`\n❌ ${failure}`);
    });
  }

  // Recommendations
  if (recommendations.length > 0) {
    console.log('\n' + '═'.repeat(80));
    console.log('💡 RECOMMENDATIONS');
    console.log('═'.repeat(80));
    recommendations.forEach(rec => {
      console.log(`\n${rec}`);
    });
  }

  // Export comprehensive report
  const reportContent = await exportMasterTestReport(summary);
  console.log('\n' + '═'.repeat(80));
  console.log('📝 REPORTS GENERATED');
  console.log('═'.repeat(80));
  console.log('\n📋 Master Report: test-output/master-test-report-latest.txt');
  console.log('📋 Individual Suite Logs: test-output/[suite-name]-[timestamp].txt');
  console.log('');

  // Exit with appropriate code
  const hasCriticalFailures = results.some((r, idx) => !r.passed && TEST_SUITES[idx].critical);

  if (hasCriticalFailures) {
    console.error('❌ CRITICAL TEST FAILURES DETECTED');
    console.error('   Review the recommendations above and fix issues before deployment');
    process.exit(1);
  } else if (failed > 0) {
    console.warn('⚠️  Some non-critical tests failed');
    console.warn('   Review the report but deployment may proceed');
    process.exit(0); // Non-critical failures don't block
  } else {
    console.log('✅ ALL TESTS PASSED - SYSTEM READY FOR DEPLOYMENT');
    process.exit(0);
  }
}

runMasterTestSuite().catch(err => {
  console.error('Fatal error in master test runner:', err);
  process.exit(1);
});
