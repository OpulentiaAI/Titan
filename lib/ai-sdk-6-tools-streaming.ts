// AI SDK 6 Tool Streaming & Preliminary Results
// Implements AsyncIterable pattern for real-time status updates

import { tool, type CoreTool } from 'ai';
import { z } from 'zod';
import type { PreliminaryToolResult, ToolResult, ToolExecutionOptions } from './ai-sdk-6-tools-types';

/**
 * Create a streaming tool with preliminary results
 * Enables real-time status updates during long-running operations
 */
export function createStreamingTool<TParams extends z.ZodType, TResult>(config: {
  name: string;
  description: string;
  inputSchema: TParams;
  execute: (
    args: z.infer<TParams>,
    options: ToolExecutionOptions,
    emit: (update: PreliminaryToolResult<TResult>) => void
  ) => Promise<TResult>;
}): CoreTool {
  return tool({
    description: config.description,
    parameters: config.inputSchema,
    async *execute(args: z.infer<TParams>, options?: ToolExecutionOptions) {
      const updates: Array<PreliminaryToolResult<TResult>> = [];

      // Emit function to collect updates
      const emit = (update: PreliminaryToolResult<TResult>) => {
        updates.push(update);
      };

      try {
        // Execute and collect updates
        const finalResult = await config.execute(
          args,
          options || {
            toolCallId: '',
            messages: [],
          },
          emit
        );

        // Yield all preliminary updates
        for (const update of updates) {
          yield update;
        }

        // Yield final result
        yield finalResult;
      } catch (error) {
        // Yield error status
        yield {
          status: 'error' as const,
          text: error instanceof Error ? error.message : 'Unknown error',
          data: undefined,
        };
        throw error;
      }
    },
  });
}

/**
 * Example: Weather tool with streaming status updates
 */
