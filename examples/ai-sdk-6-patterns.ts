/**
 * AI SDK 6 Patterns - Comprehensive Examples
 *
 * This file demonstrates all AI SDK 6 patterns implemented in Atlas:
 * 1. Tool Approval Flow
 * 2. Output Strategies
 * 3. Evaluator-Optimizer Pattern
 * 4. Auto-Submit for Approvals
 * 5. Sequential Generations
 * 6. Reasoning Tokens
 */

import { Experimental_Agent as ToolLoopAgent, stepCountIs, tool, Output } from 'ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  createToolWithApproval,
  createNavigationApprovalPolicy,
  createFormSubmissionApprovalPolicy,
  createExecutionPlanOutput,
  createToolExecutionSummaryOutput,
  createPageAnalysisOutput,
  createDecisionOutput,
  shouldAutoSubmitForApprovals,
  evaluateExecutionQuality,
  sequentialGeneration,
  createReasoningConfig,
} from '../lib/ai-sdk-6-enhancements';
import { evaluationStep, formatEvaluationSummary } from '../steps/evaluation-step';

// ============================================================================
// EXAMPLE 1: Tool Approval Flow
// ============================================================================

/**
 * Example: Create tools with approval policies
 */
export function example1_ToolApprovalFlow() {
  // Navigation tool with dynamic approval
  const navigateWithApproval = createToolWithApproval({
    description: 'Navigate to a URL with approval for external/sensitive domains',
    parameters: z.object({
      url: z.string().url().describe('The URL to navigate to'),
    }),
    execute: async ({ url }) => {
      console.log(`Navigating to: ${url}`);
      return { success: true, url };
    },
    approval: {
      // Dynamic approval based on URL properties
      dynamic: createNavigationApprovalPolicy({
        allowedDomains: ['github.com', 'stackoverflow.com', 'npmjs.com'],
        blockedDomains: ['malicious.com', 'spam-site.com'],
        requireApprovalForExternal: true,
      }),
      message: (args) => `The agent wants to navigate to: ${args.url}. Do you approve?`,
    },
  });

  // Form submission tool with approval for sensitive data
  const submitFormWithApproval = createToolWithApproval({
    description: 'Submit a form with approval for sensitive fields',
    parameters: z.object({
      formData: z.record(z.any()).describe('Form data to submit'),
      action: z.string().url().describe('Form action URL'),
    }),
    execute: async ({ formData, action }) => {
      console.log(`Submitting form to: ${action}`);
      return { success: true, submitted: Object.keys(formData).length };
    },
    approval: {
      // Approval for forms with sensitive fields
      dynamic: createFormSubmissionApprovalPolicy({
        sensitiveFields: ['password', 'credit_card', 'ssn', 'api_key', 'token'],
        maxDataSize: 10000, // 10KB
        alwaysRequireApproval: false,
      }),
      message: (args) =>
        `The agent wants to submit a form with fields: ${Object.keys(args.formData).join(', ')}. Do you approve?`,
    },
  });

  return {
    navigate: navigateWithApproval,
    submitForm: submitFormWithApproval,
  };
}

// ============================================================================
// EXAMPLE 2: Output Strategies
// ============================================================================

/**
 * Example: Use Output strategies for structured data generation
 */
