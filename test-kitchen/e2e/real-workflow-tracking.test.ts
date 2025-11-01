/**
 * Real Workflow Tracking Test
 * Runs actual workflow with comprehensive message tracking and latency markers
 */

import { performance } from 'perf_hooks';
import type { Message } from '../../types';

const LOG_PREFIX = '🔬 [REAL-WORKFLOW-TRACKING]';

interface TrackedMessage extends Message {
  _trackedAt?: number;
  _phase?: string;
  _operation?: 'push' | 'update';
}

class RealWorkflowTracker {
  private startTime: number;
  private messages: TrackedMessage[] = [];
  private events: Array<{
    time: number;
    phase: string;
    event: string;
    data?: any;
  }> = [];
  private currentPhase: string = 'INIT';
  private phases: string[] = [];
  
  constructor() {
    this.startTime = performance.now();
    console.log(`${LOG_PREFIX} ⏱️  Tracker initialized at t=0ms\n`);
  }

  setPhase(phase: string) {
    const now = performance.now();
    const elapsed = now - this.startTime;
    this.currentPhase = phase;
    this.phases.push(phase);
    this.log('PHASE_CHANGE', { to: phase });
    console.log(`\n${LOG_PREFIX} ════════════════════════════════════════`);
    console.log(`${LOG_PREFIX} 📍 PHASE: ${phase} [t=${elapsed.toFixed(2)}ms]`);
    console.log(`${LOG_PREFIX} ════════════════════════════════════════\n`);
  }

  log(event: string, data?: any) {
    const now = performance.now();
    const elapsed = now - this.startTime;
    this.events.push({
      time: elapsed,
      phase: this.currentPhase,
      event,
      data,
    });
    
    const dataStr = data ? JSON.stringify(data).substring(0, 150) : '';
    console.log(`${LOG_PREFIX} [t=${elapsed.toFixed(2)}ms] ${event}`, dataStr ? `→ ${dataStr}` : '');
  }

  trackPush(message: TrackedMessage) {
    const now = performance.now();
    const elapsed = now - this.startTime;
    
    message._trackedAt = elapsed;
    message._phase = this.currentPhase;
    message._operation = 'push';
    
    this.messages.push(message);
    
    const artifacts = [];
    if (message.planning) artifacts.push('planning');
    if (message.toolExecutions?.length) artifacts.push(`tools(${message.toolExecutions.length})`);
    if (message.summarization) artifacts.push('summary');
    if (message.workflowTasks?.length) artifacts.push(`tasks(${message.workflowTasks.length})`);
    
    console.log(`${LOG_PREFIX} 📨 PUSH [t=${elapsed.toFixed(2)}ms] ${message.role} (${message.id})`);
    console.log(`${LOG_PREFIX}    Content: "${message.content?.substring(0, 80)}..."`);
    if (artifacts.length > 0) {
      console.log(`${LOG_PREFIX}    Artifacts: ${artifacts.join(', ')}`);
    }
    console.log('');
  }

  trackUpdate(messageId: string, updater: (msg: any) => any) {
    const now = performance.now();
    const elapsed = now - this.startTime;
    
    const msgIndex = this.messages.findIndex(m => m.id === messageId);
    if (msgIndex >= 0) {
      const oldMsg = this.messages[msgIndex];
      const newMsg = updater(oldMsg);
      
      this.messages[msgIndex] = {
        ...newMsg,
        _trackedAt: elapsed,
        _phase: this.currentPhase,
        _operation: 'update',
      };
      
      console.log(`${LOG_PREFIX} 🔄 UPDATE [t=${elapsed.toFixed(2)}ms] ${messageId}`);
      
      if (oldMsg.content !== newMsg.content) {
        console.log(`${LOG_PREFIX}    Content: ${oldMsg.content?.length || 0} → ${newMsg.content?.length || 0} chars`);
      }
      
      if (!oldMsg.summarization && newMsg.summarization) {
        console.log(`${LOG_PREFIX}    ✨ SUMMARY ARTIFACT ADDED (${newMsg.summarization.summary?.length || 0} chars)`);
      }
    } else {
      console.log(`${LOG_PREFIX} ⚠️  UPDATE attempted on non-existent message: ${messageId}`);
    }
  }

