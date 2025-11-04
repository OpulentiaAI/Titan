// Streaming Artifacts Integration Example
// Demonstrates how to use streaming artifacts in enhanced workflow

import {
  artifact,
  createMessageArtifactWriter,
  executionPlanArtifact,
  toolResultsArtifact,
  evaluationArtifact,
  pageContextArtifact,
  updateExecutionPlanProgress,
  addToolResult,
} from '../lib/streaming-artifacts';
import type { Message } from '../types';

/**
 * Example 1: Streaming Execution Plan with Progress
 */
export async function exampleStreamingExecutionPlan(
  messageWriter: {
    updateLastMessage: (updater: (msg: Message) => Message) => void;
    pushMessage: (msg: Message) => void;
  }
) {
  // Create artifact writer
  const artifactWriter = createMessageArtifactWriter(messageWriter);

  // Start streaming execution plan
  const planStream = executionPlanArtifact.stream(artifactWriter);

  // Initialize plan
  planStream.update({
    objective: 'Navigate to GitHub and search for AI SDK',
    approach: 'Direct navigation → search input → submit → verify results',
    totalSteps: 5,
    steps: [
      {
        step: 1,
        action: 'navigate',
        target: 'https://github.com',
        status: 'pending',
        reasoning: 'Start at GitHub homepage',
        result: undefined,
      },
      {
        step: 2,
        action: 'getPageContext',
        status: 'pending',
        reasoning: 'Verify page loaded and identify search field',
        result: undefined,
      },
      {
        step: 3,
        action: 'type',
        target: 'input[name="q"]',
        status: 'pending',
        reasoning: 'Enter search query "AI SDK"',
        result: undefined,
      },
      {
        step: 4,
        action: 'pressKey',
        target: 'Enter',
        status: 'pending',
        reasoning: 'Submit search form',
        result: undefined,
      },
      {
        step: 5,
        action: 'getPageContext',
        status: 'pending',
        reasoning: 'Verify search results are displayed',
        result: undefined,
      },
    ],
  });

  // Execute steps and update progress
  for (let i = 0; i < 5; i++) {
    // Mark step as in progress
    updateExecutionPlanProgress(planStream, i, 'in_progress');

    // Simulate step execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mark step as completed with result
    updateExecutionPlanProgress(
      planStream,
      i,
      'completed',
      `Step ${i + 1} executed successfully`
    );
  }

  // Complete artifact
  const finalPlan = planStream.complete();
  console.log('Execution plan completed:', finalPlan.validate());

  return finalPlan;
}

/**
 * Example 2: Streaming Tool Results with Real-time Updates
 */
