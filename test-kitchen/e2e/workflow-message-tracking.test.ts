/**
 * Workflow Message Tracking Test
 * Tracks real workflow execution with message pushes and latency markers
 */

import { performance } from 'perf_hooks';

const LOG_PREFIX = '📊 [MESSAGE-TRACKING]';

interface MessageEvent {
  timestamp: number;
  relativeTime: number;
  type: 'push' | 'update';
  messageId: string;
  role: string;
  contentPreview: string;
  hasArtifacts: {
    planning?: boolean;
    toolExecutions?: boolean;
    summarization?: boolean;
    workflowTasks?: boolean;
    pageContext?: boolean;
    executionTrajectory?: boolean;
  };
}

interface WorkflowPhase {
  name: string;
  startTime: number;
  endTime?: number;
  events: MessageEvent[];
  duration?: number;
}

class WorkflowMessageTracker {
  private startTime: number;
  private phases: WorkflowPhase[] = [];
  private currentPhase: WorkflowPhase | null = null;
  private allMessages: any[] = [];
  private messageEvents: MessageEvent[] = [];
  
  constructor() {
    this.startTime = performance.now();
    console.log(`${LOG_PREFIX} ⏱️  Tracker initialized at t=0ms\n`);
  }

  startPhase(name: string) {
    if (this.currentPhase) {
      this.endPhase();
    }
    
    const now = performance.now();
    this.currentPhase = {
      name,
      startTime: now,
      events: [],
    };
    
    console.log(`${LOG_PREFIX} 🟢 PHASE START: ${name} [t=${(now - this.startTime).toFixed(2)}ms]`);
  }

  endPhase() {
    if (!this.currentPhase) return;
    
    const now = performance.now();
    this.currentPhase.endTime = now;
    this.currentPhase.duration = now - this.currentPhase.startTime;
    
    console.log(`${LOG_PREFIX} 🔴 PHASE END: ${this.currentPhase.name} [duration=${this.currentPhase.duration.toFixed(2)}ms, events=${this.currentPhase.events.length}]`);
    
    this.phases.push(this.currentPhase);
    this.currentPhase = null;
  }

  trackPush(message: any) {
    const now = performance.now();
    const relativeTime = now - this.startTime;
    
    const event: MessageEvent = {
      timestamp: now,
      relativeTime,
      type: 'push',
      messageId: message.id,
      role: message.role,
      contentPreview: message.content?.substring(0, 80) || '(empty)',
      hasArtifacts: {
        planning: !!message.planning,
        toolExecutions: !!(message.toolExecutions?.length > 0),
        summarization: !!message.summarization,
        workflowTasks: !!(message.workflowTasks?.length > 0),
        pageContext: !!message.pageContext,
        executionTrajectory: !!(message.executionTrajectory?.length > 0),
      },
    };
    
    this.messageEvents.push(event);
    if (this.currentPhase) {
      this.currentPhase.events.push(event);
    }
    
    this.allMessages.push({ ...message, _trackedAt: relativeTime });
    
    const artifacts = Object.entries(event.hasArtifacts)
      .filter(([_, has]) => has)
      .map(([name]) => name)
      .join(', ') || 'none';
    
    console.log(`${LOG_PREFIX} 📨 PUSH [t=${relativeTime.toFixed(2)}ms] ${message.role} "${event.contentPreview}..." (artifacts: ${artifacts})`);
  }

  trackUpdate(messageId: string, updateType: string, updatedContent?: string) {
    const now = performance.now();
    const relativeTime = now - this.startTime;
    
    const event: MessageEvent = {
      timestamp: now,
      relativeTime,
      type: 'update',
      messageId,
      role: 'update',
      contentPreview: updatedContent?.substring(0, 80) || '(update)',
      hasArtifacts: {},
    };
    
    this.messageEvents.push(event);
    if (this.currentPhase) {
      this.currentPhase.events.push(event);
    }
    
    console.log(`${LOG_PREFIX} 🔄 UPDATE [t=${relativeTime.toFixed(2)}ms] ${messageId} → ${updateType}`);
  }

  generateReport() {
    if (this.currentPhase) {
      this.endPhase();
    }
    
    const totalDuration = performance.now() - this.startTime;
    
    console.log('\n' + '='.repeat(100));
    console.log('📊 WORKFLOW MESSAGE TRACKING REPORT');
    console.log('='.repeat(100));
    console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`📨 Total Messages: ${this.allMessages.length}`);
    console.log(`🔄 Total Events: ${this.messageEvents.length}`);
    console.log(`📋 Total Phases: ${this.phases.length}`);
    console.log('='.repeat(100));
    
