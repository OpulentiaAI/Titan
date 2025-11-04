/**
 * Braintrust Integration - Enhanced Telemetry and Logging
 *
 * Provides comprehensive telemetry capabilities for the Opulent Browser automation system
 * with granular logging functions for different types of events and metrics.
 */

let logger: any = null;

/**
 * Initialize Braintrust logger with API key and project name
 */
export async function initializeBraintrust(apiKey: string, projectName: string = "atlas-extension") {
  try {
    // Try to import Braintrust dynamically (browser-compatible)
    const braintrustModule = await import("braintrust");
    const braintrust = braintrustModule.default || braintrustModule;
    const { Logger } = braintrust;
    
    if (!Logger) {
      console.warn("Braintrust Logger not found in module");
      return null;
    }
    
    // Initialize logger with error handling for browser extension context
    try {
      logger = new Logger({
        projectName,
        apiKey,
      });
      
      // Test that logger is functional by attempting a simple log operation
      // Wrap in try-catch since logger might not be fully initialized in browser context
      // In browser extensions, OpenTelemetry tracer might not be available
      try {
        logger.log({
          name: 'braintrust_init_test',
          metadata: { initialized: true },
        });
      } catch (testError: any) {
        // If test log fails, logger might not be fully initialized
        // This can happen in browser extension contexts where tracer isn't available
        const errorMsg = testError?.message || String(testError);
        const errorStack = testError?.stack || '';
        
        // Check for tracer-related errors (getSpanId, tracer, span)
        if (errorMsg.includes('getSpanId') || 
            errorMsg.includes('tracer') || 
            errorMsg.includes('span') ||
            errorStack.includes('getSpanId') ||
            errorStack.includes('_SpanImpl')) {
          console.warn("[Braintrust] Logger created but tracer not available in browser extension context. Braintrust logging will be disabled.");
          logger = null; // Disable logger if tracer is not available
          return null;
        } else {
          console.warn("[Braintrust] Logger created but test log failed - logging may be limited:", errorMsg);
          // For other errors, still disable logger to be safe in browser extension context
          logger = null;
          return null;
        }
      }
      
      return logger;
    } catch (initError: any) {
      console.error("Failed to create Braintrust Logger:", initError?.message || initError);
      logger = null;
      return null;
    }
  } catch (error) {
    console.error("Failed to initialize Braintrust:", error);
    logger = null;
    return null;
  }
}

export function getBraintrustLogger() {
  return logger;
}

/**
 * Check if Braintrust logger is available and functional
 * Returns false if logger is not initialized or if tracer is not available
 */
function isBraintrustLoggerFunctional(): boolean {
  if (!logger) {
    return false;
  }
  
  // Check if logger has the necessary methods
  if (typeof logger.log !== 'function') {
    return false;
  }
  
  // In browser extension contexts, Braintrust might not have a tracer available
  // Try to detect this by checking if we're in a browser extension context
  // and if OpenTelemetry is likely not available
  try {
    // Check if we're in a browser extension (has chrome.runtime)
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Browser extension context - Braintrust tracer might not work
      // We'll rely on the try-catch in the logging functions to handle this
      return true; // Return true, but the try-catch will handle failures
    }
  } catch {
    // Ignore errors in detection
  }
  
  return true;
}

/**
 * Enhanced traced function with granular logging capabilities
 * Creates a span for entire operation when Braintrust is enabled
 */
