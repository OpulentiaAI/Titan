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
    endLine: 168,
    variable: 'systemPrompt',
    description: 'Planning agent system prompt with validation and fallback strategies',
  },
  evaluator: {
    path: join(__dirname, '..', 'evaluator.ts'),
    startLine: 59,
    endLine: 61,
    variable: 'sys',
    description: 'Search result evaluation prompt',
  },
  'browser-automation-legacy': {
    path: join(__dirname, '..', 'workflows', 'browser-automation-workflow.legacy.ts'),
    startLine: 1234,
    endLine: 1399,
    variable: 'systemLines',
    description: 'Legacy browser automation agent system prompt with advanced reasoning patterns',
  },
  'browser-automation-enhanced': {
    path: join(__dirname, '..', 'workflows', 'browser-automation-workflow-enhanced.ts'),
    startLine: 339,
    endLine: 440,
    variable: 'systemPrompt',
    description: 'Enhanced browser automation agent with evaluation loop and advanced reasoning',
  },
  'gemini-computer-use': {
    path: join(__dirname, '..', 'sidepanel.tsx'),
    startLine: 645,
    endLine: 678,
    variable: 'systemInstruction',
    description: 'Gemini computer use system instruction',
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
  console.log(`   ${sourceConfig.description || 'System prompt'}`);
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
  console.log(`   4. Test with: npm run test:e2e`);
  console.log(`   5. Validate improvements in accuracy/completeness\n`);
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

