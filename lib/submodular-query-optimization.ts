// Submodular Optimization for Diverse Query Generation
// Inspired by DeepResearch: https://jina.ai/news/submodular-optimization-for-diverse-query-generation-in-deepresearch/
// Implements lazy greedy algorithm to select diverse yet relevant query variations

import { logEvent } from './braintrust';

/**
 * Priority Queue implementation for efficient greedy selection
 */
class PriorityQueue<T extends [number, number, number]> {
  private heap: T[] = [];

  push(element: T) {
    this.heap.push(element);
    this._bubbleUp();
  }

  pop(): T | null {
    if (this.heap.length === 0) return null;

    const result = this.heap[0] as T;
    const last = this.heap.pop()!;

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._bubbleDown();
    }

    return result;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private _bubbleUp() {
    let index = this.heap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex][0] <= this.heap[index][0]) break;

      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  private _bubbleDown() {
    let index = 0;
    while (true) {
      let smallest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < this.heap.length && this.heap[leftChild][0] < this.heap[smallest][0]) {
        smallest = leftChild;
      }

      if (rightChild < this.heap.length && this.heap[rightChild][0] < this.heap[smallest][0]) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  const minLength = Math.min(vec1.length, vec2.length);
  for (let i = 0; i < minLength; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (norm1 * norm2);
}

/**
 * Compute marginal gain of adding a new query to the selected set
 * @param newIdx - Index of candidate query to evaluate
 * @param selected - Indices of already selected queries
 * @param embeddings - All query embeddings
 * @param relevanceScores - Precomputed relevance scores
 * @param alpha - Weight for relevance vs diversity (0-1, higher = more relevance)
 */
function computeMarginalGain(
  newIdx: number,
  selected: number[],
  embeddings: number[][],
  relevanceScores: number[],
  alpha: number = 0.3
): number {
  if (selected.length === 0) {
    // First query: gain is sum of all relevance and coverage scores
    let totalGain = 0;
    for (let j = 0; j < embeddings.length; j++) {
      const relevanceScore = alpha * relevanceScores[j];
      const coverageScore = cosineSimilarity(embeddings[newIdx], embeddings[j]);
      totalGain += Math.max(relevanceScore, coverageScore);
    }
    return totalGain;
  }

  // Compute current coverage
  const currentCoverage = embeddings.map((_, j) => {
    const scores = [alpha * relevanceScores[j]];
    for (const s of selected) {
      scores.push(cosineSimilarity(embeddings[s], embeddings[j]));
    }
    return Math.max(...scores);
  });

  // Compute new coverage with additional query
  const newCoverage = embeddings.map((_, j) => {
    return Math.max(currentCoverage[j], cosineSimilarity(embeddings[newIdx], embeddings[j]));
  });

  // Return marginal gain
  const currentSum = currentCoverage.reduce((sum, val) => sum + val, 0);
  const newSum = newCoverage.reduce((sum, val) => sum + val, 0);
  return newSum - currentSum;
}

/**
 * Generate simple text-based embeddings for query diversity
 * Uses character-level features for quick computation without external API
 */
function generateSimpleEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const embedding: number[] = [];
  
  // Character n-gram features (1-3 grams)
  const ngrams: Record<string, number> = {};
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i <= normalized.length - n; i++) {
      const gram = normalized.substring(i, i + n);
      ngrams[gram] = (ngrams[gram] || 0) + 1;
    }
  }
  
  // Convert to fixed-size vector (hash-based)
  const vectorSize = 128;
  for (let i = 0; i < vectorSize; i++) {
    let value = 0;
    for (const [gram, count] of Object.entries(ngrams)) {
      // Simple hash to distribute values
      const hash = gram.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      if (hash % vectorSize === i) {
        value += count;
      }
    }
    embedding.push(value);
  }
  
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    return embedding.map(v => v / norm);
  }
  
  return embedding;
}

/**
 * Lazy greedy algorithm for submodular query selection
 * Selects k most diverse yet relevant queries from candidates
 * 
 * @param candidates - Array of query variation strings
 * @param originalQuery - Original user query for relevance computation
 * @param k - Number of queries to select (default: 3-5)
 * @param alpha - Weight for relevance vs diversity (0.3 = balance, higher = more relevance)
 */
