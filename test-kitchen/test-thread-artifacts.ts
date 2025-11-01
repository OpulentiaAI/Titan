#!/usr/bin/env tsx
// Thread Artifacts & Views Test
// Validates that thread manager properly populates artifacts and views for each tool/event

// Polyfill for AI SDK
(globalThis as any).__name = (globalThis as any).__name || ((target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {
    // Ignore
  }
  return target;
});
(global as any).__name = (globalThis as any).__name;

import { atlasTask } from './atlasTask.js';
import type { AtlasModel, AtlasSettings } from './types.js';
import { getThreadManager } from '../lib/thread-manager.js';

console.log('🧵 Testing Thread Artifacts & Views Population\n');
console.log('='.repeat(80));

const model: AtlasModel = {
  name: 'gateway-flash-lite',
  model_slug: 'google/gemini-2.5-flash-lite-preview-09-2025',
  provider: 'gateway',
  computerUseEngine: 'gateway-flash-lite',
  maxTokens: 8192,
};

const settings: AtlasSettings = {
  provider: 'gateway',
  apiKey: process.env.AI_GATEWAY_API_KEY!,
  model: 'google/gemini-2.5-flash-lite-preview-09-2025',
  computerUseEngine: 'gateway-flash-lite',
};

interface ArtifactValidation {
  toolName: string;
  expectedArtifacts: string[];
  expectedMetadata: string[];
  requiredPhases: string[];
}

const toolArtifactSpecs: ArtifactValidation[] = [
  {
    toolName: 'navigate',
    expectedArtifacts: ['url', 'pageContext'],
    expectedMetadata: ['params', 'result'],
    requiredPhases: ['starting', 'executing', 'completed'],
  },
  {
    toolName: 'getPageContext',
    expectedArtifacts: ['url', 'title', 'links', 'forms', 'viewport'],
    expectedMetadata: ['result'],
    requiredPhases: ['starting', 'executing', 'completed'],
  },
  {
    toolName: 'click',
    expectedArtifacts: ['selector', 'url'],
    expectedMetadata: ['params', 'result'],
    requiredPhases: ['starting', 'executing', 'completed'],
  },
  {
    toolName: 'type',
    expectedArtifacts: ['text', 'selector', 'url'],
    expectedMetadata: ['params', 'result'],
    requiredPhases: ['starting', 'executing', 'completed'],
  },
];

interface ArtifactAnalysis {
  toolName: string;
  totalEvents: number;
  phases: Set<string>;
  hasMetadata: boolean;
  metadataKeys: Set<string>;
  artifactsFound: string[];
  missingArtifacts: string[];
  missingMetadata: string[];
  missingPhases: string[];
  complete: boolean;
  score: number; // 0-100
}

function analyzeToolArtifacts(
  toolName: string,
  events: any[],
  spec: ArtifactValidation
): ArtifactAnalysis {
  const toolEvents = events.filter(e => e.toolName === toolName);
  
  if (toolEvents.length === 0) {
    return {
      toolName,
      totalEvents: 0,
      phases: new Set(),
      hasMetadata: false,
      metadataKeys: new Set(),
      artifactsFound: [],
      missingArtifacts: spec.expectedArtifacts,
      missingMetadata: spec.expectedMetadata,
      missingPhases: spec.requiredPhases,
      complete: false,
      score: 0,
    };
  }

  const phases = new Set(toolEvents.map(e => e.phase));
  const allMetadataKeys = new Set<string>();
  const artifactsFound = new Set<string>();

  toolEvents.forEach(event => {
    if (event.metadata) {
      Object.keys(event.metadata).forEach(key => {
        allMetadataKeys.add(key);
        
        // Deep scan for artifacts in metadata
        const metadata = event.metadata[key];
        if (metadata && typeof metadata === 'object') {
          Object.keys(metadata).forEach(artifactKey => {
            if (spec.expectedArtifacts.includes(artifactKey)) {
              artifactsFound.add(artifactKey);
            }
          });
        }
        
        // Check if the key itself is an expected artifact
        if (spec.expectedArtifacts.includes(key)) {
          artifactsFound.add(key);
        }
      });
    }
  });

  const missingArtifacts = spec.expectedArtifacts.filter(a => !artifactsFound.has(a));
  const missingMetadata = spec.expectedMetadata.filter(m => !allMetadataKeys.has(m));
  const missingPhases = spec.requiredPhases.filter(p => !phases.has(p));

  // Calculate completeness score
  const artifactScore = (artifactsFound.size / spec.expectedArtifacts.length) * 40;
  const metadataScore = ((spec.expectedMetadata.length - missingMetadata.length) / spec.expectedMetadata.length) * 30;
  const phaseScore = ((spec.requiredPhases.length - missingPhases.length) / spec.requiredPhases.length) * 30;
  const score = Math.round(artifactScore + metadataScore + phaseScore);

  return {
    toolName,
    totalEvents: toolEvents.length,
    phases,
    hasMetadata: allMetadataKeys.size > 0,
    metadataKeys: allMetadataKeys,
    artifactsFound: Array.from(artifactsFound),
    missingArtifacts,
    missingMetadata,
    missingPhases,
    complete: missingArtifacts.length === 0 && missingMetadata.length === 0 && missingPhases.length === 0,
    score,
  };
}

