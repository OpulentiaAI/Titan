/**
 * Workflow-based Chat Handler
 * 
 * Provides workflow-based chat endpoints compatible with WorkflowChatTransport
 * For browser extension: Uses chrome.runtime messaging
 * For Next.js: Can be used as API route handler
 * 
 * Based on: https://useworkflow.dev/docs/api-reference/workflow-ai/workflow-chat-transport
 */

import type { Message } from '../types';
import { startWorkflow, endWorkflow } from './workflow-utils';

export interface WorkflowChatRequest {
  messages: Message[];
  workflowRunId?: string; // For resumption
  settings?: {
    provider: 'google' | 'gateway';
    apiKey: string;
    model?: string;
  };
}

export interface WorkflowChatResponse {
  workflowRunId: string;
  stream: ReadableStream<Uint8Array>;
}

// Store active workflow runs (in browser extension, use chrome.storage)
const activeWorkflowRuns = new Map<string, {
  startTime: number;
  messages: Message[];
  abortController?: AbortController;
}>();

/**
 * Start a new workflow-based chat session
 */
export async function startWorkflowChat(
  request: WorkflowChatRequest
): Promise<WorkflowChatResponse> {
  const workflowRunId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // Store workflow run info
  activeWorkflowRuns.set(workflowRunId, {
    startTime: Date.now(),
    messages: request.messages,
  });

  // Start workflow tracking
  startWorkflow(workflowRunId);

  // Create abort controller for cancellation
  const abortController = new AbortController();
  activeWorkflowRuns.get(workflowRunId)!.abortController = abortController;

  // Create stream for chat response
  const stream = createChatStream(workflowRunId, request, abortController.signal);

  return {
    workflowRunId,
    stream,
  };
}

/**
 * Resume an interrupted workflow chat stream
 */
export async function resumeWorkflowChat(
  workflowRunId: string
): Promise<ReadableStream<Uint8Array> | null> {
  const workflowRun = activeWorkflowRuns.get(workflowRunId);
  
  if (!workflowRun) {
    console.warn(`Workflow run ${workflowRunId} not found`);
    return null;
  }

  // Create new abort controller for resumed stream
  const abortController = new AbortController();
  workflowRun.abortController = abortController;

  // Resume streaming
  const stream = createChatStream(
    workflowRunId,
    {
      messages: workflowRun.messages,
      workflowRunId,
    },
    abortController.signal
  );

  return stream;
}

/**
 * Create a chat stream that can be resumed
 */
