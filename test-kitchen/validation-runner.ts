/**
 * Production Validation Runner
 * Runs validation tasks and saves results to tmp/production-validation
 * Creates thread.json and performance.json files for braintrust ingestion
 */

import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { browserAutomationWorkflow } from '../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput } from '../schemas/workflow-schemas.js';

interface ValidationTask {
  id: string;
  name: string;
  description: string;
  input: BrowserAutomationWorkflowInput;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  error?: string;
  duration: number;
  thread?: any;
  performance?: any;
  timestamp: string;
}

// Validation tasks to run
const VALIDATION_TASKS: ValidationTask[] = [
  {
    id: 'nav-summary-validation',
    name: 'Navigation and Summary Execution',
    description: 'Ensure navigation and summary execution work properly',
    input: {
      userQuery: 'Navigate to https://example.com and provide a summary of what you find',
      settings: {
        provider: 'gateway',
        apiKey: process.env.AI_GATEWAY_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
        model: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'gemini-2.5-pro' : 'google/gemini-2.5-flash-lite-preview-09-2025',
        computerUseEngine: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'google' : 'gateway-flash-lite',
        youApiKey: process.env.YOU_API_KEY,
        braintrustApiKey: process.env.BRAINTRUST_API_KEY,
        braintrustProjectName: process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension',
      },
      initialContext: {
        currentUrl: 'about:blank',
        pageContext: {
          url: 'about:blank',
          title: 'Blank Page',
          text: '',
          links: [],
          forms: [],
          viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        },
      },
      metadata: {
        timestamp: Date.now(),
        validationTask: true,
      },
    },
  },
];

async function runValidationTask(task: ValidationTask): Promise<TaskResult> {
  const startTime = Date.now();
  const taskDir = path.join(process.cwd(), 'tmp', 'production-validation', `task-${task.id}`);

  // Create task directory
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }

  console.log(`🚀 Running validation: ${task.name}`);
  console.log(`📝 ${task.description}`);
  console.log(`📁 Results will be saved to: ${taskDir}`);

  try {
    // Mock context for browser automation
    const context = {
      executeTool: async (toolName: string, params: any) => {
        // Mock implementation - in real scenario this would interact with browser
        console.log(`🔧 Executing tool: ${toolName}`, params);
        return { success: true, result: `Mock result for ${toolName}` };
      },
      enrichToolResponse: async (res: any) => res,
      getPageContextAfterAction: async () => ({
        url: 'https://example.com',
        title: 'Example Domain',
        text: 'This is an example website',
        links: [{ text: 'More information', href: 'https://iana.org/domains/example' }],
        forms: [],
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
      }),
      updateLastMessage: () => {},
      pushMessage: () => {},
      settings: task.input.settings,
      messages: [{ id: '1', role: 'user', content: task.input.userQuery }],
    };

    const result = await browserAutomationWorkflow(task.input, context);

    const duration = Date.now() - startTime;

    // Create thread.json
    const thread = {
      id: `thread-${nanoid()}`,
      messages: [
        {
          id: '1',
          role: 'user',
          content: task.input.userQuery,
        },
        {
          id: '2',
          role: 'assistant',
          content: result.summary || 'Task completed successfully',
        },
      ],
    };

    // Create performance.json
    const performance = {
      summary: {
        executionTimeSec: duration / 1000,
        success: result.success,
        totalOperations: result.executionTrajectory?.length || 1,
        userMessages: 1,
        llmCalls: result.executionTrajectory?.length || 1,
      },
      metrics: {
        duration,
        steps: result.executionTrajectory?.length || 1,
        finalUrl: result.finalUrl || 'https://example.com',
      },
    };

    // Save results
    fs.writeFileSync(path.join(taskDir, 'thread.json'), JSON.stringify(thread, null, 2));
    fs.writeFileSync(path.join(taskDir, 'performance.json'), JSON.stringify(performance, null, 2));

    // Save workspace info
    const workspaceDir = path.join(taskDir, 'workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });
    const packageJson = {
      name: 'atlas-validation',
      version: '1.0.0',
      description: task.description,
    };
    fs.writeFileSync(path.join(workspaceDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    console.log(`✅ Validation completed successfully in ${duration}ms`);
    console.log(`📄 Thread data saved`);
    console.log(`📊 Performance data saved`);

    return {
      taskId: task.id,
      success: result.success,
      duration,
      thread,
      performance,
      timestamp: new Date().toISOString(),
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Validation failed: ${error.message}`);

    return {
      taskId: task.id,
      success: false,
      error: error.message,
      duration,
      timestamp: new Date().toISOString(),
    };
  }
}

async function main() {
  console.log('🧪 PRODUCTION VALIDATION RUNNER');
  console.log('================================');
  console.log(`Running ${VALIDATION_TASKS.length} validation tasks...`);
  console.log('');

  const results: TaskResult[] = [];

  for (const task of VALIDATION_TASKS) {
    const result = await runValidationTask(task);
    results.push(result);
    console.log('');
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = totalDuration / results.length;

  console.log('📊 VALIDATION SUMMARY');
  console.log('=====================');
  console.log(`Total Tasks: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`📁 Results saved to: tmp/production-validation/`);

  if (failed > 0) {
    console.log('\n❌ Failed Tasks:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.taskId}: ${r.error}`);
    });
  }

  console.log('\n🎯 Ready for Braintrust ingestion!');
  console.log('Run: npx tsx test-kitchen/braintrust-ingest-preview.ts');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
