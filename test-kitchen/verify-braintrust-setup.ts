#!/usr/bin/env tsx

/**
 * Verify Braintrust Setup
 * Tests that Braintrust logging is configured correctly
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env') });

async function verifyBraintrustSetup() {
  console.log('🔍 Verifying Braintrust Setup\n');
  console.log('='.repeat(80));
  
  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension';
  
  // Check API key
  if (!apiKey) {
    console.error('❌ BRAINTRUST_API_KEY not found in .env');
    console.log('\n💡 Add to test-kitchen/.env:');
    console.log('   BRAINTRUST_API_KEY=sk-...');
    return false;
  }
  
  console.log(`✅ API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`✅ Project: ${projectName}\n`);
  
  // Test using the existing integration
  try {
    console.log('📦 Testing Braintrust integration...');
    const { initializeBraintrust, logEvent, logStepProgress, logToolExecution } = await import('../lib/braintrust');
    
    // Initialize logger
    const logger = await initializeBraintrust(apiKey, projectName);
    
    if (!logger) {
      console.error('❌ Failed to initialize Braintrust logger');
      return false;
    }
    
    console.log('✅ Braintrust logger initialized\n');
    
    // Test logging functions
    console.log('📝 Testing logging functions...\n');
    
    logEvent('test_setup_verification', {
      test: true,
      timestamp: Date.now(),
      message: 'Braintrust setup verification test',
    });
    console.log('✅ logEvent() - Success');
    
    logStepProgress('browser_automation_workflow', 1, {
      test: true,
      step_name: 'setup_verification',
    });
    console.log('✅ logStepProgress() - Success');
    
    logToolExecution('navigate', 'start', {
      test: true,
      url: 'https://example.com',
    });
    console.log('✅ logToolExecution() - Success');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Braintrust Setup Verified!');
    console.log('\n💡 View logs at:');
    console.log(`   https://www.braintrust.dev/app/${projectName}/logs`);
    console.log('\n📋 Test events to look for:');
    console.log('   - test_setup_verification');
    console.log('   - browser_automation_workflow_step_1');
    console.log('   - tool_navigate_start');
    console.log('\n🔍 Filter by metadata.test = true');
    
    return true;
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nStack:', error.stack);
    return false;
  }
}

verifyBraintrustSetup()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

