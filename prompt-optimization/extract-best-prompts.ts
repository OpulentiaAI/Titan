#!/usr/bin/env tsx

/**
 * Extract Best Optimized Prompts from DSPyground Runs
 * Reads optimization results and extracts the best prompts for each prompt type
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OptimizationRun {
  id: string;
  timestamp: string;
  prompt: string;
  scores: Record<string, number>;
  overallScore?: number;
}

async function extractBestPrompts(promptName: string): Promise<{
  bestPrompt?: string;
  scores?: Record<string, number>;
  runId?: string;
}> {
  const runsFile = join(__dirname, promptName, '.dspyground/data/runs.json');
  
  try {
    const runsData = JSON.parse(readFileSync(runsFile, 'utf-8'));
    const runs: OptimizationRun[] = runsData.runs || [];
    
    if (runs.length === 0) {
      return {};
    }

    // Find best run by overall score or weighted average
    const bestRun = runs.reduce((best, run) => {
      const currentScore = run.overallScore || 
        Object.values(run.scores || {}).reduce((sum: number, s: number) => sum + s, 0) / Object.keys(run.scores || {}).length;
      const bestScore = best.overallScore || 
        Object.values(best.scores || {}).reduce((sum: number, s: number) => sum + s, 0) / Object.keys(best.scores || {}).length;
      
      return currentScore > bestScore ? run : best;
    }, runs[0]);

    return {
      bestPrompt: bestRun.prompt,
      scores: bestRun.scores,
      runId: bestRun.id,
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {}; // No runs file yet
    }
    throw error;
  }
}

async function main() {
  console.log('📋 Extracting Best Optimized Prompts\n');

  const prompts = ['planner', 'evaluator', 'browser-automation', 'gemini-computer-use'];
  const results: Record<string, any> = {};

  for (const promptName of prompts) {
    console.log(`📋 ${promptName}...`);
    const result = await extractBestPrompts(promptName);
    
    if (result.bestPrompt) {
      console.log(`   ✅ Found optimized prompt (Run ID: ${result.runId})`);
      console.log(`   Scores:`, result.scores);
      results[promptName] = result;
    } else {
      console.log(`   ⚠️  No optimization runs found`);
    }
    console.log('');
  }

  // Save extracted prompts
  const outputFile = join(__dirname, 'optimized-prompts.json');
  writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`✅ Best prompts extracted to: ${outputFile}`);
  console.log('\n💡 Next: Apply these prompts to source files:');
  console.log('   - planner.ts (line 124)');
  console.log('   - evaluator.ts (line 49)');
  console.log('   - workflows/browser-automation-workflow.ts (line 665)');
  console.log('   - sidepanel.tsx (line 645)');
}

main().catch(console.error);

