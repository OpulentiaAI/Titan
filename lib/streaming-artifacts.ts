// Streaming Artifacts Pattern - AI SDK v6
// Based on midday-ai/ai-sdk-tools artifact system
// Enables structured streaming of typed data with validation

import { z } from 'zod';
import type { Message } from '../types';

/**
 * Artifact metadata for tracking streaming data
 */
export interface ArtifactMetadata {
  id: string;
  type: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  status: 'streaming' | 'complete' | 'error';
}

/**
 * Artifact data wrapper with metadata and payload
 */
export interface ArtifactData<T> {
  metadata: ArtifactMetadata;
  data: Partial<T>;
  validate(): T | null;
  merge(update: Partial<T>): ArtifactData<T>;
  toJSON(): string;
}

/**
 * Streaming artifact with real-time updates
 */
export interface StreamingArtifact<T> {
  id: string;
  current: Partial<T>;
  update(delta: Partial<T>): void;
  complete(): ArtifactData<T>;
  error(message: string): void;
  subscribe(listener: (data: Partial<T>) => void): () => void;
}

/**
 * Artifact definition with schema and utilities
 */
export interface Artifact<T> {
  id: string;
  type: string;
  schema: z.ZodSchema<T>;
  create(data?: Partial<T>): ArtifactData<T>;
  stream(writer: ArtifactWriter): StreamingArtifact<T>;
  validate(data: unknown): T;
  parse(json: string): ArtifactData<T>;
}

/**
 * Writer interface for streaming artifact updates
 */
export interface ArtifactWriter {
  writeData(id: string, delta: any): void;
  writeMetadata(id: string, metadata: Partial<ArtifactMetadata>): void;
  writeComplete(id: string): void;
  writeError(id: string, error: string): void;
}

/**
 * Message writer for UI updates (compatible with AI SDK)
 */
export interface UIMessageWriter {
  updateLastMessage(updater: (msg: Message) => Message): void;
  pushMessage(msg: Message): void;
}

/**
 * Creates an artifact definition with full streaming support
 */
