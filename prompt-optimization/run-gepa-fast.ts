#!/usr/bin/env tsx

/**
 * Fast GEPA Optimization (Testing Version)
 * Runs with fewer rollouts for quick testing (5-10 minutes)
 * Simply calls run-gepa-direct.ts with reduced parameters
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Fast configuration: reduced rollouts for testing
const FAST_CONFIG = [
  { name: 'planner', batch: 2, rollouts: 2 },
  { name: 'evaluator', batch: 2, rollouts: 1 },
  { name: 'browser-automation', batch: 2, rollouts: 2 },
  { name: 'gemini-computer-use', batch: 1, rollouts: 1 },
];

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 FAST GEPA OPTIMIZATION (Testing Mode)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('⚡ Using reduced rollouts for quick testing (5-10 minutes total)');
  console.log('   Note: Results may be lower quality due to fewer iterations.');
  console.log('   For production, use: npm run optimize:all:direct');
  console.log('');
  console.log('📋 Fast Configuration:');
  FAST_CONFIG.forEach(c => {
    console.log(`   • ${c.name}: ${c.rollouts} rollout(s), batch size ${c.batch}`);
  });
  console.log('');

  const results = [];

  for (const config of FAST_CONFIG) {
    try {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 Optimizing: ${config.name}`);
      console.log(`   Batch: ${config.batch} | Rollouts: ${config.rollouts}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Use spawn for real-time output streaming
      const child = spawn('npx', ['tsx', 'prompt-optimization/run-gepa-direct.ts', config.name, config.batch.toString(), config.rollouts.toString()], {
        cwd: rootDir,
        stdio: 'inherit', // Stream output directly to parent process
        shell: false,
      });

      // Wait for process to complete
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            results.push({ prompt: config.name, success: true });
            console.log(`\n✅ ${config.name} completed\n`);
            resolve();
          } else {
            const error = new Error(`Process exited with code ${code}`);
            results.push({ prompt: config.name, success: false, error: error.message });
            console.error(`\n❌ ${config.name} failed: ${error.message}\n`);
            reject(error);
          }
        });

        child.on('error', (error) => {
          results.push({ prompt: config.name, success: false, error: error.message });
          console.error(`\n❌ ${config.name} failed: ${error.message}\n`);
          reject(error);
        });
      });
    } catch (error: any) {
      // Only log if not already handled in promise
      if (!results.find(r => r.prompt === config.name)) {
        console.error(`\n❌ ${config.name} failed: ${error.message}\n`);
        results.push({ prompt: config.name, success: false, error: error.message });
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Fast Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.prompt}: ${r.success ? 'Completed' : r.error}`);
  });
  
  console.log('');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('');

  if (successCount > 0) {
    console.log('💡 Next steps:');
    console.log('   1. Review results in .dspyground/data/runs.json');
    console.log('   2. If results look good, run full optimization:');
    console.log('      npm run optimize:all:direct');
    console.log('   3. Extract best prompts:');
    console.log('      npm run optimize:extract');
    console.log('   4. Apply to source files:');
    console.log('      npm run optimize:apply');
  }
}

main().catch(console.error);