function createChatStream(
  workflowRunId: string,
  request: WorkflowChatRequest,
  abortSignal: AbortSignal
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  return new ReadableStream({
    async start(controller) {
      try {
        // Import chat handler (uses browser automation workflow)
        const { browserAutomationWorkflow } = await import('../workflows/browser-automation-workflow');
        
        // Get settings from request or storage
        const settings = request.settings || await getSettings();
        
        if (!settings) {
          controller.error(new Error('Settings not available'));
          return;
        }

        // Prepare workflow input
        const lastUserMessage = request.messages
          .filter(m => m.role === 'user')
          .slice(-1)[0];

        if (!lastUserMessage) {
          controller.error(new Error('No user message found'));
          return;
        }

        // Create context for workflow
        const context = {
          executeTool: async (toolName: string, params: any) => {
            // Send tool execution request to background script
            if (typeof chrome === 'undefined' || !chrome.runtime) {
              throw new Error('Chrome runtime not available');
            }
            
            return new Promise((resolve, reject) => {
              chrome.runtime.sendMessage(
                {
                  type: 'EXECUTE_TOOL',
                  toolName,
                  params,
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else if (response?.success) {
                    resolve(response.result);
                  } else {
                    reject(new Error(response?.error || 'Tool execution failed'));
                  }
                }
              );
            });
          },
          enrichToolResponse: async (res: any, toolName: string) => res,
          getPageContextAfterAction: async () => {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
              throw new Error('Chrome runtime not available');
            }
            
            return new Promise((resolve, reject) => {
              chrome.runtime.sendMessage(
                { type: 'GET_PAGE_CONTEXT' },
                (response) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(response);
                  }
                }
              );
            });
          },
          updateLastMessage: (updater: (msg: Message) => Message) => {
            // Send update message to sidepanel
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage({
                type: 'UPDATE_MESSAGE',
                updater: updater.toString(), // Simplified - in real impl, use structured update
              });
            }
          },
          pushMessage: (msg: Message) => {
            // Send new message to sidepanel
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage({
                type: 'PUSH_MESSAGE',
                message: msg,
              });
            }
          },
          settings: {
            provider: settings.provider,
            apiKey: settings.apiKey,
            model: settings.model,
          },
          messages: request.messages,
          abortSignal,
          // Task management handlers using stored TaskManager
          retryTask: (taskId: string) => {
            const taskManager = (globalThis as any).currentWorkflowTaskManager;
            if (taskManager && typeof taskManager.retryTask === 'function') {
              taskManager.retryTask(taskId, 'Retried from UI');
            }
          },
          cancelTask: (taskId: string) => {
            const taskManager = (globalThis as any).currentWorkflowTaskManager;
            if (taskManager && typeof taskManager.cancelTask === 'function') {
              taskManager.cancelTask(taskId);
            }
          },
        };

        // Run workflow
        const workflowResult = await browserAutomationWorkflow(
          {
            userQuery: lastUserMessage.content,
            settings: {
              provider: settings.provider,
              apiKey: settings.apiKey,
              model: settings.model,
            },
          },
          context
        );

        // Store TaskManager for UI task management
        if (workflowResult.taskManager) {
          // Store TaskManager globally or in some accessible location
          (globalThis as any).currentWorkflowTaskManager = workflowResult.taskManager;
        }

        // Stream workflow result
        const resultText = JSON.stringify({
          type: 'workflow_complete',
          result: workflowResult.summary || workflowResult.finalResponse,
        });

        controller.enqueue(encoder.encode(`data: ${resultText}\n\n`));
        chunkIndex++;

        // Send finish chunk
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        
        // End workflow tracking
        endWorkflow(workflowRunId);
        
        // Clean up
        activeWorkflowRuns.delete(workflowRunId);
        
        controller.close();
      } catch (error) {
        console.error('Workflow chat error:', error);
        
        // Send error chunk
        const errorText = JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
        
        controller.enqueue(encoder.encode(`data: ${errorText}\n\n`));
        controller.close();
      }
    },
    
    cancel() {
      // Clean up on cancellation
      const workflowRun = activeWorkflowRuns.get(workflowRunId);
      if (workflowRun?.abortController) {
        workflowRun.abortController.abort();
      }
      activeWorkflowRuns.delete(workflowRunId);
      endWorkflow(workflowRunId);
    },
  });
}

/**
 * Get settings from chrome.storage
 */
async function getSettings(): Promise<{
  provider: 'google' | 'gateway';
  apiKey: string;
  model?: string;
} | null> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return null;
  }
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        resolve(result.settings);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Cancel a workflow chat session
 */
export function cancelWorkflowChat(workflowRunId: string): boolean {
  const workflowRun = activeWorkflowRuns.get(workflowRunId);
  
  if (!workflowRun) {
    return false;
  }

  if (workflowRun.abortController) {
    workflowRun.abortController.abort();
  }

  activeWorkflowRuns.delete(workflowRunId);
  endWorkflow(workflowRunId);
  
  return true;
}

/**
 * Get workflow run status
 */
export function getWorkflowRunStatus(workflowRunId: string): {
  exists: boolean;
  startTime?: number;
  messageCount?: number;
} | null {
  const workflowRun = activeWorkflowRuns.get(workflowRunId);
  
  if (!workflowRun) {
    return null;
  }

  return {
    exists: true,
    startTime: workflowRun.startTime,
    messageCount: workflowRun.messages.length,
  };
}

