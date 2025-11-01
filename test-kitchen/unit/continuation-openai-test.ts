// Quick test to verify maxSteps continuation works with OpenAI
// This helps us determine if the issue is provider-specific (Gemini) or SDK-wide

import { z } from 'zod';
import { tool, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

console.log('🧪 Testing maxSteps continuation with OpenAI...\n');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.log('⚠️  OPENAI_API_KEY not set - skipping test');
  process.exit(0);
}

let toolCallSequence: string[] = [];

const tools = {
  navigate: tool({
    description: 'Navigate to a URL',
    parameters: z.object({ url: z.string().url() }),
    execute: async ({ url }: { url: string }) => {
      const call = `navigate(${url})`;
      toolCallSequence.push(call);
      console.log(`   🔧 Tool: ${call}`);
      return { 
        success: true, 
        message: `Navigated to ${url}. Page loaded with title "Example Domain".`
      };
    },
  }),
  
  getPageContext: tool({
    description: 'Get current page context',
    parameters: z.object({
      refresh: z.boolean().default(true).optional()
    }),
    execute: async () => {
      const call = 'getPageContext()';
      toolCallSequence.push(call);
      console.log(`   🔧 Tool: ${call}`);
      return { 
        success: true,
        title: 'Example Domain',
        text: 'This domain is for use in illustrative examples.',
        links: [{ text: 'More information...', href: 'https://www.iana.org/domains/example' }]
      };
    },
  }),
  
  click: tool({
    description: 'Click an element',
    parameters: z.object({
      selector: z.string().optional(),
    }),
    execute: async ({ selector }: { selector?: string }) => {
      const call = `click(${selector})`;
      toolCallSequence.push(call);
      console.log(`   🔧 Tool: ${call}`);
      return { 
        success: true,
        message: `Clicked ${selector}. Navigated to new page.`
      };
    },
  }),
};

async function testOpenAIContinuation() {
  console.log('📡 Starting OpenAI test with maxSteps=5...\n');
  
  const model = openai('gpt-4o-mini');
  
  const result = streamText({
    model,
    system: `You are a browser automation assistant.

IMPORTANT INSTRUCTIONS:
1. Execute ALL steps in the user's request, one by one
2. After each tool call, analyze the result and proceed to the next step
3. Continue until you have completed ALL requested actions
4. Think out loud about what you're doing`,
    tools,
    messages: [
      { 
        role: 'user', 
        content: 'Please complete this task step by step:\n1. Navigate to https://example.com\n2. Get the page context\n3. Click the "More information" link\n\nExecute each step and report your progress.' 
      }
    ],
    maxSteps: 5,
  });
  
  console.log('📝 Consuming fullStream...\n');
  let fullText = '';
  let stepCount = 0;
  let lastStepFinishReason: string | undefined;
  
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      fullText += part.text;
      process.stdout.write('.');
    } else if (part.type === 'start-step') {
      stepCount++;
      console.log(`\n🚀 Step ${stepCount} started`);
    } else if (part.type === 'finish-step') {
      const stepPart = part as any;
      lastStepFinishReason = stepPart.finishReason;
      console.log(`   📍 Step ${stepCount} finished: ${stepPart.finishReason}`);
    } else if (part.type === 'finish') {
      console.log(`\n🏁 Stream finished: ${part.finishReason}`);
    }
  }
  
  const finalResult = await result;
  const usage = finalResult.usage instanceof Promise ? await finalResult.usage : finalResult.usage;
  
  console.log(`\n✅ Test complete:`);
  console.log(`   - Steps executed: ${stepCount}`);
  console.log(`   - Tool calls: ${toolCallSequence.length}`);
  console.log(`   - Text length: ${fullText.length} chars`);
  console.log(`   - Tool sequence: ${toolCallSequence.join(' → ')}`);
  console.log(`   - Tokens: ${usage?.totalTokens || 0}`);
  
  const passed = toolCallSequence.length >= 3;
  console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'}: ${passed ? 'OpenAI executes multiple steps with maxSteps' : 'OpenAI also stops after 1 step'}`);
  
  return passed;
}

testOpenAIContinuation()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });


