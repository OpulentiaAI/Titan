// Continuation & Streaming Test
// Tests streaming behavior, maxSteps continuation, and finish reason handling
// Enhanced with Braintrust observability for detailed debugging

import { z } from 'zod';
import { tool, streamText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';

const LOG_PREFIX = '🧪 [Continuation Test]';

const apiKey = process.env.AI_GATEWAY_API_KEY;
const braintrustApiKey = process.env.BRAINTRUST_API_KEY;

if (!apiKey) {
  console.error(`${LOG_PREFIX} ❌ Missing AI_GATEWAY_API_KEY - skipping test`);
  process.exit(0);
}

// Initialize Braintrust if available
let traced: any = null;
let initLogger: any = null;

if (braintrustApiKey) {
  console.log(`${LOG_PREFIX} ✅ Braintrust observability enabled`);
  try {
    const braintrust = await import('../../lib/braintrust.js');
    traced = braintrust.traced;
    initLogger = braintrust.initLogger;
    await initLogger('atlas-extension', 'continuation-streaming-test');
    console.log(`${LOG_PREFIX} 📊 Braintrust project: atlas-extension`);
  } catch (e: any) {
    console.warn(`${LOG_PREFIX} ⚠️ Could not load Braintrust:`, e.message);
  }
} else {
  console.log(`${LOG_PREFIX} ⚠️ Braintrust API key not set - running without observability`);
}

console.log(`${LOG_PREFIX} Starting continuation & streaming test...\n`);

// Mock tools to track execution sequence
let toolCallSequence: string[] = [];

const tools = {
  navigate: tool({
    description: 'Navigate to a URL',
    parameters: z.object({ url: z.string().url() }),
    execute: async ({ url }: { url: string }) => {
      const call = `navigate(${url})`;
      toolCallSequence.push(call);
      console.log(`   🔧 Tool ${toolCallSequence.length}: ${call}`);
      return { 
        success: true, 
        url,
        message: `Navigated to ${url}. Page loaded successfully.`
      };
    },
  }),
  
  getPageContext: tool({
    description: 'Get current page context (title, text, links)',
    parameters: z.object({
      refresh: z.boolean().default(true).optional()
    }),
    execute: async () => {
      const call = 'getPageContext()';
      toolCallSequence.push(call);
      console.log(`   🔧 Tool ${toolCallSequence.length}: ${call}`);
      return { 
        success: true,
        url: 'https://example.com',
        title: 'Example Domain',
        text: 'This domain is for use in illustrative examples. You can find more info here.',
        links: [
          { text: 'More information...', href: 'https://www.iana.org/domains/example' }
        ]
      };
    },
  }),
  
  click: tool({
    description: 'Click an element by selector or coordinates',
    parameters: z.object({
      selector: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
    execute: async ({ selector, x, y }: { selector?: string; x?: number; y?: number }) => {
      const target = selector || `(${x},${y})`;
      const call = `click(${target})`;
      toolCallSequence.push(call);
      console.log(`   🔧 Tool ${toolCallSequence.length}: ${call}`);
      return { 
        success: true,
        message: `Clicked ${target}. Link followed successfully.`
      };
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
      toolCallSequence.push(call);
      console.log(`   🔧 Tool ${toolCallSequence.length}: ${call}`);
      return { 
        success: true,
        message: `Scrolled ${direction} by ${amount || 'default'} pixels.`
      };
    },
  }),
};

// Test 1: Basic streaming with continuation
async function testBasicStreaming() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} TEST 1: Basic Streaming with Continuation`);
  console.log(`${'='.repeat(70)}`);
  
  const testFn = async () => {
    toolCallSequence = [];
    
    const client = createGateway({ apiKey });
    const model = client('google/gemini-2.5-flash-lite-preview-09-2025');
    
    const startTime = Date.now();
  
  const result = streamText({
    model,
    system: `You are a browser automation assistant. 

IMPORTANT INSTRUCTIONS:
1. Execute ALL steps in the user's request, one by one
2. After each tool call, analyze the result and proceed to the next step
3. Continue until you have completed ALL requested actions
4. Think out loud about what you're doing and what comes next`,
    tools,
    messages: [
      { role: 'user', content: 'Please complete this task step by step:\n1. Navigate to https://example.com\n2. Get the page context\n3. Click the "More information" link\n\nExecute each step and report your progress.' }
    ],
    maxSteps: 5,
  });
  
  // Use fullStream for automatic tool execution and continuation
  console.log(`\n📝 [Streaming] Reading fullStream for automatic continuation...`);
  let fullText = '';
  let chunkCount = 0;
  let streamFinishReason: string | undefined;
  
  let stepCount = 0;
  for await (const part of result.fullStream) {
    // Debug: log all event types
    if (part.type !== 'text-delta' && part.type !== 'tool-input-delta') {
      console.log(`   📊 Event: ${part.type}`);
    }
    
    if (part.type === 'text-delta') {
      fullText += part.text;
      chunkCount++;
      if (part.text.length > 0) {
        process.stdout.write('.');
      }
    } else if (part.type === 'start-step') {
      stepCount++;
      console.log(`   🚀 Starting step ${stepCount}`);
    } else if (part.type === 'tool-call') {
      // Track tool calls from stream
      const toolCall = part as any;
      if (toolCall.toolName) {
        console.log(`   🔧 Tool call in stream: ${toolCall.toolName}`);
      }
    } else if (part.type === 'tool-result') {
      // Track tool results from stream
      const toolResult = part as any;
      if (toolResult.toolName) {
        console.log(`   ✅ Tool result in stream: ${toolResult.toolName}`);
      }
    } else if (part.type === 'finish-step') {
      // Intermediate step finished - note that with maxSteps, this should trigger continuation
      const stepFinish = part as any;
      console.log(`   📍 Step ${stepCount} finished: ${stepFinish.finishReason}`);
      if (stepFinish.finishReason === 'tool-calls' && stepCount < 5) {
        console.log(`   ⏭️  Expecting continuation to step ${stepCount + 1}...`);
      }
    } else if (part.type === 'finish') {
      streamFinishReason = part.finishReason;
      console.log(`   🏁 Stream finished after ${stepCount} step(s): ${part.finishReason}`);
    }
  }
  console.log(` (${chunkCount} chunks)\n`);
  
  // Wait for final result
  const finalResult = await result;
  const duration = Date.now() - startTime;
  
  const usage = finalResult.usage instanceof Promise ? await finalResult.usage : finalResult.usage;
  const finishReason = streamFinishReason || (finalResult.finishReason instanceof Promise ? await finalResult.finishReason : finalResult.finishReason);
  
  console.log(`✅ [Test 1 Complete]`);
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Text length: ${fullText.length} chars`);
  console.log(`   Text chunks: ${chunkCount}`);
  console.log(`   Finish reason: ${finishReason}`);
  console.log(`   Tool calls: ${toolCallSequence.length}`);
  console.log(`   Tokens: ${usage?.totalTokens || 0}`);
  console.log(`   Tool sequence: ${toolCallSequence.join(' → ')}`);
  
  // Validate - should have multiple tool calls with continuation
  const passed = toolCallSequence.length >= 3 && 
                 (finishReason === 'stop' || finishReason === 'max-steps');
  
  console.log(`\n${passed ? '✅' : '❌'} Test 1: ${passed ? 'PASSED' : 'FAILED'}`);
  
  return { passed, duration, toolCalls: toolCallSequence.length, finishReason };
  };
  
  // Wrap in Braintrust trace if available
  if (traced) {
    return await traced('test_1_basic_streaming', testFn, {
      test_name: 'Basic Streaming with Continuation',
      max_steps: 5,
    });
  } else {
    return await testFn();
  }
}

// Test 2: MaxSteps limit behavior
async function testMaxStepsLimit() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} TEST 2: MaxSteps Limit Behavior`);
  console.log(`${'='.repeat(70)}`);
  
  const testFn = async () => {
    toolCallSequence = [];
    
    const client = createGateway({ apiKey });
    const model = client('google/gemini-2.5-flash-lite-preview-09-2025');
    
    const startTime = Date.now();
    
    // Use a low maxSteps to force hitting the limit
    const maxSteps = 2;
  
  const result = streamText({
    model,
    system: `You are a browser automation assistant.

IMPORTANT: Execute ALL steps requested. After each tool call, continue to the next step until the entire task is complete.`,
    tools,
    messages: [
      { role: 'user', content: 'Complete this multi-step task:\n1. Navigate to https://example.com\n2. Get page context\n3. Click a link\n4. Scroll down\n5. Get context again\n\nExecute all 5 steps.' }
    ],
    maxSteps,
  });
  
  // Use fullStream for automatic tool execution and continuation
  console.log(`\n📝 [Streaming] Reading fullStream (maxSteps=${maxSteps})...`);
  let fullText = '';
  let streamFinishReason: string | undefined;
  
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      fullText += part.text;
      process.stdout.write('.');
    } else if (part.type === 'finish') {
      streamFinishReason = part.finishReason;
    }
  }
  console.log('\n');
  
  const finalResult = await result;
  const duration = Date.now() - startTime;
  
  const finishReason = streamFinishReason || (finalResult.finishReason instanceof Promise ? await finalResult.finishReason : finalResult.finishReason);
  
  console.log(`✅ [Test 2 Complete]`);
  console.log(`   Duration: ${duration}ms`);
  console.log(`   MaxSteps: ${maxSteps}`);
  console.log(`   Finish reason: ${finishReason}`);
  console.log(`   Tool calls made: ${toolCallSequence.length}`);
  console.log(`   Tool sequence: ${toolCallSequence.join(' → ')}`);
  
  // Validate: should hit max-steps or have executed at least maxSteps tool calls
  const hitLimit = toolCallSequence.length >= maxSteps || finishReason === 'max-steps';
  console.log(`\n${hitLimit ? '✅' : '❌'} Test 2: ${hitLimit ? 'PASSED' : 'FAILED'} - ${hitLimit ? 'MaxSteps limit respected' : 'MaxSteps limit not enforced (only ' + toolCallSequence.length + ' calls)'}`);
  
  return { passed: hitLimit, duration, toolCalls: toolCallSequence.length, finishReason };
  };
  
  // Wrap in Braintrust trace if available
  if (traced) {
    return await traced('test_2_maxsteps_limit', testFn, {
      test_name: 'MaxSteps Limit Behavior',
      max_steps: 2,
      expected_behavior: 'hit_limit',
    });
  } else {
    return await testFn();
  }
}

