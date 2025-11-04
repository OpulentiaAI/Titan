// Multi-Agent Orchestration System - AI SDK v6
// Implements agent handoffs, specialized roles, and coordinated execution

import { z } from 'zod';
import type { Message } from '../types';

/**
 * Agent role definition
 */
export interface AgentRole {
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  systemPrompt: string;
  handoffTriggers?: AgentHandoffTrigger[];
}

/**
 * Agent handoff trigger
 */
export interface AgentHandoffTrigger {
  condition: string; // Description of when to hand off
  targetAgent: string;
  evaluate: (context: AgentContext) => boolean;
}

/**
 * Agent context shared between agents
 */
export interface AgentContext {
  sessionId: string;
  originalQuery: string;
  currentAgent: string;
  history: AgentHistoryEntry[];
  sharedState: Record<string, any>;
  messages: Message[];
  executionMetrics: {
    totalSteps: number;
    successfulSteps: number;
    errors: number;
    duration: number;
  };
}

/**
 * Agent history entry
 */
export interface AgentHistoryEntry {
  agent: string;
  action: string;
  input: any;
  output: any;
  timestamp: number;
  duration: number;
  handoffReason?: string;
}

/**
 * Agent handoff request
 */
export interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  reason: string;
  context: AgentContext;
  recommendedActions?: string[];
}

/**
 * Multi-agent orchestration result
 */
export interface MultiAgentResult {
  success: boolean;
  finalAgent: string;
  agentSequence: string[];
  context: AgentContext;
  result: any;
  duration: number;
}

/**
 * Specialized Agent Roles
 */