export const streamingWeatherTool = createStreamingTool({
  name: 'getWeather',
  description: 'Get the current weather in a location with real-time updates',
  inputSchema: z.object({
    location: z.string().describe('The location to get weather for'),
    units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
  }),
  execute: async ({ location, units }, options, emit) => {
    // Step 1: Loading state
    emit({
      status: 'loading',
      text: `Fetching weather data for ${location}...`,
      progress: 0,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Progress update
    emit({
      status: 'progress',
      text: `Processing data from weather API...`,
      progress: 50,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Final result
    const temperature = 20 + Math.floor(Math.random() * 15);
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][
      Math.floor(Math.random() * 4)
    ];

    emit({
      status: 'success',
      text: `Weather data retrieved successfully`,
      progress: 100,
      data: {
        location,
        temperature,
        conditions,
        units,
      } as any,
    });

    return {
      location,
      temperature,
      conditions,
      units,
      humidity: 60 + Math.floor(Math.random() * 30),
      windSpeed: 5 + Math.floor(Math.random() * 20),
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Example: File analysis tool with multi-stage processing
 */
export const streamingFileAnalysisTool = createStreamingTool({
  name: 'analyzeFile',
  description: 'Analyze a file with detailed progress updates',
  inputSchema: z.object({
    filePath: z.string().describe('Path to the file to analyze'),
    analysisType: z
      .enum(['full', 'quick', 'security'])
      .optional()
      .default('full')
      .describe('Type of analysis to perform'),
  }),
  execute: async ({ filePath, analysisType }, options, emit) => {
    // Stage 1: Reading file
    emit({
      status: 'loading',
      text: `Reading file: ${filePath}`,
      progress: 0,
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Stage 2: Parsing
    emit({
      status: 'progress',
      text: `Parsing file content...`,
      progress: 25,
      data: {
        stage: 'parsing',
        linesRead: 1000,
      } as any,
    });

    await new Promise(resolve => setTimeout(resolve, 800));

    // Stage 3: Analysis
    emit({
      status: 'progress',
      text: `Running ${analysisType} analysis...`,
      progress: 50,
      data: {
        stage: 'analyzing',
        checksCompleted: 5,
        totalChecks: 10,
      } as any,
    });

    await new Promise(resolve => setTimeout(resolve, 1200));

    // Stage 4: Generating report
    emit({
      status: 'progress',
      text: `Generating analysis report...`,
      progress: 75,
      data: {
        stage: 'reporting',
        issuesFound: 2,
      } as any,
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Final result
    const result = {
      filePath,
      analysisType,
      fileSize: 1024 * 500,
      linesOfCode: 1523,
      issues: [
        { severity: 'warning', message: 'Unused variable detected', line: 45 },
        { severity: 'info', message: 'Consider adding documentation', line: 102 },
      ],
      metrics: {
        complexity: 7.5,
        maintainability: 85,
        testCoverage: 78,
      },
      completedAt: new Date().toISOString(),
    };

    emit({
      status: 'success',
      text: `Analysis complete: ${result.issues.length} issues found`,
      progress: 100,
      data: result as any,
    });

    return result;
  },
});

/**
 * Example: Database query tool with streaming results
 */
export const streamingDatabaseQueryTool = createStreamingTool({
  name: 'queryDatabase',
  description: 'Execute a database query with real-time progress',
  inputSchema: z.object({
    query: z.string().describe('SQL query to execute'),
    database: z.string().describe('Database name'),
    limit: z.number().min(1).max(1000).optional().default(100),
  }),
  execute: async ({ query, database, limit }, options, emit) => {
    // Connection phase
    emit({
      status: 'loading',
      text: `Connecting to database: ${database}`,
      progress: 0,
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    // Query execution
    emit({
      status: 'progress',
      text: `Executing query...`,
      progress: 20,
      data: {
        phase: 'execution',
        rowsProcessed: 0,
      } as any,
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Processing results
    const totalRows = 250;
    for (let i = 0; i < 5; i++) {
      const rowsProcessed = Math.floor((totalRows * (i + 1)) / 5);
      emit({
        status: 'progress',
        text: `Processing results... (${rowsProcessed}/${totalRows} rows)`,
        progress: 20 + (60 * (i + 1)) / 5,
        data: {
          phase: 'processing',
          rowsProcessed,
          totalRows,
        } as any,
      });
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Final result
    const mockResults = Array.from({ length: Math.min(totalRows, limit) }, (_, i) => ({
      id: i + 1,
      name: `Record ${i + 1}`,
      value: Math.random() * 1000,
    }));

    const result = {
      query,
      database,
      results: mockResults,
      totalRows,
      executionTime: 1.25,
      timestamp: new Date().toISOString(),
    };

    emit({
      status: 'success',
      text: `Query complete: ${result.totalRows} rows retrieved`,
      progress: 100,
      data: result as any,
    });

    return result;
  },
});

/**
 * Example: Multi-step research tool with checkpoints
 */
export const streamingResearchTool = createStreamingTool({
  name: 'conductResearch',
  description: 'Conduct comprehensive research with progress tracking',
  inputSchema: z.object({
    topic: z.string().describe('Research topic'),
    depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
    sources: z.array(z.string()).optional().describe('Specific sources to consult'),
  }),
  execute: async ({ topic, depth, sources }, options, emit) => {
    const steps = ['Gathering sources', 'Reading content', 'Analyzing data', 'Synthesizing findings'];
    const sourcesToUse = sources || ['academic', 'industry', 'news'];

    for (let i = 0; i < steps.length; i++) {
      emit({
        status: 'progress',
        text: `${steps[i]} for topic: ${topic}`,
        progress: (i / steps.length) * 100,
        data: {
          currentStep: steps[i],
          stepNumber: i + 1,
          totalSteps: steps.length,
          sourcesConsulted: sourcesToUse.slice(0, i + 1),
        } as any,
      });

      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
    }

    const result = {
      topic,
      depth,
      findings: [
        `Key insight 1 about ${topic}`,
        `Important trend related to ${topic}`,
        `Critical consideration for ${topic}`,
      ],
      sources: sourcesToUse.map(source => ({
        name: source,
        url: `https://example.com/${source}`,
        relevance: 0.7 + Math.random() * 0.3,
      })),
      confidence: 0.85,
      completedAt: new Date().toISOString(),
    };

    emit({
      status: 'success',
      text: `Research complete: ${result.findings.length} key findings identified`,
      progress: 100,
      data: result as any,
    });

    return result;
  },
});

/**
 * Create a tool with checkpoint-based streaming
 * Useful for long-running operations that can be resumed
 */
export function createCheckpointedTool<TParams extends z.ZodType, TResult, TCheckpoint>(config: {
  name: string;
  description: string;
  inputSchema: TParams;
  execute: (
    args: z.infer<TParams>,
    options: ToolExecutionOptions,
    emit: (update: PreliminaryToolResult<TResult>, checkpoint?: TCheckpoint) => void,
    restoreCheckpoint?: TCheckpoint
  ) => Promise<TResult>;
}): CoreTool {
  return tool({
    description: config.description,
    parameters: config.inputSchema,
    async *execute(args: z.infer<TParams>, options?: ToolExecutionOptions) {
      let lastCheckpoint: TCheckpoint | undefined;
      const updates: Array<PreliminaryToolResult<TResult>> = [];

      const emit = (update: PreliminaryToolResult<TResult>, checkpoint?: TCheckpoint) => {
        updates.push(update);
        if (checkpoint) {
          lastCheckpoint = checkpoint;
        }
      };

      try {
        const finalResult = await config.execute(
          args,
          options || { toolCallId: '', messages: [] },
          emit,
          lastCheckpoint
        );

        // Yield all updates
        for (const update of updates) {
          yield update;
        }

        // Yield final result
        yield finalResult;
      } catch (error) {
        // Yield error with last checkpoint for potential resume
        yield {
          status: 'error' as const,
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: { lastCheckpoint } as any,
        };
        throw error;
      }
    },
  });
}

export default {
  createStreamingTool,
  createCheckpointedTool,
  streamingWeatherTool,
  streamingFileAnalysisTool,
  streamingDatabaseQueryTool,
  streamingResearchTool,
};