export async function example2_OutputStrategies() {
  const google = createGoogleGenerativeAI({ apiKey: process.env.GATEWAY_API_KEY! });
  const model = google('gemini-2.5-flash');

  // Example 2a: Object Output - Execution Plan Tracker
  console.log('\n=== Example 2a: Object Output ===\n');

  const agentWithObjectOutput = new ToolLoopAgent({
    model,
    instructions: `You are a browser automation agent executing a plan to search for React documentation.

Track your progress by updating the execution plan as you work.`,
    tools: {
      search: tool({
        description: 'Search the web',
        parameters: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          return { results: [`Result 1 for ${query}`, `Result 2 for ${query}`] };
        },
      }),
    },
    output: createExecutionPlanOutput(),
  });

  const result1 = await agentWithObjectOutput.generate({
    messages: [{ role: 'user', content: 'Search for React documentation and find the hooks guide' }],
  });

  console.log('Structured Output:', result1.output);
  console.log('Current Step:', result1.output?.currentStep);
  console.log('Confidence:', result1.output?.confidence);

  // Example 2b: Array Output - Tool Execution Summary
  console.log('\n=== Example 2b: Array Output ===\n');

  const agentWithArrayOutput = new ToolLoopAgent({
    model,
    instructions: 'Execute multiple navigation and analysis actions.',
    tools: {
      navigate: tool({
        description: 'Navigate to URL',
        parameters: z.object({ url: z.string() }),
        execute: async ({ url }) => ({ success: true, url }),
      }),
      analyze: tool({
        description: 'Analyze page',
        parameters: z.object({}),
        execute: async () => ({ pageTitle: 'Example', links: 10 }),
      }),
    },
    output: createToolExecutionSummaryOutput(),
  });

  const result2 = await agentWithArrayOutput.generate({
    messages: [{ role: 'user', content: 'Navigate to example.com and analyze the page' }],
  });

  console.log('Tool Executions:', result2.output?.toolsExecuted);
  console.log('Overall Success:', result2.output?.overallSuccess);

  // Example 2c: Choice Output - Decision Making
  console.log('\n=== Example 2c: Choice Output ===\n');

  const agentWithChoiceOutput = new ToolLoopAgent({
    model,
    instructions: 'Decide the best action based on page state.',
    tools: {},
    output: createDecisionOutput(['proceed', 'retry', 'skip', 'abort']),
  });

  const result3 = await agentWithChoiceOutput.generate({
    messages: [
      {
        role: 'user',
        content: 'The page failed to load. What should we do?',
      },
    ],
  });

  console.log('Decision:', result3.output);

  // Example 2d: Page Analysis Output
  console.log('\n=== Example 2d: Page Analysis Output ===\n');

  const agentWithPageAnalysis = new ToolLoopAgent({
    model,
    instructions: 'Analyze the current page state and provide recommendations.',
    tools: {
      getPageContext: tool({
        description: 'Get current page context',
        parameters: z.object({}),
        execute: async () => ({
          title: 'Example Page',
          links: ['Link 1', 'Link 2'],
          forms: [{ id: 'login-form', inputs: ['username', 'password'] }],
        }),
      }),
    },
    output: createPageAnalysisOutput(),
  });

  const result4 = await agentWithPageAnalysis.generate({
    messages: [{ role: 'user', content: 'Analyze the current page' }],
  });

  console.log('Page Ready:', result4.output?.pageReady);
  console.log('Interactive Elements:', result4.output?.interactiveElements);
  console.log('Recommendations:', result4.output?.recommendations);
}

// ============================================================================
// EXAMPLE 3: Evaluator-Optimizer Pattern
// ============================================================================

/**
 * Example: Implement quality control loop with evaluation
 */
export async function example3_EvaluatorOptimizer() {
  console.log('\n=== Example 3: Evaluator-Optimizer Pattern ===\n');

  const google = createGoogleGenerativeAI({ apiKey: process.env.GATEWAY_API_KEY! });
  const model = google('gemini-2.5-flash');

  // Simulate an execution result
  const executionResult = {
    fullText: 'Successfully navigated to GitHub and found the repository.',
    textChunkCount: 10,
    toolCallCount: 3,
    toolExecutions: [
      { tool: 'navigate', success: true, duration: 1234 },
      { tool: 'getPageContext', success: true, duration: 456 },
      { tool: 'click', success: false, duration: 789 }, // One failure
    ],
    usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    finishReason: 'stop',
    duration: 5000,
    executionSteps: [],
  };

  const plan = {
    steps: [
      { action: 'navigate', target: 'https://github.com', expectedOutcome: 'GitHub homepage loads' },
      { action: 'getPageContext', expectedOutcome: 'Page context retrieved' },
      { action: 'click', target: 'search button', expectedOutcome: 'Search activated' },
    ],
  };

  // Evaluate execution quality
  const evaluation = await evaluationStep({
    model,
    executionResult: executionResult as any,
    originalQuery: 'Navigate to GitHub and search for AI SDK',
    plan,
    evaluationCriteria: {
      requiredTools: ['navigate', 'getPageContext'],
      minSuccessRate: 0.8,
      maxErrors: 1,
      textMinLength: 50,
    },
  });

  console.log('Evaluation Result:');
  console.log(formatEvaluationSummary(evaluation));

  // Decision logic based on evaluation
  if (evaluation.shouldRetry) {
    console.log('\n🔄 Retrying with improvements...');
    console.log('Retry Strategy:', evaluation.retryStrategy);

    // Implement retry with modifications
    // const retryResult = await streamingStep({
    //   model,
    //   system: enhanceSystemPrompt(evaluation.retryStrategy),
    //   tools,
    //   messages: enhanceMessages(evaluation.recommendations),
    // });
  } else if (evaluation.shouldProceed) {
    console.log('\n✅ Execution quality acceptable, proceeding...');
  } else {
    console.log('\n⚠️ Manual review required');
  }
}

// ============================================================================
// EXAMPLE 4: Auto-Submit for Approvals
// ============================================================================

/**
 * Example: Auto-submit after all approvals are resolved
 */
