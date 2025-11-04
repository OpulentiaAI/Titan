# AI SDK 6 Integration Guide

This document explains how Atlas integrates the latest AI SDK v6 beta patterns for optimal agent performance and reliable workflow execution.

## Table of Contents

1. [Overview](#overview)
2. [Tool Approval Flow](#tool-approval-flow)
3. [Output Strategies](#output-strategies)
4. [Evaluator-Optimizer Pattern](#evaluator-optimizer-pattern)
5. [Auto-Submit for Approvals](#auto-submit-for-approvals)
6. [Stream Protocol](#stream-protocol)
7. [Sequential Generations](#sequential-generations)
8. [Reasoning Tokens](#reasoning-tokens)
9. [Best Practices](#best-practices)

## Overview

Atlas implements all key AI SDK 6 patterns as documented in:
- [AI SDK 6 Beta Announcement](https://v6.ai-sdk.dev/docs/announcing-ai-sdk-6-beta)
- [Building Agents](https://v6.ai-sdk.dev/docs/agents/building-agents)
- [Agent Workflows](https://v6.ai-sdk.dev/docs/agents/workflows)
- [Loop Control](https://v6.ai-sdk.dev/docs/agents/loop-control)

### Key Features Implemented

✅ **Agent Abstraction** - Using `ToolLoopAgent` for standardized agent building
✅ **Tool Approval Flow** - Dynamic approval for sensitive operations
✅ **Structured Output** - `Output.object()`, `Output.array()`, `Output.choice()` strategies
✅ **Evaluator-Optimizer** - Quality control loops for iterative improvement
✅ **Auto-Submit** - Automatic continuation after approval responses
✅ **Loop Control** - Advanced stop conditions and prepareStep configuration
✅ **Stream Protocol** - Proper SSE format with text/reasoning/tool parts
✅ **Sequential Generations** - Chaining pattern for multi-step workflows
✅ **Reasoning Support** - Integration with reasoning-capable models (Gemini 2.5, o1, DeepSeek)

## Tool Approval Flow

### Overview

AI SDK 6 introduces the `needsApproval` parameter for tools, enabling user confirmation before executing sensitive operations.

### Implementation

```typescript
import { createToolWithApproval, createNavigationApprovalPolicy } from './lib/ai-sdk-6-enhancements';
import { z } from 'zod';

// Create a tool with approval flow
const navigateWithApproval = createToolWithApproval({
  description: 'Navigate to a URL with approval for external/sensitive domains',
  parameters: z.object({
    url: z.string().url(),
  }),
  execute: async ({ url }) => {
    // Execute navigation
    return await executeTool('navigate', { url });
  },
  approval: {
    // Dynamic approval based on URL
    dynamic: createNavigationApprovalPolicy({
      allowedDomains: ['example.com', 'trusted-site.com'],
      blockedDomains: ['malicious.com'],
      requireApprovalForExternal: true,
    }),
    message: (args) => `Do you want to navigate to ${args.url}?`,
  },
});
```

### Approval Policies

#### Navigation Approval

```typescript
const navigationApproval = createNavigationApprovalPolicy({
  allowedDomains: ['github.com', 'stackoverflow.com'],
  blockedDomains: ['suspicious-site.com'],
  requireApprovalForExternal: true,
});
```

#### Form Submission Approval

```typescript
import { createFormSubmissionApprovalPolicy } from './lib/ai-sdk-6-enhancements';

const formApproval = createFormSubmissionApprovalPolicy({
  sensitiveFields: ['password', 'credit_card', 'ssn', 'api_key'],
  maxDataSize: 10000, // 10KB
  alwaysRequireApproval: false,
});
```

### Usage in Workflow

The tool approval flow is integrated into the agent streaming step:

```typescript
// In streaming-step.ts
const agent = new ToolLoopAgent({
  model,
  tools: {
    navigate: navigateWithApproval, // Tool with approval
    click: clickTool,
    // ... other tools
  },
  // Agent automatically handles approval flow
});
```

## Output Strategies

### Overview

AI SDK 6 introduces `Output` strategies for generating structured data alongside tool execution.

### Available Strategies

#### 1. Object Output

For structured object generation:

```typescript
import { createExecutionPlanOutput } from './lib/ai-sdk-6-enhancements';

const agent = new ToolLoopAgent({
  model,
  tools,
  output: createExecutionPlanOutput(), // Structured plan tracking
});
```

**Schema:**
```typescript
{
  currentStep: number,
  totalSteps: number,
  completedSteps: number[],
  nextAction: string,
  confidence: number,
  blockers?: string[]
}
```

#### 2. Array Output

For streaming array elements:

```typescript
import { Output } from 'ai';

const toolSummaryOutput = Output.array({
  itemSchema: z.object({
    toolName: z.string(),
    success: z.boolean(),
    duration: z.number(),
    outcome: z.string(),
  }),
  name: 'tool_execution_array',
});
```

#### 3. Choice Output

For decision making:

```typescript
import { createDecisionOutput } from './lib/ai-sdk-6-enhancements';

const decisionOutput = createDecisionOutput([
  'proceed',
  'retry',
  'skip',
  'abort',
]);
```

### Integration Example

```typescript
// In streaming step with structured output
const agent = new ToolLoopAgent({
  model,
  instructions: systemPrompt,
  tools,

  // Structured output alongside tool execution
  output: createToolExecutionSummaryOutput(),
});

const result = await agent.generate({ messages });

// Access structured output
console.log('Structured output:', result.output);
console.log('Tool executions:', result.steps);
```

## Evaluator-Optimizer Pattern

### Overview

The Evaluator-Optimizer pattern implements quality control loops, assessing execution results and determining whether to proceed, retry, or take corrective action.

### Architecture

```
┌─────────────┐
│   Planning  │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  Execution  │ ◄──────┐
└─────┬───────┘        │
      │                │
      ▼                │
┌─────────────┐        │
│ Evaluation  │        │
└─────┬───────┘        │
      │                │
      ▼                │
  ┌───────┐            │
  │ Good? │───No───────┘
  └───┬───┘
      │ Yes
      ▼
┌─────────────┐
│   Complete  │
└─────────────┘
```

### Implementation

```typescript
import { evaluationStep, shouldImmediatelyRetry } from './steps/evaluation-step';

// After streaming step
const streaming = await streamingStep({
  model,
  system,
  tools,
  messages,
  // ...
});

// Evaluate execution quality
const evaluation = await evaluationStep({
  model,
  executionResult: streaming,
  originalQuery: userQuery,
  plan: planning.plan,
  evaluationCriteria: {
    requiredTools: ['navigate', 'getPageContext'],
    minSuccessRate: 0.7,
    maxErrors: 3,
    textMinLength: 100,
  },
});

// Decision logic
if (shouldImmediatelyRetry(evaluation)) {
  // Retry with modifications
  const retryStreaming = await streamingStep({
    model,
    system: enhanceSystemPromptWithEvaluation(system, evaluation),
    tools,
    messages: enhanceMessagesWithRetryStrategy(messages, evaluation.retryStrategy),
    // ...
  });
} else if (evaluation.shouldProceed) {
  // Proceed to next phase
  const summarization = await summarizationStep({ /* ... */ });
} else {
  // Manual review needed
  console.warn('Manual review required:', evaluation.issues);
}
```

### Evaluation Criteria

```typescript
const evaluationCriteria = {
  // Required tools that must execute successfully
  requiredTools: ['navigate', 'click', 'getPageContext'],

  // Minimum success rate for tool executions (0-1)
  minSuccessRate: 0.8,

  // Maximum number of errors allowed
  maxErrors: 2,

  // Minimum text output length (chars)
  textMinLength: 200,

  // Custom criteria description
  customCriteria: 'All navigation steps must succeed without errors',
};
```

### Evaluation Output

```typescript
interface EvaluationStepOutput {
  quality: 'excellent' | 'good' | 'acceptable' | 'poor' | 'failed';
  score: number; // 0-1
  completeness: number; // 0-1
  correctness: number; // 0-1
  issues: string[];
  successes: string[];
  recommendations: string[];
  shouldRetry: boolean;
  shouldProceed: boolean;
  retryStrategy?: {
    approach: string;
    focusAreas: string[];
    modifications: string[];
  };
}
```

## Auto-Submit for Approvals

### Overview

AI SDK 6 introduces `lastAssistantMessageIsCompleteWithApprovalResponses` to automatically continue conversations after approval responses.

### Implementation

```typescript
import { shouldAutoSubmitForApprovals } from './lib/ai-sdk-6-enhancements';

// In message handling logic
const handleApprovalResponse = (approvalId: string, approved: boolean) => {
  // Update approval status
  updateLastMessage((msg) => ({
    ...msg,
    toolExecutions: msg.toolExecutions?.map(exec =>
      exec.toolCallId === approvalId
        ? { ...exec, status: approved ? 'approved' : 'rejected' }
        : exec
    ),
  }));

  // Check if should auto-submit
  if (shouldAutoSubmitForApprovals(messages)) {
    // Automatically continue agent execution
    continueAgentExecution();
  }
};
```

### Auto-Submit Logic

```typescript
export function shouldAutoSubmitForApprovals(messages: any[]): boolean {
  if (messages.length === 0) return false;

  const lastMessage = messages[messages.length - 1];

  // Check if last message is from assistant
  if (lastMessage.role !== 'assistant') return false;

  // Check if message has approval responses
  const hasApprovalResponses = lastMessage.toolExecutions?.some(
    (exec: any) => exec.status === 'approval-pending'
  );

  if (!hasApprovalResponses) return false;

  // Check if all approvals are resolved
  const allApprovalsResolved = lastMessage.toolExecutions?.every(
    (exec: any) => exec.status !== 'approval-pending'
  );

  return allApprovalsResolved;
}
```

## Stream Protocol

### Overview

Atlas uses the AI SDK data stream protocol with Server-Sent Events (SSE) format for improved standardization, keep-alive, reconnect capabilities, and better cache handling.

### Message Format

The stream protocol uses structured message parts:

```typescript
// Text content (start/delta/end pattern)
{ type: 'text-start', id: 'text-0' }
{ type: 'text-delta', id: 'text-0', delta: 'Hello' }
{ type: 'text-end', id: 'text-0' }

// Reasoning content
{ type: 'reasoning-delta', delta: 'Analyzing page structure...' }
{ type: 'reasoning-details', details: { type: 'reasoning.summary', summary: '...' } }

// Tool interactions
{ type: 'tool-call', toolCallId: 'call-1', toolName: 'navigate', args: { url: '...' } }
{ type: 'tool-result', toolCallId: 'call-1', result: { success: true } }

// Metadata
{ type: 'start-step', stepNumber: 1 }
{ type: 'finish-step', stepNumber: 1, finishReason: 'tool-calls' }
{ type: 'finish', finishReason: 'stop' }
```

### Implementation

The streaming step (`steps/streaming-step.ts`) handles all stream protocol events:

```typescript
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta':
      // Handle text streaming
      fullText += part.text;
      updateLastMessage((msg) => ({ ...msg, content: fullText }));
      break;

    case 'reasoning-delta':
      // Handle reasoning tokens
      reasoning.push(part.delta);
      updateLastMessage((msg) => ({ ...msg, reasoning }));
      break;

    case 'tool-call':
      // Handle tool execution start
      updateLastMessage((msg) => ({
        ...msg,
        toolExecutions: [
          ...msg.toolExecutions,
          { toolCallId: part.toolCallId, status: 'input-streaming' }
        ],
      }));
      break;

    case 'tool-result':
      // Handle tool execution complete
      updateLastMessage((msg) => ({
        ...msg,
        toolExecutions: msg.toolExecutions.map(exec =>
          exec.toolCallId === part.toolCallId
            ? { ...exec, status: 'output-available', result: part.result }
            : exec
        ),
      }));
      break;
  }
}
```

## Sequential Generations

### Overview

Sequential generations chain multiple generation steps where each step's output becomes the next step's input.

### Implementation

```typescript
import { sequentialGeneration } from './lib/ai-sdk-6-enhancements';

const results = await sequentialGeneration([
  {
    name: 'generate-ideas',
    generate: async () => {
      return await generateObject({
        model,
        schema: z.object({ ideas: z.array(z.string()) }),
        prompt: 'Generate 5 blog post ideas about AI',
      });
    },
  },
  {
    name: 'select-best',
    generate: async (previousResult) => {
      return await generateObject({
        model,
        schema: z.object({ selectedIdea: z.string(), reasoning: z.string() }),
        prompt: `Select the best idea from: ${previousResult.ideas.join(', ')}`,
      });
    },
  },
  {
    name: 'create-outline',
    generate: async (previousResult) => {
      return await generateObject({
        model,
        schema: z.object({
          outline: z.array(z.object({
            section: z.string(),
            points: z.array(z.string()),
          }))
        }),
        prompt: `Create an outline for: ${previousResult.selectedIdea}`,
      });
    },
  },
], {
  onStepComplete: (stepName, result, stepIndex) => {
    console.log(`✓ ${stepName} complete:`, result);
  },
});

console.log('Final outline:', results[2]);
```

### Use Cases

- **Progressive Refinement**: Brainstorm → Evaluate → Elaborate
- **Multi-Stage Analysis**: Extract → Analyze → Summarize
- **Content Creation**: Idea → Outline → Draft → Edit

## Reasoning Tokens

### Overview

AI SDK 6 supports reasoning tokens for models that expose their thought process (o1, DeepSeek, Gemini 2.5).

### Configuration

```typescript
import { createReasoningConfig } from './lib/ai-sdk-6-enhancements';

const reasoningConfig = createReasoningConfig(modelName, {
  enabled: true,
  effort: 'medium', // 'low' | 'medium' | 'high'
  exclude: false, // Whether to exclude from response
});

const agent = new ToolLoopAgent({
  model,
  tools,
  experimental_reasoning: reasoningConfig,
});
```

### Reasoning Effort Levels

- **low**: ~25% of tokens for reasoning
- **medium**: ~50% of tokens for reasoning
- **high**: ~75% of tokens for reasoning

### Accessing Reasoning

```typescript
const result = await agent.generate({ messages });

// Access reasoning tokens
console.log('Reasoning:', result.reasoning);

// Detailed reasoning breakdown
console.log('Reasoning details:', result.reasoningDetails);
```

### Display in UI

```typescript
import { Reasoning, ReasoningTrigger, ReasoningContent } from './components/ai-elements/reasoning';

<Reasoning>
  <ReasoningTrigger>
    <button>Show Reasoning</button>
  </ReasoningTrigger>
  <ReasoningContent>
    {message.reasoning?.map((r, i) => (
      <div key={i}>{r}</div>
    ))}
  </ReasoningContent>
</Reasoning>
```

## Best Practices

### 1. Tool Approval Best Practices

- ✅ Use dynamic approval for context-sensitive decisions
- ✅ Provide clear approval messages explaining why approval is needed
- ✅ Implement approval policies for categories (navigation, forms, data)
- ❌ Don't require approval for low-risk operations
- ❌ Don't use static approval when dynamic logic would be better

### 2. Output Strategies Best Practices

- ✅ Use `Output.object()` for structured results (plans, summaries)
- ✅ Use `Output.array()` for streaming collections
- ✅ Use `Output.choice()` for decision points
- ✅ Validate output schemas with Zod
- ❌ Don't over-structure - use plain text when appropriate

### 3. Evaluator-Optimizer Best Practices

- ✅ Define clear evaluation criteria upfront
- ✅ Set appropriate quality thresholds
- ✅ Limit retry attempts (max 2-3)
- ✅ Provide specific retry strategies
- ❌ Don't retry indefinitely
- ❌ Don't evaluate without clear criteria

### 4. Auto-Submit Best Practices

- ✅ Check all approvals are resolved before auto-submitting
- ✅ Provide feedback when auto-submitting
- ✅ Allow manual override of auto-submit
- ❌ Don't auto-submit with pending approvals
- ❌ Don't auto-submit without user awareness

### 5. Stream Protocol Best Practices

- ✅ Handle all stream event types
- ✅ Update UI incrementally for responsiveness
- ✅ Track tool execution states (streaming → available → complete)
- ✅ Display reasoning tokens when available
- ❌ Don't block on stream events
- ❌ Don't lose partial results on error

## Migration Guide

### From AI SDK 5 to AI SDK 6

#### 1. Update Dependencies

```bash
npm install ai@6.0.0-beta.88 @ai-sdk/google@3.0.0-beta.36 @ai-sdk/anthropic@3.0.0-beta.47
```

#### 2. Update Agent Creation

**Before (AI SDK 5):**
```typescript
const result = await streamText({
  model,
  messages,
  tools,
  maxSteps: 10,
});
```

**After (AI SDK 6):**
```typescript
import { Experimental_Agent as ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model,
  instructions: systemPrompt,
  tools,
  stopWhen: [stepCountIs(10)],
});

const result = await agent.stream({ messages });
```

#### 3. Add Tool Approval

```typescript
// Wrap sensitive tools with approval
const navigateWithApproval = createToolWithApproval({
  description: 'Navigate to URL',
  parameters: z.object({ url: z.string() }),
  execute: async ({ url }) => executeNavigation(url),
  approval: {
    dynamic: createNavigationApprovalPolicy({ /* ... */ }),
  },
});
```

#### 4. Add Evaluation Step

```typescript
// After streaming step
const evaluation = await evaluationStep({
  model,
  executionResult: streaming,
  originalQuery,
  plan,
  evaluationCriteria: { /* ... */ },
});

if (evaluation.shouldRetry) {
  // Implement retry logic
}
```

## Examples

See `/examples/ai-sdk-6-patterns.ts` for comprehensive usage examples.

## References

- [AI SDK 6 Beta Documentation](https://v6.ai-sdk.dev/docs/announcing-ai-sdk-6-beta)
- [Building Agents Guide](https://v6.ai-sdk.dev/docs/agents/building-agents)
- [Workflow Patterns](https://v6.ai-sdk.dev/docs/agents/workflows)
- [Loop Control](https://v6.ai-sdk.dev/docs/agents/loop-control)
- [Structured Data Generation](https://v6.ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Stream Protocol](https://v6.ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
