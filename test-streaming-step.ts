// Test the streaming step with browser automation tools
import { streamingStep } from './steps/streaming-step.ts';

// Mock browser tools that actually execute
const mockExecuteTool = async (toolName: string, params: any) => {
  console.log(`🛠️ Executing tool: ${toolName}`, params);

  if (toolName === 'navigate') {
    // Simulate navigation delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      success: true,
      url: params.url,
      pageContext: {
        url: params.url,
        title: 'Test Page',
        textContent: 'Test page content',
        links: [],
        images: [],
        forms: [],
        metadata: {},
        viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, devicePixelRatio: 1 }
      }
    };
  }

  if (toolName === 'getPageContext') {
    // Simulate page context retrieval
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      success: true,
      url: params.url || 'current_page',
      title: 'Current Page',
      textContent: 'Current page content with navigation info',
      links: [{ text: 'Link', href: '/link' }],
      images: [],
      forms: [],
      metadata: {},
      viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, devicePixelRatio: 1 }
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
};

// Mock AI SDK model - using proper AI SDK 6 format
const mockModel = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json' as const,
  doGenerate: async () => {
    throw new Error('Mock model - not implemented for testing');
  },
  doStream: async function* () {
    // Mock streaming response with tool calls
    yield {
      type: 'text-delta',
      textDelta: 'Navigating to ESPN'
    };

    yield {
      type: 'tool-call',
      toolCallId: 'call_navigate',
      toolName: 'navigate',
      input: { url: 'https://www.espn.com' }
    };

    yield {
      type: 'tool-call',
      toolCallId: 'call_context',
      toolName: 'getPageContext',
      input: { url: 'current_page' }
    };
  }
};

// Mock update and push message functions
const updateLastMessage = (updater: any) => {
  console.log('📝 Updating last message');
  return {};
};

const pushMessage = (msg: any) => {
  console.log('💬 Pushing message:', msg);
};

// Test input
const testInput = {
  model: mockModel,
  system: 'You are a browser automation agent.',
  tools: {},
  messages: [
    {
      id: '1',
      role: 'user' as const,
      content: 'Navigate to espn.com and get the page context'
    }
  ],
  execSteps: [
    { step: 1, action: 'navigate', url: 'https://www.espn.com', success: false },
    { step: 2, action: 'getPageContext', url: 'current_page', success: false }
  ],
  updateLastMessage,
  pushMessage,
  executeTool: mockExecuteTool
};

console.log('🚀 Testing Streaming Step with Browser Automation Tools...');
console.log('📋 Test Input:');
console.log('  - Steps:', testInput.execSteps.length);
console.log('  - Messages:', testInput.messages.length);
console.log('  - Tools:', ['navigate', 'getPageContext']);

async function runTest() {
  try {
    const result = await streamingStep(testInput);

    console.log('\n✅ STREAMING STEP RESULT:');
    console.log('📊 Result Properties:');
    console.log('  - Full Text Length:', result.fullText.length);
    console.log('  - Tool Call Count:', result.toolCallCount);
    console.log('  - Text Chunk Count:', result.textChunkCount);
    console.log('  - Duration:', result.duration, 'ms');
    console.log('  - Finish Reason:', result.finishReason);
    console.log('  - Usage:', result.usage);

    console.log('\n🛠️ Tool Executions:');
    result.toolExecutions.forEach((execution, index) => {
      console.log(`  ${index + 1}. ${execution.tool}: ${execution.success ? '✅' : '❌'} (${execution.duration}ms)`);
    });

    console.log('\n📋 Execution Steps:');
    result.executionSteps.forEach((step, index) => {
      console.log(`  ${index + 1}. Step ${step.step}: ${step.action} -> ${step.success ? '✅' : '❌'}`);
      if (step.url) console.log(`     URL: ${step.url}`);
    });

    console.log('\n📝 Full Text Preview:');
    console.log(result.fullText.substring(0, 200) + '...');

    // Verify results
    const hasToolExecutions = result.toolExecutions.length > 0;
    const hasSuccessfulSteps = result.executionSteps.some(step => step.success);
    const hasBrowserContent = result.fullText.includes('ESPN') || result.fullText.includes('page');

    console.log('\n🔍 VALIDATION:');
    console.log(`  - Has tool executions: ${hasToolExecutions ? '✅' : '❌'}`);
    console.log(`  - Has successful steps: ${hasSuccessfulSteps ? '✅' : '❌'}`);
    console.log(`  - Has browser content: ${hasBrowserContent ? '✅' : '❌'}`);
    console.log(`  - Duration > 100ms: ${result.duration > 100 ? '✅' : '❌'} (${result.duration}ms)`);

    if (hasToolExecutions && hasSuccessfulSteps && hasBrowserContent) {
      console.log('\n🎉 TEST PASSED: Streaming step properly executes browser tools!');
    } else {
      console.log('\n❌ TEST FAILED: Streaming step not executing tools properly');
    }

  } catch (error) {
    console.error('\n💥 TEST ERROR:', error);
  }
}

runTest();