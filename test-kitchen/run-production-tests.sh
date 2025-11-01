#!/bin/bash
# Production Test Runner - Runs all production config tests with comprehensive logging

set -e

echo "🚀 Opulent Browser - Production Test Suite"
echo "=========================================="
echo ""

# Ensure output directory exists
mkdir -p test-output

# Timestamp for log files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="test-output/production-tests-${TIMESTAMP}.log"

echo "📝 Logging to: ${LOG_FILE}"
echo ""

# Function to run test and capture output
run_test() {
    local test_name=$1
    local test_cmd=$2
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 Running: ${test_name}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    {
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting: ${test_name}"
        echo ""
        eval "${test_cmd}"
        local exit_code=$?
        echo ""
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Completed: ${test_name} (exit: ${exit_code})"
        echo ""
        return $exit_code
    } | tee -a "${LOG_FILE}"
    
    return $?
}

# Check environment variables
echo "🔍 Checking Environment Configuration..."
echo ""
echo "  AI_GATEWAY_API_KEY: ${AI_GATEWAY_API_KEY:+SET (${#AI_GATEWAY_API_KEY} chars)} ${AI_GATEWAY_API_KEY:-NOT SET}"
echo "  GOOGLE_API_KEY: ${GOOGLE_API_KEY:+SET (${#GOOGLE_API_KEY} chars)} ${GOOGLE_API_KEY:-NOT SET}"
echo "  YOU_API_KEY: ${YOU_API_KEY:+SET} ${YOU_API_KEY:-NOT SET}"
echo "  BRAINTRUST_API_KEY: ${BRAINTRUST_API_KEY:+SET} ${BRAINTRUST_API_KEY:-NOT SET}"
echo "  BRAINTRUST_PROJECT_NAME: ${BRAINTRUST_PROJECT_NAME:-atlas-extension}"
echo ""

# Track results
PASSED=0
FAILED=0
SKIPPED=0

# Test 1: Production Config Test
if run_test "Production Configurations" "npm run test:prod"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test 2: Production Workflow Test
if run_test "Production Workflow" "npm run test:prod:workflow"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test 3: Anthropic Tools Test
if run_test "Anthropic Tools Schema" "npm run test:anthropic"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Test 4: Unit Tests
if run_test "Unit Tests" "npm run test:unit"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 PRODUCTION TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Passed: ${PASSED}"
echo "❌ Failed: ${FAILED}"
echo "⏭️  Skipped: ${SKIPPED}"
echo ""
echo "📝 Full logs: ${LOG_FILE}"
echo ""

# Copy individual log files if they exist
if [ -f "test-output/production-test-logs.txt" ]; then
    cp "test-output/production-test-logs.txt" "test-output/production-test-logs-${TIMESTAMP}.txt"
    echo "📋 Config test logs: test-output/production-test-logs-${TIMESTAMP}.txt"
fi

if [ -f "test-output/production-workflow-logs.txt" ]; then
    cp "test-output/production-workflow-logs.txt" "test-output/production-workflow-logs-${TIMESTAMP}.txt"
    echo "📋 Workflow test logs: test-output/production-workflow-logs-${TIMESTAMP}.txt"
fi

echo ""

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
    echo "❌ ${FAILED} test suite(s) failed"
    exit 1
else
    echo "✅ All production tests passed!"
    exit 0
fi

