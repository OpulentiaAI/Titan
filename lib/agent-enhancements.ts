// AI SDK 6 Agent Enhancements
// Advanced configurations for ToolLoopAgent with production-ready features
// Integrated observability hooks for comprehensive telemetry

import type { StopCondition } from 'ai';
import type { Message } from '../types';
import { logEvent, logStepProgress, logToolExecution } from './braintrust.ts';

/**
 * Custom Stop Conditions
 */

// Stop when task completion is detected in text
export const hasTaskCompletion: StopCondition<any> = ({ steps }) => {
  const completionPhrases = [
    'TASK COMPLETE',
    'Navigation successful',
    'Action completed successfully',
    'All steps completed',
    'Objective achieved',
  ];
  
  const isComplete = steps.some(step => 
    completionPhrases.some(phrase => 
      step.text?.toLowerCase().includes(phrase.toLowerCase())
    )
  ) ?? false;
  
  if (isComplete) {
    logEvent('stop_condition_triggered', {
      condition: 'task_completion',
      step_count: steps.length,
      detected_phrase: steps[steps.length - 1]?.text?.substring(0, 100),
    });
  }
  
  return isComplete;
};

// Stop when error threshold is reached
export const hasExcessiveErrors: StopCondition<any> = ({ steps }) => {
  const toolResults = steps.flatMap(step => step.toolResults || []);
  const errors = toolResults.filter(result => 
    result.result?.error || result.result?.isError
  );
  
  // Stop if more than 3 consecutive errors
  const recentResults = toolResults.slice(-5);
  const recentErrors = recentResults.filter(r => r.result?.error || r.result?.isError);
  
  const hasErrors = recentErrors.length >= 3;
  
  if (hasErrors) {
    logEvent('stop_condition_triggered', {
      condition: 'excessive_errors',
      total_errors: errors.length,
      recent_errors: recentErrors.length,
      recent_window: recentResults.length,
      error_types: recentErrors.map(e => e.result?.error?.toString().substring(0, 50)),
    });
  }
  
  return hasErrors;
};

