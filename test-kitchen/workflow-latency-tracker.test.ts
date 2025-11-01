/**
 * Workflow Latency Tracker Test
 * Tracks all workflow steps, message pushes, and latency markers
 */

import { performance } from 'perf_hooks';

const LOG_PREFIX = '🔬 [LATENCY-TEST]';

interface LatencyMarker {
  timestamp: number;
  event: string;
  phase: string;
  duration?: number;
  data?: any;
}

class WorkflowLatencyTracker {
  private markers: LatencyMarker[] = [];
  private startTime: number;
  private phaseStarts: Map<string, number> = new Map();
  private messages: any[] = [];
  
  constructor() {
    this.startTime = performance.now();
  }

  mark(event: string, phase: string, data?: any) {
    const now = performance.now();
    const marker: LatencyMarker = {
      timestamp: now,
      event,
      phase,
      data,
    };
    this.markers.push(marker);
    
    console.log(`${LOG_PREFIX} [${(now - this.startTime).toFixed(2)}ms] ${phase} → ${event}`, data || '');
  }

  startPhase(phase: string) {
    const now = performance.now();
    this.phaseStarts.set(phase, now);
    this.mark(`${phase} START`, phase);
  }

  endPhase(phase: string, data?: any) {
    const now = performance.now();
    const startTime = this.phaseStarts.get(phase);
    const duration = startTime ? now - startTime : 0;
    this.phaseStarts.delete(phase);
    this.mark(`${phase} END`, phase, { ...data, duration: `${duration.toFixed(2)}ms` });
    return duration;
  }

  trackMessagePush(message: any) {
    this.messages.push({
      ...message,
      pushedAt: performance.now() - this.startTime,
    });
    this.mark('MESSAGE_PUSHED', 'UI', {
      id: message.id,
      role: message.role,
      contentPreview: message.content?.substring(0, 100),
      hasArtifacts: !!(message.summarization || message.planning || message.workflowTasks),
    });
  }

  trackMessageUpdate(messageId: string, updateType: string) {
    this.mark('MESSAGE_UPDATED', 'UI', {
      id: messageId,
      updateType,
    });
  }

  getReport() {
    const totalDuration = performance.now() - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 WORKFLOW LATENCY REPORT');
    console.log('='.repeat(80));
    console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`Total Markers: ${this.markers.length}`);
    console.log(`Messages Pushed: ${this.messages.length}`);
    console.log('='.repeat(80));
    
    // Group by phase
    const phases = new Map<string, LatencyMarker[]>();
    this.markers.forEach(marker => {
      if (!phases.has(marker.phase)) {
        phases.set(marker.phase, []);
      }
      phases.get(marker.phase)!.push(marker);
    });
    
    console.log('\n📋 PHASE BREAKDOWN:');
    phases.forEach((markers, phase) => {
      const phaseStart = markers.find(m => m.event.includes('START'));
      const phaseEnd = markers.find(m => m.event.includes('END'));
      const duration = phaseEnd && phaseStart 
        ? (phaseEnd.timestamp - phaseStart.timestamp).toFixed(2)
        : 'N/A';
      
      console.log(`\n  ${phase}: ${duration}ms (${markers.length} events)`);
      markers.forEach((marker, idx) => {
        const relativeTime = (marker.timestamp - this.startTime).toFixed(2);
        console.log(`    ${idx + 1}. [${relativeTime}ms] ${marker.event}`, marker.data || '');
      });
    });
    
