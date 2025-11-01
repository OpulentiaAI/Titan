#!/bin/bash
# Master Test Runner - Runs all tests with comprehensive logging

set -e

echo "🚀 Opulent Browser - Comprehensive Test Suite"
echo "=============================================="
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="test-output"
MASTER_LOG="$LOG_DIR/master-test-run-${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

# Function to run test suite and capture output
run_test_suite() {
    local suite_name=$1
    local test_cmd=$2
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 Running: $suite_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    {
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting: $suite_name"
        echo ""
        eval "$test_cmd" || {
            local exit_code=$?
            echo ""
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] FAILED: $suite_name (exit: $exit_code)"
            return $exit_code
        }
        echo ""
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] COMPLETED: $suite_name"
    } | tee -a "$MASTER_LOG"
    
    return $?
}

# Track results
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Test Suite 1: Unit Tests
TOTAL_SUITES=$((TOTAL_SUITES + 1))
if run_test_suite "Unit Tests" "npm run test:unit"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
fi

# Test Suite 2: Production Config Tests
TOTAL_SUITES=$((TOTAL_SUITES + 1))
if run_test_suite "Production Config Tests" "npm run test:prod"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
fi

# Test Suite 3: Production Workflow Tests
TOTAL_SUITES=$((TOTAL_SUITES + 1))
if run_test_suite "Production Workflow Tests" "npm run test:prod:workflow"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
fi

# Test Suite 4: Comprehensive E2E Tests
TOTAL_SUITES=$((TOTAL_SUITES + 1))
if run_test_suite "Comprehensive E2E Tests" "npm run test:e2e:comprehensive"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
fi

# Test Suite 5: Error Scenario Tests
TOTAL_SUITES=$((TOTAL_SUITES + 1))
if run_test_suite "Error Scenario Tests" "npm run test:e2e:errors"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
fi

# Test Suite 6: Trace Capture Tests
TOTAL_SUITES=$((TOTAL_SUITES + 1))
if run_test_suite "Trace Capture Tests" "npm run test:trace"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
else
    FAILED_SUITES=$((FAILED_SUITES + 1))
fi

# Final Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 MASTER TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Test Suites: $TOTAL_SUITES"
echo "✅ Passed: $PASSED_SUITES"
echo "❌ Failed: $FAILED_SUITES"
echo ""
echo "📝 Master log: $MASTER_LOG"
echo ""

# List all log files
echo "📋 Generated Log Files:"
find "$LOG_DIR" -name "*.txt" -o -name "*.log" | sort | tail -10 | while read file; do
    echo "   - $file"
done

echo ""

# Exit with error if any suites failed
if [ $FAILED_SUITES -gt 0 ]; then
    echo "❌ $FAILED_SUITES test suite(s) failed"
    echo ""
    echo "💡 Review logs in $LOG_DIR/ for detailed error information"
    exit 1
else
    echo "✅ All test suites passed!"
    exit 0
fi

