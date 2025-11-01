// Agent Test with You.com API Key
// Tests workflow execution with real You.com API integration

import { browserAutomationWorkflow } from '../../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput } from '../../schemas/workflow-schemas.js';
import type { Message, PageContext } from '../../types.js';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { initializeBraintrust } from '../../lib/braintrust.js';
import { validatePreflight, logPreflightResults, assertPreflight, getEnvVar } from '../../lib/preflight-validation.js';

const LOG_PREFIX = '🤖 [AGENT-TEST]';

// Set critical environment variables
process.env.YOU_API_KEY = process.env.YOU_API_KEY || ''; // Coming soon - feature flagged
process.env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY || 'vck_0IbZbrEJ0S1AOnRjsFzIicZ8mzTfZqBLaS2PuKY5S72fLGfnKD025hVw';

// Clean the API key (remove any separators or encoding)
const YOU_API_KEY = process.env.YOU_API_KEY;
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;

interface AgentTestResult {
  testName: string;
  success: boolean;
  duration: number;
  workflow: {
    planning: { success: boolean; steps: number; confidence: number };
    execution: { toolCalls: number; steps: number };
    summarization: { success: boolean; duration: number; length: number };
  };
  artifacts: {
    planning: boolean;
    pageContext: boolean;
    executionTrajectory: boolean;
    summarization: boolean;
    workflowMetadata: boolean;
  };
  queue: {
    tasksCreated: boolean;
    tasksUpdated: boolean;
    finalStatus: 'all_completed' | 'partial' | 'failed';
  };
  error?: string;
}