// Stop when navigation cycles are detected (visiting same URL multiple times)
export const hasNavigationLoop: StopCondition<any> = ({ steps }) => {
  const navigateCalls = steps.flatMap(step => 
    (step.toolCalls || []).filter(call => call.toolName === 'navigate')
  );
  
  if (navigateCalls.length < 3) return false;
  
  // Check for repeated URLs
  const urls = navigateCalls.map(call => call.args?.url).filter(Boolean);
  const urlCounts = urls.reduce((acc, url) => {
    acc[url] = (acc[url] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Stop if any URL visited 3+ times
  const hasLoop = Object.values(urlCounts).some((count: number) => count >= 3);
  
  if (hasLoop) {
    const repeatedUrls = Object.entries(urlCounts)
      .filter(([_, count]) => (count as number) >= 3)
      .map(([url, count]) => ({ url, visits: count as number }));
    
    logEvent('stop_condition_triggered', {
      condition: 'navigation_loop',
      total_navigations: navigateCalls.length,
      unique_urls: Object.keys(urlCounts).length,
      repeated_urls: repeatedUrls,
    });
  }
  
  return hasLoop;
};

// Stop when token budget is exceeded
export const hasExceededTokenBudget = (maxTokens: number): StopCondition<any> => {
  return ({ steps }) => {
    const totalUsage = steps.reduce(
      (acc, step) => ({
        inputTokens: acc.inputTokens + (step.usage?.inputTokens ?? 0),
        outputTokens: acc.outputTokens + (step.usage?.outputTokens ?? 0),
      }),
      { inputTokens: 0, outputTokens: 0 }
    );
    
    const totalTokens = totalUsage.inputTokens + totalUsage.outputTokens;
    const exceeded = totalTokens > maxTokens;
    
    if (exceeded) {
      logEvent('stop_condition_triggered', {
        condition: 'token_budget_exceeded',
        total_tokens: totalTokens,
        budget: maxTokens,
        overage: totalTokens - maxTokens,
        input_tokens: totalUsage.inputTokens,
        output_tokens: totalUsage.outputTokens,
        steps_completed: steps.length,
      });
    }
    
    return exceeded;
  };
};

/**
 * Dynamic Model Selection Logic
 */

export interface ModelSelectionConfig {
  fastModel: string;
  powerfulModel: string;
  stepThreshold: number;
  messageThreshold: number;
}

export function createDynamicModelSelector(config: ModelSelectionConfig) {
  let currentModel = config.fastModel;
  
  return async ({ stepNumber, messages }: { stepNumber: number; messages: any[] }) => {
    // Use powerful model for complex reasoning scenarios
    const isComplex = 
      stepNumber > config.stepThreshold || 
      messages.length > config.messageThreshold;
    
    if (isComplex && currentModel !== config.powerfulModel) {
      currentModel = config.powerfulModel;
      
      logEvent('dynamic_model_selection', {
        action: 'switch_to_powerful_model',
        from_model: config.fastModel,
        to_model: config.powerfulModel,
        trigger: {
          step_number: stepNumber,
          step_threshold: config.stepThreshold,
          message_count: messages.length,
          message_threshold: config.messageThreshold,
        },
      });
      
      console.log(`🧠 [Agent] Switching to powerful model at step ${stepNumber}`);
      return { model: config.powerfulModel };
    }
    
    return {};
  };
}

/**
 * Context Management for Long Tasks
 */

export interface ContextManagementConfig {
  maxMessages: number;
  keepSystemMessage: boolean;
  keepRecentCount: number;
  summarizeOldMessages?: boolean;
}

export function createContextManager(config: ContextManagementConfig) {
  let lastTrimStep = 0;
  
  return async ({ messages, stepNumber }: { messages: any[]; stepNumber?: number }) => {
    if (messages.length <= config.maxMessages) {
      return {};
    }
    
    const systemMessage = config.keepSystemMessage && messages[0]?.role === 'system' 
      ? [messages[0]] 
      : [];
    
    const recentMessages = messages.slice(-config.keepRecentCount);
    const droppedCount = messages.length - config.keepRecentCount - systemMessage.length;
    
    // Log context management with Braintrust
    logEvent('context_management', {
      action: 'trim_messages',
      step_number: stepNumber || 0,
      original_count: messages.length,
      trimmed_count: systemMessage.length + recentMessages.length,
      dropped_count: droppedCount,
      kept_system: config.keepSystemMessage,
      added_summary: config.summarizeOldMessages && droppedCount > 10,
    });
    
    console.log(`🧹 [Agent] Trimming context: ${messages.length} → ${config.keepRecentCount} messages`);
    
    // Optional: Add summarization of dropped messages
    if (config.summarizeOldMessages && messages.length > config.maxMessages + 10) {
      const summaryMessage = {
        role: 'system',
        content: `[Context Note: ${droppedCount} earlier messages summarized to manage context length]`,
      };
      
      lastTrimStep = stepNumber || 0;
      
      return {
        messages: [...systemMessage, summaryMessage, ...recentMessages],
      };
    }
    
    return {
      messages: [...systemMessage, ...recentMessages],
    };
  };
}

/**
 * Adaptive Tool Selection
 * Enable/disable tools based on workflow phase
 */

export interface ToolPhase {
  phase: string;
  allowedTools: string[];
  requiredTool?: string;
}

export function createToolPhaseManager(phases: ToolPhase[]) {
  let currentPhaseIndex = -1;
  
  return async ({ stepNumber }: { stepNumber: number }) => {
    // Determine current phase based on step number
    const phaseIndex = Math.min(
      Math.floor(stepNumber / 3), 
      phases.length - 1
    );
    
    const currentPhase = phases[phaseIndex];
    
    if (currentPhase) {
      // Log phase transitions
      if (phaseIndex !== currentPhaseIndex) {
        currentPhaseIndex = phaseIndex;
        
        logEvent('tool_phase_transition', {
          from_phase: currentPhaseIndex > 0 ? phases[currentPhaseIndex - 1]?.phase : 'none',
          to_phase: currentPhase.phase,
          step_number: stepNumber,
          allowed_tools: currentPhase.allowedTools,
          required_tool: currentPhase.requiredTool,
        });
      }
      
      console.log(`🔧 [Agent] Phase: ${currentPhase.phase} - Tools: ${currentPhase.allowedTools.join(', ')}`);
      
      const config: any = {
        activeTools: currentPhase.allowedTools,
      };
      
      if (currentPhase.requiredTool) {
        config.toolChoice = {
          type: 'tool',
          toolName: currentPhase.requiredTool,
        };
      }
      
      return config;
    }
    
    return {};
  };
}

/**
 * Performance Monitoring (observability)
 * Track and optimize agent performance with detailed observability
 */

export class AgentPerformanceMonitor {
  private stepTimes: number[] = [];
  private toolTimes: Map<string, number[]> = new Map();
  private startTime: number = Date.now();
  
  recordStepTime(duration: number) {
    this.stepTimes.push(duration);
    
    // Log every 5 steps
    if (this.stepTimes.length % 5 === 0) {
      logEvent('performance_checkpoint', {
        step_count: this.stepTimes.length,
        avg_step_time: Math.round(this.getAverageStepTime()),
        recent_step_time: duration,
        total_elapsed: Date.now() - this.startTime,
      });
    }
  }
  
  recordToolTime(toolName: string, duration: number) {
    if (!this.toolTimes.has(toolName)) {
      this.toolTimes.set(toolName, []);
    }
    this.toolTimes.get(toolName)!.push(duration);
    
    // Log slow tool executions (>2s)
    if (duration > 2000) {
      logEvent('slow_tool_execution', {
        tool_name: toolName,
        duration,
        execution_count: this.toolTimes.get(toolName)!.length,
        avg_time: this.getAverageToolTime(toolName),
      });
    }
  }
  
  getAverageStepTime(): number {
    if (this.stepTimes.length === 0) return 0;
    return this.stepTimes.reduce((a, b) => a + b, 0) / this.stepTimes.length;
  }
  
  getAverageToolTime(toolName: string): number {
    const times = this.toolTimes.get(toolName) || [];
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }
  
  getSummary() {
    const summary = {
      totalSteps: this.stepTimes.length,
      avgStepTime: Math.round(this.getAverageStepTime()),
      slowestStep: Math.max(...this.stepTimes, 0),
      fastestStep: this.stepTimes.length > 0 ? Math.min(...this.stepTimes) : 0,
      totalElapsed: Date.now() - this.startTime,
      toolPerformance: Array.from(this.toolTimes.entries()).map(([tool, times]) => ({
        tool,
        calls: times.length,
        avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        slowest: Math.max(...times),
        fastest: Math.min(...times),
      })),
    };
    
    // Log final summary
    logEvent('performance_summary', summary);
    
    return summary;
  }
}

/**
 * Retry Logic for Failed Tool Calls
 */

export interface RetryConfig {
  maxRetries: number;
  retryableErrors: string[];
  backoffMs: number;
}

export async function retryToolExecution<T>(
  toolFn: () => Promise<T>,
  config: RetryConfig,
  toolName: string
): Promise<T> {
  let lastError: any;
  const retryStartTime = Date.now();
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = config.backoffMs * Math.pow(2, attempt - 1);
        
        logEvent('tool_retry_attempt', {
          tool_name: toolName,
          attempt: attempt + 1,
          max_attempts: config.maxRetries + 1,
          backoff_ms: delay,
          error_message: lastError?.message?.substring(0, 100),
        });
        
        console.log(`🔄 [Agent] Retrying ${toolName} (attempt ${attempt + 1}/${config.maxRetries + 1}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await toolFn();
      
      // Log successful retry
      if (attempt > 0) {
        logEvent('tool_retry_success', {
          tool_name: toolName,
          attempts_needed: attempt + 1,
          total_duration: Date.now() - retryStartTime,
        });
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = config.retryableErrors.some(pattern => 
        error?.message?.includes(pattern) || error?.toString().includes(pattern)
      );
      
      if (!isRetryable || attempt === config.maxRetries) {
        // Log final failure
        logEvent('tool_retry_failed', {
          tool_name: toolName,
          total_attempts: attempt + 1,
          was_retryable: isRetryable,
          final_error: error?.message?.substring(0, 200),
          total_duration: Date.now() - retryStartTime,
        });
        
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Combined Enhancement Configuration
 * Use this to easily configure all enhancements
 */

export interface AgentEnhancementConfig {
  // Model selection
  dynamicModels?: ModelSelectionConfig;
  
  // Stop conditions
  stopOnCompletion?: boolean;
  stopOnExcessiveErrors?: boolean;
  stopOnNavigationLoop?: boolean;
  maxTokenBudget?: number;
  
  // Context management
  contextManagement?: ContextManagementConfig;
  
  // Tool phases
  toolPhases?: ToolPhase[];
  
  // Performance
  enablePerformanceMonitoring?: boolean;
}

export function createEnhancedAgentConfig(config: AgentEnhancementConfig) {
  const stopConditions: Array<StopCondition<any>> = [];
  
  // Log enhancement configuration for observability
  logEvent('agent_enhancements_configured', {
    features: {
      dynamic_models: !!config.dynamicModels,
      stop_on_completion: config.stopOnCompletion,
      stop_on_errors: config.stopOnExcessiveErrors,
      stop_on_loops: config.stopOnNavigationLoop,
      token_budget: config.maxTokenBudget,
      context_management: !!config.contextManagement,
      tool_phases: !!config.toolPhases,
      performance_monitoring: config.enablePerformanceMonitoring,
    },
    config_details: {
      model_selection: config.dynamicModels ? {
        fast_model: config.dynamicModels.fastModel,
        powerful_model: config.dynamicModels.powerfulModel,
        step_threshold: config.dynamicModels.stepThreshold,
      } : null,
      context_limits: config.contextManagement ? {
        max_messages: config.contextManagement.maxMessages,
        keep_recent: config.contextManagement.keepRecentCount,
      } : null,
      token_budget: config.maxTokenBudget,
    },
  });
  
  if (config.stopOnCompletion) {
    stopConditions.push(hasTaskCompletion);
  }
  
  if (config.stopOnExcessiveErrors) {
    stopConditions.push(hasExcessiveErrors);
  }
  
  if (config.stopOnNavigationLoop) {
    stopConditions.push(hasNavigationLoop);
  }
  
  if (config.maxTokenBudget) {
    stopConditions.push(hasExceededTokenBudget(config.maxTokenBudget));
  }
  
  const prepareStepHandlers: Array<(params: any) => Promise<any>> = [];
  
  if (config.dynamicModels) {
    prepareStepHandlers.push(createDynamicModelSelector(config.dynamicModels));
  }
  
  if (config.contextManagement) {
    prepareStepHandlers.push(createContextManager(config.contextManagement));
  }
  
  if (config.toolPhases) {
    prepareStepHandlers.push(createToolPhaseManager(config.toolPhases));
  }
  
  return {
    stopConditions,
    prepareStep: async (params: any) => {
      let combinedConfig = {};
      
      for (const handler of prepareStepHandlers) {
        const config = await handler(params);
        combinedConfig = { ...combinedConfig, ...config };
      }
      
      return combinedConfig;
    },
    performanceMonitor: config.enablePerformanceMonitoring 
      ? new AgentPerformanceMonitor() 
      : undefined,
  };
}
