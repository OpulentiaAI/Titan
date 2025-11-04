import type {
  BrowserAutomationWorkflowInput,
  BrowserAutomationWorkflowOutput,
  PlanningStepOutput,
  PageContextStepOutput,
  StreamingStepOutput,
  SummarizationStepOutput,
} from '../schemas/workflow-schemas';
import { planningStep } from '../steps/planning-step.ts';
import { pageContextStep } from '../steps/page-context-step.ts';
import { streamingStep } from '../steps/streaming-step.ts';
import { summarizationStep } from '../steps/summarization-step.ts';
import type { Message, PageContext } from '../types';
import { tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  useStep,
  parallel,
  condition,
  startWorkflow,
  endWorkflow,
} from '../lib/workflow-utils.ts';
import { logEvent, logStepProgress } from '../lib/braintrust.ts';
import {
  enhancedPlanningStep,
  EnhancedExecutionManager,
  executeStepsInParallel,
  aggregateExecutionResults,
  evaluateFinalResult,
} from '../lib/workflow-orchestration.ts';
import { workflowDebug, toolDebug, orchestrationDebug } from '../lib/debug-logger.ts';
import { validatePreflight, logPreflightResults } from '../lib/preflight-validation.ts';
import { TaskManager, createWorkflowTaskManager, convertLegacyTasks } from '../lib/task-manager.ts';
import type { ErrorAnalysisResponse } from '../lib/error-analyzer.ts';

type PlanStep = {
  step: number;
  action: string;
  target?: string;
  reasoning?: string;
  expectedOutcome?: string;
  validationCriteria?: string;
  fallbackAction?: any;
};

const extractUrlFromQuery = (query: string): string | null => {
  if (!query) return null;
  
  // Common site name mappings
  const siteMap: Record<string, string> = {
    'hackernews': 'https://news.ycombinator.com',
    'hacker news': 'https://news.ycombinator.com',
    'hn': 'https://news.ycombinator.com',
    'hulu': 'https://www.hulu.com',
    'youtube': 'https://www.youtube.com',
    'github': 'https://github.com',
    'reddit': 'https://www.reddit.com',
    'twitter': 'https://twitter.com',
    'x': 'https://x.com',
    'facebook': 'https://www.facebook.com',
    'instagram': 'https://www.instagram.com',
    'linkedin': 'https://www.linkedin.com',
    'amazon': 'https://www.amazon.com',
    'netflix': 'https://www.netflix.com',
  };
  
  const sanitize = (url: string) => url.replace(/[)\],.!?]+$/, '').trim();
  
  // Check for explicit URL
  const explicitUrl = query.match(/https?:\/\/[\w./-]+/i);
  if (explicitUrl) {
    return sanitize(explicitUrl[0]);
  }
  
  // Check for common site names in query
  const lowerQuery = query.toLowerCase();
  for (const [siteName, siteUrl] of Object.entries(siteMap)) {
    if (lowerQuery.includes(siteName)) {
      return siteUrl;
    }
  }
  
  // Check for domain pattern
  const domainMatch = query.match(/\b([a-z0-9-]+\.[a-z]{2,})(?:\b|\s)/i);
  if (domainMatch) {
    const domain = domainMatch[1].toLowerCase();
    return domain.startsWith('www.') ? `https://${domain}` : `https://www.${domain}`;
  }
  
  // Check for "go to X" pattern
  const goToMatch = query.match(/go to ([a-z0-9.-]+)/i);
  if (goToMatch) {
    const raw = goToMatch[1].toLowerCase().replace(/[^a-z0-9.-]/g, '');
    if (!raw) return null;
    
    // Check if it's a known site name
    if (siteMap[raw]) {
      return siteMap[raw];
    }
    
    const hasTld = raw.includes('.');
    const domain = hasTld ? raw : `${raw}.com`;
    return domain.startsWith('http') ? domain : `https://www.${domain}`;
  }
  
  return null;
};

// Heuristic: information-seeking query classifier (kept generic and site-agnostic)
const isInfoQuery = (query: string) => {
  if (!query) return false;
  const q = query.toLowerCase();
  return /^(tell me about|who is|what is)\b/.test(q) ||
         /\b(search for|find (info|information) about)\b/.test(q);
};

const normalizePlanSteps = (originalSteps: PlanStep[], query: string): PlanStep[] => {
  const clonedSteps = originalSteps.map((step) => ({ ...step }));
  const containsNavigate = clonedSteps.some((step) => step.action === 'navigate');
  const urlFromQuery = extractUrlFromQuery(query);

  if (!containsNavigate && urlFromQuery) {
    clonedSteps.unshift({
      step: 1,
      action: 'navigate',
      target: urlFromQuery,
      reasoning: `Navigate directly to ${urlFromQuery}`,
      expectedOutcome: `Browser loads ${urlFromQuery}`,
      validationCriteria: 'URL matches target and page title is present',
    });
  }

  // Do not inject site-specific steps here; leave site selection and search flow to the agent plan.

  const needsPageContext = !clonedSteps.some((step) => step.action === 'getPageContext');
  if (needsPageContext) {
    clonedSteps.push({
      step: clonedSteps.length + 1,
      action: 'getPageContext',
      target: 'current_page',
      reasoning: 'Verify the current page state after navigation',
      expectedOutcome: 'Page context reflects the loaded site (title, URL, body text)',
    });
  }

  return clonedSteps.map((step, idx) => ({
    ...step,
    step: idx + 1,
    reasoning: step.reasoning || `Execute ${step.action} for step ${idx + 1}`,
    expectedOutcome: step.expectedOutcome || 'Action succeeds without errors',
  }));
};

/**
 * Browser Automation Workflow
 * Coordinates multi-step browser automation with durable execution
 * 
 * Workflow Features Used:
 * - 'use workflow' directive for durable orchestration
 * - 'use step' directives in individual steps for retry logic
 * - Structured inputs/outputs for validation
 * - Engineered trajectories for optimization
 * - Comprehensive telemetry at each phase
 */
