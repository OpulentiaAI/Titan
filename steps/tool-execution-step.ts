// Tool Execution Step - Executes individual browser tools
// 'use step' directive makes this a durable, resumable step with built-in retries

import type { ToolExecutionStepOutput } from '../schemas/workflow-schemas';
import { logEvent, logToolExecution } from '../lib/braintrust.ts';

/**
 * Tool Execution Step - Executes a single browser tool
 * Has built-in retry logic and error handling
 */
export async function toolExecutionStep(
  toolName: string,
  toolArgs: Record<string, any>,
  executeTool: (toolName: string, params: any) => Promise<any>,
  enrichToolResponse: (res: any, toolName: string) => Promise<any>
): Promise<ToolExecutionStepOutput> {
  "use step"; // Makes this a durable step with automatic retries
  
const startTime = Date.now();
   
   logToolExecution(toolName, 'start', {
     args: toolArgs,
     arg_count: Object.keys(toolArgs).length,
     arg_types: Object.keys(toolArgs).reduce((acc, key) => ({
       ...acc,
       [key]: typeof toolArgs[key]
     }), {}),
   });
  
try {
     const res = await executeTool(toolName, toolArgs);
     const enriched = await enrichToolResponse(res, toolName);
     const duration = Date.now() - startTime;
     
     logToolExecution(toolName, 'complete', {
       duration,
       success: enriched.success !== false,
       has_result: !!res,
       has_enriched_result: !!enriched,
       enriched_success: enriched.success,
     });
     
     const output: ToolExecutionStepOutput = {
       toolName,
       toolArgs,
       result: res,
       success: enriched.success !== false,
       duration,
       enrichedResult: enriched,
     };
     
     // Validate output
     const { ToolExecutionStepOutputSchema } = await import('../schemas/workflow-schemas');
     return ToolExecutionStepOutputSchema.parse(output);
     
   } catch (error: any) {
     const duration = Date.now() - startTime;
     
     logToolExecution(toolName, 'error', {
       duration,
       error_type: error?.name || typeof error,
       error_message: error?.message || String(error),
     });
     
     return {
       toolName,
       toolArgs,
       result: null,
       success: false,
       duration,
       error: error?.message || String(error),
     };
   }
}