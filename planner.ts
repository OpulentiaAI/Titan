// Mandatory Planning Evaluator using GEPA-inspired reflective evolution
// Generates structured instruction sets for computer-use agent execution

export interface PlanningInstruction {
  step: number;
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'getPageContext';
  target: string; // URL, selector, or description
  reasoning: string; // Why this step is needed
  expectedOutcome: string; // What should happen after this step
  validationCriteria?: string; // How to verify success
  fallbackAction?: PlanningInstruction; // What to do if this fails
}

export interface ExecutionPlan {
  objective: string; // Overall goal
  approach: string; // High-level strategy
  steps: PlanningInstruction[];
  criticalPaths: number[]; // Step indices that are critical for success
  estimatedSteps: number;
  complexityScore: number; // 0-1, where 1 is most complex
  potentialIssues: string[]; // Anticipated challenges
  optimizations: string[]; // GEPA-inspired improvements
}

export interface PlanningResult {
  plan: ExecutionPlan;
  optimizedQuery?: string; // Refined query if original was unclear
  gaps?: string[]; // Information gaps identified
  confidence: number; // 0-1 confidence in plan quality
}

/**
 * Mandatory planner that always runs to generate structured execution plans
 * Uses GEPA-inspired reflective evolution to create optimal instruction sets
 */