export function artifact<T>(
  type: string,
  schema: z.ZodSchema<T>,
  options: {
    version?: number;
    defaultData?: Partial<T>;
  } = {}
): Artifact<T> {
  const { version = 1, defaultData = {} } = options;

  return {
    id: type,
    type,
    schema,

    create(data: Partial<T> = {}): ArtifactData<T> {
      const now = Date.now();
      const merged = { ...defaultData, ...data };

      return {
        metadata: {
          id: `${type}_${now}_${Math.random().toString(36).substring(2, 9)}`,
          type,
          version,
          createdAt: now,
          updatedAt: now,
          status: 'complete',
        },
        data: merged,

        validate() {
          try {
            return schema.parse(this.data);
          } catch (error) {
            console.error(`Artifact validation failed for ${type}:`, error);
            return null;
          }
        },

        merge(update: Partial<T>): ArtifactData<T> {
          return {
            ...this,
            metadata: {
              ...this.metadata,
              updatedAt: Date.now(),
            },
            data: { ...this.data, ...update },
          };
        },

        toJSON(): string {
          return JSON.stringify({
            metadata: this.metadata,
            data: this.data,
          });
        },
      };
    },

    stream(writer: ArtifactWriter): StreamingArtifact<T> {
      const now = Date.now();
      const artifactId = `${type}_${now}_${Math.random().toString(36).substring(2, 9)}`;
      let current: Partial<T> = { ...defaultData };
      const listeners = new Set<(data: Partial<T>) => void>();

      // Initialize metadata
      writer.writeMetadata(artifactId, {
        id: artifactId,
        type,
        version,
        createdAt: now,
        updatedAt: now,
        status: 'streaming',
      });

      return {
        id: artifactId,
        current,

        update(delta: Partial<T>) {
          current = { ...current, ...delta };
          writer.writeData(artifactId, delta);
          writer.writeMetadata(artifactId, {
            updatedAt: Date.now(),
          });

          // Notify all listeners
          listeners.forEach((listener) => listener(current));
        },

        complete(): ArtifactData<T> {
          writer.writeComplete(artifactId);
          writer.writeMetadata(artifactId, {
            status: 'complete',
            updatedAt: Date.now(),
          });

          return {
            metadata: {
              id: artifactId,
              type,
              version,
              createdAt: now,
              updatedAt: Date.now(),
              status: 'complete',
            },
            data: current,

            validate() {
              try {
                return schema.parse(this.data);
              } catch (error) {
                console.error(`Artifact validation failed for ${type}:`, error);
                return null;
              }
            },

            merge(update: Partial<T>): ArtifactData<T> {
              return {
                ...this,
                metadata: {
                  ...this.metadata,
                  updatedAt: Date.now(),
                },
                data: { ...this.data, ...update },
              };
            },

            toJSON(): string {
              return JSON.stringify({
                metadata: this.metadata,
                data: this.data,
              });
            },
          };
        },

        error(message: string) {
          writer.writeError(artifactId, message);
          writer.writeMetadata(artifactId, {
            status: 'error',
            updatedAt: Date.now(),
          });
        },

        subscribe(listener: (data: Partial<T>) => void): () => void {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    },

    validate(data: unknown): T {
      return schema.parse(data);
    },

    parse(json: string): ArtifactData<T> {
      const parsed = JSON.parse(json);
      return {
        metadata: parsed.metadata,
        data: parsed.data,

        validate() {
          try {
            return schema.parse(this.data);
          } catch (error) {
            console.error(`Artifact validation failed for ${type}:`, error);
            return null;
          }
        },

        merge(update: Partial<T>): ArtifactData<T> {
          return {
            ...this,
            metadata: {
              ...this.metadata,
              updatedAt: Date.now(),
            },
            data: { ...this.data, ...update },
          };
        },

        toJSON(): string {
          return JSON.stringify({
            metadata: this.metadata,
            data: this.data,
          });
        },
      };
    },
  };
}

/**
 * Creates an artifact writer that updates UI messages
 */
export function createMessageArtifactWriter(messageWriter: UIMessageWriter): ArtifactWriter {
  return {
    writeData(id: string, delta: any) {
      messageWriter.updateLastMessage((msg) => {
        const artifacts = msg.artifacts || {};
        const existing = artifacts[id] || { metadata: {}, data: {} };

        return {
          ...msg,
          artifacts: {
            ...artifacts,
            [id]: {
              metadata: existing.metadata,
              data: { ...existing.data, ...delta },
            },
          },
        };
      });
    },

    writeMetadata(id: string, metadata: Partial<ArtifactMetadata>) {
      messageWriter.updateLastMessage((msg) => {
        const artifacts = msg.artifacts || {};
        const existing = artifacts[id] || { metadata: {}, data: {} };

        return {
          ...msg,
          artifacts: {
            ...artifacts,
            [id]: {
              metadata: { ...existing.metadata, ...metadata },
              data: existing.data,
            },
          },
        };
      });
    },

    writeComplete(id: string) {
      this.writeMetadata(id, {
        status: 'complete',
        updatedAt: Date.now(),
      });
    },

    writeError(id: string, error: string) {
      messageWriter.updateLastMessage((msg) => {
        const artifacts = msg.artifacts || {};
        const existing = artifacts[id] || { metadata: {}, data: {} };

        return {
          ...msg,
          artifacts: {
            ...artifacts,
            [id]: {
              ...existing,
              metadata: {
                ...existing.metadata,
                status: 'error' as const,
                updatedAt: Date.now(),
              },
              error,
            },
          },
        };
      });
    },
  };
}

/**
 * Specialized artifact definitions for common use cases
 */

// Execution Plan Artifact
export const executionPlanArtifact = artifact(
  'execution_plan',
  z.object({
    objective: z.string(),
    approach: z.string(),
    totalSteps: z.number(),
    completedSteps: z.number(),
    currentStep: z.number().optional(),
    steps: z.array(
      z.object({
        step: z.number(),
        action: z.string(),
        target: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
        reasoning: z.string(),
        result: z.string().optional(),
      })
    ),
    progress: z.number().min(0).max(1),
    estimatedTimeRemaining: z.number().optional(),
  }),
  {
    defaultData: {
      completedSteps: 0,
      progress: 0,
      steps: [],
    },
  }
);

// Tool Results Artifact
export const toolResultsArtifact = artifact(
  'tool_results',
  z.object({
    toolCalls: z.array(
      z.object({
        toolName: z.string(),
        args: z.record(z.any()),
        result: z.any(),
        duration: z.number(),
        success: z.boolean(),
        timestamp: z.number(),
        error: z.string().optional(),
      })
    ),
    summary: z.object({
      totalCalls: z.number(),
      successCount: z.number(),
      errorCount: z.number(),
      averageDuration: z.number(),
      toolUsage: z.record(z.number()),
    }),
  }),
  {
    defaultData: {
      toolCalls: [],
      summary: {
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        averageDuration: 0,
        toolUsage: {},
      },
    },
  }
);

// Page Context Artifact
export const pageContextArtifact = artifact(
  'page_context',
  z.object({
    url: z.string().url(),
    title: z.string(),
    textContent: z.string(),
    links: z.array(
      z.object({
        text: z.string(),
        href: z.string(),
      })
    ),
    forms: z.array(
      z.object({
        action: z.string().optional(),
        method: z.string().optional(),
        fields: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            value: z.string().optional(),
          })
        ),
      })
    ),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }),
    screenshot: z.string().optional(),
    timestamp: z.number(),
  })
);

