import { z } from 'zod';

// DSPyground configuration for Planner Prompt Optimization
// Uses GEPA optimizer to improve the planning agent's system prompt

export default {
  // Core Settings
  systemPrompt: `You are a GEPA-inspired planning agent that creates granular, optimal execution plans for browser automation.

GEPA Principles to Apply:
1. REFLECTIVE EVOLUTION: Reflect on what works/doesn't work in browser automation
2. GRANULAR DECOMPOSITION: Break complex tasks into smallest actionable steps
3. VALIDATION FOCUS: Each step should have clear success criteria
4. ERROR ANTICIPATION: Identify potential failure points and provide fallbacks
5. OPTIMIZATION MINDSET: Seek efficiency improvements in each plan

Your task:
- Analyze the user query and current page context
- Generate a step-by-step execution plan optimized for browser automation
- Reflect on past browser automation patterns to avoid common pitfalls
- Identify critical paths and potential optimization opportunities
- Provide fallback strategies for each risky step

Planning Guidelines (Validated Patterns):
- Start with getPageContext() if current page state is unknown
- Use CSS selectors over coordinates when possible (more reliable, tested pattern)
- Add wait steps after navigation (2.5s minimum) and after form submissions (1.5s minimum)
- Validate each step's success before proceeding using getPageContext()
- Minimize total steps while maximizing reliability
- Consider edge cases (modal dialogs, loading states, dynamic content)

Tested Execution Patterns:
- Tool execution has built-in timeouts (type: 15s, navigate: 20s, click: 10s)
- Double-response prevention ensures reliable tool completion tracking
- Connection errors are automatically retried up to 3 times with 1.5s delays
- Content script async operations properly return Promises
- Focus management includes 300ms delays for DOM-ready elements
- Error handling prevents stream freezing by returning structured errors

Critical Success Factors:
- Each tool call must have a clear validation criteria
- Fallback actions should use alternative selectors or approaches
- Plan should account for tool timeout limits (don't plan operations that exceed 30s)
- Account for Chrome extension message passing delays (~100-500ms)
- Ensure plan steps are sequential dependencies (step N depends on step N-1 success)

Return a structured plan that a computer-use agent can execute precisely.`,

  // Structured output schema for planning results
  schema: z.object({
    objective: z.string().describe('Clear, concise objective statement'),
    approach: z.string().describe('High-level strategy (GEPA: reflect on best approach)'),
    steps: z.array(z.object({
      step: z.number(),
      action: z.enum(['navigate', 'click', 'type', 'scroll', 'wait', 'getPageContext']),
      target: z.string().describe('URL, CSS selector, text to type, or description'),
      reasoning: z.string().describe('Why this step is necessary (GEPA reflection)'),
      expectedOutcome: z.string().describe('What should happen after this step'),
      validationCriteria: z.string().optional().describe('How to verify this step succeeded'),
      fallbackAction: z.object({
        action: z.string(),
        target: z.string(),
        reasoning: z.string(),
      }).optional().describe('Alternative approach if this step fails'),
    })).min(1).max(50),
    criticalPaths: z.array(z.number()).describe('Step indices that are essential for success'),
    estimatedSteps: z.number().int().min(1).max(50),
    complexityScore: z.number().min(0).max(1).describe('Task complexity 0=easy, 1=very complex'),
    potentialIssues: z.array(z.string()).max(10).describe('Anticipated challenges (GEPA: learn from past failures)'),
    optimizations: z.array(z.string()).max(10).describe('GEPA-inspired improvements: efficiency gains, error reduction, etc.'),
    confidence: z.number().min(0).max(1).describe('Confidence in plan quality (0=low, 1=high)'),
  }),

  // Preferences
  selectedModel: 'google/gemini-2.5-flash-lite-preview-09-2025',
  optimizationModel: 'google/gemini-2.5-flash-lite-preview-09-2025',
  reflectionModel: 'google/gemini-2.5-pro',
  useStructuredOutput: true,
  optimizeStructuredOutput: true,
  batchSize: 3,
  numRollouts: 10,
  selectedMetrics: ['accuracy', 'efficiency', 'completeness'],

  // Metrics Configuration
  evaluation_instructions: `Evaluate the planning agent's response across multiple dimensions:
- Accuracy: Does the plan correctly address the user query?
- Efficiency: Are steps minimized while maintaining reliability?
- Completeness: Are all necessary steps included with proper validation?
- Error Handling: Are fallbacks and error anticipation properly planned?
- Optimization: Does the plan incorporate efficiency improvements?`,

  dimensions: [
    {
      name: 'accuracy',
      description: 'Plan correctly addresses user query and objectives',
      weight: 1.5,
    },
    {
      name: 'efficiency',
      description: 'Minimizes steps while maintaining reliability',
      weight: 1.2,
    },
    {
      name: 'completeness',
      description: 'All necessary steps included with validation criteria',
      weight: 1.3,
    },
    {
      name: 'error_handling',
      description: 'Proper fallbacks and error anticipation included',
      weight: 1.1,
    },
    {
      name: 'optimization',
      description: 'Incorporates efficiency improvements and best practices',
      weight: 1.0,
    },
  ],

  positive_feedback_instruction: 'Use positive examples as reference quality - the optimized prompt should produce plans of similar or better quality.',
  negative_feedback_instruction: 'Learn from negative examples - identify patterns to avoid and ensure the optimized prompt prevents similar issues.',

  comparison_positive: 'Compare how well the optimized prompt matches or exceeds the quality of positive examples.',
  comparison_negative: 'Ensure the optimized prompt avoids the issues seen in negative examples.',
};

