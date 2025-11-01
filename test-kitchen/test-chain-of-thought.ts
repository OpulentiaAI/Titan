#!/usr/bin/env tsx
// Chain of Thought Reasoning Test
// Tests the reasoning queue and chain-of-thought implementation

// Polyfill for AI SDK
(globalThis as any).__name = (globalThis as any).__name || ((target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {
    // Ignore
  }
  return target;
});
(global as any).__name = (globalThis as any).__name;

import { atlasTask } from './atlasTask.js';
import type { AtlasModel, AtlasSettings } from './types.js';
import { getThreadManager } from '../lib/thread-manager.js';

console.log('🧠 Testing Chain-of-Thought Reasoning Implementation\n');
console.log('='.repeat(80));

const model: AtlasModel = {
  name: 'gateway-flash-lite',
  model_slug: 'google/gemini-2.5-flash-lite-preview-09-2025',
  provider: 'gateway',
  computerUseEngine: 'gateway-flash-lite',
  maxTokens: 8192,
};

const settings: AtlasSettings = {
  provider: 'gateway',
  apiKey: process.env.AI_GATEWAY_API_KEY!,
  model: 'google/gemini-2.5-flash-lite-preview-09-2025',
  computerUseEngine: 'gateway-flash-lite',
};

// Test cases designed to trigger different reasoning patterns
const testCases = [
  {
    name: 'Simple Navigation',
    query: 'Navigate to https://example.com and verify the page loaded',
    expectedReasoningTypes: ['navigation', 'verification'],
  },
  {
    name: 'Multi-Step Search',
    query: 'Go to Google, search for "AI reasoning", and analyze the first result',
    expectedReasoningTypes: ['navigation', 'search', 'analysis'],
  },
  {
    name: 'Form Interaction',
    query: 'Navigate to https://httpbin.org/forms/post and fill out the form',
    expectedReasoningTypes: ['navigation', 'form-analysis', 'input'],
  },
];

interface ReasoningStep {
  type: string;
  content: string;
  timestamp: number;
  confidence?: number;
}

interface ChainOfThoughtAnalysis {
  totalSteps: number;
  reasoningTypes: Set<string>;
  averageStepDuration: number;
  hasPlanning: boolean;
  hasExecution: boolean;
  hasSummarization: boolean;
  coherenceScore: number; // 0-1: measures logical flow
}

async function analyzeChainOfThought(result: any): Promise<ChainOfThoughtAnalysis> {
  const messages = result.messages || [];
  const reasoning: ReasoningStep[] = [];
  
  // Extract reasoning from messages
  messages.forEach((msg: any, idx: number) => {
    if (msg.role === 'assistant' && msg.content) {
      const content = msg.content.toLowerCase();
      
      // Detect reasoning type from content patterns
      const types: string[] = [];
      if (content.includes('planning') || content.includes('plan:')) types.push('planning');
      if (content.includes('navigat')) types.push('navigation');
      if (content.includes('search') || content.includes('find')) types.push('search');
      if (content.includes('analyz') || content.includes('examin')) types.push('analysis');
      if (content.includes('click') || content.includes('type') || content.includes('input')) types.push('execution');
      if (content.includes('verif') || content.includes('check')) types.push('verification');
      if (content.includes('summary') || content.includes('complet')) types.push('summarization');
      if (content.includes('form') || content.includes('field')) types.push('form-analysis');
      
      types.forEach(type => {
        reasoning.push({
          type,
          content: msg.content,
          timestamp: msg.timestamp || Date.now() + idx * 1000,
        });
      });
    }
  });
  
  // Calculate coherence score (measures if steps follow logical order)
  let coherenceScore = 1.0;
  const expectedOrder = ['planning', 'navigation', 'search', 'analysis', 'execution', 'verification', 'summarization'];
  
  for (let i = 0; i < reasoning.length - 1; i++) {
    const currentIdx = expectedOrder.indexOf(reasoning[i].type);
    const nextIdx = expectedOrder.indexOf(reasoning[i + 1].type);
    
    // Penalize if steps are out of expected order
    if (currentIdx !== -1 && nextIdx !== -1 && nextIdx < currentIdx - 1) {
      coherenceScore -= 0.1;
    }
  }
  coherenceScore = Math.max(0, coherenceScore);
  
  const reasoningTypes = new Set(reasoning.map(r => r.type));
  
  // Calculate average step duration
  let totalDuration = 0;
  for (let i = 0; i < reasoning.length - 1; i++) {
    totalDuration += reasoning[i + 1].timestamp - reasoning[i].timestamp;
  }
  const averageStepDuration = reasoning.length > 1 ? totalDuration / (reasoning.length - 1) : 0;
  
  return {
    totalSteps: reasoning.length,
    reasoningTypes,
    averageStepDuration,
    hasPlanning: reasoningTypes.has('planning'),
    hasExecution: reasoningTypes.has('execution') || reasoningTypes.has('navigation'),
    hasSummarization: reasoningTypes.has('summarization'),
    coherenceScore,
  };
}

