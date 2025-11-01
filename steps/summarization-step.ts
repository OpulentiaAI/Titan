// Summarization Step - Post-run analysis via AI SDK 6 tool/agent calls
// Feature flag: useYouAdvancedAgent (deprecated) vs useAiSdkToolCalls (default)

import type { SummarizationStepOutput } from '../schemas/workflow-schemas';
import { summarizerDebug } from '../lib/debug-logger';
import { isFeatureEnabled } from '../lib/feature-flags';

interface SummarizationStepInput {
  youApiKey: string;
  objective: string;
  trajectory: string;
  outcome: string;
  // Fallback options when You.com fails
  fallbackModel?: any;
  fallbackApiKey?: string;
  // Optional: Enable streaming for real-time updates
  enableStreaming?: boolean;
  updateLastMessage?: (updater: (msg: any) => any) => void;
  // Optional: Enable finalization (polish with editor-style refinement)
  enableFinalization?: boolean;
  finalizationProvider?: 'google' | 'gateway';
  finalizationModel?: string;
  knowledgeItems?: Array<{ title?: string; content?: string; url?: string }>;
}

/**
 * Summarization Step - Post-run analysis and next steps
 * Uses You.com Advanced Agent if available, falls back to main AI model
 */
export async function summarizationStep(
  input: SummarizationStepInput
): Promise<SummarizationStepOutput> {
  // Note: "use step" directive removed to prevent caching conflicts
  // If durability is needed, it should be handled at the workflow level
  
  const startTime = Date.now();
  const summarizerTimer = summarizerDebug.time('Summarization Step');
  
  // Check feature flags
  const useYouAdvancedAgent = isFeatureEnabled('useYouAdvancedAgent');
  const useAiSdkToolCalls = isFeatureEnabled('useAiSdkToolCalls');
  
  summarizerDebug.info('Starting summarization step', {
    useYouAdvancedAgent,
    useAiSdkToolCalls,
    hasYouApiKey: !!input.youApiKey,
    youApiKeyLength: input.youApiKey?.length || 0,
    objectiveLength: input.objective?.length || 0,
    trajectoryLength: input.trajectory?.length || 0,
    outcomeLength: input.outcome?.length || 0,
    enableStreaming: input.enableStreaming,
    enableFinalization: input.enableFinalization,
    knowledgeItemCount: input.knowledgeItems?.length || 0,
    hasFallbackModel: !!input.fallbackModel,
    hasFallbackApiKey: !!input.fallbackApiKey,
  });
  
  // ============================================
  // PRIMARY: AI SDK 6 Tool/Agent Calls (Default)
  // ============================================
  if (useAiSdkToolCalls && input.fallbackModel && input.fallbackApiKey) {
    try {
      console.log('🤖 [SUMMARIZATION] Using AI SDK 6 with tool calls (feature flag enabled)');
      
      const { summarizeWithAiSdk } = await import('../lib/ai-sdk-summarizer');
      
      const aiSdkResult = await summarizeWithAiSdk({
        objective: input.objective,
        trajectory: input.trajectory,
        outcome: input.outcome,
        model: input.fallbackModel,
        youApiKey: input.youApiKey, // Optional - enhances with search if available
        enableStreaming: input.enableStreaming, // Enable streaming for real-time UI updates
        updateLastMessage: input.updateLastMessage, // Callback for streaming updates
      });
      
      if (aiSdkResult.success && aiSdkResult.summary) {
        const stepCount = (input.trajectory.match(/step \d+/g) || []).length;
        
        console.log('✅ [SUMMARIZATION] AI SDK summarization successful', {
          duration: aiSdkResult.duration,
          summaryLength: aiSdkResult.summary.length,
          searchResultsUsed: aiSdkResult.searchResults?.length || 0,
        });
        
        return {
          summary: aiSdkResult.summary,
          duration: aiSdkResult.duration,
          success: true,
          trajectoryLength: input.trajectory.length,
          stepCount,
        };
      } else {
        console.warn('⚠️  [SUMMARIZATION] AI SDK summarization returned empty - falling through to You.com Advanced Agent');
      }
    } catch (aiSdkError: any) {
      console.error('❌ [SUMMARIZATION] AI SDK summarization failed:', aiSdkError?.message);
      // Fall through to You.com Advanced Agent or final fallback
    }
  }
  
  // ============================================
  // LEGACY: You.com Advanced Agent (Feature Flagged - Deprecated)
  // ============================================
  if (useYouAdvancedAgent && input.youApiKey && input.youApiKey.length > 10) {
    try {
      summarizerDebug.debug('Using You.com Advanced Agent', {
        useStreaming: input.enableStreaming && input.updateLastMessage,
        youApiKeyValid: input.youApiKey.length > 10,
        youApiKeyLength: input.youApiKey.length,
        youApiKeyPrefix: input.youApiKey.substring(0, 20),
      });

      console.log('🔍 [SUMMARIZATION] Starting You.com API call...');
      console.log('🔍 [SUMMARIZATION] API Key:', input.youApiKey.substring(0, 20) + '...' + input.youApiKey.substring(input.youApiKey.length - 10));

      // Try agents API first, then fallback to search API
      let summary: string;
      let usedAgentsApi = false;

      // Use streaming if enabled and updateLastMessage is available
      const useStreaming = input.enableStreaming && input.updateLastMessage;

      // Build the prompt for You.com summarization
      const prompt = [
        'You are a browser automation analysis assistant. Summarize the execution and propose next actions.',
        '',
        '**Objective:**',
        input.objective,
        '',
        '**Execution Trajectory:**',
        input.trajectory,
        '',
        '**Outcome:**',
        input.outcome,
        '',
        '**Your task:** Summarize the execution trajectory, assess whether the objective was achieved and why, then propose exactly three high-impact next actions tailored to this context (include a short rationale and the recommended browser action or tool to execute). Return concise Markdown with sections: Summary, Goal assessment, Suggested next actions (1-3).',
      ].join('\n');

      try {
        // Try agents API first
        if (useStreaming) {
        // Stream response for real-time UI updates
        const { runYouAdvancedAgentStream } = await import('../youAgent');
        let streamedText = '';
        
        // Create initial message for streaming (if updateLastMessage is available)
        // Note: The workflow should create the message before calling this step
        // This ensures updateLastMessage has a message to update
        
        // Add timeout to You.com streaming (8 seconds max - very aggressive)
        const youStreamPromise = runYouAdvancedAgentStream(
          input.youApiKey,
          prompt,
          {
            stream: true,
             verbosity: 'medium', // Medium verbosity for balanced response
            maxWorkflowSteps: 1, // Reduced to 1 for fastest completion
            onDelta: (delta) => {
              streamedText += delta;
              // Update UI in real-time via updateLastMessage
              if (input.updateLastMessage) {
                input.updateLastMessage((msg: any) => ({
                  ...msg,
                  content: msg.role === 'assistant' 
                    ? `---\n## Summary & Next Steps\n\n${streamedText}`
                    : msg.content
                }));
              }
            },
            onSearchResults: (results) => {
              // Could display search results if needed
              summarizerDebug.debug('You.com search results', { count: results.length });
            },
            onError: (error) => {
              summarizerDebug.error('You.com streaming error', error);
              // Optionally update message with error state
              if (input.updateLastMessage) {
                input.updateLastMessage((msg: any) => ({
                  ...msg,
                  content: msg.content + `\n\n⚠️ Streaming error: ${error.message}`,
                }));
              }
            },
          }
        );
        
        const youStreamTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('You.com streaming timed out after 8s')), 8000)
        );
        
        const streamResult = await Promise.race([youStreamPromise, youStreamTimeout]) as any;
        
        console.log('🔍 [SUMMARIZATION] You.com streaming complete:', {
          hasOutput: !!streamResult.output,
          outputLength: streamResult.output?.length || 0,
          streamedTextLength: streamedText.length,
        });

        summary = streamResult.output || streamedText;
        usedAgentsApi = true;
          usedAgentsApi = true;
        } else {
          // Non-streaming: faster, simpler for non-UI contexts
          const { runYouAdvancedAgentSummary } = await import('../youAgent');

          // Add timeout to You.com non-streaming (8 seconds max - very aggressive)
          const youSummaryPromise = runYouAdvancedAgentSummary(
            input.youApiKey,
            prompt,
            { verbosity: 'medium', maxWorkflowSteps: 1 } // Medium verbosity for fastest completion
          );

          const youSummaryTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('You.com summary timed out after 8s')), 8000)
          );

          summary = await Promise.race([youSummaryPromise, youSummaryTimeout]) as string;
          usedAgentsApi = true;

          console.log('🔍 [SUMMARIZATION] You.com non-streaming complete:', {
            hasSummary: !!summary,
            summaryLength: summary?.length || 0,
          });
        }
      } catch (agentsError: any) {
        console.log('🔍 [SUMMARIZATION] Agents API failed, trying search API...', agentsError.message);
        summarizerDebug.warn('Agents API failed, falling back to search API', { error: agentsError.message });

        // Fallback to search API
        const { runYouSearchSummary } = await import('../youAgent');
        const searchQuery = `Summarize this browser automation execution: ${input.objective} - ${input.trajectory.substring(0, 200)}`;

        // Add timeout to search API (5 seconds max)
        const searchPromise = runYouSearchSummary(input.youApiKey, searchQuery, { maxResults: 3 });
        const searchTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('You.com search timed out after 5s')), 5000)
        );

        summary = await Promise.race([searchPromise, searchTimeout]) as string;
        usedAgentsApi = false;

        console.log('🔍 [SUMMARIZATION] You.com search fallback complete:', {
          hasSummary: !!summary,
          summaryLength: summary?.length || 0,
        });
      }
      
      // Apply finalization if enabled (polish with editor-style refinement)
      // NOTE: Finalization adds significant latency - only enable when necessary
      if (input.enableFinalization && input.finalizationProvider && input.fallbackApiKey) {
        try {
          summarizerDebug.debug('Starting finalization');
          const finalizationStartTime = Date.now();
          const { finalizeReport } = await import('../lib/finalizer');
          
          // Add timeout to finalization (10 seconds max)
          const finalizationPromise = finalizeReport(
            summary,
            input.knowledgeItems || [],
            {
              provider: input.finalizationProvider,
              apiKey: input.fallbackApiKey,
              model: input.finalizationModel,
            }
          );
          
          const finalizationTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Finalization timed out')), 10000)
          );
          
          summary = await Promise.race([finalizationPromise, finalizationTimeout]) as string;
          const finalizationDuration = Date.now() - finalizationStartTime;
          summarizerDebug.info('Finalization completed', { duration: finalizationDuration });
        } catch (finalizeError: any) {
          summarizerDebug.warn('Finalization failed or timed out', {
            error: finalizeError?.message,
            duration: Date.now() - startTime,
          });
          // Continue with original summary if finalization fails
        }
      }
      
      const duration = Date.now() - startTime;
      const stepCount = (input.trajectory.match(/step \d+/g) || []).length;

      console.log('🔍 [SUMMARIZATION] You.com API successful:', {
        usedAgentsApi,
        duration,
        summaryLength: summary.length,
      });

      const output: SummarizationStepOutput = {
        summary,
        duration,
        success: true,
        trajectoryLength: input.trajectory.length,
        stepCount,
      };
      
      // Validate output
      const { SummarizationStepOutputSchema } = await import('../schemas/workflow-schemas');
      return SummarizationStepOutputSchema.parse(output);
    } catch (error: any) {
      // Fall through to fallback logic below
      const errorMsg = error?.message || String(error);
      console.error('❌ [SUMMARIZATION] You.com API failed:', errorMsg);
      console.error('❌ [SUMMARIZATION] Error type:', error?.name || typeof error);
      
      summarizerDebug.error('You.com summarization failed', {
        error: errorMsg,
        errorType: error?.name,
        is401: errorMsg.includes('401'),
        is403: errorMsg.includes('403'),
        isTimeout: errorMsg.includes('timed out'),
      });
      
      if (errorMsg.includes('401') || errorMsg.includes('Invalid or expired API key')) {
        console.error('❌ [SUMMARIZATION] Authentication error - check You.com API key');
      } else if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
        console.error('❌ [SUMMARIZATION] Forbidden - check API key permissions');
      } else if (errorMsg.includes('timed out')) {
        console.error('❌ [SUMMARIZATION] Request timed out after 8s');
      } else {
        console.error('❌ [SUMMARIZATION] Unknown error:', errorMsg);
      }
    }
  }
  
  // Fallback: Use main AI model for summarization (always run if You.com fails or unavailable)
  console.log('🔍 [SUMMARIZATION] Checking fallback summarization...');
  console.log('🔍 [SUMMARIZATION] Fallback model present:', !!input.fallbackModel);
  console.log('🔍 [SUMMARIZATION] Fallback API key present:', !!input.fallbackApiKey);
  console.log('🔍 [SUMMARIZATION] Fallback API key length:', input.fallbackApiKey?.length || 0);

  summarizerDebug.info('Checking fallback summarization', {
    hasFallbackModel: !!input.fallbackModel,
    hasFallbackApiKey: !!input.fallbackApiKey,
    fallbackModelType: typeof input.fallbackModel,
    fallbackApiKeyLength: input.fallbackApiKey?.length || 0,
  });

  if (input.fallbackModel && input.fallbackApiKey) {
    console.log('🔍 [SUMMARIZATION] ✅ Fallback conditions met, proceeding with AI model summarization...');
    try {
      console.log('🔍 [SUMMARIZATION] Using fallback AI model for summarization...');
      summarizerDebug.debug('Using fallback AI model for summarization');
      
      const { generateText } = await import('ai');
      
      const fallbackPrompt = [
        'You are a browser automation analysis assistant. Summarize the execution and propose next actions.',
        '',
        '**Objective:**',
        input.objective,
        '',
        '**Execution Trajectory:**',
        input.trajectory,
        '',
        '**Outcome:**',
        input.outcome,
        '',
        '**Your task:** Summarize the execution trajectory, assess whether the objective was achieved and why, then propose exactly three high-impact next actions tailored to this context (include a short rationale and the recommended browser action or tool to execute). Return concise Markdown with sections: Summary, Goal assessment, Suggested next actions (1-3).',
      ].join('\n');
      
      console.log('🔍 [SUMMARIZATION] Preparing to call generateText...');
      summarizerDebug.debug('Calling generateText with fallback model', {
        promptLength: fallbackPrompt.length,
        modelType: typeof input.fallbackModel,
      });

      console.log('🔍 [SUMMARIZATION] Creating generateText promise...');
      // Add timeout to fallback summarization (8 seconds max - very aggressive)
      const fallbackPromise = generateText({
        model: input.fallbackModel,
        system: 'You are an expert at analyzing browser automation workflows and providing actionable insights.',
        prompt: fallbackPrompt,
        maxTokens: 400, // Further reduced from 600 to 400 for faster response
      });
      console.log('🔍 [SUMMARIZATION] generateText promise created, setting up timeout...');
      
      const fallbackTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Fallback summarization timed out after 8s')), 8000)
      );
      
      console.log('🔍 [SUMMARIZATION] Waiting for Promise.race (generateText vs timeout)...');
      const fallbackResult = await Promise.race([fallbackPromise, fallbackTimeout]) as any;

      console.log('🔍 [SUMMARIZATION] Promise.race resolved!');
      console.log('🔍 [SUMMARIZATION] Fallback generateText complete:', {
        hasResult: !!fallbackResult,
        hasText: !!fallbackResult?.text,
        textLength: fallbackResult?.text?.length || 0,
        resultType: typeof fallbackResult,
      });

      if (fallbackResult?.text) {
        console.log('🔍 [SUMMARIZATION] Sample of generated text:', fallbackResult.text.substring(0, 100) + '...');
      }
      
      let finalSummary = fallbackResult.text;
      const fallbackDuration = Date.now() - startTime;
      const stepCount = (input.trajectory.match(/step \d+/g) || []).length;
      
      // Apply finalization if enabled (polish with editor-style refinement)
      // NOTE: Finalization adds significant latency - only enable when necessary
      if (input.enableFinalization && input.finalizationProvider && input.fallbackApiKey) {
        try {
          summarizerDebug.debug('Starting finalization for fallback summary');
          const finalizationStartTime = Date.now();
          const { finalizeReport } = await import('../lib/finalizer');
          
          // Add timeout to finalization (10 seconds max)
          const finalizationPromise = finalizeReport(
            finalSummary,
            input.knowledgeItems || [],
            {
              provider: input.finalizationProvider,
              apiKey: input.fallbackApiKey,
              model: input.finalizationModel,
            }
          );
          
          const finalizationTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Finalization timed out')), 10000)
          );
          
          finalSummary = await Promise.race([finalizationPromise, finalizationTimeout]) as string;
          const finalizationDuration = Date.now() - finalizationStartTime;
          summarizerDebug.info('Finalization completed', { duration: finalizationDuration });
        } catch (finalizeError: any) {
          summarizerDebug.warn('Finalization failed or timed out', {
            error: finalizeError?.message,
            duration: Date.now() - startTime,
          });
          // Continue with original summary if finalization fails
        }
      }
      
      summarizerDebug.info('Fallback summarization successful', {
        summaryLength: finalSummary.length,
        duration: fallbackDuration,
        stepCount,
      });
      
      summarizerTimer();
      
      return {
        summary: finalSummary,
        duration: fallbackDuration,
        success: true,
        trajectoryLength: input.trajectory.length,
        stepCount,
      };
    } catch (fallbackError: any) {
      console.error('❌ [SUMMARIZATION] Fallback summarization failed:', fallbackError?.message || String(fallbackError));
      console.error('❌ [SUMMARIZATION] Fallback error type:', fallbackError?.name || typeof fallbackError);
      console.error('❌ [SUMMARIZATION] Fallback error stack:', fallbackError?.stack);
      summarizerDebug.error('Fallback summarization failed', fallbackError);
    }
  } else {
    console.warn('⚠️  [SUMMARIZATION] No fallback model available for summarization');
    console.warn('⚠️  [SUMMARIZATION] hasFallbackModel:', !!input.fallbackModel);
    console.warn('⚠️  [SUMMARIZATION] hasFallbackApiKey:', !!input.fallbackApiKey);
    summarizerDebug.warn('No fallback model available for summarization', {
      hasFallbackModel: !!input.fallbackModel,
      hasFallbackApiKey: !!input.fallbackApiKey,
    });
  }

  // If all attempts failed, return graceful failure
  const duration = Date.now() - startTime;
  summarizerTimer();

  console.log('❌ [SUMMARIZATION] All summarization attempts failed, returning empty summary');
  console.log('❌ [SUMMARIZATION] Total duration:', duration + 'ms');
  console.log('❌ [SUMMARIZATION] Trajectory length:', input.trajectory.length);

  summarizerDebug.warn('Summarization failed - returning empty summary', {
    duration,
    trajectoryLength: input.trajectory.length,
  });
  
  return {
    summary: '', // Empty summary - workflow will continue without it
    duration,
    success: false,
    trajectoryLength: input.trajectory.length,
    stepCount: 0,
  };
}
