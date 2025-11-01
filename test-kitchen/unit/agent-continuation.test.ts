// AI SDK 6 ToolLoopAgent Continuation Test
// Tests that the new agent primitives enable unlimited multi-step execution
// Enhanced with real-time debugging logs

import { z } from 'zod';
import { tool, Experimental_Agent as ToolLoopAgent, stepCountIs } from 'ai';
import { createGateway } from '@ai-sdk/gateway';

const LOG_PREFIX = '🤖 [Agent Test]';

// Real-time debug logger with timestamps
class DebugLogger {
  private startTime: number;
  private stepTimings: Array<{ step: number; start: number; end?: number; duration?: number }> = [];
  private toolTimings: Array<{ tool: string; call: number; start: number; end?: number; duration?: number }> = [];

  constructor() {
    this.startTime = Date.now();
  }

  timestamp(): string {
    const elapsed = Date.now() - this.startTime;
    return `[${elapsed.toString().padStart(6, '0')}ms]`;
  }

  log(level: 'info' | 'debug' | 'success' | 'error' | 'warn', message: string, data?: any) {
    const icon = {
      info: 'ℹ️',
      debug: '🔍',
      success: '✅',
      error: '❌',
      warn: '⚠️'
    }[level];

    const timestamp = this.timestamp();
    const msg = `${timestamp} ${icon} ${message}`;
    
    if (data) {
      console.log(msg, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    } else {
      console.log(msg);
    }
  }

  stepStart(step: number) {
    const timing = { step, start: Date.now() };
    this.stepTimings.push(timing);
    this.log('info', `Step ${step} started`);
  }

  stepEnd(step: number, finishReason: string) {
    const timing = this.stepTimings.find(t => t.step === step && !t.end);
    if (timing) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;
      this.log('success', `Step ${step} finished (${timing.duration}ms): ${finishReason}`);
    }
  }

  toolCalled(toolName: string, callNumber: number) {
    const timing = { tool: toolName, call: callNumber, start: Date.now() };
    this.toolTimings.push(timing);
    this.log('debug', `Tool call #${callNumber}: ${toolName}`, { tool: toolName });
  }

  toolResult(toolName: string, success: boolean, result?: any) {
    const timing = this.toolTimings.find(t => t.tool === toolName && !t.end);
    if (timing) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;
      const status = success ? '✅' : '❌';
      this.log(success ? 'success' : 'error', 
        `Tool ${toolName} completed (${timing.duration}ms): ${status}`, 
        result ? { preview: JSON.stringify(result).substring(0, 100) } : undefined
      );
    }
  }

  streamEvent(type: string, data?: any) {
    this.log('debug', `Stream event: ${type}`, data);
  }

  summary() {
    const totalDuration = Date.now() - this.startTime;
    const avgStepTime = this.stepTimings.length > 0
      ? this.stepTimings.reduce((sum, t) => sum + (t.duration || 0), 0) / this.stepTimings.length
      : 0;
    const avgToolTime = this.toolTimings.length > 0
      ? this.toolTimings.reduce((sum, t) => sum + (t.duration || 0), 0) / this.toolTimings.length
      : 0;

    this.log('info', 'Execution Summary', {
      totalDuration: `${totalDuration}ms`,
      steps: this.stepTimings.length,
      avgStepTime: `${avgStepTime.toFixed(0)}ms`,
      tools: this.toolTimings.length,
      avgToolTime: `${avgToolTime.toFixed(0)}ms`,
    });
  }
}

const apiKey = process.env.AI_GATEWAY_API_KEY;

if (!apiKey) {
  console.error(`${LOG_PREFIX} ❌ Missing AI_GATEWAY_API_KEY - skipping test`);
  process.exit(0);
}

console.log(`${LOG_PREFIX} Testing AI SDK 6 ToolLoopAgent with unlimited steps...`);
console.log(`${LOG_PREFIX} Real-time debugging enabled with detailed execution logs\n`);

// Track tool execution with detailed logging
let toolCallSequence: string[] = [];
let globalLogger: DebugLogger;