    console.log('\n💬 MESSAGE TIMELINE:');
    this.messages.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. [${msg.pushedAt.toFixed(2)}ms] ${msg.role} - ${msg.id}`);
      console.log(`     Content: ${msg.content?.substring(0, 80)}...`);
      if (msg.summarization) console.log(`     ✅ Has summarization artifact`);
      if (msg.planning) console.log(`     ✅ Has planning artifact`);
      if (msg.workflowTasks) console.log(`     ✅ Has workflow tasks (${msg.workflowTasks.length})`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    return {
      totalDuration,
      markers: this.markers,
      messages: this.messages,
      phaseCount: phases.size,
    };
  }
}

async function testWorkflowWithLatencyTracking() {
  console.log(`${LOG_PREFIX} Starting workflow latency tracking test...\n`);
  
  const tracker = new WorkflowLatencyTracker();
  
  try {
    // Simulate workflow execution with tracking
    tracker.startPhase('INITIALIZATION');
    
    // Mock settings
    const settings = {
      provider: 'gateway' as const,
      apiKey: process.env.AI_GATEWAY_API_KEY || 'test-key',
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      youApiKey: process.env.YOU_API_KEY,
    };
    
    tracker.mark('SETTINGS_LOADED', 'INITIALIZATION', settings);
    tracker.endPhase('INITIALIZATION');
    
    // Phase 1: Planning
    tracker.startPhase('PLANNING');
    tracker.mark('PLANNING_REQUEST', 'PLANNING', { query: 'test query' });
    
    // Simulate planning message push
    const planningMessage = {
      id: `planning-${Date.now()}`,
      role: 'assistant',
      content: '🧠 **Planning Phase**\n\nAnalyzing task...',
    };
    tracker.trackMessagePush(planningMessage);
    
    // Simulate planning completion
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate planning time
    tracker.mark('PLANNING_COMPLETE', 'PLANNING', { steps: 3, confidence: 0.9 });
    tracker.trackMessageUpdate(planningMessage.id, 'planning_results_added');
    tracker.endPhase('PLANNING');
    
    // Phase 2: Execution
    tracker.startPhase('EXECUTION');
    tracker.mark('AGENT_STREAM_START', 'EXECUTION');
    
    // Simulate tool executions
    const tools = ['getPageContext', 'navigate', 'getPageContext'];
    for (let i = 0; i < tools.length; i++) {
      const toolName = tools[i];
      tracker.mark(`TOOL_${i + 1}_START`, 'EXECUTION', { tool: toolName });
      
      // Simulate tool execution message
      const toolMessage = {
        id: `step-${i + 1}-${Date.now()}`,
        role: 'assistant',
        content: `🔷 **Step ${i + 1}: ${toolName}**\n\nExecuting...`,
        toolExecutions: [{
          toolName,
          status: 'in_progress',
          timestamp: Date.now(),
        }],
      };
      tracker.trackMessagePush(toolMessage);
      
      // Simulate tool execution time
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      
      tracker.mark(`TOOL_${i + 1}_COMPLETE`, 'EXECUTION', { 
        tool: toolName, 
        success: true 
      });
      tracker.trackMessageUpdate(toolMessage.id, 'tool_result_added');
    }
    
    tracker.mark('AGENT_STREAM_END', 'EXECUTION', { totalTools: tools.length });
    tracker.endPhase('EXECUTION');
    
    // Phase 3: Summarization
    tracker.startPhase('SUMMARIZATION');
    tracker.mark('SUMMARY_PLACEHOLDER_CREATED', 'SUMMARIZATION');
    
    // Push placeholder summary message
    const summaryPlaceholder = {
      id: `summary-${Date.now()}`,
      role: 'assistant',
      content: '---\n## Summary & Next Steps\n\n*Generating summary...*',
    };
    tracker.trackMessagePush(summaryPlaceholder);
    
    tracker.mark('AI_SDK_SUMMARIZER_START', 'SUMMARIZATION');
    
    // Simulate summarization time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    tracker.mark('AI_SDK_SUMMARIZER_COMPLETE', 'SUMMARIZATION', { 
      textLength: 2272,
      duration: '1500ms',
    });
    
    // Simulate streaming updates (what should happen)
    const streamingUpdates = 10;
    for (let i = 0; i < streamingUpdates; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      tracker.trackMessageUpdate(summaryPlaceholder.id, `streaming_delta_${i + 1}`);
    }
    
    tracker.mark('STREAMING_COMPLETE', 'SUMMARIZATION', { 
      totalUpdates: streamingUpdates 
    });
    
    // Final summary update
    tracker.mark('FINAL_SUMMARY_UPDATE', 'SUMMARIZATION');
    const finalSummary = {
      ...summaryPlaceholder,
      content: '---\n## Summary & Next Steps\n\nWorkflow completed successfully. Here are the results...',
      summarization: {
        summary: 'Full summary text here...',
        success: true,
        duration: 1500,
      },
    };
    tracker.trackMessageUpdate(summaryPlaceholder.id, 'final_content_replaced');
    
    tracker.endPhase('SUMMARIZATION');
    
    // Phase 4: Workflow Completion
    tracker.startPhase('WORKFLOW_COMPLETE');
    tracker.mark('WORKFLOW_OUTPUT_RETURNED', 'WORKFLOW_COMPLETE', {
      success: true,
      hasSummarization: true,
    });
    
    // Critical: Check if final message is in messages array
    tracker.mark('MESSAGE_ARRAY_CHECK', 'WORKFLOW_COMPLETE', {
      totalMessages: tracker['messages'].length,
      lastMessage: tracker['messages'][tracker['messages'].length - 1],
    });
    
    tracker.endPhase('WORKFLOW_COMPLETE');
    
    // Generate report
    const report = tracker.getReport();
    
    console.log('\n✅ Test completed successfully!');
    console.log(`📊 Total workflow duration: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`📨 Total messages: ${report.messages.length}`);
    console.log(`🏷️  Total phases: ${report.phaseCount}`);
    
    // Analysis
    console.log('\n🔍 ANALYSIS:');
    
    const summaryMessages = tracker['messages'].filter((m: any) => 
      m.content?.includes('Summary & Next Steps')
    );
    console.log(`  Summary messages found: ${summaryMessages.length}`);
    
    if (summaryMessages.length === 0) {
      console.log('  ⚠️  WARNING: No summary message in messages array!');
      console.log('  🐛 This indicates the summary was not properly pushed to UI');
    } else {
      const lastSummary = summaryMessages[summaryMessages.length - 1];
      console.log(`  ✅ Last summary message at: ${lastSummary.pushedAt.toFixed(2)}ms`);
      console.log(`  📝 Content: ${lastSummary.content.substring(0, 100)}...`);
    }
    
    // Check timing gaps
    const planningEnd = tracker['markers'].find(m => m.event === 'PLANNING END');
    const executionStart = tracker['markers'].find(m => m.event === 'EXECUTION START');
    if (planningEnd && executionStart) {
      const gap = (executionStart.timestamp - planningEnd.timestamp).toFixed(2);
      console.log(`\n  ⏱️  Gap between planning and execution: ${gap}ms`);
    }
    
    const executionEnd = tracker['markers'].find(m => m.event === 'EXECUTION END');
    const summaryStart = tracker['markers'].find(m => m.event === 'SUMMARIZATION START');
    if (executionEnd && summaryStart) {
      const gap = (summaryStart.timestamp - executionEnd.timestamp).toFixed(2);
      console.log(`  ⏱️  Gap between execution and summarization: ${gap}ms`);
    }
    
    return report;
    
  } catch (error: any) {
    console.error(`${LOG_PREFIX} ❌ Test failed:`, error);
    throw error;
  }
}

// Run the test
console.log('🚀 Starting Workflow Latency Tracking Test\n');
testWorkflowWithLatencyTracking()
  .then((report) => {
    console.log('\n✅ Test completed successfully!');
    console.log('📊 Report available in test output');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

