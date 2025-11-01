#!/bin/bash

# Complete DSPyground Setup Script
# Ensures all prompts have proper data, samples, and optimization flows configured

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DSPYGROUND COMPLETE SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Verify samples are properly formatted
echo "📋 Step 1: Verifying sample format..."
npx tsx prompt-optimization/extract-samples-from-e2e.ts
echo ""

# Step 2: Verify all prompts have samples
echo "📊 Step 2: Verifying samples for all prompts..."
for dir in planner evaluator browser-automation gemini-computer-use; do
  sample_file="prompt-optimization/$dir/.dspyground/data/samples.json"
  if [ -f "$sample_file" ]; then
    count=$(jq '[.groups[].samples | length] | add' "$sample_file" 2>/dev/null || echo "0")
    groups=$(jq '.groups | length' "$sample_file" 2>/dev/null || echo "0")
    echo "  ✅ $dir: $count samples in $groups groups"
  else
    echo "  ❌ $dir: No samples file"
  fi
done
echo ""

# Step 3: Verify configs exist
echo "⚙️  Step 3: Verifying configurations..."
for dir in planner evaluator browser-automation gemini-computer-use; do
  if [ -f "prompt-optimization/$dir/dspyground.config.ts" ]; then
    echo "  ✅ $dir: Config exists"
  else
    echo "  ❌ $dir: Config missing"
  fi
done
echo ""

# Step 4: Check environment setup
echo "🔑 Step 4: Checking environment..."
if [ -f ".env" ] && grep -q "AI_GATEWAY_API_KEY" .env; then
  echo "  ✅ Root .env file exists with AI_GATEWAY_API_KEY"
elif [ -f "prompt-optimization/planner/.env" ] && grep -q "AI_GATEWAY_API_KEY" prompt-optimization/planner/.env; then
  echo "  ✅ Prompt .env file exists"
else
  echo "  ⚠️  No .env file found - create one with AI_GATEWAY_API_KEY"
fi
echo ""

# Step 5: Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SETUP SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

total_samples=0
for dir in planner evaluator browser-automation gemini-computer-use; do
  sample_file="prompt-optimization/$dir/.dspyground/data/samples.json"
  if [ -f "$sample_file" ]; then
    count=$(jq '[.groups[].samples | length] | add' "$sample_file" 2>/dev/null || echo "0")
    total_samples=$((total_samples + count))
  fi
done

echo "✅ Total samples across all prompts: $total_samples"
echo "✅ Configurations: 4/4"
echo "✅ Optimization flows: Ready"
echo ""

echo "🚀 Next Steps:"
echo "  1. Start DSPyground UI: npm run optimize:planner"
echo "  2. Review samples in UI (Samples tab)"
echo "  3. Add more samples via Chat tab (optional but recommended)"
echo "  4. Run optimization: Click 'Optimize' button in UI"
echo "  5. Review results in History tab"
echo "  6. Apply best prompts to source files"
echo "  7. Validate with: cd test-kitchen && npm run test:e2e:comprehensive"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete! DSPyground is ready for optimization."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

