/**
 * Arbor Integration Type Definitions
 * Comprehensive TypeScript types for Arbor GRPO optimization framework
 *
 * Based on:
 * - Arbor documentation: https://github.com/OpulentiaAI/arbor
 * - GRPO paper: Group Relative Policy Optimization
 * - DSPy integration patterns
 */

/**
 * Arbor Server Configuration
 */
export interface ArborServerConfig {
  /** Port for Arbor server */
  port?: number;
  /** Number of GPUs for training */
  numTrainingGpus?: number;
  /** Number of GPUs for inference */
  numInferenceGpus?: number;
  /** Custom accelerate configuration path */
  accelerateConfig?: string;
  /** Enable flash attention for faster inference */
  flashAttention?: boolean;
}

/**
 * Arbor Server Information
 * Returned after initializing Arbor server
 */
export interface ArborServerInfo {
  /** Base URL for API requests */
  baseUrl: string;
  /** Server status */
  status: 'running' | 'starting' | 'stopped' | 'error' | 'unhealthy';
  /** Server process ID */
  pid?: number;
  /** Configuration used */
  config: ArborServerConfig;
  /** Server start time */
  startTime?: number;
}

/**
 * GEPA Candidate
 * Represents a candidate solution in the Grounded Evolution with Pareto Allocation optimization
 */
export interface GEPACandidate {
  /** Unique identifier for the candidate */
  id: string;
  /** The DSPy program configuration */
  program: any;
  /** Performance metrics */
  metrics: Record<string, number>;
  /** Optimization score (0-1, higher is better) */
  score: number;
  /** Dominance rank in Pareto frontier */
  rank: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * LoRA Configuration for Parameter-Efficient Fine-Tuning
 */
export interface LoRAConfig {
  /** LoRA rank (typical: 8-64) */
  rank: number;
  /** LoRA alpha parameter (typical: 16-128) */
  alpha: number;
  /** Dropout rate for LoRA layers */
  dropout: number;
  /** Target modules to apply LoRA (e.g., ['q_proj', 'v_proj']) */
  targetModules: string[];
  /** Bias handling: 'none' | 'all' | 'lora_only' */
  bias?: 'none' | 'all' | 'lora_only';
}

/**
 * GRPO Training Configuration
 */
export interface GRPOTrainConfig {
  // Batch Configuration
  /** Batch size per device during training */
  perDeviceTrainBatchSize: number;
  /** Number of gradient accumulation steps */
  gradientAccumulationSteps: number;

  // Sampling Parameters
  /** Sampling temperature (0.0-2.0) */
  temperature: number;
  /** Top-k sampling */
  topK: number;
  /** Top-p (nucleus) sampling */
  topP: number;
  /** Repetition penalty */
  repetitionPenalty: number;
  /** Maximum tokens to generate */
  maxTokens: number;

  // Optimization
  /** Learning rate */
  learningRate: number;
  /** Beta parameter for GRPO */
  beta: number;
  /** Loss type: 'grpo' | 'dapo' */
  lossType: 'grpo' | 'dapo';
  /** Maximum training steps */
  maxSteps: number;
  /** Warmup steps */
  warmupSteps?: number;

  // Hardware & Performance
  /** Number of GPUs for training */
  numTrainingGpus: number;
  /** Number of GPUs for inference */
  numInferenceGpus: number;
  /** Enable gradient checkpointing */
  gradientCheckpointing: boolean;
  /** Use FP16 precision */
  fp16: boolean;

  // LoRA Configuration
  /** LoRA configuration (optional) */
  loraConfig?: LoRAConfig;

