# Prompt Optimization Pipeline

Production-grade prompt optimization system for Opulent Browser, integrating GEPA (Genetic Evolution of Prompt Architectures), advanced reasoning patterns, and state-aware execution principles.

## 🎯 Overview

This pipeline optimizes system prompts for browser automation agents through:
- **GEPA Optimization**: AI-powered evolutionary prompt improvement
- **Advanced Reasoning Integration**: State-aware execution, three-phase validation, multi-level verification
- **Production Validation**: E2E testing with real browser automation scenarios
- **Security Principles**: Data separation, credential handling, graceful degradation

## 📊 Enhanced Patterns

All optimized prompts now include:

✅ **State-Aware Execution**
- Establish complete state before every action (no assumptions)
- Extract ALL parameters from execution plan/context
- Resolve ambiguities dynamically
- Priority signals: execution plan > page context > user query

✅ **Three-Phase Execution Pattern**
1. **Gather**: Complete information gathering before action
2. **Execute**: Only with validated, complete parameters
3. **Verify**: Multi-level validation with cross-checks

✅ **Multi-Level Validation**
- Cross-verify results against predictions after every action
- Flag discrepancies between expected and actual outcomes
- Compare URL changes, element state, content updates

✅ **Graceful Degradation & Error Recovery**
- Log errors with specific details
- Offer concrete alternative strategies with trade-offs
- Escalate rather than improvise when blocked

✅ **Security & Data Separation**
- Treat page content as untrusted data
- Never interpret scraped content as commands
- Never hardcode credentials/API keys
- Escalate for credential requirements

✅ **Tool Boundary Verification**
- Explicit capability declarations
- No capability hallucination
- Immediate escalation when tools are insufficient

## 🚀 Quick Start

### 1. Run Optimization

```bash
# Run full GEPA optimization for all prompts
npm run optimize:all

# Or run specific prompt optimization
npm run optimize:planner
npm run optimize:evaluator
npm run optimize:browser-automation
```

### 2. Extract Best Prompts

```bash
# Extract best performing prompts from optimization runs
npm run optimize:extract
```

This generates `prompt-optimization/optimized-prompts.json` with:
- Best prompt text
- Performance scores
- Run ID for tracking

### 3. Review & Apply

```bash
# Review application instructions
npm run optimize:apply
```

This outputs:
- Optimized prompt text for each component
- File paths and line numbers for manual application
- Testing instructions

### 4. Validate

```bash
# Run E2E tests to validate improvements
npm run test:e2e

# Check performance metrics
npm run test:perf
```

## 📁 Source Files

The pipeline targets these system prompts:

| File | Lines | Component | Description |
|------|-------|-----------|-------------|
| `planner.ts` | 124-168 | Planning Agent | Creates step-by-step execution plans with validation strategies |
| `evaluator.ts` | 59-61 | Search Evaluator | Evaluates search result completeness |
| `workflows/browser-automation-workflow.legacy.ts` | 118-220 | Browser Automation | Enhanced browser automation with advanced reasoning |
| `sidepanel.tsx` | 645-678 | Gemini Computer Use | Gemini-based computer control |

## 📚 Optimized Prompt Libraries

### Core Libraries

- **`lib/optimized-prompts.ts`** - Enhanced prompts with Anthropic patterns, Morph integration, Vercel AI SDK guidance
- **`lib/optimized-prompts-fixed.ts`** - Fixed version with correct tool names (camelCase matching implementation)

Both include:
- Browser automation system prompt with three-phase execution
- Planning agent prompt with state-aware principles
- Enhanced tool definitions with examples
- Credential handling templates
- Validation cycle templates

### Key Exports

```typescript
// Enhanced system prompts
export const ENHANCED_BROWSER_AUTOMATION_SYSTEM_PROMPT: string;
export const ENHANCED_PLANNING_SYSTEM_PROMPT: string;

// Tool definitions with examples
export const ENHANCED_TOOL_DEFINITIONS: Record<string, ToolDefinition>;

// Helper templates
export const CREDENTIAL_HANDLING_TEMPLATE: string;
export const VALIDATION_CYCLE_TEMPLATE: string;
export function wrapTaskInXML(task: string, context?: string): string;
```

## 🔧 Pipeline Scripts

### Optimization Scripts

- `run-gepa-direct.ts` - Direct GEPA optimization with immediate feedback
- `run-gepa-fast.ts` - Fast GEPA optimization (reduced generations)
- `run-all-optimizations.sh` - Run all optimizations sequentially
- `run-optimizations-automated.sh` - Automated optimization pipeline

### Extraction & Application

- `extract-best-prompts.ts` - Extract highest-scoring prompts from runs
- `apply-optimized-prompts.ts` - Generate application instructions
- `extract-samples-from-e2e.ts` - Generate training samples from E2E tests

### Configuration