export function lazyGreedyQuerySelection(
  candidates: string[],
  originalQuery: string,
  k: number = Math.min(5, candidates.length),
  alpha: number = 0.3
): string[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= k) return [...candidates];

  const startTime = Date.now();

  // Generate embeddings for all candidates and original query
  const originalEmbedding = generateSimpleEmbedding(originalQuery);
  const embeddings = candidates.map(q => generateSimpleEmbedding(q));

  // Precompute relevance scores (how similar to original)
  const relevanceScores = embeddings.map(embedding =>
    cosineSimilarity(originalEmbedding, embedding)
  );

  const n = candidates.length;
  const selected: number[] = [];
  const pq = new PriorityQueue<[number, number, number]>();

  // Initialize priority queue: [neg_marginal_gain, last_updated, query_index]
  // Use negative gain because PQ is min-heap (we want max gain)
  for (let i = 0; i < n; i++) {
    const gain = computeMarginalGain(i, [], embeddings, relevanceScores, alpha);
    pq.push([-gain, 0, i]);
  }

  // Lazy greedy selection
  for (let iteration = 0; iteration < k && !pq.isEmpty(); iteration++) {
    while (true) {
      const top = pq.pop();
      if (!top) break;

      const [negGain, lastUpdated, bestIdx] = top;

      // If this gain was computed in current iteration, it's definitely the best
      if (lastUpdated === iteration) {
        selected.push(bestIdx);
        break;
      }

      // Otherwise, recompute the marginal gain with current selected set
      const currentGain = computeMarginalGain(bestIdx, selected, embeddings, relevanceScores, alpha);
      pq.push([-currentGain, iteration, bestIdx]);
    }
  }

  const selectedQueries = selected.map(i => candidates[i]);
  const duration = Date.now() - startTime;

  logEvent('submodular_query_selection', {
    original_query: originalQuery.substring(0, 100),
    candidate_count: candidates.length,
    selected_count: selectedQueries.length,
    alpha,
    duration,
    diversity_scores: selected.map(i => ({
      query: candidates[i].substring(0, 50),
      relevance: relevanceScores[i],
    })),
  });

  return selectedQueries;
}

/**
 * Enhanced query expansion with submodular optimization
 * Generates diverse query variations and selects optimal subset
 */
export interface OptimizedQueryExpansion {
  original: string;
  variations: string[];
  selectedVariations: string[]; // Submodular-optimized subset
  personas: string[];
  diversityScore: number;
}

/**
 * Estimate query complexity to determine optimal k
 * Returns complexity score (0-1) and recommended k value
 */
function estimateQueryComplexity(query: string): { complexity: number; recommendedK: number } {
  const normalized = query.toLowerCase();
  
  // Factors that increase complexity
  const hasMultipleActions = (normalized.match(/\b(and|then|also|plus|,)\b/g) || []).length;
  const hasMultipleSteps = normalized.includes('step') || normalized.includes('first') || normalized.includes('second');
  const hasConditionals = normalized.includes('if') || normalized.includes('when') || normalized.includes('after');
  const hasComplexVerbs = (normalized.match(/\b(find|extract|analyze|compare|verify|validate|submit|complete)\b/g) || []).length;
  const queryLength = query.split(/\s+/).length;
  
  // Calculate complexity score (0-1)
  const complexity = Math.min(1.0, 
    (hasMultipleActions * 0.15) +
    (hasMultipleSteps ? 0.2 : 0) +
    (hasConditionals ? 0.15 : 0) +
    (hasComplexVerbs * 0.1) +
    (Math.min(queryLength / 30, 0.4))
  );
  
  // Adaptive k: more complex queries benefit from more diverse variations
  // Simple queries: k=3, Medium: k=5, Complex: k=7
  const recommendedK = complexity < 0.3 ? 3 : complexity < 0.6 ? 5 : 7;
  
  return { complexity, recommendedK };
}

/**
 * Expand query with diverse variations and optimize selection
 * Now with adaptive k based on query complexity
 */
