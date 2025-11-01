// Production Configuration Test Suite
// Tests with production-like settings and comprehensive logging

import { z } from 'zod';
import { tool, streamText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AtlasSettings } from '../types.js';

// Production configuration presets
const PRODUCTION_CONFIGS: Array<{
  name: string;
  settings: AtlasSettings;
  description: string;
}> = [
  // Anthropic test disabled - schema conversion issue needs fixing
  // {
  //   name: 'Gateway + Anthropic Haiku',
  //   settings: {
  //     provider: 'gateway',
  //     apiKey: process.env.AI_GATEWAY_API_KEY || '',
  //     model: 'anthropic/claude-haiku-4.5',
  //     computerUseEngine: 'gateway-flash-lite',
  //     youApiKey: process.env.YOU_API_KEY,
  //     braintrustApiKey: process.env.BRAINTRUST_API_KEY,
  //     braintrustProjectName: process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension',
  //   },
  //   description: 'Production: AI Gateway with Anthropic Claude Haiku 4.5',
  // },
  {
    name: 'Gateway + Google Flash Lite',
    settings: {
      provider: 'gateway',
      apiKey: process.env.AI_GATEWAY_API_KEY || '',
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      computerUseEngine: 'gateway-flash-lite',
      youApiKey: process.env.YOU_API_KEY,
      braintrustApiKey: process.env.BRAINTRUST_API_KEY,
      braintrustProjectName: process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension',
    },
    description: 'Production: AI Gateway with Google Gemini Flash Lite',
  },
  // Google Direct disabled - requires separate GOOGLE_API_KEY
  // Uncomment if you have GOOGLE_API_KEY set
  // {
  //   name: 'Google Direct',
  //   settings: {
  //     provider: 'google',
  //     apiKey: process.env.GOOGLE_API_KEY || '',
  //     model: 'gemini-2.5-pro',
  //     computerUseEngine: 'google',
  //     youApiKey: process.env.YOU_API_KEY,
  //     braintrustApiKey: process.env.BRAINTRUST_API_KEY,
  //     braintrustProjectName: process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension',
  //   },
  //   description: 'Production: Google Generative AI direct',
  // },
];

