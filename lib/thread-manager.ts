// ThreadManager Status Bus - Tool Lifecycle Event System
// Provides explicit output hooks for tool lifecycle events
// Captures events in both backend logs and eval output

import { logEvent, logToolExecution, traced } from './braintrust.js';
import type { EventEmitter } from 'events';

export type ToolLifecyclePhase = 
  | 'pending'
  | 'queued'
  | 'starting'
  | 'input-streaming'
  | 'executing'
  | 'output-streaming'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface ToolLifecycleEvent {
  toolCallId: string;
  toolName: string;
  phase: ToolLifecyclePhase;
  timestamp: number;
  metadata?: Record<string, any>;
  error?: string;
}

export type ToolLifecycleListener = (event: ToolLifecycleEvent) => void;

/**
 * ThreadManager - Central event bus for tool lifecycle events
 * Provides Daytona-style logging with Braintrust spans
 */
export class ThreadManager {
  private listeners: Set<ToolLifecycleListener> = new Set();
  private eventHistory: ToolLifecycleEvent[] = [];
  private maxHistorySize = 1000;

  /**
   * Emit a tool lifecycle event
   * This will be captured in both backend logs and eval output
   */
  emit(event: Omit<ToolLifecycleEvent, 'timestamp'>): void {
    const fullEvent: ToolLifecycleEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Store in history
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(fullEvent);
      } catch (error) {
        console.error('[ThreadManager] Listener error:', error);
      }
    });

    // Log to Braintrust
    this.logToBraintrust(fullEvent);
  }

  /**
   * Subscribe to tool lifecycle events
   */
  subscribe(listener: ToolLifecycleListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get event history
   */
  getHistory(): ToolLifecycleEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events for a specific tool call
   */
  getToolCallHistory(toolCallId: string): ToolLifecycleEvent[] {
    return this.eventHistory.filter(e => e.toolCallId === toolCallId);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Log tool lifecycle event to Braintrust
   */
  private logToBraintrust(event: ToolLifecycleEvent): void {
    const metadata = {
      tool_call_id: event.toolCallId,
      tool_name: event.toolName,
      phase: event.phase,
      timestamp: event.timestamp,
      ...event.metadata,
    };

    if (event.error) {
      metadata.error = event.error;
    }

    // Use appropriate logging function based on phase
    switch (event.phase) {
      case 'starting':
      case 'executing':
        logToolExecution(event.toolName, 'start', metadata);
        break;
      case 'completed':
        logToolExecution(event.toolName, 'complete', metadata);
        break;
      case 'error':
        logToolExecution(event.toolName, 'error', metadata);
        break;
      default:
        logEvent(`tool_lifecycle_${event.phase}`, metadata);
    }
  }
}

// Global ThreadManager instance
let globalThreadManager: ThreadManager | null = null;

/**
 * Get the global ThreadManager instance
 */
export function getThreadManager(): ThreadManager {
  if (!globalThreadManager) {
    globalThreadManager = new ThreadManager();
  }
  return globalThreadManager;
}

/**
 * Reset the global ThreadManager (useful for tests)
 */
export function resetThreadManager(): void {
  globalThreadManager = null;
}

/**
 * Emit a tool lifecycle event (convenience function)
 */
export function emitToolLifecycle(event: Omit<ToolLifecycleEvent, 'timestamp'>): void {
  getThreadManager().emit(event);
}

/**
 * Subscribe to tool lifecycle events (convenience function)
 */
export function subscribeToolLifecycle(listener: ToolLifecycleListener): () => void {
  return getThreadManager().subscribe(listener);
}

