#!/bin/bash

# Run small GEPA optimization runs for all prompts
# This script runs quick optimization iterations to enhance each prompt

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

echo "🚀 Running small GEPA optimization runs for all prompts..."
echo ""

# Check for API key
if [ -z "$AI_GATEWAY_API_KEY" ]; then
    echo "⚠️  Warning: AI_GATEWAY_API_KEY not set. Using environment default if available."
    echo ""
fi

# Prompt configurations: name, batch-size, rollouts
declare -a PROMPTS=(
    "planner:3:10"
    "evaluator:3:8"
    "browser-automation:3:10"
    "gemini-computer-use:2:8"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

for PROMPT_CONFIG in "${PROMPTS[@]}"; do
    IFS=':' read -r PROMPT_NAME BATCH_SIZE ROLLOUTS <<< "$PROMPT_CONFIG"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Optimizing: $PROMPT_NAME"
    echo "   Batch Size: $BATCH_SIZE | Rollouts: $ROLLOUTS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    cd "$PROMPT_NAME"
    
    # Check if samples exist
    if [ ! -f ".dspyground/data/samples.json" ] || [ ! -s ".dspyground/data/samples.json" ]; then
        echo "⚠️  No samples found. Skipping $PROMPT_NAME."
        echo "   Run 'npm run optimize:$PROMPT_NAME' first to collect samples."
        echo ""
        cd ..
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    fi
    
    # Run optimization
    if npx dspyground optimize --batch-size "$BATCH_SIZE" --rollouts "$ROLLOUTS" 2>&1; then
        echo ""
        echo "✅ $PROMPT_NAME optimization completed!"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo ""
        echo "❌ $PROMPT_NAME optimization failed!"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    echo ""
    cd ..
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Optimization Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Successful: $SUCCESS_COUNT"
echo "❌ Failed/Skipped: $FAIL_COUNT"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "💡 Next steps:"
    echo "   1. View optimization results in each prompt's History tab"
    echo "   2. Compare optimized prompts with current prompts"
    echo "   3. Copy best prompts from History and update source files:"
    echo "      - Planner: planner.ts (systemPrompt)"
    echo "      - Evaluator: evaluator.ts (sys)"
    echo "      - Browser Automation: workflows/browser-automation-workflow.ts (systemLines)"
    echo "      - Gemini Computer Use: sidepanel.tsx (systemInstruction)"
    echo "   4. Run E2E tests to validate improvements:"
    echo "      cd test-kitchen && npm run test:e2e:comprehensive"
fi