interface MessageArtifactAnalysis {
  totalMessages: number;
  messagesWithArtifacts: number;
  artifactTypes: Set<string>;
  hasPlanning: boolean;
  hasSummarization: boolean;
  hasExecutionTrajectory: boolean;
  hasWorkflowMetadata: boolean;
  hasPageContext: boolean;
  hasToolExecutions: boolean;
}

function analyzeMessageArtifacts(messages: any[]): MessageArtifactAnalysis {
  const artifactTypes = new Set<string>();
  let messagesWithArtifacts = 0;

  let hasPlanning = false;
  let hasSummarization = false;
  let hasExecutionTrajectory = false;
  let hasWorkflowMetadata = false;
  let hasPageContext = false;
  let hasToolExecutions = false;

  messages.forEach(msg => {
    let hasAny = false;

    if (msg.planning) {
      artifactTypes.add('planning');
      hasPlanning = true;
      hasAny = true;
    }
    if (msg.summarization) {
      artifactTypes.add('summarization');
      hasSummarization = true;
      hasAny = true;
    }
    if (msg.executionTrajectory) {
      artifactTypes.add('executionTrajectory');
      hasExecutionTrajectory = true;
      hasAny = true;
    }
    if (msg.workflowMetadata) {
      artifactTypes.add('workflowMetadata');
      hasWorkflowMetadata = true;
      hasAny = true;
    }
    if (msg.pageContext) {
      artifactTypes.add('pageContext');
      hasPageContext = true;
      hasAny = true;
    }
    if (msg.workflowTasks) {
      artifactTypes.add('workflowTasks');
      hasAny = true;
    }
    if (msg.toolExecutions) {
      artifactTypes.add('toolExecutions');
      hasToolExecutions = true;
      hasAny = true;
    }

    if (hasAny) messagesWithArtifacts++;
  });

  return {
    totalMessages: messages.length,
    messagesWithArtifacts,
    artifactTypes,
    hasPlanning,
    hasSummarization,
    hasExecutionTrajectory,
    hasWorkflowMetadata,
    hasPageContext,
    hasToolExecutions,
  };
}

