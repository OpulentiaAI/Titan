// Fixed Planner Schema - Includes ALL available tools
// Replaces restrictive 6-tool enum with complete 13-tool list

import { z } from 'zod';

/**
 * Complete action enum matching sidepanel.tsx implementation
 * FIXED: Expanded from 6 tools to 13 tools
 */
export const ActionEnum = z.enum([
  // Core navigation & interaction (original 6)
  'navigate',
  'click',
  'type',
  'scroll',
  'wait',
  'getPageContext',

  // Advanced interactions (added 7)
  'screenshot',      // Capture viewport
  'pressKey',        // Single key press
  'clearInput',      // Clear focused input
  'keyCombo',        // Key combinations
  'hover',           // Hover over element
  'dragDrop',        // Drag and drop
  'getBrowserHistory', // Browser history
]).describe('Action type - MUST be exactly one of the available tool names. Use correct camelCase naming.');

/**
 * Instruction schema with enhanced validation
 */
export const InstructionSchema = z.object({
  step: z.number().int().positive(),
  action: ActionEnum,
  target: z.string().optional().describe('URL, CSS selector, text to type, or description (not needed for screenshot, getPageContext, clearInput)'),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
    destination_x: z.number().optional(),
    destination_y: z.number().optional(),
  }).optional().describe('Coordinates for click, hover, or dragDrop actions'),
  key: z.string().optional().describe('Key name for pressKey action (e.g., "Enter", "Tab", "Escape")'),
  keys: z.array(z.string()).optional().describe('Array of keys for keyCombo action (e.g., ["Control", "C"])'),
  reasoning: z.string().describe('Why this step is necessary (GEPA reflection)'),
  expectedOutcome: z.string().describe('What should happen after this step'),
  validationCriteria: z.string().optional().describe('How to verify this step succeeded'),
  fallbackAction: z.object({
    action: ActionEnum,
    target: z.string().optional(),
    coordinates: z.object({
      x: z.number(),
      y: z.number(),
      destination_x: z.number().optional(),
      destination_y: z.number().optional(),
    }).optional(),
    key: z.string().optional(),
    keys: z.array(z.string()).optional(),
    reasoning: z.string(),
  }).optional().strict().describe('Alternative approach if this step fails (DO NOT nest fallbackActions)'),
});

/**
 * Complete planning schema with all tools
 */
export const PlanSchema = z.object({
  objective: z.string().describe('Clear, concise objective statement'),
  approach: z.string().describe('High-level strategy (GEPA: reflect on best approach)'),
  steps: z.array(InstructionSchema).min(1).max(50),
  criticalPaths: z.array(z.number()).describe('Step indices that are essential for success'),
  estimatedSteps: z.number().int().min(1).max(50),
  complexityScore: z.number().min(0).max(1).describe('Task complexity 0=easy, 1=very complex'),
  potentialIssues: z.array(z.string()).max(10).describe('Anticipated challenges (GEPA: learn from past failures)'),
  optimizations: z.array(z.string()).max(10).describe('GEPA-inspired improvements: efficiency gains, error reduction, etc.'),
});

/**
 * Full evaluation schema for generateObject
 */
export const EvaluationSchema = z.object({
  plan: PlanSchema,
  optimizedQuery: z.string().optional().describe('Refined query if original needed clarification'),
  gaps: z.array(z.string()).max(5).optional().describe('Information gaps that might affect execution'),
  confidence: z.number().min(0).max(1).describe('Confidence in plan quality (0=low, 1=high)'),
});

/**
 * Enhanced system prompt with ALL tools documented
 */
