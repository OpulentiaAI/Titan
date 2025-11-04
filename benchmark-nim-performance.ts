#!/usr/bin/env tsx

/**
 * Benchmark multiple providers for coding/agentic tasks (generic, provider-agnostic logs)
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const LOG_PREFIX = '🏁 [Performance Benchmark]';

interface BenchmarkResult {
  provider: string;
  model: string;
  task: string;
  response: string;
  tokens: { input: number; output: number; total: number };
  duration: number;
  success: boolean;
}

async function benchmarkProviders() {
  console.log(`${LOG_PREFIX} Starting provider performance benchmark...`);
  console.log(`${LOG_PREFIX} Timestamp: ${new Date().toISOString()}`);

  const results: BenchmarkResult[] = [];

  // Test cases for coding/agentic tasks
  const testCases = [
    {
      name: 'Code Review',
      prompt: 'Review this TypeScript function and suggest improvements:\n\nfunction calculateTotal(items: Array<{price: number, quantity: number}>) {\n  let total = 0;\n  for (let i = 0; i < items.length; i++) {\n    total += items[i].price * items[i].quantity;\n  }\n  return total;\n}'
    },
    {
      name: 'Algorithm Design',
      prompt: 'Design an efficient algorithm to find the longest palindromic substring in a given string. Provide the approach and TypeScript implementation.'
    },
    {
      name: 'Error Analysis',
      prompt: 'Analyze this error and suggest a fix:\n\nTypeError: Cannot read property \'map\' of undefined\n  at processUserData (/app/userService.js:45:12)\n\nThe function receives userData from an API call. What could cause this error?'
    }
  ];

  // Setup providers
  const providers = [];

  // Provider A
  if (process.env.NIM_API_KEY) {
    providers.push({
      name: 'Provider A',
      model: 'deepseek-ai/deepseek-r1',
      client: createOpenAICompatible({
        name: 'nim',
        baseURL: 'https://integrate.api.nvidia.com/v1',
        headers: { Authorization: `Bearer ${process.env.NIM_API_KEY}` },
      }).chatModel('deepseek-ai/deepseek-r1')
    });
  }

  // Provider B
  if (process.env.AI_GATEWAY_API_KEY) {
    const googleAI = createGoogleGenerativeAI({
      apiKey: process.env.AI_GATEWAY_API_KEY
    });
    providers.push({
      name: 'Provider B',
      model: 'gemini-2.5-pro-latest',
      client: googleAI('gemini-2.5-pro-latest')
    });
  }

  // Provider C
  if (process.env.OPENROUTER_API_KEY) {
    const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
    const openrouterClient = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    providers.push({
      name: 'Provider C',
      model: 'minimax/minimax-m2',
      client: openrouterClient('minimax/minimax-m2')
    });
  }

  if (providers.length === 0) {
    console.error(`${LOG_PREFIX} ❌ No API keys available for benchmarking`);
    process.exit(1);
  }

  console.log(`${LOG_PREFIX} 📊 Testing ${providers.length} providers on ${testCases.length} tasks...`);

  // Run benchmarks
  for (const testCase of testCases) {
    console.log(`\n${LOG_PREFIX} 🔬 Testing: ${testCase.name}`);

    for (const provider of providers) {
      console.log(`  ${provider.name} (${provider.model}):`);

      const startTime = Date.now();

      try {
        const { text, usage } = await generateText({
          model: provider.client,
          prompt: testCase.prompt,
        });

        const duration = Date.now() - startTime;

        results.push({
          provider: provider.name,
          model: provider.model,
          task: testCase.name,
          response: text,
          tokens: {
            input: usage.inputTokens || 0,
            output: usage.outputTokens || 0,
            total: (usage.inputTokens || 0) + (usage.outputTokens || 0)
          },
          duration,
          success: true
        });

        console.log(`    ✅ Success: ${duration}ms, ${usage.outputTokens || 0} tokens`);

      } catch (error) {
        const duration = Date.now() - startTime;

        results.push({
          provider: provider.name,
          model: provider.model,
          task: testCase.name,
          response: '',
          tokens: { input: 0, output: 0, total: 0 },
          duration,
          success: false
        });

        console.log(`    ❌ Failed: ${error.message}`);
      }
    }
  }

  // Analyze results
  console.log(`\n${LOG_PREFIX} 📈 Benchmark Results Summary:`);
  console.log('='.repeat(80));

  // Group by provider
  const providerStats = new Map<string, {
    totalTasks: number;
    successfulTasks: number;
    avgDuration: number;
    totalTokens: number;
    avgTokensPerTask: number;
  }>();

  for (const result of results) {
    const key = `${result.provider} (${result.model})`;
    const stats = providerStats.get(key) || {
      totalTasks: 0,
      successfulTasks: 0,
      avgDuration: 0,
      totalTokens: 0,
      avgTokensPerTask: 0
    };

    stats.totalTasks++;
    if (result.success) {
      stats.successfulTasks++;
      stats.totalTokens += result.tokens.total;
    }

    providerStats.set(key, stats);
  }

  // Calculate averages
  for (const [provider, stats] of providerStats) {
    const successfulResults = results.filter(r =>
      `${r.provider} (${r.model})` === provider && r.success
    );

    if (successfulResults.length > 0) {
      stats.avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
      stats.avgTokensPerTask = stats.totalTokens / successfulResults.length;
    }

    console.log(`${provider}:`);
    console.log(`  Success Rate: ${stats.successfulTasks}/${stats.totalTasks} (${(stats.successfulTasks/stats.totalTasks*100).toFixed(1)}%)`);
    console.log(`  Avg Duration: ${stats.avgDuration.toFixed(0)}ms`);
    console.log(`  Avg Tokens/Task: ${stats.avgTokensPerTask.toFixed(0)}`);
    console.log('');
  }

  // Task-by-task comparison
  console.log(`${LOG_PREFIX} 📋 Task-by-Task Comparison:`);
  for (const testCase of testCases) {
    console.log(`\n${testCase.name}:`);
    const taskResults = results.filter(r => r.task === testCase.name);

    for (const result of taskResults) {
      const status = result.success ? '✅' : '❌';
      const duration = result.success ? `${result.duration}ms` : 'N/A';
      const tokens = result.success ? `${result.tokens.output} tokens` : 'N/A';
      console.log(`  ${result.provider}: ${status} ${duration}, ${tokens}`);
    }
  }

  return results;
}

// Run benchmark
benchmarkProviders().then(results => {
  console.log(`\n${LOG_PREFIX} 🎯 Benchmark completed with ${results.length} total tests`);
}).catch(error => {
  console.error(`${LOG_PREFIX} 💥 Benchmark failed:`, error);
  process.exit(1);
});
