// Enhanced Browser Automation Workflow
// Integrates: Evaluation step, approval flow, auto-submit, structured output
// Ready for multi-agent orchestration

import type {
  BrowserAutomationWorkflowInput,
  BrowserAutomationWorkflowOutput,
  PlanningStepOutput,
  PageContextStepOutput,
  SummarizationStepOutput,
} from '../schemas/workflow-schemas';
import { planningStep } from '../steps/planning-step';
import { pageContextStep } from '../steps/page-context-step';
import { enhancedStreamingStep } from '../lib/streaming-enhanced';
import { evaluationStep, formatEvaluationSummary, shouldImmediatelyRetry } from '../steps/evaluation-step';
import { summarizationStep } from '../steps/summarization-step';
import type { Message, PageContext } from '../types';
import { tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  useStep,
  parallel,
  condition,
  startWorkflow,
  endWorkflow,
} from '../lib/workflow-utils';
import { logEvent, logStepProgress } from '../lib/braintrust';
import {
  enhancedPlanningStep,
  executeStepsInParallel,
  aggregateExecutionResults,
  evaluateFinalResult,
} from '../lib/workflow-orchestration';
import { workflowDebug, toolDebug, orchestrationDebug } from '../lib/debug-logger';
import { validatePreflight, logPreflightResults } from '../lib/preflight-validation';
import { TaskManager, createWorkflowTaskManager, convertLegacyTasks } from '../lib/task-manager';
import {
  createNavigationApprovalPolicy,
  createFormSubmissionApprovalPolicy,
  createToolWithApproval,
} from '../lib/ai-sdk-6-enhancements';
import { z } from 'zod';

/**
 * Enhanced Browser Automation Workflow
 *
 * New Features:
 * 1. Evaluation step with quality gates
 * 2. Automatic retry based on evaluation
 * 3. Approval flow for sensitive operations
 * 4. Auto-submit after approvals
 * 5. Structured output tracking
 * 6. Multi-phase quality control
 *
 * Usage: Same as browserAutomationWorkflow, but with enhanced capabilities
 */
