# AI SDK 6 Reference - Key Snippets and Patterns

## Installation (Beta)
```bash
npm install ai@beta @ai-sdk/openai@beta @ai-sdk/react@beta
```

## Core Functions Overview

AI SDK Core provides standardized functions for integrating LLMs:

- **`generateText`**: Generates text and tool calls for non-interactive use cases
- **`streamText`**: Streams text and tool calls for interactive applications
- **`generateObject`**: Generates typed, structured objects matching Zod schemas
- **`streamObject`**: Streams structured objects with partial updates

## Agent Abstraction (AI SDK 6)

### ToolLoopAgent (Default Implementation)
```typescript
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import { weatherTool } from '@/tool/weather';

export const weatherAgent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  instructions: 'You are a helpful weather assistant.',
  tools: {
    weather: weatherTool,
  },
});

// Use the agent
const result = await weatherAgent.generate({
  prompt: 'What is the weather in San Francisco?',
});
```

### Tool Definition with Zod Schema
```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const weatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    const weather = await fetchWeather(city);
    return weather;
  },
});
```

### Tool with Approval (Human-in-the-Loop)
```typescript
export const paymentTool = tool({
  description: 'Process a payment',
  inputSchema: z.object({
    amount: z.number(),
    recipient: z.string(),
  }),
  needsApproval: async ({ amount }) => amount > 1000, // Dynamic approval
  execute: async ({ amount, recipient }) => {
    return await processPayment(amount, recipient);
  },
});
```

### Dynamic Tools (Runtime Schema Discovery)
```typescript
import { dynamicTool } from 'ai';

const customTool = dynamicTool({
  description: 'Execute custom function',
  inputSchema: z.object({}), // Can be empty for dynamic schemas
  execute: async (input) => {
    // input is 'unknown' - validate at runtime
    const { action, params } = input as any;
    return executeDynamicAction(action, params);
  },
});

// Type-safe usage with dynamic flag
const result = await generateText({
  model: openai('gpt-4o'),
  tools: { custom: customTool },
  prompt: 'Execute action X',
});

for (const toolCall of result.toolCalls) {
  if (toolCall.dynamic) {
    // Handle dynamic tool call
    console.log('Dynamic tool:', toolCall.toolName, toolCall.input);
  } else {
    // Handle static tool call with full type safety
    switch (toolCall.toolName) {
      case 'weather':
        console.log(toolCall.input.location); // Typed
        break;
    }
  }
}
```

### Preliminary Tool Results (Streaming)
```typescript
export const analysisTool = tool({
  description: 'Analyze data with progress updates',
  inputSchema: z.object({ data: z.string() }),
  execute: async function* ({ data }) {
    yield { status: 'loading', progress: 0 };

    await performStep1(data);
    yield { status: 'processing', progress: 33 };

    const result1 = await performStep2(data);
    yield { status: 'processing', progress: 66 };

    const final = await performStep3(result1);
    yield { status: 'complete', progress: 100, result: final };
  },
});
```

## Enhanced Text Generation Features

### Reasoning Access
```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Solve this math problem step by step.',
});

// Access the model's reasoning process
console.log(result.reasoning); // Full reasoning content
console.log(result.reasoningText); // Reasoning as plain text
```

### Sources Support (Perplexity, Google)
```typescript
const result = await generateText({
  model: google('gemini-2.5-flash'),
  tools: { google_search: google.tools.googleSearch({}) },
  prompt: 'What are the latest AI developments?',
});

// Access grounding sources
for (const source of result.sources) {
  if (source.sourceType === 'url') {
    console.log('Source:', source.title, source.url);
  }
}
```

### Stream Transformations
```typescript
import { smoothStream } from 'ai';

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Write a long story.',
  experimental_transform: smoothStream(), // Smooth text streaming
});
```

### Custom Transformations
```typescript
const upperCaseTransform = () => (options) => ({
  transform(chunk, controller) {
    if (chunk.type === 'text') {
      controller.enqueue({
        ...chunk,
        text: chunk.text.toUpperCase()
      });
    } else {
      controller.enqueue(chunk);
    }
  }
});

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Hello world',
  experimental_transform: upperCaseTransform(),
});
```

## Streaming with Tools