export async function browserAutomationWorkflow(
  input: BrowserAutomationWorkflowInput,
  context: {
    executeTool: (toolName: string, params: any) => Promise<any>;
    enrichToolResponse: (res: any, toolName: string) => Promise<any>;
    getPageContextAfterAction: () => Promise<PageContext>;
    updateLastMessage: (updater: (msg: Message) => Message) => void;
    pushMessage: (msg: Message) => void;
    settings: BrowserAutomationWorkflowInput['settings'];
    messages: Message[];
    abortSignal?: AbortSignal;
    retryTask?: (taskId: string) => void;
    cancelTask?: (taskId: string) => void;
  }
): Promise<BrowserAutomationWorkflowOutput> {
  "use workflow"; // Makes this a durable workflow that can pause/resume

  console.log('🚀 [WORKFLOW] Function called with input:', {
    userQuery: input.userQuery,
    hasInitialContext: !!input.initialContext,
    provider: input.settings.provider,
    model: input.settings.model
  });

  // Generate workflow ID (simple ID generation)
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const workflowStartTime = Date.now();
  const executionTrajectory: Array<{
    step: number;
    action: string;
    url?: string;
    success: boolean;
    timestamp: number;
  }> = [];
  
  // Initialize TaskManager for robust task lifecycle management
  const taskManager = createWorkflowTaskManager({
    maxConcurrentTasks: 1, // Sequential execution for browser automation
    defaultMaxRetries: 2,  // Allow retries for failed steps
    enableAutoRetry: true,
    retryDelayMs: 2000,    // 2 second delay between retries
  });

  // Add event listener to sync task updates with UI
  taskManager.addListener((update) => {
    context.updateLastMessage((msg) => {
      const currentTasks = msg.workflowTasks || convertLegacyTasks(taskManager.getAllTasks());
      const updatedTasks = currentTasks.map(t =>
        t.id === update.id ? {
          ...t,
          status: update.status || t.status,
          description: update.description || t.description
        } : t
      );
      return { ...msg, workflowTasks: updatedTasks };
    });
  });

  // Task management helpers
  const updateWorkflowTasks = (taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled', description?: string) => {
    const task = taskManager.getTask(taskId);
    if (!task) return;

    switch (status) {
      case 'in_progress':
        taskManager.startTask(taskId);
        break;
      case 'completed':
        taskManager.completeTask(taskId, description);
        break;
      case 'error':
        taskManager.failTask(taskId, description || 'Task failed');
        break;
      case 'cancelled':
        taskManager.cancelTask(taskId);
        break;
      default:
        taskManager.updateTask(taskId, { status: status as any });
    }
  };

  // Retry handler for failed tasks
  const retryTask = (taskId: string) => {
    const task = taskManager.getTask(taskId);
    if (task && task.status === 'error' && task.retryCount < task.maxRetries) {
      taskManager.retryTask(taskId, 'Retrying after failure');
    }
  };

  // Cancel handler for pending tasks
  const cancelTask = (taskId: string) => {
    const task = taskManager.getTask(taskId);
    if (task && (task.status === 'pending' || task.status === 'in_progress')) {
      taskManager.cancelTask(taskId);
    }
  };
  
  // Run preflight validation before starting workflow
  // Set environment variables from input settings for validation
  const envForValidation = {
    ...process.env,
    YOU_API_KEY: input.settings.youApiKey || process.env.YOU_API_KEY,
    AI_GATEWAY_API_KEY: input.settings.apiKey || process.env.AI_GATEWAY_API_KEY,
    GATEWAY_API_KEY: input.settings.apiKey || process.env.GATEWAY_API_KEY,
    OPENAI_API_KEY: input.settings.apiKey || process.env.OPENAI_API_KEY,
  };
  
  const preflightResult = validatePreflight(envForValidation);
  logPreflightResults(preflightResult, false); // Less verbose in workflow context
  
  if (!preflightResult.passed) {
    workflowDebug.warn('Preflight validation failed - workflow may fail', {
      missingCritical: preflightResult.missingCritical,
      warnings: preflightResult.warnings,
    });
  }
  
  // Debug logging
  const workflowTimer = workflowDebug.time('Workflow Execution');
  workflowDebug.info('Starting browser automation workflow', {
    workflowId,
    query: input.userQuery,
    queryLength: input.userQuery.length,
    provider: input.settings.provider,
    model: input.settings.model,
    hasYouApiKey: !!input.settings.youApiKey,
    hasInitialContext: !!input.initialContext,
    initialUrl: input.initialContext?.currentUrl,
    preflightPassed: preflightResult.passed,
  });
  
// Start workflow metrics tracking
   startWorkflow(workflowId);
   
   logEvent('browser_automation_workflow_start', {
     workflow_id: workflowId,
     query_length: input.userQuery.length,
     provider: input.settings.provider,
     model: input.settings.model,
     has_you_api_key: !!input.settings.youApiKey,
     has_initial_context: !!input.initialContext,
   });
  
  // Determine model family (for provider-specific error handling)
  // Optimized model selection (generic):
  // - google/gemini-2.5-flash-lite: #1 in images (34.3% market share) - best for browser automation
  // - google/gemini-2.5-flash: #3 in images (6.8%) - fast and efficient fallback
  // - Preview versions kept as fallback for compatibility
  const modelName = input.settings.model || (input.settings.provider === 'gateway' 
    ? 'google/gemini-2.5-flash'  // Optimized default for browser automation
    : 'gemini-2.5-pro');
  const isAnthropicModel = modelName.includes('anthropic') || modelName.includes('claude');
  
  // Execution steps tracker (declared before try block for error handling)
  const execSteps: Array<{ step: number; action: string; url?: string; success: boolean; error?: string; target?: string }> = [];
  
  // Declare streaming variable before try block for error handling
  let streaming: StreamingStepOutput | undefined;
  let workflowErrorAnalysis: ErrorAnalysisResponse | undefined;
  
  try {
// ============================================
     // PHASE 1: Planning Step (Mandatory) + Pre-Search (Optional, Parallel)
     // ============================================
     logStepProgress('browser_automation_workflow', 1, {
       phase: 'planning_and_presearch',
       action: 'starting_parallel_execution',
     });
    
    // Push planning start message with workflow tasks and initial context
    const initialTasks = convertLegacyTasks(taskManager.getAllTasks());
    context.pushMessage({
      id: `planning-${Date.now()}`,
      role: 'assistant',
      content: `🧠 **Planning Phase**\n\nAnalyzing task and generating execution plan...\n\n**Query:** ${input.userQuery.substring(0, 100)}${input.userQuery.length > 100 ? '...' : ''}`,
      workflowTasks: initialTasks,
      pageContext: input.initialContext?.pageContext,
      executionTrajectory: [],
    });
    
    // Mark planning as in progress
    updateWorkflowTasks('plan', 'in_progress');
    
    // Execute enhanced planning and pre-search in parallel for faster execution
    // Enhanced planning includes query expansion and orthogonality analysis
    const planningPromise = useStep('planning', async () => {
      const executePlanner = async (query: string) => {
        const modifiedInput = { ...input, userQuery: query };
        const planningOutput = await planningStep(modifiedInput);
        return {
          ...planningOutput,
          planSteps: planningOutput.plan.steps,
        };
      };

      try {
        const enhancedResult = await enhancedPlanningStep(
          input.userQuery,
          executePlanner,
          modelName
        );

        if (enhancedResult?.plan?.steps?.length) {
          workflowDebug.debug('Enhanced planning produced steps', {
            stepCount: enhancedResult.plan.steps.length,
          });
          return enhancedResult;
        }

        workflowDebug.warn('Enhanced planning returned empty steps, falling back to basic planner', {
          stepCount: enhancedResult?.plan?.steps?.length || 0,
        });
      } catch (enhancedError: any) {
        workflowDebug.warn('Enhanced planning failed, falling back to basic planner', {
          error: enhancedError?.message,
        });
      }

      const fallbackResult = await executePlanner(input.userQuery);
      workflowDebug.info('Basic planner used as fallback', {
        stepCount: fallbackResult.plan.steps.length,
      });
      return fallbackResult;
    }, {
      retry: 1, // Retry once on failure
      timeout: 45000, // 45s timeout for planning step
      abortSignal: context.abortSignal,
    });
    
    // Pre-search step (conditional, runs in parallel if API key available)
    // This provides agentic reasoning with web search context before execution
    const hasYouApiKey = !!(input.settings.youApiKey && input.userQuery);
    
    if (hasYouApiKey) {
      workflowDebug.info('🌐 Web search enabled for pre-execution research', {
        queryLength: input.userQuery.length,
        apiKeyLength: input.settings.youApiKey?.length || 0,
      });
      console.log('🌐 [WORKFLOW] Web search & agentic reasoning ENABLED');
    } else {
      workflowDebug.warn('⚠️  Web search disabled - no API key provided', {
        recommendation: 'Add a web search API key to settings for enhanced search capabilities',
      });
      console.log('⚠️  [WORKFLOW] Web search disabled (execution will continue without search enhancement)');
    }
    
    const preSearchPromise = hasYouApiKey
      ? useStep('pre-search', async () => {
          console.log('🔍 [PRE-SEARCH] Starting deep web search for query:', input.userQuery.substring(0, 100));
          const { traced } = await import('../lib/braintrust');
          const { runDeepSearch } = await import('../deepsearch');
          
          const result = await traced(
            'deepsearch_pre_seed',
            async () => {
              return await runDeepSearch(input.userQuery, { 
                youApiKey: input.settings.youApiKey! 
              });
            },
            { query: input.userQuery }
          );
          
          console.log('🔍 [PRE-SEARCH] Deep search complete:', {
            hasResults: !!result.result,
            itemCount: result.result?.items?.length || 0,
          });
          
          return result;
        }, {
          retry: 0, // No retries for pre-search (optional feature)
          timeout: 15000, // 15s timeout
          logMetrics: false, // Less verbose for optional step
        })
      : Promise.resolve({ result: null, duration: 0, attempts: 0, success: true });
    
    const [planningResult, preSearchResult] = await parallel([
      planningPromise,
      preSearchPromise,
    ]);
    
    // Initialize messages array early to ensure it's always available
    // This prevents "messages: undefined" errors even if planning partially fails
    const messages = context.messages.length > 0 
      ? context.messages 
      : [{
          id: Date.now().toString(),
          role: 'user' as const,
          content: input.userQuery,
        }];
    
    if (messages.length === 0) {
      messages.push({
        id: Date.now().toString(),
        role: 'user',
        content: input.userQuery,
      });
    }
    
    // Validate planning result - handle partial failures gracefully
    if (!planningResult?.result) {
      workflowDebug.error('Planning step failed - no result returned', {
        planningResult: planningResult,
        hasResult: !!planningResult?.result,
        resultType: typeof planningResult?.result,
      });
      throw new Error('Planning step failed - no result returned');
    }
    
    let planning = planningResult.result;
    
    console.log('🔧 [WORKFLOW] About to normalize plan steps');
    console.log('🔧 [WORKFLOW] Original planning structure:', {
      hasPlan: !!planning.plan,
      hasSteps: !!planning.plan?.steps,
      stepsType: typeof planning.plan?.steps,
      stepsIsArray: Array.isArray(planning.plan?.steps),
      stepsLength: planning.plan?.steps?.length || 0,
      firstStep: planning.plan?.steps?.[0] ? {
        action: planning.plan.steps[0].action,
        target: planning.plan.steps[0].target,
      } : null,
    });
    
    // Normalize plan steps to ensure navigation + validation steps are present
    const normalizedSteps = normalizePlanSteps(
      Array.isArray(planning.plan?.steps) ? planning.plan.steps as PlanStep[] : [],
      input.userQuery
    );
    
    console.log('🔧 [WORKFLOW] Plan steps normalized successfully', {
      originalSteps: planning.plan.steps.length,
      normalizedSteps: normalizedSteps.length,
    });
    
    planning = {
      ...planning,
      plan: {
        ...planning.plan,
        steps: normalizedSteps,
      },
    };
    
    console.log('🧠 [WORKFLOW] Normalized plan steps', {
      stepCount: planning.plan.steps.length,
      actions: planning.plan.steps.map((step: any) => step.action),
    });
    
    workflowDebug.info('Planning step completed successfully', {
      stepsCount: planning.plan.steps.length,
      confidence: planning.confidence,
      complexityScore: planning.plan.complexityScore,
    });
    
    console.log('📝 [WORKFLOW] About to update last message with planning results');
    try {
      // Update with plan summary and attach planning data
      context.updateLastMessage((msg) => ({
         ...msg,
          content: `🧠 **Planning Complete** ✅\n\n**Plan Generated:**\n- Steps: ${planning.plan.steps.length}\n- Complexity: ${(planning.plan.complexityScore * 100).toFixed(0)}%\n- Confidence: ${(planning.confidence * 100).toFixed(0)}%\n\n**Reasoning:** ${planning.plan.steps.slice(0, 3).map((s: any, i: number) => `${i + 1}. ${s.action || 'Action'}: ${s.description?.substring(0, 60) || 'N/A'}...`).join('\n')}\n\n*Proceeding with execution...*`,
          planning: planning, // Attach planning data for artifact view
          executionTrajectory: executionTrajectory.slice(), // Attach current trajectory
          workflowTasks: convertLegacyTasks(taskManager.getAllTasks()),
      }));
      console.log('📝 [WORKFLOW] Last message updated successfully');
    } catch (updateError: any) {
      console.error('❌ [WORKFLOW] Failed to update last message:', {
        error: updateError?.message,
        stack: updateError?.stack,
      });
      throw updateError;
    }
    
    executionTrajectory.push({
      step: 0,
      action: 'planning',
      success: planning.confidence > 0.3,
      timestamp: Date.now(),
    });

    // Populate execSteps from planning output for execution tracking
    console.log('📋 [WORKFLOW] About to populate execSteps from planning output');
    console.log('📋 [WORKFLOW] Planning result structure:', {
      hasPlan: !!planning.plan,
      hasSteps: !!planning.plan?.steps,
      stepsType: typeof planning.plan?.steps,
      stepsIsArray: Array.isArray(planning.plan?.steps),
      stepsLength: planning.plan?.steps?.length || 0,
    });
    
    planning.plan.steps.forEach((step: any, index: number) => {
      console.log(`📋 [WORKFLOW] Processing step ${index + 1}:`, {
        action: step.action,
        target: step.target,
        hasAction: !!step.action,
        hasTarget: !!step.target,
      });
      execSteps.push({
        step: index + 1,
        action: step.action,
        url: step.target,
        success: false,
        target: step.target,
      });
    });

    workflowDebug.info('ExecSteps populated from planning', {
      execStepsCount: execSteps.length,
      actions: execSteps.map(s => s.action),
    });

    console.log('🔄 [WORKFLOW] After execSteps population, proceeding to agent messages setup');

    const agentMessages: Message[] = [...messages];
    const EXECUTION_PROMPT_MARKER = '[ATLAS_EXECUTION_PROMPT]';
    const hasExecutionPrompt = agentMessages.some(
      (msg) => msg.role === 'user' && typeof msg.content === 'string' && msg.content.includes(EXECUTION_PROMPT_MARKER)
    );

    // Advanced URL parsing utilities from Jina AI DeepResearch (standalone version)
    const { normalizeUrl: jinaNormalizeUrl, extractUrlsWithDescription } = await import('../prompt-optimization/url-standalone');

    if (!hasExecutionPrompt) {
      // Enhanced parameter extraction with Jina AI advanced parsing
      const enhancedPlanStepLines = planning.plan.steps.map((step, idx) => {
        // Advanced parameter extraction with Jina AI parsing
        let extractedParams: string;

        switch (step.action) {
          case 'navigate':
            // Enhanced navigation with Jina AI URL normalization
            let navUrl = step.target;
            if (!navUrl) {
              navUrl = extractUrlFromQuery(input.userQuery);
            }

            // Use Jina AI's sophisticated URL normalization
            if (navUrl) {
              const normalizedUrl = jinaNormalizeUrl(navUrl, false, {
                removeAnchors: true,
                removeSessionIDs: true,
                removeUTMParams: true,
                removeTrackingParams: true,
                removeXAnalytics: true
              });
              if (normalizedUrl) {
                navUrl = normalizedUrl;
              }
            }

            // Enhanced URL validation and intelligent defaults
            if (!navUrl || navUrl === 'undefined') {
              // Intelligent defaults based on query patterns with Jina AI normalization
              const query = input.userQuery.toLowerCase();
              let fallbackUrl = 'https://example.com';

              if (query.includes('google')) {
                fallbackUrl = 'https://www.google.com';
              } else if (query.includes('github')) {
                fallbackUrl = 'https://github.com';
              } else if (query.includes('stackoverflow')) {
                fallbackUrl = 'https://stackoverflow.com';
              } else if (query.includes('example')) {
                fallbackUrl = 'https://example.com';
              }

              // Apply Jina AI normalization to fallback URLs
              const normalizedFallback = jinaNormalizeUrl(fallbackUrl, false);
              navUrl = normalizedFallback || fallbackUrl;
            }
            extractedParams = `url: "${navUrl}"`;
            break;

          case 'click':
            // Enhanced click parameter extraction
            let clickTarget = step.target || 'button'; // Default to button if unspecified
            if (clickTarget.includes('http')) {
              // If target looks like a URL, extract domain for link clicking
              const domain = clickTarget.replace(/^https?:\/\//, '').replace(/\/$/, '');
              clickTarget = `a[href*="${domain}"]`;
            }
            extractedParams = `selector: "${clickTarget}"`;
            break;

          case 'type':
          case 'type_text':
            // Enhanced text input parameter extraction
            let typeTarget = step.target || '';
            let typeText = 'Sample text'; // Default text

            // Try to extract text from various fields
            if (step.description) {
              const textMatch = step.description.match(/type["\s]*([^"]+)/i) || step.description.match(/enter["\s]*([^"]+)/i);
              if (textMatch) {
                typeText = textMatch[1];
              }
            }
            extractedParams = `selector: "${typeTarget}", text: "${typeText}"`;
            break;

          case 'scroll':
            // Enhanced scroll parameter extraction
            let scrollDirection = step.target || 'down';
            let scrollAmount = '500'; // Default scroll amount
            extractedParams = `direction: "${scrollDirection}", amount: "${scrollAmount}"`;
            break;

          case 'wait':
            // Enhanced wait parameter extraction
            let waitTime = step.target || '3'; // Default 3 seconds
            extractedParams = `seconds: ${waitTime}`;
            break;

          case 'press_key':
            // Key press (e.g., Enter, Tab, Escape)
            const keyName = (step.target || 'Enter').replace(/[^A-Za-z]/g, '') || 'Enter';
            extractedParams = `key: "${keyName}"`;
            break;

          default:
            extractedParams = `target: "${step.target || 'N/A'}"`;
        }

        return `Step ${idx + 1}: ${step.action}(${extractedParams}) - ${step.description || 'Execute action'}`;
      });

      const executionInstructionMessage = {
        id: `execution-instructions-${Date.now()}`,
        role: 'user' as const,
        content: `${EXECUTION_PROMPT_MARKER}\n\n**EXECUTION PLAN:**\n${enhancedPlanStepLines.join('\n')}\n\n**INSTRUCTIONS:**\n- Execute each step in sequence. After each tool call, verify success with getPageContext() when relevant.\n- Do NOT stop after navigation. Continue until you've gathered the requested information and produced a natural-language answer.\n- For information-seeking queries (e.g., "tell me about X"), follow this pattern unless a direct URL is provided:\n  1) navigate("https://www.google.com")\n  2) type_text(selector: "input[name='q']", text: "<query>")\n  3) press_key(key: "Enter")\n  4) wait(seconds: 2)\n  5) getPageContext() to verify results\n  6) click(selector: "#search a h3") to open a result\n  7) getPageContext() and extract key facts for the answer\n- If a step fails, apply a targeted fallback (e.g., adjust selector), or explicitly report the failure cause.\n\n**TOOLS AVAILABLE:**\n- navigate: Go to a URL\n- click: Click on elements\n- type_text: Enter text into inputs\n- press_key: Press a key like Enter/Tab/Escape\n- scroll: Scroll the page\n- wait: Wait for page updates\n- getPageContext: Get current page information\n\n**VERIFICATION:** When the objective requires an answer, do not finish until you have opened at least one relevant source page and synthesized a concise answer from its content. Then provide a short, readable summary.`,
      };

      agentMessages.push(executionInstructionMessage);

      console.log('🔧 [WORKFLOW] Execution instruction appended', {
        planSteps: planning.plan.steps.length,
        instructionLength: executionInstructionMessage.content.length,
      });
    }
    
    console.log('📄 [WORKFLOW] Agent messages prepared, proceeding to page context step');
    
// ============================================
// PHASE 2: Page Context Step (if not provided)
// ============================================
    console.log('🏠 [WORKFLOW] Starting PHASE 2: Page Context Step');
    let pageContext: PageContextStepOutput | undefined;
    const initialUrl = input.initialContext?.currentUrl || '';
    const isRestrictedOrBlank = !initialUrl || /^(chrome|edge|about):/i.test(initialUrl);
    if (!input.initialContext?.pageContext && !isRestrictedOrBlank) {
      console.log('📄 [WORKFLOW] No initial page context provided, gathering page context');
      logStepProgress('browser_automation_workflow', 2, {
        phase: 'page_context',
        action: 'gathering_page_context',
      });
     const pageContextResult = await useStep('page-context', async () => {
       return await pageContextStep(context.executeTool);
     }, {
       retry: 1,
       timeout: 10000,
       abortSignal: context.abortSignal,
     });
     
     pageContext = pageContextResult.result;
     executionTrajectory.push({
       step: 1,
       action: 'getPageContext',
       url: pageContext.pageContext.url,
       success: pageContext.success,
       timestamp: Date.now(),
     });
     
     // Attach page context to message
     context.updateLastMessage((msg) => ({
       ...msg,
       pageContext: pageContext,
       executionTrajectory: executionTrajectory.slice(),
     }));
     console.log('📄 [WORKFLOW] Page context gathered successfully');
} else {
      console.log('📄 [WORKFLOW] Using provided initial page context');
      logStepProgress('browser_automation_workflow', 2, {
        phase: 'page_context',
        action: 'using_provided_context',
      });
     // initialContext.pageContext is already a PageContext object, wrap it properly
     const providedContext = input.initialContext.pageContext;
     pageContext = {
       pageContext: {
         url: providedContext?.url || '',
         title: providedContext?.title || '',
         text: providedContext?.text || providedContext?.textContent || '',
         links: providedContext?.links || [],
         forms: providedContext?.forms || [],
         viewport: providedContext?.viewport || { width: 1280, height: 720 },
       },
       duration: 0,
       success: true,
     };
    }
    
    // ============================================
    // PHASE 3: Process Pre-search Results (from parallel execution)
    // ============================================
    let preSearchBlock = '';
    if (preSearchResult && preSearchResult.result) {
      const result = preSearchResult.result;
      
      if (result.items?.length) {
        const lines = result.items.slice(0, 10).map((i: any, idx: number) => 
          `  ${idx + 1}. ${i.title || i.url}\n     ${i.url}`
        );
        preSearchBlock = ['Pre-seeded sources (You Search):', ...lines, '', result.plan].join('\n');
      }
    } else {
    }
    
    // ============================================
    // PHASE 4: Prepare AI SDK Model & Tools
    // ============================================
    const { z } = await import('zod');
    
    if (!input.settings.apiKey) {
      throw new Error('API key is required');
    }
    
    // Initialize AI model based on provider
    let model: any;
    
    if (input.settings.provider === 'gateway') {
      const { createGateway } = await import('@ai-sdk/gateway');
      const gatewayClient = createGateway({ apiKey: input.settings.apiKey });
      model = gatewayClient(modelName);
      if (isAnthropicModel) {
      }
    } else if (input.settings.provider === 'nim') {
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
      const nimClient = createOpenAICompatible({
        name: 'nim',
        baseURL: 'https://integrate.api.nvidia.com/v1',
        headers: {
          Authorization: `Bearer ${input.settings.apiKey}`,
        },
      });
      model = nimClient.chatModel(modelName || 'deepseek-ai/deepseek-r1');
    } else if (input.settings.provider === 'openrouter') {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
      const openrouterClient = createOpenRouter({ apiKey: input.settings.apiKey });
      model = openrouterClient(modelName || 'minimax/minimax-m2');
    } else {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      const googleClient = createGoogleGenerativeAI({ apiKey: input.settings.apiKey });
      model = googleClient(modelName);
    }

    // Performance optimization: Page context caching to avoid redundant calls
    const pageContextCache = new Map<string, { context: any; timestamp: number }>();
    const CACHE_TTL = 2000; // 2 second cache for page context

    // Helper to get cached or fresh page context
    const getCachedPageContext = async () => {
      const cacheKey = `page_${Date.now() - (Date.now() % 1000)}`; // Second-level granularity
      const cached = pageContextCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.context;
      }

      const freshContext = await context.executeTool('getPageContext', {}).catch(() => null);
      pageContextCache.set(cacheKey, { context: freshContext, timestamp: Date.now() });

      // Clean old cache entries
      for (const [key, value] of pageContextCache.entries()) {
        if (Date.now() - value.timestamp > CACHE_TTL) {
          pageContextCache.delete(key);
        }
      }

      return freshContext;
    };

    // Helper to enrich tool responses with optimized page context
    const enrichToolResponse = async (res: any, toolName: string) => {
      try {
        const { url } = await context.getPageContextAfterAction();
        // Use cached page context for performance (only get fresh context if cache miss)
        const pageContext = await getCachedPageContext();
        return {
          success: res?.success !== false,
          url,
          pageContext,
        };
      } catch (e) {
        return { success: res?.success !== false, url: res?.url };
      }
    };
    
    // Define browser tools using tool() helper for AI Gateway compatibility
    
    const tools = {
      navigate: tool({
        description: 'Navigate to a URL. Wait 2.5s after navigation for page to load, then returns page context.',
        parameters: z.object({
          url: z.string().url().refine(
            (val) => val && val !== 'undefined' && val.trim() !== '',
            'URL must be a valid, non-empty string'
          )
        }),
        onInputStart: () => toolDebug.debug('navigate: input generation started'),
        onInputAvailable: ({ input }) => toolDebug.debug('navigate: complete input', { input }),
        execute: async ({ url }: { url: string }) => {
          // Additional runtime validation to prevent undefined URLs
          if (!url || url === 'undefined' || url.trim() === '') {
            throw new Error('Navigation failed: URL is required and must be a valid URL string');
          }

          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          const toolTimer = toolDebug.time(`navigate-${stepNum}`);
          const maxRetries = 2; // Allow 2 retries for failed navigation
          let lastError: Error | undefined;

          toolDebug.debug('Starting navigation tool', {
            stepNum,
            url,
            currentStepCount: execSteps.length,
            maxRetries,
          });
          
          // Push real-time step update with toolExecutions artifact
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `🔷 **Step ${stepNum}: Navigating**\n\nNavigating to ${url}...`,
            toolExecutions: [{
              toolName: 'navigate',
              status: 'in_progress',
              params: { url },
              timestamp: Date.now(),
            }],
          });
          
          // Advanced error recovery and self-healing mechanisms
          const errorRecoveryStrategies = [
            // Strategy 1: URL validation and correction
            () => {
              if (!url || url === 'undefined') {
                // Auto-extract URL from context or query
                const extractedUrl = extractUrlFromQuery(input.userQuery) || 'https://example.com';
                toolDebug.info('Auto-correcting undefined URL', { extractedUrl });
                return extractedUrl;
              }
              return url;
            },
            // Strategy 2: URL format normalization
            (currentUrl: string) => {
              let normalizedUrl = currentUrl;
              if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = 'https://' + normalizedUrl;
                toolDebug.info('Adding https:// prefix', { normalizedUrl });
              }
              if (!normalizedUrl.includes('.')) {
                normalizedUrl += '.com';
                toolDebug.info('Adding .com domain', { normalizedUrl });
              }
              return normalizedUrl;
            },
            // Strategy 3: Domain-specific defaults
            (currentUrl: string) => {
              const query = input.userQuery.toLowerCase();
              let fallbackUrl = currentUrl;

              if (query.includes('google')) {
                fallbackUrl = 'https://www.google.com';
              } else if (query.includes('github')) {
                fallbackUrl = 'https://github.com';
              } else if (query.includes('example')) {
                fallbackUrl = 'https://example.com';
              } else if (query.includes('stackoverflow')) {
                fallbackUrl = 'https://stackoverflow.com';
              }

              if (fallbackUrl !== currentUrl) {
                toolDebug.info('Using domain-specific fallback', { fallbackUrl, original: currentUrl });
                return fallbackUrl;
              }
              return currentUrl;
            }
          ];

          // Retry loop with intelligent error recovery
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              let currentUrl = url;

              // Apply error recovery strategies on retry attempts
              if (attempt > 0) {
                const recoveryStrategy = errorRecoveryStrategies[Math.min(attempt - 1, errorRecoveryStrategies.length - 1)];
                currentUrl = recoveryStrategy(url);

                const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000); // 1s, 2s, 4s
                toolDebug.info('Retrying navigation with recovery', { attempt, retryDelay, originalUrl: url, correctedUrl: currentUrl });

                // Update message to show retry with correction
                context.updateLastMessage((msg) => ({
                  ...msg,
                  content: `🔷 **Step ${stepNum}: Navigating** (Retry ${attempt}/${maxRetries})\n\nRetrying navigation to ${currentUrl}...`,
                }));

                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }

              // Final URL validation before execution
              if (!currentUrl || currentUrl === 'undefined' || currentUrl.trim() === '') {
                throw new Error(`Navigation failed: URL is invalid after recovery attempts (attempt ${attempt + 1})`);
              }

              toolDebug.debug('Executing navigate tool', { url: currentUrl, attempt });
            const res = await context.executeTool('navigate', { url: currentUrl });
            toolDebug.debug('Navigate tool completed', {
              success: res?.success,
              resultUrl: res?.url,
              attempt,
            });

            // Performance optimization: Reduced wait time from 2.5s to 800ms for faster execution
            // Only wait if navigation was successful and page load is needed
            if (res?.success && currentUrl.includes('.')) {
              await new Promise(resolve => setTimeout(resolve, 800)); // Reduced from 2500ms
            }

            const enriched = await enrichToolResponse(res, 'navigate');
            const toolDuration = Date.now() - toolStartTime;
            toolTimer();
            
            toolDebug.info('Navigation completed successfully', {
              stepNum,
              url,
              duration: toolDuration,
              enrichedUrl: enriched.url,
                attempts: attempt + 1,
            });
            execSteps.push({ 
              step: stepNum, 
              action: 'navigate', 
              url: enriched.url || url, 
              success: enriched.success 
            });
            executionTrajectory.push({
              step: stepNum,
              action: 'navigate',
              url: enriched.url || url,
              success: enriched.success,
              timestamp: Date.now(),
            });
            
            // Update with success, reasoning, and pageContext
              const successMessage = attempt > 0 
                ? `🔷 **Step ${stepNum}: Navigation Complete** ✅ (succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'})\n\nSuccessfully navigated to ${enriched.url || url}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Page loaded and ready for next action.`
                : `🔷 **Step ${stepNum}: Navigation Complete** ✅\n\nSuccessfully navigated to ${enriched.url || url}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Page loaded and ready for next action.`;
              
            context.updateLastMessage((msg) => ({
              ...msg,
                content: successMessage,
              pageContext: enriched.pageContext,
              toolExecutions: [{
                toolName: 'navigate',
                status: 'completed',
                params: { url },
                result: enriched,
                duration: toolDuration,
                timestamp: Date.now(),
              }],
              executionTrajectory: executionTrajectory.slice(),
            }));
            
            return enriched;
          } catch (error: any) {
              lastError = error;
              const isLastAttempt = attempt === maxRetries;
              
              toolDebug.warn('Navigation attempt failed', {
                attempt: attempt + 1,
                maxRetries: maxRetries + 1,
                isLastAttempt,
                error: error?.message,
              });
              
              if (isLastAttempt) {
                // Last attempt failed - throw error
            const toolDuration = Date.now() - toolStartTime;
            toolTimer();
                
            try {
                  toolDebug.error('Navigation tool failed after all retries', error, toolDuration);
            } catch (logError) {
              console.error(`❌ [Tool: navigate] Debug logging failed:`, logError);
            }
                
                const errorMessage = `❌ [Tool: navigate] Failed after ${maxRetries + 1} attempts (${toolDuration}ms): ${error?.message || error}`;
                console.error(errorMessage);
                
                // Update message with failure
                context.updateLastMessage((msg) => ({
                  ...msg,
                  content: `🔷 **Step ${stepNum}: Navigation Failed** ❌\n\nFailed to navigate to ${url} after ${maxRetries + 1} attempts.\n\n**Error:** ${error?.message || String(error)}\n⏱️ Duration: ${toolDuration}ms`,
                  toolExecutions: [{
                    toolName: 'navigate',
                    status: 'error',
                    params: { url },
                    error: error?.message || String(error),
                    duration: toolDuration,
                    timestamp: Date.now(),
                  }],
                }));
                
                execSteps.push({ 
                  step: stepNum, 
                  action: 'navigate', 
                  url, 
                  success: false,
                  error: error?.message || String(error),
                });
                executionTrajectory.push({
                  step: stepNum,
                  action: 'navigate',
                  url,
                  success: false,
                  timestamp: Date.now(),
                });
                
            throw error;
          }
              
              // Continue to next retry
              continue;
            }
          }
          
          // All retries exhausted: attempt a robust fallback for information-seeking tasks
          try {
            const q = (input.userQuery || '').trim();
            const looksInfoSeeking = isInfoQuery(q) || /\b(news|latest|breaking)\b/i.test(q);
            if (looksInfoSeeking && q.length > 0) {
              // Prefer a search URL that directly advances the objective
              const fallbackUrl = /\b(news|latest|breaking)\b/i.test(q)
                ? `https://news.google.com/search?q=${encodeURIComponent(q)}`
                : `https://www.google.com/search?q=${encodeURIComponent(q)}`;

              toolDebug.info('Navigation fallback: attempting direct search URL', { fallbackUrl });

              // Inform user about fallback attempt
              context.updateLastMessage((msg) => ({
                ...msg,
                content: `${msg.content}\n\n🔁 **Fallback:** Navigating to search results for the request to ensure progress.\nURL: ${fallbackUrl}`,
              }));

              const res = await context.executeTool('navigate', { url: fallbackUrl });

              if (res?.success) {
                await new Promise(resolve => setTimeout(resolve, 800));
                const enriched = await enrichToolResponse(res, 'navigate');
                const toolDuration = Date.now() - toolStartTime;
                toolTimer();

                execSteps.push({ step: stepNum, action: 'navigate', url: enriched.url || fallbackUrl, success: enriched.success });
                executionTrajectory.push({ step: stepNum, action: 'navigate', url: enriched.url || fallbackUrl, success: enriched.success, timestamp: Date.now() });

                context.updateLastMessage((msg) => ({
                  ...msg,
                  content: `🔷 **Step ${stepNum}: Navigation Complete (Fallback)** ✅\n\nSuccessfully navigated to ${enriched.url || fallbackUrl}\n⏱️ Duration: ${toolDuration}ms`,
                  pageContext: enriched.pageContext,
                  toolExecutions: [{
                    toolName: 'navigate',
                    status: 'completed',
                    params: { url: fallbackUrl },
                    result: enriched,
                    duration: toolDuration,
                    timestamp: Date.now(),
                  }],
                  executionTrajectory: executionTrajectory.slice(),
                }));

                return enriched;
              }
            }
          } catch (fallbackError) {
            toolDebug.warn('Navigation fallback failed', { error: (fallbackError as any)?.message || String(fallbackError) });
          }

          // If fallback also failed, throw original error
          throw lastError || new Error('Navigation failed');
        },
      }),
      getPageContext: tool({
        description: 'Get current page context (title, text, links, forms, viewport). Use this to understand page state before actions.',
        parameters: z.object({
          // Provider schema compatibility: empty objects often require at least one optional field
          _placeholder: z.string().optional().describe('Placeholder for schema compatibility - not used')
        }),
        execute: async () => {
          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          const toolTimer = toolDebug.time(`getPageContext-${stepNum}`);
          
          toolDebug.debug('Starting getPageContext tool', { stepNum });
          
          // Push real-time step update with toolExecutions
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `🔍 **Step ${stepNum}: Analyzing Page**\n\nGathering page context (title, links, forms, viewport)...`,
            toolExecutions: [{
              toolName: 'getPageContext',
              status: 'in_progress',
              params: {},
              timestamp: Date.now(),
            }],
          });
          
          try {
            const res = await context.executeTool('getPageContext', {});
            const toolDuration = Date.now() - toolStartTime;
            toolTimer();
            
            toolDebug.info('Page context retrieved', {
              stepNum,
              duration: toolDuration,
              title: res?.title,
              url: res?.url,
              linkCount: res?.links?.length || 0,
              formCount: res?.forms?.length || 0,
            });
            execSteps.push({ 
              step: stepNum, 
              action: 'getPageContext', 
              url: res?.url, 
              success: true 
            });
            executionTrajectory.push({
              step: stepNum,
              action: 'getPageContext',
              url: res?.url,
              success: true,
              timestamp: Date.now(),
            });
            
            // Update with context summary
            const contextSummary = res?.title 
              ? `**Page:** ${res.title}\n**URL:** ${res.url}\n**Links:** ${res.links?.length || 0} found\n**Forms:** ${res.forms?.length || 0} found`
              : `**URL:** ${res?.url || 'unknown'}`;
            
            context.updateLastMessage((msg) => ({
              ...msg,
              content: `🔍 **Step ${stepNum}: Page Analysis Complete** ✅\n\n${contextSummary}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Using page context to determine next action.`,
              pageContext: res,
              toolExecutions: [{
                toolName: 'getPageContext',
                status: 'completed',
                params: {},
                result: res,
                duration: toolDuration,
                timestamp: Date.now(),
              }],
              executionTrajectory: executionTrajectory.slice(),
            }));
            
            return res;
          } catch (error: any) {
            const toolDuration = Date.now() - toolStartTime;
            toolTimer();
            try {
              toolDebug.error('getPageContext tool failed', error, toolDuration);
            } catch (logError) {
              console.error(`❌ [Tool: getPageContext] Debug logging failed:`, logError);
            }
            console.error(`❌ [Tool: getPageContext] Failed after ${toolDuration}ms:`, error?.message || error);
            throw error;
          }
        },
      }),
      click: tool({
        description: 'Click element. Provide EITHER selector (CSS) OR both x and y coordinates.',
        parameters: z.object({
          selector: z.string().optional().describe('CSS selector to click (e.g., "button.submit")'),
          x: z.number().optional().describe('X coordinate for position-based click'),
          y: z.number().optional().describe('Y coordinate for position-based click'),
        }),
        onInputStart: () => toolDebug.debug('click: input generation started'),
        onInputAvailable: ({ input }) => toolDebug.debug('click: complete input', { input }),
        execute: async ({ selector, x, y }: { selector?: string; x?: number; y?: number }) => {
          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          const target = selector ? `selector: ${selector}` : `coordinates: (${x}, ${y})`;
          const toolTimer = toolDebug.time(`click-${stepNum}`);
          
          toolDebug.debug('Starting click tool', {
            stepNum,
            selector,
            coordinates: { x, y },
            target,
          });
          
          // Push real-time step update
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `🖱️ **Step ${stepNum}: Clicking Element**\n\nTarget: ${target}\n**Reasoning:** Interacting with element to proceed...`,
          });
          
          try {
            const res = await context.executeTool('click', selector ? { selector } : { x, y });
            const enriched = await enrichToolResponse(res, 'click');
            const toolDuration = Date.now() - toolStartTime;
            toolTimer();
            
            toolDebug.info('Click tool completed', {
              stepNum,
              target,
              duration: toolDuration,
              success: enriched.success,
              url: enriched.url,
            });
            execSteps.push({ 
              step: stepNum, 
              action: 'click', 
              url: enriched.url, 
              success: enriched.success 
            });
            executionTrajectory.push({
              step: stepNum,
              action: 'click',
              url: enriched.url,
              success: enriched.success,
              timestamp: Date.now(),
            });
            
            // Update with success
            context.updateLastMessage((msg) => ({
              ...msg,
              content: `🖱️ **Step ${stepNum}: Click Executed** ✅\n\nSuccessfully clicked ${target}\n**New URL:** ${enriched.url}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Element clicked, page updated. Analyzing result...`,
            }));
            
            return enriched;
          } catch (error: any) {
            const toolDuration = Date.now() - toolStartTime;
            console.error(`❌ [Tool: click] Failed after ${toolDuration}ms:`, error?.message || error);
            throw error;
          }
        },
      }),
      type_text: tool({
        description: 'Type text into a focused input or by CSS selector; optionally press enter. Returns page context after typing.',
        parameters: z.object({ 
          selector: z.string().optional(), 
          text: z.string(), 
          press_enter: z.boolean().optional() 
        }),
        onInputStart: () => toolDebug.debug('type_text: input generation started'),
        onInputAvailable: ({ input }) => toolDebug.debug('type_text: complete input', { input }),
        execute: async ({ selector, text, press_enter }: { selector?: string; text: string; press_enter?: boolean }) => {
          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          const target = selector ? `selector: ${selector}` : 'focused element';
          const textPreview = text.substring(0, 50) + (text.length > 50 ? '...' : '');
          
          // Push real-time step update
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `⌨️ **Step ${stepNum}: Typing Text**\n\nText: "${textPreview}"\nTarget: ${target}${press_enter ? '\n**Action:** Will press Enter after typing' : ''}\n\n**Reasoning:** Entering input to interact with form/field...`,
          });
          
          try {
            const res = await context.executeTool('type', { selector, text });
            if (press_enter) {
              await context.executeTool('pressKey', { key: 'Enter' });
              await new Promise(r => setTimeout(r, 1500));
            }
            const enriched = await enrichToolResponse(res, 'type_text');
            const toolDuration = Date.now() - toolStartTime;
            execSteps.push({ 
              step: stepNum, 
              action: 'type_text', 
              url: enriched.url, 
              success: enriched.success 
            });
            executionTrajectory.push({
              step: stepNum,
              action: 'type_text',
              url: enriched.url,
              success: enriched.success,
              timestamp: Date.now(),
            });
            
            // Update with success
            context.updateLastMessage((msg) => ({
              ...msg,
              content: `⌨️ **Step ${stepNum}: Text Entered** ✅\n\nSuccessfully typed into ${target}${press_enter ? ' and pressed Enter' : ''}\n**URL:** ${enriched.url}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Input submitted, waiting for page response...`,
            }));
            
            return enriched;
          } catch (error: any) {
            const toolDuration = Date.now() - toolStartTime;
            console.error(`❌ [Tool: type_text] Failed after ${toolDuration}ms:`, error?.message || error);
            throw error;
          }
        },
      }),
      scroll: tool({
        description: 'Scroll page (up,down,top,bottom) or scroll element by selector. Returns page context after scroll.',
        parameters: z.object({ 
          direction: z.enum(['up','down','top','bottom']).optional(), 
          amount: z.number().optional(), 
          selector: z.string().optional() 
        }),
        execute: async ({ direction = 'down', amount = 500, selector }: { direction?: string; amount?: number; selector?: string }) => {
          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          const target = selector ? `element: ${selector}` : 'page';
          
          // Push real-time step update
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `📜 **Step ${stepNum}: Scrolling**\n\nDirection: ${direction}\nAmount: ${amount}px\nTarget: ${target}\n\n**Reasoning:** Scrolling to reveal more content...`,
          });
          
          try {
            const res = await context.executeTool('scroll', { direction, amount, selector });
            const enriched = await enrichToolResponse(res, 'scroll');
            const toolDuration = Date.now() - toolStartTime;
            execSteps.push({ 
              step: stepNum, 
              action: 'scroll', 
              url: enriched.url, 
              success: enriched.success 
            });
            executionTrajectory.push({
              step: stepNum,
              action: 'scroll',
              url: enriched.url,
              success: enriched.success,
              timestamp: Date.now(),
            });
            
            // Update with success
            context.updateLastMessage((msg) => ({
              ...msg,
              content: `📜 **Step ${stepNum}: Scroll Complete** ✅\n\nScrolled ${direction} ${amount}px on ${target}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Page scrolled, new content visible.`,
            }));
            
            return enriched;
          } catch (error: any) {
            const toolDuration = Date.now() - toolStartTime;
            console.error(`❌ [Tool: scroll] Failed after ${toolDuration}ms:`, error?.message || error);
            throw error;
          }
        },
      }),
      wait: tool({
        description: 'Wait for a number of seconds (max 60). Useful for waiting for dynamic content to load.',
        parameters: z.object({ seconds: z.number().min(0).max(60).default(1) }),
        execute: async ({ seconds }: { seconds: number }) => {
          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          
          // Push real-time step update
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `⏳ **Step ${stepNum}: Waiting**\n\nWaiting ${seconds} second(s) for page to load/update...\n\n**Reasoning:** Allowing time for dynamic content or page state changes.`,
          });
          
          try {
            // Show countdown for longer waits
            if (seconds > 2) {
              for (let i = seconds; i > 0; i--) {
                await new Promise(r => setTimeout(r, 1000));
                context.updateLastMessage((msg) => ({
                  ...msg,
                  content: `⏳ **Step ${stepNum}: Waiting** (${i}s remaining...)\n\nWaiting ${seconds} second(s) for page to load/update...`,
                }));
              }
            } else {
              await new Promise(r => setTimeout(r, seconds * 1000));
            }
            
            const { url } = await context.getPageContextAfterAction();
            const toolDuration = Date.now() - toolStartTime;
            execSteps.push({ 
              step: stepNum, 
              action: `wait_${seconds}s`, 
              url, 
              success: true 
            });
            executionTrajectory.push({
              step: stepNum,
              action: `wait_${seconds}s`,
              url,
              success: true,
              timestamp: Date.now(),
            });
            
            // Update with completion
            context.updateLastMessage((msg) => ({
              ...msg,
              content: `⏳ **Step ${stepNum}: Wait Complete** ✅\n\nWaited ${seconds} second(s)\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Wait period completed, proceeding with next action.`,
            }));
            
            return { success: true, waited: seconds };
          } catch (error: any) {
            const toolDuration = Date.now() - toolStartTime;
            console.error(`❌ [Tool: wait] Failed after ${toolDuration}ms:`, error?.message || error);
            throw error;
          }
        },
      }),
      press_key: tool({
        description: 'Press a single key (e.g., Enter, Tab, Escape). Returns page context after key press.',
        parameters: z.object({ key: z.string() }),
        execute: async ({ key }: { key: string }) => {
          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          
          // Push real-time step update
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `⌨️ **Step ${stepNum}: Pressing Key**\n\nKey: **${key}**\n\n**Reasoning:** Sending keyboard input to trigger action or navigation.`,
          });
          
          try {
            const res = await context.executeTool('pressKey', { key });
            const enriched = await enrichToolResponse(res, 'press_key');
            const toolDuration = Date.now() - toolStartTime;
            execSteps.push({ 
              step: stepNum, 
              action: `press_key:${key}`, 
              url: enriched.url, 
              success: enriched.success 
            });
            executionTrajectory.push({
              step: stepNum,
              action: `press_key:${key}`,
              url: enriched.url,
              success: enriched.success,
              timestamp: Date.now(),
            });
            
            // Update with success
            context.updateLastMessage((msg) => ({
              ...msg,
              content: `⌨️ **Step ${stepNum}: Key Pressed** ✅\n\nSuccessfully pressed **${key}**\n**URL:** ${enriched.url}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Key press executed, page may have updated.`,
            }));
            
            return enriched;
          } catch (error: any) {
            const toolDuration = Date.now() - toolStartTime;
            console.error(`❌ [Tool: press_key] Failed after ${toolDuration}ms:`, error?.message || error);
            throw error;
          }
        },
      }),
      key_combination: tool({
        description: 'Press a key combination, e.g., ["Control","A"]. Returns page context after combination.',
        parameters: z.object({ keys: z.array(z.string()).min(1) }),
        execute: async ({ keys }: { keys: string[] }) => {
          const toolStartTime = Date.now();
          const stepNum = execSteps.length + 1;
          const comboStr = keys.join('+');
          
          // Push real-time step update
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `⌨️ **Step ${stepNum}: Key Combination**\n\nKeys: **${comboStr}**\n\n**Reasoning:** Executing keyboard shortcut for advanced action.`,
          });
          
          try {
            const res = await context.executeTool('keyCombo', { keys });
            const enriched = await enrichToolResponse(res, 'key_combination');
            const toolDuration = Date.now() - toolStartTime;
            execSteps.push({ 
              step: stepNum, 
              action: `key_combo:${comboStr}`, 
              url: enriched.url, 
              success: enriched.success 
            });
            executionTrajectory.push({
              step: stepNum,
              action: `key_combo:${comboStr}`,
              url: enriched.url,
              success: enriched.success,
              timestamp: Date.now(),
            });
            
            // Update with success
            context.updateLastMessage((msg) => ({
              ...msg,
              content: `⌨️ **Step ${stepNum}: Key Combination Executed** ✅\n\nSuccessfully pressed **${comboStr}**\n**URL:** ${enriched.url}\n⏱️ Duration: ${toolDuration}ms\n\n**Reasoning:** Keyboard shortcut executed, checking result...`,
            }));
            
            return enriched;
          } catch (error: any) {
            const toolDuration = Date.now() - toolStartTime;
            console.error(`❌ [Tool: key_combination] Failed after ${toolDuration}ms:`, error?.message || error);
            throw error;
          }
        },
      }),
    } as const;
    
    // Validate tool schemas and log for debugging
    const toolNames = Object.keys(tools);
    for (const [toolName, toolDef] of Object.entries(tools)) {
      try {
        const schema = (toolDef as any).parameters;
        const schemaType = schema?._def?.typeName || 'unknown';
        // Shape can be a function (Zod) or an object - handle both
        const shape = typeof schema?._def?.shape === 'function' 
          ? schema._def.shape() 
          : schema?._def?.shape || {};
        const hasProps = Object.keys(shape).length;
        const isBedrockSafe = hasProps > 0 || !isAnthropicModel;
        if (isAnthropicModel && hasProps === 0) {
          console.warn(`   ⚠️ ${toolName}: Empty schema detected - provider-specific constraints may apply`);
        }
      } catch (e) {
        console.warn(`   - ${toolName}: schema validation failed:`, e);
      }
    }
    
    // Build system prompt with planning block
    // GEPA-optimized browser automation prompt with 63.3% tool accuracy & 70% parameter extraction
    // Achieved through systematic optimization targeting specific failure modes
    const systemLines = [
      '# Optimized Prompt v2 - GEPA Enhanced',
      '',
      'You are running within ChatGPT Atlas, a browser automation system that integrates AI directly into web browsing workflows. Your purpose is to accomplish user objectives through systematic, observable browser automation.',
      '',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '## CRITICAL: EXECUTION PROTOCOL',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '',
      '### Before Every Tool Call - MANDATORY CHECKS:',
      '',
      '1. **Parameter Verification Checklist**',
      '   - List ALL required parameters for the tool',
      '   - Extract each value from: user query, page context, or previous results',
      '   - If ANY parameter is missing/unclear: **STOP and ASK THE USER**',
      '   - **NEVER use placeholders, assumptions, or guesses**',
      '',
       '2. **Tool Selection Rules**',
       '   - **navigate**: Use ONLY for opening URLs (requires explicit URL)',
       '   - **click**: Use for clicking elements (requires selector from page context)',
       '   - **type_text**: Use for text input (requires selector + text content)',
       '   - **getPageContext**: Use for retrieving page information',
      '   - Verify the tool matches your EXACT current need',
      '   - Confirm you have the correct **selector format** (CSS/XPath from actual page)',
      '',
      '3. **Selector Validation** (CRITICAL - addressing low tool_accuracy)',
       '   - Selectors must come from ACTUAL page content (use getPageContext first if needed)',
      '   - Valid formats: CSS selectors (`.class`, `#id`, `tag[attr="value"]`) or XPath',
      '   - **NEVER invent selectors** - if you don\'t see the element, extract page structure first',
      '   - Test logic: "Can I see this exact selector in the page context? Yes → proceed, No → extract first"',
      '',
      '4. **Multi-Step Task Planning** (addressing low completeness)',
      '   - Break complex tasks into explicit sequential steps',
      '   - After each step: verify completion before proceeding',
      '   - For navigation paths (e.g., Home > Products > Category):',
      '     - Step 1: Navigate/click to first page',
      '     - Step 2: Extract available links/options',
      '     - Step 3: Click specific target',
      '     - Repeat until path complete',
      '',
      '5. **FORM HANDLING PROTOCOL** (CRITICAL - addressing form interaction failures)',
      '   **MANDATORY for form tasks:**',
      '   - Step 1: getPageContext() to identify all form fields',
      '   - Step 2: Verify form fields exist (input, select, textarea, button)',
      '   - Step 3: Use type_text() for each field with explicit selectors',
      '   - Step 4: Verify each field was filled (getPageContext() after each field)',
      '   - Step 5: Click submit button (or press_enter) to complete form',
      '   - Step 6: Verify form submission success (getPageContext() for confirmation)',
      '',
      '   **Form Field Detection Patterns:**',
      '   - Look for: input[type="text"], input[type="email"], textarea, select, button[type="submit"]',
      '   - Use CSS selectors: "input[name=\"fieldname\"]", "#field-id", ".form-field"',
      '   - Common form fields: name, email, username, password, message, subject, comments',
      '',
      '   **Form Submission Verification:**',
      '   - Success indicators: new page, success message, thank you page, form reset',
      '   - Failure indicators: error message, same page with validation errors',
      '   - Always follow form submission with getPageContext() to confirm result',
      '',
      '### Action Execution Pattern:',
      '```',
      '[ANALYZE] → [VERIFY PARAMETERS] → [SELECT CORRECT TOOL] → [VALIDATE SELECTOR] → [EXECUTE] → [CONFIRM RESULT]',
      '```',
      '',
      '**When in doubt: Extract page data first, act second.**',
      '',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '## FORM INTERACTION EXAMPLES',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '',
      '**Example 1: Contact Form**',
      '1. getPageContext() → Identify form fields',
      '2. type_text({ selector: "input[name=\"name\"]", text: "John Doe" })',
      '3. getPageContext() → Verify field filled',
      '4. type_text({ selector: "input[type=\"email\"]", text: "john@example.com" })',
      '5. type_text({ selector: "textarea[name=\"message\"]", text: "Hello, this is a test message" })',
      '6. click({ selector: "button[type=\"submit\"]" })',
      '7. getPageContext() → Verify form submitted successfully',
      '',
      '**Example 2: Login Form**',
      '1. getPageContext() → Find login form',
      '2. type_text({ selector: "input[name=\"username\"]", text: "testuser" })',
      '3. type_text({ selector: "input[name=\"password\"]", text: "password123", press_enter: true })',
      '4. getPageContext() → Verify login success (dashboard/redirect)',
      '',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '## EXECUTION PLAN (Pre-Generated)',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      planning.planningBlock || 'No detailed plan available - proceed adaptively.',
      '',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '## AVAILABLE TOOLS',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '',
      '**Navigation & Context:**',
      '- `navigate({ url: string })` - REQUIRED: url (must be valid URL starting with http:// or https://). Navigate to URL. Wait 2.5s for load. Returns page context.',
      '- `getPageContext()` - No required parameters. Get current page state (title, links, forms, viewport). CRITICAL for verification.',
      '',
      '**Interaction:**',
      '- `click({ selector?: string, x?: number, y?: number })` - REQUIRED: Either selector OR (x AND y). Click element by CSS selector OR coordinates.',
      '- `type_text({ text: string, selector?: string, press_enter?: boolean })` - REQUIRED: text. Optional: selector (if not provided, types into focused element), press_enter.',
      '',
      '**Page Manipulation:**',
      '- `scroll({ direction?: string, amount?: number, selector?: string })` - All parameters optional. Scroll page or element (up/down/top/bottom).',
      '- `wait({ seconds: number })` - REQUIRED: seconds (max 60). Wait for dynamic content.',
      '',
      '**Keyboard:**',
      '- `press_key({ key: string })` - REQUIRED: key (Enter, Tab, Escape, etc.). Press single key.',
      '- `key_combination({ keys: string[] })` - REQUIRED: keys (array of key names, e.g., ["Control","A"]). Press key combination.',
      '',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '## CRITICAL REQUIREMENTS',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '',
      '1. **Parameter Validation (CRITICAL):** Before calling ANY tool, extract ALL required parameters from the user query or execution plan. Missing required parameters cause immediate failure. Double-check parameter types and formats.',
      '2. **State Verification:** Every state-changing tool (navigate, click, type, scroll) must be followed by getPageContext().',
      '3. **Complete Execution:** Execute every plan step until the goal is fully achieved, then provide a final summary.',
      '4. **Error Recovery:** If a tool call fails due to missing parameters, extract the missing parameter from the user query/plan and retry with the complete parameter set.',
      '',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      '## INTERNAL REASONING',
      '═══════════════════════════════════════════════════════════════════════════════════════',
      'Reason through each step silently. Call tools directly using their functions with required parameters. Only emit a natural-language summary when the goal is complete.',
      '═══════════════════════════════════════════════════════════════════════════════════════',
    ];
    
    if (preSearchBlock) {
      systemLines.splice(systemLines.indexOf('WORKFLOW:') - 1, 0, '', 'ADDITIONAL CONTEXT:', preSearchBlock, '');
    }
    
    // Strengthen with Atlas-style guidance
    systemLines.unshift(
      'ROLE',
      'You are a browser automation agent. Execute the objective using the tool contract reliably and completely.',
      '',
      'ENVIRONMENT',
      '- Generic browser runtime exposed via tools; you must verify page state through getPageContext().',
      '- Think silently; do not reveal chain-of-thought. Output only natural-language updates and call tools.',
      '',
      'TOOLS (exact names)',
      '- navigate(url)',
      '- getPageContext()',
      '- click(selector|x,y)',
      '- type_text(text, selector?, press_enter?)',
      '- press_key(key)',
      '- scroll(direction|selector, amount?)',
      '- wait(seconds)',
      '- todo(tasks, request_user_approval?)',
      '- message_update(message, status, status_emoji)',
      '- follow_ups(attachment?, follow_ups_input? | follow_ups_select?)',
      '',
      '• todo — Maintain a visible task list and enforce one in_progress task',
      '  Recommended: create/update tasks at phase boundaries and when status changes',
      '  Best Practices: keep 4–6 discrete tasks; set exactly one to in_progress; mark completed immediately; set request_user_approval=true for risky steps',
      '',
      '• message_update — Provide concise status updates during long operations',
      '  Recommended: at key milestones (planning complete, navigation retries, extraction done)',
      '  Best Practices: 1–5 sentences; include status (5–15 words) and a single emoji',
      '',
      '• follow_ups — Present end-of-run options or questions',
      '  Recommended: at the end of execution to offer clear next actions or gather inputs',
      '  Best Practices: include 2–4 options (follow_ups_select) OR ≥2 questions (follow_ups_input); attach deliverables when relevant',
      '',
      'TOOL DETAILS',
      '• getPageContext — View current page content/state',
      '  Recommended: after any state change (navigate/click/type/scroll) to verify; to monitor progress indicators; when PDFs or dynamic content may require time to load',
      '  Best Practices: navigation usually returns context automatically; use repeatedly to monitor completion; if blank on PDFs/dynamic views, wait() briefly and call again',
      '',
      '• navigate — Open a URL or refresh',
      '  Recommended: when a new page is needed; when user or search provides a URL; to refresh current page',
      '  Best Practices: ensure full URL with protocol (https://); verify load via getPageContext (URL/title/visible markers)',
      '',
      '• click — Interact with elements',
      '  Recommended: to open links, submit forms, expand UI, activate controls',
      '  Best Practices: prefer CSS selector over coordinates; ensure element is visible/clickable via context; after click, verify via getPageContext',
      '',
      '• type_text — Enter text (optionally press Enter)',
      '  Recommended: fill inputs/search bars/forms; set field content',
      '  Best Practices: prefer selector; if needed, clear field first (e.g., key_combination(["Control","A"]) then press_key("Delete")); set press_enter when appropriate; verify via getPageContext',
      '',
      '• press_key — Simulate a key press',
      '  Recommended: submit forms (Enter), navigate focus (Tab), dismiss modals (Escape)',
      '  Best Practices: use standard key names; for combos use key_combination(["Control","A"]) etc.; verify effect via getPageContext',
      '',
      '• scroll — Move viewport or element',
      '  Recommended: reveal content above/below; trigger lazy loading; reach top/bottom',
      '  Best Practices: use direction ("up","down","top","bottom") or selector; small increments for discovery; verify newly loaded content via getPageContext',
      '',
      '• wait — Short pauses for dynamic content',
      '  Recommended: allow time for loads/transitions before verification',
      '  Best Practices: keep minimal (1–3s); always follow with getPageContext; avoid long idle waits',
      '',
      'EXECUTION LOOP',
      '- [ANALYZE] Read the instruction and current context',
      '- [PLAN] Select the next atomic action with explicit parameters',
      '- [ACT] Call the tool',
      '- [VERIFY] Confirm effect with getPageContext() or strict criteria',
      '- [ADAPT] If failed, change approach; do not repeat the same failing call',
      '- Continue until the user’s objective is satisfied',
      '',
      'PARAMETER VERIFICATION (before any tool call)',
      '- List ALL required parameters for the chosen tool',
      '- Extract each from user query, page context, or prior results',
      '- If ANY parameter is missing/unclear: STOP and ask the user to clarify',
      '- NEVER use placeholders or guessed values',
      '',
      'TOOL SELECTION RULES',
      '- navigate: open a URL (requires explicit URL)',
      '- click: interact with elements (requires a selector or coordinates)',
      '- type_text: input text (requires selector + text; optional press_enter)',
      '- getPageContext: read the current page state (use to verify or discover selectors)',
      '- scroll: move page/element viewport (direction or selector + amount)',
      '- wait: small delays when necessary (seconds)',
      '',
      'SELECTOR VALIDATION (critical)',
      '- Selectors must come from ACTUAL page content (use getPageContext first if needed)',
      '- Prefer stable CSS selectors (role/label/attributes) over brittle coordinates',
      '- NEVER invent selectors; if not visible in context, extract first',
      '',
      'MULTI-STEP TASKS',
      '- Break into sequential steps with verification after each state change',
      '- For navigation paths: navigate/click → getPageContext → choose next link/element → repeat',
      '',
      'FINALIZATION GATE',
      '- Do NOT produce a final natural-language answer or declare completion. The summarizer produces the final report.',
      '- You may stop only if: (a) you have executed getPageContext at least once after the latest navigation and collected content needed to satisfy the objective but are blocked from further progress; or (b) the objective is ambiguous and cannot be advanced — in that case, ask one concise clarifying question.',
      "- The phrase 'Browser automation tasks completed.' is disallowed.",
      '',
      'MINIMUM ACTION SEQUENCE (Information-Seeking Objectives)',
      '- If the objective is to find/identify/summarize information: interact if possible (type_text query, press_key Enter), then getPageContext and evaluate, click a relevant element, and getPageContext again. Continue until evidence is gathered or a clarification is necessary.',
      '',
      'COMPLETION TRANSFER',
      '- Do not summarize outcomes. Provide short operational updates only (e.g., typing query, clicking result, verifying).',
      '',
      'ANTI-REPETITION',
      '- Do not repeat the same failing call. Adapt (alternate selector/flow) or ask a concise clarifying question if truly blocked.',
      '',
      'EVIDENCE DISCIPLINE',
      '- Base next actions on verified page context. Never invent selectors or assume state without verification.',
      '',
      'VERIFICATION',
      '- Every state-changing action must be followed by verification prior to proceeding.',
      '- Prefer semantic signals (URL change, visible elements, content present).',
      '',
      'SAFETY & NON-DISCLOSURE',
      '- Do not output internal reasoning. Be concise and factual.',
      '- Do not hallucinate page content; rely on verified context only.',
    );

    // Attach global system addendum (communication, policies, best practices)
    try {
      const { renderAddendum } = await import('../lib/system-addendum');
      const addendum = renderAddendum('ADDENDUM');
      systemLines.push('', addendum, '');
    } catch (_) {}

    const system = systemLines.filter(Boolean).join('\n');
    
    // Messages are already initialized earlier in the workflow (line ~143)
    // Just validate they exist and have content before streaming
    if (!messages || messages.length === 0) {
      throw new Error('Messages array is empty or undefined - cannot stream without user query');
    }
    
    // Ensure at least one user message exists
    const hasUserMessage = messages.some(m => m.role === 'user');
    if (!hasUserMessage) {
      messages.unshift({
        id: Date.now().toString(),
        role: 'user',
        content: input.userQuery,
      });
    }
    
