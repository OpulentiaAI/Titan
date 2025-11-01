#!/bin/bash

# Quick test runner script
# Usage: ./run-tests.sh [unit|e2e|all]

set -e

echo "╔════════════════════════════════════════╗"
echo "║    Opulent Browser Test Suite         ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check for API keys
if [ -z "$AI_GATEWAY_API_KEY" ]; then
  echo "⚠️  Warning: AI_GATEWAY_API_KEY not set"
  echo "   Tests will fail. Set with:"
  echo "   export AI_GATEWAY_API_KEY='your_key'"
  exit 1
fi

echo "✅ AI_GATEWAY_API_KEY: Set"

if [ -z "$YOU_API_KEY" ]; then
  echo "⚠️  YOU_API_KEY not set (optional - some tests will skip)"
else
  echo "✅ YOU_API_KEY: Set"
fi

if [ -z "$BRAINTRUST_API_KEY" ]; then
  echo "⚠️  BRAINTRUST_API_KEY not set (optional - tracing disabled)"
else
  echo "✅ BRAINTRUST_API_KEY: Set"
fi

echo ""

# Run tests based on argument
case "${1:-all}" in
  unit)
    echo "Running unit tests only..."
    npm run test:unit
    ;;
  e2e)
    echo "Running E2E test only..."
    npm run test:e2e
    ;;
  all)
    echo "Running full test suite..."
    echo ""
    echo "=== Unit Tests ==="
    npm run test:unit
    echo ""
    echo "=== E2E Test ==="
    npm run test:e2e
    ;;
  *)
    echo "Usage: $0 [unit|e2e|all]"
    exit 1
    ;;
esac

echo ""
echo "╔════════════════════════════════════════╗"
echo "║    Test Suite Complete                ║"
echo "╚════════════════════════════════════════╝"

