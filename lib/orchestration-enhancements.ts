// Orchestration Enhancements - Inspired by DeepResearch
// Logical and efficiency improvements for answer quality and latency reduction
// Fully compatible with existing architecture

import { logEvent } from './braintrust';
import { expandQueryWithSubmodularOptimization } from './submodular-query-optimization';
import { orchestrationDebug } from './debug-logger';

/**
 * Query Expansion & Optimization
 * Expands queries using cognitive personas for better search coverage
 * Now enhanced with submodular optimization for diverse query selection
 */
export interface ExpandedQuery {
  original: string;
  variations: string[];
  personas: string[];
  diversityScore?: number; // Added: diversity score from submodular optimization
}

export async function expandQueryForBrowserAutomation(
  query: string,
  model: any,
  context?: string
): Promise<ExpandedQuery> {
  const startTime = Date.now();
  const orchestrationTimer = orchestrationDebug.time('Query Expansion');
  
  // Feature flag: allow disabling submodular optimization for baseline comparison
  const useSubmodular = process.env.USE_SUBMODULAR_OPTIMIZATION !== 'false';
  
  orchestrationDebug.info('Starting query expansion', {
    query,
    queryLength: query.length,
    hasContext: !!context,
    useSubmodular,
  });
  
  logEvent('query_expansion_start', {
    original_query: query,
    has_context: !!context,
    use_submodular: useSubmodular,
  });
  
  if (useSubmodular) {
    orchestrationDebug.debug('Using submodular optimization', {
      adaptiveK: true,
    });
    
    // Use submodular optimization to generate and select diverse queries
    // k is computed adaptively based on query complexity (default: undefined = adaptive)
    const optimized = await expandQueryWithSubmodularOptimization(
      query,
      model,
      context
      // k not specified = adaptive based on query complexity
    );
    
    const duration = Date.now() - startTime;
    orchestrationTimer();
    
    orchestrationDebug.info('Query expansion completed with submodular optimization', {
      duration,
      variationsGenerated: optimized.variations.length,
      variationsSelected: optimized.selectedVariations.length,
      diversityScore: optimized.diversityScore,
      personas: optimized.personas,
    });
    
    // Enhanced monitoring: log comprehensive metrics to Braintrust
    logEvent('query_expansion_complete', {
      original_query: query.substring(0, 200),
      total_variations_generated: optimized.variations.length,
      selected_variations: optimized.selectedVariations.length,
      diversity_score: optimized.diversityScore,
      personas_used: optimized.personas,
      duration,
      optimized: true,
      // Enhanced monitoring metrics
      monitoring: {
        diversity_score: optimized.diversityScore,
        variations_generated: optimized.variations.length,
        variations_selected: optimized.selectedVariations.length,
        selection_efficiency: optimized.variations.length > 0 
          ? optimized.selectedVariations.length / optimized.variations.length 
          : 0,
        query_length: query.length,
        query_word_count: query.split(/\s+/).length,
      },
    });
    
    return {
      original: optimized.original,
      variations: optimized.selectedVariations, // Return optimized subset
      personas: optimized.personas,
      diversityScore: optimized.diversityScore,
    };
  } else {
    // Baseline: simple heuristic-based variations (no submodular optimization)
    const personas = [
      'direct_action',
      'exploratory_navigation',
      'data_extraction',
      'multi_step_workflow',
      'error_recovery',
    ];
    
    const variations: string[] = [];
    
    // Direct action variation
    if (!query.toLowerCase().includes('click') && !query.toLowerCase().includes('navigate')) {
      variations.push(query);
    }
    
    // Add step-by-step variation if not explicit
    if (!query.toLowerCase().includes('step') && !query.toLowerCase().includes('first')) {
      variations.push(`Step by step: ${query}`);
    }
    
    // Add error handling variation
    if (!query.toLowerCase().includes('if') && !query.toLowerCase().includes('error')) {
      variations.push(`${query}. If errors occur, try alternative approaches.`);
    }
    
    // Add validation variation
    if (!query.toLowerCase().includes('verify') && !query.toLowerCase().includes('confirm')) {
      variations.push(`${query}. Verify each step before proceeding.`);
    }
    
    const duration = Date.now() - startTime;
    
    logEvent('query_expansion_complete', {
      original_query: query,
      variations_count: variations.length,
      personas_used: personas,
      duration,
      optimized: false,
    });
    
    return {
      original: query,
      variations: variations.length > 0 ? variations : [query],
      personas,
    };
  }
}