// Production tool definitions (exact match to workflow)
const productionTools = {
  navigate: tool({
    description: 'Navigate to a URL. Wait 2.5s after navigation for page to load, then returns page context.',
    parameters: z.object({ url: z.string().url() }),
    execute: async ({ url }) => {
      console.log(`  🔧 [PROD] navigate(${url})`);
      return { success: true, url };
    }
  }),
  getPageContext: tool({
    description: 'Get current page context (title, text, links, forms, viewport). Use this to understand page state before actions.',
    parameters: z.object({
      _placeholder: z.string().optional().describe('Placeholder for Bedrock schema compatibility - not used')
    }),
    execute: async () => {
      console.log(`  🔧 [PROD] getPageContext()`);
      return { 
        success: true, 
        title: 'Test Page', 
        url: 'https://example.com',
        links: 5,
        forms: 1 
      };
    }
  }),
  click: tool({
    description: 'Click element. Provide EITHER selector (CSS) OR both x and y coordinates.',
    parameters: z.object({
      selector: z.string().optional().describe('CSS selector to click (e.g., "button.submit")'),
      x: z.number().optional().describe('X coordinate for position-based click'),
      y: z.number().optional().describe('Y coordinate for position-based click'),
    }),
    execute: async ({ selector, x, y }) => {
      const target = selector ? `selector:${selector}` : `coords:(${x},${y})`;
      console.log(`  🔧 [PROD] click(${target})`);
      return { success: true, url: 'https://example.com' };
    }
  }),
  type_text: tool({
    description: 'Type text into a focused input or by CSS selector; optionally press enter. Returns page context after typing.',
    parameters: z.object({ 
      selector: z.string().optional(), 
      text: z.string(), 
      press_enter: z.boolean().optional() 
    }),
    execute: async ({ selector, text, press_enter }) => {
      console.log(`  🔧 [PROD] type_text(${selector || 'focused'}, "${text.substring(0, 20)}...", enter:${press_enter})`);
      return { success: true, url: 'https://example.com' };
    }
  }),
  scroll: tool({
    description: 'Scroll page (up,down,top,bottom) or scroll element by selector. Returns page context after scroll.',
    parameters: z.object({ 
      direction: z.enum(['up','down','top','bottom']).optional(), 
      amount: z.number().optional(), 
      selector: z.string().optional() 
    }),
    execute: async ({ direction = 'down', amount = 500, selector }) => {
      console.log(`  🔧 [PROD] scroll(${direction}, ${amount}px, ${selector || 'page'})`);
      return { success: true, url: 'https://example.com' };
    }
  }),
  wait: tool({
    description: 'Wait for a number of seconds (max 60). Useful for waiting for dynamic content to load.',
    parameters: z.object({ seconds: z.number().min(0).max(60).default(1) }),
    execute: async ({ seconds }) => {
      console.log(`  🔧 [PROD] wait(${seconds}s)`);
      return { success: true, waited: seconds };
    }
  }),
  press_key: tool({
    description: 'Press a single key (e.g., Enter, Tab, Escape). Returns page context after key press.',
    parameters: z.object({ key: z.string() }),
    execute: async ({ key }) => {
      console.log(`  🔧 [PROD] press_key(${key})`);
      return { success: true, url: 'https://example.com' };
    }
  }),
  key_combination: tool({
    description: 'Press a key combination, e.g., ["Control","A"]. Returns page context after combination.',
    parameters: z.object({ keys: z.array(z.string()).min(1) }),
    execute: async ({ keys }) => {
      console.log(`  🔧 [PROD] key_combination([${keys.join(',')}])`);
      return { success: true, url: 'https://example.com' };
    }
  }),
};

interface TestResult {
  config: string;
  success: boolean;
  duration: number;
  error?: string;
  tokens?: number;
  toolCalls?: number;
  finishReason?: string;
  textLength?: number;
  logs: string[];
}