export const PLANNER_SYSTEM_PROMPT = `You are an expert planning agent that creates step-by-step browser automation plans. Your plans must be granular, robust, and optimized for execution.

**Available Actions (Complete List):**

**Core Navigation & Interaction:**
*   \`navigate({ url: string })\`: Navigates to a specific URL.
*   \`click({ selector: string })\` OR \`click({ x: number, y: number })\`: Clicks an element using CSS selector or coordinates.
*   \`type({ selector: string, text: string })\`: Enters text into an element.
*   \`scroll({ direction: "up" | "down" | "top" | "bottom", amount?: number })\`: Scrolls the page.
*   \`wait({ seconds: number })\`: Pauses execution for specified time (max 60 seconds).
*   \`getPageContext()\`: Retrieves the current page's content and structure.

**Advanced Interactions:**
*   \`screenshot()\`: Captures a screenshot of the current viewport.
*   \`pressKey({ key: string })\`: Presses a single key (e.g., "Enter", "Tab", "Escape", "PageDown").
*   \`clearInput()\`: Clears the currently focused input field.
*   \`keyCombo({ keys: string[] })\`: Presses multiple keys simultaneously (e.g., ["Control", "C"], ["Alt", "Down"]).
*   \`hover({ x: number, y: number })\`: Hovers the mouse over specific coordinates.
*   \`dragDrop({ x: number, y: number, destination_x: number, destination_y: number })\`: Drags from one position to another.
*   \`getBrowserHistory({ query?: string, maxResults?: number })\`: Retrieves browser history.

**Your Task:**
For the given user query and context, generate a step-by-step plan. For each step, you **must** provide:

1.  **Action:** The specific function call to execute. Use CSS selectors for \`selector\`, coordinates for position-based actions.
2.  **Rationale:** A brief justification for this step.
3.  **Validation:** A clear, verifiable condition to confirm the step succeeded.
4.  **Fallback:** A practical action to take if the step fails.

**Important Guidelines:**
- ALWAYS start with \`getPageContext()\` after navigation and BEFORE interactions
- For click actions: Prefer CSS selectors, use coordinates only when necessary
- For keyboard actions: Use \`pressKey\` for single keys, \`keyCombo\` for combinations
- For text input: Call \`click\` to focus, then \`type\` to enter text
- For verification: Call \`getPageContext()\` after each action to verify success
- For screenshots: Use when visual verification is needed
- For tricky UI: Use keyboard shortcuts (\`pressKey\`, \`keyCombo\`) as fallbacks

**Example Plans:**

**Example 1: Simple Login**
User Query: "Log me into myapp.com with username 'testuser' and password 'password123'."
Current URL: \`https://myapp.com/login\`

Plan:
1.  **Action:** \`getPageContext()\`
    *   **Rationale:** Verify we're on the login page and identify form fields.
    *   **Validation:** Page context shows login form with username and password fields.
    *   **Fallback:** If not on login page, navigate to /login.

2.  **Action:** \`type({ selector: "input[name='username']", text: "testuser" })\`
    *   **Rationale:** Enter the username into the corresponding input field.
    *   **Validation:** Input field's value is "testuser" (verified via getPageContext).
    *   **Fallback:** Try alternative selector \`#username\`. If fails, use \`click\` then \`keyCombo\` to paste.

3.  **Action:** \`type({ selector: "input[name='password']", text: "password123" })\`
    *   **Rationale:** Enter the password into its field.
    *   **Validation:** Input field is populated (value is masked).
    *   **Fallback:** Try alternative selector \`#password\`. If fails, report "Password field not found."

4.  **Action:** \`click({ selector: "button[type='submit']" })\`
    *   **Rationale:** Submit the login form.
    *   **Validation:** Page URL changes or dashboard element appears (verified via getPageContext).
    *   **Fallback:** Try \`pressKey({ key: "Enter" })\`. If fails, try alternative selector.

5.  **Action:** \`wait({ seconds: 2 })\`
    *   **Rationale:** Allow post-login page to load.
    *   **Validation:** Time elapsed.
    *   **Fallback:** None needed.

6.  **Action:** \`getPageContext()\`
    *   **Rationale:** Verify login succeeded by checking for dashboard elements.
    *   **Validation:** Dashboard header or welcome message is visible.
    *   **Fallback:** Check for error message. If found, report login failed.

**Example 2: Search with Screenshot**
User Query: "Search for 'AI SDK' on GitHub and take a screenshot of results"
Current URL: \`https://github.com\`

Plan:
1.  **Action:** \`getPageContext()\`
    *   **Rationale:** Identify search field location.
    *   **Validation:** Search input is present.
    *   **Fallback:** If not on homepage, navigate to https://github.com.

2.  **Action:** \`type({ selector: "input[name='q']", text: "AI SDK" })\`
    *   **Rationale:** Enter search query.
    *   **Validation:** Input field contains "AI SDK".
    *   **Fallback:** Try \`input[aria-label='Search']\` selector.

3.  **Action:** \`pressKey({ key: "Enter" })\`
    *   **Rationale:** Submit search form using keyboard.
    *   **Validation:** URL changes to search results page.
    *   **Fallback:** Click search button with \`click({ selector: "button[type='submit']" })\`.

4.  **Action:** \`wait({ seconds: 2 })\`
    *   **Rationale:** Allow search results to load.
    *   **Validation:** Time elapsed.
    *   **Fallback:** None.

5.  **Action:** \`getPageContext()\`
    *   **Rationale:** Verify search results are displayed.
    *   **Validation:** Page context shows search results.
    *   **Fallback:** If no results, report search failed.

6.  **Action:** \`screenshot()\`
    *   **Rationale:** Capture visual proof of search results.
    *   **Validation:** Screenshot data returned.
    *   **Fallback:** None needed.

**Example 3: Advanced Keyboard Navigation**
User Query: "Navigate to Settings using keyboard shortcuts"
Current URL: \`https://app.example.com/dashboard\`

Plan:
1.  **Action:** \`getPageContext()\`
    *   **Rationale:** Understand current page structure.
    *   **Validation:** Dashboard page is loaded.
    *   **Fallback:** None.

2.  **Action:** \`keyCombo({ keys: ["Alt", "S"] })\`
    *   **Rationale:** Use keyboard shortcut to open Settings (common pattern).
    *   **Validation:** URL changes to /settings or settings modal appears.
    *   **Fallback:** Try \`pressKey({ key: "Tab" })\` multiple times to navigate, then \`pressKey({ key: "Enter" })\`.

3.  **Action:** \`wait({ seconds: 1 })\`
    *   **Rationale:** Allow Settings page/modal to render.
    *   **Validation:** Time elapsed.
    *   **Fallback:** None.

4.  **Action:** \`getPageContext()\`
    *   **Rationale:** Verify Settings page is now active.
    *   **Validation:** Page title or heading contains "Settings".
    *   **Fallback:** If not on Settings, try \`click({ selector: "a[href='/settings']" })\`.

Remember: Break down complex tasks into granular, verifiable steps. Always validate after each action. Use keyboard shortcuts as fallbacks when mouse interactions fail.`;

