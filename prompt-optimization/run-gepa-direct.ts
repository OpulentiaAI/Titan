#!/usr/bin/env tsx

/**
 * Direct GEPA Optimization Implementation
 * Implements GEPA algorithm directly without DSPyground UI
 * Uses AI SDK to run optimizations programmatically
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Sample {
  id: string;
  messages: Array<{ role: string; content: string }>;
  feedback?: { rating: number; comment?: string };
}

interface OptimizationConfig {
  promptName: string;
  systemPrompt: string;
  samples: Sample[];
  batchSize: number;
  rollouts: number;
  metrics: string[];
}

interface OptimizedPrompt {
  prompt: string;
  scores: Record<string, number>;
  overallScore: number;
}

async function evaluatePrompt(
  prompt: string,
  sample: Sample,
  apiKey: string
): Promise<Record<string, number>> {
  if (!apiKey) {
    console.warn('   ⚠️  No API key provided, using fallback scores');
    return {
      accuracy: 0.5,
      efficiency: 0.5,
      completeness: 0.5,
    };
  }

  try {
    // Use AI SDK to evaluate prompt against sample
    const { createGateway } = await import('@ai-sdk/gateway');
    const { generateObject } = await import('ai');
    const { z } = await import('zod');
    
    const client = createGateway({ apiKey });
    const model = client('google/gemini-2.5-pro');
    
    const evaluationSchema = z.object({
      accuracy: z.number().min(0).max(1),
      efficiency: z.number().min(0).max(1),
      completeness: z.number().min(0).max(1),
    });
    
    const userMessage = sample.messages.find(m => m.role === 'user')?.content || '';
    const assistantMessage = sample.messages.find(m => m.role === 'assistant')?.content || '';
    
    const result = await generateObject({
      model,
      schema: evaluationSchema,
      system: `You are an evaluator. Rate the assistant's response quality on a scale of 0-1.`,
      prompt: `System Prompt: ${prompt.substring(0, 500)}\n\nUser: ${userMessage}\nAssistant: ${assistantMessage}\n\nRate the quality:`,
      maxTokens: 200,
    });
    
    return result.object as Record<string, number>;
  } catch (error: any) {
    console.warn(`   ⚠️  Evaluation error: ${error.message?.substring(0, 100)}`);
    // Fallback scores
    return {
      accuracy: 0.5,
      efficiency: 0.5,
      completeness: 0.5,
    };
  }
}

async function runGEPAOptimization(config: OptimizationConfig): Promise<OptimizedPrompt[]> {
  const apiKey = process.env.AI_GATEWAY_API_KEY || '';
  if (!apiKey) {
    console.warn('⚠️  AI_GATEWAY_API_KEY not set - optimization will use simplified evaluation');
    console.warn('   Set AI_GATEWAY_API_KEY environment variable for full optimization');
  }

  console.log(`🔄 Running GEPA optimization (${config.rollouts} rollouts)...`);

  const paretoFrontier: OptimizedPrompt[] = [];
  let currentPrompt = config.systemPrompt;

  // Save intermediate results function
  const saveIntermediateResults = () => {
    const dataDir = join(__dirname, config.promptName, '.dspyground/data');
    const runsFile = join(dataDir, 'runs.json');

    try {
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      let runsData: any = { runs: [] };
      try {
        const fileContent = readFileSync(runsFile, 'utf-8');
        if (fileContent.trim()) {
          runsData = JSON.parse(fileContent);
        }
      } catch {}

      // Remove any previous intermediate run for this session
      runsData.runs = runsData.runs.filter((run: any) => !run.id.startsWith('intermediate-'));

      const intermediateRun = {
        id: `intermediate-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: currentPrompt,
        scores: {},
        overallScore: 0,
        allResults: paretoFrontier,
        rolloutsCompleted: paretoFrontier.length,
        rolloutsRequested: config.rollouts,
        status: 'in-progress',
      };

      runsData.runs.push(intermediateRun);
      writeFileSync(runsFile, JSON.stringify(runsData, null, 2));
    } catch (error) {
      console.warn(`⚠️  Failed to save intermediate results: ${error}`);
    }
  };
  
  for (let i = 0; i < config.rollouts; i++) {
    console.log(`   Rollout ${i + 1}/${config.rollouts}...`);
    
    // Sample batch
    const batch: Sample[] = [];
    const shuffled = [...config.samples].sort(() => Math.random() - 0.5);
    for (let j = 0; j < Math.min(config.batchSize, shuffled.length); j++) {
      batch.push(shuffled[j]);
    }
    
    // Evaluate current prompt
    const scores: Record<string, number> = {};
    for (let sIdx = 0; sIdx < batch.length; sIdx++) {
      const sample = batch[sIdx];
      process.stdout.write(`      Evaluating sample ${sIdx + 1}/${batch.length}... `);
      const sampleScores = await evaluatePrompt(currentPrompt, sample, apiKey);
      process.stdout.write(`✅\n`);
      for (const [metric, value] of Object.entries(sampleScores)) {
        scores[metric] = (scores[metric] || 0) + value;
      }
    }
    
    // Average scores
    for (const metric in scores) {
      scores[metric] = scores[metric] / batch.length;
    }
    
    const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    
    // Generate improved prompt
    process.stdout.write(`      Generating improved prompt... `);
    let improvedPrompt: string;
    try {
      const { createGateway } = await import('@ai-sdk/gateway');
      const { generateText } = await import('ai');
      
      if (!apiKey) {
        throw new Error('AI_GATEWAY_API_KEY not set');
      }
      
      const client = createGateway({ apiKey });
      const model = client('google/gemini-2.5-pro');
      
      const sampleSummary = batch.slice(0, 2).map(s => {
        const user = s.messages.find(m => m.role === 'user')?.content.substring(0, 100) || '';
        return `User: ${user}`;
      }).join('\n');
      
      const improvedPromptResult = await generateText({
        model,
        system: `You are a prompt optimizer. Improve the given prompt based on evaluation feedback. Keep improvements focused and practical.`,
        prompt: `Current Prompt:\n${currentPrompt.substring(0, 1000)}\n\nEvaluation Scores:\n${JSON.stringify(scores, null, 2)}\n\nSample Context:\n${sampleSummary}\n\nGenerate an improved version of the prompt that addresses weaknesses. Keep it concise and focused.`,
        maxTokens: 2000,
      });
      
      improvedPrompt = improvedPromptResult.text;
      process.stdout.write(`✅\n`);
    } catch (error: any) {
      console.warn(`\n   ⚠️  Prompt generation failed: ${error.message?.substring(0, 150)}`);
      console.warn(`   Using current prompt (no improvement generated)`);
      improvedPrompt = currentPrompt; // Use current prompt if generation fails
      process.stdout.write(`⚠️\n`);
    }
    
    // Evaluate improved prompt
    const improvedScores: Record<string, number> = {};
    for (const sample of batch) {
      const sampleScores = await evaluatePrompt(improvedPrompt, sample, apiKey);
      for (const [metric, value] of Object.entries(sampleScores)) {
        improvedScores[metric] = (improvedScores[metric] || 0) + value;
      }
    }
    
    for (const metric in improvedScores) {
      improvedScores[metric] = improvedScores[metric] / batch.length;
    }
    
    const improvedOverallScore = Object.values(improvedScores).reduce((a, b) => a + b, 0) / Object.keys(improvedScores).length;
    
    // Accept if improved
    if (improvedOverallScore > overallScore) {
      currentPrompt = improvedPrompt;
      paretoFrontier.push({
        prompt: improvedPrompt,
        scores: improvedScores,
        overallScore: improvedOverallScore,
      });
      console.log(`   ✅ Improved! Score: ${overallScore.toFixed(3)} → ${improvedOverallScore.toFixed(3)}`);
    } else {
      console.log(`   ⏭️  No improvement (${overallScore.toFixed(3)} vs ${improvedOverallScore.toFixed(3)})`);
    }

    // Save intermediate results after each rollout
    saveIntermediateResults();
  }
  
  return paretoFrontier;
}

async function optimizePrompt(promptName: string, batchSize: number, rollouts: number) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Optimizing: ${promptName}`);
  console.log(`   Batch Size: ${batchSize} | Rollouts: ${rollouts}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log('Starting optimization process...');
  
  // Load config dynamically
  const configPath = join(__dirname, promptName, 'dspyground.config.ts');

  // Use dynamic import to load config
  let systemPrompt: string;
  try {
    // Use relative import path
    const relativePath = `./${promptName}/dspyground.config.ts`;
    const configModule = await import(relativePath);
    systemPrompt = configModule.default?.systemPrompt || '';

    if (!systemPrompt) {
      throw new Error('systemPrompt not found in config module');
    }
  } catch (error) {
    console.warn(`Dynamic import failed: ${error}, falling back to manual parsing`);
    // Fallback: read and parse manually
    const configContent = readFileSync(configPath, 'utf-8');
    const systemPromptMatch = configContent.match(/systemPrompt:\s*`([^`]+)`/s);
    if (!systemPromptMatch) {
      throw new Error(`Could not extract systemPrompt from config: ${error}`);
    }
    systemPrompt = systemPromptMatch[1];
  }
  
  // Load samples
  const samplesFile = join(__dirname, promptName, '.dspyground/data/samples.json');
  const samplesData = JSON.parse(readFileSync(samplesFile, 'utf-8'));
  const allSamples: Sample[] = samplesData.groups.flatMap((g: any) => g.samples || []);
  
  if (allSamples.length < batchSize) {
    throw new Error(`Insufficient samples: ${allSamples.length} < ${batchSize}`);
  }
  
  console.log(`✅ Loaded ${allSamples.length} samples`);
  
  // Run optimization with error handling
  let results: OptimizedPrompt[] = [];
  try {
    results = await runGEPAOptimization({
      promptName,
      systemPrompt,
      samples: allSamples,
      batchSize,
      rollouts,
      metrics: ['accuracy', 'efficiency', 'completeness'],
    });
  } catch (error: any) {
    console.error(`\n❌ Optimization failed: ${error.message}`);
    console.error(`   Error: ${error.stack?.split('\n')[0] || error.message}`);
    // Continue to save partial results if any were generated
  }
  
  // Save results (even if optimization partially failed)
  const runsFile = join(__dirname, promptName, '.dspyground/data/runs.json');
  let runsData: any = { runs: [] };
  try {
    const fileContent = readFileSync(runsFile, 'utf-8');
    if (fileContent.trim()) {
      runsData = JSON.parse(fileContent);
    }
  } catch (error) {
    // File doesn't exist or is invalid, use empty structure
  }
  
  // Always save a run, even if optimization failed
  const bestResult = results.length > 0 ? results[results.length - 1] : null;
  const newRun = {
    id: `run-${Date.now()}`,
    timestamp: new Date().toISOString(),
    prompt: bestResult?.prompt || systemPrompt,
    scores: bestResult?.scores || {},
    overallScore: bestResult?.overallScore || 0,
    allResults: results,
    rolloutsCompleted: results.length,
    rolloutsRequested: rollouts,
  };
  
  runsData.runs.push(newRun);
  
  // Ensure directory exists
  const runsDir = dirname(runsFile);
  try {
    if (!existsSync(runsDir)) {
      mkdirSync(runsDir, { recursive: true });
    }
  } catch {}
  
  writeFileSync(runsFile, JSON.stringify(runsData, null, 2));
  
  if (results.length > 0) {
    console.log(`\n✅ Optimization complete!`);
    console.log(`   Best score: ${newRun.overallScore.toFixed(3)}`);
    console.log(`   Rollouts completed: ${results.length}/${rollouts}`);
    console.log(`   Results saved to: ${runsFile}`);
  } else {
    console.log(`\n⚠️  Optimization completed with no improvements`);
    console.log(`   Results saved to: ${runsFile}`);
    console.log(`   Check API key configuration if issues persist`);
  }
  
  return newRun;
}

// Export for use in other scripts
export { optimizePrompt };

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run all
    const configs = [
      { name: 'planner', batch: 3, rollouts: 10 },
      { name: 'evaluator', batch: 3, rollouts: 8 },
      { name: 'browser-automation', batch: 3, rollouts: 10 },
      { name: 'gemini-computer-use', batch: 2, rollouts: 8 },
    ];
    
    for (const config of configs) {
      try {
        await optimizePrompt(config.name, config.batch, config.rollouts);
      } catch (error: any) {
        console.error(`❌ ${config.name}: ${error.message}`);
      }
    }
  } else {
    // Run specific
    const promptName = args[0];
    const batchSize = parseInt(args[1]) || 3;
    const rollouts = parseInt(args[2]) || 10;
    
    await optimizePrompt(promptName, batchSize, rollouts);
  }
}

// Run main when script is executed directly (not imported)
// When executed via tsx/node, import.meta.url will contain the script filename
// Also check process.argv for the script name (works with different runners)
const scriptName = 'run-gepa-direct';
const isExecutingThisScript = 
  import.meta.url.includes(scriptName) || 
  process.argv.some(arg => arg.includes(scriptName));

if (isExecutingThisScript) {
  main().catch(error => {
    console.error('Fatal error in optimization script:', error);
    process.exit(1);
  });
}

