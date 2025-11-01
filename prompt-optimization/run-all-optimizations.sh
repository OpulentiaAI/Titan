#!/bin/bash

# Automated DSPyground Optimization Runner
# Runs optimizations for all prompts using API calls (requires server running)
# Or provides instructions for headless execution

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 AUTOMATED DSPYGROUND OPTIMIZATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if DSPyground server is running
DSPYGROUND_URL="${DSPYGROUND_URL:-http://localhost:3000}"
if curl -s "$DSPYGROUND_URL" > /dev/null 2>&1; then
    echo "✅ DSPyground server detected at $DSPYGROUND_URL"
    USE_API=true
else
    echo "⚠️  DSPyground server not running"
    echo "   Starting headless optimization using Node.js script..."
    USE_API=false
fi
echo ""

# Prompt configurations
declare -a PROMPTS=(
    "planner:3:10:accuracy,efficiency,completeness"
    "evaluator:3:8:accuracy,efficiency,clarity"
    "browser-automation:3:10:tool_accuracy,efficiency,reliability"
    "gemini-computer-use:2:8:visual_accuracy,efficiency,safety"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

if [ "$USE_API" = true ]; then
    # Use API approach
    echo "📡 Using API-based optimization..."
    echo ""
    
    for PROMPT_CONFIG in "${PROMPTS[@]}"; do
        IFS=':' read -r PROMPT_NAME BATCH_SIZE ROLLOUTS METRICS <<< "$PROMPT_CONFIG"
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📋 Optimizing: $PROMPT_NAME"
        echo "   Batch: $BATCH_SIZE | Rollouts: $ROLLOUTS | Metrics: $METRICS"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
        # Call optimization API
        cd "$PROMPT_NAME"
        
        # Check samples
        SAMPLE_COUNT=$(jq '[.groups[].samples | length] | add' .dspyground/data/samples.json 2>/dev/null || echo "0")
        if [ "$SAMPLE_COUNT" -lt "$BATCH_SIZE" ]; then
            echo "⚠️  Insufficient samples ($SAMPLE_COUNT < $BATCH_SIZE). Skipping."
            cd ..
            FAIL_COUNT=$((FAIL_COUNT + 1))
            continue
        fi
        
        # Use Node.js script to call API
        if npx tsx ../run-optimization-api.ts "$PROMPT_NAME" "$BATCH_SIZE" "$ROLLOUTS" 2>&1; then
            echo ""
            echo "✅ $PROMPT_NAME optimization completed!"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            echo ""
            echo "❌ $PROMPT_NAME optimization failed!"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        
        cd ..
        echo ""
    done
else
    # Use direct GEPA implementation
    echo "📋 Using direct optimization script..."
    echo ""
    
    # Run the headless optimization script
    npx tsx run-optimization-headless.ts
    
    echo ""
    echo "⚠️  Note: Full headless optimization requires DSPyground API access."
    echo "   Start DSPyground server first: npm run optimize:<prompt-name>"
    echo "   Then run this script again to use API mode."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Final Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Successful: $SUCCESS_COUNT"
echo "❌ Failed/Skipped: $FAIL_COUNT"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "💡 Next steps:"
    echo "   1. Review optimization results in .dspyground/data/runs.json"
    echo "   2. Extract best prompts using: npx tsx extract-best-prompts.ts"
    echo "   3. Apply to source files"
    echo "   4. Validate with E2E tests"
fi

