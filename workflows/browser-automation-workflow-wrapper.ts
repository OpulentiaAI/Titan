// AI SDK v6 Enhanced Wrapper for Production Workflow
// Adds: Streaming artifacts, caching, guardrails, evaluation on top of existing workflow

import { browserAutomationWorkflow as legacyWorkflow } from './browser-automation-workflow.legacy';
import type {
  BrowserAutomationWorkflowInput,
  BrowserAutomationWorkflowOutput,
} from '../schemas/workflow-schemas';
import type { Message, PageContext } from '../types';
import {
  createMessageArtifactWriter,
  executionPlanArtifact,
  toolResultsArtifact,
  evaluationArtifact,
  updateExecutionPlanProgress,
  addToolResult,
} from '../lib/streaming-artifacts';
import { globalCache } from '../lib/universal-cache';
import { GuardrailsSystem } from '../lib/guardrails';
import { evaluationStep } from '../steps/evaluation-step';

/**
 * Enhanced browser automation workflow
 *
 * Wraps the production workflow with AI SDK v6 enhancements:
 * - Streaming artifacts for real-time UI updates
 * - Universal caching for performance
 * - Guardrails for permission-based execution
 * - Evaluation loop with automatic retry
 *
 * This wrapper maintains 100% compatibility with the existing workflow
 * while adding opt-in enhancements.
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
    onApprovalRequired?: (toolName: string, args: any) => Promise<boolean>;
    // New: Enable AI SDK v6 features (opt-in)
    enableEnhancements?: boolean;
    enableArtifacts?: boolean;
    enableCaching?: boolean;
    enableGuardrails?: boolean;
    enableEvaluation?: boolean;
  }
): Promise<BrowserAutomationWorkflowOutput> {
  // ALL enhancements enabled by default - no opt-in required
  const enableEnhancements = context.enableEnhancements !== false;
  const enableArtifacts = context.enableArtifacts !== false && enableEnhancements;
  const enableCaching = context.enableCaching !== false && enableEnhancements;
  const enableGuardrails = context.enableGuardrails !== false && enableEnhancements;
  const enableEvaluation = context.enableEvaluation !== false && enableEnhancements;

  // Initialize artifact writer if enabled
  let artifactWriter: any;
  let planArtifact: any;
  let resultsArtifact: any;
  let evalArtifact: any;

  if (enableArtifacts) {
    artifactWriter = createMessageArtifactWriter(context);
    planArtifact = executionPlanArtifact.stream(artifactWriter);
    resultsArtifact = toolResultsArtifact.stream(artifactWriter);
    evalArtifact = evaluationArtifact.stream(artifactWriter);
  }

  // Initialize guardrails if enabled
  let guardrails: GuardrailsSystem | undefined;
  if (enableGuardrails) {
    guardrails = new GuardrailsSystem('user');
  }

  // Wrap executeTool with enhancements
  const originalExecuteTool = context.executeTool;
  const enhancedExecuteTool = async (toolName: string, params: any) => {
    // Guardrails check
    if (guardrails) {
      const check = await guardrails.checkPermission(toolName, params);
      if (!check.allowed) {
        throw new Error(`Blocked by guardrails: ${check.reason}`);
      }
    }

    // Caching
    const execute = async () => {
      const result = await originalExecuteTool(toolName, params);

      // Track in artifact
      if (enableArtifacts && resultsArtifact) {
        addToolResult(resultsArtifact, {
          toolName,
          args: params,
          result,
          duration: 0,
          success: !result.error,
          error: result.error,
        });
      }

      // Record for guardrails
      if (guardrails) {
        guardrails.recordToolResult(toolName, !result.error);
      }

      return result;
    };

    if (enableCaching) {
      const ttl = getCacheTTL(toolName);
      if (ttl > 0) {
        return await globalCache.executeWithCache(toolName, params, execute, { ttl });
      }
    }

    return await execute();
  };

  // Enhanced context with wrapped executeTool
  const enhancedContext = {
    ...context,
    executeTool: enhancedExecuteTool,
  };

  // Execute base workflow with optional retry loop for evaluation
  let result: BrowserAutomationWorkflowOutput;
  let retryCount = 0;
  const maxRetries = enableEvaluation ? 2 : 0;

  while (retryCount <= maxRetries) {
    // Execute workflow
    result = await legacyWorkflow(input, enhancedContext);

    // Evaluation step (if enabled)
    if (enableEvaluation && result.success && result.planning && result.streaming) {
      const evaluation = await evaluationStep({
        model: input.settings.model,
        executionResult: result.streaming,
        originalQuery: input.userQuery,
        plan: result.planning.plan,
        evaluationCriteria: {
          requiredTools: ['navigate', 'getPageContext'],
          minSuccessRate: 0.7,
          maxErrors: 3,
        },
      });

      // Stream evaluation artifact
      if (enableArtifacts && evalArtifact) {
        evalArtifact.update(evaluation);
      }

      // Attach evaluation to result
      result.evaluation = evaluation;

      // Check if retry needed
      if (!evaluation.shouldProceed && retryCount < maxRetries) {
        retryCount++;
        // Enhance input for retry
        input.userQuery = `${input.userQuery}\n\n[Retry ${retryCount}/${maxRetries}] Previous attempt had issues: ${evaluation.issues.join(', ')}. ${evaluation.retryStrategy?.approach || 'Please retry with improvements.'}`;
        continue;
      }
    }

    break;
  }

  // Complete artifacts
  if (enableArtifacts) {
    planArtifact?.complete();
    resultsArtifact?.complete();
    evalArtifact?.complete();
  }

  // Add enhancement metadata
  if (enableEnhancements) {
    result.metadata = {
      ...result.metadata,
      enhancementsEnabled: {
        artifacts: enableArtifacts,
        caching: enableCaching,
        guardrails: enableGuardrails,
        evaluation: enableEvaluation,
      },
      cacheStats: enableCaching ? globalCache.getAggregateStats() : undefined,
      guardrailStats: guardrails ? guardrails.getStats() : undefined,
      retryCount,
    };
  }

  return result;
}

/**
 * Get cache TTL for tool type
 */
function getCacheTTL(toolName: string): number {
  const ttls: Record<string, number> = {
    navigate: 2 * 60 * 1000, // 2 minutes
    getPageContext: 60 * 1000, // 1 minute
    getBrowserHistory: 10 * 60 * 1000, // 10 minutes
    screenshot: 30 * 1000, // 30 seconds
    click: 5 * 1000, // 5 seconds
    type: 0, // No caching for interactive tools
    scroll: 0,
    wait: 0,
    press_key: 0,
    key_combination: 0,
  };

  return ttls[toolName] || 30 * 1000; // Default 30 seconds
}
