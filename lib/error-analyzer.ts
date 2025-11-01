// Error Analyzer - Adapted from Jina DeepResearch
// Analyzes workflow execution failures to identify root causes and improvements

import { z } from 'zod';

export interface ErrorAnalysisResponse {
  recap: string; // Summarize key actions chronologically, highlight patterns
  blame: string; // Point to specific steps or patterns that led to failure
  improvement: string; // Provide actionable suggestions for better outcomes
}

const ErrorAnalysisSchema = z.object({
  recap: z.string().describe('Summarize key actions chronologically, highlight patterns, and identify where the process started to go wrong'),
  blame: z.string().describe('Point to specific steps or patterns that led to the inadequate answer'),
  improvement: z.string().describe('Provide actionable suggestions that could have led to a better outcome'),
});

/**
 * Analyze workflow execution steps to identify failures and improvements
 * Adapted from Jina DeepResearch error-analyzer.ts methodology
 */
export async function analyzeExecutionFailure(
  diaryContext: string[],
  originalQuery: string,
  finalAnswer: string,
  evaluatorFeedback?: string,
  opts: {
    provider: 'google' | 'gateway';
    apiKey: string;
    model?: string;
    braintrustApiKey?: string;
  }
): Promise<ErrorAnalysisResponse> {
  const { getWrappedAI } = await import('./ai-wrapped');
  const aiModule = await getWrappedAI(opts.braintrustApiKey);
  const { generateObject } = aiModule;

  // Pick fast default model for latency
  let model: any;
  if (opts.provider === 'gateway') {
    const { createGateway } = await import('@ai-sdk/gateway');
    const client = createGateway({ apiKey: opts.apiKey });
    model = client(opts.model || 'google:gemini-2.5-flash');
  } else {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const client = createGoogleGenerativeAI({ apiKey: opts.apiKey });
    model = client(opts.model || 'gemini-2.5-flash');
  }

  const systemPrompt = `You are an expert at analyzing browser automation and reasoning processes. Your task is to analyze the given sequence of steps and identify what went wrong in the execution process.

<rules>
1. The sequence of actions taken
2. The effectiveness of each step
3. The logic between consecutive steps
4. Alternative approaches that could have been taken
5. Signs of getting stuck in repetitive patterns
6. Whether the final answer matches the accumulated information

Analyze the steps and provide detailed feedback following these guidelines:
- In the recap: Summarize key actions chronologically, highlight patterns, and identify where the process started to go wrong
- In the blame: Point to specific steps or patterns that led to the inadequate answer
- In the improvement: Provide actionable suggestions that could have led to a better outcome
</rules>

<example>
<input>
<steps>

At step 1, you took the **navigate** action and navigated to: "https://example.com".
You found the page loaded successfully.

At step 2, you took the **getPageContext** action.
You found some useful information on the page and added it to your knowledge for future reference.

At step 3, you took the **click** action on selector: "button.submit".
But the selector was not found on the page.
You decided to try a different approach.

At step 4, you took the **click** action on selector: "button.submit".
But the selector was still not found.
You decided to try a different approach.

At step 5, you took **answer** action but evaluator thinks it is not a good answer:

</steps>

Original question: 
Submit the form on the page

Your answer: 
Unable to find the submit button. The form could not be submitted.

The evaluator thinks your answer is bad because: 
The answer is not definitive and fails to complete the requested action. More exploration of the page structure is needed.
</input>

<output>
{
  "recap": "The execution process consisted of 5 steps with navigation, context retrieval, and multiple click attempts. The initial navigation and context retrieval succeeded (steps 1-2). When attempting to click the submit button (steps 3-4), the process encountered repeated failures with the same selector. The process showed signs of repetition without adapting the strategy - trying the same selector twice instead of using getPageContext() to find alternative selectors or exploring the page structure more thoroughly.",
  
  "blame": "The root cause of failure was getting stuck in a repetitive action pattern without adapting the strategy. Steps 3-4 repeated the same click action with the same selector, ignoring the fact that getPageContext() from step 2 could have been used to find alternative selectors. Additionally, the process didn't attempt to explore form structure, use alternative selectors, or verify page state before attempting the click.",
  
  "improvement": "1. Avoid repeating identical actions and implement a strategy to track previously attempted selectors. 2. When a selector fails, use getPageContext() to find alternative selectors (e.g., button[type='submit'], form button, input[type='submit']). 3. Verify page state before attempting actions - check if form elements exist and are visible. 4. Consider exploring form structure through getPageContext() to understand available form elements and their attributes. 5. If direct action fails, try indirect approaches like submitting via form submission or using keyboard navigation."
}
</output>
</example>`;

  const userPrompt = [
    '<steps>',
    ...diaryContext,
    '</steps>',
    '',
    `Original question:`,
    originalQuery,
    '',
    `Your answer:`,
    finalAnswer,
    '',
    evaluatorFeedback ? `The evaluator thinks your answer is bad because: ${evaluatorFeedback}` : 'The execution did not achieve the desired outcome.',
    '',
    'Analyze the execution steps and provide detailed feedback following the schema.',
  ].join('\n');

  try {
    const result = await generateObject({
      model,
      schema: ErrorAnalysisSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.object as ErrorAnalysisResponse;
  } catch (error: any) {
    console.error('❌ [Error Analyzer] Analysis failed:', error?.message || String(error));
    
    // Fallback to simple analysis
    return {
      recap: `Execution consisted of ${diaryContext.length} steps. ${evaluatorFeedback || 'The desired outcome was not achieved.'}`,
      blame: 'Unable to analyze root cause due to analysis failure.',
      improvement: 'Review execution steps manually and identify patterns that led to failure.',
    };
  }
}