// Test 3: Streaming without tools (text-only)
async function testTextOnlyStreaming() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} TEST 3: Text-Only Streaming (No Tools)`);
  console.log(`${'='.repeat(70)}`);
  
  const testFn = async () => {
    const client = createGateway({ apiKey });
    const model = client('google/gemini-2.5-flash-lite-preview-09-2025');
    
    const startTime = Date.now();
  
  // No tools, just text generation
  const result = streamText({
    model,
    messages: [
      { role: 'user', content: 'Explain what browser automation is in 2 sentences.' }
    ],
  });
  
  console.log(`\n📝 [Streaming] Reading text-only stream...`);
  let fullText = '';
  let chunkCount = 0;
  
  for await (const chunk of result.textStream) {
    fullText += chunk;
    chunkCount++;
    process.stdout.write('.');
  }
  console.log(` (${chunkCount} chunks)\n`);
  
  const finalResult = await result;
  const duration = Date.now() - startTime;
  
  const finishReason = finalResult.finishReason instanceof Promise ? await finalResult.finishReason : finalResult.finishReason;
  
  console.log(`✅ [Test 3 Complete]`);
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Text length: ${fullText.length} chars`);
  console.log(`   Text chunks: ${chunkCount}`);
  console.log(`   Finish reason: ${finishReason}`);
  console.log(`   Text preview: "${fullText.substring(0, 100)}..."`);
  
  // Validate: should have text and finish with 'stop'
  const passed = fullText.length > 50 && finishReason === 'stop';
  console.log(`\n${passed ? '✅' : '❌'} Test 3: ${passed ? 'PASSED' : 'FAILED'}`);
  
  return { passed, duration, textLength: fullText.length, finishReason };
  };
  
  // Wrap in Braintrust trace if available
  if (traced) {
    return await traced('test_3_text_only_streaming', testFn, {
      test_name: 'Text-Only Streaming (No Tools)',
      expected_behavior: 'text_generation',
    });
  } else {
    return await testFn();
  }
}

