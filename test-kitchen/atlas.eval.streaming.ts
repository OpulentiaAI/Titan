// Streaming Eval Runner - Live log streaming with Braintrust telemetry
// Runs eval with real-time log streaming to verify tool+Daytona telemetry

import * as braintrust from 'braintrust';
import { createGateway } from '@ai-sdk/gateway';
import { atlasTask } from './atlasTask.js';
import { atlasScorer } from './atlasScorer.js';
import { TEST_CASES } from './testCases.js';
import type { AtlasModel, AtlasSettings } from './types.js';
import { getThreadManager } from '../lib/thread-manager.js';
import { logStagehandEvent } from '../lib/sandbox-lifecycle.js';

const ATLAS_PROJECT = 'atlas-extension';

/**
 * Stream logs from ThreadManager during eval execution
 */
function setupLogStreaming() {
  const threadManager = getThreadManager();
  
  // Subscribe to all tool lifecycle events
  const unsubscribe = threadManager.subscribe((event) => {
    const timestamp = new Date(event.timestamp).toISOString();
    const phaseEmoji = 
      event.phase === 'completed' ? '✅' :
      event.phase === 'error' ? '❌' :
      event.phase === 'executing' ? '🔄' :
      event.phase === 'starting' ? '🚀' :
      '⏳';
    
    console.log(
      `[${timestamp}] ${phaseEmoji} [TOOL] ${event.toolName} (${event.toolCallId.substring(0, 8)}...) - ${event.phase}`
    );
    
    if (event.error) {
      console.error(`    Error: ${event.error}`);
    }
    
    if (event.metadata) {
      const metaStr = JSON.stringify(event.metadata, null, 2).split('\n').slice(0, 3).join('\n');
      if (metaStr.length > 0) {
        console.log(`    Metadata: ${metaStr}${event.metadata && Object.keys(event.metadata).length > 3 ? '...' : ''}`);
      }
    }
  });
  
  return unsubscribe;
}

function atlasEvalStreaming(model: AtlasModel, settings: AtlasSettings) {
  const experimentName = `${ATLAS_PROJECT}-${model.name}-${model.computerUseEngine}-streaming`;
  const environment = process.env.ENVIRONMENT ?? 'test';
  
  console.log('\n' + '='.repeat(80));
  console.log('🧪 STREAMING EVAL RUNNER');
  console.log('='.repeat(80));
  console.log(`Model: ${model.name}`);
  console.log(`Engine: ${model.computerUseEngine}`);
  console.log(`Test Cases: ${TEST_CASES.length}`);
  console.log(`Environment: ${environment}`);
  console.log('='.repeat(80) + '\n');
  
  // Setup log streaming
  const unsubscribe = setupLogStreaming();
  
  logStagehandEvent('eval_runner_start', {
    experiment_name: experimentName,
    test_case_count: TEST_CASES.length,
    model: model.name,
  });
  
  const evalPromise = braintrust.Eval(ATLAS_PROJECT, {
    experimentName,
    data: TEST_CASES.map((tc) => ({ input: tc.input })),
    task: async (input, hooks) => {
      // Handle both string input and object with input property
      const userMessage = typeof input === 'string' ? input : input.input;
      
      console.log(`\n📋 [TEST] ${userMessage.substring(0, 60)}${userMessage.length > 60 ? '...' : ''}`);
      
      const threadManager = getThreadManager();
      threadManager.clearHistory(); // Clear history for each test case
      
      logStagehandEvent('test_case_start', { input: userMessage });
      
      try {
        const result = await atlasTask(model, settings, userMessage);
        
        // Attach tool lifecycle events to result
        const toolLifecycleEvents = threadManager.getHistory();
        
        console.log(`✅ [TEST] Completed: success=${result.success}, steps=${result.steps}`);
        console.log(`    Tool lifecycle events: ${toolLifecycleEvents.length}`);
        console.log(`    Final URL: ${result.finalUrl || 'N/A'}`);
        
        logStagehandEvent('test_case_complete', {
          success: result.success,
          steps: result.steps,
          tool_events: toolLifecycleEvents.length,
          final_url: result.finalUrl,
        });
        
        // Log tool lifecycle summary
        const toolSummary = toolLifecycleEvents.reduce((acc, event) => {
          acc[event.toolName] = (acc[event.toolName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(`    Tool usage: ${JSON.stringify(toolSummary)}`);
        
        return {
          ...result,
          toolLifecycleEvents, // Attach to result for eval output
        };
      } catch (error: any) {
        console.error(`❌ [TEST] Error: ${error?.message || String(error)}`);
        logStagehandEvent('test_case_error', {
          error: error?.message || String(error),
        });
        throw error;
      }
    },
    scores: [atlasScorer],
    maxConcurrency: 1, // Run sequentially to avoid browser conflicts
    metadata: {
      model: model.name,
      model_slug: model.model_slug,
      provider: model.provider,
      computer_use_engine: model.computerUseEngine,
      environment,
      streaming: true,
      telemetry_enabled: true,
    },
  });
  
  // Handle cleanup
  evalPromise.finally(() => {
    unsubscribe();
    logStagehandEvent('eval_runner_complete', {
      experiment_name: experimentName,
    });
  });
  
  return evalPromise;
}

// Debug: Log that file is being executed
console.log('[DEBUG] atlas.eval.streaming.ts loaded');
console.log(`[DEBUG] AI_GATEWAY_API_KEY: ${process.env.AI_GATEWAY_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`[DEBUG] BRAINTRUST_API_KEY: ${process.env.BRAINTRUST_API_KEY ? 'SET' : 'NOT SET'}`);

// AI Gateway Flash Lite engine (recommended)
if (process.env.AI_GATEWAY_API_KEY) {
  const settings: AtlasSettings = {
    provider: 'gateway',
    apiKey: process.env.AI_GATEWAY_API_KEY,
    model: 'google/gemini-2.5-flash-lite-preview-09-2025',
    computerUseEngine: 'gateway-flash-lite',
    braintrustApiKey: process.env.BRAINTRUST_API_KEY,
    braintrustProjectName: ATLAS_PROJECT,
  };

  // Await the eval promise to ensure it completes
  (async () => {
    try {
      await atlasEvalStreaming(
        {
          name: 'gateway-flash-lite',
          model_slug: 'google/gemini-2.5-flash-lite-preview-09-2025',
          provider: 'gateway',
          computerUseEngine: 'gateway-flash-lite',
          maxTokens: 8192,
        },
        settings
      );
    } catch (error) {
      console.error('Eval failed:', error);
      process.exit(1);
    }
  })();
} else {
  console.error('AI_GATEWAY_API_KEY not set. Please set it to run the eval.');
  process.exit(1);
}

