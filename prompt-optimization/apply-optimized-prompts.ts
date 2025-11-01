#!/usr/bin/env tsx

/**
 * Apply Optimized Prompts to Source Files
 * Reads optimized-prompts.json and updates source files automatically
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OptimizedPrompt {
  bestPrompt?: string;
  scores?: Record<string, number>;
  runId?: string;
}

const SOURCE_FILES = {
  planner: {
    path: join(__dirname, '..', 'planner.ts'),
    startLine: 124,
    endLine: 165,
    variable: 'systemPrompt',
  },
  evaluator: {
    path: join(__dirname, '..', 'evaluator.ts'),
    startLine: 49,
    endLine: 58,
    variable: 'sys',
  },
  'browser-automation': {
    path: join(__dirname, '..', 'workflows', 'browser-automation-workflow.ts'),
    startLine: 665,
    endLine: 715,
    variable: 'systemLines',
  },
  'gemini-computer-use': {
    path: join(__dirname, '..', 'sidepanel.tsx'),
    startLine: 645,
    endLine: 678,
    variable: 'systemInstruction',
  },
};

async function applyOptimizedPrompt(promptName: string, optimizedPrompt: string) {
  const sourceConfig = SOURCE_FILES[promptName as keyof typeof SOURCE_FILES];
  if (!sourceConfig) {
    throw new Error(`Unknown prompt: ${promptName}`);
  }

  const sourceFile = sourceConfig.path;
  const sourceContent = readFileSync(sourceFile, 'utf-8');
  const lines = sourceContent.split('\n');

  console.log(`📝 Applying optimized prompt to ${sourceFile}`);
  console.log(`   Lines ${sourceConfig.startLine}-${sourceConfig.endLine}`);

  // For now, output instructions for manual application
  // In production, could do automatic replacement with proper parsing
  console.log(`\n📋 Optimized Prompt for ${promptName}:`);
  console.log('─'.repeat(80));
  console.log(optimizedPrompt);
  console.log('─'.repeat(80));
  console.log(`\n💡 Manual Application:`);
  console.log(`   1. Open: ${sourceFile}`);
  console.log(`   2. Find: ${sourceConfig.variable} (around line ${sourceConfig.startLine})`);
  console.log(`   3. Replace with the optimized prompt above`);
  console.log(`   4. Save and test\n`);
}

async function main() {
  const optimizedFile = join(__dirname, 'optimized-prompts.json');
  
  try {
    const optimizedPrompts = JSON.parse(readFileSync(optimizedFile, 'utf-8'));
    
    console.log('📋 Applying Optimized Prompts to Source Files\n');
    
    for (const [promptName, data] of Object.entries(optimizedPrompts)) {
      const promptData = data as OptimizedPrompt;
      if (promptData.bestPrompt) {
        await applyOptimizedPrompt(promptName, promptData.bestPrompt);
      } else {
        console.log(`⚠️  ${promptName}: No optimized prompt found`);
      }
    }
    
    console.log('✅ Review complete. Apply prompts manually or enhance this script for automatic replacement.');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  No optimized prompts found.');
      console.log('   Run optimization first: npm run optimize:all:direct');
      console.log('   Then extract: npm run optimize:extract');
    } else {
      throw error;
    }
  }
}

main().catch(console.error);

