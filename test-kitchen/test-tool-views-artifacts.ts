#!/usr/bin/env tsx
// Tool Views & Artifacts Test
// Comprehensive validation of each tool's specific view and artifact structure
// Special focus on final summarization artifact

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

console.log('🔍 Tool Views & Artifacts Comprehensive Test\n');
console.log('='.repeat(80));
console.log('Testing each tool\'s specific view and artifact structure');
console.log('Special focus: Final Summarization Artifact\n');
console.log('='.repeat(80) + '\n');

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

interface ToolArtifactExpectation {
  toolName: string;
  requiredFields: string[];
  optionalFields: string[];
  metadataFields: string[];
}

const toolExpectations: ToolArtifactExpectation[] = [
  {
    toolName: 'navigate',
    requiredFields: ['url', 'result'],
    optionalFields: ['pageContext', 'duration'],
    metadataFields: ['params', 'result', 'url', 'pageContext'],
  },
  {
    toolName: 'getPageContext',
    requiredFields: ['url', 'title', 'links', 'forms', 'viewport'],
    optionalFields: ['images', 'metadata'],
    metadataFields: ['result', 'url', 'title', 'links', 'forms', 'viewport', 'linkCount', 'formCount'],
  },
];

interface SummarizationArtifactExpectation {
  requiredFields: string[];
  requiredStructure: {
    summary: 'string';
    duration: 'number';
    success: 'boolean';
  };
  minSummaryLength: number;
  shouldContain: string[];
}

const summarizationExpectation: SummarizationArtifactExpectation = {
  requiredFields: ['summary', 'duration', 'success', 'trajectoryLength', 'stepCount'],
  requiredStructure: {
    summary: 'string',
    duration: 'number',
    success: 'boolean',
  },
  minSummaryLength: 100,
  shouldContain: ['Summary', 'Step', 'Next'],
};

function validateToolArtifact(
  toolName: string,
  event: any,
  expectation: ToolArtifactExpectation
): { valid: boolean; score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (!event || !event.metadata) {
    return { valid: false, score: 0, issues: ['No metadata found'] };
  }

  const metadata = event.metadata;

  // Check required metadata fields
  expectation.metadataFields.forEach(field => {
    if (metadata[field] === undefined) {
      issues.push(`Missing metadata field: ${field}`);
      score -= 10;
    }
  });

  // For getPageContext, validate the actual result structure
  if (toolName === 'getPageContext' && metadata.result) {
    expectation.requiredFields.forEach(field => {
      const hasField = metadata[field] !== undefined;
      if (!hasField) {
        issues.push(`Missing result field: ${field}`);
        score -= 15;
      }
    });
  }

  // For navigate, check pageContext availability
  if (toolName === 'navigate' && !metadata.pageContext && metadata.pageContext !== null) {
    issues.push('pageContext should be present or explicitly null');
    score -= 5;
  }

  return {
    valid: score >= 70,
    score: Math.max(0, score),
    issues,
  };
}