### streamText with Multi-Step Tool Calling
```typescript
import { streamText } from 'ai';

const { textStream, toolCalls, toolResults } = await streamText({
  model: openai('gpt-4o'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    weather: weatherTool,
  },
  stopWhen: stepCountIs(5), // Stop after max 5 steps
});

// Stream the text
for await (const textPart of textStream) {
  console.log(textPart);
}

// Handle tool calls and results
for await (const toolCall of toolCalls) {
  console.log('Tool called:', toolCall);
}

for await (const toolResult of toolResults) {
  console.log('Tool result:', toolResult);
}
```

### generateText with Multi-Step Tool Calling
```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    weather: weatherTool,
  },
  stopWhen: stepCountIs(5), // Stop after max 5 steps
});

console.log(result.text);
console.log(result.toolCalls);
console.log(result.toolResults);
```

## Structured Output with Output Object

### Output.text() - Plain Text Generation
```typescript
const { output } = await generateText({
  model: openai('gpt-4o'),
  output: Output.text(),
  prompt: 'Tell me a joke.',
});
// output is a string
```

### Output.object() - Structured Objects
```typescript
const { output } = await generateText({
  model: openai('gpt-4o'),
  output: Output.object({
    schema: z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    }),
  }),
  prompt: 'Generate a user profile.',
});
// output is a typed object
```

### Output.array() - Arrays of Objects
```typescript
const { output } = await generateText({
  model: openai('gpt-4o'),
  output: Output.array({
    element: z.object({
      name: z.string(),
      role: z.string(),
    }),
  }),
  prompt: 'Generate 3 team member profiles.',
});
// output.elements is an array of objects
```

### Output.choice() - Enum Selection
```typescript
const { output } = await generateText({
  model: openai('gpt-4o'),
  output: Output.choice({
    options: ['beginner', 'intermediate', 'advanced'],
  }),
  prompt: 'What skill level is appropriate for this tutorial?',
});
// output is one of: 'beginner', 'intermediate', 'advanced'
```

### Output.json() - Flexible JSON
```typescript
const { output } = await generateText({
  model: openai('gpt-4o'),
  output: Output.json(),
  prompt: 'Create a configuration object.',
});
// output is any valid JSON structure
```

### Streaming Structured Output
```typescript
const { partialOutputStream } = await streamText({
  model: openai('gpt-4o'),
  output: Output.object({
    schema: z.object({
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()),
    }),
  }),
  prompt: 'Write a blog post.',
});

for await (const partial of partialOutputStream) {
  console.log('Partial:', partial);
  // { title: "My Blog Post" }
  // { title: "My Blog Post", content: "This is..." }
  // { title: "My Blog Post", content: "This is the full content", tags: ["tech", "ai"] }
}
```

## Legacy Structured Output (generateObject/streamObject)

### Agent with Structured Output
```typescript
import { ToolLoopAgent, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools: {
    weather: weatherTool,
  },
  output: Output.object({
    schema: z.object({
      summary: z.string(),
      temperature: z.number(),
      recommendation: z.string(),
    }),
  }),
});

const { output } = await agent.generate({
  prompt: 'What is the weather in San Francisco and what should I wear?',
});
// output contains structured data alongside tool results
```

### Streaming Structured Output
```typescript
const { partialOutputStream } = await agent.stream({
  prompt: 'Generate a person profile.',
});

for await (const partial of partialOutputStream) {
  console.log(partial);
  // { name: "John" }
  // { name: "John", age: 30 }
  // { name: "John", age: 30, occupation: "Engineer" }
}
```

## Loop Control

### Stop Conditions
```typescript
import { stepCountIs, hasToolCall, textMatches } from 'ai';

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools: { weather: weatherTool },
  stopWhen: [
    stepCountIs(10), // Maximum 10 steps
    hasToolCall('weather'), // Stop after weather tool call
    textMatches(/ANSWER:/), // Stop when answer found
  ],
});
```

### Advanced Stop Conditions
```typescript
// Custom stop condition
const hasFinalAnswer: StopCondition = ({ steps }) => {
  return steps.some(step =>
    step.text?.includes('FINAL ANSWER') ||
    step.toolResults?.some(result => result.result.confidence > 0.95)
  );
};

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools: { search: searchTool },
  stopWhen: hasFinalAnswer,
});
```

### Custom Stop Condition
```typescript
const hasAnswer: StopCondition<typeof tools> = ({ steps }) => {
  return steps.some(step => step.text?.includes('ANSWER:')) ?? false;
};

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools,
  stopWhen: hasAnswer,
});
```