export async function traced<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const btLogger = getBraintrustLogger();
  
  // Check if logger is available and functional
  if (!btLogger || !isBraintrustLoggerFunctional()) {
    // Braintrust not enabled or not functional, execute without tracing
    // This is NOT an error - it's expected behavior when Braintrust isn't configured
    return await fn();
  }

  // Use Braintrust logger to trace operation
  // This will create a span in Braintrust dashboard
  const startTime = Date.now();
  let loggerFailed = false;
  
  try {
    // Execute the actual function - any errors here should propagate
    const result = await fn();
    const duration = Date.now() - startTime;
    
    // Log success - wrap in try-catch to handle ONLY Braintrust tracer errors
    if (!loggerFailed) {
      try {
        btLogger.log({
          name,
          metadata: {
            ...metadata,
            duration_ms: duration,
            success: true,
          },
        });
      } catch (logError: any) {
        // Only catch Braintrust-specific errors (tracer/span errors)
        // Other errors should NOT be caught here
        const errorMsg = logError?.message || String(logError);
        const errorStack = logError?.stack || '';
        
        if (errorMsg.includes('getSpanId') || 
            errorMsg.includes('tracer') || 
            errorMsg.includes('span') ||
            errorStack.includes('getSpanId') ||
            errorStack.includes('_SpanImpl') ||
            errorStack.includes('startSpanImpl')) {
          // Braintrust tracer error - safe to catch and continue
          loggerFailed = true;
          console.warn(`[Braintrust] Failed to log trace for ${name}:`, errorMsg);
          // Don't throw - the operation succeeded, logging failure shouldn't break it
        } else {
          // Non-Braintrust error - rethrow it
          throw logError;
        }
      }
    }
    
    return result;
  } catch (error) {
    // This catch is for errors from fn(), NOT from logging
    // We should always throw these errors - they're real workflow errors
    const duration = Date.now() - startTime;
    
    // Try to log the error, but don't let logging failures hide real errors
    if (!loggerFailed) {
      try {
        btLogger.log({
          name,
          metadata: {
            ...metadata,
            duration_ms: duration,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch (logError: any) {
        // Only catch Braintrust-specific errors
        const errorMsg = logError?.message || String(logError);
        const errorStack = logError?.stack || '';
        
        if (errorMsg.includes('getSpanId') || 
            errorMsg.includes('tracer') || 
            errorMsg.includes('span') ||
            errorStack.includes('getSpanId') ||
            errorStack.includes('_SpanImpl') ||
            errorStack.includes('startSpanImpl')) {
          // Braintrust tracer error - safe to catch
          loggerFailed = true;
          console.warn(`[Braintrust] Failed to log error trace for ${name}:`, errorMsg);
        } else {
          // Non-Braintrust error - log warning but still throw original error
          console.warn(`[Braintrust] Logging error (non-tracer):`, errorMsg);
        }
      }
    }
    
    // Always throw the original error - it's a real workflow error
    throw error;
  }
}

/**
 * Log general workflow events with structured metadata
 */
export function logEvent(eventName: string, metadata?: Record<string, any>) {
  const btLogger = getBraintrustLogger();
  
  if (!btLogger) {
    // Braintrust not enabled, skip logging
    return;
  }

  try {
    btLogger.log({
      name: eventName,
      metadata: {
        timestamp: Date.now(),
        ...metadata,
      },
    });
  } catch (error: any) {
    // Only catch Braintrust-specific tracer errors
    const errorMsg = error?.message || String(error);
    const errorStack = error?.stack || '';
    
    if (errorMsg.includes('getSpanId') || 
        errorMsg.includes('tracer') || 
        errorMsg.includes('span') ||
        errorStack.includes('getSpanId') ||
        errorStack.includes('_SpanImpl') ||
        errorStack.includes('startSpanImpl')) {
      // Braintrust tracer error - safe to catch and continue
      console.warn(`[Braintrust] Failed to log event ${eventName}:`, errorMsg);
    } else {
      // Non-Braintrust error - rethrow it (shouldn't happen, but be safe)
      throw error;
    }
  }
}

/**
 * Log step progression with detailed metrics
 */
export function logStepProgress(
  workflowName: string, 
  stepNumber: number, 
  metadata?: Record<string, any>
) {
  const btLogger = getBraintrustLogger();
  
  if (!btLogger) {
    return;
  }

  try {
    btLogger.log({
      name: `${workflowName}_step_${stepNumber}`,
      metadata: {
        workflow_name: workflowName,
        step_number: stepNumber,
        timestamp: Date.now(),
        ...metadata,
      },
    });
  } catch (error: any) {
    // Only catch Braintrust-specific tracer errors
    const errorMsg = error?.message || String(error);
    const errorStack = error?.stack || '';
    
    if (errorMsg.includes('getSpanId') || 
        errorMsg.includes('tracer') || 
        errorMsg.includes('span') ||
        errorStack.includes('getSpanId') ||
        errorStack.includes('_SpanImpl') ||
        errorStack.includes('startSpanImpl')) {
      // Braintrust tracer error - safe to catch and continue
      console.warn(`[Braintrust] Failed to log step progress:`, errorMsg);
    } else {
      // Non-Braintrust error - rethrow it
      throw error;
    }
  }
}

/**
 * Log tool execution with comprehensive details
 */
export function logToolExecution(
  toolName: string,
  phase: 'start' | 'complete' | 'error',
  metadata?: Record<string, any>
) {
  const btLogger = getBraintrustLogger();
  
  if (!btLogger) {
    return;
  }

  try {
    btLogger.log({
      name: `tool_${toolName}_${phase}`,
      metadata: {
        tool_name: toolName,
        phase,
        timestamp: Date.now(),
        ...metadata,
      },
    });
  } catch (error: any) {
    // Only catch Braintrust-specific tracer errors
    const errorMsg = error?.message || String(error);
    const errorStack = error?.stack || '';
    
    if (errorMsg.includes('getSpanId') || 
        errorMsg.includes('tracer') || 
        errorMsg.includes('span') ||
        errorStack.includes('getSpanId') ||
        errorStack.includes('_SpanImpl') ||
        errorStack.includes('startSpanImpl')) {
      // Braintrust tracer error - safe to catch and continue
      console.warn(`[Braintrust] Failed to log tool execution:`, errorMsg);
    } else {
      // Non-Braintrust error - rethrow it
      throw error;
    }
  }
}

/**
 * Log agent interactions and behavior
 */
export function logAgentInteraction(
  interactionType: string,
  metadata?: Record<string, any>
) {
  const btLogger = getBraintrustLogger();
  
  if (!btLogger) {
    return;
  }

  try {
    btLogger.log({
      name: `agent_${interactionType}`,
      metadata: {
        interaction_type: interactionType,
        timestamp: Date.now(),
        ...metadata,
      },
    });
  } catch (error: any) {
    // Only catch Braintrust-specific tracer errors
    const errorMsg = error?.message || String(error);
    const errorStack = error?.stack || '';
    
    if (errorMsg.includes('getSpanId') || 
        errorMsg.includes('tracer') || 
        errorMsg.includes('span') ||
        errorStack.includes('getSpanId') ||
        errorStack.includes('_SpanImpl') ||
        errorStack.includes('startSpanImpl')) {
      // Braintrust tracer error - safe to catch and continue
      console.warn(`[Braintrust] Failed to log agent interaction:`, errorMsg);
    } else {
      // Non-Braintrust error - rethrow it
      throw error;
    }
  }
}