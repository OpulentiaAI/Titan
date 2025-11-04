/**
 * Verifiers Integration Type Definitions
 * Comprehensive TypeScript types for PrimeIntellect Verifiers framework
 *
 * Based on:
 * - Verifiers documentation: https://github.com/PrimeIntellect-ai/verifiers
 * - ToolEnv, StatefulToolEnv, and Rubric patterns
 * - Environment composition and evaluation strategies
 */

/**
 * Chat Message Format
 * Compatible with OpenAI/Anthropic message formats
 */
export interface ChatMessage {
  /** Message role */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Message content */
  content: string | ContentPart[];
  /** Tool calls (for assistant messages) */
  toolCalls?: ToolCall[];
  /** Tool call ID (for tool messages) */
  toolCallId?: string;
  /** Message name (optional) */
  name?: string;
}

/**
 * Content Part for Multimodal Messages
 */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: { url: string } };

/**
 * Tool Call Representation
 */
export interface ToolCall {
  /** Tool call ID */
  id: string;
  /** Tool function name */
  function: {
    name: string;
    arguments: string; // JSON string
  };
  /** Tool type (typically 'function') */
  type: 'function';
}

/**
 * Tool Definition
 */
export interface ToolDefinition {
  /** Tool function name */
  name: string;
  /** Tool description */
  description: string;
  /** Parameter schema (JSON Schema) */
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  /** Actual function implementation */
  function: (...args: any[]) => any | Promise<any>;
}

/**
 * Dataset Entry Format
 * For Hugging Face Datasets integration
 */
export interface DatasetEntry {
  /** Prompt column: List of chat messages */
  prompt?: ChatMessage[];
  /** Question column (alternative to prompt) */
  question?: string;
  /** Expected answer (optional) */
  answer?: string;
  /** Additional information for evaluation */
  info?: Record<string, any>;
  /** Task type tag for composition */
  task?: string;
}

/**
 * Rubric Function Signature
 * Evaluates assistant responses and returns a reward
 */
export type RubricFunction = (
  prompt: ChatMessage[],
  completion: ChatMessage[],
  answer?: string,
  info?: Record<string, any>,
  state?: Record<string, any>
) => number | Promise<number>;

/**
 * Rubric Configuration
 */
export interface RubricConfig {
  /** List of reward functions */
  funcs: RubricFunction[];
  /** Weights for each function (must sum to ≤ 1.0) */
  weights: number[];
  /** Rubric name/identifier */
  name?: string;
}

/**
 * Parser Interface
 * Extracts structured content from model outputs
 */
export interface Parser {
  /** Parser name */
  name: string;
  /** Parse function */
  parse: (completion: ChatMessage[]) => any;
  /** Format reward function (validates format) */
  getFormatRewardFunc?: () => RubricFunction;
}

/**
 * Environment Base Configuration
 */
export interface EnvironmentConfig {
  /** Hugging Face dataset */
  dataset: DatasetEntry[];
  /** Rubric for evaluation */
  rubric: RubricConfig;
  /** Optional parser for structured outputs */
  parser?: Parser;
  /** Maximum concurrent rollouts */
  maxConcurrent?: number;
}

/**
 * Single Turn Environment Configuration
 */
export interface SingleTurnEnvConfig extends EnvironmentConfig {
  /** Environment type identifier */
  type: 'single-turn';
}

/**
 * Tool Environment Configuration
 */
export interface ToolEnvConfig extends EnvironmentConfig {
  /** Environment type identifier */
  type: 'tool';
  /** Tool definitions */
  tools: ToolDefinition[];
  /** Maximum conversation turns */
  maxTurns: number;
  /** Allow parallel tool calls */
  parallelToolCalls?: boolean;
}

/**
 * Stateful Tool Environment Configuration
 */
export interface StatefulToolEnvConfig extends ToolEnvConfig {
  /** Environment type identifier */
  type: 'stateful-tool';
  /** Arguments to skip/hide from LLM */
  argsToSkip?: string[];
  /** Setup state function */
  setupState?: () => Promise<Record<string, any>>;
  /** Update tool arguments with state */
  updateToolArgs?: (
    state: Record<string, any>,
    toolArgs: any
  ) => Promise<void>;
}

/**
 * Multi-Turn Environment Configuration
 */
export interface MultiTurnEnvConfig extends EnvironmentConfig {
  /** Environment type identifier */
  type: 'multi-turn';
  /** Maximum conversation turns */
  maxTurns: number;
  /** Check if conversation is completed */
  isCompleted?: (
    messages: ChatMessage[],
    state: Record<string, any>
  ) => Promise<boolean>;
  /** Generate environment response */
  envResponse?: (
    messages: ChatMessage[],
    state: Record<string, any>
  ) => Promise<{ messages: ChatMessage[]; state: Record<string, any> }>;
}

/**
 * Tool Rubric for Counting Tool Invocations
 */
export interface ToolRubricConfig {
  /** Tool names to track */
  toolNames?: string[];
  /** Require exact tool usage (fail if wrong tools used) */
  exactMatch?: boolean;
  /** Expected tool call count (optional) */
  expectedCalls?: number;
  /** Penalty for incorrect tool usage */
  incorrectPenalty?: number;
}

/**
 * Judge Rubric Configuration
 * Uses auxiliary LLM to evaluate responses
 */
