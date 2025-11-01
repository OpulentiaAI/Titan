// E2E Workflow Verification Test
// Comprehensive test for end-to-end workflow completion with granular logging
// Verifies: queue management, tool execution, summarization, artifact generation

import { browserAutomationWorkflow } from '../../workflows/browser-automation-workflow.js';
import { createOpenAI } from '@ai-sdk/openai';
import { validatePreflight, logPreflightResults, assertPreflight, getEnvVar } from '../../lib/preflight-validation.js';
import { isFeatureEnabled } from '../../lib/feature-flags.js';
import type { Message, PageContext } from '../../types.js';

const LOG_PREFIX = '🧪 [E2E-VERIFICATION]';

// Set critical environment variables
process.env.YOU_API_KEY = process.env.YOU_API_KEY || ''; // Feature flagged
process.env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY || 'vck_0IbZbrEJ0S1AOnRjsFzIicZ8mzTfZqBLaS2PuKY5S72fLGfnKD025hVw';

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;

interface WorkflowVerificationResult {
  success: boolean;
  workflowCompleted: boolean;
  queueManagement: {
    initialized: boolean;
    planUpdated: boolean;
    executeUpdated: boolean;
    summarizeUpdated: boolean;
    finalStateCorrect: boolean;
  };
  toolExecution: {
    toolsCalled: number;
    toolsSuccessful: number;
    toolNames: string[];
    errors: string[];
  };
  summarization: {
    completed: boolean;
    hasSummary: boolean;
    summaryLength: number;
    duration: number;
  };
  artifacts: {
    hasSummaryArtifact: boolean;
    hasWorkflowMetadata: boolean;
    hasExecutionTrajectory: boolean;
  };
  performance: {
    totalDuration: number;
    planningDuration: number;
    executionDuration: number;
    summarizationDuration: number;
  };
  logs: string[];
}

class GranularLogger {
  private logs: string[] = [];
  private timestamps: Map<string, number> = new Map();

  log(phase: string, message: string, data?: any): void {
    const timestamp = Date.now();
    const elapsed = this.timestamps.has(phase) 
      ? ` (+${timestamp - this.timestamps.get(phase)!}ms)`
      : '';
    this.timestamps.set(phase, timestamp);
    
    const logEntry = `[${new Date(timestamp).toISOString()}] ${phase}${elapsed}: ${message}`;
    const fullLog = data ? `${logEntry}\n  Data: ${JSON.stringify(data, null, 2)}` : logEntry;
    
    this.logs.push(fullLog);
    console.log(`🔍 ${LOG_PREFIX} ${fullLog}`);
  }

  startPhase(phase: string): void {
    this.timestamps.set(phase, Date.now());
    this.log(phase, 'Starting');
  }

  endPhase(phase: string, duration: number): void {
    this.log(phase, `Completed in ${duration}ms`);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
    this.timestamps.clear();
  }
}