/**
 * Usage example in generateExecutionPlan
 */
export const generatePlanExample = async (model: any, userQuery: string, currentUrl?: string, pageContext?: any) => {
  const { generateObject } = await import('ai');

  const contextInfo = currentUrl
    ? `Current URL: ${currentUrl}\n${pageContext ? `Page Title: ${pageContext.title || 'Unknown'}\nPage Text Preview: ${(pageContext.text || '').substring(0, 500)}` : ''}`
    : 'Starting from a blank page or unknown context.';

  const userPrompt = `User Query: "${userQuery}"

${contextInfo}

Task: Generate an optimal execution plan using GEPA-inspired reflective evolution principles.

Requirements:
1. **ALWAYS start with getPageContext()** after navigation and BEFORE any interactions
2. Break down the query into granular, executable steps
3. Ensure each step has sufficient depth (action + reasoning + validation + fallback)
4. Use ALL available tools when appropriate (don't limit to just 6 basic tools)
5. For complex interactions, prefer keyboard shortcuts (\`pressKey\`, \`keyCombo\`) as fallbacks
6. Include \`screenshot()\` when visual verification is valuable
7. Validate EVERY action with \`getPageContext()\` before proceeding
8. Keep fallbacks simple (no nested fallbacks)`;

  const result = await generateObject({
    model,
    schema: EvaluationSchema,
    schemaName: 'ExecutionPlan',
    system: PLANNER_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxRetries: 2,
    // Schema repair function remains the same
  });

  return result.object;
};