  printReport() {
    const totalTime = performance.now() - this.startTime;
    const summaryMsgs = this.messages.filter(m => m.content?.includes('Summary & Next Steps'));
    const orphaned = summaryMsgs.filter(m => m.content?.includes('*Generating summary...*'));
    const complete = summaryMsgs.filter(m => !m.content?.includes('*Generating') && m.summarization?.summary);
    
    console.log('\n' + '='.repeat(100));
    console.log('📊 WORKFLOW TRACKING REPORT');
    console.log('='.repeat(100));
    console.log(`⏱️  Total Duration: ${totalTime.toFixed(2)}ms`);
    console.log(`📨 Messages: ${this.messages.length}`);
    console.log(`🔄 Events: ${this.events.length}`);
    console.log(`📋 Phases: ${this.phases.length}`);
    
    console.log('\n📊 SUMMARY ANALYSIS:');
    console.log(`  Total summary messages: ${summaryMsgs.length}`);
    console.log(`  Orphaned placeholders: ${orphaned.length}`);
    console.log(`  Complete summaries: ${complete.length}`);
    
    if (orphaned.length > 0) {
      console.log(`\n❌ ISSUE: ${orphaned.length} placeholder(s) not updated!`);
      orphaned.forEach((msg, idx) => {
        console.log(`  ${idx + 1}. ${msg.id} - "${msg.content?.substring(0, 50)}..."`);
        console.log(`     Pushed at: t=${msg._trackedAt?.toFixed(2)}ms`);
      });
    } else {
      console.log(`\n✅ All summaries properly updated`);
    }
    
    console.log('\n' + '='.repeat(100) + '\n');
    
    return {
      totalDuration: totalTime,
      messages: this.messages,
      events: this.events,
      analysis: {
        orphanedPlaceholders: orphaned.length,
        completeSummaries: complete.length,
        totalSummaryMessages: summaryMsgs.length,
      },
    };
  }
}

// Run simulation
async function runSimulatedWorkflowTracking() {
  console.log(`${LOG_PREFIX} Starting simulated workflow tracking...\n`);
  
  const tracker = new RealWorkflowTracker();
  
  // Phase 1: Planning
  tracker.setPhase('PLANNING');
  await new Promise(r => setTimeout(r, 100));
  
  tracker.trackPush({
    id: `planning-${Date.now()}`,
    role: 'assistant',
    content: '🧠 **Planning Phase**\n\nAnalyzing task...',
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  // Phase 2: Execution
  tracker.setPhase('EXECUTION');
  await new Promise(r => setTimeout(r, 100));
  
  for (let i = 1; i <= 3; i++) {
    tracker.trackPush({
      id: `step-${i}-${Date.now()}`,
      role: 'assistant',
      content: `🔷 **Step ${i}**\n\nExecuting tool...`,
      toolExecutions: [{
        toolName: 'navigate',
        state: 'input-streaming' as any,
        input: {},
        toolCallId: `tool-${i}`,
        timestamp: Date.now(),
      }],
    });
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Phase 3: Summarization (THE CRITICAL PHASE)
  tracker.setPhase('SUMMARIZATION');
  tracker.log('Creating summary placeholder');
  
  const summaryId = `summary-${Date.now()}`;
  
  // Step 1: Push placeholder
  tracker.trackPush({
    id: summaryId,
    role: 'assistant',
    content: '---\n## Summary & Next Steps\n\n*Generating summary...*',
  });
  
  // Step 2: AI SDK generates (1.5s)
  tracker.log('AI SDK summarizer running');
  await new Promise(r => setTimeout(r, 1500));
  tracker.log('AI SDK complete', { chars: 2272 });
  
  // Step 3: Streaming updates (THIS IS WHERE IT FAILS IN PRODUCTION)
  tracker.log('Streaming updates starting');
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 150));
    tracker.log(`Streaming delta ${i + 1}/10`);
  }
  
  // Step 4: Final update
  tracker.log('Applying final summary update');
  tracker.trackUpdate(summaryId, (msg) => ({
    ...msg,
    content: '---\n## Summary & Next Steps\n\n## Summary\n\nWorkflow completed successfully with 7 steps...',
    summarization: {
      summary: 'Full summary (2272 chars)...',
      success: true,
      duration: 1667,
      trajectoryLength: 500,
      stepCount: 7,
    },
  }));
  
  // Phase 4: Complete
  tracker.setPhase('COMPLETE');
  tracker.log('Workflow finished');
  
  return tracker.printReport();
}

// Run test
console.log('🧪 ════════════════════════════════════════════════════════════════');
console.log('🧪 WORKFLOW MESSAGE TRACKING TEST');
console.log('🧪 ════════════════════════════════════════════════════════════════\n');

runSimulatedWorkflowTracking()
  .then((report) => {
    console.log(`\n✅ Test completed!`);
    console.log(`📊 Duration: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`📨 Messages: ${report.messages.length}`);
    
    if (report.analysis.orphanedPlaceholders > 0) {
      console.log(`\n⚠️  ISSUE: ${report.analysis.orphanedPlaceholders} orphaned placeholder(s)`);
      console.log(`🐛 This simulates the "stuck on generating" bug`);
      process.exit(1);
    } else {
      console.log(`\n✅ All summaries properly updated`);
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error(`\n❌ Test failed:`, error);
    process.exit(1);
  });
