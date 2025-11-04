// Simple test for buildFinalSummaryMessage
// Run with: npm run -s test:message-utils

import { buildFinalSummaryMessage } from '../lib/message-utils';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exitCode = 1;
  }
}

function test_success_case() {
  const workflowOutput = {
    executionTrajectory: [
      { action: 'navigate', success: true },
      { action: 'getPageContext', success: true },
    ],
    pageContext: { url: 'https://www.nba.com' },
    finalUrl: 'https://www.nba.com',
    totalDuration: 1234,
    summarization: { summary: 'All steps executed successfully.' },
    metadata: { workflowId: 'wf_test' },
  };

  const msg = buildFinalSummaryMessage(workflowOutput);
  assert(msg.role === 'assistant', 'message role should be assistant');
  assert(msg.content.includes('Summary & Next Steps'), 'content includes Summary & Next Steps');
  assert(msg.content.includes('TASK_COMPLETED: YES'), 'content includes TASK_COMPLETED: YES');
  assert(msg.content.includes('Final URL: https://www.nba.com'), 'content includes final URL');
}

function test_partial_case() {
  const workflowOutput = {
    executionTrajectory: [
      { action: 'navigate', success: true },
      { action: 'getPageContext', success: false },
    ],
    finalUrl: 'current_page',
    totalDuration: 2222,
    summarization: { summary: '' },
    metadata: { workflowId: 'wf_test2' },
  };

  const msg = buildFinalSummaryMessage(workflowOutput);
  assert(msg.content.includes('Summary & Next Steps'), 'content includes Summary & Next Steps');
  assert(msg.content.includes('TASK_COMPLETED: NO'), 'content includes TASK_COMPLETED: NO');
}

function run() {
  console.log('▶︎ Running message-utils tests...');
  test_success_case();
  test_partial_case();
  if (!process.exitCode) console.log('✅ PASS: message-utils tests');
}

run();

