// AI SDK 6 Summarizer - Uses tool/agent calls with You.com Search API
// Replaces You.com Advanced Agent with more reliable AI SDK implementation

import { generateText, streamText, tool } from 'ai';
import { z } from 'zod';

const LOG_PREFIX = '🤖 [AI-SDK-SUMMARIZER]';

interface AiSdkSummarizerInput {
  objective: string;
  trajectory: string;
  outcome: string;
  model: any; // AI SDK model instance
  youApiKey?: string; // Optional - for You.com search enhancement
  enableStreaming?: boolean; // Enable streaming for real-time UI updates
  updateLastMessage?: (updater: (msg: any) => any) => void; // Callback for streaming updates
}

interface AiSdkSummarizerOutput {
  summary: string;
  duration: number;
  success: boolean;
  searchResults?: any[];
}

/**
 * You.com Search Tool - Direct API calls via AI SDK tool
 */
const youSearchTool = (youApiKey: string) => tool({
  description: 'Search the web using You.com API to find relevant, up-to-date information',
  parameters: z.object({
    query: z.string().describe('Search query'),
    num_results: z.number().optional().default(3).describe('Number of results to return (1-10)'),
  }),
  execute: async ({ query, num_results }) => {
    console.log(`${LOG_PREFIX} 🔍 You.com Search: "${query}"`);
    
    try {
      const response = await fetch('https://api.you.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': youApiKey,
        },
        body: JSON.stringify({
          query,
          num_web_results: num_results,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${LOG_PREFIX} ❌ You.com search failed: HTTP ${response.status}`);
        throw new Error(`You.com search failed: HTTP ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      console.log(`${LOG_PREFIX} ✅ Found ${results.length} results`);
      
      return {
        success: true,
        results: results.map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.snippet || r.description || '',
        })),
        count: results.length,
      };
    } catch (error: any) {
      console.error(`${LOG_PREFIX} ❌ Search error:`, error?.message);
      return {
        success: false,
        error: error?.message || String(error),
        results: [],
        count: 0,
      };
    }
  },
});

/**
 * Summarize using AI SDK 6 with tool calls
 * More reliable than You.com Advanced Agent - uses direct API calls
 */
export async function summarizeWithAiSdk(
  input: AiSdkSummarizerInput
): Promise<AiSdkSummarizerOutput> {
  const startTime = Date.now();
  
  console.log(`${LOG_PREFIX} Starting AI SDK summarization...`);
  console.log(`${LOG_PREFIX} Has You.com API: ${!!input.youApiKey}`);
  
  try {
    // Build tools array - include You.com search if API key available
    const tools: Record<string, any> = {};
    const searchResults: any[] = [];
    
    if (input.youApiKey) {
      tools.searchWeb = youSearchTool(input.youApiKey);
    }
    
    // Build comprehensive prompt
    const systemPrompt = `You are an expert browser automation analyst. Your task is to:
1. Analyze the execution trajectory
2. Assess whether the objective was achieved
3. Provide actionable next steps

${input.youApiKey ? 'You have access to web search via the searchWeb tool. Use it to enhance your analysis with current information when relevant.' : ''}

Format your response in clear markdown with these sections:
- ## Summary (2-3 sentences)
- ## Goal Assessment (achieved/partially achieved/not achieved with reasoning)
- ## Key Findings (bullet points)
- ## Recommended Next Steps (3 specific actions)

Be concise and actionable.`;

    const userPrompt = `Analyze this browser automation execution:

**Objective:**
${input.objective}

**Execution Trajectory:**
${input.trajectory}

**Final Outcome:**
${input.outcome}

Provide your analysis following the format specified in the system prompt.`;

    console.log(`${LOG_PREFIX} Calling ${input.enableStreaming ? 'streamText' : 'generateText'} with ${Object.keys(tools).length} tools...`);
    
    // Generate summary with tool access
    if (input.enableStreaming && input.updateLastMessage) {
      // Streaming path for real-time UI updates
      console.log(`${LOG_PREFIX} Using streaming mode for real-time updates`);
      
      let streamedText = '';
      const stream = await streamText({
        model: input.model,
        system: systemPrompt,
        prompt: userPrompt,
        tools,
        maxTokens: 600,
        temperature: 0.7,
        maxSteps: 3,
      });
      
      // Stream the response and update UI
      for await (const chunk of stream.textStream) {
        streamedText += chunk;
        
        // Update UI with accumulated text
        if (input.updateLastMessage) {
          input.updateLastMessage((msg: any) => ({
            ...msg,
            content: msg.role === 'assistant' 
              ? `---\n## Summary & Next Steps\n\n${streamedText}`
              : msg.content
          }));
        }
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`${LOG_PREFIX} ✅ Streaming complete in ${duration}ms`);
      console.log(`${LOG_PREFIX} Text length: ${streamedText.length} chars`);
      
      return {
        summary: streamedText,
        duration,
        success: true,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
      };
    } else {
      // Non-streaming path
    const result = await generateText({
      model: input.model,
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      maxTokens: 600,
      temperature: 0.7,
      maxSteps: 3, // Allow up to 3 tool calls for research
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`${LOG_PREFIX} ✅ Generation complete in ${duration}ms`);
    console.log(`${LOG_PREFIX} Text length: ${result.text?.length || 0} chars`);
    console.log(`${LOG_PREFIX} Tool calls: ${result.steps?.length || 0}`);
    
    // Extract search results if any
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const call of step.toolCalls) {
            if (call.toolName === 'searchWeb' && call.result) {
              searchResults.push(...(call.result.results || []));
            }
          }
        }
      }
    }
    
    return {
      summary: result.text || '',
      duration,
      success: true,
      searchResults: searchResults.length > 0 ? searchResults : undefined,
    };
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`${LOG_PREFIX} ❌ AI SDK summarization failed:`, error?.message);
    
    return {
      summary: '',
      duration,
      success: false,
    };
  }
}

/**
 * Fallback: Simple summarization without tools
 */
export async function summarizeWithoutTools(
  input: AiSdkSummarizerInput
): Promise<AiSdkSummarizerOutput> {
  const startTime = Date.now();
  
  console.log(`${LOG_PREFIX} Using simple summarization (no tools)...`);
  
  try {
    const result = await generateText({
      model: input.model,
      system: 'You are a browser automation analyst. Provide concise, actionable summaries.',
      prompt: `Summarize this execution:

**Objective:** ${input.objective}
**Trajectory:** ${input.trajectory}
**Outcome:** ${input.outcome}

Provide: Summary (2-3 sentences), Goal assessment, and 3 next steps.`,
      maxTokens: 400,
      temperature: 0.7,
    });
    
    const duration = Date.now() - startTime;
    
    return {
      summary: result.text || '',
      duration,
      success: true,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`${LOG_PREFIX} ❌ Simple summarization failed:`, error?.message);
    
    return {
      summary: '',
      duration,
      success: false,
    };
  }
}

