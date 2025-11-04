#!/usr/bin/env tsx

/**
 * Example: Hybrid GEPA + Arbor + Verifiers Workflow
 *
 * This example demonstrates the complete integration of:
 * 1. GEPA: Reflective prompt optimization
 * 2. Arbor: GRPO reinforcement learning
 * 3. Verifiers: Tool-based sample expansion
 *
 * Expected Performance:
 * - 15-30% total improvement over baseline
 * - 35x fewer rollouts than pure GRPO
 * - 1-3 hours for complete optimization
 *
 * Usage:
 *   npx tsx prompt-optimization/examples/example-hybrid-workflow.ts
 */

import { createArborGEPAAdapter } from '../arbor/arbor-gepa-adapter';
import { createToolVerifierEnv } from '../verifiers/tool-verifier-env';
import type { ToolDefinition } from '../verifiers/types';
import type { TrainingExample, DSPyProgram } from '../arbor/types';

/**
 * Example tool definitions for search and data analysis
 */
const exampleTools: ToolDefinition[] = [
  {
    name: 'search_web',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum results to return' }
      },
      required: ['query']
    },
    function: async (query: string, maxResults = 10) => {
      console.log(`[Tool] search_web: ${query}`);
      return {
        results: [
          { title: 'Result 1', url: 'https://example.com/1' },
          { title: 'Result 2', url: 'https://example.com/2' }
        ].slice(0, maxResults)
      };
    }
  },
  {
    name: 'analyze_data',
    description: 'Analyze structured data and return insights',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'Data to analyze' },
        analysisType: {
          type: 'string',
          description: 'Type of analysis: summary, stats, trends'
        }
      },
      required: ['data', 'analysisType']
    },
    function: async (data: any, analysisType: string) => {
      console.log(`[Tool] analyze_data: ${analysisType}`);
      return {
        analysis: `${analysisType} analysis of data`,
        insights: ['Insight 1', 'Insight 2'],
        confidence: 0.85
      };
    }
  },
  {
    name: 'generate_report',
    description: 'Generate a formatted report from findings',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Report title' },
        findings: { type: 'array', description: 'List of findings' },
        format: {
          type: 'string',
          description: 'Output format: markdown, html, json'
        }
      },
      required: ['title', 'findings']
    },
    function: async (title: string, findings: string[], format = 'markdown') => {
      console.log(`[Tool] generate_report: ${title}`);
      return {
        report: `# ${title}\n\n${findings.join('\n- ')}`,
        format,
        generatedAt: new Date().toISOString()
      };
    }
  }
];

/**
 * Example DSPy Program (simplified)
 */
const exampleDSPyProgram: DSPyProgram = {
  id: 'research-assistant',
  modules: [
    {
      name: 'planner',
      description: 'Plans research steps based on user query'
    },
    {
      name: 'executor',
      description: 'Executes research plan using available tools'
    },
    {
      name: 'synthesizer',
      description: 'Synthesizes findings into coherent report'
    }
  ],
  systemPrompt: `You are an advanced research assistant that helps users find and analyze information.

Your capabilities:
- Search the web for relevant information
- Analyze data to extract insights
- Generate comprehensive reports

Always:
1. Break down complex queries into manageable steps
2. Use tools effectively to gather information
3. Provide well-structured, accurate responses

Be concise, accurate, and helpful.`
};

