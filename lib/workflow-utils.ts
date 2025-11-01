/**
 * Workflow Utilities - Vercel Workflow Patterns for Browser Extension
 * 
 * Provides workflow primitives compatible with Vercel Workflow SDK patterns,
 * but works client-side in browser extension context.
 * 
 * These utilities prepare for future migration to full Vercel Workflow SDK
 * while providing immediate benefits:
 * - Step-level retry logic
 * - Centralized metrics
 * - Parallel execution
 * - Conditional execution
 * - Timeout handling
 * 
 * Now integrates with Vercel Workflow SDK:
 * - Re-exports error classes (FatalError, RetryableError)
 * - Uses sleep from workflow package
 * - Provides metadata helpers
 */

import { logEvent } from './braintrust';

// Error classes compatible with Vercel Workflow SDK
// Browser extension compatible implementations
export class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
    Object.setPrototypeOf(this, FatalError.prototype);
  }
}

export class RetryableError extends Error {
  public retryAfter?: number;
  
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RetryableError.prototype);
  }
}

// Sleep function compatible with Vercel Workflow SDK
// Deterministic delay for workflows
export async function sleep(duration: string | number): Promise<void> {
  const ms = typeof duration === 'string' 
    ? parseDuration(duration) 
    : duration;
  await new Promise(resolve => setTimeout(resolve, ms));
}

function parseDuration(duration: string): number {
  // Parse duration strings like "1 month", "5 seconds", etc.
  const match = duration.match(/^(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days|month|months|year|years)$/i);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  const multipliers: Record<string, number> = {
    second: 1000,
    seconds: 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };
  
  return value * (multipliers[unit] || 1000);
}

// Metadata helpers compatible with Vercel Workflow SDK
// Browser extension compatible implementations
let currentStepName: string | null = null;
let currentWorkflowId: string | null = null;

export function getStepMetadata() {
  if (!currentStepName) {
    throw new Error('getStepMetadata() called outside of a step context');
  }
  return {
    stepName: currentStepName,
    workflowId: currentWorkflowId || '',
  };
}

export function getWorkflowMetadata() {
  if (!currentWorkflowId) {
    throw new Error('getWorkflowMetadata() called outside of a workflow context');
  }
  return {
    workflowId: currentWorkflowId,
  };
}

// Internal helpers to set metadata context
export function _setStepContext(stepName: string) {
  currentStepName = stepName;
}

export function _setWorkflowContext(workflowId: string) {
  currentWorkflowId = workflowId;
}

export function _clearStepContext() {
  currentStepName = null;
}

export interface StepOptions {
  /** Number of retry attempts (default: 0) */
  retry?: number;
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay between retries in ms (default: 10000) */
  maxDelay?: number;
  /** Step timeout in ms (default: no timeout) */
  timeout?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Whether to log metrics (default: true) */
  logMetrics?: boolean;
}

export interface StepResult<T> {
  result: T;
  duration: number;
  attempts: number;
  success: boolean;
  error?: Error;
}

export interface StepMetrics {
  workflowId: string;
  name: string;
  duration: number;
  attempts: number;
  success: boolean;
  startTime: number;
  endTime: number;
  error?: string;
}

/**
 * Centralized metrics collection
 */
class MetricsCollector {
  private metrics: Map<string, StepMetrics[]> = new Map();
  private workflowStartTimes: Map<string, number> = new Map();
  private currentWorkflowId: string = '';

  startWorkflow(workflowId: string) {
    this.currentWorkflowId = workflowId;
    this.workflowStartTimes.set(workflowId, Date.now());
    // Clear metrics for this specific workflow to start fresh
    this.metrics.set(workflowId, []);
  }

  getCurrentWorkflowId(): string {
    return this.currentWorkflowId;
  }

  recordStep(metrics: StepMetrics) {
    const workflowMetrics = this.metrics.get(metrics.workflowId) || [];
    workflowMetrics.push(metrics);
    this.metrics.set(metrics.workflowId, workflowMetrics);
  }

  getWorkflowMetrics(workflowId: string): StepMetrics[] {
    return this.metrics.get(workflowId) || [];
  }

  getSummary(workflowId: string) {
    const steps = this.getWorkflowMetrics(workflowId);
    const workflowStartTime = this.workflowStartTimes.get(workflowId) || Date.now();
    const totalDuration = Date.now() - workflowStartTime;
    const successful = steps.filter(s => s.success).length;
    const failed = steps.filter(s => !s.success).length;
    const totalAttempts = steps.reduce((sum, s) => sum + s.attempts, 0);
    const avgStepDuration = steps.length > 0 
      ? steps.reduce((sum, s) => sum + s.duration, 0) / steps.length 
      : 0;

    return {
      workflowId,
      totalDuration,
      stepCount: steps.length,
      successful,
      failed,
      totalAttempts,
      avgStepDuration,
      steps,
    };
  }

  logSummary(workflowId: string) {
    const summary = this.getSummary(workflowId);
    logEvent('workflow_summary', {
      workflowId: summary.workflowId,
      totalDuration: `${summary.totalDuration}ms`,
      steps: `${summary.successful}/${summary.stepCount} succeeded`,
      avgStepDuration: `${Math.round(summary.avgStepDuration)}ms`,
      totalAttempts: summary.totalAttempts,
    });
  }
}

// Singleton metrics collector
export const metricsCollector = new MetricsCollector();

