#!/usr/bin/env tsx

/**
 * Test Braintrust Logging Setup
 * Verifies that Braintrust logging is working correctly
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env') });

async function testBraintrustLogging() {
  console.log('🧪 Testing Braintrust Logging Setup\n');
  console.log('='.repeat(80));
  
  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension';
  
  if (!apiKey) {
    console.error('❌ BRAINTRUST_API_KEY not found');
    return;
  }
  
  console.log(`✅ API Key: ${apiKey.substring(0, 15)}...`);
  console.log(`✅ Project: ${projectName}\n`);
  
  try {
    const { default: braintrust } = await import('braintrust');
    const { Logger } = braintrust;
    
    console.log('📊 Creating Braintrust Logger...');
    const logger = new Logger({
      projectName,
      apiKey,
    });
    
    console.log('✅ Logger created successfully\n');
    
    // Test logging different event types
    console.log('📝 Testing log events...\n');
    
    // Test workflow event
    logger.log({
      name: 'test_workflow_start',
      metadata: {
        workflow_id: 'test-' + Date.now(),
        test: true,
        message: 'Testing Braintrust logging setup',
        timestamp: Date.now(),
      },
    });
    console.log('✅ Logged: test_workflow_start');
    
    // Test tool execution event
    logger.log({
      name: 'test_tool_navigate_start',
      metadata: {
        tool_name: 'navigate',
        phase: 'start',
        test: true,
        timestamp: Date.now(),
      },
    });
    console.log('✅ Logged: test_tool_navigate_start');
    
    // Test step progress
    logger.log({
      name: 'test_streaming_step_1',
      metadata: {
        workflow_name: 'browser_automation_workflow',
        step_number: 1,
        test: true,
        timestamp: Date.now(),
      },
    });
    console.log('✅ Logged: test_streaming_step_1');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Braintrust Logging Test Complete!');
    console.log('\n💡 View logs at:');
    console.log(`   https://www.braintrust.dev/app/${projectName}/logs`);
    console.log('\n📋 Filter by:');
    console.log('   - Event name: test_*');
    console.log('   - Metadata.test: true');
    console.log('   - Time range: Last hour');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('getSpanId')) {
      console.log('\n💡 OpenTelemetry issue detected');
      console.log('   Run: npm install @opentelemetry/api @opentelemetry/sdk-trace-base');
    }
  }
}

testBraintrustLogging().catch(console.error);

