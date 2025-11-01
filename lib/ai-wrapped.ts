// Wrapped AI SDK functions with Braintrust observability
// This ensures all AI calls are traced when Braintrust is configured

let wrappedAI: typeof import('ai') | null = null;
let isBraintrustEnabled = false;

/**
 * Initialize wrapped AI SDK with Braintrust if API key is provided
 */
export async function initializeWrappedAI(braintrustApiKey?: string) {
  const aiModule = await import('ai');
  
  if (braintrustApiKey) {
    try {
      // Try importing wrapAISDK - it might be a named export or default
      const braintrustModule = await import('braintrust');
      const wrapAISDK = braintrustModule.wrapAISDK || (braintrustModule as any).default?.wrapAISDK;
      
      if (typeof wrapAISDK === 'function') {
        wrappedAI = wrapAISDK(aiModule);
        isBraintrustEnabled = true;
        return wrappedAI;
      } else {
        wrappedAI = aiModule;
        isBraintrustEnabled = false;
        return wrappedAI;
      }
    } catch (error: any) {
      wrappedAI = aiModule;
      isBraintrustEnabled = false;
      return wrappedAI;
    }
  } else {
    wrappedAI = aiModule;
    isBraintrustEnabled = false;
    return wrappedAI;
  }
}

/**
 * Get wrapped AI SDK functions
 * Automatically wraps with Braintrust if enabled
 */
export async function getWrappedAI(braintrustApiKey?: string) {
  if (!wrappedAI) {
    await initializeWrappedAI(braintrustApiKey);
  }
  return wrappedAI!;
}

/**
 * Check if Braintrust is currently enabled
 */
export function isBraintrustActive() {
  return isBraintrustEnabled;
}