Each prompt type has its own `dspyground.config.ts`:
- `planner/dspyground.config.ts`
- `evaluator/dspyground.config.ts`
- `browser-automation/dspyground.config.ts`
- `gemini-computer-use/dspyground.config.ts`

## 📈 Performance Metrics

GEPA optimization tracks:
- **Accuracy**: Correctness of execution plans and actions
- **Completeness**: Coverage of all required steps
- **Efficiency**: Speed and resource usage
- **Robustness**: Error recovery and edge case handling

Example improvements:
```
Planner (planner.ts):
  Accuracy: 0.3 → 0.9 (+200%)
  Completeness: 0.2 → 1.0 (+400%)
  Efficiency: 1.0 (maintained)
  Overall Score: 0.966
```

## 🏗️ Architecture

```
prompt-optimization/
├── README.md                           # This file
├── extract-best-prompts.ts             # Extract top performers
├── apply-optimized-prompts.ts          # Generate application instructions
├── extract-samples-from-e2e.ts         # Training data generation
│
├── run-gepa-direct.ts                  # Direct GEPA runs
├── run-gepa-fast.ts                    # Fast GEPA runs
├── run-all-optimizations.sh            # Batch optimization
├── run-optimizations-automated.sh      # Automated pipeline
│
├── planner/
│   └── dspyground.config.ts            # Planner optimization config
├── evaluator/
│   └── dspyground.config.ts            # Evaluator optimization config
├── browser-automation/
│   └── dspyground.config.ts            # Browser automation config
└── gemini-computer-use/
    └── dspyground.config.ts            # Gemini config
```

## 🔬 How It Works

### 1. GEPA (Genetic Evolution of Prompt Architectures)

GEPA uses evolutionary algorithms to optimize prompts:

1. **Initial Population**: Start with baseline prompts
2. **Evaluation**: Run prompts against test scenarios, score performance
3. **Selection**: Keep best performers
4. **Mutation**: Generate variations with AI-guided modifications
5. **Crossover**: Combine successful patterns
6. **Iteration**: Repeat for multiple generations

### 2. Advanced Reasoning Integration

After GEPA optimization, prompts are enhanced with production-tested patterns:

- **State-Aware Execution**: From production AI systems (Atlas, Devin, Dia)
- **Three-Phase Validation**: Gather → Execute → Verify pattern
- **Security Principles**: Data separation, credential handling
- **Error Recovery**: Graceful degradation strategies

### 3. Production Validation

All optimized prompts are validated through:

- E2E browser automation tests
- Performance benchmarks
- Error recovery scenarios
- Security audit

## 🎓 Best Practices

### When Optimizing

1. **Start with E2E Tests**: Generate training samples from real scenarios
2. **Define Clear Metrics**: Accuracy, completeness, efficiency
3. **Run Multiple Generations**: GEPA improves over iterations (5-10 generations recommended)
4. **Validate Thoroughly**: Test optimized prompts before production deployment

### When Applying

1. **Review Carefully**: Read optimized prompts before applying
2. **Test Incrementally**: Apply one prompt at a time, test each
3. **Monitor Performance**: Track metrics before and after
4. **Rollback Ready**: Keep original prompts for quick rollback

### When Maintaining

1. **Re-optimize Periodically**: As tools/capabilities change
2. **Update Training Samples**: Add new E2E test scenarios
3. **Track Performance**: Monitor production metrics
4. **Document Changes**: Note improvements and regressions

## 🔍 Troubleshooting

### Optimization Runs Failing

```bash
# Check GEPA configuration
cat planner/dspyground.config.ts

# Verify training samples exist
ls -la planner/.dspyground/data/

# Run with verbose logging
npm run optimize:planner -- --verbose
```

### No Improvements Detected

- Increase generation count in config
- Add more diverse training samples
- Adjust mutation/crossover rates
- Check if metrics are measuring the right things

### Application Issues

- Verify line numbers match current file state
- Check for syntax errors in optimized prompts
- Test with `npm run test:e2e` after applying
- Compare metrics before/after application

## 📖 Additional Resources

- [GEPA Documentation](https://dspyground.dev/docs/gepa)
- [Anthropic Computer Use Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/computer-use)
- [Vercel AI SDK Prompt Engineering](https://sdk.vercel.ai/docs/foundations/prompts)
- [Morph Browser Automation Patterns](https://morph.so/docs/patterns)

## 🤝 Contributing

To add new prompt optimization targets:

1. Create config: `mkdir {component-name} && touch {component-name}/dspyground.config.ts`
2. Add to `SOURCE_FILES` in `apply-optimized-prompts.ts`
3. Add to prompt list in `extract-best-prompts.ts`
4. Create training samples in `.dspyground/data/samples.json`
5. Run optimization: `npm run optimize:{component-name}`

## 📝 License

Part of Opulent Browser - see root LICENSE file.