### Prepare Step (Dynamic Configuration)
```typescript
const agent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'), // Default model
  tools: { /* tools */ },
  prepareStep: async ({ stepNumber, messages }) => {
    // Use stronger model for complex reasoning after initial steps
    if (stepNumber > 2 && messages.length > 10) {
      return {
        model: openai('gpt-4o'),
      };
    }
    return {};
  },
});
```

## UI Integration

### React Chat with Agent
```typescript
import { useChat } from '@ai-sdk/react';
import { InferAgentUIMessage } from 'ai';

type WeatherAgentUIMessage = InferAgentUIMessage<typeof weatherAgent>;

const { messages, sendMessage } = useChat<WeatherAgentUIMessage>();
```

### Server-side API Route
```typescript
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: weatherAgent,
    messages,
  });
}
```

## Tool Approval UI

### Client-side Approval Handling
```typescript
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

const { messages, addToolApprovalResponse } = useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
```

### Approval UI Component
```typescript
export function WeatherToolView({ invocation, addToolApprovalResponse }) {
  if (invocation.state === 'approval-requested') {
    return (
      <div>
        <p>Can I retrieve the weather for {invocation.input.city}?</p>
        <button
          onClick={() =>
            addToolApprovalResponse({
              id: invocation.approval.id,
              approved: true,
            })
          }
        >
          Approve
        </button>
        <button
          onClick={() =>
            addToolApprovalResponse({
              id: invocation.approval.id,
              approved: false,
            })
          }
        >
          Deny
        </button>
      </div>
    );
  }

  if (invocation.state === 'output-available') {
    return (
      <div>
        Weather: {invocation.output.weather}
        Temperature: {invocation.output.temperature}°F
      </div>
    );
  }
  // Handle other states...
}
```

## Tool Execution Options

### Context Passing
```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: {
    apiTool: tool({
      description: 'Call external API',
      inputSchema: z.object({ endpoint: z.string() }),
      execute: async (input, { experimental_context: context }) => {
        const typedContext = context as { apiKey: string; userId: string };
        return callAPI(input.endpoint, typedContext.apiKey);
      },
    }),
  },
  experimental_context: { apiKey: 'secret', userId: '123' },
  prompt: 'Call the user API',
});
```

### Abort Signals
```typescript
const controller = new AbortController();

const result = await generateText({
  model: openai('gpt-4o'),
  abortSignal: controller.signal,
  tools: {
    slowTool: tool({
      description: 'Slow operation',
      inputSchema: z.object({}),
      execute: async (input, { abortSignal }) => {
        return fetch('https://slow-api.com', { signal: abortSignal });
      },
    }),
  },
  prompt: 'Run slow operation',
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);
```

### Message History Access
```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: {
    reasoningTool: tool({
      description: 'Advanced reasoning',
      inputSchema: z.object({ query: z.string() }),
      execute: async (input, { messages }) => {
        // Access full conversation history
        const recentMessages = messages.slice(-5);
        return performReasoning(input.query, recentMessages);
      },
    }),
  },
  prompt: 'Analyze this complex problem',
});
```

### Tool Call IDs for Streaming
```typescript
const result = streamText({
  model: openai('gpt-4o'),
  tools: {
    searchTool: tool({
      description: 'Search database',
      inputSchema: z.object({ query: z.string() }),
      execute: async (input, { toolCallId }) => {
        // Use toolCallId for status tracking
        emitStatus(toolCallId, 'searching');
        const results = await searchDatabase(input.query);
        emitStatus(toolCallId, 'complete');
        return results;
      },
    }),
  },
  prompt: 'Search for recent articles',
});
```

## Model Context Protocol (MCP) Tools

### Overview
MCP (Model Context Protocol) enables LLMs to interact with external systems through standardized tools, resources, and prompts.

### HTTP Transport (Production)
```typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';

const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://your-server.com/mcp',
    headers: { Authorization: 'Bearer token' },
  },
});

// Convert MCP tools to AI SDK tools
const tools = await mcpClient.tools();
```

### Stdio Transport (Local Development)
```typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const mcpClient = await createMCPClient({
  transport: new StdioClientTransport({
    command: 'node',
    args: ['path/to/mcp-server.js'],
  }),
});

const tools = await mcpClient.tools();
```

### SSE Transport (Real-time)
```typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const mcpClient = await createMCPClient({
  transport: new SSEClientTransport({
    url: 'https://your-server.com/mcp/sse',
  }),
});
```

