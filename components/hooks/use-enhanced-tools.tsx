// React Hook for AI SDK 6 Enhanced Tool Calling
// Provides real-time updates, progress tracking, and error recovery

import { useState, useCallback, useRef, useEffect } from 'react';
import type { LanguageModel } from 'ai';
import { ToolExecutionOrchestrator, type ToolExecutionStep, type ToolCallEvent, type ToolResultEvent } from '@/lib/ai-sdk-6-tools-enhanced';

export interface ToolExecutionState {
  isExecuting: boolean;
  currentStep: number;
  totalSteps: number;
  steps: ToolExecutionStep[];
  currentTools: string[];
  error: Error | null;
  summary: {
    totalSteps: number;
    totalToolCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number;
  } | null;
}

export interface UseEnhancedToolsOptions {
  maxSteps?: number;
  toolChoice?: 'auto' | 'required' | 'none';
  onStepComplete?: (step: ToolExecutionStep) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for AI SDK 6 enhanced tool calling with real-time updates
 */
export function useEnhancedTools(options: UseEnhancedToolsOptions = {}) {
  const [state, setState] = useState<ToolExecutionState>({
    isExecuting: false,
    currentStep: 0,
    totalSteps: 0,
    steps: [],
    currentTools: [],
    error: null,
    summary: null,
  });

  const orchestratorRef = useRef<ToolExecutionOrchestrator | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize orchestrator
  const initializeOrchestrator = useCallback(() => {
    orchestratorRef.current = new ToolExecutionOrchestrator({
      maxSteps: options.maxSteps || 15,
      toolChoice: options.toolChoice || 'auto',
      experimental_continueSteps: true,
      validateToolResults: true,

      // Real-time step updates
      onStepStart: (step) => {
        setState(prev => ({
          ...prev,
          currentStep: step.stepNumber,
          currentTools: step.toolCalls.map(tc => tc.toolName),
        }));
      },

      onStepFinish: async (step) => {
        setState(prev => ({
          ...prev,
          steps: [...prev.steps, step],
          totalSteps: step.stepNumber,
        }));

        // Call user-provided callback
        if (options.onStepComplete) {
          options.onStepComplete(step);
        }
      },

      // Real-time tool call events
      onToolCall: async (event) => {
        console.log(`🔧 [useEnhancedTools] Tool called: ${event.toolName}`, event.args);

        if (options.onToolCall) {
          options.onToolCall(event);
        }
      },

      // Real-time tool result events
      onToolResult: async (event) => {
        if (event.error) {
          console.error(`❌ [useEnhancedTools] Tool error: ${event.toolName}`, event.error);
        } else {
          console.log(`✅ [useEnhancedTools] Tool result: ${event.toolName}`);
        }

        if (options.onToolResult) {
          options.onToolResult(event);
        }
      },

      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
        metadata: {
          source: 'react-hook',
          component: 'useEnhancedTools',
        },
      },
    });
  }, [options]);

  // Execute tools
  const execute = useCallback(
    async (params: {
      model: LanguageModel;
      system: string;
      messages: Array<{ role: string; content: string }>;
      tools: Record<string, any>;
    }) => {
      try {
        // Initialize fresh orchestrator
        initializeOrchestrator();

        if (!orchestratorRef.current) {
          throw new Error('Failed to initialize orchestrator');
        }

        // Reset state
        setState({
          isExecuting: true,
          currentStep: 0,
          totalSteps: 0,
          steps: [],
          currentTools: [],
          error: null,
          summary: null,
        });

        console.log('🚀 [useEnhancedTools] Starting tool execution...');

        // Execute with orchestrator
        const result = await orchestratorRef.current.execute(params);

        // Get summary
        const summary = orchestratorRef.current.getSummary();

        setState(prev => ({
          ...prev,
          isExecuting: false,
          summary,
        }));

        console.log('✅ [useEnhancedTools] Execution complete:', summary);

        // Call completion callback
        if (options.onComplete) {
          options.onComplete(result);
        }

        return result;
      } catch (error) {
        console.error('❌ [useEnhancedTools] Execution failed:', error);

        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));

        // Call error callback
        if (options.onError && error instanceof Error) {
          options.onError(error);
        }

        throw error;
      }
    },
    [initializeOrchestrator, options]
  );

  // Abort execution
  const abort = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.abort();
      setState(prev => ({
        ...prev,
        isExecuting: false,
        error: new Error('Execution aborted by user'),
      }));
      console.log('🛑 [useEnhancedTools] Execution aborted');
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isExecuting: false,
      currentStep: 0,
      totalSteps: 0,
      steps: [],
      currentTools: [],
      error: null,
      summary: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    execute,
    abort,
    reset,
    // Convenience getters
    isExecuting: state.isExecuting,
    currentStep: state.currentStep,
    steps: state.steps,
    error: state.error,
    summary: state.summary,
  };
}

/**
 * Hook for tracking tool execution progress with percentages
 */
export function useToolProgress() {
  const [progress, setProgress] = useState({
    percentage: 0,
    current: 0,
    total: 0,
    status: 'idle' as 'idle' | 'executing' | 'complete' | 'error',
  });

  const updateProgress = useCallback((current: number, total: number) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    setProgress({
      percentage,
      current,
      total,
      status: current === 0 ? 'idle' : current === total ? 'complete' : 'executing',
    });
  }, []);

  const reset = useCallback(() => {
    setProgress({
      percentage: 0,
      current: 0,
      total: 0,
      status: 'idle',
    });
  }, []);

  const setError = useCallback(() => {
    setProgress(prev => ({ ...prev, status: 'error' }));
  }, []);

  return {
    progress,
    updateProgress,
    reset,
    setError,
  };
}

/**
 * Hook for tool execution analytics
 */
export function useToolAnalytics() {
  const [analytics, setAnalytics] = useState({
    toolCounts: {} as Record<string, number>,
    successRates: {} as Record<string, number>,
    avgDurations: {} as Record<string, number>,
    totalExecutions: 0,
  });

  const recordToolCall = useCallback((toolName: string, success: boolean, duration: number) => {
    setAnalytics(prev => {
      const newCounts = { ...prev.toolCounts };
      const newRates = { ...prev.successRates };
      const newDurations = { ...prev.avgDurations };

      // Update counts
      newCounts[toolName] = (newCounts[toolName] || 0) + 1;

      // Update success rates
      const prevRate = newRates[toolName] || 0;
      const prevCount = newCounts[toolName] - 1;
      newRates[toolName] = (prevRate * prevCount + (success ? 1 : 0)) / newCounts[toolName];

      // Update average durations
      const prevDuration = newDurations[toolName] || 0;
      newDurations[toolName] = (prevDuration * prevCount + duration) / newCounts[toolName];

      return {
        toolCounts: newCounts,
        successRates: newRates,
        avgDurations: newDurations,
        totalExecutions: prev.totalExecutions + 1,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setAnalytics({
      toolCounts: {},
      successRates: {},
      avgDurations: {},
      totalExecutions: 0,
    });
  }, []);

  return {
    analytics,
    recordToolCall,
    reset,
  };
}

export default useEnhancedTools;
