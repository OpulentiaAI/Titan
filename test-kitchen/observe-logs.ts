#!/usr/bin/env tsx

/**
 * Observe Logs using Sentry MCP
 * Provides unified access to application logs and events
 */

console.log('🔍 Observing Logs via Sentry MCP\n');
console.log('='.repeat(80));

console.log('\n📊 Sentry Organization: agent-space-c0');
console.log('🔗 Dashboard: https://agent-space-c0.sentry.io');
console.log('📈 Recent Activity: 429,851 events in last 24 hours\n');

console.log('📋 Available Projects:');
console.log('   - javascript-nextjs');
console.log('   - opulent\n');

console.log('🔍 Key Log Types to Observe:\n');

console.log('1. Workflow Execution:');
console.log('   - browser_automation_workflow_start');
console.log('   - browser_automation_workflow_complete');
console.log('   - browser_automation_workflow_error\n');

console.log('2. Tool Execution:');
console.log('   - tool_navigate_start/complete');
console.log('   - tool_click_start/complete');
console.log('   - tool_type_text_start/complete');
console.log('   - tool_getPageContext_start/complete\n');

console.log('3. Step Progression:');
console.log('   - planning_step_complete');
console.log('   - streaming_step_start');
console.log('   - streaming_step_complete\n');

console.log('4. Agent Behavior:');
console.log('   - agent_continuation');
console.log('   - agent_completed');
console.log('   - agent_premature_stop\n');

console.log('💡 Access Methods:\n');

console.log('Method 1: Sentry Dashboard');
console.log('   https://agent-space-c0.sentry.io/explore/logs/');
console.log('   Query: message:"workflow" OR message:"tool" OR message:"step"');
console.log('   Time range: Last 24 hours\n');

console.log('Method 2: Sentry Traces');
console.log('   https://agent-space-c0.sentry.io/explore/traces/');
console.log('   Filter by: span.description contains "workflow"');
console.log('   View performance metrics and duration\n');

console.log('Method 3: Braintrust Dashboard');
console.log('   https://www.braintrust.dev/app/atlas-extension/logs');
console.log('   Requires: BRAINTRUST_API_KEY in .env');
console.log('   Filter by event name patterns above\n');

console.log('📊 Example MCP Queries:\n');
console.log('   - "workflow execution errors from last hour"');
console.log('   - "tool execution logs from browser automation"');
console.log('   - "performance spans and traces"');
console.log('   - "count of all events in the last 24 hours"\n');

console.log('='.repeat(80));
console.log('\n✅ Log observation guide ready!');
console.log('💡 Use Sentry MCP tools to query specific events');