### Schema-Defined MCP Tools
```typescript
const tools = await mcpClient.tools({
  schemas: {
    'get-weather': {
      inputSchema: z.object({
        location: z.string(),
        units: z.enum(['celsius', 'fahrenheit']).optional(),
      }),
    },
    'search-files': {
      inputSchema: z.object({
        query: z.string(),
        type: z.enum(['file', 'directory']).optional(),
      }),
    },
  },
});
```

### MCP Resources
```typescript
// List available resources
const resources = await mcpClient.listResources();
console.log('Available resources:', resources);

// Read specific resource
const data = await mcpClient.readResource({
  uri: 'file:///data/config.json',
});

// Subscribe to resource changes
mcpClient.subscribeResource('file:///data/config.json', (data) => {
  console.log('Resource updated:', data);
});
```

### MCP Prompts
```typescript
// List available prompts
const prompts = await mcpClient.listPrompts();
console.log('Available prompts:', prompts);

// Get prompt with arguments
const prompt = await mcpClient.getPrompt({
  name: 'code-review',
  arguments: { code: 'function add(a,b){return a+b;}' },
});

// Use prompt with agent
const result = await weatherAgent.generate({
  prompt: prompt.messages[0].content.text,
});
```

### Complete MCP Example
```typescript
const mcpClient = await createMCPClient({
  transport: {
    type: 'http',
    url: 'https://mcp-server.example.com',
  },
});

// Create agent with MCP tools
const mcpAgent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools: await mcpClient.tools(),
  instructions: 'You can use filesystem and database tools via MCP.',
});

// Use the agent
const result = await mcpAgent.generate({
  prompt: 'Read the config file and search for similar patterns in the codebase.',
});
```

## Enhanced Error Handling

### Tool Call Repair
```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: { weather: weatherTool },
  prompt: 'What is the weather?',
  experimental_repairToolCall: async ({ toolCall, error }) => {
    if (NoSuchToolError.isInstance(error)) {
      return null; // Skip invalid tool names
    }

    // Use structured output to repair invalid inputs
    const { object: repairedArgs } = await generateObject({
      model: openai('gpt-4o'),
      schema: weatherTool.inputSchema,
      prompt: `Fix these tool inputs: ${JSON.stringify(toolCall.input)}`,
    });

    return { ...toolCall, input: JSON.stringify(repairedArgs) };
  },
});
```

### Tool Execution Errors
```typescript
const { steps } = await generateText({
  model: openai('gpt-4o'),
  tools: { weather: weatherTool },
  prompt: 'Get weather data',
});

// Check for tool execution errors
const toolErrors = steps.flatMap(step =>
  step.content.filter(part => part.type === 'tool-error')
);

toolErrors.forEach(error => {
  console.log('Tool failed:', error.toolName, error.error);
});
```

## Key Concepts

### Agent Interface
- `Agent` is an interface, not a concrete class
- `ToolLoopAgent` provides default implementation
- Custom agents can implement the `Agent` interface

### Tool Calling Flow
1. LLM receives prompt + available tools
2. LLM decides to call tool(s) based on description and schema
3. Tools execute automatically (unless `needsApproval`)
4. Results added back to conversation
5. Loop continues until stop condition met

### Multi-Step Execution
- `maxSteps` controls how many tool call iterations
- Default is 1 step (no tool loop)
- `stopWhen` provides fine-grained control

### Message Flow
- User messages trigger agent execution
- Tool calls generate tool results
- Results become assistant messages
- Loop continues with updated context

### State Management
- Agents maintain conversation history automatically
- `prepareStep` allows context management
- Messages can be filtered/modified between steps

## Migration Notes

### From AI SDK 5 to 6
- `ToolLoopAgent` replaces experimental `Agent`
- Tools use `tool()` with `inputSchema` (Zod validation)
- `stopWhen` replaces `maxSteps` for multi-step control
- New `Output` object for structured generation in `generateText`/`streamText`
- Approval workflows for human-in-the-loop
- MCP (Model Context Protocol) tools support
- Enhanced error handling and tool call repair
- Reasoning and sources access in results
- Stream transformations for custom processing

### Key Changes
- `maxSteps` → `stopWhen: stepCountIs(n)`
- `generateObject`/`streamObject` still available but `Output` preferred
- New `experimental_` prefixes for advanced features
- Improved TypeScript types throughout
- Better streaming support with `fullStream` and transformations