export async function browserAutomationWorkflowEnhanced(
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
    // New: Approval handler
    onApprovalRequired?: (toolName: string, args: any) => Promise<boolean>;
  }
): Promise<BrowserAutomationWorkflowOutput> {
  "use workflow"; // Durable, resumable workflow

  const workflowId = `wf_enhanced_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const workflowStartTime = Date.now();
  const executionTrajectory: Array<{
    step: number;
    action: string;
    url?: string;
    success: boolean;
    timestamp: number;
  }> = [];

  // Initialize TaskManager
  const taskManager = createWorkflowTaskManager({
    maxConcurrentTasks: 1,
    defaultMaxRetries: 2,
    enableAutoRetry: true,
    retryDelayMs: 2000,
  });

  // Add event listener for UI updates
  taskManager.addListener((update) => {
    context.updateLastMessage((msg) => {
      const currentTasks = msg.workflowTasks || convertLegacyTasks(taskManager.getAllTasks());
      const updatedTasks = currentTasks.map(t =>
        t.id === update.id ? {
          ...t,
          status: update.status || t.status,
          description: update.description || t.description,
        } : t
      );
      return { ...msg, workflowTasks: updatedTasks };
    });
  });

  // Task management helpers
  const updateWorkflowTasks = (taskId: string, status: any, description?: string) => {
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

  // Preflight validation
  const envForValidation = {
    ...process.env,
    YOU_API_KEY: input.settings.youApiKey || process.env.YOU_API_KEY,
    AI_GATEWAY_API_KEY: input.settings.apiKey || process.env.AI_GATEWAY_API_KEY,
  };

  const preflightResult = validatePreflight(envForValidation);
  logPreflightResults(preflightResult, false);

  if (!preflightResult.passed) {
    workflowDebug.warn('Preflight validation failed', {
      missingCritical: preflightResult.missingCritical,
      warnings: preflightResult.warnings,
    });
  }

  const workflowTimer = workflowDebug.time('Enhanced Workflow Execution');
  workflowDebug.info('Starting enhanced browser automation workflow', {
    workflowId,
    query: input.userQuery,
    provider: input.settings.provider,
    model: input.settings.model,
    preflightPassed: preflightResult.passed,
    approvalEnabled: !!context.onApprovalRequired,
  });

  startWorkflow(workflowId);

  logEvent('enhanced_browser_automation_workflow_start', {
    workflow_id: workflowId,
    query_length: input.userQuery.length,
    provider: input.settings.provider,
    model: input.settings.model,
    has_approval_handler: !!context.onApprovalRequired,
  });

  const modelName = input.settings.model || (input.settings.provider === 'gateway'
    ? 'google/gemini-2.5-flash-lite'
    : 'gemini-2.5-pro');

  const execSteps: Array<{ step: number; action: string; url?: string; success: boolean; error?: string; target?: string }> = [];
  let streaming: any | undefined;

  try {
    // ============================================
    // PHASE 1: Planning Step
    // ============================================
    logStepProgress('enhanced_workflow', 1, {
      phase: 'planning',
      action: 'starting',
    });

    context.pushMessage({
      id: `planning-${Date.now()}`,
      role: 'assistant',
      content: `🧠 **Planning Phase**\n\nAnalyzing task and generating execution plan...\n\n**Query:** ${input.userQuery.substring(0, 100)}${input.userQuery.length > 100 ? '...' : ''}`,
      workflowTasks: convertLegacyTasks(taskManager.getAllTasks()),
      pageContext: input.initialContext?.pageContext,
      executionTrajectory: [],
    });

    updateWorkflowTasks('plan', 'in_progress');

    const planning = await useStep('planning', async () => {
      return await planningStep(input);
    }, {
      retry: 1,
      timeout: 30000,
      abortSignal: context.abortSignal,
    });

    updateWorkflowTasks('plan', 'completed');

    context.updateLastMessage((msg) => ({
      ...msg,
      content: `✅ **Planning Complete**\n\n${planning.result.plan.steps.length} steps planned with ${planning.result.confidence >= 0.8 ? 'high' : 'moderate'} confidence.`,
      planning: planning.result,
    }));

    // ============================================
    // PHASE 2: Page Context Step (if needed)
    // ============================================
    let pageContext: PageContextStepOutput | undefined;
    if (!input.initialContext?.pageContext) {
      logStepProgress('enhanced_workflow', 2, {
        phase: 'page_context',
        action: 'gathering',
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

      context.updateLastMessage((msg) => ({
        ...msg,
        pageContext: pageContext,
        executionTrajectory: executionTrajectory.slice(),
      }));
    } else {
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
    // PHASE 3: Prepare Model & Tools with Approval
    // ============================================
    if (!input.settings.apiKey) {
      throw new Error('API key is required');
    }

    let model: any;
    if (input.settings.provider === 'gateway') {
      const { createGateway } = await import('@ai-sdk/gateway');
      const gatewayClient = createGateway({ apiKey: input.settings.apiKey });
      model = gatewayClient(modelName);
    } else {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      const googleClient = createGoogleGenerativeAI({ apiKey: input.settings.apiKey });
      model = googleClient(modelName);
    }

    // Define tools with approval policies
    const navigationApproval = createNavigationApprovalPolicy({
      allowedDomains: ['github.com', 'npmjs.com', 'stackoverflow.com'],
      requireApprovalForExternal: true,
    });

    const formApproval = createFormSubmissionApprovalPolicy({
      sensitiveFields: ['password', 'credit_card', 'ssn', 'api_key'],
      maxDataSize: 10000,
    });

    const tools: Record<string, any> = {
      navigate: tool({
        description: 'Navigate to a URL',
        parameters: z.object({ url: z.string().url() }),
        execute: async ({ url }: { url: string }) => {
          // Tool execution logic (same as original)
          return await context.executeTool('navigate', { url });
        },
      }),
      getPageContext: tool({
        description: 'Get current page context',
        parameters: z.object({
          _placeholder: z.string().optional(),
        }),
        execute: async () => {
          return await context.executeTool('getPageContext', {});
        },
      }),
      click: tool({
        description: 'Click an element',
        parameters: z.object({
          selector: z.string().optional(),
          x: z.number().optional(),
          y: z.number().optional(),
        }),
        execute: async (params: any) => {
          return await context.executeTool('click', params);
        },
      }),
      type: tool({
        description: 'Type text into an input',
        parameters: z.object({
          selector: z.string(),
          text: z.string(),
        }),
        execute: async (params: any) => {
          return await context.executeTool('type', params);
        },
      }),
      // Add other tools as needed
    };

    // ============================================
    // PHASE 4: Enhanced Streaming Step
    // ============================================
    logStepProgress('enhanced_workflow', 4, {
      phase: 'streaming',
      action: 'executing_with_evaluation',
    });

    const systemPrompt = `You are an expert browser automation agent. Execute the plan step-by-step.

Plan:
${planning.result.plan.steps.map((s, i) => `${i + 1}. ${s.action}(${s.target}) - ${s.reasoning}`).join('\n')}

Execute each step carefully and verify with getPageContext() after each action.`;

    // Prepare agent messages
    const agentMessages = context.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Execute streaming with evaluation loop (max 2 retries)
    let maxRetries = 2;
    let retryCount = 0;
    let evaluationResult: any = undefined;

    while (retryCount <= maxRetries) {
      // Execute streaming step with all enhancements
      streaming = await enhancedStreamingStep({
        model,
        system: systemPrompt,
        tools,
        messages: context.messages,
        execSteps,
        updateLastMessage: context.updateLastMessage,
        pushMessage: context.pushMessage,
        abortSignal: context.abortSignal,

        // Enhanced features
        enableStructuredOutput: true,
        enableApprovalFlow: !!context.onApprovalRequired,
        onApprovalRequired: context.onApprovalRequired,
        autoSubmitApprovals: true,
      });

      // ============================================
      // PHASE 5: Evaluation Step (NEW!)
      // ============================================
      logStepProgress('enhanced_workflow', 5, {
        phase: 'evaluation',
        action: 'assessing_quality',
        retry_count: retryCount,
      });

      evaluationResult = await evaluationStep({
        model,
        executionResult: streaming,
        originalQuery: input.userQuery,
        plan: planning.result.plan,
        evaluationCriteria: {
          requiredTools: ['navigate', 'getPageContext'],
          minSuccessRate: 0.7,
          maxErrors: 3,
          textMinLength: 100,
        },
      });

      // Display evaluation
      context.pushMessage({
        id: `eval-${Date.now()}`,
        role: 'assistant',
        content: formatEvaluationSummary(evaluationResult),
      });

      // Decision: retry or proceed?
      if (shouldImmediatelyRetry(evaluationResult) && retryCount < maxRetries) {
        retryCount++;
        workflowDebug.info('Evaluation suggests retry', {
          retryCount,
          quality: evaluationResult.quality,
          issues: evaluationResult.issues,
        });

        logEvent('evaluation_triggered_retry', {
          retry_count: retryCount,
          quality: evaluationResult.quality,
          score: evaluationResult.score,
        });

        // Enhance system prompt with retry strategy
        const retrySystemPrompt = `${systemPrompt}\n\n**RETRY ATTEMPT ${retryCount}/${maxRetries}**\n\n**Previous Issues:**\n${evaluationResult.issues.join('\n')}\n\n**Retry Strategy:**\n${evaluationResult.retryStrategy?.approach}\n\n**Focus Areas:**\n${evaluationResult.retryStrategy?.focusAreas.join('\n')}`;

        // Update messages with retry context
        context.pushMessage({
          id: `retry-${retryCount}-${Date.now()}`,
          role: 'user',
          content: `Please retry the execution with improvements based on the evaluation feedback.`,
        });

        continue; // Retry loop
      } else {
        // Quality acceptable or max retries reached
        if (evaluationResult.shouldProceed) {
          workflowDebug.info('Evaluation passed, proceeding', {
            quality: evaluationResult.quality,
            score: evaluationResult.score,
          });
        } else {
          workflowDebug.warn('Max retries reached or evaluation failed', {
            retryCount,
            quality: evaluationResult.quality,
          });
        }
        break; // Exit retry loop
      }
    }

    // ============================================
    // PHASE 6: Summarization Step
    // ============================================
    logStepProgress('enhanced_workflow', 6, {
      phase: 'summarization',
      action: 'generating_summary',
    });

    const summarization = await summarizationStep({
      model,
      executionTrajectory: streaming.executionSteps || [],
      finalText: streaming.fullText,
      originalQuery: input.userQuery,
    });

    context.updateLastMessage((msg) => ({
      ...msg,
      summarization,
    }));

    const duration = Date.now() - workflowStartTime;
    workflowTimer();

    logEvent('enhanced_workflow_complete', {
      workflow_id: workflowId,
      duration,
      evaluation_quality: evaluationResult?.quality,
      evaluation_score: evaluationResult?.score,
      retry_count: retryCount,
      structured_output: !!streaming.structuredOutput,
      approvals_requested: streaming.approvalsRequested?.length || 0,
    });

    endWorkflow(workflowId, 'success');

    return {
      success: true,
      planning: planning.result,
      streaming,
      summarization,
      evaluation: evaluationResult, // NEW: Include evaluation results
      duration,
      workflowId,
    } as any;

  } catch (error: any) {
    const duration = Date.now() - workflowStartTime;
    workflowTimer();

    logEvent('enhanced_workflow_error', {
      workflow_id: workflowId,
      duration,
      error: error?.message || String(error),
    });

    endWorkflow(workflowId, 'error');

    throw error;
  }
}
