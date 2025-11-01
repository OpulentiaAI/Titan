#!/usr/bin/env tsx

/**
 * Run DSPyground Optimization via API
 * Calls DSPyground's optimization API endpoints programmatically
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OptimizationRequest {
  batchSize: number;
  numRollouts: number;
  selectedMetrics: string[];
}

interface OptimizationResult {
  success: boolean;
  optimizedPrompt?: string;
  scores?: Record<string, number>;
  error?: string;
}

async function callOptimizeAPI(
  promptDir: string,
  request: OptimizationRequest
): Promise<OptimizationResult> {
  // DSPyground runs on Next.js, so the API should be at /api/optimize
  // We'll start a server and call it, or use fetch if server is running
  
  const baseUrl = process.env.DSPYGROUND_URL || 'http://localhost:3000';
  const apiUrl = `${baseUrl}/api/optimize`;

  try {
    // Load samples to verify they exist
    const samplesFile = join(promptDir, '.dspyground/data/samples.json');
    const samples = JSON.parse(readFileSync(samplesFile, 'utf-8'));
    const sampleCount = samples.groups.reduce((sum: number, g: any) => sum + (g.samples?.length || 0), 0);

    if (sampleCount < request.batchSize) {
      return {
        success: false,
        error: `Insufficient samples: ${sampleCount} < ${request.batchSize}`,
      };
    }

    console.log(`📡 Calling optimization API: ${apiUrl}`);
    console.log(`   Samples: ${sampleCount}, Batch: ${request.batchSize}, Rollouts: ${request.numRollouts}`);

    // Try to call the API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        promptDir,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      optimizedPrompt: result.optimizedPrompt,
      scores: result.scores,
    };
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'DSPyground server not running. Start with: npm run optimize:<prompt-name>',
      };
    }
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

async function runOptimizationForPrompt(
  promptName: string,
  batchSize: number,
  rollouts: number,
  metrics: string[]
): Promise<OptimizationResult> {
  const promptDir = join(__dirname, promptName);
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Optimizing: ${promptName}`);
  console.log(`   Batch Size: ${batchSize} | Rollouts: ${rollouts}`);
  console.log(`   Metrics: ${metrics.join(', ')}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return await callOptimizeAPI(promptDir, {
    batchSize,
    numRollouts: rollouts,
    selectedMetrics: metrics,
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run all prompts
    console.log('🚀 Running optimizations for all prompts...\n');
    
    const configs = [
      { name: 'planner', batch: 3, rollouts: 10, metrics: ['accuracy', 'efficiency', 'completeness'] },
      { name: 'evaluator', batch: 3, rollouts: 8, metrics: ['accuracy', 'efficiency', 'clarity'] },
      { name: 'browser-automation', batch: 3, rollouts: 10, metrics: ['tool_accuracy', 'efficiency', 'reliability'] },
      { name: 'gemini-computer-use', batch: 2, rollouts: 8, metrics: ['visual_accuracy', 'efficiency', 'safety'] },
    ];

    const results = [];
    for (const config of configs) {
      const result = await runOptimizationForPrompt(
        config.name,
        config.batch,
        config.rollouts,
        config.metrics
      );
      results.push({ prompt: config.name, ...result });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Optimization Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      console.log(`${status} ${r.prompt}: ${r.success ? 'Completed' : r.error || 'Failed'}`);
      if (r.scores) {
        console.log(`   Scores:`, r.scores);
      }
    });
  } else {
    // Run specific prompt
    const promptName = args[0];
    const batchSize = parseInt(args[1]) || 3;
    const rollouts = parseInt(args[2]) || 10;
    
    const result = await runOptimizationForPrompt(promptName, batchSize, rollouts, []);
    console.log('\n', result.success ? '✅ Optimization completed' : `❌ ${result.error}`);
  }
}

main().catch(console.error);

