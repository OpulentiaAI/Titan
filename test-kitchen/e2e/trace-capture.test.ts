// Trace Capture Test - Captures full execution traces for debugging
// Intercepts all console logs, errors, and workflow state changes

import { browserAutomationWorkflow } from '../../workflows/browser-automation-workflow.js';
import type { BrowserAutomationWorkflowInput } from '../../schemas/workflow-schemas.js';
import type { Message, PageContext } from '../../types.js';

const LOG_PREFIX = '🔍 [Trace Capture]';

interface TraceEntry {
  timestamp: number;
  component: string;
  level: 'log' | 'warn' | 'error' | 'debug' | 'info';
  message: string;
  data?: any;
  stack?: string;
}

class TraceCapture {
  private traces: TraceEntry[] = [];
  private originalConsole: typeof console;
  private component: string = 'UNKNOWN';

  constructor() {
    this.originalConsole = { ...console };
    this.interceptConsole();
  }

  setComponent(component: string) {
    this.component = component;
  }

  private interceptConsole() {
    const self = this;
    
    console.log = function(...args: any[]) {
      self.capture('log', args);
      self.originalConsole.log.apply(console, args);
    };
    
    console.warn = function(...args: any[]) {
      self.capture('warn', args);
      self.originalConsole.warn.apply(console, args);
    };
    
    console.error = function(...args: any[]) {
      self.capture('error', args);
      self.originalConsole.error.apply(console, args);
    };
    
    console.info = function(...args: any[]) {
      self.capture('info', args);
      self.originalConsole.info.apply(console, args);
    };
    
    console.debug = function(...args: any[]) {
      self.capture('debug', args);
      self.originalConsole.debug.apply(console, args);
    };
  }

  private capture(level: TraceEntry['level'], args: any[]) {
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try {
        return JSON.stringify(arg).substring(0, 500);
      } catch {
        return String(arg).substring(0, 500);
      }
    }).join(' ');

    const entry: TraceEntry = {
      timestamp: Date.now(),
      component: this.component,
      level,
      message,
      data: args.length > 1 ? args.slice(1) : undefined,
    };

    // Capture stack for errors
    if (level === 'error' && args[0] instanceof Error) {
      entry.stack = args[0].stack;
    }

    this.traces.push(entry);
  }

  getTraces() { return this.traces; }
  clear() { this.traces = []; }
  getTracesByComponent(component: string) {
    return this.traces.filter(t => t.component === component);
  }
  getErrors() {
    return this.traces.filter(t => t.level === 'error');
  }
}

async function captureFullTrace(query: string): Promise<{
  success: boolean;
  traces: TraceEntry[];
  workflowResult: any;
  errors: TraceEntry[];
  summary: {
    totalLogs: number;
    errors: number;
    warnings: number;
    components: string[];
    duration: number;
  };
}> {
  const traceCapture = new TraceCapture();
  const startTime = Date.now();

  traceCapture.setComponent('TraceCapture');
  console.log(`${LOG_PREFIX} Starting full trace capture for query: "${query}"`);

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.error(`${LOG_PREFIX} Missing AI_GATEWAY_API_KEY`);
    return {
      success: false,
      traces: traceCapture.getTraces(),
      workflowResult: null,
      errors: traceCapture.getErrors(),
      summary: {
        totalLogs: traceCapture.getTraces().length,
        errors: traceCapture.getErrors().length,
        warnings: traceCapture.getTraces().filter(t => t.level === 'warn').length,
        components: [],
        duration: Date.now() - startTime,
      },
    };
  }

  const mockContext = {
    executeTool: async (toolName: string, params: any) => {
      traceCapture.setComponent(`Tool:${toolName}`);
      console.log(`[Tool Execution] ${toolName}`, params);
      await new Promise(r => setTimeout(r, 100));
      return { success: true, url: 'https://example.com' };
    },
    enrichToolResponse: async (res: any, toolName: string) => {
      traceCapture.setComponent(`Tool:${toolName}`);
      return { ...res, url: res.url || 'https://example.com' };
    },
    getPageContextAfterAction: async (): Promise<PageContext> => {
      traceCapture.setComponent('PageContext');
      return {
        url: 'https://example.com',
        title: 'Test Page',
        text: 'Test content',
        links: [],
        forms: [],
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
      };
    },
    updateLastMessage: (updater: (msg: Message) => Message) => {
      traceCapture.setComponent('MessageUpdate');
    },
    pushMessage: (msg: Message) => {
      traceCapture.setComponent('MessagePush');
      console.log(`[Message] ${msg.role}: ${msg.content.substring(0, 100)}`);
    },
    settings: {
      provider: 'gateway' as const,
      apiKey,
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      computerUseEngine: 'gateway-flash-lite' as const,
      youApiKey: process.env.YOU_API_KEY,
      braintrustApiKey: process.env.BRAINTRUST_API_KEY,
      braintrustProjectName: process.env.BRAINTRUST_PROJECT_NAME || 'atlas-extension',
    },
    messages: [],
  };

  traceCapture.setComponent('Workflow');
  let workflowResult: any;
  
  try {
    const workflowInput: BrowserAutomationWorkflowInput = {
      userQuery: query,
      settings: mockContext.settings,
      initialContext: {
        currentUrl: 'about:blank',
        pageContext: {
          url: 'about:blank',
          title: '',
          text: '',
          links: [],
          forms: [],
          viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        },
      },
      metadata: { timestamp: Date.now() },
    };

    console.log(`${LOG_PREFIX} Executing workflow...`);
    workflowResult = await browserAutomationWorkflow(workflowInput, mockContext);
    console.log(`${LOG_PREFIX} Workflow completed: success=${workflowResult.success}`);
  } catch (e: any) {
    traceCapture.setComponent('Error');
    console.error(`${LOG_PREFIX} Workflow threw exception:`, e);
    workflowResult = { success: false, error: e.message, errorType: e.name };
  }

  const duration = Date.now() - startTime;
  const traces = traceCapture.getTraces();
  const errors = traceCapture.getErrors();
  const components = [...new Set(traces.map(t => t.component))];

  return {
    success: workflowResult?.success || false,
    traces,
    workflowResult,
    errors,
    summary: {
      totalLogs: traces.length,
      errors: errors.length,
      warnings: traces.filter(t => t.level === 'warn').length,
      components,
      duration,
    },
  };
}

