// Planning Step - Generates execution plan using GEPA-inspired reflection
// 'use step' directive makes this a durable, resumable step

import { z } from 'zod';
import type { PlanningStepOutput, BrowserAutomationWorkflowInput } from '../schemas/workflow-schemas';
import type { PlanningResult } from '../types';
import { logEvent, logStepProgress } from '../lib/braintrust';
import { planningDebug } from '../lib/debug-logger';

/**
 * Planning Step - Mandatory GEPA-inspired planning evaluator
 * Generates structured execution plan for browser automation
 */
export async function planningStep(
  input: BrowserAutomationWorkflowInput
): Promise<PlanningStepOutput> {
  "use step"; // Makes this a durable step with retry logic
  
const startTime = Date.now();
const planningTimer = planningDebug.time('Planning Step');
   
   planningDebug.info('Starting planning step', {
     query: input.userQuery,
     queryLength: input.userQuery.length,
     provider: input.settings.provider,
     model: input.settings.model,
     hasInitialContext: !!input.initialContext,
     currentUrl: input.initialContext?.currentUrl,
   });
   
   logEvent('planning_step_start', {
     query_length: input.userQuery.length,
     provider: input.settings.provider,
     model: input.settings.model,
     has_initial_context: !!input.initialContext,
     current_url: input.initialContext?.currentUrl,
   });
  
   try {
     planningDebug.debug('Loading planning utilities', {
       cacheUtils: 'generateExecutionPlanWithTelemetryCached',
       planner: 'formatPlanAsInstructions',
     });
     
     // Use cached version for better performance
     const { generateExecutionPlanWithTelemetryCached } = await import('../lib/cache-utils');
     const { formatPlanAsInstructions } = await import('../planner');
     
     planningDebug.debug('Calling planning function', {
       hasCacheUtils: !!generateExecutionPlanWithTelemetryCached,
       hasFormatter: !!formatPlanAsInstructions,
     });

     // cached() returns a function that can be called directly
     planningDebug.debug('Calling generateExecutionPlanWithTelemetryCached', {
       hasApiKey: !!input.settings.apiKey,
       apiKeyLength: input.settings.apiKey?.length || 0,
       model: input.settings.model,
       provider: input.settings.provider,
     });
     
     const cachedResult = await generateExecutionPlanWithTelemetryCached({
       userQuery: input.userQuery,
       currentUrl: input.initialContext?.currentUrl,
       pageContext: input.initialContext?.pageContext,
       provider: input.settings.provider,
       apiKey: input.settings.apiKey,
       model: input.settings.model,
       braintrustApiKey: input.settings.braintrustApiKey,
     });

     planningDebug.debug('Cached result received', {
       cachedResultType: typeof cachedResult,
       cachedResultKeys: cachedResult ? Object.keys(cachedResult) : [],
     });

     // Handle potential async iterable result from cached tool
     const planningResult: PlanningResult = cachedResult as PlanningResult;
    
     planningDebug.debug('Planning result received', {
       hasResult: !!planningResult,
       hasPlan: !!planningResult?.plan,
       hasSteps: !!planningResult?.plan?.steps,
       stepsIsArray: Array.isArray(planningResult?.plan?.steps),
       stepCount: planningResult?.plan?.steps?.length || 0,
       confidence: planningResult?.confidence,
       complexity: planningResult?.plan?.complexityScore,
       hasOptimizedQuery: !!planningResult?.optimizedQuery,
       gapCount: planningResult?.gaps?.length || 0,
     });
     
    if (!planningResult || !planningResult.plan || !planningResult.plan.steps || planningResult.plan.steps.length === 0) {
      planningDebug.error('Planning returned empty or invalid result', {
        planningResult: planningResult,
        hasPlan: !!planningResult?.plan,
        hasSteps: !!planningResult?.plan?.steps,
        stepsLength: planningResult?.plan?.steps?.length || 0,
        hasApiKey: !!input.settings.apiKey,
        provider: input.settings.provider,
      });

      // If we have an API key but still got empty steps, this indicates a real planning failure
      if (input.settings.apiKey) {
        throw new Error(`Planning returned empty plan despite having API key - this indicates a model or API failure.`);
      } else {
        // No API key available, throw error to trigger fallback
        throw new Error(`Planning requires API key but none provided.`);
      }
    }
    
const duration = Date.now() - startTime;
     
     // Format plan as instructions
     let planningBlock = formatPlanAsInstructions(planningResult.plan);
     
     planningDebug.debug('Plan formatted as instructions', {
       blockLength: planningBlock.length,
     });
     
     if (planningResult.optimizedQuery && planningResult.optimizedQuery !== input.userQuery) {
       logEvent('query_optimized', {
         original_query: input.userQuery,
         optimized_query: planningResult.optimizedQuery,
         optimization_improvement: planningResult.optimizedQuery.length !== input.userQuery.length,
       });
       planningBlock += `\n\n**Optimized Query:** ${planningResult.optimizedQuery}`;
     }
     
     if (planningResult.gaps?.length) {
       logEvent('planning_gaps_detected', {
         gap_count: planningResult.gaps.length,
         gaps: planningResult.gaps,
       });
       planningBlock += `\n\n**Information Gaps:** ${planningResult.gaps.join('; ')}`;
     }
     
     planningBlock += `\n\n**Plan Confidence:** ${Math.round(planningResult.confidence * 100)}%`;
     
     planningTimer();
     planningDebug.info('Planning step completed successfully', {
       duration,
       stepCount: planningResult.plan.steps.length,
       complexity: Math.round(planningResult.plan.complexityScore * 100),
       confidence: Math.round(planningResult.confidence * 100),
       criticalPaths: planningResult.plan.criticalPaths.length,
       estimatedSteps: planningResult.plan.estimatedSteps,
       potentialIssues: planningResult.plan.potentialIssues.length,
       optimizations: planningResult.plan.optimizations.length,
       wasOptimized: !!planningResult.optimizedQuery,
       hasGaps: !!planningResult.gaps?.length,
     });
     
     logEvent('planning_step_complete', {
       duration,
       plan_summary: {
         steps: planningResult.plan.steps.length,
         complexity: Math.round(planningResult.plan.complexityScore * 100),
         confidence: Math.round(planningResult.confidence * 100),
         critical_paths: planningResult.plan.criticalPaths.length,
         estimated_steps: planningResult.plan.estimatedSteps,
         potential_issues: planningResult.plan.potentialIssues.length,
         optimizations: planningResult.plan.optimizations.length,
       },
       was_optimized: !!planningResult.optimizedQuery,
       has_gaps: !!planningResult.gaps?.length,
     });
    
    const output: PlanningStepOutput = {
      plan: {
        objective: planningResult.plan.objective,
        approach: planningResult.plan.approach,
        steps: planningResult.plan.steps.map(s => ({
          step: s.step,
          action: s.action,
          target: s.target,
          reasoning: s.reasoning,
          expectedOutcome: s.expectedOutcome,
          validationCriteria: s.validationCriteria,
          fallbackAction: s.fallbackAction,
        })),
        criticalPaths: planningResult.plan.criticalPaths,
        estimatedSteps: planningResult.plan.estimatedSteps,
        complexityScore: planningResult.plan.complexityScore,
        potentialIssues: planningResult.plan.potentialIssues,
        optimizations: planningResult.plan.optimizations,
      },
      optimizedQuery: planningResult.optimizedQuery,
      gaps: planningResult.gaps,
      confidence: planningResult.confidence,
      planningBlock,
      duration,
      success: true,
    };
    
    // Validate output against schema
    const { PlanningStepOutputSchema } = await import('../schemas/workflow-schemas');
    return PlanningStepOutputSchema.parse(output);
    
} catch (error: any) {
     const duration = Date.now() - startTime;
     
     logEvent('planning_step_error', {
       duration,
       error_type: error?.name || typeof error,
       error_message: error?.message || String(error),
       using_fallback: true,
     });
     
     // Return fallback plan
     const fallbackPlan: PlanningStepOutput = {
       plan: {
         objective: input.userQuery,
         approach: 'Sequential execution with validation',
         steps: [{
           step: 1,
           action: 'getPageContext',
           target: 'current_page',
           reasoning: 'Need to understand current page state before proceeding',
           expectedOutcome: 'Page context retrieved',
         }],
         criticalPaths: [1],
         estimatedSteps: 1,
         complexityScore: 0.5,
         potentialIssues: ['Planning generation failed, using fallback'],
         optimizations: [],
       },
       confidence: 0.3,
       planningBlock: `# Basic Execution Plan\n\n**Objective:** ${input.userQuery}\n\n**Approach:** Sequential execution with validation\n\n**Note:** Detailed planning failed, proceeding with adaptive execution.`,
       duration,
     };
     
     return fallbackPlan;
   }
}