export function example4_AutoSubmit() {
  console.log('\n=== Example 4: Auto-Submit for Approvals ===\n');

  // Simulate messages with approval flow
  const messagesWithPendingApproval = [
    { role: 'user', content: 'Navigate to example.com' },
    {
      role: 'assistant',
      content: 'I need your approval to navigate to an external site.',
      toolExecutions: [
        {
          toolCallId: 'call-1',
          toolName: 'navigate',
          status: 'approval-pending',
          input: { url: 'https://example.com' },
        },
      ],
    },
  ];

  console.log('Before approval:');
  console.log('Should auto-submit?', shouldAutoSubmitForApprovals(messagesWithPendingApproval));

  // User approves
  const messagesWithResolvedApproval = [
    { role: 'user', content: 'Navigate to example.com' },
    {
      role: 'assistant',
      content: 'I need your approval to navigate to an external site.',
      toolExecutions: [
        {
          toolCallId: 'call-1',
          toolName: 'navigate',
          status: 'approved', // Changed from 'approval-pending'
          input: { url: 'https://example.com' },
        },
      ],
    },
  ];

  console.log('\nAfter approval:');
  console.log('Should auto-submit?', shouldAutoSubmitForApprovals(messagesWithResolvedApproval));

  // Implementation in UI
  const handleApprovalResponse = (approvalId: string, approved: boolean) => {
    // Update approval status in messages
    // ...

    // Check if should auto-continue
    if (shouldAutoSubmitForApprovals(messagesWithResolvedApproval)) {
      console.log('✅ All approvals resolved, automatically continuing execution...');
      // continueAgentExecution();
    }
  };

  handleApprovalResponse('call-1', true);
}

// ============================================================================
// EXAMPLE 5: Sequential Generations
// ============================================================================

/**
 * Example: Chain multiple generations with context passing
 */
export async function example5_SequentialGenerations() {
  console.log('\n=== Example 5: Sequential Generations ===\n');

  const google = createGoogleGenerativeAI({ apiKey: process.env.GATEWAY_API_KEY! });
  const model = google('gemini-2.5-flash');

  const results = await sequentialGeneration(
    [
      {
        name: 'generate-ideas',
        generate: async () => {
          console.log('Step 1: Generating blog post ideas...');
          const { object } = await import('ai').then((ai) =>
            ai.generateObject({
              model,
              schema: z.object({
                ideas: z.array(z.string()).length(5),
              }),
              prompt: 'Generate 5 blog post ideas about browser automation with AI',
            })
          );
          return object;
        },
      },
      {
        name: 'select-best',
        generate: async (previousResult) => {
          console.log('Step 2: Selecting best idea...');
          const { object } = await import('ai').then((ai) =>
            ai.generateObject({
              model,
              schema: z.object({
                selectedIdea: z.string(),
                reasoning: z.string(),
              }),
              prompt: `Select the best blog post idea from these options and explain why:
${previousResult.ideas.map((idea: string, i: number) => `${i + 1}. ${idea}`).join('\n')}`,
            })
          );
          return object;
        },
      },
      {
        name: 'create-outline',
        generate: async (previousResult) => {
          console.log('Step 3: Creating outline...');
          const { object } = await import('ai').then((ai) =>
            ai.generateObject({
              model,
              schema: z.object({
                title: z.string(),
                outline: z.array(
                  z.object({
                    section: z.string(),
                    points: z.array(z.string()),
                  })
                ),
              }),
              prompt: `Create a detailed outline for this blog post: "${previousResult.selectedIdea}"`,
            })
          );
          return object;
        },
      },
    ],
    {
      onStepComplete: (stepName, result, stepIndex) => {
        console.log(`✓ ${stepName} complete (step ${stepIndex + 1}/3)`);
        console.log(JSON.stringify(result, null, 2));
        console.log('');
      },
      onError: (stepName, error, stepIndex) => {
        console.error(`✗ ${stepName} failed:`, error.message);
      },
    }
  );

  console.log('\n=== Final Result ===\n');
  console.log('Ideas:', results[0]);
  console.log('Selected:', results[1]);
  console.log('Outline:', results[2]);

  return results;
}

// ============================================================================
// EXAMPLE 6: Reasoning Tokens
// ============================================================================

/**
 * Example: Use reasoning tokens for transparent AI decision-making
 */