/**
 * Multi-Layered Answer Evaluation
 * Inspired by DeepResearch's evaluator with multiple quality dimensions
 */
export interface AnswerEvaluation {
  definitive: boolean;    // Answer is definitive, not uncertain
  completeness: number;   // 0-1 score for coverage
  freshness: boolean;     // Information is current/relevant
  plurality: boolean;     // Multiple items requested and provided
  actionable: boolean;    // Provides clear next steps
  pass: boolean;
  feedback?: string;
}

export async function evaluateBrowserAutomationResult(
  query: string,
  result: {
    text: string;
    toolCalls: number;
    success: boolean;
    steps: number;
  }
): Promise<AnswerEvaluation> {
  const startTime = Date.now();
  
  logEvent('answer_evaluation_start', {
    query,
    result_length: result.text.length,
    tool_calls: result.toolCalls,
    steps: result.steps,
  });
  
  // Definitiveness check - no uncertainty markers
  const uncertaintyMarkers = [
    "i don't know", "not sure", "might be", "probably",
    "cannot provide", "unable to", "doesn't exist", "lack of"
  ];
  const isDefinitive = !uncertaintyMarkers.some(marker => 
    result.text.toLowerCase().includes(marker)
  );
  
  // Completeness check - based on tool calls and result length
  const expectedSteps = query.split(',').length + query.split('and').length;
  const completeness = Math.min(
    result.steps / Math.max(expectedSteps, 1),
    result.text.length / Math.max(query.length * 2, 100),
    1.0
  );
  
  // Freshness - for browser automation, always expect current state
  const isFresh = true; // Browser automation always gets current state
  
  // Plurality - check if query asks for multiple items
  const asksForMultiple = /\d+\s+(steps|items|things|ways)/i.test(query) ||
                         /(and|,|\+|plus)/.test(query);
  const hasMultipleItems = (result.toolCalls > 1 || result.steps > 1);
  const isPlural = !asksForMultiple || hasMultipleItems;
  
  // Actionable - provides clear steps or results
  const isActionable = result.text.length > 50 && 
                      (result.text.includes('completed') || 
                       result.text.includes('successfully') ||
                       result.text.includes('step'));
  
  // Overall pass if all critical checks pass
  const pass = isDefinitive && completeness > 0.5 && isPlural && isActionable && result.success;
  
  const feedback = !pass ? 
    `Quality: ${isDefinitive ? 'definitive' : 'uncertain'}, ` +
    `Completeness: ${(completeness * 100).toFixed(0)}%, ` +
    `Steps: ${result.steps}/${expectedSteps}` : undefined;
  
  const duration = Date.now() - startTime;
  
  logEvent('answer_evaluation_complete', {
    pass,
    definitive: isDefinitive,
    completeness,
    freshness: isFresh,
    plurality: isPlural,
    actionable: isActionable,
    duration,
    feedback,
  });
  
  return {
    definitive: isDefinitive,
    completeness,
    freshness: isFresh,
    plurality: isPlural,
    actionable: isActionable,
    pass,
    feedback,
  };
}

/**
 * Smart Content Aggregation
 * Reduces redundancy while preserving quality
 */
