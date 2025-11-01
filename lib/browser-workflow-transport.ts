/**
 * Browser Extension Compatible WorkflowChatTransport
 * 
 * Adapts WorkflowChatTransport pattern for browser extension context
 * Uses chrome.runtime messaging instead of HTTP endpoints
 * 
 * Based on: https://useworkflow.dev/docs/api-reference/workflow-ai/workflow-chat-transport
 */

import type { Message } from '../types';

export interface BrowserWorkflowTransportOptions {
  maxConsecutiveErrors?: number;
  onChatSendMessage?: (response: { workflowRunId: string }, options: any) => void;
  onChatEnd?: (data: { chatId: string; chunkIndex: number }) => void;
}

export class BrowserWorkflowTransport {
  private maxConsecutiveErrors: number;
  private errorCount: number = 0;
  private onChatSendMessage?: BrowserWorkflowTransportOptions['onChatSendMessage'];
  private onChatEnd?: BrowserWorkflowTransportOptions['onChatEnd'];
  private activeWorkflowRunId: string | null = null;

  constructor(options: BrowserWorkflowTransportOptions = {}) {
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? 3;
    this.onChatSendMessage = options.onChatSendMessage;
    this.onChatEnd = options.onChatEnd;

    // Load persisted workflow run ID
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['active-workflow-run-id'], (result) => {
        this.activeWorkflowRunId = result['active-workflow-run-id'] || null;
      });
    }
  }

  /**
   * Send messages and return a stream
   */
  async sendMessages(options: {
    messages: Message[];
    settings?: {
      provider: 'google' | 'gateway';
      apiKey: string;
      model?: string;
    };
  }): Promise<ReadableStream<Uint8Array>> {
    try {
      // Send workflow chat start request to background script
      const response = await new Promise<{
        success: boolean;
        workflowRunId?: string;
        error?: string;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'WORKFLOW_CHAT_START',
            messages: options.messages,
            settings: options.settings,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (!response.success || !response.workflowRunId) {
        throw new Error(response.error || 'Failed to start workflow chat');
      }

      this.activeWorkflowRunId = response.workflowRunId;
      this.errorCount = 0; // Reset error count on success

      // Store workflow run ID for resumption
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({
          'active-workflow-run-id': response.workflowRunId,
        });
      }

      // Notify callback
      if (this.onChatSendMessage) {
        this.onChatSendMessage(
          { workflowRunId: response.workflowRunId },
          options
        );
      }

      // Create stream from workflow execution
      // Note: In browser extension, we need to proxy through background script
      return this.createMessageStream(response.workflowRunId, options.messages);
    } catch (error) {
      this.errorCount++;
      if (this.errorCount >= this.maxConsecutiveErrors) {
        throw new Error(
          `Max consecutive errors (${this.maxConsecutiveErrors}) reached`
        );
      }
      throw error;
    }
  }

  /**
   * Reconnect to an interrupted stream
   */
  async reconnectToStream(runId: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const response = await new Promise<{
        success: boolean;
        error?: string;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'WORKFLOW_CHAT_RESUME',
            workflowRunId: runId,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (!response.success) {
        return null;
      }

      this.errorCount = 0; // Reset error count

      // Resume streaming (simplified - actual implementation would get stream from background)
      return this.createMessageStream(runId, []);
    } catch (error) {
      console.error('Failed to reconnect to stream:', error);
      return null;
    }
  }

  /**
   * Create message stream (simplified implementation)
   * In a real implementation, this would receive chunks from the background script
   */
  private createMessageStream(
    workflowRunId: string,
    messages: Message[]
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let chunkIndex = 0;

    return new ReadableStream({
      start: async (controller) => {
        try {
          // Listen for messages from background script
          const messageListener = (
            message: any,
            _sender: chrome.runtime.MessageSender,
            _sendResponse: (response?: any) => void
          ) => {
            if (message.type === 'WORKFLOW_CHAT_CHUNK' && message.workflowRunId === workflowRunId) {
              if (message.done) {
                // Stream finished
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();

                // Clean up
                chrome.runtime.onMessage.removeListener(messageListener);
                chrome.storage.local.remove('active-workflow-run-id');

                // Notify callback
                if (this.onChatEnd) {
                  this.onChatEnd({
                    chatId: workflowRunId,
                    chunkIndex,
                  });
                }
              } else {
                // Stream chunk
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(message.chunk)}\n\n`)
                );
                chunkIndex++;
              }
            }
          };

          chrome.runtime.onMessage.addListener(messageListener);

          // Request stream start from background
          chrome.runtime.sendMessage({
            type: 'WORKFLOW_CHAT_STREAM_START',
            workflowRunId,
            messages,
          });
        } catch (error) {
          controller.error(error);
        }
      },

      cancel: () => {
        // Cancel workflow
        if (this.activeWorkflowRunId) {
          chrome.runtime.sendMessage({
            type: 'WORKFLOW_CHAT_CANCEL',
            workflowRunId: this.activeWorkflowRunId,
          });
        }
      },
    });
  }
}

