// Workflow Orchestration Enhancements
// Integrates DeepResearch-inspired efficiency patterns into existing architecture
// Fully compatible with browser-automation-workflow.ts

import { logEvent, logStepProgress } from './braintrust.ts';
import {
  expandQueryForBrowserAutomation,
  evaluateBrowserAutomationResult,
  reduceBrowserAutomationResults,
  parallelBrowserOperations,
  QualityGateManager,
  enhancePlanningWithOrthogonality,
  SmartCache,
  latencyOptimizer,
} from './orchestration-enhancements.ts';
import { expandQueryWithSubmodularOptimization } from './submodular-query-optimization.ts';
import { orchestrationDebug } from './debug-logger.ts';

/**
 * Enhanced Planning with Query Expansion
 * Expands user query before planning for better step decomposition
 */
export async function enhancedPlanningStep(
  originalQuery: string,
  planningFn: (query: string) => Promise<any>,
  model: any
): Promise<any> {
  const startTime = Date.now();
  
  console.log('🔍 [ENHANCED-PLANNING] Starting enhanced planning step');
  
  logEvent('enhanced_planning_start', {
    original_query: originalQuery,
  });
  
  try {
    // Step 1: Expand query with submodular-optimized diverse variations
    console.log('🔍 [ENHANCED-PLANNING] Expanding query...');
    const expanded = await expandQueryForBrowserAutomation(originalQuery, model);
    console.log('🔍 [ENHANCED-PLANNING] Query expanded', JSON.stringify({ variations: expanded.variations.length }, null, 2));
    
    // Step 2: Use best diverse variation for planning
    // Submodular optimization ensures the selected variations are:
    // - Relevant to the original query (high cosine similarity)
    // - Diverse from each other (low inter-query similarity)
    // - Comprehensive coverage (combined coverage of query space)
    const bestQuery = expanded.variations[0] || originalQuery;
    console.log('🔍 [ENHANCED-PLANNING] Best query selected:', bestQuery.substring(0, 80) + '...');
    
    logStepProgress('enhanced_planning', 1, {
      phase: 'query_expansion',
      variations_count: expanded.variations.length,
      diversity_score: expanded.diversityScore || 0,
    });
    
    // Step 3: Execute planning with optimized query
    // The submodular-optimized query should lead to better plan quality
    // by covering more aspects while maintaining relevance
    const planningStart = Date.now();
    console.log('🔍 [ENHANCED-PLANNING] Calling planning function...');
    const planResult = await planningFn(bestQuery);
    const planningDuration = Date.now() - planningStart;
    console.log('🔍 [ENHANCED-PLANNING] Planning function completed', JSON.stringify({ duration: planningDuration }, null, 2));
    latencyOptimizer.record('planning', planningDuration);
    
    // Step 4: Enhance plan with orthogonality check
    if (planResult.planSteps && Array.isArray(planResult.planSteps)) {
      console.log('🔍 [ENHANCED-PLANNING] Enhancing plan with orthogonality check...');
      const enhancement = await enhancePlanningWithOrthogonality(
        bestQuery,
        planResult.planSteps.map((s: any) => s.action || s)
      );
      console.log('🔍 [ENHANCED-PLANNING] Orthogonality check complete', {
        overlap: enhancement.overlap,
        coverage: enhancement.coverage,
      });
      
      logStepProgress('enhanced_planning', 2, {
        phase: 'orthogonality_analysis',
        overlap: enhancement.overlap,
        coverage: enhancement.coverage,
      });
      
      // Add enhancement metadata to plan
      planResult.orthogonality = enhancement;
    }
    
    const totalDuration = Date.now() - startTime;
    console.log('🔍 [ENHANCED-PLANNING] Enhanced planning complete', JSON.stringify({ totalDuration }, null, 2));
    
    logEvent('enhanced_planning_complete', {
      duration: totalDuration,
      planning_duration: planningDuration,
      has_orthogonality: !!planResult.orthogonality,
    });
    
    return planResult;
  } catch (error: any) {
    console.error('❌ [ENHANCED-PLANNING] Enhanced planning failed:', error?.message || String(error));
    console.error('❌ [ENHANCED-PLANNING] Stack:', error?.stack);
    
    logEvent('enhanced_planning_error', {
      error_message: error?.message || String(error),
      error_type: error?.name || typeof error,
      duration: Date.now() - startTime,
    });
    
    // Re-throw to be handled by workflow
    throw error;
  }
}

/**
 * Enhanced Execution with Quality Gates
 * Adds evaluation gates during execution
 */
export class EnhancedExecutionManager {
  private qualityGates: QualityGateManager;
  private resultCache: SmartCache<string, any>;
  
  constructor() {
    this.qualityGates = new QualityGateManager();
    this.resultCache = new SmartCache();
    
    // Add quality gates
    this.qualityGates.addGate({
      name: 'step_completion',
      check: async (ctx: any) => ctx.stepsCompleted >= ctx.expectedSteps * 0.8,
      weight: 0.3,
    });
    
    this.qualityGates.addGate({
      name: 'tool_success',
      check: async (ctx: any) => ctx.successRate >= 0.7,
      weight: 0.3,
    });
    
    this.qualityGates.addGate({
      name: 'result_quality',
      check: async (ctx: any) => ctx.resultLength > 50 && ctx.hasContent,
      weight: 0.4,
    });
  }
  
