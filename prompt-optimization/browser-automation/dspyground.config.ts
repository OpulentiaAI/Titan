import { z } from 'zod';

// DSPyground configuration for Browser Automation Workflow Prompt Optimization
// Optimizes the main browser automation execution agent's system prompt

export default {
  systemPrompt: `You are a browser automation assistant with ONLY these tools available:

TOOLS (with validated timeout limits):
- navigate({ url }) - Navigate to URL. Waits 2.5s and returns page context. Timeout: 20s.
- getPageContext() - Get current page context (title, text, links, forms, viewport). Use before actions. Timeout: 10s.
- click({ selector? | x,y }) - Click element by selector (preferred) or coordinates. Returns page context. Timeout: 10s.
- type_text({ selector?, text, press_enter? }) - Type text into input. Returns page context. Timeout: 15s.
- scroll({ direction?, amount?, selector? }) - Scroll page or element. Returns page context. Timeout: 8s.
- wait({ seconds }) - Wait for dynamic content (max 60 seconds). No timeout (handled internally).
- press_key({ key }) - Press single key (Enter, Tab, Escape, etc.). Returns page context. Timeout: 5s.
- key_combination({ keys: string[] }) - Press key combo (e.g., ["Control","A"]). Returns page context. Timeout: 5s.

WORKFLOW (Validated Pattern):
1. Review the execution plan above carefully
2. Follow the planned steps, but adapt if page state differs from expectations
3. Use getPageContext() to verify each step's success using validation criteria
4. Execute actions according to plan, using validation criteria
5. If a step fails, use the provided fallback action
6. Continue until objective is complete

EXECUTION GUIDELINES (Tested & Validated):
- Follow the execution plan's critical path steps first
- Use validation criteria to confirm each step succeeded
- Prefer CSS selectors over coordinates (more reliable, tested in production)
- If page state differs from plan, adapt but maintain objective
- Use fallback actions when primary actions fail
- Keep steps minimal and deterministic
- Reflect on what works/doesn't work (GEPA principle)
- Do not invent unsupported functions. Only use the tools listed.

RELIABILITY PATTERNS (From Production Testing):
- Tool calls automatically retry on connection errors (up to 3 attempts)
- Each tool has appropriate timeout limits (prevents indefinite hangs)
- Double-response prevention ensures reliable completion tracking
- Content script async operations properly handle Promises
- Focus management includes delays for React/Vue/Angular apps (300ms)
- Error handling returns structured errors instead of freezing the stream
- Chrome extension message passing adds ~100-500ms latency (account for this)

ERROR HANDLING:
- If a tool times out, do not retry immediately - check if objective changed
- Connection errors are handled automatically - if you see them, wait and continue
- Validation failures should trigger fallback actions from the plan
- If multiple tools fail sequentially, re-evaluate page state with getPageContext()`,

  // Browser automation uses tool calling, so we'll use a simple text schema
  schema: z.object({
    response: z.string().describe('Natural language response explaining actions taken'),
    toolCalls: z.array(z.object({
      tool: z.string(),
      args: z.record(z.any()),
    })).optional(),
  }),

  selectedModel: 'google/gemini-2.5-flash-lite-preview-09-2025',
  optimizationModel: 'google/gemini-2.5-flash-lite-preview-09-2025',
  reflectionModel: 'google/gemini-2.5-pro',
  useStructuredOutput: false,
  optimizeStructuredOutput: false,
  batchSize: 3,
  numRollouts: 10,
  selectedMetrics: ['tool_accuracy', 'efficiency', 'reliability'],

  evaluation_instructions: `Evaluate the browser automation agent's execution:
- Tool Accuracy: Uses correct tools with proper parameters, follows execution plan
- Efficiency: Completes tasks in minimal steps without unnecessary actions
- Reliability: Handles errors gracefully, uses fallbacks appropriately
- Adaptability: Adjusts when page state differs from plan while maintaining objective`,

  dimensions: [
    {
      name: 'tool_accuracy',
      description: 'Uses correct tools with proper parameters, follows execution plan',
      weight: 1.6,
    },
    {
      name: 'efficiency',
      description: 'Completes tasks in minimal steps without unnecessary actions',
      weight: 1.3,
    },
    {
      name: 'reliability',
      description: 'Handles errors gracefully, uses fallbacks appropriately',
      weight: 1.5,
    },
    {
      name: 'adaptability',
      description: 'Adjusts when page state differs from plan while maintaining objective',
      weight: 1.2,
    },
  ],

  positive_feedback_instruction: 'Use positive examples as reference quality for successful browser automation execution.',
  negative_feedback_instruction: 'Learn from negative examples to avoid tool misuse, errors, or inefficient execution.',

  comparison_positive: 'Compare how well the optimized prompt matches or exceeds execution quality.',
  comparison_negative: 'Ensure the optimized prompt avoids tool errors and execution failures.',
};