// Evaluation Artifact
export const evaluationArtifact = artifact(
  'evaluation',
  z.object({
    quality: z.enum(['poor', 'fair', 'good', 'excellent']),
    score: z.number().min(0).max(1),
    completeness: z.number().min(0).max(1),
    correctness: z.number().min(0).max(1),
    issues: z.array(z.string()),
    strengths: z.array(z.string()),
    shouldProceed: z.boolean(),
    retryStrategy: z
      .object({
        approach: z.string(),
        focusAreas: z.array(z.string()),
        estimatedImprovement: z.number(),
      })
      .optional(),
    timestamp: z.number(),
  })
);

// Summarization Artifact
export const summarizationArtifact = artifact(
  'summarization',
  z.object({
    summary: z.string(),
    keyActions: z.array(z.string()),
    outcome: z.string(),
    nextSteps: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1),
    timestamp: z.number(),
  })
);

/**
 * Utility: Update execution plan progress
 */
export function updateExecutionPlanProgress(
  streaming: StreamingArtifact<z.infer<typeof executionPlanArtifact.schema>>,
  stepIndex: number,
  status: 'in_progress' | 'completed' | 'failed',
  result?: string
) {
  const steps = [...(streaming.current.steps || [])];
  if (steps[stepIndex]) {
    steps[stepIndex] = {
      ...steps[stepIndex],
      status,
      result,
    };

    const completedSteps = steps.filter((s) => s.status === 'completed').length;
    const progress = streaming.current.totalSteps
      ? completedSteps / streaming.current.totalSteps
      : 0;

    streaming.update({
      steps,
      completedSteps,
      currentStep: stepIndex,
      progress,
    });
  }
}

/**
 * Utility: Add tool result to artifact
 */
export function addToolResult(
  streaming: StreamingArtifact<z.infer<typeof toolResultsArtifact.schema>>,
  toolCall: {
    toolName: string;
    args: Record<string, any>;
    result: any;
    duration: number;
    success: boolean;
    error?: string;
  }
) {
  const toolCalls = [...(streaming.current.toolCalls || [])];
  toolCalls.push({
    ...toolCall,
    timestamp: Date.now(),
  });

  const totalCalls = toolCalls.length;
  const successCount = toolCalls.filter((c) => c.success).length;
  const errorCount = toolCalls.filter((c) => !c.success).length;
  const averageDuration =
    toolCalls.reduce((sum, c) => sum + c.duration, 0) / totalCalls;

  const toolUsage: Record<string, number> = {};
  toolCalls.forEach((c) => {
    toolUsage[c.toolName] = (toolUsage[c.toolName] || 0) + 1;
  });

  streaming.update({
    toolCalls,
    summary: {
      totalCalls,
      successCount,
      errorCount,
      averageDuration,
      toolUsage,
    },
  });
}

/**
 * Example usage in workflow
 */
export async function exampleArtifactUsage(messageWriter: UIMessageWriter) {
  const writer = createMessageArtifactWriter(messageWriter);

  // Start streaming execution plan
  const planStream = executionPlanArtifact.stream(writer);
  planStream.update({
    objective: 'Navigate to GitHub and search for AI SDK',
    approach: 'Direct navigation and search',
    totalSteps: 5,
    steps: [
      {
        step: 1,
        action: 'navigate',
        target: 'https://github.com',
        status: 'pending',
        reasoning: 'Start at GitHub homepage',
      },
    ],
  });

  // Update progress
  updateExecutionPlanProgress(planStream, 0, 'in_progress');
  // ... execute step
  updateExecutionPlanProgress(planStream, 0, 'completed', 'Navigation successful');

  // Complete artifact
  const finalPlan = planStream.complete();
  console.log('Execution plan completed:', finalPlan.validate());
}
