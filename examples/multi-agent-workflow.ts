// Multi-Agent Workflow Example
// Complete integration of multi-agent orchestration with browser automation

import {
  MultiAgentOrchestrator,
  AgentRoles,
  createAgentWithHandoff,
  type AgentContext,
  type AgentHandoff,
} from '../lib/multi-agent-orchestration';
import { planningStep } from '../steps/planning-step';
import { evaluationStep } from '../steps/evaluation-step';
import { summarizationStep } from '../steps/summarization-step';
import type { Message } from '../types';

/**
 * Example 1: Complete Multi-Agent Browser Automation Workflow
 */
export async function multiAgentBrowserAutomation(
  query: string,
  config: {
    model: any;
    tools: Record<string, any>;
    executeTool: (name: string, args: any) => Promise<any>;
    messageWriter: {
      updateLastMessage: (updater: (msg: Message) => Message) => void;
      pushMessage: (msg: Message) => void;
    };
  }
) {
  const orchestrator = new MultiAgentOrchestrator({
    maxHandoffs: 10,
  });

  // Define agent implementations
  const agents = {
    // PLANNER AGENT: Creates execution plan
    planner: createAgentWithHandoff(AgentRoles.planner, {
      async run(context: AgentContext) {
        console.log('🧠 Planner Agent: Creating execution plan...');

        // Use planning step
        const planResult = await planningStep({
          userQuery: context.originalQuery,
          settings: {},
          initialContext: {},
        });

        // Update shared state
        orchestrator.updateSharedState({
          plan: planResult.plan,
          confidence: planResult.confidence,
          complexityScore: planResult.plan.complexityScore || 0,
        });

        // Display plan to user
        config.messageWriter.pushMessage({
          id: `plan-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Planning Complete**\n\n${planResult.plan.steps.length} steps planned with ${planResult.confidence >= 0.8 ? 'high' : 'moderate'} confidence.\n\n**Objective:** ${planResult.plan.objective}\n\n**Approach:** ${planResult.plan.approach}`,
        });

        return planResult;
      },
    }),

    // EXECUTOR AGENT: Executes the plan
    executor: createAgentWithHandoff(AgentRoles.executor, {
      async run(context: AgentContext) {
        console.log('⚡ Executor Agent: Executing plan...');

        const plan = context.sharedState.plan;
        if (!plan) {
          throw new Error('No plan found in shared state');
        }

        const executionResults: any[] = [];
        let completedSteps = 0;
        let errors = 0;

        // Execute each step
        for (const [index, step] of plan.steps.entries()) {
          try {
            console.log(`Executing step ${index + 1}: ${step.action}`);

            // Execute tool
            const result = await config.executeTool(step.action, {
              ...step.target && { target: step.target },
              ...step.coordinates && { ...step.coordinates },
              ...step.key && { key: step.key },
              ...step.keys && { keys: step.keys },
            });

            executionResults.push({
              step: index + 1,
              action: step.action,
              success: true,
              result,
            });

            completedSteps++;

            // Update progress in UI
            config.messageWriter.updateLastMessage((msg) => ({
              ...msg,
              content: `⚡ Executing... ${completedSteps}/${plan.steps.length} steps complete`,
            }));

            // Add small delay between steps
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error: any) {
            console.error(`Step ${index + 1} failed:`, error);

            executionResults.push({
              step: index + 1,
              action: step.action,
              success: false,
              error: error.message,
            });

            errors++;

            // Try fallback if available
            if (step.fallbackAction && errors <= 2) {
              console.log(`Attempting fallback for step ${index + 1}`);
              try {
                const fallbackResult = await config.executeTool(
                  step.fallbackAction.action,
                  {
                    ...step.fallbackAction.target && { target: step.fallbackAction.target },
                    ...step.fallbackAction.coordinates && {
                      ...step.fallbackAction.coordinates,
                    },
                    ...step.fallbackAction.key && { key: step.fallbackAction.key },
                    ...step.fallbackAction.keys && { keys: step.fallbackAction.keys },
                  }
                );

                executionResults.push({
                  step: index + 1,
                  action: step.fallbackAction.action,
                  success: true,
                  result: fallbackResult,
                  isFallback: true,
                });

                completedSteps++;
              } catch (fallbackError) {
                // Fallback also failed - continue to next step
                console.error(`Fallback for step ${index + 1} also failed`);
              }
            }
          }
        }

        // Update shared state
        orchestrator.updateSharedState({
          executionResults,
          completedSteps,
          errors,
        });

        // Update context metrics
        context.executionMetrics.totalSteps = plan.steps.length;
        context.executionMetrics.successfulSteps = completedSteps;
        context.executionMetrics.errors = errors;

        return {
          executionResults,
          completedSteps,
          totalSteps: plan.steps.length,
          successRate: completedSteps / plan.steps.length,
        };
      },
    }),

    // EVALUATOR AGENT: Assesses execution quality
    evaluator: createAgentWithHandoff(AgentRoles.evaluator, {
      async run(context: AgentContext) {
        console.log('🔍 Evaluator Agent: Assessing quality...');

        const plan = context.sharedState.plan;
        const executionResults = context.sharedState.executionResults;

        if (!plan || !executionResults) {
          throw new Error('Missing plan or execution results');
        }

        // Use evaluation step
        const evalResult = await evaluationStep({
          model: config.model,
          executionResult: {
            executionSteps: executionResults,
            fullText: 'Execution completed',
          },
          originalQuery: context.originalQuery,
          plan: plan,
          evaluationCriteria: {
            requiredTools: ['navigate', 'getPageContext'],
            minSuccessRate: 0.7,
            maxErrors: 3,
          },
        });

        // Update shared state
        orchestrator.updateSharedState({
          evaluation: evalResult,
          retryCount: (context.sharedState.retryCount || 0),
        });

        // Display evaluation
        config.messageWriter.pushMessage({
          id: `eval-${Date.now()}`,
          role: 'assistant',
          content: `📊 **Evaluation Result**\n\n**Quality:** ${evalResult.quality.toUpperCase()}\n**Score:** ${(evalResult.score * 100).toFixed(1)}%\n\n${evalResult.shouldProceed ? '✅ Quality criteria met' : '⚠️ Quality below threshold'}`,
        });

        return evalResult;
      },
    }),

    // SUMMARIZER AGENT: Creates final summary
    summarizer: createAgentWithHandoff(AgentRoles.summarizer, {
      async run(context: AgentContext) {
        console.log('📝 Summarizer Agent: Generating summary...');

        const executionResults = context.sharedState.executionResults || [];
        const evaluation = context.sharedState.evaluation;

        // Use summarization step
        const summaryResult = await summarizationStep({
          model: config.model,
          executionTrajectory: executionResults,
          finalText: 'Workflow completed',
          originalQuery: context.originalQuery,
        });

        // Display summary
        config.messageWriter.pushMessage({
          id: `summary-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Workflow Complete**\n\n**Summary:** ${summaryResult.summary}\n\n**Key Actions:**\n${summaryResult.keyActions.map((a: string) => `• ${a}`).join('\n')}\n\n**Outcome:** ${summaryResult.outcome}\n\n**Confidence:** ${(summaryResult.confidence * 100).toFixed(1)}%`,
        });

        return summaryResult;
      },
    }),

    // RECOVERY AGENT: Handles errors
    recovery: createAgentWithHandoff(AgentRoles.recovery, {
      async run(context: AgentContext) {
        console.log('🔧 Recovery Agent: Analyzing errors...');

        const executionResults = context.sharedState.executionResults || [];
        const errors = executionResults.filter((r: any) => !r.success);

        if (errors.length === 0) {
          // No errors to recover from
          return { recovered: true, plan: null };
        }

        // Analyze errors and create recovery plan
        const recoveryPlan = {
          alternatives: errors.map((err: any) => ({
            originalStep: err.step,
            originalAction: err.action,
            alternativeAction: this.suggestAlternative(err.action),
            reason: 'Primary action failed, trying alternative approach',
          })),
          estimatedSuccessRate: 0.6,
        };

        // Update shared state
        orchestrator.updateSharedState({
          recoveryPlan,
          recoveryAttempts: (context.sharedState.recoveryAttempts || 0) + 1,
        });

        // Display recovery plan
        config.messageWriter.pushMessage({
          id: `recovery-${Date.now()}`,
          role: 'assistant',
          content: `🔧 **Recovery Plan**\n\n${errors.length} error(s) detected. Attempting recovery with alternative approaches.`,
        });

        return recoveryPlan;
      },

      suggestAlternative(failedAction: string): string {
        // Simple mapping of actions to alternatives
        const alternatives: Record<string, string> = {
          click: 'pressKey', // Use Enter instead
          type: 'keyCombo', // Use paste instead
          navigate: 'navigate', // Retry navigate
          scroll: 'pressKey', // Use PageDown key
        };

        return alternatives[failedAction] || failedAction;
      },
    }),

    // ANALYST AGENT: Deep query analysis
    analyst: createAgentWithHandoff(AgentRoles.analyst, {
      async run(context: AgentContext) {
        console.log('🔬 Analyst Agent: Performing deep analysis...');

        // Perform analysis (simplified for example)
        const analysis = {
          intent: this.extractIntent(context.originalQuery),
          requirements: this.extractRequirements(context.originalQuery),
          strategy: this.formulateStrategy(context.originalQuery),
          estimatedComplexity: this.estimateComplexity(context.originalQuery),
        };

        // Update shared state
        orchestrator.updateSharedState({
          analysis,
        });

        // Display analysis
        config.messageWriter.pushMessage({
          id: `analysis-${Date.now()}`,
          role: 'assistant',
          content: `🔬 **Query Analysis**\n\n**Intent:** ${analysis.intent}\n\n**Strategy:** ${analysis.strategy}\n\n**Complexity:** ${analysis.estimatedComplexity}`,
        });

        return analysis;
      },

      extractIntent(query: string): string {
        if (query.includes('search') || query.includes('find')) {
          return 'Information retrieval';
        }
        if (query.includes('login') || query.includes('sign in')) {
          return 'Authentication';
        }
        if (query.includes('navigate') || query.includes('go to')) {
          return 'Navigation';
        }
        return 'General task execution';
      },

      extractRequirements(query: string): string[] {
        const requirements: string[] = [];

        if (query.includes('http')) {
          requirements.push('Specific URL provided');
        }
        if (query.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/)) {
          requirements.push('Email address detected');
        }
        if (query.match(/\bpassword\b/i)) {
          requirements.push('Sensitive data handling required');
        }

        return requirements;
      },

      formulateStrategy(query: string): string {
        if (query.length < 50 && !query.includes(' and ')) {
          return 'Direct execution - simple single-step task';
        }
        if (query.split('.').length > 2) {
          return 'Multi-phase execution - complex task with multiple objectives';
        }
        return 'Standard execution - moderate complexity task';
      },

      estimateComplexity(query: string): string {
        const words = query.split(' ').length;
        if (words < 10) return 'Low';
        if (words < 20) return 'Medium';
        return 'High';
      },
    }),
  };

  // Execute multi-agent workflow
  const result = await orchestrator.execute(query, {
    agents,
    onAgentChange: (handoff: AgentHandoff) => {
      console.log(`\n🔀 Agent Handoff: ${handoff.fromAgent} → ${handoff.toAgent}`);
      console.log(`   Reason: ${handoff.reason}\n`);

      config.messageWriter.pushMessage({
        id: `handoff-${Date.now()}`,
        role: 'assistant',
        content: `🔀 **Agent Handoff**\n\n${handoff.fromAgent} → ${handoff.toAgent}\n\n*${handoff.reason}*`,
      });
    },
    onAgentComplete: (agent: string, result: any) => {
      console.log(`✅ ${agent} completed:`, result);
    },
  });

  return result;
}