export async function example6_ReasoningTokens() {
  console.log('\n=== Example 6: Reasoning Tokens ===\n');

  const google = createGoogleGenerativeAI({ apiKey: process.env.GATEWAY_API_KEY! });
  const model = google('gemini-2.5-flash');

  // Create reasoning config for model
  const reasoningConfig = createReasoningConfig('gemini-2.5-flash', {
    enabled: true,
    effort: 'medium',
    exclude: false,
  });

  console.log('Reasoning Config:', reasoningConfig);

  const agent = new ToolLoopAgent({
    model,
    instructions: `You are a browser automation expert. Think carefully about each action.

Explain your reasoning for each decision.`,
    tools: {
      navigate: tool({
        description: 'Navigate to a URL',
        parameters: z.object({ url: z.string() }),
        execute: async ({ url }) => ({ success: true, url }),
      }),
      click: tool({
        description: 'Click an element',
        parameters: z.object({ selector: z.string() }),
        execute: async ({ selector }) => ({ success: true, selector }),
      }),
    },
    experimental_reasoning: reasoningConfig,
  });

  const result = await agent.stream({
    messages: [
      {
        role: 'user',
        content: 'Navigate to GitHub and search for "ai-sdk"',
      },
    ],
  });

  // Process stream with reasoning
  let reasoning: string[] = [];

  for await (const part of result.fullStream) {
    if (part.type === 'reasoning-delta' || part.type === 'reasoning') {
      const reasoningText = (part as any).text || (part as any).delta || '';
      reasoning.push(reasoningText);
    }
  }

  console.log('\n=== Reasoning Tokens ===\n');
  console.log(reasoning.join(''));

  return reasoning;
}

// ============================================================================
// EXAMPLE 7: Complete Workflow with All Patterns
// ============================================================================

/**
 * Example: Combine all AI SDK 6 patterns in a complete workflow
 */
export async function example7_CompleteWorkflow() {
  console.log('\n=== Example 7: Complete Workflow (All Patterns) ===\n');

  const google = createGoogleGenerativeAI({ apiKey: process.env.GATEWAY_API_KEY! });
  const model = google('gemini-2.5-flash');

  // 1. Create tools with approval
  const toolsWithApproval = example1_ToolApprovalFlow();

  // 2. Add reasoning configuration
  const reasoningConfig = createReasoningConfig('gemini-2.5-flash', {
    enabled: true,
    effort: 'medium',
    exclude: false,
  });

  // 3. Create agent with structured output
  const agent = new ToolLoopAgent({
    model,
    instructions: `You are a browser automation agent. Execute the user's request carefully.

Provide reasoning for your decisions and track your progress.`,
    tools: {
      ...toolsWithApproval,
      getPageContext: tool({
        description: 'Get page context',
        parameters: z.object({}),
        execute: async () => ({
          url: 'https://example.com',
          title: 'Example Domain',
          links: ['More information...'],
        }),
      }),
    },
    experimental_reasoning: reasoningConfig,
    output: createExecutionPlanOutput(),
    stopWhen: [stepCountIs(10)],
  });

  // 4. Execute with streaming
  console.log('Executing workflow...\n');
  const result = await agent.stream({
    messages: [
      {
        role: 'user',
        content: 'Navigate to example.com and analyze the page structure',
      },
    ],
  });

  const streamingResult = {
    fullText: '',
    toolExecutions: [] as any[],
    reasoning: [] as string[],
  };

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      streamingResult.fullText += (part as any).text;
    } else if (part.type === 'tool-result') {
      streamingResult.toolExecutions.push({
        tool: (part as any).toolName,
        success: !(part as any).result?.error,
        duration: 1000,
      });
    } else if (part.type === 'reasoning-delta') {
      streamingResult.reasoning.push((part as any).delta || '');
    }
  }

  // 5. Evaluate execution quality
  console.log('\nEvaluating execution...\n');
  const evaluation = await evaluationStep({
    model,
    executionResult: {
      fullText: streamingResult.fullText,
      toolExecutions: streamingResult.toolExecutions,
      reasoning: streamingResult.reasoning,
      textChunkCount: 10,
      toolCallCount: streamingResult.toolExecutions.length,
      finishReason: 'stop',
      duration: 5000,
      executionSteps: [],
    } as any,
    originalQuery: 'Navigate to example.com and analyze the page structure',
    evaluationCriteria: {
      requiredTools: ['navigate', 'getPageContext'],
      minSuccessRate: 0.8,
      maxErrors: 2,
    },
  });

  console.log(formatEvaluationSummary(evaluation));

  // 6. Handle evaluation result
  if (evaluation.shouldRetry) {
    console.log('\n🔄 Quality insufficient, retrying with improvements...');
  } else if (evaluation.shouldProceed) {
    console.log('\n✅ Workflow completed successfully!');
  }

  return {
    streamingResult,
    evaluation,
  };
}

// ============================================================================
// RUN EXAMPLES
// ============================================================================

if (require.main === module) {
  (async () => {
    console.log('AI SDK 6 Patterns - Examples\n');
    console.log('='.repeat(80));

    try {
      // Run all examples
      // await example2_OutputStrategies();
      // await example3_EvaluatorOptimizer();
      // example4_AutoSubmit();
      // await example5_SequentialGenerations();
      // await example6_ReasoningTokens();
      await example7_CompleteWorkflow();

      console.log('\n' + '='.repeat(80));
      console.log('All examples completed!');
    } catch (error) {
      console.error('Error running examples:', error);
    }
  })();
}
