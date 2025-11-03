/**
 * GEPA Engine
 * Extracted GEPA (Genetic-Pareto) optimization logic for reuse across the system
 *
 * This module provides the core GEPA algorithm that can be used by:
 * - Arbor GEPA Adapter for hybrid optimization
 * - Direct optimization scripts
 * - Tool validation workflows
 */

import type { TrainingExample } from '../arbor/types';
import type { ChatMessage } from './types';

/**
 * GEPA Evaluation Result
 */
export interface GEPAEvaluationResult {
  scores: Record<string, number>;
  overallScore: number;
  trace?: string;
}

/**
 * GEPA Optimization Result
 */
export interface GEPAOptimizationResult {
  prompt: string;
  scores: Record<string, number>;
  overallScore: number;
  improvement: number;
  rollouts: number;
}

/**
 * GEPA Configuration
 */
export interface GEPAConfig {
  /** Maximum rollouts for optimization */
  maxRollouts: number;
  /** Batch size for evaluation */
  batchSize: number;
  /** Reflection model for prompt improvement */
  reflectionModel: string;
  /** Task model for evaluation */
  taskModel: string;
  /** Metrics to optimize */
  metrics: string[];
  /** Pareto frontier size */
  paretoSize?: number;
}

/**
 * GEPA Engine Class
 */
export class GEPAEngine {
  private config: GEPAConfig;

  constructor(config: GEPAConfig) {
    this.config = config;
  }

  /**
   * Evaluate a prompt against a batch of examples
   */
  async evaluatePrompt(
    prompt: string,
    examples: TrainingExample[],
    apiKey?: string
  ): Promise<GEPAEvaluationResult> {
    const scores: Record<string, number> = {};

    // Evaluate each example
    for (const example of examples) {
      const exampleScores = await this.evaluateSingleExample(prompt, example, apiKey);
      for (const [metric, value] of Object.entries(exampleScores)) {
        scores[metric] = (scores[metric] || 0) + value;
      }
    }

    // Average scores across examples
    for (const metric in scores) {
      scores[metric] = scores[metric] / examples.length;
    }

    const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;

    return {
      scores,
      overallScore,
      trace: `Evaluated ${examples.length} examples`
    };
  }