export interface JudgeRubricConfig {
  /** Judge prompt template */
  judgePrompt: string;
  /** Judge model identifier */
  judgeModel: string;
  /** Parse judge response to score */
  parseJudgeResponse: (response: string) => number;
  /** Weight for this judge */
  weight?: number;
}

/**
 * Environment Group Configuration
 * Combines multiple environments
 */
export interface EnvGroupConfig {
  /** List of environments */
  environments: EnvironmentConfig[];
  /** Sampling strategy: 'uniform' | 'weighted' */
  samplingStrategy?: 'uniform' | 'weighted';
  /** Weights for weighted sampling */
  weights?: number[];
}

/**
 * Evaluation Result
 */
export interface EvaluationResult {
  /** Unique rollout ID */
  id: string;
  /** Input prompt */
  prompt: ChatMessage[];
  /** Model completion */
  completion: ChatMessage[];
  /** Reward scores */
  rewards: Record<string, number>;
  /** Total weighted reward */
  totalReward: number;
  /** Execution state */
  state?: Record<string, any>;
  /** Additional metrics */
  metrics?: Record<string, any>;
  /** Error (if any) */
  error?: string;
}

/**
 * Batch Evaluation Results
 */
export interface BatchEvaluationResults {
  /** All evaluation results */
  results: EvaluationResult[];
  /** Aggregate statistics */
  stats: {
    meanReward: number;
    medianReward: number;
    minReward: number;
    maxReward: number;
    stdReward: number;
    successRate: number;
  };
  /** Evaluation metadata */
  metadata: {
    model: string;
    timestamp: string;
    duration: number;
    totalExamples: number;
  };
}

/**
 * Tool Execution Trace
 */
export interface ToolExecutionTrace {
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  arguments: Record<string, any>;
  /** Tool result */
  result: any;
  /** Execution time (ms) */
  executionTime: number;
  /** Success status */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Rollout Trace
 * Complete execution trace for debugging
 */
export interface RolloutTrace {
  /** Rollout ID */
  id: string;
  /** All messages in conversation */
  messages: ChatMessage[];
  /** Tool executions */
  toolExecutions: ToolExecutionTrace[];
  /** State snapshots at each turn */
  stateSnapshots: Record<string, any>[];
  /** Timestamps */
  timestamps: number[];
  /** Final reward */
  reward: number;
}

/**
 * Sample Generation Configuration
 */
export interface SampleGenerationConfig {
  /** Number of samples to generate */
  count: number;
  /** Generation strategy */
  strategy: 'combinatorial' | 'synthetic' | 'mutation' | 'edge-cases';
  /** Source tools (for combinatorial) */
  tools?: ToolDefinition[];
  /** Source samples (for mutation) */
  sourceSamples?: DatasetEntry[];
  /** LLM for synthetic generation */
  generationModel?: string;
  /** Diversity parameter (0-1) */
  diversity?: number;
}

/**
 * Tool Validation Result
 */
export interface ToolValidationResult {
  /** Validation success */
  valid: boolean;
  /** Tool calls made */
  toolCalls: ToolCall[];
  /** Expected tool calls */
  expectedToolCalls?: ToolCall[];
  /** Validation errors */
  errors: string[];
  /** Warnings */
  warnings: string[];
  /** Correctness score (0-1) */
  score: number;
}

/**
 * Environment Loading Function
 * Standard pattern for loading environments
 */
export type LoadEnvironmentFunction = (
  config?: any
) => Promise<EnvironmentConfig>;

/**
 * Verifiers CLI Configuration
 */
export interface VerifiersCLIConfig {
  /** Environment name to evaluate */
  environment: string;
  /** Model to evaluate */
  model: string;
  /** Save results locally */
  saveResults?: boolean;
  /** Maximum concurrent requests */
  maxConcurrentRequests?: number;
  /** Save checkpoints every N examples */
  saveEvery?: number;
  /** Additional sampling arguments */
  samplingArgs?: Record<string, any>;
}

/**
 * Training Configuration for RL
 */
export interface VerifiersTrainConfig {
  /** Model identifier */
  model: string;
  /** Environment configuration */
  env: {
    id: string;
    config?: any;
  };
  /** Inference GPU count */
  inference?: {
    gpus: number;
  };
  /** Trainer configuration */
  trainer: {
    gpus: number;
    runName: string;
    useLora?: boolean;
    learningRate?: number;
    batchSize?: number;
    gradientAccumulationSteps?: number;
    maxSteps?: number;
  };
}

/**
 * Export all types
 */
export type {
  ChatMessage,
  ContentPart,
  ToolCall,
  ToolDefinition,
  DatasetEntry,
  RubricFunction,
  RubricConfig,
  Parser,
  EnvironmentConfig,
  SingleTurnEnvConfig,
  ToolEnvConfig,
  StatefulToolEnvConfig,
  MultiTurnEnvConfig,
  ToolRubricConfig,
  JudgeRubricConfig,
  EnvGroupConfig,
  EvaluationResult,
  BatchEvaluationResults,
  ToolExecutionTrace,
  RolloutTrace,
  SampleGenerationConfig,
  ToolValidationResult,
  LoadEnvironmentFunction,
  VerifiersCLIConfig,
  VerifiersTrainConfig
};
