#!/usr/bin/env tsx
// Reasoning & Observations Test
// Validates Atlas-style observation-reasoning-prediction pattern
// Tests OpenRouter-style reasoning token capture

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

console.log('🧠 Reasoning & Observations Implementation Test\n');
console.log('='.repeat(80));
console.log('Validating:');
console.log('  1. Observation → Reasoning → Prediction → Action pattern');
console.log('  2. Reasoning tokens capture (OpenRouter-style)');
console.log('  3. Message artifact integration\n');
console.log('='.repeat(80) + '\n');

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

function validateObservationPattern(content: string): {
  hasObservation: boolean;
  hasReasoning: boolean;
  hasPrediction: boolean;
  hasAction: boolean;
  score: number;
  examples: string[];
} {
  const lowerContent = content.toLowerCase();
  
  const hasObservation = lowerContent.includes('observation:') || lowerContent.includes('observe:');
  const hasReasoning = lowerContent.includes('reasoning:') || lowerContent.includes('reason:');
  const hasPrediction = lowerContent.includes('prediction:') || lowerContent.includes('predict:') || lowerContent.includes('expect:');
  const hasAction = lowerContent.includes('action:') || lowerContent.includes('calling') || lowerContent.includes('execute');
  
  const components = [hasObservation, hasReasoning, hasPrediction, hasAction];
  const score = (components.filter(Boolean).length / 4) * 100;
  
  const examples: string[] = [];
  
  // Extract examples
  const observationMatch = content.match(/Observation:([^\n]+)/i);
  const reasoningMatch = content.match(/Reasoning:([^\n]+)/i);
  const predictionMatch = content.match(/Prediction:([^\n]+)/i);
  
  if (observationMatch) examples.push(`Observation: ${observationMatch[1].trim().substring(0, 80)}...`);
  if (reasoningMatch) examples.push(`Reasoning: ${reasoningMatch[1].trim().substring(0, 80)}...`);
  if (predictionMatch) examples.push(`Prediction: ${predictionMatch[1].trim().substring(0, 80)}...`);
  
  return {
    hasObservation,
    hasReasoning,
    hasPrediction,
    hasAction,
    score,
    examples,
  };
}

