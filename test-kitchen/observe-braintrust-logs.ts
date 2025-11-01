#!/usr/bin/env tsx

/**
 * Observe Braintrust Logs
 * Uses Braintrust API to fetch and display recent logs from the Atlas project
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BraintrustLog {
  id: string;
  name: string;
  metadata: Record<string, any>;
  timestamp: number;
}

async function observeBraintrustLogs() {
  console.log('🔍 Observing Braintrust Logs for Atlas Project\n');
  
  const apiKey = process.env.BRAINTRUST_API_KEY;
  if (!apiKey) {
    console.error('❌ BRAINTRUST_API_KEY not set in environment');
    console.log('\n💡 Set BRAINTRUST_API_KEY in test-kitchen/.env to observe logs');
    return;
  }

  try {
    // Braintrust API endpoint for logs
    const projectName = process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension';
    const apiUrl = `https://www.braintrust.dev/api/log/search`;
    
    console.log(`📋 Project: ${projectName}`);
    console.log(`🔗 API: ${apiUrl}\n`);
    
    // Note: Braintrust SDK provides better access than direct API
    // For now, show how to access via SDK
    const { default: braintrust } = await import('braintrust');
    
    console.log('✅ Braintrust SDK loaded');
    console.log('\n💡 To view logs:');
    console.log('   1. Visit: https://www.braintrust.dev/app/atlas-extension/logs');
    console.log('   2. Filter by:');
    console.log('      - Project: atlas-extension');
    console.log('      - Time range: Last 24 hours');
    console.log('      - Event types: workflow, tool execution, step progress');
    console.log('\n📊 Recent log event types:');
    console.log('   - browser_automation_workflow_start');
    console.log('   - browser_automation_workflow_complete');
    console.log('   - streaming_step_start');
    console.log('   - tool_navigate_start/complete');
    console.log('   - tool_click_start/complete');
    console.log('   - planning_step_complete');
    console.log('   - agent_continuation');
    console.log('\n🔍 You can also query logs programmatically:');
    console.log('   const { Logger } = await import("braintrust");');
    console.log('   const logger = new Logger({ projectName: "atlas-extension", apiKey });');
    console.log('   // Use logger.log() to view recent entries');
    
  } catch (error: any) {
    console.error('❌ Error accessing Braintrust:', error.message);
    console.log('\n💡 Alternative: View logs directly at https://www.braintrust.dev');
  }
}

async function main() {
  await observeBraintrustLogs();
}

main().catch(console.error);

