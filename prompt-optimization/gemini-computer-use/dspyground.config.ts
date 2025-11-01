import { z } from 'zod';

// DSPyground configuration for Gemini Computer Use Prompt Optimization
// Optimizes the visual computer use agent's system prompt

export default {
  systemPrompt: `You are a browser automation assistant with ONLY browser control capabilities.

CRITICAL: You can ONLY use the computer_use tool functions for browser automation. DO NOT attempt to call any other functions like print, execute, or any programming functions.

AVAILABLE ACTIONS (computer_use tool only):
- click / click_at: Click at coordinates
- type_text_at: Type text (optionally with press_enter)
- scroll / scroll_down / scroll_up: Scroll the page
- navigate: Navigate to a URL
- wait / wait_5_seconds: Wait for page load

GUIDELINES (Validated Patterns):
1. NAVIGATION: Use 'navigate' function to go to websites
   Example: navigate({url: "https://www.reddit.com"})
   - Always wait 2.5s after navigation for page load
   - Verify page loaded by checking screenshot for expected content

2. INTERACTION: Use coordinates from the screenshot you see
   - Click at coordinates to interact with elements
   - Type text at coordinates to fill forms
   - Wait for elements to be visible before interacting (check screenshot)

3. NO HALLUCINATING: Only use the functions listed above. Do NOT invent or call functions like print(), execute(), or any code functions.

4. EFFICIENCY: Complete tasks in fewest steps possible.

VALIDATED EXECUTION PATTERNS:
- Visual computer use requires waiting for page state changes (check screenshots)
- After navigation, wait 2.5s minimum before next action
- After form submission, wait 1.5s minimum for page response
- Verify action success by checking screenshot for expected result
- If screenshot shows error or unexpected state, pause and reassess`,

  // Visual computer use uses tool calling with screenshots
  schema: z.object({
    response: z.string().describe('Natural language response explaining actions taken'),
    toolCalls: z.array(z.object({
      tool: z.string(),
      args: z.record(z.any()),
    })).optional(),
  }),

  selectedModel: 'google/gemini-2.5-pro',
  optimizationModel: 'google/gemini-2.5-pro',
  reflectionModel: 'google/gemini-2.5-pro',
  useStructuredOutput: false,
  optimizeStructuredOutput: false,
  batchSize: 2,
  numRollouts: 8,
  selectedMetrics: ['visual_accuracy', 'efficiency', 'safety'],

  evaluation_instructions: `Evaluate the visual computer use agent's execution:
- Visual Accuracy: Correctly identifies elements from screenshots and uses proper coordinates
- Efficiency: Completes tasks in minimal steps, uses appropriate wait times
- Safety: Avoids hallucinated functions, only uses computer_use tools
- Adaptability: Adjusts actions based on screenshot content`,

  dimensions: [
    {
      name: 'visual_accuracy',
      description: 'Correctly identifies elements from screenshots and uses proper coordinates',
      weight: 1.7,
    },
    {
      name: 'efficiency',
      description: 'Completes tasks in minimal steps, uses appropriate wait times',
      weight: 1.3,
    },
    {
      name: 'safety',
      description: 'Avoids hallucinated functions, only uses computer_use tools',
      weight: 1.6,
    },
    {
      name: 'adaptability',
      description: 'Adjusts actions based on screenshot content and page state',
      weight: 1.2,
    },
  ],

  positive_feedback_instruction: 'Use positive examples as reference quality for successful visual computer use execution.',
  negative_feedback_instruction: 'Learn from negative examples to avoid function hallucination and coordinate errors.',

  comparison_positive: 'Compare how well the optimized prompt matches or exceeds visual execution quality.',
  comparison_negative: 'Ensure the optimized prompt avoids function hallucination and coordinate errors.',
};

