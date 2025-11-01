// Feature Flags - Runtime feature toggles for gradual rollout
// Enables/disables features without code changes

export interface FeatureFlags {
  // Summarization features
  useYouAdvancedAgent: boolean;
  useAiSdkToolCalls: boolean;
  enableSummarizationFallback: boolean;
  
  // Performance features
  enableFinalization: boolean;
  enableQueryExpansion: boolean;
  enableSubmodularOptimization: boolean;
  
  // Observability features
  enableBraintrustLogging: boolean;
  enableDebugLogging: boolean;
  
  // UI features
  enableWorkflowQueue: boolean;
  enableSummaryArtifact: boolean;
  enableTextShimmer: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  // Summarization - AI SDK tool calls enabled by default
  useYouAdvancedAgent: false, // Deprecated - HTTP 401 authentication issues
  useAiSdkToolCalls: true, // New implementation using AI SDK 6 + You.com Search API
  enableSummarizationFallback: true,
  
  // Performance
  enableFinalization: false, // Disabled by default (adds 5-10s latency)
  enableQueryExpansion: true,
  enableSubmodularOptimization: true,
  
  // Observability
  enableBraintrustLogging: true,
  enableDebugLogging: true,
  
  // UI
  enableWorkflowQueue: true,
  enableSummaryArtifact: true,
  enableTextShimmer: true,
};

let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS };

/**
 * Get current feature flags
 */
export function getFeatureFlags(): Readonly<FeatureFlags> {
  return Object.freeze({ ...currentFlags });
}

/**
 * Update feature flags at runtime
 */
export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  currentFlags = { ...currentFlags, ...flags };
  console.log('🚩 [FEATURE-FLAGS] Updated:', flags);
}

/**
 * Reset to default flags
 */
export function resetFeatureFlags(): void {
  currentFlags = { ...DEFAULT_FLAGS };
  console.log('🚩 [FEATURE-FLAGS] Reset to defaults');
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return currentFlags[feature] || false;
}

/**
 * Override flags from environment variables
 */
export function loadFeatureFlagsFromEnv(): void {
  const envOverrides: Partial<FeatureFlags> = {};
  
  if (process.env.FEATURE_YOU_ADVANCED_AGENT === 'true') {
    envOverrides.useYouAdvancedAgent = true;
  }
  if (process.env.FEATURE_AI_SDK_TOOL_CALLS === 'false') {
    envOverrides.useAiSdkToolCalls = false;
  }
  if (process.env.FEATURE_FINALIZATION === 'true') {
    envOverrides.enableFinalization = true;
  }
  if (process.env.FEATURE_WORKFLOW_QUEUE === 'false') {
    envOverrides.enableWorkflowQueue = false;
  }
  
  if (Object.keys(envOverrides).length > 0) {
    setFeatureFlags(envOverrides);
    console.log('🚩 [FEATURE-FLAGS] Loaded from environment:', envOverrides);
  }
}

// Auto-load from environment on import
loadFeatureFlagsFromEnv();