async function runE2EVerification(): Promise<WorkflowVerificationResult> {
  const logger = new GranularLogger();
  const result: WorkflowVerificationResult = {
    success: false,
    workflowCompleted: false,
    queueManagement: {
      initialized: false,
      planUpdated: false,
      executeUpdated: false,
      summarizeUpdated: false,
      finalStateCorrect: false,
    },
    toolExecution: {
      toolsCalled: 0,
      toolsSuccessful: 0,
      toolNames: [],
      errors: [],
    },
    summarization: {
      completed: false,
      hasSummary: false,
      summaryLength: 0,
      duration: 0,
    },
    artifacts: {
      hasSummaryArtifact: false,
      hasWorkflowMetadata: false,
      hasExecutionTrajectory: false,
    },
    performance: {
      totalDuration: 0,
      planningDuration: 0,
      executionDuration: 0,
      summarizationDuration: 0,
    },
    logs: [],
  };

  console.log('\n' + '='.repeat(80));
  console.log('🧪 E2E WORKFLOW VERIFICATION TEST');
  console.log('='.repeat(80));
  console.log(`Feature Flags:`);
  console.log(`  useAiSdkToolCalls: ${isFeatureEnabled('useAiSdkToolCalls')}`);
  console.log(`  useYouAdvancedAgent: ${isFeatureEnabled('useYouAdvancedAgent')}`);
  console.log(`  enableWorkflowQueue: ${isFeatureEnabled('enableWorkflowQueue')}`);
  console.log('='.repeat(80) + '\n');

  try {
    // ============================================
    // PHASE 1: Preflight Validation
    // ============================================
    logger.startPhase('PREFLIGHT');
    const preflightResult = validatePreflight(process.env);
    logPreflightResults(preflightResult);
    
    if (!preflightResult.criticalPassed) {
      throw new Error(`Preflight validation failed: ${preflightResult.missingCritical.join(', ')}`);
    }
    logger.endPhase('PREFLIGHT', 50);

    // ============================================
    // PHASE 2: Setup - Initialize Model & Context
    // ============================================
    logger.startPhase('SETUP');
    
    const openai = createOpenAI({
      apiKey: AI_GATEWAY_API_KEY,
      baseURL: 'https://gateway.ai.vercel.com/v1',
      headers: {
        'X-Vercel-AI-Provider': 'openai',
      },
    });
    
    const model = openai('gpt-4o-mini');
    
    // Track workflow messages and state
    let workflowMessages: Message[] = [];
    let lastMessage: Message | null = null;
    let taskUpdateHistory: Array<{ phase: string; tasks: any[] }> = [];
    
    // Mock tool execution
    const toolCallHistory: Array<{ name: string; params: any; success: boolean; error?: string }> = [];
    
    const executeTool = async (toolName: string, params: any): Promise<any> => {
      logger.log('TOOL_EXECUTION', `Calling tool: ${toolName}`, { params });
      
      toolCallHistory.push({
        name: toolName,
        params,
        success: false, // Will be updated on success
      });
      
      result.toolExecution.toolsCalled++;
      result.toolExecution.toolNames.push(toolName);
      
      try {
        // Simulate tool execution
        if (toolName === 'navigate') {
          const mockResult = {
            success: true,
            url: params.url || 'https://example.com',
            title: 'Example Page',
          };
          toolCallHistory[toolCallHistory.length - 1].success = true;
          result.toolExecution.toolsSuccessful++;
          logger.log('TOOL_EXECUTION', `✅ ${toolName} succeeded`, mockResult);
          return mockResult;
        } else if (toolName === 'getPageContext') {
          const mockResult: PageContext = {
            url: 'https://example.com',
            title: 'Example Page',
            text: 'Sample page content for testing',
            links: [],
            formFields: [],
            buttons: [],
            images: [],
          };
          toolCallHistory[toolCallHistory.length - 1].success = true;
          result.toolExecution.toolsSuccessful++;
          logger.log('TOOL_EXECUTION', `✅ ${toolName} succeeded`, { url: mockResult.url });
          return mockResult;
        } else {
          throw new Error(`Unknown tool: ${toolName}`);
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        toolCallHistory[toolCallHistory.length - 1].error = errorMsg;
        result.toolExecution.errors.push(`${toolName}: ${errorMsg}`);
        logger.log('TOOL_EXECUTION', `❌ ${toolName} failed`, { error: errorMsg });
        throw error;
      }
    };
    
    const enrichToolResponse = async (res: any, toolName: string): Promise<any> => {
      logger.log('TOOL_ENRICHMENT', `Enriching ${toolName} response`);
      return res;
    };
    
    const getPageContextAfterAction = async (): Promise<PageContext> => {
      return {
        url: 'https://example.com',
        title: 'Example Page',
        text: 'Sample page content',
        links: [],
        formFields: [],
        buttons: [],
        images: [],
      };
    };
    
    // Track message updates for queue management verification
    const updateLastMessage = (updater: (msg: Message) => Message) => {
      if (lastMessage) {
        const updated = updater(lastMessage);
        lastMessage = updated;
        
        // Track queue updates
        if (updated.workflowTasks) {
          const pendingCount = updated.workflowTasks.filter(t => t.status === 'pending').length;
          const inProgressCount = updated.workflowTasks.filter(t => t.status === 'in_progress').length;
          const completedCount = updated.workflowTasks.filter(t => t.status === 'completed').length;
          
          logger.log('QUEUE_UPDATE', 'Workflow tasks updated', {
            pending: pendingCount,
            inProgress: inProgressCount,
            completed: completedCount,
            tasks: updated.workflowTasks.map(t => ({ id: t.id, status: t.status })),
          });
          
          taskUpdateHistory.push({
            phase: 'unknown',
            tasks: [...updated.workflowTasks],
          });
          
          // Detect phase transitions
          const planTask = updated.workflowTasks.find(t => t.id === 'plan');
          const executeTask = updated.workflowTasks.find(t => t.id === 'execute');
          const summarizeTask = updated.workflowTasks.find(t => t.id === 'summarize');
          
          if (planTask?.status === 'in_progress') {
            result.queueManagement.planUpdated = true;
            logger.log('QUEUE_UPDATE', '✅ Plan task marked in_progress');
          }
          if (executeTask?.status === 'in_progress') {
            result.queueManagement.executeUpdated = true;
            logger.log('QUEUE_UPDATE', '✅ Execute task marked in_progress');
          }
          if (summarizeTask?.status === 'in_progress') {
            result.queueManagement.summarizeUpdated = true;
            logger.log('QUEUE_UPDATE', '✅ Summarize task marked in_progress');
          }
        }
        
        workflowMessages = workflowMessages.map(m => m.id === updated.id ? updated : m);
      }
    };
    
    const pushMessage = (msg: Message) => {
      workflowMessages.push(msg);
      if (msg.role === 'assistant' && !lastMessage) {
        lastMessage = msg;
        
        // Check initial queue initialization
        if (msg.workflowTasks && msg.workflowTasks.length > 0) {
          result.queueManagement.initialized = true;
          logger.log('QUEUE_INIT', '✅ Initial workflow tasks created', {
            count: msg.workflowTasks.length,
            tasks: msg.workflowTasks.map(t => ({ id: t.id, status: t.status })),
          });
        }
      }
    };
    
    logger.endPhase('SETUP', 100);

    // ============================================
    // PHASE 3: Execute Workflow
    // ============================================
    logger.startPhase('WORKFLOW_EXECUTION');
    const workflowStartTime = Date.now();
    
    // Create initial user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: 'Navigate to https://example.com and get the page context',
    };
    workflowMessages.push(userMessage);
    
    logger.log('WORKFLOW_INPUT', 'Starting workflow', {
      userQuery: userMessage.content,
      hasApiKey: !!AI_GATEWAY_API_KEY,
      apiKeyLength: AI_GATEWAY_API_KEY?.length || 0,
    });
    
    const workflowResult = await browserAutomationWorkflow(
      {
        userQuery: userMessage.content,
        settings: {
          provider: 'openai',
          apiKey: AI_GATEWAY_API_KEY!,
          model: 'gpt-4o-mini',
        },
      },
      {
        executeTool,
        enrichToolResponse,
        getPageContextAfterAction,
        updateLastMessage,
        pushMessage,
        settings: {
          provider: 'openai',
          apiKey: AI_GATEWAY_API_KEY!,
          model: 'gpt-4o-mini',
        },
        messages: workflowMessages,
      }
    );
    
    const workflowDuration = Date.now() - workflowStartTime;
    result.performance.totalDuration = workflowDuration;
    logger.endPhase('WORKFLOW_EXECUTION', workflowDuration);
    
    // ============================================
    // PHASE 4: Verify Results
    // ============================================
    logger.startPhase('VERIFICATION');
    
    // Verify workflow completion
    result.workflowCompleted = !!workflowResult;
    logger.log('VERIFICATION', `Workflow completed: ${result.workflowCompleted}`, {
      hasSummary: !!workflowResult?.summary,
      hasFinalResponse: !!workflowResult?.finalResponse,
      hasMetadata: !!workflowResult?.metadata,
    });
    
    // Verify queue management
    if (lastMessage?.workflowTasks) {
      const finalTasks = lastMessage.workflowTasks;
      const allCompleted = finalTasks.every(t => t.status === 'completed' || t.status === 'error');
      result.queueManagement.finalStateCorrect = allCompleted;
      
      logger.log('QUEUE_VERIFICATION', 'Final queue state', {
        taskCount: finalTasks.length,
        allCompleted,
        states: finalTasks.map(t => ({ id: t.id, status: t.status })),
      });
    }
    
    // Verify tool execution
    logger.log('TOOL_VERIFICATION', 'Tool execution summary', {
      totalCalls: result.toolExecution.toolsCalled,
      successful: result.toolExecution.toolsSuccessful,
      successRate: result.toolExecution.toolsCalled > 0 
        ? (result.toolExecution.toolsSuccessful / result.toolExecution.toolsCalled * 100).toFixed(1) + '%'
        : 'N/A',
      uniqueTools: [...new Set(result.toolExecution.toolNames)],
      errors: result.toolExecution.errors,
    });
    
    // Verify summarization
    if (workflowResult?.summary) {
      result.summarization.completed = true;
      result.summarization.hasSummary = true;
      result.summarization.summaryLength = workflowResult.summary.length;
      result.summarization.duration = workflowResult.summarization?.duration || 0;
      
      logger.log('SUMMARIZATION_VERIFICATION', 'Summary generated', {
        length: result.summarization.summaryLength,
        duration: result.summarization.duration,
        preview: workflowResult.summary.substring(0, 100) + '...',
      });
    }
    
    // Verify artifacts
    if (lastMessage) {
      result.artifacts.hasSummaryArtifact = !!lastMessage.summarization;
      result.artifacts.hasWorkflowMetadata = !!workflowResult?.metadata;
      result.artifacts.hasExecutionTrajectory = !!workflowResult?.executionTrajectory;
      
      logger.log('ARTIFACT_VERIFICATION', 'Artifacts check', {
        summaryArtifact: result.artifacts.hasSummaryArtifact,
        workflowMetadata: result.artifacts.hasWorkflowMetadata,
        executionTrajectory: result.artifacts.hasExecutionTrajectory,
      });
    }
    
    logger.endPhase('VERIFICATION', 50);
    
    // ============================================
    // PHASE 5: Final Assessment
    // ============================================
    result.success = 
      result.workflowCompleted &&
      result.queueManagement.initialized &&
      result.queueManagement.finalStateCorrect &&
      result.toolExecution.toolsCalled > 0 &&
      result.summarization.completed;
    
    result.logs = logger.getLogs();
    
    return result;
    
  } catch (error: any) {
    logger.log('ERROR', 'Workflow execution failed', {
      error: error?.message || String(error),
      stack: error?.stack,
    });
    
    result.logs = logger.getLogs();
    result.success = false;
    
    return result;
  }
}