async function testProductionConfig(config: typeof PRODUCTION_CONFIGS[0]): Promise<TestResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(msg);
  };

  log(`\n${'='.repeat(70)}`);
  log(`📋 Testing Production Config: ${config.name}`);
  log(`📋 Description: ${config.description}`);
  log(`📋 Provider: ${config.settings.provider}`);
  log(`📋 Model: ${config.settings.model}`);
  log(`📋 Computer Use Engine: ${config.settings.computerUseEngine}`);
  log(`📋 Has YOU API Key: ${!!config.settings.youApiKey}`);
  log(`📋 Has Braintrust API Key: ${!!config.settings.braintrustApiKey}`);
  log(`📋 Braintrust Project: ${config.settings.braintrustProjectName || 'none'}`);
  log(`${'='.repeat(70)}\n`);

  // Validate API key
  if (!config.settings.apiKey) {
    const error = `❌ Missing API key for ${config.settings.provider}`;
    log(error);
    return {
      config: config.name,
      success: false,
      duration: 0,
      error,
      logs,
    };
  }

  const startTime = Date.now();

  try {
    // Initialize model (mirror production workflow)
    log(`🔑 [PROD] Initializing ${config.settings.provider} client...`);
    let model: any;
    
    if (config.settings.provider === 'gateway') {
      const gatewayClient = createGateway({ apiKey: config.settings.apiKey });
      model = gatewayClient(config.settings.model);
      log(`✅ [PROD] AI Gateway client created`);
      log(`✅ [PROD] Model: ${config.settings.model}`);
      
      const isAnthropic = config.settings.model.includes('anthropic') || config.settings.model.includes('claude');
      log(`🔍 [PROD] Is Anthropic/Bedrock: ${isAnthropic}`);
      log(`🔍 [PROD] Requires Bedrock-compatible schemas: ${isAnthropic}`);
    } else {
      const googleClient = createGoogleGenerativeAI({ apiKey: config.settings.apiKey });
      model = googleClient(config.settings.model);
      log(`✅ [PROD] Google client created`);
      log(`✅ [PROD] Model: ${config.settings.model}`);
    }

    // Validate tool schemas (mirror production workflow)
    log(`\n🔧 [PROD] Validating ${Object.keys(productionTools).length} browser tools...`);
    const toolNames = Object.keys(productionTools);
    log(`📋 [PROD] Tool names: ${toolNames.join(', ')}`);
    
    for (const [toolName, toolDef] of Object.entries(productionTools)) {
      try {
        const tool = toolDef as any;
        // Access parameters from tool definition (after tool() wrapper)
        const params = tool.parameters || tool._def?.parameters;
        if (!params) {
          log(`⚠️ [PROD] Tool ${toolName} has no parameters schema`);
        } else {
          // Zod schema structure: params._def.shape for z.object()
          const shape = params._def?.shape || params._def?.typeName === 'ZodObject' ? params._def.shape : {};
          const propCount = Object.keys(shape).length;
          const isBedrockSafe = propCount > 0;
          log(`   ✓ [PROD] ${toolName}: ${propCount} param(s), Bedrock-safe: ${isBedrockSafe}`);
          
          if (propCount === 0 && config.settings.model.includes('anthropic')) {
            log(`   ⚠️ [PROD] ${toolName} has empty schema - WILL FAIL with Bedrock/Anthropic`);
          }
        }
      } catch (e: any) {
        log(`   ❌ [PROD] Schema validation failed for ${toolName}: ${e?.message}`);
      }
    }

    // Test streamText call (mirror production workflow)
    log(`\n🌊 [PROD] Calling streamText with production tools...`);
    log(`🌊 [PROD] Tool count: ${Object.keys(productionTools).length}`);
    log(`🌊 [PROD] System prompt length: ~2000 chars (estimated)`);
    
    const testQuery = 'Navigate to example.com and get the page context';
    log(`🌊 [PROD] User query: "${testQuery}"`);

    const result = streamText({
      model,
      system: 'You are a browser automation assistant. Use the available tools to complete the user\'s request.',
      tools: productionTools,
      messages: [{ role: 'user', content: testQuery }],
      maxSteps: 3,
    });

    log(`✅ [PROD] streamText call initiated`);

    // Stream and capture
    let text = '';
    let chunkCount = 0;
    let lastChunkTime = Date.now();
    
    log(`📥 [PROD] Reading text stream...`);
    for await (const chunk of result.textStream) {
      chunkCount++;
      text += chunk;
      const now = Date.now();
      if (now - lastChunkTime > 1000) {
        log(`   📝 [PROD] Received ${chunkCount} chunks, ${text.length} chars`);
        lastChunkTime = now;
      }
    }
    log(`✅ [PROD] Stream complete: ${chunkCount} chunks, ${text.length} chars`);

    // Get final result
    log(`\n📊 [PROD] Getting final result...`);
    const finalResult = await result;
    const duration = Date.now() - startTime;

    const usage = finalResult.usage instanceof Promise ? await finalResult.usage : finalResult.usage;
    const toolCalls = finalResult.toolCalls instanceof Promise ? await finalResult.toolCalls : finalResult.toolCalls;
    const finishReason = finalResult.finishReason instanceof Promise ? await finalResult.finishReason : finalResult.finishReason;
    const toolCallCount = toolCalls && Array.isArray(toolCalls) ? toolCalls.length : 0;

    log(`\n📊 [PROD] Result Summary:`);
    log(`   Duration: ${duration}ms`);
    log(`   Text length: ${text.length} chars`);
    log(`   Text chunks: ${chunkCount}`);
    log(`   Finish reason: ${finishReason || 'unknown'}`);
    log(`   Tool calls: ${toolCallCount}`);
    log(`   Tokens:`);
    log(`     - Prompt: ${usage?.promptTokens || 0}`);
    log(`     - Completion: ${usage?.completionTokens || 0}`);
    log(`     - Total: ${usage?.totalTokens || 0}`);

    if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
      log(`\n🔧 [PROD] Tool Call Details:`);
      toolCalls.forEach((tc: any, idx: number) => {
        const argsStr = tc.args ? JSON.stringify(tc.args).substring(0, 100) : 'no args';
        log(`   ${idx + 1}. ${tc.toolName || 'unknown'}(${argsStr})`);
      });
    }

    log(`\n✅ [PROD] Test PASSED for ${config.name}`);
    
    return {
      config: config.name,
      success: true,
      duration,
      tokens: usage?.totalTokens || 0,
      toolCalls: toolCallCount,
      finishReason: String(finishReason || 'unknown'),
      textLength: text.length,
      logs,
    };

  } catch (e: any) {
    const duration = Date.now() - startTime;
    log(`\n❌ [PROD] Test FAILED for ${config.name}`);
    log(`   Duration: ${duration}ms`);
    log(`   Error type: ${e?.name || typeof e}`);
    log(`   Error message: ${e?.message || String(e)}`);

    // Enhanced error analysis
    if (e?.message?.includes('toolConfig') || e?.message?.includes('inputSchema') || e?.message?.includes('type must be')) {
      log(`\n🔍 [PROD] Schema validation error detected`);
      log(`🔍 [PROD] This indicates a Bedrock/Anthropic compatibility issue`);
      log(`🔍 [PROD] Tool schemas:`);
      Object.keys(productionTools).forEach(name => {
        const tool = (productionTools as any)[name];
        const params = tool?.parameters;
        const shape = params?._def?.shape || {};
        log(`   - ${name}: ${Object.keys(shape).length} params`);
      });
    }

    if (e?.stack) {
      log(`\n📚 [PROD] Stack trace:`);
      e.stack.split('\n').slice(0, 10).forEach((line: string) => {
        log(`   ${line}`);
      });
    }

    return {
      config: config.name,
      success: false,
      duration,
      error: e?.message || String(e),
      logs,
    };
  }
}