export async function exampleStreamingToolResults(
  messageWriter: {
    updateLastMessage: (updater: (msg: Message) => Message) => void;
    pushMessage: (msg: Message) => void;
  }
) {
  const artifactWriter = createMessageArtifactWriter(messageWriter);
  const resultsStream = toolResultsArtifact.stream(artifactWriter);

  // Simulate tool executions
  const toolCalls = [
    {
      toolName: 'navigate',
      args: { url: 'https://github.com' },
      execute: async () => ({ success: true, message: 'Navigation successful' }),
    },
    {
      toolName: 'getPageContext',
      args: {},
      execute: async () => ({
        url: 'https://github.com',
        title: 'GitHub',
        text: 'Build software better, together',
      }),
    },
    {
      toolName: 'type',
      args: { selector: 'input[name="q"]', text: 'AI SDK' },
      execute: async () => ({ success: true, message: 'Text entered' }),
    },
  ];

  for (const call of toolCalls) {
    const startTime = Date.now();
    try {
      const result = await call.execute();
      const duration = Date.now() - startTime;

      addToolResult(resultsStream, {
        toolName: call.toolName,
        args: call.args,
        result,
        duration,
        success: true,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;

      addToolResult(resultsStream, {
        toolName: call.toolName,
        args: call.args,
        result: null,
        duration,
        success: false,
        error: error.message,
      });
    }
  }

  const finalResults = resultsStream.complete();
  console.log('Tool results completed:', finalResults.validate());

  return finalResults;
}

/**
 * Example 3: Complete Workflow with Multiple Artifacts
 */
export async function exampleCompleteWorkflowWithArtifacts(
  messageWriter: {
    updateLastMessage: (updater: (msg: Message) => Message) => void;
    pushMessage: (msg: Message) => void;
  }
) {
  const artifactWriter = createMessageArtifactWriter(messageWriter);

  // 1. Start execution plan artifact
  const planStream = executionPlanArtifact.stream(artifactWriter);
  planStream.update({
    objective: 'Complete browser automation task',
    approach: 'Multi-step execution with validation',
    totalSteps: 3,
    steps: [
      { step: 1, action: 'navigate', status: 'pending', reasoning: 'Start' },
      { step: 2, action: 'type', status: 'pending', reasoning: 'Input' },
      { step: 3, action: 'click', status: 'pending', reasoning: 'Submit' },
    ],
  });

  // 2. Start tool results artifact
  const resultsStream = toolResultsArtifact.stream(artifactWriter);

  // 3. Start page context artifact
  const contextStream = pageContextArtifact.stream(artifactWriter);

  // Execute workflow
  try {
    // Step 1: Navigate
    updateExecutionPlanProgress(planStream, 0, 'in_progress');
    const navStart = Date.now();
    // ... execute navigate
    addToolResult(resultsStream, {
      toolName: 'navigate',
      args: { url: 'https://example.com' },
      result: { success: true },
      duration: Date.now() - navStart,
      success: true,
    });
    updateExecutionPlanProgress(planStream, 0, 'completed', 'Navigation successful');

    // Update page context
    contextStream.update({
      url: 'https://example.com',
      title: 'Example Domain',
      textContent: 'This domain is for use in illustrative examples...',
      links: [{ text: 'More information...', href: 'https://www.iana.org/domains/example' }],
      forms: [],
      viewport: { width: 1280, height: 720 },
      timestamp: Date.now(),
    });

    // Step 2: Type
    updateExecutionPlanProgress(planStream, 1, 'in_progress');
    const typeStart = Date.now();
    // ... execute type
    addToolResult(resultsStream, {
      toolName: 'type',
      args: { selector: 'input', text: 'test' },
      result: { success: true },
      duration: Date.now() - typeStart,
      success: true,
    });
    updateExecutionPlanProgress(planStream, 1, 'completed', 'Text entered');

    // Step 3: Click
    updateExecutionPlanProgress(planStream, 2, 'in_progress');
    const clickStart = Date.now();
    // ... execute click
    addToolResult(resultsStream, {
      toolName: 'click',
      args: { selector: 'button' },
      result: { success: true },
      duration: Date.now() - clickStart,
      success: true,
    });
    updateExecutionPlanProgress(planStream, 2, 'completed', 'Button clicked');

    // Complete all artifacts
    const finalPlan = planStream.complete();
    const finalResults = resultsStream.complete();
    const finalContext = contextStream.complete();

    // 4. Generate evaluation artifact
    const evaluationStream = evaluationArtifact.stream(artifactWriter);
    evaluationStream.update({
      quality: 'excellent',
      score: 0.95,
      completeness: 1.0,
      correctness: 0.95,
      issues: [],
      strengths: [
        'All steps completed successfully',
        'Fast execution times',
        'Proper validation at each step',
      ],
      shouldProceed: true,
      timestamp: Date.now(),
    });
    const finalEvaluation = evaluationStream.complete();

    return {
      plan: finalPlan.validate(),
      results: finalResults.validate(),
      context: finalContext.validate(),
      evaluation: finalEvaluation.validate(),
    };
  } catch (error: any) {
    // Handle errors in artifacts
    planStream.error(`Execution failed: ${error.message}`);
    resultsStream.error(`Execution failed: ${error.message}`);
    throw error;
  }
}

/**
 * Example 4: Using Artifacts in Enhanced Streaming Step
 */
export async function enhancedStreamingWithArtifacts(
  model: any,
  tools: Record<string, any>,
  messages: Message[],
  messageWriter: {
    updateLastMessage: (updater: (msg: Message) => Message) => void;
    pushMessage: (msg: Message) => void;
  }
) {
  const artifactWriter = createMessageArtifactWriter(messageWriter);

  // Initialize artifacts
  const planStream = executionPlanArtifact.stream(artifactWriter);
  const resultsStream = toolResultsArtifact.stream(artifactWriter);

  // Set initial plan
  planStream.update({
    objective: 'Execute user query with browser automation',
    approach: 'AI-driven step-by-step execution',
    totalSteps: 0, // Will be updated as we go
    steps: [],
  });

  // Create agent (simplified for example)
  const { ToolLoopAgent } = await import('../lib/tool-loop-agent');
  const agent = new ToolLoopAgent({
    model,
    tools,
    instructions: 'Execute browser automation tasks',
    experimental_reasoning: { enabled: true, effort: 'medium' },
  });

  // Execute with artifact tracking
  const result = await agent.run(messages, {
    onToolCall: async (toolName: string, args: any) => {
      // Add to plan
      const currentSteps = planStream.current.steps || [];
      const stepNumber = currentSteps.length + 1;

      planStream.update({
        totalSteps: stepNumber,
        steps: [
          ...currentSteps,
          {
            step: stepNumber,
            action: toolName,
            target: args.url || args.selector || args.text || JSON.stringify(args),
            status: 'in_progress',
            reasoning: `Executing ${toolName}`,
          },
        ],
      });

      return null; // Allow execution
    },
    onToolResult: async (toolName: string, args: any, result: any, duration: number) => {
      // Update plan step
      const currentSteps = planStream.current.steps || [];
      const stepIndex = currentSteps.length - 1;
      updateExecutionPlanProgress(planStream, stepIndex, 'completed', 'Success');

      // Add to results
      addToolResult(resultsStream, {
        toolName,
        args,
        result,
        duration,
        success: !result.error,
        error: result.error,
      });
    },
  });

  // Complete artifacts
  const finalPlan = planStream.complete();
  const finalResults = resultsStream.complete();

  return {
    agentResult: result,
    artifacts: {
      plan: finalPlan.validate(),
      results: finalResults.validate(),
    },
  };
}

/**
 * Example 5: Artifact Subscription for Real-time UI Updates
 */
export function exampleArtifactSubscription(
  planStream: ReturnType<typeof executionPlanArtifact.stream>
) {
  // Subscribe to updates
  const unsubscribe = planStream.subscribe((data) => {
    console.log('Execution plan updated:', data);

    // Update UI based on progress
    if (data.progress !== undefined) {
      console.log(`Progress: ${(data.progress * 100).toFixed(1)}%`);
    }

    // Check current step
    if (data.currentStep !== undefined && data.steps) {
      const currentStep = data.steps[data.currentStep];
      if (currentStep) {
        console.log(`Current step: ${currentStep.action} - ${currentStep.status}`);
      }
    }
  });

  // Later: unsubscribe when done
  return unsubscribe;
}

/**
 * Integration with Message Component
 */
export function renderMessageWithArtifacts(message: Message) {
  // This would be used in the UI component
  const artifacts = message.artifacts || {};

  return {
    messageContent: message.content,
    artifacts: Object.entries(artifacts).map(([id, artifactData]) => ({
      id,
      type: artifactData.metadata.type,
      status: artifactData.metadata.status,
      data: artifactData.data,
      component: 'ArtifactRenderer', // Would render with <ArtifactRenderer artifact={artifactData} />
    })),
  };
}