export async function generateExecutionPlan(
  userQuery: string,
  opts: {
    provider: 'google' | 'gateway';
    apiKey: string;
    model?: string;
    braintrustApiKey?: string;
  },
  currentUrl?: string,
  pageContext?: any
): Promise<PlanningResult> {
  const startTime = Date.now();
  console.log('📋 [Planner] Starting execution plan generation');
  console.log('📋 [Planner] Query:', userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''));
  console.log('📋 [Planner] Current URL:', currentUrl || 'unknown');
  console.log('📋 [Planner] Provider:', opts.provider);
  console.log('📋 [Planner] Model:', opts.model || (opts.provider === 'gateway' ? 'google:gemini-2.5-flash' : 'gemini-2.5-flash'));
  console.log('📋 [Planner] Has page context:', !!pageContext);
  
  const { z } = await import('zod');
  const { getWrappedAI } = await import('./lib/ai-wrapped');
  const aiModule = await getWrappedAI(opts.braintrustApiKey);
  const { generateObject } = aiModule;

  // Use fast model for planning to minimize latency
  let model: any;
  try {
    if (opts.provider === 'gateway') {
      console.log('🔑 [Planner] Creating AI Gateway client...');
      const { createGateway } = await import('@ai-sdk/gateway');
      if (!opts.apiKey) {
        throw new Error('AI Gateway API key is required for planning');
      }
      const client = createGateway({ apiKey: opts.apiKey });
      model = client(opts.model || 'google:gemini-2.5-flash');
      console.log('✅ [Planner] AI Gateway client created successfully');
    } else {
      console.log('🔑 [Planner] Creating Google Generative AI client...');
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      if (!opts.apiKey) {
        throw new Error('Google API key is required for planning');
      }
      const client = createGoogleGenerativeAI({ apiKey: opts.apiKey });
      model = client(opts.model || 'gemini-2.5-flash');
      console.log('✅ [Planner] Google Generative AI client created successfully');
    }
  } catch (error: any) {
    console.error('❌ [Planner] Failed to create AI client:', error.message);
    throw error;
  }

  // GEPA-inspired reflective schema: structured, granular, with validation
  const instructionSchema = z.object({
    step: z.number(),
    action: z.enum(['navigate', 'click', 'type', 'scroll', 'wait', 'getPageContext'])
      .describe('Action type - MUST be exactly one of: navigate, click, type, scroll, wait, getPageContext. Do NOT use waitForElement, waitFor, getContext, or other invalid values.'),
    target: z.string().describe('URL, CSS selector, text to type, or description'),
    reasoning: z.string().describe('Why this step is necessary (GEPA reflection)'),
    expectedOutcome: z.string().describe('What should happen after this step'),
    validationCriteria: z.string().optional().describe('How to verify this step succeeded'),
    fallbackAction: z.object({
      action: z.string(),
      target: z.string(),
      reasoning: z.string(),
      // DO NOT nest fallbackActions - this is a simple one-level fallback only
    }).optional().strict().describe('Alternative approach if this step fails (DO NOT nest fallbackActions - keep it simple)'),
  });

  const planSchema = z.object({
    objective: z.string().describe('Clear, concise objective statement'),
    approach: z.string().describe('High-level strategy (GEPA: reflect on best approach)'),
    steps: z.array(instructionSchema).min(1).max(50),
    criticalPaths: z.array(z.number()).describe('Step indices that are essential for success'),
    estimatedSteps: z.number().int().min(1).max(50),
    complexityScore: z.number().min(0).max(1).describe('Task complexity 0=easy, 1=very complex'),
    potentialIssues: z.array(z.string()).max(10).describe('Anticipated challenges (GEPA: learn from past failures)'),
    optimizations: z.array(z.string()).max(10).describe('GEPA-inspired improvements: efficiency gains, error reduction, etc.'),
  });

  const evaluationSchema = z.object({
    plan: planSchema,
    optimizedQuery: z.string().optional().describe('Refined query if original needed clarification'),
    gaps: z.array(z.string()).max(5).optional().describe('Information gaps that might affect execution'),
    confidence: z.number().min(0).max(1).describe('Confidence in plan quality (0=low, 1=high)'),
  });

  // GEPA-optimized system prompt: enhanced through AI-powered evolutionary optimization
  // Improved accuracy from 0.3 to 0.9, completeness from 0.2 to 1.0, efficiency maintained at 1.0
  // Score: 0.966 (Accuracy: 0.9, Efficiency: 1.0, Completeness: 1.0)
  // Run ID: run-1761855676725
  const systemPrompt = `You are an expert planning agent that creates step-by-step browser automation plans. Your plans must be granular, robust, and optimized for execution.

**Available Actions:**
*   \`navigate(url: string)\`: Navigates to a specific URL.
*   \`type(selector: string, text: string)\`: Enters text into an element.
*   \`click(selector: string)\`: Clicks an element.
*   \`getPageContext()\`: Retrieves the current page's content and structure.
*   \`waitForElement(selector: string)\`: Pauses execution until a specific element is visible.

**Your Task:**
For the given user query and context, generate a step-by-step plan. For each step, you **must** provide the following:

1.  **Action:** The specific function call to execute. Use CSS selectors for \`selector\`.
2.  **Rationale:** A brief justification for this step.
3.  **Validation:** A clear, verifiable condition to confirm the step succeeded.
4.  **Fallback:** A practical action to take if the step fails.

---
**Example:**

**User Query:** "Log me into myapp.com with username 'testuser' and password 'password123'."
**Current URL:** \`https://myapp.com/login\`

**Execution Plan:**
1.  **Action:** \`type("input[name='username']", "testuser")\`
    *   **Rationale:** To enter the username into the corresponding input field.
    *   **Validation:** The input field's value is "testuser".
    *   **Fallback:** \`getPageContext()\` and retry with a more specific selector (e.g., \`#username\`). If it still fails, report "Username field not found."

2.  **Action:** \`type("input[name='password']", "password123")\`
    *   **Rationale:** To enter the password into its field.
    *   **Validation:** The input field is populated (value is masked).
    *   **Fallback:** \`getPageContext()\` and retry with a more specific selector (e.g., \`#password\`). If it still fails, report "Password field not found."

3.  **Action:** \`click("button[type='submit']")\`
    *   **Rationale:** To submit the login form.
    *   **Validation:** The page URL changes or a dashboard element appears.
    *   **Fallback:** Retry the click. If it fails again, try an alternative selector like \`button.login-btn\`. Report failure if unsuccessful.

4.  **Action:** \`waitForElement("div.dashboard-header")\`
    *   **Rationale:** To confirm a successful login by waiting for a key element on the post-login page.
    *   **Validation:** The element \`div.dashboard-header\` becomes visible.
    *   **Fallback:** Check for an error message like \`.error-message\`. If found, report "Login failed: Invalid credentials." Otherwise, report "Login confirmation failed."`;

  const contextInfo = currentUrl 
    ? `Current URL: ${currentUrl}\n${pageContext ? `Page Title: ${pageContext.title || 'Unknown'}\nPage Text Preview: ${(pageContext.text || '').substring(0, 500)}` : ''}`
    : 'Starting from a blank page or unknown context.';

  const userPrompt = [
    `User Query: "${userQuery}"`,
    '',
    contextInfo,
    '',
    'Task: Generate an optimal execution plan using GEPA-inspired reflective evolution and DeepResearch orthogonality & depth principles.',
    '',
    'Requirements:',
    '1. **ALWAYS start with getPageContext()** after navigation and BEFORE any interactions',
    '2. Break down the query into granular, orthogonal, executable steps (minimize overlap, maximize coverage)',
    '3. Ensure each step has sufficient depth (action + reasoning + validation + fallback)',
    '4. Reflect on optimal approaches (e.g., selector vs coordinates, efficiency gains)',
    '5. Identify critical paths (steps that must succeed)',
    '6. Anticipate potential issues and provide fallbacks',
    '7. Suggest optimizations for reliability and speed',
    '8. Each step must have clear validation criteria',
    '9. Verify orthogonality: steps should address different aspects with <20% overlap',
    '10. Verify depth: each step should have 3-4 layers of inquiry (action → reasoning → validation → fallback)',
    '',
    'Validated Patterns to Consider:',
    '- **MANDATORY**: After navigate(), ALWAYS call getPageContext() FIRST to see actual page elements',
    '- **MANDATORY**: Before type(), click(), or any element interaction, verify element exists via getPageContext()',
    '- Tool execution includes automatic retries for connection errors',
    '- Timeouts prevent indefinite hangs (plan accordingly)',
    '- CSS selectors are more reliable than coordinates (prefer selectors)',
    '- Focus management requires delays for React/Vue/Angular apps',
    '- Page context verification ensures step completion before proceeding',
    '- NEVER assume form elements exist - always verify with getPageContext() first',
    '',
    'Think step-by-step, reflect on best practices and tested patterns, then generate the plan.',
  ].join('\n');

  try {
    console.log('🧠 [Planner] Calling LLM to generate plan...');
    const llmStartTime = Date.now();
    
    const result = await generateObject({
      model,
      schema: evaluationSchema,
      schemaName: 'ExecutionPlan',
      schemaDescription: 'A structured execution plan for browser automation with steps, critical paths, and optimization suggestions. The response must have confidence at the root level, not inside plan.',
      system: systemPrompt,
      prompt: userPrompt,
      maxRetries: 2, // Retry on schema validation failures
      experimental_repairText: async ({ text }) => {
        // Attempt to repair common schema issues
        try {
          const parsed = JSON.parse(text);
          
          // Fix: Move confidence from plan to root if needed
          if (parsed.plan?.confidence !== undefined && parsed.confidence === undefined) {
            parsed.confidence = parsed.plan.confidence;
            delete parsed.plan.confidence;
            console.log('🔧 [Planner] Repaired: Moved confidence from plan to root');
          }
          
          // Ensure all required root-level fields exist
          if (!parsed.confidence && parsed.plan) {
            parsed.confidence = 0.5; // Default confidence
            console.log('🔧 [Planner] Repaired: Added default confidence');
          }
          
          // Fix: Replace invalid action enum values with valid ones
          // Fix: Remove nested fallbackActions (prevent recursion that breaks JSON)
          const validActions = ['navigate', 'click', 'type', 'scroll', 'wait', 'getPageContext'];
          if (parsed.plan?.steps) {
            let repairedActions = false;
            let repairedFallbacks = false;
            parsed.plan.steps = parsed.plan.steps.map((step: any) => {
              if (step.action && !validActions.includes(step.action)) {
                console.log(`🔧 [Planner] Repaired: Invalid action "${step.action}"`);
                repairedActions = true;
                // Map common invalid actions to valid ones
                const actionMap: Record<string, string> = {
                  'waitForElement': 'wait',
                  'waitFor': 'wait',
                  'getContext': 'getPageContext',
                  'getPage': 'getPageContext',
                  'clickElement': 'click',
                  'typeText': 'type',
                  'scrollPage': 'scroll',
                };
                step.action = actionMap[step.action] || 'wait'; // Default to wait
              }
              
              // Fix nested fallbackActions - flatten to single level only
              if (step.fallbackAction?.fallbackAction) {
                console.log(`🔧 [Planner] Repaired: Removing nested fallbackAction from step ${step.step}`);
                repairedFallbacks = true;
                // Keep only the first-level fallback, remove nested ones
                step.fallbackAction = {
                  action: step.fallbackAction.action || 'wait',
                  target: step.fallbackAction.target || '1',
                  reasoning: step.fallbackAction.reasoning || 'Fallback action',
                };
                // Remove any nested structure
                delete step.fallbackAction.fallbackAction;
              }
              
              return step;
            });
            if (repairedActions) {
              console.log('🔧 [Planner] Repaired: Fixed invalid action enum values');
            }
            if (repairedFallbacks) {
              console.log('🔧 [Planner] Repaired: Flattened nested fallbackActions');
            }
          }
          
          return JSON.stringify(parsed);
        } catch (parseError) {
          // If JSON parsing fails, return original text
          console.warn('🔧 [Planner] Could not repair JSON, returning original');
          return text;
        }
      },
    });

    const llmDuration = Date.now() - llmStartTime;
    console.log(`✅ [Planner] LLM responded in ${llmDuration}ms`);
    
    // Validate the result object exists
    if (!result?.object) {
      throw new Error('No object generated from LLM response');
    }
    
    const planningResult = result.object as PlanningResult;
    
    // Validate critical fields exist
    if (!planningResult?.plan || !planningResult?.plan?.steps || planningResult.plan.steps.length === 0) {
      throw new Error('Generated plan is missing required fields or has no steps');
    }
    
    // Log plan metrics
    console.log('📊 [Planner] Plan Metrics:');
    console.log('  - Steps:', planningResult.plan.steps.length);
    console.log('  - Estimated Steps:', planningResult.plan.estimatedSteps);
    console.log('  - Complexity Score:', Math.round(planningResult.plan.complexityScore * 100) + '%');
    console.log('  - Confidence:', Math.round(planningResult.confidence * 100) + '%');
    console.log('  - Critical Paths:', planningResult.plan.criticalPaths.length);
    console.log('  - Potential Issues:', planningResult.plan.potentialIssues.length);
    console.log('  - Optimizations:', planningResult.plan.optimizations.length);
    console.log('  - Has Optimized Query:', !!planningResult.optimizedQuery);
    console.log('  - Has Gaps:', (planningResult.gaps?.length || 0) > 0);
    
    // Log step breakdown
    const stepActions = planningResult.plan.steps.map(s => s.action);
    const actionCounts = stepActions.reduce((acc, action) => {
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('📋 [Planner] Step Actions Breakdown:', JSON.stringify(actionCounts));
    
    // Log steps with fallbacks
    const stepsWithFallbacks = planningResult.plan.steps.filter(s => s.fallbackAction).length;
    console.log('🔄 [Planner] Steps with fallbacks:', stepsWithFallbacks);
    
    const totalDuration = Date.now() - startTime;
    console.log(`⏱️ [Planner] Total planning time: ${totalDuration}ms`);
    console.log(`✅ [Planner] Plan generation completed successfully`);
    
    return planningResult;
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error('❌ [Planner] Planning generation failed after', totalDuration, 'ms');
    console.error('❌ [Planner] Error type:', error?.name || 'Unknown');
    console.error('❌ [Planner] Error message:', error?.message || String(error));
    
    // Use AI SDK's NoObjectGeneratedError check for better error handling
    // See: https://v6.ai-sdk.dev/docs/ai-sdk-core/generating-structured-data#error-handling
    const { NoObjectGeneratedError } = await import('ai');
    const isNoObjectError = NoObjectGeneratedError.isInstance?.(error) || error?.name === 'AI_NoObjectGeneratedError';
    
    if (isNoObjectError || error?.message?.includes('schema')) {
      console.error('❌ [Planner] Schema validation failed - LLM response did not match expected structure');
      console.error('❌ [Planner] This may indicate the model needs clearer instructions or the schema is too strict');
      
      // Log detailed error information if available
      if (isNoObjectError && error?.text) {
        console.error('❌ [Planner] Generated text (may be invalid JSON):', error.text.substring(0, 500));
      }
      if (error?.cause) {
        console.error('❌ [Planner] Validation cause:', error.cause);
      }
      if (error?.usage) {
        console.error('❌ [Planner] Token usage:', error.usage);
      }
    }
    
    if (error?.stack) {
      console.error('❌ [Planner] Error stack:', error.stack);
    }
    
    // Fallback to simple plan if generation fails
    console.log('🔄 [Planner] Using fallback plan...');
    return {
      plan: {
        objective: userQuery,
        approach: 'Sequential execution with validation',
        steps: [
          {
            step: 1,
            action: 'getPageContext',
            target: 'current_page',
            reasoning: 'Need to understand current page state before proceeding',
            expectedOutcome: 'Page context retrieved (title, text, links, forms)',
            validationCriteria: 'Context object returned with title and URL',
          },
        ],
        criticalPaths: [1],
        estimatedSteps: 1,
        complexityScore: 0.5,
        potentialIssues: ['Planning generation failed, using fallback'],
        optimizations: [],
      },
      confidence: 0.3,
    };
  }
}

/**
 * Enhanced telemetry wrapper for planning (call from sidepanel.tsx)
 */
export async function generateExecutionPlanWithTelemetry(
  userQuery: string,
  opts: {
    provider: 'google' | 'gateway';
    apiKey: string;
    model?: string;
    braintrustApiKey?: string;
  },
  currentUrl?: string,
  pageContext?: any
): Promise<PlanningResult> {
  const { traced } = await import('./lib/braintrust');
  
  return await traced(
    'mandatory_planning_evaluator',
    async () => {
      try {
        const result = await generateExecutionPlan(userQuery, opts, currentUrl, pageContext);
        
        // Metrics are logged automatically by traced function via metadata
        return result;
      } catch (error: any) {
        // Error metadata is logged automatically by traced function
        throw error;
      }
    },
    {
      query: userQuery,
      currentUrl: currentUrl || 'unknown',
      provider: opts.provider,
      hasPageContext: !!pageContext,
      model: opts.model || (opts.provider === 'gateway' ? 'google:gemini-2.5-flash' : 'gemini-2.5-flash'),
    }
  );
}

/**
 * Format planning result into instruction set for computer-use agent
 */
export function formatPlanAsInstructions(plan: ExecutionPlan): string {
  const lines = [
    '# Execution Plan (GEPA-Optimized)',
    '',
    '⚠️ **MANDATORY:** This plan contains MULTIPLE steps that MUST ALL be executed in sequence.',
    'Do NOT stop after Step 1 (getPageContext). Continue with ALL remaining steps.',
    '',
    `**Objective:** ${plan.objective}`,
    `**Approach:** ${plan.approach}`,
    `**Complexity:** ${Math.round(plan.complexityScore * 100)}%`,
    `**Estimated Steps:** ${plan.estimatedSteps}`,
    `**Total Steps in Plan:** ${plan.steps.length} (all must be executed)`,
    '',
    '## Critical Path Steps',
    plan.criticalPaths.map(idx => `- Step ${idx + 1}: ${plan.steps[idx]?.action} - ${plan.steps[idx]?.target}`).join('\n'),
    '',
    '## Potential Issues & Mitigations',
    plan.potentialIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n'),
    '',
    '## Optimizations',
    plan.optimizations.map((opt, i) => `${i + 1}. ${opt}`).join('\n'),
    '',
    '## Step-by-Step Instructions (Execute ALL Steps)',
    '',
    `**IMPORTANT:** There are ${plan.steps.length} steps in this plan. Execute ALL of them unless the objective is explicitly achieved.`,
    '',
    ...plan.steps.map((step) => [
      `### Step ${step.step}: ${step.action.toUpperCase()}`,
      `**Target:** ${step.target}`,
      `**Reasoning:** ${step.reasoning}`,
      `**Expected Outcome:** ${step.expectedOutcome}`,
      step.validationCriteria ? `**Validation:** ${step.validationCriteria}` : '',
      step.fallbackAction ? `**Fallback:** If this fails, ${step.fallbackAction.action} ${step.fallbackAction.target} (${step.fallbackAction.reasoning})` : '',
      '',
    ].filter(Boolean).join('\n')),
  ];

  return lines.join('\n');
}