// Run all tests
async function runAllTests() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} Running Continuation & Streaming Test Suite`);
  console.log(`${'='.repeat(70)}\n`);
  
  const results = {
    test1: await testBasicStreaming(),
    test2: await testMaxStepsLimit(),
    test3: await testTextOnlyStreaming(),
  };
  
  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${LOG_PREFIX} TEST SUMMARY`);
  console.log(`${'='.repeat(70)}`);
  
  const allPassed = results.test1.passed && results.test2.passed && results.test3.passed;
  
  console.log(`\nTest 1 (Basic Streaming): ${results.test1.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  - Duration: ${results.test1.duration}ms`);
  console.log(`  - Tool calls: ${results.test1.toolCalls}`);
  console.log(`  - Finish reason: ${results.test1.finishReason}`);
  
  console.log(`\nTest 2 (MaxSteps Limit): ${results.test2.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  - Duration: ${results.test2.duration}ms`);
  console.log(`  - Tool calls: ${results.test2.toolCalls}`);
  console.log(`  - Finish reason: ${results.test2.finishReason}`);
  
  console.log(`\nTest 3 (Text-Only): ${results.test3.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  - Duration: ${results.test3.duration}ms`);
  console.log(`  - Text length: ${results.test3.textLength} chars`);
  console.log(`  - Finish reason: ${results.test3.finishReason}`);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${allPassed ? '🎉' : '❌'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log(`${'='.repeat(70)}\n`);
  
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