  async executeWithGates(
    executionFn: () => Promise<any>,
    context: {
      expectedSteps: number;
      stepsCompleted: number;
      successRate: number;
      resultLength: number;
      hasContent: boolean;
    }
  ): Promise<{ result: any; quality: any }> {
    const startTime = Date.now();
    
    logEvent('execution_with_gates_start', context);
    
    // Execute main operation
    const executionStart = Date.now();
    const result = await executionFn();
    const executionDuration = Date.now() - executionStart;
    latencyOptimizer.record('execution', executionDuration);
    
    // Evaluate quality
    const quality = await this.qualityGates.evaluate({
      ...context,
      result,
    });
    
    const totalDuration = Date.now() - startTime;
    
    logEvent('execution_with_gates_complete', {
      duration: totalDuration,
      execution_duration: executionDuration,
      quality_passed: quality.passed,
      quality_score: quality.score,
    });
    
    return { result, quality };
  }
}

/**
 * Parallel Step Execution
 * Runs independent browser automation steps in parallel when safe
 */
export async function executeStepsInParallel<T>(
  steps: Array<{ step: number; action: string; execute: () => Promise<T> }>,
  options?: {
    maxConcurrency?: number;
    safeParallel?: (step1: any, step2: any) => boolean;
  }
): Promise<T[]> {
  const startTime = Date.now();
  
  logEvent('parallel_steps_start', {
    step_count: steps.length,
    max_concurrency: options?.maxConcurrency || 3,
  });
  
  // Group steps into parallel-safe batches
  const batches: typeof steps[] = [];
  let currentBatch: typeof steps = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Check if this step can run in parallel with previous steps
    if (currentBatch.length === 0 || 
        !options?.safeParallel || 
        currentBatch.every(s => options.safeParallel(s, step))) {
      currentBatch.push(step);
    } else {
      // Start new batch
      batches.push(currentBatch);
      currentBatch = [step];
    }
    
    // Respect concurrency limit
    if (currentBatch.length >= (options?.maxConcurrency || 3)) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  // Execute batches sequentially, steps within batch in parallel
  const results: T[] = [];
  
  for (const batch of batches) {
    const batchStart = Date.now();
    
    logStepProgress('parallel_steps', batches.indexOf(batch) + 1, {
      batch_size: batch.length,
      batch_steps: batch.map(s => s.step),
    });
    
    const batchResults = await parallelBrowserOperations(
      batch.map(s => s.execute) as any,
      { maxConcurrency: options?.maxConcurrency || 3 }
    );
    
    results.push(...(batchResults as any));
    
    latencyOptimizer.record('parallel_batch', Date.now() - batchStart);
  }
  
  const duration = Date.now() - startTime;
  
  logEvent('parallel_steps_complete', {
    step_count: steps.length,
    batch_count: batches.length,
    duration,
    avg_step_duration: duration / steps.length,
  });
  
  return results;
}

/**
 * Smart Result Aggregation
 * Combines and reduces execution results efficiently
 */
export async function aggregateExecutionResults(
  results: Array<{
    step: number;
    text: string;
    tool: string;
    success: boolean;
    duration: number;
  }>
): Promise<{
  aggregatedText: string;
  summary: {
    totalSteps: number;
    successfulSteps: number;
    totalDuration: number;
    avgStepDuration: number;
  };
}> {
  const startTime = Date.now();
  
  logEvent('result_aggregation_start', {
    result_count: results.length,
  });
  
  // Reduce redundant content
  const aggregatedText = await reduceBrowserAutomationResults(
    results.map(r => ({ text: r.text, step: r.step, tool: r.tool }))
  );
  
  // Generate summary
  const successfulSteps = results.filter(r => r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgStepDuration = results.length > 0 ? totalDuration / results.length : 0;
  
  const summary = {
    totalSteps: results.length,
    successfulSteps,
    totalDuration,
    avgStepDuration: Math.round(avgStepDuration),
  };
  
  const duration = Date.now() - startTime;
  
  logEvent('result_aggregation_complete', {
    original_length: results.reduce((sum, r) => sum + r.text.length, 0),
    aggregated_length: aggregatedText.length,
    summary,
    duration,
  });
  
  return {
    aggregatedText,
    summary,
  };
}

/**
 * Post-Execution Evaluation
 * Evaluates final result quality
 */
export async function evaluateFinalResult(
  query: string,
  result: {
    text: string;
    toolCalls: number;
    success: boolean;
    steps: number;
  }
): Promise<{
  evaluation: any;
  shouldImprove: boolean;
  improvementSuggestions?: string[];
}> {
  const startTime = Date.now();
  
  logEvent('final_evaluation_start', {
    query,
    result_length: result.text.length,
  });
  
  const evaluation = await evaluateBrowserAutomationResult(query, result);
  
  const shouldImprove = !evaluation.pass || evaluation.completeness < 0.7;
  
  const improvementSuggestions: string[] = [];
  
  if (!evaluation.definitive) {
    improvementSuggestions.push('Provide more definitive answers, avoid uncertainty markers');
  }
  
  if (evaluation.completeness < 0.7) {
    improvementSuggestions.push(`Increase completeness (current: ${(evaluation.completeness * 100).toFixed(0)}%)`);
  }
  
  if (!evaluation.plurality && query.includes('and')) {
    improvementSuggestions.push('Ensure all requested aspects are addressed');
  }
  
  if (!evaluation.actionable) {
    improvementSuggestions.push('Provide clearer next steps or completion status');
  }
  
  const duration = Date.now() - startTime;
  
  logEvent('final_evaluation_complete', {
    passed: evaluation.pass,
    should_improve: shouldImprove,
    suggestions_count: improvementSuggestions.length,
    duration,
  });
  
  return {
    evaluation,
    shouldImprove,
    improvementSuggestions: improvementSuggestions.length > 0 ? improvementSuggestions : undefined,
  };
}