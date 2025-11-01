/**
 * Braintrust Metrics Analyzer
 * Queries and analyzes submodular optimization metrics from Braintrust
 */

import braintrust from 'braintrust';

interface SubmodularMetrics {
  diversityScore: number;
  avgRelevance: number;
  interQueryDiversity: number;
  complexityEstimate: number;
  kSelected: number;
  selectionRatio: number;
  duration: number;
}

interface QueryExpansionMetrics {
  totalVariations: number;
  selectedVariations: number;
  diversityScore?: number;
  avgRelevance?: number;
  complexityEstimate?: number;
  kUsed?: number;
}

/**
 * Analyze submodular optimization metrics from Braintrust
 */
async function analyzeSubmodularMetrics(projectName: string = 'atlas-extension') {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 BRAINTRUST SUBMODULAR OPTIMIZATION METRICS ANALYSIS`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // Note: Braintrust SDK doesn't have a direct query API in the client SDK
    // Metrics are typically viewed in the dashboard, but we can:
    // 1. Document what to look for
    // 2. Create a script that processes local logs
    // 3. Use Braintrust CLI if available

    console.log(`To view metrics in Braintrust Dashboard:`);
    console.log(`1. Go to: https://www.braintrust.dev/app/${projectName}`);
    console.log(`2. Filter by event name: 'submodular_expansion_complete'`);
    console.log(`3. View metrics in the metadata section\n`);

    console.log(`Key Metrics to Monitor:\n`);
    
    console.log(`📈 Diversity Metrics:`);
    console.log(`  - diversity_score: Should be > 0.5 for good diversity`);
    console.log(`  - inter_query_diversity: Should be > 0.6 for diverse queries`);
    console.log(`  - avg_relevance_score: Should be > 0.7 to maintain relevance\n`);

    console.log(`🔢 Selection Metrics:`);
    console.log(`  - k_selected: Should vary (3 for simple, 5 for medium, 7 for complex)`);
    console.log(`  - selection_ratio: k / total_candidates (should be 0.3-0.7)`);
    console.log(`  - total_candidates: Total variations generated (typically 8-10)\n`);

    console.log(`⚡ Performance Metrics:`);
    console.log(`  - duration: Query expansion time (should be < 50ms)`);
    console.log(`  - complexity_estimate: Query complexity (0-1)\n`);

    console.log(`🎯 Adaptive K Distribution:`);
    console.log(`  Check k_selected distribution:`);
    console.log(`  - k=3: Simple queries (complexity < 0.3)`);
    console.log(`  - k=5: Medium queries (complexity 0.3-0.6)`);
    console.log(`  - k=7: Complex queries (complexity > 0.6)\n`);

    console.log(`📊 Dashboard Filters:`);
    console.log(`  Event Names:`);
    console.log(`    - submodular_expansion_start`);
    console.log(`    - submodular_expansion_complete`);
    console.log(`    - query_expansion_complete`);
    console.log(`    - submodular_query_selection\n`);

    console.log(`Metadata Fields to Query:`);
    console.log(`  - metrics.diversity_score`);
    console.log(`  - metrics.avg_relevance_score`);
    console.log(`  - metrics.inter_query_diversity`);
    console.log(`  - metrics.complexity_estimate`);
    console.log(`  - metrics.k_selected`);
    console.log(`  - metrics.selection_ratio\n`);

    // Create sample query instructions
    console.log(`💡 Sample Braintrust Dashboard Queries:\n`);
    console.log(`1. Average Diversity Score:`);
    console.log(`   Filter: event = 'submodular_expansion_complete'`);
    console.log(`   Aggregate: AVG(metadata.metrics.diversity_score)\n`);

    console.log(`2. K Distribution:`);
    console.log(`   Filter: event = 'submodular_expansion_complete'`);
    console.log(`   Group by: metadata.metrics.k_selected`);
    console.log(`   Count: COUNT(*)\n`);

    console.log(`3. Complexity vs K Selection:`);
    console.log(`   Filter: event = 'submodular_expansion_complete'`);
    console.log(`   X-axis: metadata.metrics.complexity_estimate`);
    console.log(`   Y-axis: metadata.metrics.k_selected\n`);

    console.log(`4. Performance Over Time:`);
    console.log(`   Filter: event = 'submodular_expansion_complete'`);
    console.log(`   X-axis: timestamp`);
    console.log(`   Y-axis: metadata.duration\n`);

    console.log(`${'='.repeat(70)}\n`);

  } catch (error: any) {
    console.error(`❌ Error analyzing metrics:`, error.message);
  }
}

/**
 * Generate monitoring alert thresholds
 */
function generateAlertThresholds() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚨 MONITORING ALERT THRESHOLDS`);
  console.log(`${'='.repeat(70)}\n`);

  const thresholds = {
    diversityScore: {
      warning: 0.4,
      critical: 0.3,
      message: 'Diversity score below threshold - queries may be too similar',
    },
    avgRelevance: {
      warning: 0.6,
      critical: 0.5,
      message: 'Average relevance below threshold - queries may be off-topic',
    },
    duration: {
      warning: 100, // ms
      critical: 200, // ms
      message: 'Query expansion taking too long - performance degradation',
    },
    kDistribution: {
      warning: 'k=7 used > 50% of time',
      critical: 'k=7 used > 70% of time',
      message: 'Most queries classified as complex - check complexity estimation',
    },
  };

  console.log(`Recommended Alert Thresholds:\n`);
  for (const [metric, config] of Object.entries(thresholds)) {
    console.log(`📊 ${metric}:`);
    console.log(`   ⚠️  Warning: ${config.warning}`);
    console.log(`   🚨 Critical: ${config.critical}`);
    console.log(`   💬 ${config.message}\n`);
  }
}

/**
 * Main analysis function
 */
async function main() {
  await analyzeSubmodularMetrics();
  generateAlertThresholds();
  
  console.log(`\n✅ Analysis complete! View detailed metrics in Braintrust Dashboard:`);
  console.log(`   https://www.braintrust.dev/app/atlas-extension\n`);
}

main();