async function runAgentTest(): Promise<AgentTestResult> {
  const startTime = Date.now();
  const testName = 'Agent Workflow with You.com API';
  
  console.log('\n' + '='.repeat(80));
  console.log('🤖 AGENT TEST WITH YOU.COM API');
  console.log('='.repeat(80));
  
  // Run preflight validation
  const preflightResult = validatePreflight(process.env);
  logPreflightResults(preflightResult, true);
  
  // Assert preflight passes (throw if critical vars missing)
  try {
    assertPreflight(preflightResult);
    console.log(`${LOG_PREFIX} ✅ Preflight validation passed - proceeding with test\n`);
  } catch (error: any) {
    console.error(`${LOG_PREFIX} ❌ Preflight validation failed: ${error.message}\n`);
    throw error;
  }
  
  console.log(`\n${LOG_PREFIX} Starting test: ${testName}`);
  console.log(`${LOG_PREFIX} You.com API Key: ${YOU_API_KEY ? YOU_API_KEY.substring(0, 20) + '...' + YOU_API_KEY.substring(YOU_API_KEY.length - 10) : 'not set'}`);
  console.log(`${LOG_PREFIX} AI Gateway API Key: ${AI_GATEWAY_API_KEY ? AI_GATEWAY_API_KEY.substring(0, 20) + '...' + AI_GATEWAY_API_KEY.substring(AI_GATEWAY_API_KEY.length - 10) : 'not set'}`);
  
  let browser: puppeteer.Browser | null = null;
  let page: Page | null = null;
  
  try {
    // Initialize browser
    console.log(`\n${LOG_PREFIX} 🌐 Launching browser...`);
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to a test page
    const testUrl = 'https://sdk.vercel.ai';
    console.log(`${LOG_PREFIX} 📍 Navigating to: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Get initial page context
    const initialContext: PageContext = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        text: document.body.innerText.substring(0, 5000),
        textContent: document.body.textContent?.substring(0, 5000) || '',
        links: Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
          text: a.textContent?.trim() || '',
          href: a.href || '',
        })),
        forms: Array.from(document.querySelectorAll('form')).map(f => ({
          action: f.action || '',
          method: f.method || 'get',
        })),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    });
    
    console.log(`${LOG_PREFIX} ✅ Page context retrieved (${initialContext.text.length} chars)`);
    
    // Mock tool execution functions
    const messages: Message[] = [{
      id: Date.now().toString(),
      role: 'user',
      content: 'Find information about Vercel AI SDK',
    }];
    
    let lastMessage: Message | null = null;
    
    const executeTool = async (toolName: string, params: any): Promise<any> => {
      console.log(`${LOG_PREFIX} 🛠️  Executing tool: ${toolName}`, params);
      
      if (toolName === 'navigate') {
        const url = params.url || params;
        if (page) {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          return { success: true, url: page.url() };
        }
      } else if (toolName === 'getPageContext') {
        if (page) {
          const context = await page.evaluate(() => {
            return {
              url: window.location.href,
              title: document.title,
              text: document.body.innerText.substring(0, 5000),
            };
          });
          return { success: true, ...context };
        }
      }
      
      return { success: true };
    };
    
    const enrichToolResponse = async (res: any, toolName: string): Promise<any> => {
      return res;
    };
    
    const getPageContextAfterAction = async (): Promise<PageContext> => {
      if (!page) throw new Error('Page not available');
      return await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          text: document.body.innerText.substring(0, 5000),
          textContent: document.body.textContent?.substring(0, 5000) || '',
          links: Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
            text: a.textContent?.trim() || '',
            href: a.href || '',
          })),
          forms: [],
          viewport: { width: window.innerWidth, height: window.innerHeight },
        };
      });
    };
    
    const updateLastMessage = (updater: (msg: Message) => Message) => {
      if (lastMessage) {
        lastMessage = updater(lastMessage);
      } else {
        lastMessage = updater(messages[messages.length - 1]);
      }
      console.log(`${LOG_PREFIX} 📝 Message updated:`, {
        hasWorkflowTasks: !!lastMessage.workflowTasks,
        taskCount: lastMessage.workflowTasks?.length || 0,
        hasSummarization: !!lastMessage.summarization,
      });
    };
    
    const pushMessage = (msg: Message) => {
      messages.push(msg);
      lastMessage = msg;
      console.log(`${LOG_PREFIX} 📨 Message pushed:`, {
        role: msg.role,
        hasWorkflowTasks: !!msg.workflowTasks,
        taskCount: msg.workflowTasks?.length || 0,
      });
    };
    
    // Initialize Braintrust if available
    const braintrustKey = process.env.BRAINTRUST_API_KEY;
    if (braintrustKey) {
      await initializeBraintrust(braintrustKey, 'agent-test-you-api');
      console.log(`${LOG_PREFIX} ✅ Braintrust initialized`);
    }
    
    // Prepare workflow input
    // Use AI_GATEWAY_API_KEY with fallback to other gateway keys
    const gatewayApiKey = getEnvVar('AI_GATEWAY_API_KEY') || 
                          getEnvVar('GATEWAY_API_KEY') || 
                          getEnvVar('OPENAI_API_KEY') || 
                          getEnvVar('ANTHROPIC_API_KEY') || '';
    
    if (!gatewayApiKey) {
      throw new Error('No Gateway API key found. Preflight should have caught this.');
    }
    
    const workflowInput: BrowserAutomationWorkflowInput = {
      userQuery: 'Find information about Vercel AI SDK and summarize key features',
      settings: {
        provider: 'gateway',
        model: 'google/gemini-2.5-flash-lite',
        apiKey: gatewayApiKey,
        youApiKey: YOU_API_KEY || '',
      },
      initialContext: {
        currentUrl: initialContext.url,
        pageContext: initialContext,
      },
      metadata: {
        conversationId: `test-${Date.now()}`,
      },
    };
    
    console.log(`\n${LOG_PREFIX} 🚀 Starting workflow execution...`);
    console.log(`${LOG_PREFIX} Query: ${workflowInput.userQuery}`);
    console.log(`${LOG_PREFIX} Provider: ${workflowInput.settings.provider}`);
    console.log(`${LOG_PREFIX} Model: ${workflowInput.settings.model}`);
    console.log(`${LOG_PREFIX} Has You.com API Key: ${!!workflowInput.settings.youApiKey}`);
    
    // Execute workflow
    const result = await browserAutomationWorkflow(workflowInput, {
      executeTool,
      enrichToolResponse,
      getPageContextAfterAction,
      updateLastMessage,
      pushMessage,
      settings: workflowInput.settings,
      messages,
    });
    
    const duration = Date.now() - startTime;
    
    // Validate results
    const artifacts = {
      planning: !!result.planning,
      pageContext: !!result.pageContext,
      executionTrajectory: !!result.executionTrajectory && result.executionTrajectory.length > 0,
      summarization: !!result.summarization && !!result.summarization.summary,
      workflowMetadata: !!result.workflowMetadata,
    };
    
    const queue = {
      tasksCreated: !!lastMessage?.workflowTasks && lastMessage.workflowTasks.length > 0,
      tasksUpdated: lastMessage?.workflowTasks?.some(t => t.status !== 'pending') || false,
      finalStatus: (() => {
        const tasks = lastMessage?.workflowTasks || [];
        const allCompleted = tasks.every(t => t.status === 'completed');
        const anyCompleted = tasks.some(t => t.status === 'completed');
        if (allCompleted) return 'all_completed';
        if (anyCompleted) return 'partial';
        return 'failed';
      })() as 'all_completed' | 'partial' | 'failed',
    };
    
    console.log(`\n${LOG_PREFIX} ✅ Workflow completed in ${(duration / 1000).toFixed(2)}s`);
    console.log(`${LOG_PREFIX} Planning: ${result.planning ? '✅' : '❌'}`);
    console.log(`${LOG_PREFIX} Execution Steps: ${result.executionTrajectory?.length || 0}`);
    console.log(`${LOG_PREFIX} Summarization: ${result.summarization?.success ? '✅' : '❌'} (${result.summarization?.duration || 0}ms)`);
    console.log(`${LOG_PREFIX} Workflow Tasks: ${lastMessage?.workflowTasks?.length || 0} tasks`);
    console.log(`${LOG_PREFIX} Queue Status: ${queue.finalStatus}`);
    
    return {
      testName,
      success: true,
      duration,
      workflow: {
        planning: {
          success: !!result.planning,
          steps: result.planning?.plan?.steps?.length || 0,
          confidence: result.planning?.confidence || 0,
        },
        execution: {
          toolCalls: result.executionTrajectory?.length || 0,
          steps: result.executionTrajectory?.length || 0,
        },
        summarization: {
          success: result.summarization?.success || false,
          duration: result.summarization?.duration || 0,
          length: result.summarization?.summary?.length || 0,
        },
      },
      artifacts,
      queue,
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n${LOG_PREFIX} ❌ Test failed after ${(duration / 1000).toFixed(2)}s:`, error?.message || String(error));
    
    return {
      testName,
      success: false,
      duration,
      workflow: {
        planning: { success: false, steps: 0, confidence: 0 },
        execution: { toolCalls: 0, steps: 0 },
        summarization: { success: false, duration: 0, length: 0 },
      },
      artifacts: {
        planning: false,
        pageContext: false,
        executionTrajectory: false,
        summarization: false,
        workflowMetadata: false,
      },
      queue: {
        tasksCreated: false,
        tasksUpdated: false,
        finalStatus: 'failed',
      },
      error: error?.message || String(error),
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log(`${LOG_PREFIX} 🧹 Browser closed`);
    }
  }
}