// Run the test
async function main() {
  console.log(`${LOG_PREFIX} Starting E2E verification test...\n`);
  
  const result = await runE2EVerification();
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 E2E VERIFICATION RESULTS');
  console.log('='.repeat(80));
  
  console.log(`\n✅ Overall Success: ${result.success ? 'YES' : 'NO'}`);
  console.log(`\n📋 Queue Management:`);
  console.log(`  Initialized: ${result.queueManagement.initialized ? '✅' : '❌'}`);
  console.log(`  Plan Updated: ${result.queueManagement.planUpdated ? '✅' : '❌'}`);
  console.log(`  Execute Updated: ${result.queueManagement.executeUpdated ? '✅' : '❌'}`);
  console.log(`  Summarize Updated: ${result.queueManagement.summarizeUpdated ? '✅' : '❌'}`);
  console.log(`  Final State Correct: ${result.queueManagement.finalStateCorrect ? '✅' : '❌'}`);
  
  console.log(`\n🛠️  Tool Execution:`);
  console.log(`  Tools Called: ${result.toolExecution.toolsCalled}`);
  console.log(`  Tools Successful: ${result.toolExecution.toolsSuccessful}`);
  console.log(`  Success Rate: ${result.toolExecution.toolsCalled > 0 
    ? ((result.toolExecution.toolsSuccessful / result.toolExecution.toolsCalled) * 100).toFixed(1) + '%'
    : 'N/A'}`);
  console.log(`  Unique Tools: ${[...new Set(result.toolExecution.toolNames)].join(', ')}`);
  if (result.toolExecution.errors.length > 0) {
    console.log(`  Errors: ${result.toolExecution.errors.length}`);
    result.toolExecution.errors.forEach(err => console.log(`    - ${err}`));
  }
  
  console.log(`\n📝 Summarization:`);
  console.log(`  Completed: ${result.summarization.completed ? '✅' : '❌'}`);
  console.log(`  Has Summary: ${result.summarization.hasSummary ? '✅' : '❌'}`);
  console.log(`  Summary Length: ${result.summarization.summaryLength} chars`);
  console.log(`  Duration: ${result.summarization.duration}ms`);
  
  console.log(`\n🎨 Artifacts:`);
  console.log(`  Summary Artifact: ${result.artifacts.hasSummaryArtifact ? '✅' : '❌'}`);
  console.log(`  Workflow Metadata: ${result.artifacts.hasWorkflowMetadata ? '✅' : '❌'}`);
  console.log(`  Execution Trajectory: ${result.artifacts.hasExecutionTrajectory ? '✅' : '❌'}`);
  
  console.log(`\n⏱️  Performance:`);
  console.log(`  Total Duration: ${result.performance.totalDuration}ms`);
  console.log(`  Planning Duration: ${result.performance.planningDuration}ms`);
  console.log(`  Execution Duration: ${result.performance.executionDuration}ms`);
  console.log(`  Summarization Duration: ${result.performance.summarizationDuration}ms`);
  
  console.log(`\n📜 Logs (${result.logs.length} entries):`);
  result.logs.slice(0, 20).forEach(log => console.log(`  ${log}`));
  if (result.logs.length > 20) {
    console.log(`  ... and ${result.logs.length - 20} more log entries`);
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (result.success) {
    console.log('✅ E2E VERIFICATION PASSED');
    process.exit(0);
  } else {
    console.log('❌ E2E VERIFICATION FAILED');
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`${LOG_PREFIX} Fatal error:`, error);
  process.exit(1);
});