  // Monitoring
  /** Report to: 'wandb' | 'tensorboard' | 'none' */
  reportTo?: 'wandb' | 'tensorboard' | 'none';
  /** Log completions for debugging */
  logCompletions?: boolean;
  /** Logging frequency (steps) */
  loggingSteps?: number;
  /** Evaluation frequency (steps) */
  evalSteps?: number;
  /** Save checkpoint frequency (steps) */
  saveSteps?: number;
}

/**
 * GRPO Compiler Configuration
 */
export interface GRPOCompilerConfig {
  /** Number of DSPy examples per GRPO step */
  numDspyExamplesPerGrpoStep: number;
  /** Number of rollouts per GRPO step */
  numRolloutsPerGrpoStep: number;
  /** Number of training steps */
  numTrainSteps: number;
  /** Number of threads for parallel execution */
  numThreads: number;
  /** Checkpoint strategy: 'single-best' | 'all' | 'none' */
  checkpoint: 'single-best' | 'all' | 'none';
  /** Exclude demonstrations from training */
  excludeDemos: boolean;
  /** Custom reward metric function */
  metric?: RewardFunction;
}

/**
 * Reward Function Signature
 * Used by GRPO to evaluate program outputs
 */
export type RewardFunction = (
  example: any,
  prediction: any,
  trace?: any
) => number | Promise<number>;

/**
 * DSPy Program Interface
 * Simplified interface for DSPy programs
 */
export interface DSPyProgram {
  /** Program identifier */
  id: string;
  /** Program modules/components */
  modules: any[];
  /** System prompt (if applicable) */
  systemPrompt?: string;
  /** Program configuration */
  config?: any;
}

/**
 * Training Dataset Entry
 */
export interface TrainingExample {
  /** Unique example ID */
  id: string;
  /** Input messages or data */
  input: any;
  /** Expected output (optional for RL) */
  output?: any;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Evaluation Metrics
 */
export interface EvaluationMetrics {
  /** Overall reward/score */
  reward: number;
  /** Individual metric scores */
  metrics: Record<string, number>;
  /** Training loss (if available) */
  loss?: number;
  /** Validation accuracy */
  accuracy?: number;
  /** Custom metrics */
  custom?: Record<string, any>;
}

/**
 * Training Progress Information
 */
export interface TrainingProgress {
  /** Current step */
  step: number;
  /** Total steps */
  totalSteps: number;
  /** Current metrics */
  metrics: EvaluationMetrics;
  /** Training time elapsed (ms) */
  timeElapsed: number;
  /** Estimated time remaining (ms) */
  timeRemaining?: number;
  /** Best score achieved */
  bestScore: number;
}

/**
 * Optimized Program Result
 */
export interface OptimizedProgram {
  /** Optimized DSPy program */
  program: DSPyProgram;
  /** Final metrics */
  metrics: EvaluationMetrics;
  /** Training history */
  history: TrainingProgress[];
  /** Checkpoint path (if saved) */
  checkpointPath?: string;
  /** Optimization metadata */
  metadata: {
    startTime: string;
    endTime: string;
    totalSteps: number;
    bestStep: number;
    configuration: GRPOCompilerConfig;
  };
}

/**
 * Arbor Provider Configuration
 * For connecting DSPy programs to Arbor inference server
 */
export interface ArborProviderConfig {
  /** Model name in Arbor */
  model: string;
  /** Arbor server base URL */
  apiBase: string;
  /** API key (typically 'arbor') */
  apiKey: string;
  /** Sampling temperature */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Repetition penalty */
  repetitionPenalty?: number;
  /** Max tokens to generate */
  maxTokens?: number;
}

/**
 * GRPO Training Job
 */
export interface GRPOTrainingJob {
  /** Job identifier */
  id: string;
  /** Job status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Current progress */
  progress: TrainingProgress;
  /** Start time */
  startTime: string;
  /** End time (if completed) */
  endTime?: string;
  /** Error message (if failed) */
  error?: string;
  /** Result (if completed) */
  result?: OptimizedProgram;
}

/**
 * Arbor Compilation Options
 */
export interface ArborCompileOptions {
  /** Student program to optimize */
  student: DSPyProgram;
  /** Training dataset */
  trainset: TrainingExample[];
  /** Validation dataset */
  valset: TrainingExample[];
  /** Compiler configuration */
  compilerConfig: GRPOCompilerConfig;
  /** Training configuration */
  trainConfig: GRPOTrainConfig;
}

/**
 * NCCL Environment Configuration
 * For handling GPU communication issues
 */
export interface NCCLConfig {
  /** Disable peer-to-peer transfers */
  p2pDisable?: boolean;
  /** Disable InfiniBand */
  ibDisable?: boolean;
  /** Custom NCCL socket interface */
  socketIfname?: string;
  /** Debug level: 'INFO' | 'WARN' | 'ERROR' */
  debugLevel?: 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Export all types
 */
export type {
  ArborServerConfig,
  ArborServerInfo,
  LoRAConfig,
  GRPOTrainConfig,
  GRPOCompilerConfig,
  RewardFunction,
  DSPyProgram,
  TrainingExample,
  EvaluationMetrics,
  TrainingProgress,
  OptimizedProgram,
  ArborProviderConfig,
  GRPOTrainingJob,
  ArborCompileOptions,
  NCCLConfig
};