async function runTraceCaptureTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 TRACE CAPTURE TEST SUITE');
  console.log('='.repeat(80));
  console.log('\n📋 Capturing full execution traces for comprehensive debugging\n');

  const testQueries = [
    'Navigate to https://example.com',
    'Go to example.com and get page context',
  ];

  const results: Array<ReturnType<typeof captureFullTrace> extends Promise<infer T> ? T : never> = [];

  for (const query of testQueries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Capturing trace for: "${query}"`);
    console.log('='.repeat(80));
    
    const result = await captureFullTrace(query);
    results.push(result as any);

    // Summary
    console.log(`\n📊 Trace Summary:`);
    console.log(`   Total Logs: ${result.summary.totalLogs}`);
    console.log(`   Errors: ${result.summary.errors}`);
    console.log(`   Warnings: ${result.summary.warnings}`);
    console.log(`   Components: ${result.summary.components.length}`);
    console.log(`   Duration: ${result.summary.duration}ms`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors Captured:`);
      result.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. [${err.component}] ${err.message}`);
        if (err.stack) {
          console.log(`      Stack: ${err.stack.split('\n').slice(0, 3).join('\n      ')}`);
        }
      });
    }

    // Export trace
    const fs = await import('fs/promises');
    await fs.mkdir('test-output', { recursive: true }).catch(() => {});
    
    const traceContent = result.traces.map(t => 
      `[${new Date(t.timestamp).toISOString()}] [${t.level.toUpperCase()}] [${t.component}] ${t.message}${t.data ? '\n' + JSON.stringify(t.data, null, 2) : ''}${t.stack ? '\n' + t.stack : ''}`
    ).join('\n');

    const filename = `test-output/trace-${query.replace(/[^a-z0-9]/gi, '-').substring(0, 50)}-${Date.now()}.txt`;
    await fs.writeFile(filename, traceContent);
    console.log(`\n📝 Full trace saved to: ${filename}`);

    await new Promise(r => setTimeout(r, 2000));
  }

  // Overall summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 OVERALL TRACE CAPTURE SUMMARY');
  console.log('='.repeat(80));

  const totalLogs = results.reduce((sum, r) => sum + r.summary.totalLogs, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.summary.errors, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.summary.warnings, 0);
  const allComponents = [...new Set(results.flatMap(r => r.summary.components))];

  console.log(`\nTotal Traces Captured: ${totalLogs}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Warnings: ${totalWarnings}`);
  console.log(`Unique Components: ${allComponents.length}`);
  console.log(`Components: ${allComponents.join(', ')}`);

  console.log(`\n✅ Trace capture complete! All traces saved to test-output/`);
}

runTraceCaptureTests();