export async function reduceBrowserAutomationResults(
  results: Array<{ text: string; step: number; tool: string }>
): Promise<string> {
  const startTime = Date.now();
  
  logEvent('content_reduction_start', {
    input_count: results.length,
    total_length: results.reduce((sum, r) => sum + r.text.length, 0),
  });
  
  // Group by step and deduplicate
  const stepGroups = new Map<number, string[]>();
  
  for (const result of results) {
    if (!stepGroups.has(result.step)) {
      stepGroups.set(result.step, []);
    }
    stepGroups.get(result.step)!.push(result.text);
  }
  
  // Aggregate per step, removing duplicates
  const aggregated: string[] = [];
  
  for (const [step, texts] of Array.from(stepGroups.entries()).sort((a, b) => a[0] - b[0])) {
    // Remove exact duplicates
    const uniqueTexts = Array.from(new Set(texts));
    
    // Combine unique content
    const stepContent = uniqueTexts.join('\n');
    
    if (stepContent.trim().length > 0) {
      aggregated.push(`**Step ${step}:** ${stepContent}`);
    }
  }
  
  const finalText = aggregated.join('\n\n');
  const originalLength = results.reduce((sum, r) => sum + r.text.length, 0);
  const reductionRatio = finalText.length / originalLength;
  
  // Safety check: don't reduce too aggressively
  if (reductionRatio < 0.3) {
    // Too much reduction - return combined original
    logEvent('content_reduction_warning', {
      reduction_ratio: reductionRatio,
      action: 'using_original',
    });
    return results.map(r => r.text).join('\n\n');
  }
  
  const duration = Date.now() - startTime;
  
  logEvent('content_reduction_complete', {
    original_length: originalLength,
    reduced_length: finalText.length,
    reduction_ratio: reductionRatio,
    duration,
  });
  
  return finalText;
}

/**
 * Parallel Execution Coordinator
 * Runs independent operations in parallel for latency reduction
 */
export async function parallelBrowserOperations<T extends readonly unknown[]>(
  operations: [...{ [K in keyof T]: () => Promise<T[K]> }],
  options?: {
    timeout?: number;
    maxConcurrency?: number;
  }
): Promise<{ [K in keyof T]: T[K] }> {
  const startTime = Date.now();
  const maxConcurrency = options?.maxConcurrency || 5;
  
  logEvent('parallel_execution_start', {
    operation_count: operations.length,
    max_concurrency: maxConcurrency,
  });
  
  // Batch operations to respect concurrency limit
  const results: any[] = [];
  
  for (let i = 0; i < operations.length; i += maxConcurrency) {
    const batch = operations.slice(i, i + maxConcurrency);
    
    const batchResults = await Promise.all(
      batch.map(op => {
        if (options?.timeout) {
          return Promise.race([
            op(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Operation timeout')), options.timeout)
            )
          ]);
        }
        return op();
      })
    );
    
    results.push(...batchResults);
  }
  
  const duration = Date.now() - startTime;
  
  logEvent('parallel_execution_complete', {
    operation_count: operations.length,
    duration,
    avg_duration: duration / operations.length,
  });
  
  return results as { [K in keyof T]: T[K] };
}

/**
 * Quality Gate System
 * Early stopping when quality thresholds are met
 */
export interface QualityGate {
  name: string;
  check: (context: any) => Promise<boolean>;
  weight: number;
}

export class QualityGateManager {
  private gates: QualityGate[] = [];
  private thresholds: Map<string, number> = new Map();
  
  addGate(gate: QualityGate) {
    this.gates.push(gate);
    this.thresholds.set(gate.name, 0);
  }
  
  async evaluate(context: any): Promise<{
    passed: boolean;
    score: number;
    details: Record<string, boolean>;
  }> {
    const results: Record<string, boolean> = {};
    let totalWeight = 0;
    let passedWeight = 0;
    
    for (const gate of this.gates) {
      const passed = await gate.check(context);
      results[gate.name] = passed;
      
      totalWeight += gate.weight;
      if (passed) {
        passedWeight += gate.weight;
        this.thresholds.set(gate.name, (this.thresholds.get(gate.name) || 0) + 1);
      }
    }
    
    const score = totalWeight > 0 ? passedWeight / totalWeight : 0;
    const passed = score >= 0.7; // 70% threshold
    
    logEvent('quality_gate_evaluation', {
      score,
      passed,
      gate_results: results,
      total_gates: this.gates.length,
    });
    
    return { passed, score, details: results };
  }
}