const tools = {
  navigate: tool({
    description: 'Navigate to a URL',
    parameters: z.object({ url: z.string().url() }),
    execute: async ({ url }: { url: string }) => {
      const call = `navigate(${url})`;
      const callNumber = toolCallSequence.length + 1;
      toolCallSequence.push(call);
      
      if (globalLogger) {
        globalLogger.toolCalled('navigate', callNumber);
      }
      
      // Simulate navigation delay
      await new Promise(r => setTimeout(r, 50));
      
      const result = { 
        success: true, 
        message: `Navigated to ${url}. Page shows "Example Domain" with a link to "More information".`
      };
      
      if (globalLogger) {
        globalLogger.toolResult('navigate', true, result);
      }
      
      return result;
    },
  }),
  
  getPageContext: tool({
    description: 'Get current page context (title, text, links)',
    parameters: z.object({
      refresh: z.boolean().default(true).optional()
    }),
    execute: async () => {
      const call = 'getPageContext()';
      const callNumber = toolCallSequence.length + 1;
      toolCallSequence.push(call);
      
      if (globalLogger) {
        globalLogger.toolCalled('getPageContext', callNumber);
      }
      
      await new Promise(r => setTimeout(r, 30));
      
      const result = { 
        success: true,
        url: 'https://example.com',
        title: 'Example Domain',
        text: 'This domain is for use in illustrative examples. You can find more info here.',
        links: [
          { text: 'More information...', href: 'https://www.iana.org/domains/example' }
        ]
      };
      
      if (globalLogger) {
        globalLogger.toolResult('getPageContext', true, result);
      }
      
      return result;
    },
  }),
  
  click: tool({
    description: 'Click an element by selector or text',
    parameters: z.object({
      selector: z.string().optional(),
      text: z.string().optional(),
    }),
    execute: async ({ selector, text }: { selector?: string; text?: string }) => {
      const target = text || selector || 'element';
      const call = `click(${target})`;
      const callNumber = toolCallSequence.length + 1;
      toolCallSequence.push(call);
      
      if (globalLogger) {
        globalLogger.toolCalled('click', callNumber);
      }
      
      await new Promise(r => setTimeout(r, 40));
      
      const result = { 
        success: true,
        message: `Clicked "${target}". Navigated to https://www.iana.org/domains/example successfully.`
      };
      
      if (globalLogger) {
        globalLogger.toolResult('click', true, result);
      }
      
      return result;
    },
  }),
  
  scroll: tool({
    description: 'Scroll the page',
    parameters: z.object({
      direction: z.enum(['up', 'down']),
      amount: z.number().optional(),
    }),
    execute: async ({ direction, amount }: { direction: 'up' | 'down'; amount?: number }) => {
      const call = `scroll(${direction}, ${amount || 'default'})`;
      const callNumber = toolCallSequence.length + 1;
      toolCallSequence.push(call);
      
      if (globalLogger) {
        globalLogger.toolCalled('scroll', callNumber);
      }
      
      await new Promise(r => setTimeout(r, 20));
      
      const result = { 
        success: true,
        message: `Scrolled ${direction} by ${amount || 'default'} pixels. More content is now visible.`
      };
      
      if (globalLogger) {
        globalLogger.toolResult('scroll', true, result);
      }
      
      return result;
    },
  }),
};

// Test 1: Multi-step task with ToolLoopAgent
async function testAgentMultiStep() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} TEST 1: Multi-Step Agent with Unlimited Execution`);
  console.log(`${'='.repeat(70)}\n`);
  
  toolCallSequence = [];
  globalLogger = new DebugLogger();
  
  const client = createGateway({ apiKey });
  const model = client('google/gemini-2.5-flash-lite-preview-09-2025');
  
  globalLogger.log('info', 'Initializing ToolLoopAgent with unlimited steps');
  globalLogger.log('debug', 'Agent Configuration', {
    model: 'google/gemini-2.5-flash-lite-preview-09-2025',
    stopWhen: 'stepCountIs(100)',
    toolCount: Object.keys(tools).length,
  });
  
  // Create agent with 100 steps (effectively unlimited)
  const agent = new ToolLoopAgent({
    model,
    instructions: `You are a browser automation assistant.

