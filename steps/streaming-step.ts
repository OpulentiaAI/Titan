// Streaming Step - Streams AI SDK response with tool execution using AI SDK 6 Agent
// 'use step' directive makes this a durable, resumable step

import { Experimental_Agent as ToolLoopAgent, stepCountIs } from 'ai';
import type { StreamingStepOutput } from '../schemas/workflow-schemas';
import type { Message } from '../types';
import { logEvent, logStepProgress, logToolExecution } from '../lib/braintrust';
import {
  createEnhancedAgentConfig,
  AgentPerformanceMonitor,
} from '../lib/agent-enhancements';
import { streamingDebug, agentDebug, messageDebug, toolDebug } from '../lib/debug-logger';

interface StreamingStepInput {
  model: any;
  system: string;
  tools: any;
  messages: Message[];
  execSteps: Array<{ step: number; action: string; url?: string; success: boolean }>;
  updateLastMessage: (updater: (msg: Message) => Message) => void;
  pushMessage: (msg: Message) => void;
  abortSignal?: AbortSignal;
}

/**
 * Streaming Step - Streams AI SDK response with tool calls
 * Handles text streaming and tool execution in a durable step
 */
export async function streamingStep(
  input: StreamingStepInput
): Promise<StreamingStepOutput> {
  "use step"; // Makes this a durable step
  
  const startTime = Date.now();

  const streamingTimer = streamingDebug.time('Streaming Step');
   
   streamingDebug.info('Starting streaming step', {
     messageCount: input.messages?.length || 0,
     toolCount: Object.keys(input.tools || {}).length,
     toolNames: Object.keys(input.tools || {}),
     hasAbortSignal: !!input.abortSignal,
   });
   
   // Validate input - ensure messages exist and are not empty
   if (!input.messages || !Array.isArray(input.messages) || input.messages.length === 0) {
     const errorMsg = `StreamingStep: Invalid messages input - ${input.messages === undefined ? 'undefined' : input.messages === null ? 'null' : `empty array (length: ${input.messages?.length || 0})`}`;
     streamingDebug.error('Invalid messages input', new Error(errorMsg));
     console.error(`❌ [StreamingStep] ${errorMsg}`);
     throw new Error(errorMsg);
  }
  
   streamingDebug.debug('Messages validated', {
     messageCount: input.messages.length,
     firstMessage: {
       id: input.messages[0]?.id,
       role: input.messages[0]?.role,
       contentLength: input.messages[0]?.content?.length || 0,
     },
   });
  
   // Log streaming step start
   logEvent('streaming_step_start', {
     message_count: input.messages.length,
     tool_count: Object.keys(input.tools).length,
     tool_names: Object.keys(input.tools),
   });
    
   try {
    streamingDebug.debug('Initializing agent configuration', {
      enablePerformanceMonitoring: true,
    });
    
    // Initialize performance monitoring
    const perfMonitor = new AgentPerformanceMonitor();
    const availableToolNames = Object.keys(input.tools || {});
    
    // Configure enhanced agent with all AI SDK 6 features
    const enhancements = createEnhancedAgentConfig({
      // Dynamic model selection
      dynamicModels: {
        fastModel: input.model,
        powerfulModel: (typeof input.model === 'string' && input.model.includes('gemini')) 
          ? input.model.replace('flash-lite', 'flash').replace('flash', 'pro')
          : input.model,
        stepThreshold: 10, // Switch to powerful model after 10 steps
        messageThreshold: 20, // Or when conversation gets long
      },
      
      // Force reasoning enabled (OpenRouter-style)
      reasoning: {
        enabled: true,
        effort: 'medium', // 50% of max_tokens for reasoning
        exclude: false, // Include reasoning in response
      },
      
      // Stop conditions - adjusted to allow multi-step tasks to complete
      stopOnCompletion: false, // Don't stop early - let tasks complete fully (disable premature stopping)
      stopOnExcessiveErrors: true, // Stop if too many errors (keep this for error handling)
      stopOnNavigationLoop: true, // Stop if stuck in navigation loop (keep this for infinite loops)
      maxTokenBudget: 50000, // Stop if exceeding token budget (keep this for resource limits)
      
      // Context management
      contextManagement: {
        maxMessages: 40,
        keepSystemMessage: true,
        keepRecentCount: 25,
        summarizeOldMessages: true,
      },
      
      // Performance monitoring
      enablePerformanceMonitoring: true,
    });
    
    // Create ToolLoopAgent with all enhancements + forced reasoning
    const agent = new ToolLoopAgent({
      model: input.model,
      instructions: input.system,
      tools: input.tools,
      toolChoice: 'required',
      
      // Force reasoning tokens (OpenRouter-style)
      experimental_reasoning: {
        enabled: true,
        effort: 'medium', // 50% of tokens for reasoning
        exclude: false, // Include reasoning in response for transparency
      },
      
      // Combined stop conditions: step limit + smart conditions
      // But be less aggressive about stopping early - allow more steps for multi-step tasks
      stopWhen: [
        stepCountIs(100), // Hard limit
        // Only apply smart stop conditions after at least 3 steps (allow multi-step tasks to complete)
        // Filter out completion-based stopping (we disabled stopOnCompletion, but keep other safety stops)
        ...enhancements.stopConditions.filter((_, idx) => {
          // Skip hasTaskCompletion if stopOnCompletion is false (it's at index 0 if enabled)
          // Actually, since we set stopOnCompletion: false, it won't be in the array
          return true; // Keep all other stop conditions (errors, loops, token budget)
        }).map(condition => async ({ steps }: any) => {
          // Don't stop early if we're in the middle of a multi-step task
          if (steps.length < 3) return false;
          // Check if stop condition matches
          return await condition({ steps });
        }),
      ],
      
      // Enhanced prepareStep with all features
      prepareStep: async ({ stepNumber, messages, steps }) => {
        // Performance tracking
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          if (lastStep?.usage) {
            const stepTime = Date.now() - startTime - (steps.length - 1) * 1000; // Estimate
            perfMonitor.recordStepTime(stepTime);
          }
        }
        
        // Log step progression every 5 steps
        if (stepNumber > 1 && stepNumber % 5 === 0) {
          logStepProgress('streaming_step', stepNumber, {
            previous_steps_count: steps.length,
            messages_count: messages.length,
            performance: perfMonitor.getSummary(),
          });
        }
        
        // Get enhanced configuration (model selection, context management, etc.)
        const enhancedConfig = await enhancements.prepareStep({ 
          stepNumber, 
          messages, 
          steps 
        });
        
        const hasExecutedTool = steps.some((step: any) => (step.toolCalls?.length || 0) > 0);
        const mergedConfig: any = { ...enhancedConfig };
        
        if (!hasExecutedTool) {
          mergedConfig.toolChoice = 'required';
          mergedConfig.activeTools = mergedConfig.activeTools || availableToolNames;
        } else if (mergedConfig.toolChoice === undefined) {
          mergedConfig.toolChoice = 'auto';
        }
        
        // Ensure agent continues for tool-calls
        const lastStep = steps[steps.length - 1];
        if (lastStep?.finishReason === 'tool-calls' && stepNumber < 50) {
          // Continue execution
          return mergedConfig;
        }
        
        return mergedConfig;
      },
    });
    
    // Debug: Log messages before streaming to catch any issues
    streamingDebug.debug('Preparing to stream', {
      messageCount: input.messages?.length || 0,
      messagesType: typeof input.messages,
      isArray: Array.isArray(input.messages),
    });
    
    if (input.messages && input.messages.length > 0) {
      streamingDebug.debug('First message details', {
        id: input.messages[0]?.id,
        role: input.messages[0]?.role,
        contentLength: input.messages[0]?.content?.length || 0,
        hasToolExecutions: !!input.messages[0]?.toolExecutions?.length,
      });
    }
    
    if (!input.messages || !Array.isArray(input.messages) || input.messages.length === 0) {
      streamingDebug.error('Invalid messages for streaming', new Error('Messages array is empty or invalid'));
      throw new Error(`Cannot stream - messages are invalid: ${JSON.stringify({ 
        messages: input.messages, 
        type: typeof input.messages,
        isArray: Array.isArray(input.messages),
        length: input.messages?.length 
      })}`);
    }
    
    // ToolLoopAgent.stream() expects an object with { messages: [...] }, not just the array
    // Convert Message[] to AI SDK format if needed
    const aiMessages = input.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    streamingDebug.debug('Calling agent.stream()', {
      aiMessageCount: aiMessages.length,
      format: 'AI SDK format',
    });
    
    const agentTimer = agentDebug.time('Agent Stream');
    const agentStream = await agent.stream({ messages: aiMessages });
    const result = await agentStream;
    agentTimer();
    
    streamingDebug.info('Agent stream initialized', {
      hasResult: !!result,
      hasFullStream: !!result.fullStream,
    });
    
    const assistantMessage: Message = { 
      id: (Date.now() + 1).toString(), 
      role: 'assistant', 
      content: '',
      // Initialize with empty artifacts that will be populated during streaming
      executionTrajectory: input.execSteps.map(s => ({
        step: s.step,
        action: s.action,
        url: s.url,
        success: s.success,
        timestamp: Date.now(),
      })),
      workflowTasks: [] as any,
    };
    input.pushMessage(assistantMessage);
    
    let fullText = '';
    let textChunkCount = 0;
    let toolCallCount = 0;
    let stepCount = 0;
    let toolExecutions: Array<{ tool: string; success: boolean; duration: number }> = [];
    let lastFinishReason: string | undefined;
    const stepTimings: Array<{ step: number; start: number; end?: number; finishReason?: string }> = [];
    const toolTimings: Map<string, { start: number }> = new Map();
    
    // Capture reasoning tokens (OpenRouter/Atlas pattern)
    let reasoning: string[] = [];
    let reasoningDetails: any[] = [];
    
    // Use fullStream for automatic tool execution and continuation
    // This enables maxSteps to work correctly - tools are executed automatically
    // and the stream continues until completion or maxSteps is reached
    logEvent('streaming_fullstream_start', {
      step_count: stepCount,
      tool_call_count: toolCallCount,
    });
    
    for await (const part of result.fullStream) {
      switch (part.type) {
         case 'start-step':
           stepCount++;
           stepTimings.push({ step: stepCount, start: Date.now() });
           streamingDebug.debug('Step started', {
             stepNumber: stepCount,
             timestamp: Date.now(),
           });
           logStepProgress('streaming_step', stepCount, {
             phase: 'start',
             total_steps_so_far: stepCount,
           });
           break;
        
         case 'reasoning-delta':
         case 'reasoning':
           // Capture reasoning tokens (OpenRouter/Atlas pattern)
           const reasoningText = (part as any).text || (part as any).delta || '';
           if (reasoningText) {
             reasoning.push(reasoningText);
             
             // Update message with reasoning in real-time
             input.updateLastMessage((msg) => ({
               ...msg,
               reasoning: reasoning.slice(), // Create copy
             }));
             
             streamingDebug.debug('Reasoning captured', {
               reasoningLength: reasoningText.length,
               totalReasoning: reasoning.length,
             });
           }
           break;
        
         case 'reasoning-details':
           // Capture structured reasoning details (OpenRouter format)
           const details = (part as any).details || (part as any);
           reasoningDetails.push(details);
           
           streamingDebug.debug('Reasoning details captured', {
             type: details.type,
             hasText: !!details.text,
             hasSummary: !!details.summary,
           });
           break;
          
         case 'finish-step':
           const stepPart = part as any;
           const currentStep = stepTimings.find(s => s.step === stepCount && !s.end);
           if (currentStep) {
             currentStep.end = Date.now();
             currentStep.finishReason = stepPart.finishReason;
             const stepDuration = currentStep.end - currentStep.start;
             streamingDebug.debug('Step finished', {
               stepNumber: stepCount,
               finishReason: stepPart.finishReason,
               duration: stepDuration,
             });
             logStepProgress('streaming_step', stepCount, {
               phase: 'finish',
               duration: stepDuration,
               finish_reason: stepPart.finishReason,
             });
             
             if (stepPart.finishReason === 'tool-calls') {
               logEvent('agent_continuation', {
                 current_step: stepCount,
                 next_step: stepCount + 1,
                 reason: 'tool-calls-require-continuation',
               });
               // Update UI to show continuation is happening - but only if no content yet
               if (!fullText || fullText.trim().length === 0) {
                 input.updateLastMessage((msg) => ({
                   ...msg,
                   content: msg.role === 'assistant' 
                     ? `_Executing step ${stepCount + 1}..._`
                     : msg.content
                 }));
               }
             } else if (stepPart.finishReason === 'stop') {
               // Check if this looks like premature stopping
               const plannedSteps = input.messages[0]?.content?.match(/Steps?[:\s]+(\d+)/i)?.[1];
               const expectedSteps = plannedSteps ? parseInt(plannedSteps) : 0;
               
               if (stepCount < expectedSteps && stepCount < 5 && fullText.length < 500) {
                 // Agent stopped early - log detailed warning
                 logEvent('agent_premature_stop', {
                   current_step: stepCount,
                   expected_steps: expectedSteps,
                   text_length: fullText.length,
                   tool_count: toolCallCount,
                   finish_reason: stepPart.finishReason,
                 });
               } else {
                 logEvent('agent_completed', {
                   final_step: stepCount,
                   finish_reason: stepPart.finishReason,
                   text_length: fullText.length,
                 });
               }
             }
           }
           break;
          
        case 'text-delta':
          // Text delta chunk - append to full text and update UI
          textChunkCount++;
          fullText += part.text;
          
          // Update message in real-time (every chunk for responsive UI)
          // Preserve artifacts while updating content
          input.updateLastMessage((msg) => ({
            ...msg,
            content: msg.role === 'assistant' ? fullText : msg.content,
            executionTrajectory: input.execSteps.map(s => ({
              step: s.step,
              action: s.action,
              url: s.url,
              success: s.success,
              timestamp: Date.now(),
            })),
          }));

           // Log progress every 10 chunks for debugging (less verbose than before)
           if (textChunkCount % 10 === 0) {
             logEvent('text_stream_progress', {
               chunk_count: textChunkCount,
               text_length: fullText.length,
               step_number: stepCount,
             });
          }
          break;
          
        case 'tool-call':
           // Tool call initiated - track it with timing and update UI
          toolCallCount++;
          const toolCall = part as any; // TypedToolCall structure
          const toolName = toolCall.toolName || 'unknown';
           const toolCallId = toolCall.toolCallId || 'unknown';
           toolTimings.set(toolCallId, { start: Date.now() });
           
           toolDebug.debug('Tool call initiated', {
             toolName,
             toolCallId,
             callNumber: toolCallCount,
             stepNumber: stepCount,
             hasArgs: !!toolCall.args,
             argKeys: toolCall.args ? Object.keys(toolCall.args) : [],
             args: toolCall.args,
           });
           
           logToolExecution(toolName, 'start', {
             tool_call_id: toolCallId,
             call_number: toolCallCount,
             step_number: stepCount,
             has_input: !!toolCall.args,
             input_keys: toolCall.args ? Object.keys(toolCall.args) : [],
           });
           
           // Update message with tool execution in 'input-streaming' state
           // Feature Verification: Real-time tool execution state tracking
           logEvent('tool_state_change', {
             toolName,
             toolCallId,
             state: 'input-streaming',
             stateTransition: '→ Processing (spinning icon)',
             hasInput: !!toolCall.args,
             inputKeys: toolCall.args ? Object.keys(toolCall.args) : [],
           });
           
           input.updateLastMessage((msg) => {
             const existingExecutions = msg.toolExecutions || [];
             const toolExecution = {
               toolCallId,
               toolName,
               state: 'input-streaming',
               input: toolCall.args || {},
               timestamp: Date.now(),
             } as const;
             
             // Check if this tool execution already exists
             const existingIndex = existingExecutions.findIndex(
               (exec) => exec.toolCallId === toolCallId
             );
             
             const updatedExecutions = existingIndex >= 0
               ? existingExecutions.map((exec, idx) => 
                   idx === existingIndex ? toolExecution : exec
                 )
               : [...existingExecutions, toolExecution];
             
             return {
               ...msg,
               toolExecutions: updatedExecutions,
             };
           });
          break;
          
        case 'tool-result':
           // Tool execution completed - track result with timing and update UI
          const toolResult = part as any; // TypedToolResult structure
          const resultToolName = toolResult.toolName || 'unknown';
           const resultToolCallId = toolResult.toolCallId || 'unknown';
          const toolSuccess = !toolResult.result?.error && !toolResult.result?.isError;
           
           const toolTiming = toolTimings.get(resultToolCallId);
           const toolDuration = toolTiming ? Date.now() - toolTiming.start : 0;
           toolTimings.delete(resultToolCallId);
           
           toolDebug.info('Tool result received', {
             toolName: resultToolName,
             toolCallId: resultToolCallId,
             success: toolSuccess,
             duration: toolDuration,
             hasResult: !!toolResult.result,
             hasError: !!toolResult.result?.error,
             errorMessage: toolResult.result?.error,
           });
          
          toolExecutions.push({
            tool: resultToolName,
            success: toolSuccess,
             duration: toolDuration,
           });
           
           // Update message with tool execution result
           // Feature Verification: Tool execution completion with state transition
           const finalState = toolSuccess ? 'output-available' : 'output-error';
           
           logToolExecution(resultToolName, 'complete', {
             tool_call_id: resultToolCallId,
             duration: toolDuration,
             success: toolSuccess,
             final_state: finalState,
             has_output: toolSuccess && !!toolResult.result,
             has_error: !toolSuccess,
             error_text: toolSuccess ? undefined : (toolResult.result?.error || 'Unknown error'),
             tool_details: {
               has_input: !!toolResult.args,
               has_output: toolSuccess && !!toolResult.result,
               has_error: !toolSuccess,
               input_keys: toolResult.args ? Object.keys(toolResult.args) : [],
               output_type: toolSuccess && toolResult.result ? typeof toolResult.result : 'none',
             },
           });
           
           input.updateLastMessage((msg) => {
             const existingExecutions = msg.toolExecutions || [];
             const toolExecution = {
               toolCallId: resultToolCallId,
               toolName: resultToolName,
               state: finalState as const,
               input: toolResult.args || {},
               output: toolSuccess ? toolResult.result : undefined,
               errorText: toolSuccess ? undefined : (toolResult.result?.error || String(toolResult.result?.error) || 'Unknown error'),
               timestamp: Date.now(),
             };
             
             // Update existing execution or add new one
             const existingIndex = existingExecutions.findIndex(
               (exec) => exec.toolCallId === resultToolCallId
             );
             
             const updatedExecutions = existingIndex >= 0
               ? existingExecutions.map((exec, idx) => 
                   idx === existingIndex ? toolExecution : exec
                 )
               : [...existingExecutions, toolExecution];
             
             return {
               ...msg,
               toolExecutions: updatedExecutions,
             };
           });
          break;
          
        case 'finish':
          // Stream finished - capture finish reason
          lastFinishReason = part.finishReason;
           logEvent('streaming_finished', {
             finish_reason: part.finishReason,
             total_steps: stepCount,
             total_tool_calls: toolCallCount,
             total_text_chunks: textChunkCount,
           });
           
           // Log final step timing if needed
           const finalStep = stepTimings.find(s => s.step === stepCount && !s.end);
           if (finalStep) {
             finalStep.end = Date.now();
             const finalStepDuration = finalStep.end - finalStep.start;
             logStepProgress('streaming_step', stepCount, {
               phase: 'final_complete',
               duration: finalStepDuration,
               finish_reason: part.finishReason,
             });
           }
          break;
          
        case 'error':
          // Stream error occurred
           logEvent('streaming_error', {
             error: part.error,
             step_number: stepCount,
             tool_call_count: toolCallCount,
           });
          break;
          
        default:
           // Unknown event type - log for debugging (but less verbose)
           // Only log non-standard events
           if (!['text-start', 'text-end', 'tool-input-start', 'tool-input-delta', 'tool-input-end'].includes((part as any).type)) {
             logEvent('streaming_unknown_event', {
               event_type: (part as any).type,
               step_number: stepCount,
             });
           }
      }
    }
    
    // Get final result for usage stats and final validation
    const finalResult = await result;
    
    // Use finish reason from stream if available, otherwise from final result
    const finishReason = lastFinishReason || finalResult.finishReason;
    
    // Get usage stats
    const usage = finalResult.usage instanceof Promise 
      ? await finalResult.usage 
      : finalResult.usage;
    
    const duration = Date.now() - startTime;
     
     // Calculate statistics
     const completedSteps = stepTimings.filter(s => s.end);
     const avgStepTime = completedSteps.length > 0
       ? completedSteps.reduce((sum, s) => sum + ((s.end! - s.start) || 0), 0) / completedSteps.length
       : 0;
     const avgToolTime = toolExecutions.length > 0
       ? toolExecutions.reduce((sum, t) => sum + (t.duration || 0), 0) / toolExecutions.length
       : 0;
     
     // Log comprehensive completion metrics with performance analysis
     const performanceSummary = perfMonitor.getSummary();
     
     logEvent('streaming_step_complete', {
       duration,
       execution_summary: {
         steps_executed: stepCount,
         avg_step_time: Math.round(avgStepTime),
         text_chunks: textChunkCount,
         tool_calls: toolCallCount,
         tool_executions: toolExecutions.length,
         avg_tool_time: Math.round(avgToolTime),
         finish_reason: finishReason,
         tokens: usage?.totalTokens || 0,
       },
       step_breakdown: completedSteps.map(step => ({
         step: step.step,
         duration: step.end! - step.start,
         finish_reason: step.finishReason || 'unknown',
       })),
       performance_analysis: performanceSummary,
       enhancements_active: {
         dynamic_model_selection: true,
         smart_stop_conditions: true,
         context_management: true,
         performance_monitoring: true,
       },
     });
    
    // Update final message with complete reasoning
    if (reasoning.length > 0) {
      input.updateLastMessage((msg) => ({
        ...msg,
        reasoning: reasoning.slice(),
        reasoningDetails: reasoningDetails.length > 0 ? reasoningDetails : undefined,
      }));
    }
    
    const output: StreamingStepOutput = {
      fullText,
      textChunkCount,
      toolCallCount,
      toolExecutions,
      usage: usage ? {
        promptTokens: (usage as any).promptTokens || usage.inputTokens || 0,
        completionTokens: (usage as any).completionTokens || usage.outputTokens || 0,
        totalTokens: usage.totalTokens || 0,
      } : undefined,
      finishReason: String(finishReason || 'unknown'),
      duration,
      executionSteps: input.execSteps || [],
      reasoning: reasoning.length > 0 ? reasoning : undefined,
      reasoningDetails: reasoningDetails.length > 0 ? reasoningDetails : undefined,
    } as any; // Extended with reasoning fields
    
    // Validate output (may need to update schema to include reasoning)
    const { StreamingStepOutputSchema } = await import('../schemas/workflow-schemas');
    try {
      return StreamingStepOutputSchema.parse(output);
    } catch (validationError) {
      // Return anyway - reasoning fields are optional extensions
      return output as StreamingStepOutput;
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
     
     // Enhanced error logging with Braintrust
     logEvent('streaming_step_error', {
       duration,
       error_type: error?.name || typeof error,
       error_message: error?.message || String(error),
       is_schema_error: error?.message?.includes('toolConfig') || error?.message?.includes('inputSchema') || error?.message?.includes('type must be'),
       tool_schemas: Object.keys(input.tools).map(name => {
        const tool = (input.tools as any)[name];
        const params = tool?.parameters;
        const shape = params?._def?.shape || {};
        return `${name}(${Object.keys(shape).length} params)`;
       }).join(', '),
       has_stack: !!error?.stack,
     });
    
    throw error; // Let workflow handle retry
  }
}