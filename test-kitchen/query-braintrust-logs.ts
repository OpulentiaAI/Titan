#!/usr/bin/env tsx

/**
 * Query Braintrust Logs Programmatically
 * Uses Braintrust SDK to fetch and display recent logs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env') });

interface LogEntry {
  id: string;
  name: string;
  metadata: Record<string, any>;
  timestamp: number;
}

async function queryBraintrustLogs() {
  console.log('🔍 Querying Braintrust Logs\n');
  console.log('='.repeat(80));
  
  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension';
  
  if (!apiKey) {
    console.error('❌ BRAINTRUST_API_KEY not found in environment');
    console.log('\n💡 Set BRAINTRUST_API_KEY in test-kitchen/.env');
    console.log('   Or view logs directly at: https://www.braintrust.dev/app/atlas-extension/logs\n');
    return;
  }
  
  try {
    const { default: braintrust } = await import('braintrust');
    const { Logger } = braintrust;
    
    console.log(`✅ Braintrust SDK loaded`);
    console.log(`📋 Project: ${projectName}`);
    console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...\n`);
    
    // Create logger instance
    const logger = new Logger({
      projectName,
      apiKey,
    });
    
    console.log('📊 Logging Recent Workflow Events...\n');
    
    // Log a test event to verify connection
    logger.log({
      name: 'log_observation_test',
      metadata: {
        timestamp: Date.now(),
        test: true,
        message: 'Testing Braintrust log observation',
      },
    });
    
    console.log('✅ Test log sent to Braintrust');
    console.log('\n💡 View logs at:');
    console.log(`   https://www.braintrust.dev/app/${projectName}/logs`);
    console.log('\n📋 Filter Options:');
    console.log('   - Event name: browser_automation_workflow_*');
    console.log('   - Event name: tool_*');
    console.log('   - Event name: streaming_step_*');
    console.log('   - Time range: Last 24 hours');
    console.log('   - Metadata filters: workflow_id, step_number, tool_name');
    
    console.log('\n🔍 Key Metrics to Monitor:');
    console.log('   - Workflow duration (totalDuration)');
    console.log('   - Step count (total_steps)');
    console.log('   - Tool call count (tool_calls)');
    console.log('   - Success rate (success)');
    console.log('   - Error types (error_type, error_message)');
    
  } catch (error: any) {
    console.error('❌ Error querying Braintrust:', error.message);
    console.log('\n💡 Alternative: View logs directly in Braintrust Dashboard');
    console.log('   https://www.braintrust.dev/app/atlas-extension/logs');
  }
}

async function main() {
  await queryBraintrustLogs();
}

main().catch(console.error);