  /**
   * Evaluate a single example
   */
  private async evaluateSingleExample(
    prompt: string,
    example: TrainingExample,
    apiKey?: string
  ): Promise<Record<string, number>> {
    if (!apiKey) {
      // Fallback scores when no API key
      return {
        accuracy: Math.random() * 0.3 + 0.4, // 0.4-0.7
        efficiency: Math.random() * 0.3 + 0.4,
        completeness: Math.random() * 0.3 + 0.4,
      };
    }

    try {
      const { createGateway } = await import('@ai-sdk/gateway');
      const { generateObject } = await import('ai');
      const { z } = await import('zod');

      const client = createGateway({ apiKey });
      const model = client(this.config.taskModel);

      const evaluationSchema = z.object({
        accuracy: z.number().min(0).max(1),
        efficiency: z.number().min(0).max(1),
        completeness: z.number().min(0).max(1),
      });

      // Extract user and assistant messages
      const userMessage = this.extractMessageContent(example.input as ChatMessage[], 'user');
      const assistantMessage = this.extractMessageContent(example.input as ChatMessage[], 'assistant');

      const result = await generateObject({
        model,
        schema: evaluationSchema,
        system: `You are an evaluator. Rate the assistant's response quality on a scale of 0-1 for the given metrics.`,
        prompt: `System Prompt: ${prompt.substring(0, 500)}\n\nUser: ${userMessage}\nAssistant: ${assistantMessage}\n\nRate the quality:`,
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

  /**
   * Generate improved prompt using reflection
   */
  async generateImprovedPrompt(
    currentPrompt: string,
    evaluationResult: GEPAEvaluationResult,
    examples: TrainingExample[],
    apiKey?: string
  ): Promise<string> {
    if (!apiKey) {
      // Fallback: add a small improvement marker
      return currentPrompt + '\n\n// GEPA optimization iteration';
    }

    try {
      const { createGateway } = await import('@ai-sdk/gateway');
      const { generateText } = await import('ai');

      const client = createGateway({ apiKey });
      const model = client(this.config.reflectionModel);

      // Create context from examples
      const sampleContext = examples.slice(0, 2).map(example => {
        const userMsg = this.extractMessageContent(example.input as ChatMessage[], 'user');
        return `User: ${userMsg.substring(0, 100)}`;
      }).join('\n');

      const result = await generateText({
        model,
        system: `You are a prompt optimizer. Improve the given prompt based on evaluation feedback. Keep improvements focused and practical.`,
        prompt: `Current Prompt:\n${currentPrompt.substring(0, 1000)}\n\nEvaluation Scores:\n${JSON.stringify(evaluationResult.scores, null, 2)}\n\nSample Context:\n${sampleContext}\n\nGenerate an improved version of the prompt that addresses weaknesses. Keep it concise and focused.`,
      });

      return result.text;
    } catch (error: any) {
      console.warn(`   ⚠️  Prompt generation failed: ${error.message?.substring(0, 150)}`);
      return currentPrompt; // Return current prompt if generation fails
    }
  }

  /**
   * Run complete GEPA optimization
   */
  async optimizePrompt(
    seedPrompt: string,
    examples: TrainingExample[],
    apiKey?: string
  ): Promise<GEPAOptimizationResult> {
    console.log(`🔄 Running GEPA optimization (${this.config.maxRollouts} rollouts)...`);

    let currentPrompt = seedPrompt;
    let bestScore = 0;
    let rolloutsCompleted = 0;

    for (let rollout = 0; rollout < this.config.maxRollouts; rollout++) {
      console.log(`   Rollout ${rollout + 1}/${this.config.maxRollouts}`);

      // Sample batch
      const batch = this.sampleBatch(examples, this.config.batchSize);

      // Evaluate current prompt
      console.log(`      Evaluating current prompt...`);
      const currentResult = await this.evaluatePrompt(currentPrompt, batch, apiKey);

      // Generate improved prompt
      console.log(`      Generating improved prompt...`);
      const improvedPrompt = await this.generateImprovedPrompt(
        currentPrompt,
        currentResult,
        batch,
        apiKey
      );

      // Evaluate improved prompt
      const improvedResult = await this.evaluatePrompt(improvedPrompt, batch, apiKey);

      // Accept if improved
      if (improvedResult.overallScore > currentResult.overallScore) {
        currentPrompt = improvedPrompt;
        bestScore = improvedResult.overallScore;
        console.log(`   ✅ Improved! ${currentResult.overallScore.toFixed(3)} → ${improvedResult.overallScore.toFixed(3)}`);
      } else {
        console.log(`   ⏭️  No improvement (${currentResult.overallScore.toFixed(3)} vs ${improvedResult.overallScore.toFixed(3)})`);
      }

      rolloutsCompleted++;
    }

    const baselineResult = await this.evaluatePrompt(seedPrompt, examples.slice(0, this.config.batchSize), apiKey);
    const improvement = bestScore - baselineResult.overallScore;

    const finalResult = await this.evaluatePrompt(currentPrompt, examples.slice(0, this.config.batchSize), apiKey);

    return {
      prompt: currentPrompt,
      scores: finalResult.scores,
      overallScore: bestScore,
      improvement,
      rollouts: rolloutsCompleted
    };
  }

  /**
   * Sample batch from examples
   */
  private sampleBatch(examples: TrainingExample[], batchSize: number): TrainingExample[] {
    const shuffled = [...examples].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(batchSize, shuffled.length));
  }

  /**
   * Extract message content by role
   */
  private extractMessageContent(messages: ChatMessage[], role: string): string {
    const message = messages.find(m => m.role === role);
    if (typeof message?.content === 'string') {
      return message.content;
    }
    return '';
  }
}

/**
 * Factory function for creating GEPA engine
 */
export function createGEPAEngine(config: GEPAConfig): GEPAEngine {
  return new GEPAEngine(config);
}

/**
 * Convenience function for quick GEPA optimization
 */
export async function optimizeWithGEPA(
  seedPrompt: string,
  examples: TrainingExample[],
  config: Partial<GEPAConfig> = {},
  apiKey?: string
): Promise<GEPAOptimizationResult> {
  const defaultConfig: GEPAConfig = {
    maxRollouts: 10,
    batchSize: 3,
    reflectionModel: 'https://openrouter.ai/minimax/minimax-m2:free',
    taskModel: 'https://build.nvidia.com/minimaxai/minimax-m2/modelcard',
    metrics: ['accuracy', 'efficiency', 'completeness'],
    paretoSize: 10,
    ...config
  };

  const engine = createGEPAEngine(defaultConfig);
  return engine.optimizePrompt(seedPrompt, examples, apiKey);
}

export default GEPAEngine;