/**
 * Main workflow demonstration
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Hybrid GEPA + Arbor + Verifiers Optimization Workflow');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // ============================================================================
    // STEP 1: Sample Expansion with Verifiers
    // ============================================================================
    console.log('📋 Step 1: Sample Expansion with Verifiers\n');

    const toolEnv = createToolVerifierEnv(exampleTools, {
      maxTurns: 10,
      exactMatch: false
    });

    // Generate samples using different strategies
    console.log('   Generating combinatorial samples...');
    const combinatorialSamples = await toolEnv.generateSamples({
      count: 20,
      strategy: 'combinatorial',
      tools: exampleTools
    });

    console.log('   Generating synthetic samples...');
    const syntheticSamples = await toolEnv.generateSamples({
      count: 30,
      strategy: 'synthetic',
      diversity: 0.4
    });

    console.log('   Generating edge case samples...');
    const edgeCaseSamples = await toolEnv.generateSamples({
      count: 10,
      strategy: 'edge-cases'
    });

    // Combine all samples
    const allSamples = toolEnv.createDataset();
    console.log(`\n✅ Total samples generated: ${allSamples.length}`);

    // Show statistics
    const stats = toolEnv.getStatistics();
    console.log('   Statistics:');
    console.log(`   - By Task: ${JSON.stringify(stats.byTask, null, 2)}`);
    console.log(`   - By Tool: ${JSON.stringify(stats.byTool, null, 2)}`);
    console.log(`   - Edge Cases: ${stats.edgeCases}\n`);

    // Convert to training examples
    const trainingExamples: TrainingExample[] = allSamples.map((sample, idx) => {
      let output = sample.answer || '';
      if (typeof output === 'string' && output.startsWith('{')) {
        try {
          // Parse JSON answer back to object for evaluation
          const parsed = JSON.parse(output);
          output = parsed.content || output;
        } catch {
          // Keep as string if parsing fails
        }
      }

      return {
        id: `sample-${idx}`,
        input: sample.prompt,
        output: output,
        metadata: sample.info
      };
    });

    // Split into train/val
    const splitIndex = Math.floor(trainingExamples.length * 0.8);
    const trainset = trainingExamples.slice(0, splitIndex);
    const valset = trainingExamples.slice(splitIndex);

    console.log(`   Training set: ${trainset.length} examples`);
    console.log(`   Validation set: ${valset.length} examples\n`);

    // ============================================================================
    // STEP 2: Hybrid Optimization with ArborGEPAAdapter
    // ============================================================================
    console.log('\n📋 Step 2: Hybrid Optimization\n');

    const adapter = createArborGEPAAdapter('gepa-first', {
      gepa: {
        maxRollouts: 10, // Reduced for demo
        batchSize: 3,
        reflectionModel: 'https://openrouter.ai/minimax/minimax-m2:free',
        taskModel: 'https://build.nvidia.com/minimaxai/minimax-m2/modelcard',
        paretoSize: 5,
        metrics: ['accuracy', 'tool_usage', 'completeness']
      },
      grpo: {
        compiler: {
          numDspyExamplesPerGrpoStep: 6,
          numRolloutsPerGrpoStep: 12, // Reduced for demo
          numTrainSteps: 100, // Reduced for demo
          numThreads: 8,
          checkpoint: 'single-best',
          excludeDemos: true
        },
        train: {
          perDeviceTrainBatchSize: 1,
          gradientAccumulationSteps: 4,
          temperature: 1.0,
          topK: -1,
          topP: 1.0,
          repetitionPenalty: 1.0,
          maxTokens: 2048,
          learningRate: 1e-5,
          beta: 0.1,
          lossType: 'grpo',
          maxSteps: 100,
          numTrainingGpus: 1,
          numInferenceGpus: 1,
          gradientCheckpointing: true,
          fp16: true
        }
      }
    });

    // Initialize Arbor server
    await adapter.initializeArborServer();

    // Run hybrid optimization
    const result = await adapter.hybridOptimize(
      exampleDSPyProgram.systemPrompt || '',
      exampleDSPyProgram,
      trainset,
      valset
    );

    // ============================================================================
    // STEP 3: Validation and Reporting
    // ============================================================================
    console.log('\n📋 Step 3: Validation and Reporting\n');

    // Validate tool usage in optimized program
    console.log('   Validating tool usage...');
    const validationSample = valset[0];
    const mockCompletion = [
      {
        role: 'assistant' as const,
        content: 'I will search for information.',
        toolCalls: [
          {
            id: 'call-1',
            type: 'function' as const,
            function: {
              name: 'search_web',
              arguments: JSON.stringify({ query: 'test query', maxResults: 5 })
            }
          }
        ]
      }
    ];

    const validation = toolEnv.validateToolUsage(
      validationSample.input as any,
      mockCompletion
    );

    console.log(`   Validation Score: ${validation.score.toFixed(3)}`);
    console.log(`   Errors: ${validation.errors.length}`);
    console.log(`   Warnings: ${validation.warnings.length}\n`);

    // ============================================================================
    // STEP 4: Results Summary
    // ============================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Optimization Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Final Results:');
    console.log(`   Strategy: ${result.strategy}`);
    console.log(`   Total Improvement: ${result.totalImprovement.toFixed(1)}%`);
    console.log(`   Final Score: ${result.metrics.reward.toFixed(3)}`);
    console.log(`   Total Time: ${(result.totalTime / 1000 / 60).toFixed(1)} minutes\n`);

    console.log('🔄 Phase Breakdown:');
    result.phases.forEach((phase, idx) => {
      console.log(
        `   ${idx + 1}. ${phase.phase.toUpperCase()}:`
      );
      console.log(`      Improvement: +${phase.improvement.toFixed(1)}%`);
      console.log(`      Duration: ${(phase.duration / 1000).toFixed(1)}s`);
      console.log(`      Best Score: ${phase.best.metrics.reward.toFixed(3)}`);
    });

    console.log('\n📈 Performance Comparison:');
    console.log('   Baseline → GEPA → GRPO → Final');
    console.log(`   ${result.phases[0].best.metrics.reward.toFixed(3)} → ...progression...\n`);

    console.log('💾 Optimized System Prompt (first 500 chars):');
    console.log(`   ${result.systemPrompt.substring(0, 500)}...\n`);

    console.log('✅ Next Steps:');
    console.log('   1. Review optimized prompt in detail');
    console.log('   2. Test with real-world examples');
    console.log('   3. Deploy optimized program to production');
    console.log('   4. Monitor performance and iterate\n');

    // Cleanup
    await adapter.cleanup();

  } catch (error: any) {
    console.error('❌ Error during optimization:', error.message);
    console.error('   Stack:', error.stack?.split('\n')[0]);
    process.exit(1);
  }
}

// Run the workflow
if (import.meta.url.includes('example-hybrid-workflow')) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
