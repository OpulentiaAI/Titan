// Page Context Step - Retrieves current page state
// 'use step' directive makes this a durable, resumable step

import type { PageContextStepOutput } from '../schemas/workflow-schemas';
import { contextDebug } from '../lib/debug-logger';

/**
 * Page Context Step - Gets current page state
 * Retrieves page context (title, text, links, forms, viewport) for planning and execution
 */
export async function pageContextStep(
  executeTool: (toolName: string, params: any) => Promise<any>
): Promise<PageContextStepOutput> {
  "use step"; // Makes this a durable step with retry logic
  
  const startTime = Date.now();
  const contextTimer = contextDebug.time('Page Context Step');
  
  contextDebug.info('Starting page context retrieval');
  
  try {
    contextDebug.debug('Calling getPageContext tool');
    const res = await executeTool('getPageContext', {});
    const duration = Date.now() - startTime;
    contextTimer();
    
    contextDebug.info('Page context retrieved successfully', {
      duration,
      url: res?.url,
      title: res?.title,
      textLength: res?.text?.length || res?.textContent?.length || 0,
      linkCount: res?.links?.length || 0,
      formCount: res?.forms?.length || 0,
      hasViewport: !!res?.viewport,
    });
    
    
    const output: PageContextStepOutput = {
      pageContext: {
        url: res?.url || '',
        title: res?.title || '',
        text: res?.text || res?.textContent || '',
        links: res?.links || [],
        forms: res?.forms || [],
        viewport: res?.viewport || { width: 1280, height: 720 },
      },
      duration,
      success: true,
    };
    
    // Validate output
    const { PageContextStepOutputSchema } = await import('../schemas/workflow-schemas');
    return PageContextStepOutputSchema.parse(output);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    contextTimer();
    contextDebug.error('Page context retrieval failed', error, duration);
    
    // Return minimal context on failure
    return {
      pageContext: {
        url: '',
        title: '',
        text: '',
        links: [],
        forms: [],
        viewport: { width: 1280, height: 720 },
      },
      duration,
      success: false,
    };
  }
}