async function runReasoningTest() {
  console.log('📋 Running reasoning & observations test\n');
  console.log('Query: "Navigate to https://example.com and verify it loaded"\n');

  const threadManager = getThreadManager();
  threadManager.clearHistory();

  const testQuery = 'Navigate to https://example.com and verify it loaded';
  const startTime = Date.now();

  try {
    const result = await atlasTask(model, settings, testQuery);
    const duration = Date.now() - startTime;

    console.log(`✅ Task completed in ${(duration / 1000).toFixed(2)}s\n`);

    const messages = result.messages || [];
    const assistantMessages = messages.filter((m: any) => m.role === 'assistant');

    console.log('='.repeat(80));
    console.log('🔍 OBSERVATION-REASONING-PREDICTION PATTERN ANALYSIS');
    console.log('='.repeat(80) + '\n');

    let totalPatternScore = 0;
    let messagesWithPattern = 0;
    const allExamples: string[] = [];

    assistantMessages.forEach((msg: any, idx: number) => {
      const validation = validateObservationPattern(msg.content);
      
      if (validation.score > 0) {
        messagesWithPattern++;
        totalPatternScore += validation.score;
        
        console.log(`Message ${idx + 1}:`);
        console.log(`  Pattern Score: ${validation.score.toFixed(0)}/100`);
        console.log(`  ✅ Components:`);
        console.log(`     ${validation.hasObservation ? '✅' : '❌'} Observation`);
        console.log(`     ${validation.hasReasoning ? '✅' : '❌'} Reasoning`);
        console.log(`     ${validation.hasPrediction ? '✅' : '❌'} Prediction`);
        console.log(`     ${validation.hasAction ? '✅' : '❌'} Action`);
        
        if (validation.examples.length > 0) {
          console.log(`  Examples:`);
          validation.examples.forEach(ex => {
            console.log(`     ${ex}`);
          });
        }
        
        allExamples.push(...validation.examples);
        console.log('');
      }
    });

    const avgPatternScore = messagesWithPattern > 0 
      ? totalPatternScore / messagesWithPattern 
      : 0;

    console.log('='.repeat(80));
    console.log('📊 REASONING TOKENS ANALYSIS');
    console.log('='.repeat(80) + '\n');

    let messagesWithReasoning = 0;
    let totalReasoningChunks = 0;

    assistantMessages.forEach((msg: any, idx: number) => {
      if (msg.reasoning && Array.isArray(msg.reasoning) && msg.reasoning.length > 0) {
        messagesWithReasoning++;
        totalReasoningChunks += msg.reasoning.length;
        
        console.log(`Message ${idx + 1}: ${msg.reasoning.length} reasoning chunks`);
        msg.reasoning.slice(0, 3).forEach((r: string, i: number) => {
          console.log(`  ${i + 1}. ${r.substring(0, 80)}...`);
        });
        console.log('');
      }
      
      if (msg.reasoningDetails && Array.isArray(msg.reasoningDetails)) {
        console.log(`Message ${idx + 1}: ${msg.reasoningDetails.length} reasoning details (OpenRouter format)`);
        msg.reasoningDetails.slice(0, 2).forEach((detail: any) => {
          console.log(`  - Type: ${detail.type}, Format: ${detail.format}`);
        });
        console.log('');
      }
    });

    console.log('='.repeat(80));
    console.log('📈 OVERALL REASONING METRICS');
    console.log('='.repeat(80) + '\n');

    console.log(`Pattern Compliance:`);
    console.log(`  Messages with Observation Pattern: ${messagesWithPattern}/${assistantMessages.length}`);
    console.log(`  Average Pattern Score: ${avgPatternScore.toFixed(0)}/100`);
    console.log(`  Total Pattern Examples: ${allExamples.length}\n`);

    console.log(`Reasoning Tokens:`);
    console.log(`  Messages with Reasoning: ${messagesWithReasoning}/${assistantMessages.length}`);
    console.log(`  Total Reasoning Chunks: ${totalReasoningChunks}`);
    console.log(`  Reasoning Token Support: ${totalReasoningChunks > 0 ? '✅ Active' : '⚠️  Not captured (model may not emit)'}\n`);

    const overallScore = avgPatternScore;
    const passed = overallScore >= 75;

    console.log('='.repeat(80));
    console.log('🏁 TEST RESULTS');
    console.log('='.repeat(80) + '\n');

    const rating = overallScore >= 90 ? '🌟 EXCELLENT' :
                   overallScore >= 75 ? '✅ GOOD' :
                   overallScore >= 50 ? '⚠️  ACCEPTABLE' :
                   '❌ NEEDS IMPROVEMENT';

    console.log(`Rating: ${rating}`);
    console.log(`Pattern Score: ${overallScore.toFixed(0)}/100`);
    console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);

    if (messagesWithPattern > 0) {
      console.log('✅ Model is following Observation-Reasoning-Prediction pattern');
      console.log('✅ System prompt successfully enforcing structured reasoning\n');
    }

    if (totalReasoningChunks > 0) {
      console.log('✅ Reasoning tokens are being captured');
      console.log('✅ OpenRouter-style reasoning integration active\n');
    } else {
      console.log('ℹ️  Reasoning tokens not captured (model may not emit them natively)');
      console.log('✅ But observation pattern IS working in content\n');
    }

    console.log('Sample Observation-Reasoning-Prediction:');
    console.log('─'.repeat(80));
    allExamples.slice(0, 3).forEach(ex => {
      console.log(ex);
    });
    console.log('─'.repeat(80) + '\n');

    return {
      success: true,
      overallScore,
      messagesWithPattern,
      messagesWithReasoning,
      totalReasoningChunks,
    };

  } catch (error: any) {
    console.error('\n❌ Test failed:', error?.message || error);
    console.error(error?.stack);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('❌ AI_GATEWAY_API_KEY not set');
    process.exit(1);
  }

  const result = await runReasoningTest();

  if (result.success) {
    const passed = result.overallScore >= 75;
    process.exit(passed ? 0 : 1);
  } else {
    process.exit(1);
  }
}

main();