export async function expandQueryWithSubmodularOptimization(
  query: string,
  model: any,
  context?: string,
  k?: number // Optional: if not provided, will be computed adaptively
): Promise<OptimizedQueryExpansion> {
  const startTime = Date.now();

  // Adaptive k: estimate complexity and select optimal k
  const { complexity, recommendedK } = estimateQueryComplexity(query);
  const finalK = k !== undefined ? k : recommendedK;

  logEvent('submodular_expansion_start', {
    original_query: query.substring(0, 100),
    estimated_complexity: complexity,
    recommended_k: recommendedK,
    final_k: finalK,
    adaptive: k === undefined,
  });

  // Cognitive personas for browser automation
  const personas = [
    'direct_action',
    'exploratory_navigation',
    'data_extraction',
    'multi_step_workflow',
    'error_recovery',
    'validation_focused',
    'performance_optimized',
  ];

  // Generate comprehensive query variations
  const variations: string[] = [];

  // 1. Original query (always included)
  variations.push(query);

  // 2. Step-by-step variation
  if (!query.toLowerCase().includes('step') && !query.toLowerCase().includes('first')) {
    variations.push(`Step by step: ${query}`);
  }

  // 3. Error handling variation
  if (!query.toLowerCase().includes('if') && !query.toLowerCase().includes('error')) {
    variations.push(`${query}. If errors occur, try alternative approaches.`);
  }

  // 4. Validation variation
  if (!query.toLowerCase().includes('verify') && !query.toLowerCase().includes('confirm')) {
    variations.push(`${query}. Verify each step before proceeding.`);
  }

  // 5. Performance-focused variation
  if (!query.toLowerCase().includes('efficient') && !query.toLowerCase().includes('fast')) {
    variations.push(`Efficiently execute: ${query}`);
  }

  // 6. Context-aware variation (if context provided)
  if (context && context.length > 0) {
    variations.push(`${query} (Given context: ${context.substring(0, 100)}...)`);
  }

  // 7. Detailed exploration variation
  variations.push(`Explore and complete: ${query}`);

  // 8. Safety-first variation
  variations.push(`${query}. Ensure each step succeeds before proceeding.`);

  // Use LLM to generate additional variations if model available
  // For now, use the heuristic-based variations above
  // In production, could call LLM for more sophisticated variations

  // Apply submodular optimization to select diverse subset
  const selectedVariations = lazyGreedyQuerySelection(
    variations,
    query,
    Math.min(k, variations.length),
    0.3 // Balance relevance and diversity
  );

  // Compute overall diversity score
  const embeddings = selectedVariations.map(v => generateSimpleEmbedding(v));
  let diversitySum = 0;
  let pairs = 0;
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      diversitySum += 1 - similarity; // Lower similarity = higher diversity
      pairs++;
    }
  }
  const diversityScore = pairs > 0 ? diversitySum / pairs : 0;

  const duration = Date.now() - startTime;

  // Enhanced monitoring: track selection metrics
  const selectedEmbeddings = selectedVariations.map(v => generateSimpleEmbedding(v));
  const originalEmbedding = generateSimpleEmbedding(query);
  const relevanceScores = selectedEmbeddings.map(e => cosineSimilarity(originalEmbedding, e));
  const avgRelevance = relevanceScores.reduce((sum, r) => sum + r, 0) / relevanceScores.length;
  
  // Inter-query diversity (how diverse selected queries are from each other)
  let interQueryDiversity = 0;
  let diversityPairs = 0;
  for (let i = 0; i < selectedEmbeddings.length; i++) {
    for (let j = i + 1; j < selectedEmbeddings.length; j++) {
      const similarity = cosineSimilarity(selectedEmbeddings[i], selectedEmbeddings[j]);
      interQueryDiversity += 1 - similarity; // Lower similarity = higher diversity
      diversityPairs++;
    }
  }
  const avgInterQueryDiversity = diversityPairs > 0 ? interQueryDiversity / diversityPairs : 0;

  logEvent('submodular_expansion_complete', {
    original_query: query.substring(0, 100),
    total_variations: variations.length,
    selected_count: selectedVariations.length,
    diversity_score: diversityScore,
    avg_relevance: avgRelevance,
    inter_query_diversity: avgInterQueryDiversity,
    estimated_complexity: complexity,
    k_used: finalK,
    duration,
    // Enhanced metrics for monitoring
    metrics: {
      diversity_score: diversityScore,
      avg_relevance_score: avgRelevance,
      inter_query_diversity: avgInterQueryDiversity,
      complexity_estimate: complexity,
      k_selected: finalK,
      total_candidates: variations.length,
      selection_ratio: finalK / variations.length,
    },
  });

  return {
    original: query,
    variations,
    selectedVariations,
    personas,
    diversityScore,
  };
}