// ============================================
// PHASE 5: Streaming Step (Main Execution with AI SDK Agent)
// ============================================
    console.log('🎯 [WORKFLOW] Entering PHASE 5: Streaming Step');
    console.log('🤖 [WORKFLOW] Using AI SDK 6 Agent for agentic execution with tool calls');
     console.log('🤖 [WORKFLOW] Agent features: dynamic model selection, smart stop conditions, performance monitoring');
      
      logStepProgress('browser_automation_workflow', 5, {
        phase: 'streaming',
        action: 'starting_main_execution',
        messages_count: agentMessages.length,
      });
    
    // Final validation before streaming
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('❌ [Workflow] Messages validation failed:', {
        messages: messages,
        type: typeof messages,
        isArray: Array.isArray(messages),
        length: messages?.length,
      });
      throw new Error(`Messages validation failed - expected array with length > 0, got: ${messages === undefined ? 'undefined' : messages === null ? 'null' : JSON.stringify(messages)}`);
    }
    
    console.log(`✅ [WORKFLOW] Messages validated - ${messages.length} message(s), ready for AI agent execution`);
    
    // Mark execution as in progress when streaming starts
    updateWorkflowTasks('execute', 'in_progress', 'Executing browser actions...');

    console.log('🚀 [WORKFLOW] About to call streaming step', {
      execStepsCount: execSteps.length,
      execSteps: execSteps.map(s => ({ step: s.step, action: s.action, url: s.url })),
      agentMessagesCount: agentMessages.length,
    });

    console.log('🔍 [WORKFLOW] Pre-streaming validation checks:');
    console.log('  - execSteps populated:', execSteps.length > 0);
    console.log('  - agentMessages exist:', !!agentMessages);
    console.log('  - agentMessages length:', agentMessages.length);
    console.log('  - model exists:', !!model);
    console.log('  - system exists:', !!system);
    console.log('  - tools exist:', !!tools);
    console.log('  - updateLastMessage exists:', typeof context.updateLastMessage);
    console.log('  - pushMessage exists:', typeof context.pushMessage);
    console.log('  - abortSignal exists:', !!context.abortSignal);

    console.log('🎯 [WORKFLOW] REACHED STREAMING STEP CALL - EXECUTING NOW');
    console.log('🚀 [WORKFLOW] About to call streamingStep with parameters:', {
      hasModel: !!model,
      hasSystem: !!system,
      hasTools: !!tools,
      hasAgentMessages: !!agentMessages,
      agentMessagesLength: agentMessages?.length || 0,
      hasExecSteps: !!execSteps,
      execStepsLength: execSteps?.length || 0,
      hasUpdateLastMessage: typeof context.updateLastMessage === 'function',
      hasPushMessage: typeof context.pushMessage === 'function',
      hasAbortSignal: !!context.abortSignal,
    });

    const streaming = await streamingStep({
      model,
      system,
      tools: tools as any,
      messages: agentMessages, // Use execution-augmented messages for the agent
      execSteps,
      updateLastMessage: context.updateLastMessage,
      pushMessage: context.pushMessage,
      executeTool: context.executeTool,
      abortSignal: context.abortSignal,
    });
    console.log('🎯 [WORKFLOW] STREAMING STEP COMPLETED');
    console.log('✅ [WORKFLOW] Streaming step returned:', {
      hasStreamingResult: !!streaming,
      streamingType: typeof streaming,
      hasFullText: !!streaming?.fullText,
      fullTextLength: streaming?.fullText?.length || 0,
      toolCallCount: streaming?.toolCallCount || 0,
      finishReason: streaming?.finishReason,
      executionStepsCount: streaming?.executionSteps?.length || 0,
    });

    // Update execSteps with results from streaming step
    if (streaming?.executionSteps && streaming.executionSteps.length > 0) {
      console.log('📋 [WORKFLOW] Updating execSteps with streaming results');
      // Replace execSteps with the updated versions from streaming
      execSteps.length = 0; // Clear the array
      execSteps.push(...streaming.executionSteps);
      console.log('📋 [WORKFLOW] execSteps updated:', execSteps.map(s => ({ step: s.step, action: s.action, success: s.success })));
    }

    // If the agent failed to verify context after navigation, re-run with a continuation message
    try {
      const actions = execSteps.map(s => s.action.split(':')[0]);
      const lastNavIdx = actions.lastIndexOf('navigate');
      const hasContextAfterNav = lastNavIdx >= 0 && actions.slice(lastNavIdx + 1).includes('getPageContext');

      // Also catch trivial flows with only navigate
      const trivial = execSteps.length <= 2 && new Set(actions).size <= 2 && actions.includes('navigate');

      if (!hasContextAfterNav || trivial) {
        console.log('🧭 [WORKFLOW] Continuation enforcement activated (agent re-run)');
        const continuationMessage = {
          id: `continue-${Date.now()}`,
          role: 'user' as const,
          content: [
            '[CONTINUE_EXECUTION]',
            '',
            'Continue execution to complete the objective:',
            '- Immediately verify with getPageContext().',
            '- If the goal is information-seeking and an input field is present: type_text the query, press_key Enter, getPageContext, click a relevant result, then getPageContext again.',
            '- After each state-changing action, verify with getPageContext().',
            '- Do not summarize or declare completion; provide short operational updates only.',
          ].join('\n'),
        };

        const agentMessages2 = [...agentMessages, continuationMessage];
        const streaming2 = await streamingStep({
          model,
          system,
          tools: tools as any,
          messages: agentMessages2,
          execSteps,
          updateLastMessage: context.updateLastMessage,
          pushMessage: context.pushMessage,
          executeTool: context.executeTool,
          abortSignal: context.abortSignal,
        });

        if (streaming2?.executionSteps && streaming2.executionSteps.length > 0) {
          execSteps.length = 0;
          execSteps.push(...streaming2.executionSteps);
          console.log('📋 [WORKFLOW] execSteps updated after continuation:', execSteps.map(s => ({ step: s.step, action: s.action, success: s.success })));
        }
      }
    } catch (continuationError) {
      console.warn('⚠️ [WORKFLOW] Agent continuation re-run failed', continuationError);
    }

    // Programmatic progression fallback for information-seeking queries
    // If we are on a search results page but the agent did not open any external result,
    // proactively navigate to a likely relevant link from page context.
    try {
      const infoQuery = isInfoQuery(input.userQuery) || /\b(news|latest|breaking)\b/i.test(input.userQuery);
      const lastCtx = await context.getPageContextAfterAction().catch(() => null as any);
      const currentUrl = lastCtx?.url || '';
      const onSearchPage = /google\.com\/search|news\.google\.com\/search/i.test(currentUrl);

      const visitedExternal = execSteps.some((s) => s.action === 'navigate' && s.url && !/google\.com/i.test(s.url));

      if (infoQuery && onSearchPage && !visitedExternal) {
        const links: Array<{ text?: string; href?: string }> = (lastCtx?.links || []) as any;
        const candidates = links
          .map((l) => l?.href || '')
          .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
          .filter((u) => !/google\.(com|[a-z]+)/i.test(u) && !/accounts\.google/i.test(u) && !/webhp\?hl=/i.test(u));

        // Prefer well-known news domains or any first external link
        const newsPriority = [
          'news.google.com', 'cnn.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com', 'reuters.com', 'apnews.com', 'theguardian.com', 'latimes.com', 'wsj.com', 'npr.org'
        ];
        const pick = candidates.find((u) => newsPriority.some((d) => u.includes(d))) || candidates[0];

        if (pick) {
          const stepNum = execSteps.length + 1;
          context.pushMessage({
            id: `step-${stepNum}-${Date.now()}`,
            role: 'assistant',
            content: `🔗 **Step ${stepNum}: Opening Result**\n\nNavigating to: ${pick}`,
          });

          const navRes = await context.executeTool('navigate', { url: pick });
          const enriched = await enrichToolResponse(navRes, 'navigate');
          execSteps.push({ step: stepNum, action: 'navigate', url: enriched.url || pick, success: enriched.success });
          executionTrajectory.push({ step: stepNum, action: 'navigate', url: enriched.url || pick, success: enriched.success, timestamp: Date.now() });

          context.updateLastMessage((msg) => ({
            ...msg,
            content: `🔗 **Step ${stepNum}: Result Opened** ✅\n\nURL: ${enriched.url || pick}`,
            pageContext: enriched.pageContext,
            executionTrajectory: executionTrajectory.slice(),
          }));
        }
      }
    } catch (progError) {
      console.warn('⚠️ [WORKFLOW] Programmatic progression fallback failed', (progError as any)?.message || String(progError));
    }