export const AgentRoles: Record<string, AgentRole> = {
  planner: {
    name: 'planner',
    description: 'Analyzes queries and creates detailed execution plans',
    capabilities: [
      'Query analysis and decomposition',
      'Step-by-step planning',
      'Risk assessment',
      'Complexity evaluation',
    ],
    tools: ['analyzeQuery', 'generatePlan', 'assessRisks'],
    systemPrompt: `You are a planning specialist. Your role is to:
1. Analyze the user's query and understand intent
2. Break down complex tasks into actionable steps
3. Identify potential challenges and risks
4. Create a detailed execution plan with fallback strategies
5. Hand off to the executor agent when planning is complete

When to hand off to EXECUTOR:
- Planning is complete with clear, actionable steps
- All risks and fallbacks are identified
- Confidence in plan quality is high (>0.8)

Output Format:
- Detailed execution plan with numbered steps
- Estimated complexity and duration
- Critical paths and dependencies
- Handoff recommendation with reasoning`,

    handoffTriggers: [
      {
        condition: 'Planning complete with high confidence',
        targetAgent: 'executor',
        evaluate: (ctx) => {
          const plan = ctx.sharedState.plan;
          return plan && plan.confidence >= 0.8 && plan.steps?.length > 0;
        },
      },
      {
        condition: 'Query too complex, needs specialized analysis',
        targetAgent: 'analyst',
        evaluate: (ctx) => {
          return ctx.sharedState.complexityScore > 0.9;
        },
      },
    ],
  },

  executor: {
    name: 'executor',
    description: 'Executes plans step-by-step with browser automation',
    capabilities: [
      'Browser navigation and interaction',
      'Step execution with validation',
      'Error handling and recovery',
      'Progress tracking',
    ],
    tools: [
      'navigate',
      'click',
      'type',
      'scroll',
      'wait',
      'getPageContext',
      'screenshot',
      'pressKey',
      'keyCombo',
    ],
    systemPrompt: `You are an execution specialist. Your role is to:
1. Execute the provided plan step-by-step
2. Validate each step before proceeding
3. Handle errors with fallback strategies
4. Track progress and maintain state
5. Hand off to evaluator when execution is complete or blocked

When to hand off to EVALUATOR:
- All steps executed successfully
- Execution blocked by unrecoverable error
- Maximum retries reached

When to hand off to RECOVERY:
- Step failed but recovery might be possible
- Need alternative approach

Output Format:
- Step-by-step execution log
- Success/failure status for each step
- Current state and next actions
- Handoff recommendation with reasoning`,

    handoffTriggers: [
      {
        condition: 'Execution complete, need quality assessment',
        targetAgent: 'evaluator',
        evaluate: (ctx) => {
          const plan = ctx.sharedState.plan;
          const completed = ctx.sharedState.completedSteps || 0;
          return plan && completed >= plan.steps.length;
        },
      },
      {
        condition: 'Execution failed, need recovery assistance',
        targetAgent: 'recovery',
        evaluate: (ctx) => {
          return ctx.executionMetrics.errors > 2;
        },
      },
    ],
  },

  evaluator: {
    name: 'evaluator',
    description: 'Assesses execution quality and determines next actions',
    capabilities: [
      'Quality assessment',
      'Completeness verification',
      'Error analysis',
      'Retry recommendations',
    ],
    tools: ['assessQuality', 'verifyResults', 'generateReport'],
    systemPrompt: `You are an evaluation specialist. Your role is to:
1. Assess the quality of execution results
2. Verify completeness and correctness
3. Identify issues and gaps
4. Recommend retry or proceed decisions
5. Hand off to summarizer or executor based on assessment

When to hand off to EXECUTOR (retry):
- Quality below acceptable threshold (<0.7)
- Identified issues are fixable
- Retry likely to improve results

When to hand off to SUMMARIZER:
- Quality meets or exceeds threshold (>=0.7)
- Results are complete and correct
- No further execution needed

Output Format:
- Quality scores (completeness, correctness, overall)
- Issues identified
- Strengths and weaknesses
- Retry strategy if needed
- Handoff recommendation with reasoning`,

    handoffTriggers: [
      {
        condition: 'Quality acceptable, ready to summarize',
        targetAgent: 'summarizer',
        evaluate: (ctx) => {
          const evaluation = ctx.sharedState.evaluation;
          return evaluation && evaluation.score >= 0.7 && evaluation.shouldProceed;
        },
      },
      {
        condition: 'Quality poor, retry recommended',
        targetAgent: 'executor',
        evaluate: (ctx) => {
          const evaluation = ctx.sharedState.evaluation;
          const retryCount = ctx.sharedState.retryCount || 0;
          return (
            evaluation &&
            evaluation.score < 0.7 &&
            retryCount < 2 &&
            evaluation.retryStrategy
          );
        },
      },
    ],
  },

  summarizer: {
    name: 'summarizer',
    description: 'Creates final summaries and user-facing reports',
    capabilities: [
      'Result summarization',
      'Key action extraction',
      'Outcome reporting',
      'Next steps recommendation',
    ],
    tools: ['summarize', 'extractActions', 'formatReport'],
    systemPrompt: `You are a summarization specialist. Your role is to:
1. Synthesize execution results into clear summary
2. Extract key actions taken
3. Report final outcomes
4. Suggest next steps if applicable
5. No further handoffs - this is the final stage

Output Format:
- Executive summary (1-2 sentences)
- Key actions taken (bullet list)
- Final outcome and status
- Next steps or recommendations (if applicable)
- No handoff recommendation (final agent)`,

    handoffTriggers: [], // No handoffs from summarizer
  },

  recovery: {
    name: 'recovery',
    description: 'Handles errors and finds alternative approaches',
    capabilities: [
      'Error diagnosis',
      'Alternative strategy generation',
      'Fallback execution',
      'Problem escalation',
    ],
    tools: [
      'diagnoseError',
      'generateAlternatives',
      'executeFallback',
      'getPageContext',
    ],
    systemPrompt: `You are a recovery specialist. Your role is to:
1. Diagnose execution errors and failures
2. Generate alternative approaches
3. Attempt fallback strategies
4. Escalate if recovery impossible
5. Hand off to executor with recovery plan or evaluator if unrecoverable

When to hand off to EXECUTOR:
- Recovery plan identified
- Alternative approach ready
- Worth attempting retry

When to hand off to EVALUATOR:
- Recovery not possible
- Should abort and report failure
- Maximum recovery attempts reached

Output Format:
- Error diagnosis
- Root cause analysis
- Recovery plan with alternatives
- Handoff recommendation with reasoning`,

    handoffTriggers: [
      {
        condition: 'Recovery plan ready, attempt retry',
        targetAgent: 'executor',
        evaluate: (ctx) => {
          const recovery = ctx.sharedState.recoveryPlan;
          return recovery && recovery.alternatives?.length > 0;
        },
      },
      {
        condition: 'Recovery not possible, need evaluation',
        targetAgent: 'evaluator',
        evaluate: (ctx) => {
          const recoveryAttempts = ctx.sharedState.recoveryAttempts || 0;
          return recoveryAttempts >= 2;
        },
      },
    ],
  },

  analyst: {
    name: 'analyst',
    description: 'Performs deep analysis for complex queries',
    capabilities: [
      'Context analysis',
      'Intent extraction',
      'Requirement clarification',
      'Strategy formulation',
    ],
    tools: ['analyzeContext', 'extractIntent', 'clarifyRequirements'],
    systemPrompt: `You are an analysis specialist. Your role is to:
1. Perform deep analysis of complex queries
2. Extract hidden intent and requirements
3. Clarify ambiguities
4. Formulate optimal strategy
5. Hand off to planner with enriched context

When to hand off to PLANNER:
- Analysis complete
- Intent clearly understood
- Strategy formulated

Output Format:
- Detailed query analysis
- Extracted intent and requirements
- Recommended strategy
- Enriched context for planning
- Handoff recommendation with reasoning`,

    handoffTriggers: [
      {
        condition: 'Analysis complete, ready for planning',
        targetAgent: 'planner',
        evaluate: (ctx) => {
          const analysis = ctx.sharedState.analysis;
          return analysis && analysis.intent && analysis.strategy;
        },
      },
    ],
  },
};

