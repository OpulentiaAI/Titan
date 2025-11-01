#!/bin/bash

# Setup script for DSPyground prompt optimization
# Initializes DSPyground for each prompt and prepares sample trajectories

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

echo "🚀 Setting up DSPyground prompt optimization..."
echo ""

# Check if DSPyground is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js and npm."
    exit 1
fi

# Prompt directories
PROMPTS=("planner" "evaluator" "browser-automation" "gemini-computer-use")

for PROMPT in "${PROMPTS[@]}"; do
    echo "📋 Setting up $PROMPT..."
    cd "$PROMPT"
    
    # Initialize DSPyground if .dspyground doesn't exist
    if [ ! -d ".dspyground" ]; then
        echo "  Initializing DSPyground..."
        npx dspyground init --yes 2>&1 | grep -v "npm" || true
    else
        echo "  DSPyground already initialized"
    fi
    
    # Ensure .dspyground is in .gitignore
    if [ -f "../../.gitignore" ]; then
        if ! grep -q ".dspyground" "../../.gitignore"; then
            echo ".dspyground/" >> "../../.gitignore"
        fi
    fi
    
    cd ..
    echo "  ✅ $PROMPT ready"
    echo ""
done

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set AI_GATEWAY_API_KEY in .env file"
echo "2. Run 'npm run optimize:planner' to start optimization for planner prompt"
echo "3. Or use 'npx dspyground dev' in each prompt directory to collect samples"
echo ""
echo "Available prompts:"
for PROMPT in "${PROMPTS[@]}"; do
    echo "  - $PROMPT"
done