IMPORTANT: Execute ALL steps requested. After each tool call, analyze the result and continue to the next step until the entire task is complete.`,
    tools,
    // No cap on execution - use 100 steps
    stopWhen: stepCountIs(100),
  });
  
  globalLogger.log('success', 'Agent created successfully');
  globalLogger.log('info', 'Starting agent.stream() for multi-step task');
  
  const result = await agent.stream({
    messages: [
      {
        role: 'user',
        content: `Complete this task step by step:
1. Navigate to https://example.com
2. Get the page context to see what's there
3. Click the "More information" link
4. Get the page context again to confirm navigation

Execute all 4 steps.`
      }
    ],
  });
  
  globalLogger.log('info', 'Agent stream initiated, consuming fullStream');
  
  let fullText = '';
  let textChunkCount = 0;
  let stepCount = 0;
  let lastFinishReason: string | undefined;
  let lastStepFinishReason: string | undefined;
  let toolCallEvents: string[] = [];
  let toolResultEvents: string[] = [];
  
  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-delta':
        fullText += part.text;
        textChunkCount++;
        if (textChunkCount % 10 === 0) {
          globalLogger.log('debug', `Text stream: ${textChunkCount} chunks, ${fullText.length} chars`);
        }
        process.stdout.write('.');
        break;
        
      case 'start-step':
        stepCount++;
        globalLogger.stepStart(stepCount);
        globalLogger.log('info', `Agent loop iteration ${stepCount} starting`);
        break;
        
      case 'finish-step':
        const stepPart = part as any;
        lastStepFinishReason = stepPart.finishReason;
        globalLogger.stepEnd(stepCount, stepPart.finishReason);
        
        if (stepPart.finishReason === 'tool-calls') {
          globalLogger.log('info', 'Step finished with tool-calls - agent will automatically continue');
          globalLogger.log('debug', 'Automatic continuation enabled - no manual intervention needed');
        } else {
          globalLogger.log('info', `Step finished with reason: ${stepPart.finishReason}`);
        }
        break;
        
      case 'tool-call':
        const toolCall = part as any;
        const toolName = toolCall.toolName || 'unknown';
        toolCallEvents.push(toolName);
        globalLogger.log('debug', `Tool call event: ${toolName}`, {
          toolCallId: toolCall.toolCallId,
          args: toolCall.args,
        });
        break;
        
      case 'tool-result':
        const toolResult = part as any;
        const resultToolName = toolResult.toolName || 'unknown';
        toolResultEvents.push(resultToolName);
        globalLogger.log('debug', `Tool result event: ${resultToolName}`, {
          success: !toolResult.result?.error,
        });
        break;
        
      case 'finish':
        lastFinishReason = part.finishReason;
        globalLogger.log('success', `Agent finished: ${part.finishReason}`);
        break;
        
      case 'error':
        globalLogger.log('error', `Stream error: ${(part as any).error}`);
        break;
        
      default:
        globalLogger.streamEvent(part.type, part);
    }
  }
  
  const duration = Date.now() - globalLogger.startTime;
  
  console.log(`\n`);
  globalLogger.log('info', 'Test 1 Complete');
  globalLogger.summary();
  
  console.log(`\n📊 [Test 1 Detailed Results]`);
  console.log(`   ⏱️  Duration: ${duration}ms`);
  console.log(`   🔢 Steps executed: ${stepCount}`);
  console.log(`   🔧 Tool calls: ${toolCallSequence.length}`);
  console.log(`   📝 Text chunks: ${textChunkCount}`);
  console.log(`   📄 Text length: ${fullText.length} chars`);
  console.log(`   🎯 Finish reason: ${lastFinishReason || 'unknown'}`);
  console.log(`   🔗 Tool sequence: ${toolCallSequence.join(' → ')}`);
  console.log(`   📡 Tool call events: ${toolCallEvents.length}`);
  console.log(`   ✅ Tool result events: ${toolResultEvents.length}`);
  
  // Success: Should have executed 4+ tools (navigate, getContext, click, getContext again)
  const passed = toolCallSequence.length >= 4 && stepCount > 1;
  
  console.log(`\n${passed ? '✅' : '❌'} Test 1: ${passed ? 'PASSED' : 'FAILED'}`);
  if (passed) {
    console.log(`   ✨ ToolLoopAgent successfully executed multiple steps with automatic continuation!`);
    console.log(`   ✨ ${stepCount} step(s) executed with ${toolCallSequence.length} tool call(s)`);
    console.log(`   ✨ Automatic tool loop working as expected`);
  } else {
    console.log(`   ❌ Only ${toolCallSequence.length} tool call(s) and ${stepCount} step(s)`);
    console.log(`   ❌ Expected: 4+ tools and 2+ steps`);
    console.log(`   ❌ This indicates the agent stopped early or didn't continue automatically`);
  }
  
  return { passed, toolCalls: toolCallSequence.length, steps: stepCount, duration };
}