/**
 * Smart Planning Enhancement
 * Orthogonal decomposition inspired by DeepResearch
 */
export interface PlanningEnhancement {
  orthogonalSteps: string[];
  overlap: number;
  depth: number;
  coverage: number;
}

export async function enhancePlanningWithOrthogonality(
  query: string,
  steps: string[]
): Promise<PlanningEnhancement> {
  logEvent('planning_orthogonality_check', {
    query,
    step_count: steps.length,
  });
  
  // Calculate overlap between steps (simple keyword-based)
  let totalOverlap = 0;
  const stepKeywords = steps.map(step => 
    new Set(step.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  );
  
  for (let i = 0; i < stepKeywords.length; i++) {
    for (let j = i + 1; j < stepKeywords.length; j++) {
      const set1 = Array.from(stepKeywords[i]);
      const set2 = Array.from(stepKeywords[j]);
      const intersection = new Set(
        set1.filter(w => stepKeywords[j].has(w))
      );
      const union = new Set([...set1, ...set2]);
      const overlap = union.size > 0 ? intersection.size / union.size : 0;
      totalOverlap += overlap;
    }
  }
  
  const avgOverlap = steps.length > 1 ? 
    totalOverlap / (steps.length * (steps.length - 1) / 2) : 0;
  
  // Estimate depth (based on step length and complexity)
  const avgDepth = steps.reduce((sum, step) => 
    sum + step.split(' ').length, 0
  ) / steps.length;
  
  // Estimate coverage (how well steps address query)
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const coveredWords = new Set(
    steps.flatMap(step => step.toLowerCase().split(/\s+/))
  );
  const intersection = new Set(
    [...queryWords].filter(w => coveredWords.has(w) && w.length > 3)
  );
  const coverage = queryWords.size > 0 ? intersection.size / queryWords.size : 0;
  
  logEvent('planning_orthogonality_result', {
    overlap: avgOverlap,
    depth: avgDepth,
    coverage,
    recommendation: avgOverlap < 0.2 ? 'good' : 'high_overlap',
  });
  
  return {
    orthogonalSteps: steps,
    overlap: avgOverlap,
    depth: avgDepth,
    coverage,
  };
}

/**
 * Batch Processing for Tool Execution
 * Groups operations for efficiency
 */
export class BatchProcessor<T> {
  private batch: T[] = [];
  private batchSize: number;
  private processor: (batch: T[]) => Promise<void>;
  
  constructor(batchSize: number, processor: (batch: T[]) => Promise<void>) {
    this.batchSize = batchSize;
    this.processor = processor;
  }
  
  async add(item: T): Promise<void> {
    this.batch.push(item);
    
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }
  
  async flush(): Promise<void> {
    if (this.batch.length === 0) return;
    
    const batchToProcess = [...this.batch];
    this.batch = [];
    
    await this.processor(batchToProcess);
  }
}

/**
 * Smart Caching with Freshness
 * Reduces redundant operations
 */
export class SmartCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number; ttl: number }>();
  
  set(key: K, value: V, ttl: number = 60000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

/**
 * Latency Optimizer
 * Tracks and optimizes slow operations
 */
export class LatencyOptimizer {
  private timings: Map<string, number[]> = new Map();
  
  record(operation: string, duration: number): void {
    if (!this.timings.has(operation)) {
      this.timings.set(operation, []);
    }
    this.timings.get(operation)!.push(duration);
    
    // Log slow operations
    if (duration > 2000) {
      logEvent('slow_operation_detected', {
        operation,
        duration,
        avg_duration: this.getAverage(operation),
      });
    }
  }
  
  getAverage(operation: string): number {
    const timings = this.timings.get(operation) || [];
    if (timings.length === 0) return 0;
    return timings.reduce((a, b) => a + b, 0) / timings.length;
  }
  
  getSlowestOperations(limit: number = 5): Array<{ operation: string; avg: number }> {
    return Array.from(this.timings.entries())
      .map(([op, times]) => ({
        operation: op,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, limit);
  }
}

// Global latency optimizer instance
export const latencyOptimizer = new LatencyOptimizer();