/**
 * Example 2: Simple Multi-Agent Flow with Manual Agents
 */
export async function simpleMultiAgentExample() {
  const orchestrator = new MultiAgentOrchestrator();

  const result = await orchestrator.execute('Search for AI SDK on GitHub', {
    agents: {
      planner: createAgentWithHandoff(AgentRoles.planner, {
        async run(context) {
          const plan = {
            objective: 'Search for AI SDK on GitHub',
            approach: 'Navigate → search → verify',
            steps: [
              { step: 1, action: 'navigate', target: 'https://github.com' },
              { step: 2, action: 'type', target: 'AI SDK' },
              { step: 3, action: 'pressKey', key: 'Enter' },
            ],
            confidence: 0.9,
          };

          orchestrator.updateSharedState({ plan });
          return plan;
        },
      }),

      executor: createAgentWithHandoff(AgentRoles.executor, {
        async run(context) {
          const plan = context.sharedState.plan;
          console.log('Executing plan:', plan.objective);

          // Simulate execution
          const results = plan.steps.map((step: any) => ({
            step: step.step,
            action: step.action,
            success: true,
          }));

          orchestrator.updateSharedState({
            executionResults: results,
            completedSteps: results.length,
          });

          return { completedSteps: results.length, totalSteps: plan.steps.length };
        },
      }),

      evaluator: createAgentWithHandoff(AgentRoles.evaluator, {
        async run(context) {
          const evaluation = {
            quality: 'excellent' as const,
            score: 0.95,
            shouldProceed: true,
          };

          orchestrator.updateSharedState({ evaluation });
          return evaluation;
        },
      }),

      summarizer: createAgentWithHandoff(AgentRoles.summarizer, {
        async run(context) {
          return {
            summary: 'Successfully searched for AI SDK on GitHub',
            keyActions: ['Navigated to GitHub', 'Performed search', 'Verified results'],
            outcome: 'Task completed successfully',
            confidence: 0.95,
          };
        },
      }),
    },
  });

  console.log('Multi-agent workflow result:', result);
  console.log('Agent sequence:', result.agentSequence.join(' → '));

  return result;
}

