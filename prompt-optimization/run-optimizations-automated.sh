#!/bin/bash

# Automated DSPyground Optimization Runner
# Runs optimizations for all prompts without UI interaction
# Uses DSPyground's API endpoints programmatically

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 AUTOMATED DSPYGROUND OPTIMIZATION RUNNER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for API key
if [ -z "$AI_GATEWAY_API_KEY" ]; then
    echo "⚠️  Warning: AI_GATEWAY_API_KEY not set in environment"
    echo "   Set it before running: export AI_GATEWAY_API_KEY=your_key"
    echo ""
fi

# Prompt configurations: name, batch-size, rollouts, port
declare -a PROMPTS=(
    "planner:3:10:3001"
    "evaluator:3:8:3002"
    "browser-automation:3:10:3003"
    "gemini-computer-use:2:8:3004"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
PIDS=()

# Function to start DSPyground server in background
start_server() {
    local prompt_name=$1
    local port=$2
    local log_file="/tmp/dspyground-${prompt_name}.log"
    
    echo "🚀 Starting DSPyground server for $prompt_name on port $port..."
    cd "$prompt_name"
    
    PORT=$port npx dspyground dev > "$log_file" 2>&1 &
    local pid=$!
    PIDS+=($pid)
    
    # Wait for server to start
    local max_wait=30
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            echo "   ✅ Server ready at http://localhost:$port"
            cd ..
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    
    echo "   ⚠️  Server startup timeout (check $log_file)"
    cd ..
    return 1
}

# Function to stop all servers
cleanup() {
    echo ""
    echo "🧹 Cleaning up servers..."
    for pid in "${PIDS[@]}"; do
        kill $pid 2>/dev/null || true
    done
    # Also kill any remaining DSPyground processes
    pkill -f "dspyground dev" 2>/dev/null || true
    echo "✅ Cleanup complete"
}

trap cleanup EXIT

# Function to call optimization API
call_optimize_api() {
    local prompt_name=$1
    local port=$2
    local batch_size=$3
    local rollouts=$4
    
    local api_url="http://localhost:$port/api/optimize"
    
    # Try to call the optimize API
    # Note: This assumes DSPyground exposes /api/optimize endpoint
    local response=$(curl -s -X POST "$api_url" \
        -H "Content-Type: application/json" \
        -d "{
            \"batchSize\": $batch_size,
            \"numRollouts\": $rollouts
        }" 2>&1)
    
    if echo "$response" | grep -q "error\|Error\|failed"; then
        return 1
    fi
    return 0
}

# Run optimizations
for PROMPT_CONFIG in "${PROMPTS[@]}"; do
    IFS=':' read -r PROMPT_NAME BATCH_SIZE ROLLOUTS PORT <<< "$PROMPT_CONFIG"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Optimizing: $PROMPT_NAME"
    echo "   Batch Size: $BATCH_SIZE | Rollouts: $ROLLOUTS | Port: $PORT"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Check samples
    SAMPLE_FILE="$PROMPT_NAME/.dspyground/data/samples.json"
    if [ ! -f "$SAMPLE_FILE" ]; then
        echo "⚠️  No samples file found. Skipping."
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    fi
    
    SAMPLE_COUNT=$(jq '[.groups[].samples | length] | add' "$SAMPLE_FILE" 2>/dev/null || echo "0")
    if [ "$SAMPLE_COUNT" -lt "$BATCH_SIZE" ]; then
        echo "⚠️  Insufficient samples ($SAMPLE_COUNT < $BATCH_SIZE). Skipping."
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    fi
    
    echo "✅ Found $SAMPLE_COUNT samples"
    
    # Start server
    if ! start_server "$PROMPT_NAME" "$PORT"; then
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    fi
    
    # Wait a bit for server to fully initialize
    sleep 3
    
    # Run optimization using Node.js script (more reliable than curl)
    echo "🔄 Running optimization..."
    cd "$PROMPT_NAME"
    
    if npx tsx ../run-optimization-api.ts "$PROMPT_NAME" "$BATCH_SIZE" "$ROLLOUTS" 2>&1; then
        echo ""
        echo "✅ $PROMPT_NAME optimization completed!"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo ""
        echo "❌ $PROMPT_NAME optimization failed!"
        echo "   Note: DSPyground optimization may require UI interaction."
        echo "   Fallback: Use 'npm run optimize:$PROMPT_NAME' and click Optimize button."
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    cd ..
    
    # Stop this server before starting next
    kill "${PIDS[-1]}" 2>/dev/null || true
    unset 'PIDS[${#PIDS[@]}-1]'
    
    echo ""
    sleep 2
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Optimization Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Successful: $SUCCESS_COUNT"
echo "❌ Failed/Skipped: $FAIL_COUNT"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "💡 Next steps:"
    echo "   1. Extract best prompts: npx tsx prompt-optimization/extract-best-prompts.ts"
    echo "   2. Review results in .dspyground/data/runs.json"
    echo "   3. Apply best prompts to source files"
    echo "   4. Validate with E2E tests"
else
    echo "⚠️  No optimizations completed."
    echo "   DSPyground optimization currently requires UI interaction."
    echo "   Use: npm run optimize:<prompt-name> and click 'Optimize' button."
fi