async function runProductionTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 PRODUCTION CONFIGURATION TEST SUITE');
  console.log('='.repeat(70));
  console.log(`\n📋 Testing ${PRODUCTION_CONFIGS.length} production configurations`);
  console.log(`📋 Capturing comprehensive logs for debugging\n`);

  const results: TestResult[] = [];
  const allLogs: string[] = [];

  for (const config of PRODUCTION_CONFIGS) {
    const result = await testProductionConfig(config);
    results.push(result);
    allLogs.push(...result.logs);
    
    // Brief pause between configs
    await new Promise(r => setTimeout(r, 2000));
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 PRODUCTION TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal Configurations: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nDetailed Results:\n`);

  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.config}`);
    if (result.success) {
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Tokens: ${result.tokens || 0}`);
      console.log(`   Tool Calls: ${result.toolCalls || 0}`);
      console.log(`   Finish Reason: ${result.finishReason}`);
      console.log(`   Text Length: ${result.textLength || 0} chars`);
    } else {
      console.log(`   Error: ${result.error}`);
      console.log(`   Duration: ${result.duration}ms`);
    }
    console.log(`   Log Entries: ${result.logs.length}`);
    console.log('');
  });

  // Save comprehensive logs
  const fs = await import('fs/promises');
  const logContent = allLogs.join('\n');
  await fs.writeFile('test-output/production-test-logs.txt', logContent);
  console.log(`\n📝 Comprehensive logs saved to: test-output/production-test-logs.txt`);
  console.log(`   Total log entries: ${allLogs.length}`);

  // Exit code
  if (failed > 0) {
    console.error(`\n❌ ${failed} configuration(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All production configurations passed!`);
    process.exit(0);
  }
}

// Ensure output directory exists
import { mkdir } from 'fs/promises';
mkdir('test-output', { recursive: true }).catch(() => {});

runProductionTests();