async function runArtifactTest() {
  console.log('\n📋 Running comprehensive artifact validation test...\n');
  console.log('Query: "Navigate to https://example.com and verify the page loaded"\n');

  const threadManager = getThreadManager();
  threadManager.clearHistory();

  const testQuery = 'Navigate to https://example.com and verify the page loaded';
  const startTime = Date.now();

  try {
    const result = await atlasTask(model, settings, testQuery);
    const duration = Date.now() - startTime;

    console.log(`✅ Task completed in ${(duration / 1000).toFixed(2)}s\n`);

    // Get all thread events
    const toolEvents = threadManager.getHistory();
    const messages = result.messages || [];

    console.log('='.repeat(80));
    console.log('🔧 TOOL LIFECYCLE EVENT ANALYSIS');
    console.log('='.repeat(80) + '\n');

    // Analyze each tool type
    const analyses: ArtifactAnalysis[] = [];
    const toolUsage = new Map<string, number>();

    toolEvents.forEach(event => {
      toolUsage.set(event.toolName, (toolUsage.get(event.toolName) || 0) + 1);
    });

    console.log(`Total Tool Events: ${toolEvents.length}`);
    console.log(`Unique Tools Used: ${toolUsage.size}`);
    console.log(`Tools: ${Array.from(toolUsage.keys()).join(', ')}\n`);

    // Validate each tool's artifacts
    for (const spec of toolArtifactSpecs) {
      const analysis = analyzeToolArtifacts(spec.toolName, toolEvents, spec);
      
      if (analysis.totalEvents > 0) {
        analyses.push(analysis);
        
        const status = analysis.score >= 80 ? '✅' : analysis.score >= 50 ? '⚠️' : '❌';
        console.log(`${status} ${spec.toolName.toUpperCase()}`);
        console.log(`   Events: ${analysis.totalEvents}`);
        console.log(`   Phases: ${Array.from(analysis.phases).join(', ')}`);
        console.log(`   Metadata Keys: ${Array.from(analysis.metadataKeys).join(', ')}`);
        console.log(`   Artifacts Found: ${analysis.artifactsFound.join(', ') || 'none'}`);
        
        if (analysis.missingArtifacts.length > 0) {
          console.log(`   ❌ Missing Artifacts: ${analysis.missingArtifacts.join(', ')}`);
        }
        if (analysis.missingMetadata.length > 0) {
          console.log(`   ⚠️  Missing Metadata: ${analysis.missingMetadata.join(', ')}`);
        }
        if (analysis.missingPhases.length > 0) {
          console.log(`   ⚠️  Missing Phases: ${analysis.missingPhases.join(', ')}`);
        }
        
        console.log(`   Score: ${analysis.score}/100\n`);
      }
    }

    // Message artifact analysis
    console.log('='.repeat(80));
    console.log('💬 MESSAGE ARTIFACT ANALYSIS');
    console.log('='.repeat(80) + '\n');

    const msgAnalysis = analyzeMessageArtifacts(messages);

    console.log(`Total Messages: ${msgAnalysis.totalMessages}`);
    console.log(`Messages with Artifacts: ${msgAnalysis.messagesWithArtifacts}`);
    console.log(`Artifact Types: ${Array.from(msgAnalysis.artifactTypes).join(', ')}\n`);

    console.log('Artifact Presence:');
    console.log(`  Planning: ${msgAnalysis.hasPlanning ? '✅' : '❌'}`);
    console.log(`  Summarization: ${msgAnalysis.hasSummarization ? '✅' : '❌'}`);
    console.log(`  Execution Trajectory: ${msgAnalysis.hasExecutionTrajectory ? '✅' : '❌'}`);
    console.log(`  Workflow Metadata: ${msgAnalysis.hasWorkflowMetadata ? '✅' : '❌'}`);
    console.log(`  Page Context: ${msgAnalysis.hasPageContext ? '✅' : '❌'}`);
    console.log(`  Tool Executions: ${msgAnalysis.hasToolExecutions ? '✅' : '❌'}\n`);

    // Detailed message breakdown
    console.log('='.repeat(80));
    console.log('📨 DETAILED MESSAGE BREAKDOWN');
    console.log('='.repeat(80) + '\n');

    messages.forEach((msg: any, idx: number) => {
      console.log(`Message ${idx + 1} (${msg.role}):`);
      console.log(`  ID: ${msg.id}`);
      console.log(`  Content Length: ${msg.content?.length || 0} chars`);
      
      const artifacts: string[] = [];
      if (msg.planning) artifacts.push('planning');
      if (msg.summarization) artifacts.push('summarization');
      if (msg.executionTrajectory) artifacts.push('executionTrajectory');
      if (msg.workflowMetadata) artifacts.push('workflowMetadata');
      if (msg.pageContext) artifacts.push('pageContext');
      if (msg.workflowTasks) artifacts.push('workflowTasks');
      if (msg.toolExecutions) artifacts.push('toolExecutions');
      
      console.log(`  Artifacts: ${artifacts.length > 0 ? artifacts.join(', ') : 'none'}`);
      
      if (msg.workflowTasks) {
        const tasks = msg.workflowTasks;
        console.log(`  Workflow Tasks: ${tasks.length}`);
        tasks.forEach((task: any) => {
          console.log(`    - ${task.title}: ${task.status}`);
        });
      }
      
      console.log('');
    });

    // Overall score
    console.log('='.repeat(80));
    console.log('📊 OVERALL ARTIFACT COMPLETENESS');
    console.log('='.repeat(80) + '\n');

    const avgToolScore = analyses.reduce((sum, a) => sum + a.score, 0) / (analyses.length || 1);
    // Calculate message artifact score excluding user messages (they shouldn't have artifacts)
    const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
    const messageArtifactScore = assistantMessages.length > 0 
      ? (msgAnalysis.messagesWithArtifacts / assistantMessages.length) * 100
      : 0;
    
    const criticalArtifacts = [
      msgAnalysis.hasPlanning,
      msgAnalysis.hasSummarization,
      msgAnalysis.hasExecutionTrajectory,
    ];
    const criticalScore = (criticalArtifacts.filter(Boolean).length / criticalArtifacts.length) * 100;

    console.log(`Tool Lifecycle Artifacts: ${avgToolScore.toFixed(0)}/100`);
    console.log(`Message Artifact Coverage: ${messageArtifactScore.toFixed(0)}/100`);
    console.log(`Critical Artifacts: ${criticalScore.toFixed(0)}/100`);
    
    const overallScore = (avgToolScore * 0.4 + messageArtifactScore * 0.3 + criticalScore * 0.3);
    console.log(`\n🎯 Overall Score: ${overallScore.toFixed(0)}/100\n`);

    // Recommendations
    if (overallScore < 80) {
      console.log('💡 RECOMMENDATIONS:\n');
      
      if (avgToolScore < 80) {
        console.log('  - Enhance tool lifecycle event metadata');
        analyses.forEach(a => {
          if (a.score < 80 && a.missingArtifacts.length > 0) {
            console.log(`    • ${a.toolName}: Add ${a.missingArtifacts.join(', ')}`);
          }
        });
      }
      
      if (!msgAnalysis.hasPlanning) {
        console.log('  - Add planning artifacts to messages');
      }
      if (!msgAnalysis.hasSummarization) {
        console.log('  - Add summarization artifacts to messages');
      }
      if (!msgAnalysis.hasExecutionTrajectory) {
        console.log('  - Add execution trajectory to messages');
      }
      
      console.log('');
    }

    // Detailed tool event dump for debugging
    console.log('='.repeat(80));
    console.log('🔍 SAMPLE TOOL EVENT STRUCTURE');
    console.log('='.repeat(80) + '\n');

    const sampleEvent = toolEvents.find(e => e.phase === 'completed');
    if (sampleEvent) {
      console.log('Sample Completed Event:');
      console.log(JSON.stringify(sampleEvent, null, 2));
    }

    return {
      success: true,
      overallScore,
      avgToolScore,
      messageArtifactScore,
      criticalScore,
      analyses,
      msgAnalysis,
    };

  } catch (error: any) {
    console.error('\n❌ Test failed:', error?.message || error);
    console.error(error?.stack);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('❌ AI_GATEWAY_API_KEY not set');
    process.exit(1);
  }

  const result = await runArtifactTest();

  console.log('='.repeat(80));
  console.log('🏁 TEST COMPLETE');
  console.log('='.repeat(80) + '\n');

  if (result.success) {
    const passed = result.overallScore >= 80;
    console.log(`Status: ${passed ? '✅ PASS' : '⚠️  NEEDS IMPROVEMENT'}`);
    console.log(`Overall Score: ${result.overallScore.toFixed(0)}/100\n`);
    
    process.exit(passed ? 0 : 1);
  } else {
    console.log('Status: ❌ FAILED');
    console.log(`Error: ${result.error}\n`);
    process.exit(1);
  }
}

main();

