// You.com Advanced Agent (Beta) client with streaming support
// Based on: https://documentation.you.com/developer-resources/tutorials/advanced-agent/stream-response

export interface YouAdvancedAgentOptions {
  verbosity?: 'low' | 'medium' | 'high';
  maxWorkflowSteps?: number;
  store?: boolean;
  tools?: Array<{
    type: 'research' | 'compute';
    search_effort?: 'low' | 'medium' | 'high';
    report_verbosity?: 'low' | 'medium' | 'high';
  }>;
}

export interface YouAdvancedAgentStreamOptions extends YouAdvancedAgentOptions {
  stream: true;
  onDelta?: (delta: string) => void;
  onSearchResults?: (results: any[]) => void;
  onError?: (error: Error) => void;
}

export interface YouAdvancedAgentResponse {
  output: string;
  searchResults?: any[];
  metadata?: {
    duration?: number;
    steps?: number;
  };
}

/**
 * Run You.com Advanced Agent with streaming support
 * Based on: https://documentation.you.com/developer-resources/tutorials/advanced-agent/stream-response
 */
export async function runYouAdvancedAgentStream(
  apiToken: string,
  input: string,
  opts: YouAdvancedAgentStreamOptions
): Promise<YouAdvancedAgentResponse> {
  const BASE_URL = 'https://api.you.com';
  const url = `${BASE_URL}/v1/agents/runs`;

  const payload: any = {
    agent: 'advanced',
    input,
    stream: true,
    store: opts.store ?? false,
  };

  if (opts.verbosity) payload.verbosity = opts.verbosity;
  if (opts.maxWorkflowSteps) {
    payload.workflow_config = { max_workflow_steps: opts.maxWorkflowSteps };
  }
  if (opts.tools) {
    payload.tools = opts.tools;
  } else {
    // Default tools if not specified
    payload.tools = [
      {
        type: 'research',
        search_effort: 'medium',
        report_verbosity: 'medium',
      },
      {
        type: 'compute',
      },
    ];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`You Advanced Agent failed: ${response.status} ${response.statusText} ${text}`);
    opts.onError?.(error);
    throw error;
  }

  // Handle Server-Sent Events (SSE) stream
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }

  const decoder = new TextDecoder();
  const responseDeltas: string[] = [];
  let searchResults: any[] | null = null;
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const eventData = JSON.parse(data);
            
            // Handle different event types
            if (eventData.event === 'response.output_content.full') {
              const content = eventData.response;
              if (content?.type === 'web_search.results' && Array.isArray(content.full)) {
                searchResults = content.full;
                opts.onSearchResults?.(searchResults);
              }
            } else if (eventData.event === 'response.output_text.delta') {
              const delta = eventData.response?.delta || '';
              if (delta) {
                responseDeltas.push(delta);
                opts.onDelta?.(delta);
              }
            }
          } catch (e) {
            // Skip malformed JSON
            console.warn('Failed to parse SSE event:', e);
          }
        } else if (line.startsWith('event: ')) {
          // Event type (e.g., "event: response.output_text.delta")
          // We handle this in the data parsing above
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const fullResponse = responseDeltas.join('');

  return {
    output: fullResponse,
    searchResults: searchResults || undefined,
    metadata: {
      steps: responseDeltas.length,
    },
  };
}

/**
 * Run You.com Advanced Agent (non-streaming, backward compatible)
 */
export async function runYouAdvancedAgentSummary(
  apiToken: string,
  input: string,
  opts?: { verbosity?: 'medium' | 'high'; maxWorkflowSteps?: number }
): Promise<string> {
  const body: any = {
    agent: 'advanced',
    input,
    stream: false,
  };
  if (opts?.verbosity) body.verbosity = opts.verbosity;
  if (opts?.maxWorkflowSteps) body.workflow_config = { max_workflow_steps: opts.maxWorkflowSteps };

  const res = await fetch('https://api.you.com/v1/agents/runs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const errorInfo = await parseYouApiError(res, text);
    throw new Error(`You Advanced Agent failed: ${errorInfo.message}`);
  }

  const json: any = await res.json();
  const out = json?.output;
  if (Array.isArray(out) && out.length) {
    // prefer text field
    const text = out.map((o: any) => o?.text).filter(Boolean).join('\n\n');
    if (text) return text;
  }
  return JSON.stringify(json);
}

/**
 * Simple You.com search-based summarization (fallback when agents API is not available)
 * Uses the basic search API instead of the agents endpoint
 */
export async function runYouSearchSummary(
  apiToken: string,
  query: string,
  opts?: { maxResults?: number }
): Promise<string> {
  const BASE_URL = 'https://api.ydc-index.io';
  const url = `${BASE_URL}/v1/search?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': apiToken,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`You.com search failed: ${response.status} ${response.statusText} ${text}`);
    throw error;
  }

  const json: any = await response.json();

  // Extract and summarize search results
  const results = json.results?.web || [];
  if (results.length === 0) {
    return 'No search results found for summarization.';
  }

  // Create a simple summary from the top results
  const summary = results.slice(0, 3).map((result: any, index: number) =>
    `${index + 1}. ${result.title || 'Untitled'}: ${result.description || result.snippets?.[0] || 'No description'}`
  ).join('\n\n');

  return `Based on web search results:\n\n${summary}`;
}

/**
 * Parse You.com API errors
 * Based on: https://documentation.you.com/developer-resources/errors
 */
async function parseYouApiError(response: Response, text: string): Promise<{ message: string; code?: string }> {
  try {
    const json = JSON.parse(text);
    return {
      message: json.error?.message || json.message || `HTTP ${response.status}`,
      code: json.error?.code,
    };
  } catch {
    return {
      message: text || `HTTP ${response.status} ${response.statusText}`,
    };
  }
}
