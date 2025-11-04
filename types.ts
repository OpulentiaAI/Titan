// Shared types for the extension
import { z } from 'zod';

export type ToolMode = 'tool-router';

export type ComputerUseEngine = 'google' | 'gateway-flash-lite';

export interface Settings {
  provider: 'google' | 'gateway' | 'nim' | 'openrouter';
  apiKey: string;
  model: string;
  toolMode?: ToolMode;
  composioApiKey?: string;
  // Web search API key (optional)
  youApiKey?: string;
  youBaseUrl?: string; // defaults to https://api.ydc-index.io
  // Observability (optional)
  braintrustApiKey?: string;
  braintrustProjectName?: string; // defaults to "atlas-extension"
  // Computer Use engine selection (optional; defaults by provider)
  computerUseEngine?: ComputerUseEngine;
  // Devtools
  devtoolsEnabled?: boolean;
}

export interface ComposioSession {
  sessionId: string;
  chatSessionMcpUrl: string;
  toolRouterMcpUrl: string;
  expiresAt: number;
  createdAt: number;
}

export interface ChatState {
  phase: 'loading' | 'ready' | 'streaming' | 'error';
  settings: Settings | null;
  messages: Message[];
  error: string | null;
  isLoading: boolean;
  browserToolsEnabled: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: GeminiFunctionCall[];
  toolExecutions?: Array<{
    toolCallId: string;
    toolName: string;
    state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorText?: string;
    timestamp?: number;
  }>;
  // Message parts pattern (Sparka-style) for better composition
  parts?: Array<{
    type: 'text' | 'reasoning' | 'tool';
    content?: string;
    toolCallId?: string;
    toolName?: string;
    state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorText?: string;
    timestamp?: number;
  }>;
  // Artifact views for orchestration outputs
  planning?: import('./schemas/workflow-schemas').PlanningStepOutput;
  pageContext?: import('./schemas/workflow-schemas').PageContextStepOutput;
  summarization?: import('./schemas/workflow-schemas').SummarizationStepOutput;
  errorAnalysis?: {
    recap: string;
    blame: string;
    improvement: string;
  };
  executionTrajectory?: Array<{
    step: number;
    action: string;
    url?: string;
    success: boolean;
    timestamp: number;
  }>;
  workflowMetadata?: {
    workflowId?: string;
    conversationId?: string;
    braintrustRunId?: string;
    totalDuration?: number;
    finalUrl?: string;
  };
  // Workflow task queue for real-time progress tracking
  workflowTasks?: Array<{
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
  }>;
  // Reasoning tokens (transparent pattern) - chain of thought transparency
  reasoning?: string[];
  reasoningDetails?: Array<{
    type: 'reasoning.summary' | 'reasoning.encrypted' | 'reasoning.text';
    summary?: string;
    data?: string;
    text?: string;
    signature?: string | null;
    id?: string | null;
    format?: string;
    index?: number;
  }>;
}

export interface PageContext {
  url: string;
  title: string;
  textContent: string;
  links: Array<{ text: string; href: string }>;
  images: Array<{ alt: string; src: string }>;
  forms: Array<{
    id: string;
    action: string;
    inputs: Array<{ name: string; type: string }>
  }>;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
  };
  viewport?: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
  };
}

export interface BrowserMemory {
  recentPages: Array<{
    url: string;
    title: string;
    timestamp: number;
    context?: any
  }>;
  userPreferences: Record<string, any>;
  sessionData: Record<string, any>;
}

export interface MessageRequest {
  type: string;
  [key: string]: any;
}

export interface MessageResponse {
  success?: boolean;
  error?: string;
  [key: string]: any;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

/**
 * MCP Client type for managing Model Context Protocol connections
 * Matches the AI SDK experimental_createMCPClient return type
 */
export interface MCPClient {
  tools(): Promise<Record<string, any>>;
  close(): Promise<void>;
}

/**
 * Browser action function parameters
 */
export interface BrowserActionParams {
  x?: number;
  y?: number;
  text?: string;
  selector?: string;
  target?: string;
  value?: string;
  direction?: string;
  amount?: number;
  key?: string;
  keys?: string[];
  destination_x?: number;
  destination_y?: number;
  coordinate?: { x: number; y: number };
  address?: string;
  uri?: string;
  content?: string;
  seconds?: number;
  milliseconds?: number;
  press_enter?: boolean;
  clear_before_typing?: boolean;
  magnitude?: number;
}

/**
 * Provider API function call
 */
export interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

/**
 * Extended viewport info
 */
export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
}

// ============================================
// Zod Validation Schemas (for runtime validation)
// ============================================

/**
 * Validates provider API response structure
 * Ensures response has expected format before processing
 */
export const GeminiPartSchema = z.union([
  z.object({
    text: z.string(),
  }),
  z.object({
    functionCall: z.object({
      name: z.string(),
      args: z.record(z.any()).optional(),
    }),
  }),
  z.object({
    function_response: z.any(),
  }),
  z.object({
    inline_data: z.object({
      mime_type: z.string(),
      data: z.string(),
    }),
  }),
]);

export const GeminiCandidateSchema = z.object({
  content: z.object({
    parts: z.array(GeminiPartSchema),
  }).optional(),
  finishReason: z.string().optional(),
  safetyResponse: z.object({
    requireConfirmation: z.boolean(),
    message: z.string().optional(),
  }).optional(),
});

export const GeminiResponseSchema = z.object({
  candidates: z.array(GeminiCandidateSchema).optional(),
  promptFeedback: z.object({
    blockReason: z.string().optional(),
  }).optional(),
});

/**
 * Validates tool router session response
 */
export const ComposioSessionSchema = z.object({
  session_id: z.string().min(1),
  chat_session_mcp_url: z.string().url(),
  tool_router_instance_mcp_url: z.string().url(),
});

/**
 * Validates page context from content script
 */
export const PageContextSchema = z.object({
  url: z.string().url().or(z.string().startsWith('data:')),
  title: z.string(),
  textContent: z.string(),
  links: z.array(z.object({
    text: z.string(),
    href: z.string(),
  })).default([]),
  images: z.array(z.object({
    alt: z.string(),
    src: z.string(),
  })).default([]),
  forms: z.array(z.object({
    id: z.string(),
    action: z.string(),
    inputs: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
  })).default([]),
  metadata: z.object({
    description: z.string().optional(),
    keywords: z.string().optional(),
    author: z.string().optional(),
  }).optional(),
  viewport: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    scrollX: z.number(),
    scrollY: z.number(),
    devicePixelRatio: z.number().positive(),
  }).optional(),
});

/**
 * Validates action response from content script
 */
export const ActionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  data: z.any().optional(),
  element: z.string().optional(),
  elementBounds: z.object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  text: z.string().optional(),
  screenshot: z.string().optional(),
});

/**
 * Validates screenshot response
 */
export const ScreenshotResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  screenshot: z.string().optional(), // data URL
});

/**
 * Planning types (exported from planner.ts for workflow use)
 */
export interface PlanningInstruction {
  step: number;
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'getPageContext';
  target: string;
  reasoning: string;
  expectedOutcome: string;
  validationCriteria?: string;
  fallbackAction?: PlanningInstruction;
}

export interface ExecutionPlan {
  objective: string;
  approach: string;
  steps: PlanningInstruction[];
  criticalPaths: number[];
  estimatedSteps: number;
  complexityScore: number;
  potentialIssues: string[];
  optimizations: string[];
}

export interface PlanningResult {
  plan: ExecutionPlan;
  optimizedQuery?: string;
  gaps?: string[];
  confidence: number;
}