/**
 * Example 3: Error Recovery with Multi-Agent
 */
export async function errorRecoveryExample() {
  const orchestrator = new MultiAgentOrchestrator();

  const result = await orchestrator.execute('Navigate to invalid URL', {
    agents: {
      planner: createAgentWithHandoff(AgentRoles.planner, {
        async run() {
          const plan = { objective: 'Navigate', steps: [{ action: 'navigate' }], confidence: 0.8 };
          orchestrator.updateSharedState({ plan });
          return plan;
        },
      }),

      executor: createAgentWithHandoff(AgentRoles.executor, {
        async run(context) {
          // Simulate failure
          orchestrator.updateSharedState({
            executionResults: [{ step: 1, action: 'navigate', success: false }],
            completedSteps: 0,
          });
          context.executionMetrics.errors = 3; // Trigger recovery
          throw new Error('Navigation failed');
        },
      }),

      recovery: createAgentWithHandoff(AgentRoles.recovery, {
        async run() {
          const recoveryPlan = {
            alternatives: [{ alternativeAction: 'retry with different approach' }],
          };
          orchestrator.updateSharedState({ recoveryPlan });
          return recoveryPlan;
        },
      }),

      evaluator: createAgentWithHandoff(AgentRoles.evaluator, {
        async run() {
          return { quality: 'poor', score: 0.3, shouldProceed: false };
        },
      }),
    },
  });

  console.log('Recovery workflow result:', result);
  return result;
}
