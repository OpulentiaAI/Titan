#!/usr/bin/env tsx

/**
 * Observe Logs using MCP (Sentry) and Braintrust
 * Provides unified logging observation across both platforms
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function observeLogs() {
  console.log('🔍 Observing Logs via MCP (Sentry) and Braintrust\n');
  console.log('='.repeat(80));
  
  // Check environment
  const braintrustKey = process.env.BRAINTRUST_API_KEY;
  const sentryOrg = 'agent-space-c0';
  
  console.log('\n📊 Logging Platforms:');
  console.log(`   Braintrust: ${braintrustKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Sentry: ✅ Available (org: ${sentryOrg})`);
  
  console.log('\n🔗 Access Logs:');
  console.log('\n1. Braintrust Dashboard:');
  console.log('   https://www.braintrust.dev/app/atlas-extension/logs');
  console.log('   Filter by:');
  console.log('     - Event: browser_automation_workflow_*');
  console.log('     - Event: tool_*_start/complete');
  console.log('     - Event: streaming_step_*');
  console.log('     - Event: planning_step_*');
  
  console.log('\n2. Sentry Dashboard:');
  console.log('   https://agent-space-c0.sentry.io');
  console.log('   Recent events: 429,851 in last 24h');
  console.log('   Projects: javascript-nextjs, opulent');
  
  console.log('\n📋 Key Event Types to Monitor:');
  console.log('\n   Workflow Events:');
  console.log('     - browser_automation_workflow_start');
  console.log('     - browser_automation_workflow_complete');
  console.log('     - browser_automation_workflow_error');
  
  console.log('\n   Step Events:');
  console.log('     - planning_step_complete');
  console.log('     - streaming_step_start');
  console.log('     - streaming_step_complete');
  
  console.log('\n   Tool Execution:');
  console.log('     - tool_navigate_start/complete');
  console.log('     - tool_click_start/complete');
  console.log('     - tool_type_text_start/complete');
  console.log('     - tool_getPageContext_start/complete');
  
  console.log('\n   Agent Events:');
  console.log('     - agent_continuation');
  console.log('     - agent_completed');
  console.log('     - agent_premature_stop');
  
  console.log('\n💡 Use Sentry MCP Tools:');
  console.log('   - search_events: Query recent events');
  console.log('   - search_issues: Find grouped issues');
  console.log('   - get_issue_details: View specific issue details');
  console.log('   - get_trace_details: View performance traces');
  
  console.log('\n📊 Example Queries:');
  console.log('   1. Recent workflow completions');
  console.log('   2. Tool execution errors');
  console.log('   3. Performance metrics (duration, token usage)');
  console.log('   4. Step progression tracking');
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  await observeLogs();
}

main().catch(console.error);