// Run the test
runAgentTest()
  .then((result) => {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`\n✅ Test: ${result.testName}`);
    console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`🎯 Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    
    if (result.success) {
      console.log(`\n📋 Workflow Results:`);
      console.log(`   Planning: ${result.workflow.planning.success ? '✅' : '❌'} (${result.workflow.planning.steps} steps, ${(result.workflow.planning.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`   Execution: ${result.workflow.execution.toolCalls} tool calls`);
      console.log(`   Summarization: ${result.workflow.summarization.success ? '✅' : '❌'} (${result.workflow.summarization.duration}ms, ${result.workflow.summarization.length} chars)`);
      
      console.log(`\n🎨 Artifacts:`);
      console.log(`   Planning: ${result.artifacts.planning ? '✅' : '❌'}`);
      console.log(`   Page Context: ${result.artifacts.pageContext ? '✅' : '❌'}`);
      console.log(`   Execution Trajectory: ${result.artifacts.executionTrajectory ? '✅' : '❌'}`);
      console.log(`   Summarization: ${result.artifacts.summarization ? '✅' : '❌'}`);
      console.log(`   Workflow Metadata: ${result.artifacts.workflowMetadata ? '✅' : '❌'}`);
      
      console.log(`\n📊 Queue:`);
      console.log(`   Tasks Created: ${result.queue.tasksCreated ? '✅' : '❌'}`);
      console.log(`   Tasks Updated: ${result.queue.tasksUpdated ? '✅' : '❌'}`);
      console.log(`   Final Status: ${result.queue.finalStatus}`);
    } else {
      console.log(`\n❌ Error: ${result.error}`);
    }
    
    console.log('\n');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error(`\n${LOG_PREFIX} ❌ Fatal error:`, error);
    process.exit(1);
  });