    // Phase breakdown
    console.log('\n📋 PHASE-BY-PHASE BREAKDOWN:\n');
    this.phases.forEach((phase, idx) => {
      const phaseDuration = phase.duration?.toFixed(2) || 'N/A';
      const phasePercent = phase.duration ? ((phase.duration / totalDuration) * 100).toFixed(1) : '0';
      
      console.log(`${idx + 1}. ${phase.name}: ${phaseDuration}ms (${phasePercent}% of total)`);
      console.log(`   Events in this phase: ${phase.events.length}`);
      
      const pushEvents = phase.events.filter(e => e.type === 'push');
      const updateEvents = phase.events.filter(e => e.type === 'update');
      console.log(`   - Pushes: ${pushEvents.length}`);
      console.log(`   - Updates: ${updateEvents.length}`);
      
      if (pushEvents.length > 0) {
        console.log(`   Messages pushed:`);
        pushEvents.forEach((event, i) => {
          console.log(`     ${i + 1}. [${event.relativeTime.toFixed(2)}ms] ${event.role}: "${event.contentPreview}..."`);
        });
      }
      console.log('');
    });
    
    // Message timeline
    console.log('💬 COMPLETE MESSAGE TIMELINE:\n');
    this.allMessages.forEach((msg, idx) => {
      const trackedAt = msg._trackedAt?.toFixed(2) || 'N/A';
      console.log(`${idx + 1}. [t=${trackedAt}ms] ${msg.role} (${msg.id})`);
      console.log(`   Content: "${msg.content?.substring(0, 100)}..."`);
      
      const artifacts = [];
      if (msg.planning) artifacts.push('📋 planning');
      if (msg.toolExecutions?.length) artifacts.push(`🛠️  tools(${msg.toolExecutions.length})`);
      if (msg.summarization) artifacts.push('📊 summary');
      if (msg.workflowTasks?.length) artifacts.push(`✅ tasks(${msg.workflowTasks.length})`);
      if (msg.pageContext) artifacts.push('📄 context');
      if (msg.executionTrajectory?.length) artifacts.push(`🔷 trajectory(${msg.executionTrajectory.length})`);
      
      if (artifacts.length > 0) {
        console.log(`   Artifacts: ${artifacts.join(', ')}`);
      }
      console.log('');
    });
    
    // Analysis
    console.log('🔍 CRITICAL PATH ANALYSIS:\n');
    
    // Check for summary message
    const summaryMessages = this.allMessages.filter(m => 
      m.content?.includes('Summary & Next Steps')
    );
    
    console.log(`1. Summary Messages Found: ${summaryMessages.length}`);
    summaryMessages.forEach((msg, idx) => {
      const isPlaceholder = msg.content?.includes('*Generating summary...*');
      const hasSummaryArtifact = !!msg.summarization;
      
      console.log(`   ${idx + 1}. ${msg.id} - ${isPlaceholder ? '📝 PLACEHOLDER' : '✅ FINAL'}`);
      console.log(`      Has summary artifact: ${hasSummaryArtifact}`);
      console.log(`      Pushed at: ${msg._trackedAt?.toFixed(2)}ms`);
    });
    
    // Check for placeholder that wasn't updated
    const orphanedPlaceholders = summaryMessages.filter(m => 
      m.content?.includes('*Generating summary...*') && !m.summarization
    );
    
    if (orphanedPlaceholders.length > 0) {
      console.log(`\n  ⚠️  WARNING: ${orphanedPlaceholders.length} orphaned placeholder(s) detected!`);
      console.log(`  🐛 These placeholders were created but never updated with final summary`);
      orphanedPlaceholders.forEach((msg, idx) => {
        console.log(`     ${idx + 1}. ${msg.id} - stuck at "${msg.content.substring(0, 60)}..."`);
      });
    }
    
    // Check timing gaps
    console.log('\n2. Timing Gaps Analysis:');
    const summaryPhase = this.phases.find(p => p.name === 'SUMMARIZATION');
    if (summaryPhase) {
      const placeholderPush = summaryPhase.events.find(e => 
        e.type === 'push' && e.contentPreview.includes('Generating')
      );
      const finalUpdate = summaryPhase.events.find(e => 
        e.type === 'update' && e.contentPreview !== '(update)'
      );
      
      if (placeholderPush && finalUpdate) {
        const gap = finalUpdate.relativeTime - placeholderPush.relativeTime;
        console.log(`   Time from placeholder to final update: ${gap.toFixed(2)}ms`);
      } else if (placeholderPush && !finalUpdate) {
        console.log(`   ⚠️  Placeholder pushed but NO final update detected!`);
        console.log(`   🐛 This is the root cause of the "stuck on generating" issue`);
      }
    }
    
    console.log('\n' + '='.repeat(100));
    
    return {
      totalDuration,
      phases: this.phases,
      messages: this.allMessages,
      messageEvents: this.messageEvents,
      analysis: {
        summaryMessagesCount: summaryMessages.length,
        orphanedPlaceholders: orphanedPlaceholders.length,
        hasCompleteSummary: summaryMessages.some(m => 
          !m.content?.includes('*Generating') && m.summarization
        ),
      },
    };
  }
}

// Export for use in other tests
export { WorkflowMessageTracker };

// Run test if executed directly
if (require.main === module) {
  console.log('🧪 Running Workflow Message Tracking Test\n');
  testWorkflowWithLatencyTracking();
}