/**
 * Execute a step with retry logic and metrics collection
 * 
 * Mimics `useStep` directive from Vercel Workflow SDK
 * 
 * @example
 * ```typescript
 * const result = await useStep('planning', async () => {
 *   return await planningStep(input);
 * }, { retry: 3, timeout: 30000 });
 * ```
 */
export async function useStep<T>(
  stepName: string,
  fn: () => Promise<T>,
  options: StepOptions = {}
): Promise<StepResult<T>> {
  const {
    retry = 0,
    retryDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000,
    timeout,
    abortSignal,
  } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | undefined;

  // Set step context for metadata helpers
  _setStepContext(stepName);

  try {
    while (attempts <= retry) {
      attempts++;

      // Check abort signal
      if (abortSignal?.aborted) {
        const error = new Error(`Step "${stepName}" aborted`);
        const duration = Date.now() - startTime;
        recordMetrics(stepName, duration, attempts, false, error);
        throw error;
      }

      try {
        // Execute with timeout if specified
        const result = timeout
          ? await Promise.race([
              fn(),
              new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`Step "${stepName}" timed out after ${timeout}ms`)), timeout)
              ),
            ])
          : await fn();

        const duration = Date.now() - startTime;

        // Record success metrics
        recordMetrics(stepName, duration, attempts, true);

        return { result, duration, attempts, success: true };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Handle FatalError - don't retry
        if (error instanceof FatalError) {
          const duration = Date.now() - startTime;
          recordMetrics(stepName, duration, attempts, false, lastError);
          throw lastError;
        }

        // Handle RetryableError - respect retryAfter if specified
        if (error instanceof RetryableError) {
          if (attempts > retry) {
            const duration = Date.now() - startTime;
            recordMetrics(stepName, duration, attempts, false, lastError);
            throw lastError;
          }

          const delay = error.retryAfter 
            ? Math.min(error.retryAfter, maxDelay)
            : Math.min(
                retryDelay * Math.pow(backoffMultiplier, attempts - 1),
                maxDelay
              );

          await sleep(delay);
          continue;
        }

        // If no retries left, fail
        if (attempts > retry) {
          const duration = Date.now() - startTime;
          recordMetrics(stepName, duration, attempts, false, lastError);
          throw lastError;
        }

        // Calculate backoff delay
        const delay = Math.min(
          retryDelay * Math.pow(backoffMultiplier, attempts - 1),
          maxDelay
        );

        // Wait before retry
        await sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError || new Error(`Step "${stepName}" failed after ${attempts} attempts`);
  } finally {
    // Clear step context
    _clearStepContext();
  }
}

/**
 * Record step metrics
 */
function recordMetrics(
  name: string,
  duration: number,
  attempts: number,
  success: boolean,
  error?: Error
) {
  const currentWorkflowId = metricsCollector.getCurrentWorkflowId();
  
  // Only record if we have an active workflow
  if (!currentWorkflowId) {
    return;
  }
  
  metricsCollector.recordStep({
    workflowId: currentWorkflowId,
    name,
    duration,
    attempts,
    success,
    startTime: Date.now() - duration,
    endTime: Date.now(),
    error: error?.message,
  });
}

/**
 * Execute multiple steps in parallel
 * 
 * Mimics `parallel()` from Vercel Workflow SDK
 * 
 * @example
 * ```typescript
 * const [planning, preSearch] = await parallel([
 *   useStep('planning', () => planningStep(input)),
 *   useStep('pre-search', () => preSearchStep(input)),
 * ]);
 * ```
 */
export async function parallel<T extends readonly unknown[] | []>(
  promises: [...{ [K in keyof T]: Promise<T[K]> }]
): Promise<{ [K in keyof T]: T[K] }> {
  try {
    const results = await Promise.all(promises);
    return results as { [K in keyof T]: T[K] };
  } catch (error) {
    throw error;
  }
}

/**
 * Conditionally execute a step
 * 
 * @example
 * ```typescript
 * const preSearch = await condition(
 *   !!input.settings.youApiKey,
 *   useStep('pre-search', () => preSearchStep(input)),
 *   null
 * );
 * ```
 */
export async function condition<T>(
  condition: boolean,
  ifTrue: Promise<T> | (() => Promise<T>),
  ifFalse: T | (() => T) = null as T
): Promise<T | null> {
  if (condition) {
    const result = typeof ifTrue === 'function' ? await ifTrue() : await ifTrue;
    return result;
  } else {
    if (typeof ifFalse === 'function') {
      const result = await (ifFalse as () => Promise<T> | T)();
      return result;
    }
    return ifFalse;
  }
}

/**
 * Execute with timeout
 * 
 * @deprecated Use sleep() from 'workflow' package for delays
 * This function is kept for backward compatibility
 * 
 * @example
 * ```typescript
 * const result = await timeout(30000, async () => {
 *   return await longRunningOperation();
 * });
 * ```
 */
export async function timeout<T>(
  ms: number,
  fn: () => Promise<T>
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Start workflow tracking
 */
export function startWorkflow(workflowId: string) {
  metricsCollector.startWorkflow(workflowId);
  _setWorkflowContext(workflowId);
}

/**
 * Get workflow summary and log it
 */
export function endWorkflow(workflowId: string) {
  metricsCollector.logSummary(workflowId);
  return metricsCollector.getSummary(workflowId);
}

/**
 * Get workflow summary without logging
 */
export function getWorkflowSummary(workflowId: string) {
  return metricsCollector.getSummary(workflowId);
}