async function runTest(testCase: typeof testCases[0], testNum: number) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📋 Test ${testNum}: ${testCase.name}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`Query: "${testCase.query}"\n`);
  
  const threadManager = getThreadManager();
  threadManager.clearHistory();
  
  // Subscribe to tool events for detailed logging
  let toolEventCount = 0;
  threadManager.subscribe((event: any) => {
    if (event.phase === 'starting') {
      toolEventCount++;
      console.log(`  🔧 [${toolEventCount}] ${event.toolName} - starting`);
    }
  });
  
  const startTime = Date.now();
  
  try {
    const result = await atlasTask(model, settings, testCase.query);
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Test completed in ${(duration / 1000).toFixed(2)}s\n`);
    
    // Analyze chain of thought
    const analysis = await analyzeChainOfThought(result);
    
    console.log('🧠 Chain-of-Thought Analysis:');
    console.log(`  Total Reasoning Steps: ${analysis.totalSteps}`);
    console.log(`  Reasoning Types: ${Array.from(analysis.reasoningTypes).join(', ')}`);
    console.log(`  Average Step Duration: ${(analysis.averageStepDuration / 1000).toFixed(2)}s`);
    console.log(`  Has Planning: ${analysis.hasPlanning ? '✅' : '❌'}`);
    console.log(`  Has Execution: ${analysis.hasExecution ? '✅' : '❌'}`);
    console.log(`  Has Summarization: ${analysis.hasSummarization ? '✅' : '❌'}`);
    console.log(`  Coherence Score: ${(analysis.coherenceScore * 100).toFixed(0)}%`);
    
    // Check if expected reasoning types are present
    const missingTypes = testCase.expectedReasoningTypes.filter(
      type => !analysis.reasoningTypes.has(type)
    );
    
    if (missingTypes.length > 0) {
      console.log(`\n⚠️  Missing Expected Reasoning Types: ${missingTypes.join(', ')}`);
    } else {
      console.log(`\n✅ All expected reasoning types present`);
    }
    
    // Message flow analysis
    const messages = result.messages || [];
    console.log(`\n📨 Message Flow:`);
    console.log(`  Total Messages: ${messages.length}`);
    console.log(`  User Messages: ${messages.filter((m: any) => m.role === 'user').length}`);
    console.log(`  Assistant Messages: ${messages.filter((m: any) => m.role === 'assistant').length}`);
    
    // Tool execution analysis
    const toolEvents = threadManager.getHistory();
    const toolUsage = toolEvents.reduce((acc: any, event: any) => {
      acc[event.toolName] = (acc[event.toolName] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n🔧 Tool Execution:`);
    console.log(`  Total Tool Events: ${toolEvents.length}`);
    console.log(`  Tool Usage:`, JSON.stringify(toolUsage, null, 2).split('\n').map(l => `    ${l}`).join('\n'));
    
    return {
      success: result.success,
      analysis,
      duration,
      toolEventCount: toolEvents.length,
      messages: messages.length,
    };
    
  } catch (error: any) {
    console.error(`\n❌ Test failed:`, error?.message || error);
    console.error(error?.stack);
    return {
      success: false,
      error: error?.message || String(error),
      duration: Date.now() - startTime,
    };
  }
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('❌ AI_GATEWAY_API_KEY not set');
    process.exit(1);
  }
  
  console.log('Testing Chain-of-Thought Implementation');
  console.log(`Model: ${model.name}`);
  console.log(`Total Test Cases: ${testCases.length}\n`);
  
  const results: any[] = [];
  
  // Run tests sequentially to avoid browser conflicts
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const result = await runTest(testCase, i + 1);
    results.push({ testCase: testCase.name, ...result });
    
    // Add delay between tests to allow cleanup
    if (i < testCases.length - 1) {
      console.log(`\n⏳ Waiting 2s before next test...\n`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 OVERALL SUMMARY');
  console.log(`${'='.repeat(80)}\n`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (successful > 0) {
    const avgCoherence = results
      .filter(r => r.success && r.analysis)
      .reduce((sum, r) => sum + r.analysis.coherenceScore, 0) / successful;
    
    const avgSteps = results
      .filter(r => r.success && r.analysis)
      .reduce((sum, r) => sum + r.analysis.totalSteps, 0) / successful;
    
    const avgDuration = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.duration, 0) / successful;
    
    console.log(`\nAverages (successful tests):`);
    console.log(`  Coherence Score: ${(avgCoherence * 100).toFixed(0)}%`);
    console.log(`  Reasoning Steps: ${avgSteps.toFixed(1)}`);
    console.log(`  Duration: ${(avgDuration / 1000).toFixed(2)}s`);
  }
  
  // Detailed results
  console.log(`\nDetailed Results:`);
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    const duration = r.duration ? `${(r.duration / 1000).toFixed(2)}s` : 'N/A';
    const coherence = r.analysis?.coherenceScore 
      ? `coherence: ${(r.analysis.coherenceScore * 100).toFixed(0)}%` 
      : r.error || 'failed';
    
    console.log(`  ${i + 1}. ${status} ${r.testCase} - ${duration} (${coherence})`);
  });
  
  console.log(`\n${'='.repeat(80)}\n`);
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main();