// Test 2: High step count (verify no artificial limits)
async function testAgentHighStepCount() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} TEST 2: High Step Count (8 actions)`);
  console.log(`${'='.repeat(70)}\n`);
  
  toolCallSequence = [];
  globalLogger = new DebugLogger();
  
  const client = createGateway({ apiKey });
  const model = client('google/gemini-2.5-flash-lite-preview-09-2025');
  
  globalLogger.log('info', 'Initializing ToolLoopAgent for high step count test');
  globalLogger.log('debug', 'Expected: 8 sequential actions with automatic continuation');
  
  const agent = new ToolLoopAgent({
    model,
    instructions: 'You are a browser automation assistant. Execute all requested steps thoroughly. After each tool call, continue immediately to the next step.',
    tools,
    stopWhen: stepCountIs(100), // No artificial limit
  });
  
  globalLogger.log('success', 'Agent created');
  globalLogger.log('info', 'Starting agent with long sequence of actions');
  
  const result = await agent.stream({
    messages: [
      {
        role: 'user',
        content: `Perform these actions in sequence:
1. Navigate to https://example.com
2. Get page context
3. Scroll down
4. Click the link
5. Get page context
6. Scroll up
7. Scroll down
8. Get page context again

Execute all 8 steps meticulously. Do not stop until all steps are complete.`
      }
    ],
  });
  
  let stepCount = 0;
  let lastStepFinishReason: string | undefined;
  const stepFinishReasons: string[] = [];
  
  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'start-step':
        stepCount++;
        globalLogger.stepStart(stepCount);
        process.stdout.write(`${stepCount}.`);
        break;
        
      case 'finish-step':
        const stepPart = part as any;
        lastStepFinishReason = stepPart.finishReason;
        stepFinishReasons.push(stepPart.finishReason);
        globalLogger.stepEnd(stepCount, stepPart.finishReason);
        
        if (stepPart.finishReason === 'tool-calls') {
          globalLogger.log('debug', `Step ${stepCount} finished with tool-calls - continuing automatically`);
        }
        break;
        
      case 'tool-call':
        const toolCall = part as any;
        globalLogger.log('debug', `Tool call in stream: ${toolCall.toolName || 'unknown'}`);
        break;
        
      case 'tool-result':
        const toolResult = part as any;
        globalLogger.log('debug', `Tool result in stream: ${toolResult.toolName || 'unknown'}`);
        break;
        
      case 'finish':
        globalLogger.log('success', `Agent finished: ${part.finishReason}`);
        break;
    }
  }
  
  const duration = Date.now() - globalLogger.startTime;
  
  console.log(`\n`);
  globalLogger.log('info', 'Test 2 Complete');
  globalLogger.summary();
  
  console.log(`\n📊 [Test 2 Detailed Results]`);
  console.log(`   ⏱️  Duration: ${duration}ms`);
  console.log(`   🔢 Steps executed: ${stepCount}`);
  console.log(`   🔧 Tool calls: ${toolCallSequence.length}`);
  console.log(`   🎯 Finish reasons by step: ${stepFinishReasons.join(', ')}`);
  console.log(`   🔗 Tool sequence: ${toolCallSequence.join(' → ')}`);
  
  const passed = toolCallSequence.length >= 6; // Should get most/all 8
  
  console.log(`\n${passed ? '✅' : '❌'} Test 2: ${passed ? 'PASSED' : 'FAILED'}`);
  if (passed) {
    console.log(`   ✨ Agent executed ${toolCallSequence.length} of 8 requested actions`);
    console.log(`   ✨ Automatic continuation working across ${stepCount} steps`);
    if (toolCallSequence.length === 8) {
      console.log(`   ✨ Perfect: All 8 actions executed!`);
    }
  } else {
    console.log(`   ❌ Only ${toolCallSequence.length} of 8 actions executed`);
    console.log(`   ❌ Expected at least 6 actions`);
  }
  
  return { passed, toolCalls: toolCallSequence.length, steps: stepCount, duration };
}

// Run all tests
async function runAllTests() {
  const suiteStartTime = Date.now();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} AI SDK 6 ToolLoopAgent Test Suite`);
  console.log(`${'='.repeat(70)}`);
  console.log(`🚀 Real-time debugging enabled`);
  console.log(`📊 Detailed execution logs will be shown for each test\n`);
  
  const results = {
    test1: await testAgentMultiStep(),
    test2: await testAgentHighStepCount(),
  };
  
  const suiteDuration = Date.now() - suiteStartTime;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} TEST SUMMARY`);
  console.log(`${'='.repeat(70)}`);
  
  const allPassed = results.test1.passed && results.test2.passed;
  
  console.log(`\n📋 Test Results:`);
  console.log(`\nTest 1 (Multi-Step): ${results.test1.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  - Duration: ${results.test1.duration}ms`);
  console.log(`  - Tool calls: ${results.test1.toolCalls}`);
  console.log(`  - Steps: ${results.test1.steps}`);
  console.log(`  - Status: ${results.test1.passed ? 'Agent correctly executed multiple steps' : 'Agent stopped early'}`);
  
  console.log(`\nTest 2 (High Step Count): ${results.test2.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  - Duration: ${results.test2.duration}ms`);
  console.log(`  - Tool calls: ${results.test2.toolCalls}`);
  console.log(`  - Steps: ${results.test2.steps}`);
  console.log(`  - Status: ${results.test2.passed ? 'Agent executed most/all requested actions' : 'Agent did not execute enough actions'}`);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 Overall Statistics:`);
  console.log(`  - Total suite duration: ${suiteDuration}ms (${(suiteDuration / 1000).toFixed(2)}s)`);
  console.log(`  - Total tool calls: ${results.test1.toolCalls + results.test2.toolCalls}`);
  console.log(`  - Total steps: ${results.test1.steps + results.test2.steps}`);
  console.log(`  - Average step duration: ${((results.test1.duration + results.test2.duration) / (results.test1.steps + results.test2.steps)).toFixed(0)}ms`);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${allPassed ? '🎉' : '❌'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log(`${'='.repeat(70)}\n`);
  
  if (allPassed) {
    console.log('✨ AI SDK 6 ToolLoopAgent successfully enables unlimited multi-step execution!');
    console.log('✨ Automatic tool loop working correctly');
    console.log('✨ No artificial execution limits detected');
    console.log('✨ Reference: https://v6.ai-sdk.dev/docs/announcing-ai-sdk-6-beta\n');
  } else {
    console.log('⚠️  Some tests failed. Review the debug logs above for details.');
    console.log('⚠️  Common issues:');
    console.log('   - Agent stopping early (check stopWhen configuration)');
    console.log('   - Tool execution errors (check tool schemas)');
    console.log('   - Model not following instructions (check system prompt)\n');
  }
  
  return allPassed;
}

// Execute
runAllTests()
  .then(allPassed => {
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error(`\n${LOG_PREFIX} ❌ Unhandled error:`, error);
    process.exit(1);
  });

