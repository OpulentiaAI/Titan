import { traced } from '../lib/braintrust.js';
import type { Page } from 'puppeteer';
import { delay } from './utils.js';
import type { AtlasModel, AtlasResult, AtlasSettings, AtlasMessage } from './types.js';
import { browserAutomationWorkflow } from '../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput, BrowserAutomationWorkflowOutput } from '../schemas/workflow-schemas.js';
import type { Message, PageContext } from '../types.js';
import type { LanguageModelUsage } from 'ai';
import { createSandbox, startSandbox, cleanupSandbox, logStagehandEvent } from '../lib/sandbox-lifecycle.js';
import { emitToolLifecycle, getThreadManager } from '../lib/thread-manager.js';

/**
 * Puppeteer-based implementation of executeTool for test suite
 * Enhanced with ThreadManager lifecycle events and Braintrust spans
 */
async function executeTool(page: Page, toolName: string, params: any, toolCallId?: string): Promise<any> {
  const callId = toolCallId || `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Emit tool lifecycle: starting with params
  emitToolLifecycle({
    toolCallId: callId,
    toolName,
    phase: 'starting',
    metadata: { 
      params,
      toolName,
      callId,
    },
  });

  return await traced(
    `tool_${toolName}`,
    async () => {
      const toolStartTime = Date.now();
      
      try {
        // Emit tool lifecycle: executing
        emitToolLifecycle({
          toolCallId: callId,
          toolName,
          phase: 'executing',
          metadata: { params },
        });

        let result: any;

        switch (toolName) {
          case 'navigate': {
            if (!params.url) {
              throw new Error('navigate tool requires url parameter');
            }
            await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await delay(2500); // Wait for page to settle
            result = { success: true, url: page.url() };
            break;
          }
          case 'click': {
            if (params.selector) {
              await page.click(params.selector);
              await delay(500);
              result = { success: true, url: page.url() };
            } else if (params.x !== undefined && params.y !== undefined) {
              await page.mouse.click(params.x, params.y);
              await delay(500);
              result = { success: true, url: page.url() };
            } else {
              throw new Error('click tool requires selector or x,y coordinates');
            }
            break;
          }
          case 'type': {
            if (!params.text) {
              throw new Error('type tool requires text parameter');
            }
            if (params.selector) {
              await page.type(params.selector, params.text);
            } else {
              await page.keyboard.type(params.text);
            }
            await delay(500);
            result = { success: true, url: page.url() };
            break;
          }
          case 'pressKey': {
            if (!params.key) {
              throw new Error('pressKey tool requires key parameter');
            }
            await page.keyboard.press(params.key);
            await delay(500);
            result = { success: true, url: page.url() };
            break;
          }
          case 'keyCombo': {
            if (!params.keys || !Array.isArray(params.keys)) {
              throw new Error('keyCombo tool requires keys array parameter');
            }
            await page.keyboard.down(params.keys[0]);
            for (let i = 1; i < params.keys.length; i++) {
              await page.keyboard.down(params.keys[i]);
            }
            for (let i = params.keys.length - 1; i >= 0; i--) {
              await page.keyboard.up(params.keys[i]);
            }
            await delay(500);
            result = { success: true, url: page.url() };
            break;
          }
          case 'scroll': {
            const direction = params.direction || 'down';
            const amount = params.amount || 500;
            if (params.selector) {
              await page.evaluate((sel: string, dir: string, amt: number) => {
                const el = document.querySelector(sel);
                if (el) {
                  if (dir === 'down') el.scrollTop += amt;
                  else if (dir === 'up') el.scrollTop -= amt;
                  else if (dir === 'top') el.scrollTop = 0;
                  else if (dir === 'bottom') el.scrollTop = el.scrollHeight;
                }
              }, params.selector, direction, amount);
            } else {
              await page.evaluate((dir: string, amt: number) => {
                if (dir === 'down') window.scrollBy(0, amt);
                else if (dir === 'up') window.scrollBy(0, -amt);
                else if (dir === 'top') window.scrollTo(0, 0);
                else if (dir === 'bottom') window.scrollTo(0, document.body.scrollHeight);
              }, direction, amount);
            }
            await delay(500);
            result = { success: true, url: page.url() };
            break;
          }
          case 'getPageContext': {
            result = await getPageContext(page);
            break;
          }
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        // Emit tool lifecycle: completed with rich metadata
        const toolDuration = Date.now() - toolStartTime;
        const completedMetadata: any = { 
          params, // Include original params for reference
          result: result?.success !== false, 
          url: result?.url,
          duration: toolDuration,
        };
        
        // Add rich metadata for getPageContext
        if (toolName === 'getPageContext' && result) {
          completedMetadata.title = result.title;
          completedMetadata.links = result.links;
          completedMetadata.forms = result.forms;
          completedMetadata.viewport = result.viewport;
          completedMetadata.linkCount = result.links?.length || 0;
          completedMetadata.formCount = result.forms?.length || 0;
          completedMetadata.imageCount = result.images?.length || 0;
        }
        
        // Add pageContext for navigate tool
        if (toolName === 'navigate' && result) {
          completedMetadata.pageContext = result.pageContext || null;
        }
        
        emitToolLifecycle({
          toolCallId: callId,
          toolName,
          phase: 'completed',
          metadata: completedMetadata,
        });

        return result;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        
        // Emit tool lifecycle: error
        emitToolLifecycle({
          toolCallId: callId,
          toolName,
          phase: 'error',
          error: errorMsg,
          metadata: { params },
        });

        throw error;
      }
    }
  );
}

/**
 * Get page context (matching PageContext interface)
 * Using Function constructor to avoid __name injection in browser context
 */
async function getPageContext(page: Page): Promise<PageContext> {
  // Use evaluateHandle with a simple function to avoid __name in browser context
  return await page.evaluate(new Function(`
    return (function() {
      const links = Array.from(document.querySelectorAll('a')).slice(0, 50).map(function(a) {
        return {
          text: a.textContent ? a.textContent.trim() : '',
          href: a.href,
        };
      });

      const images = Array.from(document.querySelectorAll('img')).slice(0, 20).map(function(img) {
        return {
          alt: img.alt || '',
          src: img.src,
        };
      });

      const forms = Array.from(document.querySelectorAll('form')).map(function(f) {
        return {
          id: f.id || '',
          action: f.action || '',
          inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(function(i) {
            return {
              name: i.name || '',
              type: i.type || 'text',
            };
          }),
        };
      });

      const getMetaContent = function(name) {
        const meta = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
        return meta ? meta.getAttribute('content') : undefined;
      };

      return {
        url: window.location.href,
        title: document.title,
        textContent: document.body.innerText.slice(0, 10000),
        links: links,
        images: images,
        forms: forms,
        metadata: {
          description: getMetaContent('description') || getMetaContent('og:description'),
          keywords: getMetaContent('keywords'),
          author: getMetaContent('author'),
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          devicePixelRatio: window.devicePixelRatio,
        },
      };
    })();
  `) as any);
}

/**
 * Atlas Task - Uses workflow-based browser automation
 */
export async function atlasTask(
  model: AtlasModel,
  settings: AtlasSettings,
  userMessage: string
): Promise<AtlasResult> {
  const useBraintrust = !!settings.braintrustApiKey;
  
  const executeTask = async () => {
    const startTime = Date.now();
    const messages: AtlasMessage[] = [];
    let totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let steps = 0;
    let success = false;
    let error: string | undefined;
    let finalUrl: string | undefined;
    let screenshot: string | undefined;

    try {
      // Initialize browser with sandbox lifecycle logging
      logStagehandEvent('eval_start', { userMessage });
      
      const { browser, metrics: createMetrics } = await createSandbox({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      
      const { page, metrics: startMetrics } = await startSandbox(browser);
      
      const sandboxMetrics = {
        ...createMetrics,
        ...startMetrics,
      };

      // Add user message
      messages.push({
        id: `msg-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      });

      // Message management for workflow
      const workflowMessages: Message[] = [
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: userMessage,
        },
      ];
      
      let lastAssistantMessage: Message | null = null;
      
      const pushMessage = (msg: Message) => {
        workflowMessages.push(msg);
        // Preserve all artifacts when converting to AtlasMessage (including reasoning)
        messages.push({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: Date.now(),
          // Attach workflow artifacts
          planning: (msg as any).planning,
          summarization: (msg as any).summarization,
          executionTrajectory: (msg as any).executionTrajectory,
          workflowMetadata: (msg as any).workflowMetadata,
          pageContext: (msg as any).pageContext,
          workflowTasks: (msg as any).workflowTasks,
          toolExecutions: (msg as any).toolExecutions,
          // Attach reasoning tokens (OpenRouter/Atlas pattern)
          reasoning: (msg as any).reasoning,
          reasoningDetails: (msg as any).reasoningDetails,
        });
        if (msg.role === 'assistant') {
          lastAssistantMessage = msg;
        }
      };
      
      const updateLastMessage = (updater: (msg: Message) => Message) => {
        if (lastAssistantMessage) {
          const updatedMessage = updater(lastAssistantMessage);
          lastAssistantMessage = updatedMessage;
          const atlasMsg = messages.find(m => m.id === (updatedMessage?.id || ''));
          if (atlasMsg) {
            // Update content and preserve all artifacts (deep merge)
            atlasMsg.content = updatedMessage.content;
            
            // Only update artifacts that are defined in the updated message
            if ((updatedMessage as any).planning !== undefined) {
              (atlasMsg as any).planning = (updatedMessage as any).planning;
            }
            if ((updatedMessage as any).summarization !== undefined) {
              (atlasMsg as any).summarization = (updatedMessage as any).summarization;
            }
            if ((updatedMessage as any).executionTrajectory !== undefined) {
              (atlasMsg as any).executionTrajectory = (updatedMessage as any).executionTrajectory;
            }
            if ((updatedMessage as any).workflowMetadata !== undefined) {
              (atlasMsg as any).workflowMetadata = (updatedMessage as any).workflowMetadata;
            }
            if ((updatedMessage as any).pageContext !== undefined) {
              (atlasMsg as any).pageContext = (updatedMessage as any).pageContext;
            }
            if ((updatedMessage as any).workflowTasks !== undefined) {
              (atlasMsg as any).workflowTasks = (updatedMessage as any).workflowTasks;
            }
            if ((updatedMessage as any).toolExecutions !== undefined) {
              (atlasMsg as any).toolExecutions = (updatedMessage as any).toolExecutions;
            }
            // Preserve reasoning tokens (OpenRouter/Atlas pattern)
            if ((updatedMessage as any).reasoning !== undefined) {
              (atlasMsg as any).reasoning = (updatedMessage as any).reasoning;
            }
            if ((updatedMessage as any).reasoningDetails !== undefined) {
              (atlasMsg as any).reasoningDetails = (updatedMessage as any).reasoningDetails;
            }
          }
        }
      };

      // Prepare workflow input
      const workflowInput: BrowserAutomationWorkflowInput = {
        userQuery: userMessage,
        settings: {
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          braintrustApiKey: settings.braintrustApiKey,
          braintrustProjectName: settings.braintrustProjectName,
          youApiKey: settings.youApiKey,
          computerUseEngine: settings.computerUseEngine,
        },
        initialContext: {
          currentUrl: page.url(),
          pageContext: await getPageContext(page),
        },
        metadata: {
          timestamp: Date.now(),
        },
      };

      // Create context functions for workflow with ThreadManager integration
      const executeToolForWorkflow = async (toolName: string, params: any, toolCallId?: string) => {
        return await executeTool(page, toolName, params, toolCallId);
      };

      const enrichToolResponse = async (res: any, _toolName: string) => {
        try {
          const pageCtx = await getPageContext(page);
          return {
            success: res?.success !== false,
            url: pageCtx.url || res?.url,
            pageContext: pageCtx,
          };
        } catch (_e) {
          return { success: res?.success !== false, url: res?.url };
        }
      };

      const getPageContextAfterAction = async (): Promise<PageContext> => {
        return await getPageContext(page);
      };

      // Execute workflow
      console.log(`[Workflow] Starting browser automation workflow...`);
      const workflowOutput: BrowserAutomationWorkflowOutput = await browserAutomationWorkflow(
        workflowInput,
        {
          executeTool: executeToolForWorkflow,
          enrichToolResponse,
          getPageContextAfterAction,
          updateLastMessage,
          pushMessage,
          settings: workflowInput.settings,
          messages: workflowMessages,
        }
      );

      // Extract metrics from workflow output
      steps = workflowOutput.executionTrajectory.length;
      success = workflowOutput.success;
      finalUrl = workflowOutput.finalUrl;
      
      // Aggregate usage from workflow steps
      if (workflowOutput.streaming?.usage) {
        const usage = workflowOutput.streaming.usage as any; // Braintrust eval accepts flexible usage format
        totalUsage.promptTokens = usage.promptTokens || usage.inputTokens || 0;
        totalUsage.completionTokens = usage.completionTokens || usage.outputTokens || 0;
        totalUsage.totalTokens = usage.totalTokens || (totalUsage.promptTokens + totalUsage.completionTokens);
      }
      
      // Log workflow summary
      console.log(`[Workflow] Completed: success=${success}, steps=${steps}, duration=${Date.now() - startTime}ms`);
      console.log(`[Workflow] Planning: ${workflowOutput.planning?.duration || 0}ms`);
      console.log(`[Workflow] Streaming: ${workflowOutput.streaming?.duration || 0}ms`);
      console.log(`[Workflow] Summarization: ${workflowOutput.summarization?.duration || 0}ms`);

      // Capture screenshot
      screenshot = await page.screenshot({ encoding: 'base64' });

      // Cleanup sandbox with lifecycle logging
      const cleanupMetrics = await cleanupSandbox(browser, [page]);
      logStagehandEvent('eval_complete', {
        success,
        steps,
        sandbox_metrics: { ...sandboxMetrics, ...cleanupMetrics },
      });

      if (workflowOutput.error) {
        error = workflowOutput.error;
      }

      // Convert usage to LanguageModelUsage format
      // Braintrust eval accepts flexible usage format - map to both old and new formats
      const usage: LanguageModelUsage = {
        promptTokens: totalUsage.promptTokens,
        completionTokens: totalUsage.completionTokens,
        totalTokens: totalUsage.totalTokens,
        // Also include V2 format for compatibility
        inputTokens: totalUsage.promptTokens,
        outputTokens: totalUsage.completionTokens,
      } as unknown as LanguageModelUsage;

      return {
        success,
        steps,
        usage,
        executionTime: Date.now() - startTime,
        finalUrl,
        screenshot: `data:image/png;base64,${screenshot}`,
        messages,
        error,
      };
    } catch (e: any) {
      error = e.message || String(e);
      success = false;
      
      // Log full error details for debugging
      console.error('[atlasTask] Full error details:', {
        message: e.message,
        stack: e.stack,
        name: e.name,
        error: e,
      });
      
      logStagehandEvent('eval_error', {
        error,
        steps,
        execution_time_ms: Date.now() - startTime,
      });

      return {
        success: false,
        steps,
        usage: totalUsage,
        executionTime: Date.now() - startTime,
        error,
        messages,
      };
    }
  };

  // Wrap with Braintrust if enabled
  if (useBraintrust && settings.braintrustApiKey) {
    return await traced(
      'atlas_browser_automation_workflow',
      async () => {
        const result = await executeTask();
        
        // Get ThreadManager history for telemetry
        const threadManager = getThreadManager();
        const toolLifecycleHistory = threadManager.getHistory();
        
        // Attach tool lifecycle history to result for eval output
        // Note: This extends AtlasResult but Braintrust eval accepts it
        return {
          ...result,
          toolLifecycleEvents: toolLifecycleHistory,
        } as AtlasResult & { toolLifecycleEvents?: any[] };
      }
    );
  } else {
    const result = await executeTask();
    const threadManager = getThreadManager();
    const toolLifecycleHistory = threadManager.getHistory();
    return {
      ...result,
      toolLifecycleEvents: toolLifecycleHistory,
    } as AtlasResult & { toolLifecycleEvents?: any[] };
  }
}