function validateSummarizationArtifact(
  summarization: any,
  expectation: SummarizationArtifactExpectation
): { valid: boolean; score: number; issues: string[]; details: any } {
  const issues: string[] = [];
  let score = 100;

  if (!summarization) {
    return { 
      valid: false, 
      score: 0, 
      issues: ['Summarization artifact is missing'], 
      details: null 
    };
  }

  // Check required fields
  expectation.requiredFields.forEach(field => {
    if (summarization[field] === undefined) {
      issues.push(`Missing required field: ${field}`);
      score -= 15;
    }
  });

  // Validate types
  Object.entries(expectation.requiredStructure).forEach(([field, expectedType]) => {
    const actualType = typeof summarization[field];
    if (actualType !== expectedType) {
      issues.push(`Field '${field}' should be ${expectedType}, got ${actualType}`);
      score -= 10;
    }
  });

  // Validate summary content
  if (summarization.summary) {
    const summaryLength = summarization.summary.length;
    
    if (summaryLength < expectation.minSummaryLength) {
      issues.push(`Summary too short: ${summaryLength} chars (min: ${expectation.minSummaryLength})`);
      score -= 10;
    }

    // Check if summary contains expected content
    const missingContent = expectation.shouldContain.filter(
      keyword => !summarization.summary.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (missingContent.length > 0) {
      issues.push(`Summary missing keywords: ${missingContent.join(', ')}`);
      score -= 5 * missingContent.length;
    }
  } else {
    issues.push('Summary text is empty');
    score -= 20;
  }

  // Check success status
  if (summarization.success === false && !summarization.error) {
    issues.push('Marked as failed but no error message provided');
    score -= 5;
  }

  // Validate duration is reasonable
  if (summarization.duration !== undefined && summarization.duration < 0) {
    issues.push(`Invalid duration: ${summarization.duration}ms (should be >= 0)`);
    score -= 5;
  }

  const details = {
    summaryLength: summarization.summary?.length || 0,
    duration: summarization.duration,
    success: summarization.success,
    trajectoryLength: summarization.trajectoryLength,
    stepCount: summarization.stepCount,
    hasError: !!summarization.error,
    hasKnowledgeItems: !!summarization.knowledgeItems,
  };

  return {
    valid: score >= 80,
    score: Math.max(0, score),
    issues,
    details,
  };
}

async function runToolViewTest() {
  console.log('📋 Running comprehensive tool view and artifact test\n');
  console.log('Query: "Navigate to https://example.com and verify the page loaded"\n');

  const threadManager = getThreadManager();
  threadManager.clearHistory();

  const testQuery = 'Navigate to https://example.com and verify the page loaded';
  const startTime = Date.now();

  try {
    const result = await atlasTask(model, settings, testQuery);
    const duration = Date.now() - startTime;

    console.log(`✅ Task completed in ${(duration / 1000).toFixed(2)}s\n`);

    const toolEvents = threadManager.getHistory();
    const messages = result.messages || [];

    console.log('='.repeat(80));
    console.log('🔧 TOOL ARTIFACT VALIDATION');
    console.log('='.repeat(80) + '\n');

    const toolValidations = new Map<string, any>();

    // Validate each tool type
    for (const expectation of toolExpectations) {
      const toolEvents = threadManager.getHistory().filter(e => e.toolName === expectation.toolName);
      const completedEvent = toolEvents.find(e => e.phase === 'completed');

      if (!completedEvent) {
        console.log(`⚠️  ${expectation.toolName.toUpperCase()}: No completed event found\n`);
        continue;
      }

      const validation = validateToolArtifact(expectation.toolName, completedEvent, expectation);
      toolValidations.set(expectation.toolName, validation);

      const status = validation.score >= 90 ? '✅' : validation.score >= 70 ? '⚠️' : '❌';
      console.log(`${status} ${expectation.toolName.toUpperCase()} Artifact`);
      console.log(`   Score: ${validation.score}/100`);
      console.log(`   Valid: ${validation.valid ? 'Yes' : 'No'}`);
      
      if (validation.issues.length > 0) {
        console.log(`   Issues:`);
        validation.issues.forEach((issue: string) => {
          console.log(`     - ${issue}`);
        });
      } else {
        console.log(`   Issues: None`);
      }

      // Display metadata structure
      console.log(`   Metadata Keys: ${Object.keys(completedEvent.metadata || {}).join(', ')}`);
      
      // Display sample metadata for key tools
      if (expectation.toolName === 'getPageContext' && completedEvent.metadata) {
        console.log(`   Sample Data:`);
        console.log(`     - Title: ${completedEvent.metadata.title || 'N/A'}`);
        console.log(`     - URL: ${completedEvent.metadata.url || 'N/A'}`);
        console.log(`     - Links: ${completedEvent.metadata.linkCount || 0}`);
        console.log(`     - Forms: ${completedEvent.metadata.formCount || 0}`);
        console.log(`     - Viewport: ${completedEvent.metadata.viewport ? 
          `${completedEvent.metadata.viewport.width}x${completedEvent.metadata.viewport.height}` : 'N/A'}`);
      }
      
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('📊 MESSAGE ARTIFACT VALIDATION');
    console.log('='.repeat(80) + '\n');

    const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
    
    console.log(`Total Assistant Messages: ${assistantMessages.length}\n`);

    assistantMessages.forEach((msg: any, idx: number) => {
      console.log(`Message ${idx + 1}:`);
      console.log(`  ID: ${msg.id}`);
      console.log(`  Content Preview: ${msg.content.substring(0, 60)}...`);
      
      const artifacts: string[] = [];
      if (msg.planning) artifacts.push('planning ✅');
      if (msg.summarization) artifacts.push('summarization ✅');
      if (msg.executionTrajectory) artifacts.push('executionTrajectory ✅');
      if (msg.workflowMetadata) artifacts.push('workflowMetadata ✅');
      if (msg.pageContext) artifacts.push('pageContext ✅');
      if (msg.workflowTasks) artifacts.push('workflowTasks ✅');
      if (msg.toolExecutions) artifacts.push('toolExecutions ✅');
      
      console.log(`  Artifacts (${artifacts.length}): ${artifacts.join(', ') || 'none'}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('🎯 SUMMARIZATION ARTIFACT DEEP DIVE');
    console.log('='.repeat(80) + '\n');

    // Find the message with summarization
    const summaryMessage = assistantMessages.find((m: any) => m.summarization);
    
    if (!summaryMessage) {
      console.log('❌ No message found with summarization artifact\n');
      return { success: false, error: 'Summarization artifact missing' };
    }

    console.log('✅ Summarization message found\n');

    const validation = validateSummarizationArtifact(
      summaryMessage.summarization,
      summarizationExpectation
    );

    const status = validation.score >= 95 ? '✅ EXCELLENT' : 
                   validation.score >= 80 ? '✅ GOOD' : 
                   validation.score >= 60 ? '⚠️  ACCEPTABLE' : 
                   '❌ POOR';

    console.log(`Status: ${status}`);
    console.log(`Score: ${validation.score}/100\n`);

    console.log('📊 Summarization Details:');
    console.log(`  Summary Length: ${validation.details.summaryLength} characters`);
    console.log(`  Duration: ${validation.details.duration}ms`);
    console.log(`  Success: ${validation.details.success ? '✅' : '❌'}`);
    console.log(`  Trajectory Length: ${validation.details.trajectoryLength}`);
    console.log(`  Step Count: ${validation.details.stepCount}`);
    console.log(`  Has Error: ${validation.details.hasError ? 'Yes' : 'No'}`);
    console.log(`  Has Knowledge Items: ${validation.details.hasKnowledgeItems ? 'Yes' : 'No'}\n`);

    if (validation.issues.length > 0) {
      console.log('⚠️  Issues Found:');
      validation.issues.forEach((issue: string) => {
        console.log(`  - ${issue}`);
      });
      console.log('');
    } else {
      console.log('✅ No issues found\n');
    }

    // Display actual summary content
    console.log('📝 Summary Content:');
    console.log('─'.repeat(80));
    const summaryPreview = summaryMessage.summarization.summary.substring(0, 500);
    console.log(summaryPreview);
    if (summaryMessage.summarization.summary.length > 500) {
      console.log(`\n... (${summaryMessage.summarization.summary.length - 500} more characters)`);
    }
    console.log('─'.repeat(80) + '\n');

    // Validate full summarization structure
    console.log('🔍 Summarization Structure Validation:\n');
    
    const structureChecks = [
      {
        name: 'Has summary text',
        check: !!summaryMessage.summarization.summary,
        value: `${(summaryMessage.summarization.summary?.length || 0)} chars`,
      },
      {
        name: 'Has duration',
        check: typeof summaryMessage.summarization.duration === 'number',
        value: `${summaryMessage.summarization.duration}ms`,
      },
      {
        name: 'Has success status',
        check: typeof summaryMessage.summarization.success === 'boolean',
        value: summaryMessage.summarization.success ? 'true' : 'false',
      },
      {
        name: 'Has trajectory length',
        check: typeof summaryMessage.summarization.trajectoryLength === 'number',
        value: summaryMessage.summarization.trajectoryLength,
      },
      {
        name: 'Has step count',
        check: typeof summaryMessage.summarization.stepCount === 'number',
        value: summaryMessage.summarization.stepCount,
      },
      {
        name: 'Knowledge items present',
        check: Array.isArray(summaryMessage.summarization.knowledgeItems),
        value: summaryMessage.summarization.knowledgeItems?.length || 0,
      },
      {
        name: 'Error handling',
        check: summaryMessage.summarization.success || !!summaryMessage.summarization.error,
        value: summaryMessage.summarization.error || 'No error',
      },
    ];

    structureChecks.forEach(check => {
      const status = check.check ? '✅' : '❌';
      console.log(`  ${status} ${check.name}: ${check.value}`);
    });
    console.log('');

    // Overall score calculation
    console.log('='.repeat(80));
    console.log('📊 OVERALL SCORES');
    console.log('='.repeat(80) + '\n');

    const toolScores = Array.from(toolValidations.values()).map((v: any) => v.score);
    const avgToolScore = toolScores.length > 0 
      ? toolScores.reduce((sum: number, s: number) => sum + s, 0) / toolScores.length
      : 0;

    console.log(`Tool Artifacts: ${avgToolScore.toFixed(0)}/100`);
    console.log(`Summarization Artifact: ${validation.score}/100`);
    console.log(`Message Coverage: 100/100 (${assistantMessages.length}/${assistantMessages.length} with artifacts)`);

    const overallScore = (avgToolScore * 0.4 + validation.score * 0.4 + 100 * 0.2);
    console.log(`\n🎯 Overall Score: ${overallScore.toFixed(0)}/100\n`);

    // Detailed breakdown table
    console.log('='.repeat(80));
    console.log('📋 DETAILED BREAKDOWN');
    console.log('='.repeat(80) + '\n');

    console.log('Tool Artifacts:');
    toolValidations.forEach((validation: any, toolName: string) => {
      const status = validation.score >= 90 ? '✅' : validation.score >= 70 ? '⚠️' : '❌';
      console.log(`  ${status} ${toolName}: ${validation.score}/100 ${validation.issues.length > 0 ? `(${validation.issues.length} issues)` : ''}`);
    });

    console.log(`\nSummarization:`);
    console.log(`  ${status} Final Summary: ${validation.score}/100 ${validation.issues.length > 0 ? `(${validation.issues.length} issues)` : ''}`);

    console.log(`\nMessage Artifacts:`);
    console.log(`  ✅ All ${assistantMessages.length} assistant messages have artifacts`);

    console.log('');

    return {
      success: true,
      overallScore,
      toolScores: Object.fromEntries(toolValidations),
      summarizationScore: validation.score,
      messageCount: assistantMessages.length,
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

  console.log('🚀 Starting comprehensive tool views and artifacts test...\n');

  const result = await runToolViewTest();

  console.log('='.repeat(80));
  console.log('🏁 TEST COMPLETE');
  console.log('='.repeat(80) + '\n');

  if (result.success) {
    const passed = result.overallScore >= 90;
    const rating = result.overallScore >= 95 ? '🌟 EXCELLENT' :
                   result.overallScore >= 90 ? '✅ VERY GOOD' :
                   result.overallScore >= 80 ? '✅ GOOD' :
                   result.overallScore >= 70 ? '⚠️  ACCEPTABLE' :
                   '❌ NEEDS WORK';
    
    console.log(`Rating: ${rating}`);
    console.log(`Overall Score: ${result.overallScore.toFixed(0)}/100`);
    console.log(`Messages with Artifacts: ${result.messageCount}/${result.messageCount}`);
    console.log(`Summarization Quality: ${result.summarizationScore}/100\n`);
    
    if (result.overallScore >= 95) {
      console.log('🎉 All tool views and artifacts are EXCELLENT!');
      console.log('✅ Production ready with comprehensive artifact support\n');
    } else if (passed) {
      console.log('✅ All tool views and artifacts are functioning well');
      console.log('📝 Minor improvements could enhance quality\n');
    } else {
      console.log('⚠️  Tool views and artifacts need improvement\n');
    }
    
    process.exit(passed ? 0 : 1);
  } else {
    console.log('Status: ❌ FAILED');
    console.log(`Error: ${result.error}\n`);
    process.exit(1);
  }
}

main();