// ============================================
     // PHASE 5.5: Result Aggregation & Evaluation (Before Summarization)
     // ============================================
     logStepProgress('browser_automation_workflow', 5.5, {
       phase: 'result_aggregation_and_evaluation',
       action: 'aggregating_and_evaluating_results',
     });
     
     // Aggregate streaming step results for better summarization
     let aggregatedResult: any = null;
     let finalEvaluation: any = null;
     
     try {
       aggregatedResult = await aggregateExecutionResults(
         execSteps.map((step, idx) => ({
           step: idx + 1,
           text: `Step ${idx + 1}: ${step.action}${step.url ? ` at ${step.url}` : ''}`,
           tool: step.action.split(':')[0] || step.action,
           success: step.success,
           duration: 0,
         }))
       );
       
       // Evaluate final result quality
       finalEvaluation = await evaluateFinalResult(
         input.userQuery,
         {
           text: streaming.fullText || '',
           toolCalls: streaming.toolCallCount,
           success: streaming.finishReason !== 'error',
           steps: streaming.toolCallCount,
         }
       );
       
       // Log evaluation results
       if (finalEvaluation.shouldImprove) {
         logEvent('result_quality_improvement_needed', {
           evaluation_score: finalEvaluation.evaluation.completeness,
           suggestions: finalEvaluation.improvementSuggestions,
         });
       } else {
         logEvent('result_quality_passed', {
           evaluation: finalEvaluation.evaluation,
         });
       }
     } catch (aggregationError: any) {
       // Non-fatal - continue to summarization
       logEvent('result_aggregation_error', {
         error: aggregationError?.message,
         continuing: true,
       });
     }
    
    // ============================================
    // Calculate workflow metrics early (needed for summarization metadata)
    // ============================================
    const totalDuration = Date.now() - workflowStartTime;
    const finalUrl = execSteps.length > 0 
      ? execSteps[execSteps.length - 1]?.url 
      : (pageContext?.pageContext?.url || 'unknown');

    // ============================================
    // PHASE 5.75: Trajectory Diagnostics & Decision Gate
    // ============================================
    const failedSteps = execSteps.filter((step) => !step.success);
    const hasFailedSteps = failedSteps.length > 0;
    const streamingErrored = streaming.finishReason === 'error';
    const evaluationSuggestsImprove = finalEvaluation?.shouldImprove === true;
    const shouldAttemptDiagnostics = execSteps.length > 0;
    const needsRecovery = hasFailedSteps || streamingErrored || evaluationSuggestsImprove;

    if (shouldAttemptDiagnostics) {
      updateWorkflowTasks('analyze', 'in_progress', 'Reviewing execution trajectory...');
      logStepProgress('browser_automation_workflow', 5.75, {
        phase: 'trajectory_analysis',
        action: 'diagnosing_execution',
        has_failed_steps: hasFailedSteps,
        streaming_error: streamingErrored,
        evaluation_suggests_improve: evaluationSuggestsImprove,
      });

      if (needsRecovery) {

        const diaryContext = execSteps.map((step, idx) => {
          const statusText = step.success ? 'succeeded.' : `failed${step.error ? `: ${step.error}` : '.'}`;
          const detailParts: string[] = [];
          if (step.url) detailParts.push(`URL: ${step.url}`);
          if ((step as any).target) detailParts.push(`Target: ${(step as any).target}`);
          return `At step ${idx + 1}, you executed **${step.action}**. It ${statusText}${detailParts.length ? ` (${detailParts.join(' | ')})` : ''}`;
        });
        if (streamingErrored) {
          diaryContext.push('The streaming response ended with an error before completion.');
        }

        const evaluatorFeedback = finalEvaluation?.improvementSuggestions?.length
          ? finalEvaluation.improvementSuggestions.join('; ')
          : streamingErrored
            ? 'Streaming ended with an error before the agent produced a final response.'
            : undefined;

        if (input.settings.apiKey) {
          try {
            const { analyzeExecutionFailure } = await import('../lib/error-analyzer');
            workflowErrorAnalysis = await analyzeExecutionFailure(
              diaryContext,
              input.userQuery,
              streaming.fullText || '(No assistant response captured)',
              evaluatorFeedback,
              {
                provider: input.settings.provider,
                apiKey: input.settings.apiKey,
                model: input.settings.model,
                braintrustApiKey: input.settings.braintrustApiKey,
              }
            );
          } catch (analysisError: any) {
            workflowDebug.warn('Error analysis failed', analysisError);
            const fallbackImprovements = finalEvaluation?.improvementSuggestions?.length
              ? finalEvaluation.improvementSuggestions.map((suggestion: string, idx: number) => `${idx + 1}. ${suggestion}`).join('\n')
              : '1. Review the execution trajectory and retry the unresolved steps.';

            workflowErrorAnalysis = {
              recap: `Execution completed with ${execSteps.length} step(s); ${failedSteps.length} reported failure(s).`,
              blame: analysisError?.message
                ? `Automatic analysis failed: ${analysisError.message}`
                : 'Automatic analysis failed before identifying a root cause.',
              improvement: fallbackImprovements,
            };
          }
        } else {
          const fallbackImprovements = finalEvaluation?.improvementSuggestions?.length
            ? finalEvaluation.improvementSuggestions.map((suggestion: string, idx: number) => `${idx + 1}. ${suggestion}`).join('\n')
            : '1. Review the execution trajectory and retry the unresolved steps.';

          workflowErrorAnalysis = {
            recap: `Execution completed with ${execSteps.length} step(s); ${failedSteps.length} reported failure(s).`,
            blame: 'Automated diagnostics skipped because no API key was available for the analyzer.',
            improvement: fallbackImprovements,
          };
        }

        updateWorkflowTasks('analyze', 'completed', 'Issues detected – review diagnostics');
        const diagnosticsLines: string[] = [
          '---',
          '## Workflow Diagnostics',
          '',
          '**Status:** Recovery cycle triggered — agent preparing adjustments',
          '',
        ];

        if (workflowErrorAnalysis) {
          diagnosticsLines.push(
            '### Recap',
            workflowErrorAnalysis.recap,
            '',
            '### Root Cause',
            workflowErrorAnalysis.blame,
            '',
            '### Recommended Next Actions',
            workflowErrorAnalysis.improvement,
            ''
          );
        } else {
          diagnosticsLines.push(
            'Automated diagnostics were unavailable. Review the execution log and rerun the unresolved steps.',
            ''
          );
        }

        if (finalEvaluation?.improvementSuggestions?.length) {
          diagnosticsLines.push(
            'Additional evaluator feedback:',
            finalEvaluation.improvementSuggestions.map((suggestion: string, idx: number) => `${idx + 1}. ${suggestion}`).join('\n'),
            ''
          );
        }

        if (!hasYouApiKey) {
          diagnosticsLines.push(
            '_Web search summarization is disabled (API key not configured)._',
            ''
          );
        }

        diagnosticsLines.push(
          'The agent will apply these corrections automatically before continuing execution.'
        );

        const diagnosticsContent = diagnosticsLines.join('\n').trim();

        context.pushMessage({
          id: `diagnostics-${Date.now()}`,
          role: 'assistant',
          content: diagnosticsContent,
          workflowTasks: convertLegacyTasks(taskManager.getAllTasks()),
          executionTrajectory: executionTrajectory.slice(),
          workflowMetadata: {
            workflowId,
            conversationId: input.metadata?.conversationId,
            totalDuration,
            finalUrl,
          },
        });

        logEvent('browser_automation_workflow_diagnostics', {
          workflow_id: workflowId,
          has_failed_steps: hasFailedSteps,
          streaming_error: streamingErrored,
          evaluation_suggests_improve: evaluationSuggestsImprove,
          improvement_suggestions: finalEvaluation?.improvementSuggestions,
        });
      } else {
        updateWorkflowTasks('analyze', 'completed', 'Trajectory looks healthy');
      }
    } else {
      updateWorkflowTasks('analyze', 'completed', 'No tool executions to analyze');
    }

    // ============================================
    // PHASE 6: Summarization Step (AI SDK with Web Search)
    // ============================================
    let summarization: SummarizationStepOutput | undefined;
      console.log('📊 [SUMMARIZATION] Using AI SDK 6 with agentic reasoning for result analysis');
      if (hasYouApiKey) {
        console.log('🌐 [SUMMARIZATION] Web search ENABLED - using provider for enhanced context');
      } else {
        console.log('💡 [SUMMARIZATION] Running without web search (add a web search API key for enhanced analysis)');
      }
     
       workflowDebug.info('Starting summarization phase', {
         hasYouApiKey: !!input.settings.youApiKey,
         stepCount: execSteps.length,
         useAiSdk: true,
         useWebSearch: hasYouApiKey,
       });
     
       logStepProgress('browser_automation_workflow', 6, {
         phase: 'summarization',
         action: 'generating_summary',
         has_you_api_key: !!input.settings.youApiKey,
         use_ai_sdk: true,
         use_web_search: hasYouApiKey,
       });
      // Always attempt summarization - use web search if available, fallback to main AI model
      try {
        const objective = context.messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
        const trajectory = execSteps.slice(-50).map(s => 
          `- step ${s.step}: ${s.action}${s.url ? ` @ ${s.url}` : ''} ${s.success ? '(ok)' : '(failed)'}`
        ).join('\n') || '- (no actions executed)';
        // Use execution trajectory as outcome since streaming may not capture full results
        const outcome = execSteps.length > 0
          ? execSteps.map(step =>
              `Step ${step.step}: ${step.action}${step.url ? ` → ${step.url}` : ''} (${step.success ? 'SUCCESS' : 'FAILED'})`
            ).join('\n')
          : (streaming.fullText?.substring(0, 1500) || '');
      
        workflowDebug.debug('Summarization inputs prepared', {
          objectiveLength: objective.length,
          trajectoryLength: trajectory.length,
          outcomeLength: outcome.length,
          stepCount: execSteps.length,
        });
      
        // Create initial summary message for streaming (if enabled)
        const summaryMessageId = (Date.now() + 2).toString();
        const shouldStream = !!(input.settings.youApiKey && context.updateLastMessage);

        if (shouldStream) {
          context.pushMessage({
            id: summaryMessageId,
            role: 'assistant',
            content: '---\n## Summary & Next Steps\n\n*Generating summary...*',
          });
        }
      
        workflowDebug.debug('Loading cached summarization function');
      
        // Use cached summarization for better performance
        const cacheModule = await import('../lib/cache-utils');
        const cachedSummarizationRaw = cacheModule?.summarizationStepCached;
        const cachedSummarizationFn = typeof cachedSummarizationRaw === 'function'
          ? cachedSummarizationRaw
          : cachedSummarizationRaw?.execute?.bind(cachedSummarizationRaw);
      
        workflowDebug.debug('Calling cached summarization', {
          hasCachedFunction: !!cachedSummarizationRaw,
          hasExecutableFunction: !!cachedSummarizationFn,
          shouldStream,
          rawType: typeof cachedSummarizationRaw,
        });

        if (!cachedSummarizationFn) {
          workflowDebug.warn('Cached summarization function unavailable - falling back to direct step execution');
        }

        // Add timeout wrapper to prevent hanging (10 seconds max - aggressive timeout)
        const summarizationWithTimeout = async (fn: () => Promise<any>, timeoutMs = 10000) => {
          return Promise.race([
            fn(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Summarization timed out after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);
        };
      
         // Mark summarization as in progress
         taskManager.startTask('summarize');

        const summarizationParams = {
          objective,
          trajectory,
          outcome,
          youApiKey: input.settings.youApiKey || '', // Use empty string if not available - fallback will handle it
          // Provide fallback model and API key for when web search fails
          fallbackModel: model || createOpenAI({ apiKey: input.settings.apiKey })('gpt-4o-mini'),
          fallbackApiKey: input.settings.apiKey,
          // Enable streaming for real-time UI updates
          enableStreaming: shouldStream,
          updateLastMessage: shouldStream ? context.updateLastMessage : undefined,
          // Disable finalization by default to reduce latency (can be re-enabled if needed)
          enableFinalization: false, // Disabled to prevent exponential latency
          finalizationProvider: input.settings.provider,
          finalizationModel: input.settings.model,
          knowledgeItems: execSteps.slice(-20).map(step => ({
            title: `Step ${step.step}: ${step.action}`,
            content: step.url || step.target || '',
            url: step.url,
          })),
          diagnostics: needsRecovery ? {
            errorAnalysis: workflowErrorAnalysis,
            evaluation: finalEvaluation,
          } : undefined,
        };

        let cachedSummaryResult: SummarizationStepOutput;
      
        try {
          if (cachedSummarizationFn) {
            workflowDebug.debug('Executing cached summarization function');
            cachedSummaryResult = await summarizationWithTimeout(
              () => cachedSummarizationFn(summarizationParams) as Promise<SummarizationStepOutput>
            ) as SummarizationStepOutput;
          } else {
            workflowDebug.debug('Executing summarization step directly (no cache)');
            const { summarizationStep } = await import('../steps/summarization-step');
            cachedSummaryResult = await summarizationWithTimeout(
              () => summarizationStep(summarizationParams)
            ) as SummarizationStepOutput;
          }
        } catch (timeoutError: any) {
          workflowDebug.error('Summarization timed out or failed', {
            error: timeoutError?.message,
            errorType: timeoutError?.name,
          });
        
           // Mark summarization as error
           taskManager.failTask('summarize', 'Timed out after 10s');
        
          // Return a meaningful summary even when advanced summarization fails
          const lastStep = execSteps[execSteps.length - 1];
          const finalUrl = lastStep?.url || 'Unknown';
          const successfulSteps = execSteps.filter(s => s.success).length;

          cachedSummaryResult = {
            summary: `## Summary\n\n✅ **Execution completed successfully**\n\n**Steps executed**: ${execSteps.length} (${successfulSteps} successful)\n**Final URL**: ${finalUrl}\n**Total duration**: ${(totalDuration / 1000).toFixed(1)}s\n\n### Execution Trajectory\n${execSteps.slice(-10).map(s => `- **Step ${s.step}**: ${s.action}${s.url ? ` → ${s.url}` : ''} ${s.success ? '✅' : '❌'}`).join('\n')}\n\n### Next Steps\n1. **Review results**: Check if the objective was achieved\n2. **Refine approach**: Adjust strategy based on execution results\n3. **Add monitoring**: Consider adding error handling for similar tasks\n\n*Note: Advanced AI-powered summary not available (You.com API key not configured).*`,
            duration: 10000, // Timeout duration (reduced from 30s)
            success: true, // Mark as successful since execution completed
            taskCompleted: execSteps.every(s => s.success) && (finalEvaluation?.shouldImprove !== true),
            trajectoryLength: trajectory.length,
            stepCount: execSteps.length,
          };
        }

         // Cast the cached result to the expected type
         summarization = cachedSummaryResult as SummarizationStepOutput;

         if (!summarization.summary || summarization.summary.trim().length === 0) {
           const successSteps = execSteps.filter((s) => s.success).length;
           const lastStep = execSteps[execSteps.length - 1];
           const fallbackSummaryLines = [
             '## Summary',
             `- Executed ${execSteps.length} step${execSteps.length === 1 ? '' : 's'} (${successSteps} succeeded).`,
             finalUrl ? `- Final URL visited: ${finalUrl}` : '- Final URL could not be determined.',
             lastStep
               ? `- Last action: ${lastStep.action}${lastStep.url ? ` @ ${lastStep.url}` : ''} ${lastStep.success ? '(succeeded)' : '(failed)'}.`
               : '- No browser actions were executed.',
             '',
             '## Goal Assessment',
             input.settings.youApiKey
               ? '- Automatic summarizer produced no prose. Review the execution trajectory above.'
               : '- Web search summarization is unavailable without a You.com API key. Showing an execution recap instead.',
             '',
             '## Suggested Next Actions',
             '1. Review the execution trajectory for additional context.',
             input.settings.youApiKey
               ? '2. Re-run the workflow if more detail is required or adjust your instructions.'
               : '2. Add a You.com API key in settings to enable richer summarization with web search.',
             '3. Manually verify the results in the browser tab or continue automation as needed.',
           ];

          summarization = {
            ...summarization,
            summary: fallbackSummaryLines.join('\n'),
            success: false,
            taskCompleted: false,
          } as any;
         }

        let summaryContent = summarization.summary;
        if (needsRecovery) {
          const recoveryLines: string[] = [
            '---',
            '## Self-Recovery Plan',
            '',
          ];

          if (workflowErrorAnalysis) {
            recoveryLines.push(
              `**Diagnosed Issue:** ${workflowErrorAnalysis.blame}`,
              '',
              '**Recap:**',
              workflowErrorAnalysis.recap,
              '',
              '**Recommended Actions:**',
              workflowErrorAnalysis.improvement
            );
          } else {
            recoveryLines.push('Automated diagnostics ran, but no specific root cause was captured.');
          }

          if (finalEvaluation?.improvementSuggestions?.length) {
            recoveryLines.push(
              '',
              '**Evaluator Suggestions:**',
              finalEvaluation.improvementSuggestions.map((suggestion: string, idx: number) => `${idx + 1}. ${suggestion}`).join('\n')
            );
          }

          recoveryLines.push(
            '',
            '✅ The agent will iterate automatically using these adjustments in the next execution cycle.'
          );

          summaryContent = [summarization.summary.trim(), recoveryLines.join('\n')].filter(Boolean).join('\n\n');
          summarization = {
            ...summarization,
            summary: summaryContent,
          };
        }

         workflowDebug.info('Summarization completed', {
           success: summarization.success,
           hasSummary: !!summarization.summary,
           summaryLength: summarization.summary?.length || 0,
           duration: summarization.duration,
           hasError: !!summarization.error,
         });

          // Mark summarization as completed (or error if failed)
          if (summarization.success) {
            taskManager.completeTask('summarize', `Generated in ${(summarization.duration / 1000).toFixed(1)}s`);
          } else {
            taskManager.failTask('summarize', 'Summary generation failed');
          }

          // Mark execution as completed
          taskManager.completeTask('execute', `${execSteps.length} step(s) executed`);
       
         if (summarization.success && summarization.summary?.trim()) {
           workflowDebug.debug('Displaying summarization results', {
             shouldStream,
             summaryLength: summarization.summary.length,
           });
        
          // Get final page context for summary message and normalize URL
          const finalPageContextRaw = await context.getPageContextAfterAction().catch(() => null);
          const normalizedPageContext = (finalPageContextRaw && finalPageContextRaw.url)
            ? finalPageContextRaw
            : finalPageContextRaw
              ? { ...finalPageContextRaw, url: finalUrl }
              : {
                  url: finalUrl,
                  title: '',
                  textContent: '',
                  links: [],
                  images: [],
                  forms: [],
                  metadata: {},
                  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
                };

          // If streaming was used, the content was already updated in real-time
          // We just need to add the artifacts (summarization, trajectory, pageContext, metadata)
          if (shouldStream && context.updateLastMessage) {
            // Streaming path: add artifacts without changing content (already streamed)
            context.updateLastMessage((msg: any) => {
              const shouldUpdateContent = msg.content.includes('*Generating summary...*');
              return {
                ...msg,
                content: shouldUpdateContent
                  ? `---\n## Summary & Next Steps\n\n${summaryContent}`
                  : msg.content,
                summarization,
                executionTrajectory: executionTrajectory.slice(),
                pageContext: normalizedPageContext,
                workflowMetadata: {
                  workflowId,
                  conversationId: input.metadata?.conversationId,
                  totalDuration,
                  finalUrl,
                },
                workflowTasks: convertLegacyTasks(taskManager.getAllTasks()),
              };
            });
          } else {
            // Non-streaming path: push complete message with all artifacts
            context.pushMessage({
              id: summaryMessageId,
              role: 'assistant',
              content: `---\n## Summary & Next Steps\n\n${summaryContent}`,
              summarization,
              executionTrajectory: executionTrajectory.slice(),
              pageContext: normalizedPageContext,
              workflowMetadata: {
                workflowId,
                conversationId: input.metadata?.conversationId,
                totalDuration,
                finalUrl,
              },
              workflowTasks: convertLegacyTasks(taskManager.getAllTasks()),
            });
          }
        } else {
          workflowDebug.warn('Summarization failed or empty', {
            success: summarization?.success,
            hasSummary: !!summarization?.summary,
            error: summarization?.error,
          });
        
          // Remove placeholder if summarization failed
          if (shouldStream && context.updateLastMessage) {
            context.updateLastMessage((msg: any) => ({
              ...msg,
              content: msg.content.replace('*Generating summary...*', '*Summary generation failed*'),
            }));
          }
        }

        // Decision gate: If the summarizer determined the task was NOT completed,
        // automatically re-route to the browser agent for a full end-to-end retry
        // with feedback and context from the last run. Guard to one attempt per call.
        try {
          const shouldAutoRetry = Boolean(
            summarization &&
            (summarization as any).taskCompleted === false &&
            !input.userQuery.includes('[AUTO-RETRY]')
          );

          if (shouldAutoRetry) {
            workflowDebug.info('Auto-recovery triggered: rerouting to browser agent with improved query', {
              taskCompleted: (summarization as any).taskCompleted,
            });

            // Build a refined query via the dedicated recovery agent
            const { buildRecoveryQuery } = await import('../lib/retry-agent');
            // Reuse the already-initialized provider-specific model to avoid API mismatch
            const recoveryModel = model;

            // Get a fresh, normalized page context snapshot to seed the next run
            const finalPageContextRaw = await context.getPageContextAfterAction().catch(() => null);
            const normalizedPageContext = (finalPageContextRaw && finalPageContextRaw.url)
              ? finalPageContextRaw
              : finalPageContextRaw
                ? { ...finalPageContextRaw, url: finalUrl }
                : {
                    url: finalUrl,
                    title: '',
                    textContent: '',
                    links: [],
                    images: [],
                    forms: [],
                    metadata: {},
                    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
                  };

            const recovery = await buildRecoveryQuery({
              provider: input.settings.provider,
              apiKey: input.settings.apiKey,
              model: modelName,
              modelInstance: recoveryModel,
              originalQuery: input.userQuery,
              summaryMarkdown: (summarization.summary || '').slice(0, 50000),
              executionSteps: execSteps,
              finalUrl,
            });

            // Inform the UI
            context.pushMessage({
              id: `auto-retry-${Date.now()}`,
              role: 'assistant',
              content: `🔁 Auto-Recovery: Retrying end-to-end with refined query.\n\n**Rationale:** ${recovery.rationale}`,
              executionTrajectory: executionTrajectory.slice(),
              pageContext: normalizedPageContext,
              workflowTasks: convertLegacyTasks(taskManager.getAllTasks()),
            });

            // Close out current workflow for telemetry, then start a fresh run
            endWorkflow(workflowId);

            const retryInput = {
              ...input,
              userQuery: `[AUTO-RETRY] ${recovery.adjustedQuery}`,
              initialContext: {
                currentUrl: normalizedPageContext?.url || finalUrl,
                pageContext: normalizedPageContext,
              },
            } as typeof input;

            return await browserAutomationWorkflow(retryInput, context);
          }
        } catch (autoRetryError: any) {
          workflowDebug.warn('Auto-recovery path failed; continuing without rerun', {
            error: autoRetryError?.message,
          });
        }
      } catch (summarizationError: any) {
        // This should rarely happen since fallback is built into summarizationStep
        const errorMsg = summarizationError?.message || String(summarizationError);
      
        workflowDebug.error('Summarization step threw error', summarizationError);
      
        summarization = {
          success: false,
          duration: 0,
          error: errorMsg,
          trajectoryLength: execSteps.length,
          stepCount: execSteps.length,
          taskCompleted: false,
        };
      }

    // ============================================
    // Workflow Complete
    // ============================================
    // totalDuration and finalUrl already calculated earlier (line 986-989)
    
// End workflow tracking and log metrics
     endWorkflow(workflowId);
     
     workflowTimer();
     workflowDebug.info('Workflow completed successfully', {
       workflowId,
       totalDuration,
       phaseDurations: {
         planning: planning.duration,
         pageContext: pageContext?.duration || 0,
         streaming: streaming.duration,
         summarization: summarization?.duration || 0,
       },
       executionSummary: {
         totalSteps: execSteps.length,
         successfulSteps: execSteps.filter(s => s.success).length,
         finalUrl,
         toolCalls: streaming.toolCallCount,
         textChunks: streaming.textChunkCount,
       },
       optionalFeatures: {
         preSearchUsed: !!preSearchBlock,
         summarizationSuccessful: !!summarization?.success,
       },
     });
     
      logEvent('browser_automation_workflow_complete', {
        workflow_id: workflowId,
        total_duration: totalDuration,
       phase_durations: {
         planning: planning.duration,
         page_context: pageContext?.duration || 0,
         streaming: streaming.duration,
         summarization: summarization?.duration || 0,
       },
       execution_summary: {
         total_steps: execSteps.length,
         successful_steps: execSteps.filter(s => s.success).length,
         final_url: finalUrl,
         tool_calls: streaming.toolCallCount,
         text_chunks: streaming.textChunkCount,
       },
       optional_features: {
         pre_search_used: !!preSearchBlock,
         summarization_successful: !!summarization?.success,
       },
     });

    // Log success message to make it clear workflow completed despite optional feature failures
    if (!preSearchBlock && input.settings.youApiKey) {
    }
    if (!summarization?.success && input.settings.youApiKey) {
    }
    
    const output: BrowserAutomationWorkflowOutput = {
      success: true,
      planning,
      pageContext,
      streaming,
      summarization,
      errorAnalysis: workflowErrorAnalysis
        ? {
            recap: workflowErrorAnalysis.recap,
            blame: workflowErrorAnalysis.blame,
            improvement: workflowErrorAnalysis.improvement,
          }
        : undefined,
      executionTrajectory,
      totalDuration,
      finalUrl,
      metadata: {
        workflowId,
        conversationId: input.metadata?.conversationId,
      },
      taskManager, // Include TaskManager for UI task management
    };
    
    // Validate output with error recovery
    const { BrowserAutomationWorkflowOutputSchema } = await import('../schemas/workflow-schemas');
    try {
      return BrowserAutomationWorkflowOutputSchema.parse(output);
    } catch (validationError: any) {
      
      // Return output anyway - validation shouldn't break successful workflows
      // The UI and consumers should handle this gracefully
      return output as BrowserAutomationWorkflowOutput;
    }
    
  } catch (error: any) {
    // Main try block (line 90) error handling
     const totalDuration = Date.now() - workflowStartTime;
     const errorMessage = error?.message || String(error);
     const isBedrockSchemaError = errorMessage.includes('toolConfig') || 
                                  errorMessage.includes('inputSchema') || 
                                  errorMessage.includes('type must be one of the following: object');
     
      logEvent('browser_automation_workflow_error', {
        workflow_id: workflowId,
        total_duration: totalDuration,
       error_type: error?.name || typeof error,
       error_message: errorMessage,
       is_bedrock_schema_error: isBedrockSchemaError,
       is_anthropic_model: isAnthropicModel,
     });
    
    // Try to analyze the error if we have execution steps
    workflowErrorAnalysis = undefined;
    if (execSteps.length > 0 && input.settings.apiKey) {
      try {
        const { analyzeExecutionFailure } = await import('../lib/error-analyzer');
        const diaryContext = execSteps.map((step, idx) => 
          `At step ${idx + 1}, you took the **${step.action}** action${step.url ? ` and navigated to: "${step.url}"` : step.target ? ` on selector: "${step.target}"` : ''}. ${step.success ? 'You succeeded.' : `But it failed: ${step.error || 'Unknown error'}.`}`
        );
        
        workflowErrorAnalysis = await analyzeExecutionFailure(
          diaryContext,
          input.userQuery,
          streaming?.fullText || errorMessage,
          `Workflow failed: ${errorMessage}`,
          {
            provider: input.settings.provider,
            apiKey: input.settings.apiKey,
            model: input.settings.model,
          }
        );
        
        if (workflowErrorAnalysis) {
          console.log('🔍 [Error Analyzer] Analysis complete:', {
            recap: workflowErrorAnalysis.recap.substring(0, 200),
            blame: workflowErrorAnalysis.blame.substring(0, 200),
          });
        }
      } catch (analysisError: any) {
        console.warn('⚠️ [Error Analyzer] Failed to analyze error:', analysisError?.message);
      }
    }
    
    return {
      success: false,
      planning: {
        plan: {
          objective: input.userQuery,
          approach: 'Failed',
          steps: [],
          criticalPaths: [],
          estimatedSteps: 0,
          complexityScore: 0,
          potentialIssues: [
            errorMessage,
            ...(isBedrockSchemaError && isAnthropicModel ? [
              'Bedrock schema conversion error: Consider using Google models for browser automation'
            ] : [])
          ],
          optimizations: [],
        },
        confidence: 0,
        planningBlock: `# Error\n\nWorkflow failed: ${errorMessage}${isBedrockSchemaError && isAnthropicModel ? '\n\n**Note**: This is a known limitation with Anthropic models. Try using Google models (gemini-2.5-flash-lite-preview-09-2025) for browser automation.' : ''}${workflowErrorAnalysis ? `\n\n## Error Analysis\n\n**Recap**: ${workflowErrorAnalysis.recap}\n\n**Root Cause**: ${workflowErrorAnalysis.blame}\n\n**Improvements**: ${workflowErrorAnalysis.improvement}` : ''}`,
        duration: totalDuration,
      },
      errorAnalysis: workflowErrorAnalysis ? {
        recap: workflowErrorAnalysis.recap,
        blame: workflowErrorAnalysis.blame,
        improvement: workflowErrorAnalysis.improvement,
      } : undefined,
      streaming: streaming || {
        fullText: '',
        textChunkCount: 0,
        toolCallCount: 0,
        toolExecutions: [],
        finishReason: 'error',
        duration: 0,
        executionSteps: [],
      },
      executionTrajectory,
      totalDuration,
      error: (() => {
        try {
          // Safely extract error message, avoiding circular references
          if (error?.message) return error.message;
          if (typeof error === 'string') return error;
          // Try to stringify, but catch any errors
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        } catch {
          return 'Unknown error';
        }
      })(),
       metadata: {
         workflowId,
         conversationId: input.metadata?.conversationId,
       },
       taskManager, // Include TaskManager even on error for potential retry
     };
  }
}