/**
 * Multi-Agent Orchestrator
 */
export class MultiAgentOrchestrator {
  private context: AgentContext;
  private maxHandoffs: number;

  constructor(config: { maxHandoffs?: number } = {}) {
    this.maxHandoffs = config.maxHandoffs || 10;
    this.context = this.createInitialContext();
  }

  private createInitialContext(): AgentContext {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      originalQuery: '',
      currentAgent: 'planner',
      history: [],
      sharedState: {},
      messages: [],
      executionMetrics: {
        totalSteps: 0,
        successfulSteps: 0,
        errors: 0,
        duration: 0,
      },
    };
  }

  /**
   * Execute multi-agent workflow
   */
  async execute(
    query: string,
    config: {
      initialAgent?: string;
      agents: Record<string, any>; // Agent implementations
      onAgentChange?: (handoff: AgentHandoff) => void;
      onAgentComplete?: (agent: string, result: any) => void;
    }
  ): Promise<MultiAgentResult> {
    const startTime = Date.now();

    // Initialize context
    this.context.originalQuery = query;
    this.context.currentAgent = config.initialAgent || 'planner';

    const agentSequence: string[] = [this.context.currentAgent];
    let handoffCount = 0;

    try {
      while (handoffCount < this.maxHandoffs) {
        const currentAgentName = this.context.currentAgent;
        const agentRole = AgentRoles[currentAgentName];

        if (!agentRole) {
          throw new Error(`Unknown agent role: ${currentAgentName}`);
        }

        // Execute current agent
        const agentImpl = config.agents[currentAgentName];
        if (!agentImpl) {
          throw new Error(`Agent implementation not found: ${currentAgentName}`);
        }

        const agentStartTime = Date.now();
        const result = await agentImpl.run(this.context);
        const agentDuration = Date.now() - agentStartTime;

        // Record history
        this.context.history.push({
          agent: currentAgentName,
          action: 'execute',
          input: { query, context: { ...this.context.sharedState } },
          output: result,
          timestamp: agentStartTime,
          duration: agentDuration,
        });

        // Update shared state
        this.context.sharedState = {
          ...this.context.sharedState,
          [`${currentAgentName}_result`]: result,
        };

        // Notify completion
        if (config.onAgentComplete) {
          config.onAgentComplete(currentAgentName, result);
        }

        // Check for handoff
        const handoff = this.evaluateHandoff(agentRole);

        if (!handoff) {
          // No handoff - workflow complete
          const duration = Date.now() - startTime;
          return {
            success: true,
            finalAgent: currentAgentName,
            agentSequence,
            context: this.context,
            result,
            duration,
          };
        }

        // Perform handoff
        this.context.currentAgent = handoff.toAgent;
        agentSequence.push(handoff.toAgent);
        handoffCount++;

        // Record handoff in history
        this.context.history.push({
          agent: currentAgentName,
          action: 'handoff',
          input: { toAgent: handoff.toAgent, reason: handoff.reason },
          output: null,
          timestamp: Date.now(),
          duration: 0,
          handoffReason: handoff.reason,
        });

        // Notify handoff
        if (config.onAgentChange) {
          config.onAgentChange(handoff);
        }
      }

      throw new Error(`Maximum handoffs reached (${this.maxHandoffs})`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        finalAgent: this.context.currentAgent,
        agentSequence,
        context: this.context,
        result: { error: error.message },
        duration,
      };
    }
  }

  /**
   * Evaluate if handoff should occur
   */
  private evaluateHandoff(agentRole: AgentRole): AgentHandoff | null {
    const triggers = agentRole.handoffTriggers || [];

    for (const trigger of triggers) {
      if (trigger.evaluate(this.context)) {
        return {
          fromAgent: agentRole.name,
          toAgent: trigger.targetAgent,
          reason: trigger.condition,
          context: this.context,
        };
      }
    }

    return null; // No handoff needed
  }

  /**
   * Get current context
   */
  getContext(): AgentContext {
    return this.context;
  }

  /**
   * Update shared state
   */
  updateSharedState(updates: Record<string, any>): void {
    this.context.sharedState = {
      ...this.context.sharedState,
      ...updates,
    };
  }
}

/**
 * Agent handoff schema for structured responses
 */
export const AgentHandoffSchema = z.object({
  shouldHandoff: z.boolean(),
  targetAgent: z.enum(['planner', 'executor', 'evaluator', 'summarizer', 'recovery', 'analyst']).optional(),
  reason: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
});

/**
 * Create agent with handoff capability
 */
export function createAgentWithHandoff(
  role: AgentRole,
  implementation: {
    run: (context: AgentContext) => Promise<any>;
  }
) {
  return {
    role,
    async run(context: AgentContext) {
      // Execute agent logic
      const result = await implementation.run(context);

      // Return result with handoff decision
      return {
        ...result,
        agentName: role.name,
        timestamp: Date.now(),
      };
    },
  };
}
