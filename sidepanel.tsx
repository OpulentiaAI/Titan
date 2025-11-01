import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Streamdown } from 'streamdown';
import './app.css'; // Import GT America fonts and OKLCH theme
import type { Settings, MCPClient, Message } from './types';
import { GeminiResponseSchema } from './types';
import { stepCountIs } from 'ai';
import { initializeBraintrust } from './lib/braintrust';
import { AIDevtools } from '@ai-sdk-tools/devtools';
import { Provider, useChatMessages, useChatActions } from '@ai-sdk-tools/store';
import { StepDisplay } from './components/StepDisplay';
import { EnhancedStepDisplay } from './components/EnhancedStepDisplay';
import { ToolExecutionDisplay } from './components/ToolExecutionDisplay';
import { PlanningDisplay } from './components/PlanningDisplay';
import { Tool } from './components/ui/tool';
import type { ToolPart } from './components/ui/tool';
import { AgentComposerIntegration } from './components/agents-ui/agent-composer-integration';
import { ReasoningChatForm } from './components/reasoning-chat-form';
import { Reasoning, ReasoningTrigger, ReasoningContent } from './components/ai-elements/reasoning';
import { Response } from './components/ai-elements/response';
import { 
  EnhancedPlanDisplay, 
  EnhancedToolCallDisplay, 
  JSONDisplay,
  StructuredOutput 
} from './components/ui/structured-output';
import {
  PageContextArtifact,
  SummarizationArtifact,
  ErrorAnalysisArtifact,
  ExecutionTrajectoryArtifact,
  WorkflowMetadataArtifact,
  WorkflowOutputArtifact,
} from './components/ui/artifact-views';
import { WorkflowQueue } from './components/ui/workflow-queue';
import { WorkflowTaskList } from './components/ui/workflow-task-list';
import { CodeBlock, CodeBlockCopyButton } from './components/ui/code-block';
import { cn } from './lib/utils';

// Custom component to handle link clicks - opens in new tab
const LinkComponent = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
  const handleLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      chrome.tabs.create({ url: href });
    }
  };

  return (
    <a
      href={href}
      onClick={handleLinkClick}
      style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
      title={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};

// AI Elements Response primitive is used for message content display
// It uses Streamdown internally with proper memoization and streaming support

function ChatSidebar() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'standard' | 'reasoning'>('standard');
  
  // Use @ai-sdk-tools/store for high-performance message management
  // Store works with message-like structures - we'll use type assertion for compatibility
  const messages = useChatMessages<any>() as Message[];
  const actions = useChatActions<any>();
  const { setMessages, pushMessage, replaceMessageById } = actions;
  
  // Helper function to update the last message (common pattern)
  const updateLastMessage = (updater: (msg: Message) => Message) => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      replaceMessageById(lastMsg.id, updater(lastMsg));
    }
  };
  
  // Helper function to append text to last message
  const appendToLastMessage = (text: string) => {
    updateLastMessage((msg) => ({ ...msg, content: msg.content + text }));
  };
  
  const [isLoading, setIsLoading] = useState(false);
  const [browserToolsEnabled, setBrowserToolsEnabled] = useState(false);
  const [showBrowserToolsWarning, setShowBrowserToolsWarning] = useState(false);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [toolExecutions, setToolExecutions] = useState<ToolPart[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mcpClientRef = useRef<MCPClient | null>(null);
  const mcpToolsRef = useRef<Record<string, unknown> | null>(null);
  const listenerAttachedRef = useRef(false);
  const settingsHashRef = useRef('');
  const mcpInitPromiseRef = useRef<Promise<void> | null>(null);
  const composioSessionRef = useRef<{ expiresAt: number } | null>(null);

  // Helper to add tool execution tracking
  const trackToolExecution = (toolName: string, params: any, state: ToolPart['state'], output?: any, error?: string) => {
    const toolPart: ToolPart = {
      type: toolName,
      state,
      input: params,
      output,
      errorText: error,
      toolCallId: `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    
    setToolExecutions(prev => {
      // Update existing tool or add new one
      const existingIndex = prev.findIndex(t => 
        t.type === toolName && 
        JSON.stringify(t.input) === JSON.stringify(params)
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = toolPart;
        return updated;
      }
      
      return [...prev, toolPart];
    });
  };

  const executeTool = async (toolName: string, parameters: any, retryCount = 0): Promise<any> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500; // 1.5 seconds to allow page to load
    
    // Different timeouts for different tool types
    const TOOL_TIMEOUTS: Record<string, number> = {
      screenshot: 10000,    // Screenshots should be fast
      type: 15000,         // Typing might need more time if DOM is slow
      click: 10000,        // Clicks are usually fast
      navigate: 20000,     // Navigation needs time for page load
      getPageContext: 10000,
      scroll: 8000,
      pressKey: 5000,
      keyCombo: 5000,
    };
    
    const TOOL_TIMEOUT = TOOL_TIMEOUTS[toolName] || 30000; // Default 30s
    
    // Track tool execution start
    trackToolExecution(toolName, parameters, 'input-streaming');
    
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let responded = false;
      
      const handleResponse = (response: any) => {
        // Prevent double-response
        if (responded) {
          console.warn(`⚠️ [executeTool] Duplicate response for ${toolName} (ignoring)`);
          return;
        }
        responded = true;
        
        // Clear timeout if response received
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        const errorMsg = response?.error || chrome.runtime.lastError?.message || '';
        const isConnectionError = errorMsg.includes('Receiving end does not exist') || 
                                 errorMsg.includes('Could not establish connection');
        
        if (isConnectionError && retryCount < MAX_RETRIES) {
          console.log(`🔄 [executeTool] Connection error on ${toolName}, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          
          setTimeout(async () => {
            try {
              const result = await executeTool(toolName, parameters, retryCount + 1);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }, RETRY_DELAY);
        } else {
          // Track completion or error
          if (response?.error || errorMsg) {
            trackToolExecution(toolName, parameters, 'output-error', response, errorMsg);
          } else {
            trackToolExecution(toolName, parameters, 'output-available', response);
          }
          
          // Return response as-is (could be success or error)
          resolve(response);
        }
      };
      
      // Set timeout to prevent hanging forever
      timeoutId = setTimeout(() => {
        if (!responded) {
          responded = true;
          const timeoutError = `Tool ${toolName} timed out after ${TOOL_TIMEOUT}ms - content script may be unresponsive`;
          console.error(`❌ [executeTool] ${timeoutError}`);
          trackToolExecution(toolName, parameters, 'output-error', { error: timeoutError }, timeoutError);
          
          // Return error instead of rejecting to allow workflow to continue
          reject(new Error(timeoutError));
        }
      }, TOOL_TIMEOUT);
      
      if (toolName === 'screenshot') {
        chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' }, handleResponse);
      } else if (toolName === 'click') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'click',
          selector: parameters.selector,
          coordinates: parameters.x !== undefined ? { x: parameters.x, y: parameters.y } : undefined
        }, handleResponse);
      } else if (toolName === 'type') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'fill',
          target: parameters.selector,
          value: parameters.text
        }, handleResponse);
      } else if (toolName === 'scroll') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'scroll',
          direction: parameters.direction,
          target: parameters.selector,
          amount: parameters.amount
        }, handleResponse);
      } else if (toolName === 'getPageContext') {
        chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' }, handleResponse);
      } else if (toolName === 'navigate') {
        chrome.runtime.sendMessage({ type: 'NAVIGATE', url: parameters.url }, handleResponse);
      } else if (toolName === 'getBrowserHistory') {
        chrome.runtime.sendMessage({ 
          type: 'GET_HISTORY',
          query: parameters.query,
          maxResults: parameters.maxResults
        }, handleResponse);
      } else if (toolName === 'pressKey') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'press_key',
          key: parameters.key
        }, handleResponse);
      } else if (toolName === 'clearInput') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'clear_input'
        }, handleResponse);
      } else if (toolName === 'keyCombo') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'key_combination',
          keys: parameters.keys
        }, handleResponse);
      } else if (toolName === 'hover') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'hover',
          coordinates: { x: parameters.x, y: parameters.y }
        }, handleResponse);
      } else if (toolName === 'dragDrop') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'drag_drop',
          coordinates: { x: parameters.x, y: parameters.y },
          destination: { x: parameters.destination_x, y: parameters.destination_y }
        }, handleResponse);
      } else {
        reject(new Error(`Unknown tool: ${toolName}`));
      }
    });
  };

  const loadSettings = async (forceRefresh = false) => {
    chrome.storage.local.get(['atlasSettings'], async (result) => {
      if (result.atlasSettings) {
        // MIGRATION: Force update to Google Gemini if using Anthropic models
        let migratedSettings = { ...result.atlasSettings };
        const needsMigration =
          migratedSettings.model?.includes('anthropic') ||
          migratedSettings.model?.includes('claude') ||
          migratedSettings.provider === 'google'; // Also migrate old Google Direct API users

        if (needsMigration) {
          console.log('🔄 [Migration] Updating to Google Gemini via AI Gateway');
          console.log('   Old model:', migratedSettings.model);
          migratedSettings = {
            ...migratedSettings,
            provider: 'gateway',
            model: 'google/gemini-2.5-flash-lite-preview-09-2025',
            computerUseEngine: 'gateway-flash-lite',
          };
          console.log('   New model:', migratedSettings.model);

          // Save migrated settings
          chrome.storage.local.set({ atlasSettings: migratedSettings });
        }

        console.log('🔑 Loaded settings:', {
          provider: migratedSettings.provider,
          model: migratedSettings.model,
          hasApiKey: !!migratedSettings.apiKey,
          apiKeyLength: migratedSettings.apiKey?.length,
          apiKeyPrefix: migratedSettings.apiKey?.substring(0, 10) + '...'
        });
        setSettings(migratedSettings);

        // Initialize Braintrust if API key is provided
        if (migratedSettings.braintrustApiKey) {
          await initializeBraintrust(
            migratedSettings.braintrustApiKey,
            migratedSettings.braintrustProjectName || 'atlas-extension'
          );
          // Initialize wrapped AI SDK with Braintrust
          const { initializeWrappedAI } = await import('./lib/ai-wrapped');
          await initializeWrappedAI(migratedSettings.braintrustApiKey);
        } else {
          // Initialize without Braintrust
          const { initializeWrappedAI } = await import('./lib/ai-wrapped');
          await initializeWrappedAI();
        }

        const settingsHash = JSON.stringify(migratedSettings);
        const hasSettingsChanged = forceRefresh || settingsHash !== settingsHashRef.current;

        if (hasSettingsChanged && migratedSettings.composioApiKey) {
          settingsHashRef.current = settingsHash;

          try {
            const { initializeComposioToolRouter } = await import('./tools');
            const toolRouterSession = await initializeComposioToolRouter(
              migratedSettings.composioApiKey
            );

            composioSessionRef.current = { expiresAt: toolRouterSession.expiresAt };

            chrome.storage.local.set({
              composioSessionId: toolRouterSession.sessionId,
              composioChatMcpUrl: toolRouterSession.chatSessionMcpUrl,
              composioToolRouterMcpUrl: toolRouterSession.toolRouterMcpUrl,
            });
          } catch (error) {
            console.error('Failed to initialize Composio:', error);
          }
        }
      } else {
        setShowSettings(true);
      }
    });
  };

  useEffect(() => {
    // Load settings on mount
    loadSettings();

    // Attach settings update listener only once to prevent duplicates
    if (!listenerAttachedRef.current) {
      const handleMessage = (request: any) => {
        if (request.type === 'SETTINGS_UPDATED') {
          console.log('Settings updated, refreshing...');
          loadSettings(true); // Force refresh to reinitialize Braintrust
        }
      };

      chrome.runtime.onMessage.addListener(handleMessage);
      listenerAttachedRef.current = true;

      // Cleanup listener on unmount
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
        listenerAttachedRef.current = false;
      };
    }
  }, []);

  const openSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const isComposioSessionExpired = (): boolean => {
    if (!composioSessionRef.current) return true;
    return Date.now() > composioSessionRef.current.expiresAt;
  };

  const ensureApiKey = (): string => {
    if (!settings?.apiKey) {
      throw new Error('Google API key not configured. Please add it in Settings.');
    }
    return settings.apiKey;
  };

  const ensureModel = (): string => {
    if (!settings?.model) {
      throw new Error('AI model not configured. Please select a model in Settings.');
    }
    return settings.model;
  };

  const getComputerUseEngine = () => {
    if (!settings) return 'google';
    return settings.computerUseEngine || (settings.provider === 'google' ? 'google' : 'gateway-flash-lite');
  };

  const getComputerUseLabel = () => {
    const engine = getComputerUseEngine();
    return engine === 'google' ? 'gemini-2.5-computer-use-preview-10-2025' : 'google/gemini-2.5-flash-lite-preview-09-2025';
  };

  const toggleBrowserTools = async () => {
    const newValue = !browserToolsEnabled;

    // Check if user has correct provider/API key before enabling Browser Tools
    if (newValue) {
      if (!settings) {
        alert('⚠️ Please configure your settings first.');
        openSettings();
        return;
      }

      const engine = getComputerUseEngine();
      if (engine === 'google') {
        if (settings.provider !== 'google' || !settings.apiKey) {
          const confirmed = window.confirm(
            '🌐 Browser Tools (Google Computer Use) requires a Google API key.\n\nWould you like to open Settings to add your Google API key?'
          );
          if (confirmed) openSettings();
          return;
        }
      } else {
        // gateway-flash-lite
        if (settings.provider !== 'gateway' || !settings.apiKey) {
          const confirmed = window.confirm(
            '🌐 Browser Tools (AI Gateway Flash Lite) requires an AI Gateway API key.\n\nWould you like to open Settings to add your AI Gateway API key?'
          );
          if (confirmed) openSettings();
          return;
        }
      }
    }

    setBrowserToolsEnabled(newValue);

    if (newValue) {
      // Clear MCP cache when enabling browser tools
      if (mcpClientRef.current) {
        try {
          await mcpClientRef.current.close();
        } catch (error) {
          console.error('Error closing MCP client:', error);
        }
      }
      mcpClientRef.current = null;
      mcpToolsRef.current = null;
      setShowBrowserToolsWarning(false);
    }
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const newChat = async () => {
    // Clear messages and tool executions
    setMessages([]);
    setToolExecutions([]);
    setShowBrowserToolsWarning(false);
    
    // Force close and clear ALL cached state
    if (mcpClientRef.current) {
      try {
        await mcpClientRef.current.close();
        console.log('Closed previous MCP client');
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
    }
    mcpClientRef.current = null;
    mcpToolsRef.current = null;
    
    
    // Reinitialize Composio session if API key present
    if (settings?.composioApiKey) {
      try {
        const { initializeComposioToolRouter } = await import('./tools');
        // Use unique, persistent user ID
        const toolRouterSession = await initializeComposioToolRouter(
          settings.composioApiKey
        );
        
        chrome.storage.local.set({ 
          composioSessionId: toolRouterSession.sessionId,
          composioChatMcpUrl: toolRouterSession.chatMcpUrl || toolRouterSession.chatSessionMcpUrl,
          composioToolRouterMcpUrl: toolRouterSession.toolRouterMcpUrl,
        });
        
        console.log('New Composio session created');
        console.log('Session ID:', toolRouterSession.sessionId);
      } catch (error) {
        console.error('Failed to create new Composio session:', error);
      }
    }
  };

  const streamWithGeminiComputerUse = async (messages: Message[]) => {
    // Wrap entire browser tools workflow in Braintrust trace
    const { traced } = await import('./lib/braintrust');
    return await traced(
      'browser_tools_workflow',
      async () => {
        try {
          const apiKey = ensureApiKey();

      // Add initial assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };
      pushMessage(assistantMessage);

      // Get initial screenshot with retry logic
      let screenshot = await executeTool('screenshot', {});

      if (!screenshot?.screenshot) {
        const errorMsg = screenshot?.error || 'Unknown error capturing screenshot';
        console.error('❌ Screenshot failed. Full response:', JSON.stringify(screenshot, null, 2));
        throw new Error(`Failed to capture screenshot: ${errorMsg}`);
      }
      
      // Prepare conversation history
      const contents: any[] = [];
      
      // Add message history
      for (const msg of messages) {
        if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
      
      if (screenshot && screenshot.screenshot) {
        const lastUserContent = contents[contents.length - 1];
        if (lastUserContent && lastUserContent.role === 'user') {
          lastUserContent.parts.push({
            inline_data: {
              mime_type: 'image/png',
              data: screenshot.screenshot.split(',')[1]
            }
          });
        }
      }

      // Run pre-search (You.com) to seed URLs if key is available
      let preSearchBlock = '';
      let evaluationBlock = '';
      try {
        const userQuery = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
        const youKey = settings?.youApiKey;
        if (youKey && userQuery) {
          // Wrap DeepSearch in Braintrust trace
          const { traced } = await import('./lib/braintrust');
          const result = await traced(
            'deepsearch_pre_seed',
            async () => {
              const { runDeepSearch } = await import('./deepsearch');
              return await runDeepSearch(userQuery, { youApiKey: youKey });
            },
            { query: userQuery }
          );
          
          if (result.items?.length) {
            const lines = result.items.slice(0, 10).map((i, idx) => `  ${idx + 1}. ${i.title || i.url}\n     ${i.url}`);
            preSearchBlock = [
              'Pre-seeded sources (You Search):',
              ...lines,
              '',
              result.plan,
            ].join('\n');

            // Evaluator workflow: assess completeness + optimized query
            // This is already wrapped via wrapped AI SDK in evaluator.ts
            try {
              const { evaluateYouResults } = await import('./evaluator');
              const evalRes = await evaluateYouResults(
                userQuery,
                result.items.slice(0, 8),
                {
                  provider: (settings?.provider === 'gateway') ? 'gateway' : 'google',
                  apiKey: settings!.apiKey,
                  model: settings?.provider === 'google' ? 'gemini-2.5-flash' : undefined,
                  braintrustApiKey: settings?.braintrustApiKey,
                }
              );
              evaluationBlock = [
                'Evaluator:',
                `- Completeness: ${Math.round((evalRes.completeness || 0) * 100)}%`,
                evalRes.gaps?.length ? `- Gaps: ${evalRes.gaps.join('; ')}` : '- Gaps: none detected',
                `- Optimized query: ${evalRes.optimized_query}`,
                (evalRes.additional_queries && evalRes.additional_queries.length) ? `- Additional: ${evalRes.additional_queries.join(' | ')}` : '',
              ].filter(Boolean).join('\n');
            } catch (e) {
              console.warn('Evaluator workflow failed:', e);
            }
          }
        }
      } catch (e) {
        console.warn('You Search pre-seed failed (continuing without it):', e);
      }

      let responseText = '';
      const maxTurns = 30;
      const execSteps: Array<{ step: number; action: string; url?: string; success: boolean }> = [];

      // GEPA-optimized system prompt: enhanced through AI-powered evolutionary optimization
      // Run ID: run-1761861321816
      const systemInstruction = `You are a browser automation assistant with ONLY browser control capabilities.

CRITICAL: You can ONLY use the computer_use tool functions for browser automation. DO NOT attempt to call any other functions like print, execute, or any programming functions.

AVAILABLE ACTIONS (computer_use tool only):
- click / click_at: Click at coordinates
- type_text_at: Type text (optionally with press_enter)
- scroll / scroll_down / scroll_up: Scroll the page
- navigate: Navigate to a URL
- wait / wait_5_seconds: Wait for page load

GUIDELINES (Validated Patterns):
1. NAVIGATION: Use 'navigate' function to go to websites
   Example: navigate({url: "https://www.reddit.com"})
   - Always wait 2.5s after navigation for page load
   - Verify page loaded by checking screenshot for expected content

2. INTERACTION: Use coordinates from the screenshot you see
   - Click at coordinates to interact with elements
   - Type text at coordinates to fill forms
   - Wait for elements to be visible before interacting (check screenshot)

3. NO HALLUCINATING: Only use the functions listed above. Do NOT invent or call functions like print(), execute(), or any code functions.

4. EFFICIENCY: Complete tasks in fewest steps possible.

VALIDATED EXECUTION PATTERNS:
- Visual computer use requires waiting for page state changes (check screenshots)
- After navigation, wait 2.5s minimum before next action
- After form submission, wait 1.5s minimum for page response
- Verify action success by checking screenshot for expected result
- If screenshot shows error or unexpected state, pause and reassess

**Your Core Strategy: Think -> Act**

For each step, follow this strict cycle:

1. **THINK:**
   - **Goal:** State your single, immediate objective (e.g., "Click the 'Login' button")
   - **Observation:** Analyze the screenshot you see. Identify the target element by:
     * Looking for text labels or ARIA labels that match your goal
     * Identifying visual elements (buttons, inputs, links) by their appearance and position
     * Determining the center coordinates (x, y) of the interactive element
   - **Decision:** Confirm the element and coordinates before acting
     * Example: "Goal: Click 'Login' button. Observation: I see a button labeled 'Login' at approximately coordinates (400, 300). Decision: I will click at (400, 300)."

2. **ACT:**
   - Execute the single action using the coordinates from your THINK step
   - Use the appropriate tool: click_at, type_text_at, navigate, scroll, or wait

3. **VERIFY:**
   - After each action, observe the new screenshot
   - Confirm the action succeeded by checking for expected changes:
     * Page navigation occurred
     * Text appeared in input field
     * New page content loaded
     * Button state changed
   - If verification fails, re-evaluate and try alternative coordinates or approach

**GUIDELINES (Validated Patterns):**

1. NAVIGATION:
   - Use navigate({url: "https://example.com"}) to go to websites
   - Always wait 2.5s after navigation for page load
   - Verify page loaded by checking screenshot for expected content (title, main content)

2. INTERACTION:
   - Always THINK before ACTING - identify element by label/text first, then coordinates
   - Target the center of interactive elements (buttons, inputs, links)
   - For input fields, click first to focus, then type
   - Wait for elements to be visible before interacting

3. NO HALLUCINATING:
   - Only use the functions listed above
   - Do NOT invent functions like print(), execute(), or any code functions
   - If an element isn't visible, scroll to find it before acting

4. EFFICIENCY:
   - Complete tasks in fewest steps possible
   - One action per Think->Act cycle
   - Verify success before proceeding to next step

**VALIDATED EXECUTION PATTERNS:**
- After navigation, wait 2.5s minimum before next action
- After form submission, wait 1.5s minimum for page response
- Verify action success by checking screenshot for expected result
- If screenshot shows error or unexpected state, pause and reassess
- Use scroll when needed elements are not visible in current viewport

${preSearchBlock ? preSearchBlock + '\n' : ''}${evaluationBlock ? evaluationBlock + '\n' : ''}`;

      for (let turn = 0; turn < maxTurns; turn++) {
        if (abortControllerRef.current?.signal.aborted) {
          updateLastMessage((msg) => ({
            ...msg,
            content: msg.role === 'assistant' ? msg.content + '\n\n🛑 **Stopped by user**' : msg.content
          }));
          return; // Exit the agent loop
        }

        console.log(`\n--- Turn ${turn + 1}/${maxTurns} ---`);

        const requestBody = {
          contents,
          tools: [{
            computer_use: {
              environment: 'ENVIRONMENT_BROWSER'
            }
          }],
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 1.0,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE'
            }
          ]
        };
        
        // Create abort controller with timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 60000); // 60 second timeout
        
        // Always use computer-use model for browser tools
        const computerUseModel = 'gemini-2.5-computer-use-preview-10-2025';

        let response;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${computerUseModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: abortController.signal,
            }
          );
        } finally {
          clearTimeout(timeoutId);
        }
        
        if (!response.ok) {
          let errorDetails;
          try {
            errorDetails = await response.json();
            console.error('❌ Gemini API Error Response:', JSON.stringify(errorDetails, null, 2));
          } catch (e) {
            console.error('❌ Failed to parse error response:', e);
            errorDetails = { statusText: response.statusText };
          }

          const errorMessage = errorDetails?.error?.message || `API request failed with status ${response.status}: ${response.statusText}`;
          console.error('❌ Full error details:', errorDetails);

          throw new Error(errorMessage);
        }
        
        const data = await response.json();

        // Validate response structure with Zod
        let validatedData;
        try {
          validatedData = GeminiResponseSchema.parse(data);
        } catch (validationError) {
          console.error('❌ Gemini API response failed validation:', validationError);
          throw new Error(`Invalid Gemini API response format: ${(validationError as any).message}`);
        }

        // Check for safety blocks and prompt feedback
        if (validatedData.promptFeedback?.blockReason) {
          const blockReason = validatedData.promptFeedback.blockReason;
          console.error('🚫 Request blocked by safety filter:', blockReason);

          // Show detailed error to user
          updateLastMessage((msg) => ({
            ...msg,
            content: msg.role === 'assistant' 
              ? `⚠️ **Safety Filter Blocked Request**\n\nReason: ${blockReason}\n\nThis request was blocked by Gemini's safety filters. Try:\n- Using a different webpage\n- Simplifying your request\n- Avoiding sensitive actions\n\nFull response:\n\`\`\`json\n${JSON.stringify(validatedData, null, 2)}\n\`\`\``
              : msg.content
          }));
          return; // Exit the loop
        }

        const candidate = validatedData.candidates?.[0];

        if (!candidate) {
          console.error('❌ No candidate in response. Full response:', JSON.stringify(data, null, 2));
          throw new Error(`No candidate in Gemini response. Finish reason: ${data.candidates?.[0]?.finishReason || 'unknown'}. Full response: ${JSON.stringify(data)}`);
        }

        // Check if candidate has safety response requiring confirmation
        const safetyResponse = candidate.safetyResponse;
        if (safetyResponse?.requireConfirmation) {
          // Show confirmation dialog to user
          const confirmMessage = safetyResponse.message || 'This action requires confirmation. Do you want to proceed?';
          const userConfirmed = window.confirm(`🔒 Human Confirmation Required\n\n${confirmMessage}\n\nProceed with this action?`);

          if (!userConfirmed) {
            appendToLastMessage('\n\n❌ Action cancelled by user.');
            return; // Exit the loop
          }

          // Add confirmation to conversation
          contents.push({
            role: 'user',
            parts: [{ text: 'CONFIRMED: User approved this action. Please proceed.' }]
          });

          // Continue to next iteration to re-run with confirmation
          continue;
        }

        // Add model response to conversation
        contents.push(candidate.content);

        // Check if there are function calls
        const parts = candidate.content?.parts || [];
        const hasFunctionCalls = parts.some((p: any) => 'functionCall' in p && p.functionCall);

        if (!hasFunctionCalls) {
          // No more actions - task complete
          for (const part of parts) {
            if ('text' in part && typeof part.text === 'string') {
              responseText += part.text;
            }
          }
          break;
        }

        // Execute function calls
        const functionResponses: any[] = [];

        for (const part of parts) {
          if ('text' in part && typeof part.text === 'string') {
            responseText += part.text + '\n';
          } else if ('functionCall' in part && part.functionCall) {
            // Check if user clicked stop button
            if (abortControllerRef.current?.signal.aborted) {
              updateLastMessage((msg) => ({
                ...msg,
                content: msg.role === 'assistant' ? responseText + '\n\n🛑 **Stopped by user**' : msg.content
              }));
              return; // Exit the agent loop
            }

            const funcName = part.functionCall.name;
            const funcArgs = part.functionCall.args || {};

            responseText += `\n[Executing: ${funcName}]\n`;

            // Execute the browser action
            const result = await executeBrowserAction(funcName, funcArgs);
            
            // Wait longer after navigation actions for page to load
            const isNavigationAction = ['navigate', 'open_web_browser', 'navigate_to', 'go_to', 'click', 'click_at', 'mouse_click', 'go_back', 'back', 'go_forward', 'forward'].includes(funcName);
            if (isNavigationAction) {
              await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5 seconds for page to load
            } else {
              await new Promise(resolve => setTimeout(resolve, 500)); // Normal wait
            }
            
            screenshot = await executeTool('screenshot', {});
            
            if (!screenshot || !screenshot.screenshot) {
              console.warn('Failed to capture screenshot after action');
              screenshot = { screenshot: '' }; // Continue without screenshot
            }
            
            // Get current page URL and viewport dimensions (required by Gemini)
            let currentUrl = '';
            let viewportInfo = '';
            try {
              const pageInfo = await executeTool('getPageContext', {});
              currentUrl = pageInfo?.url || '';
              
              // Track execution step for Braintrust and summarization
              execSteps.push({
                step: execSteps.length + 1,
                action: funcName,
                url: currentUrl,
                success: result.success !== false,
              });

              // Include viewport dimensions to help Gemini understand coordinate space
              if (pageInfo?.viewport) {
                viewportInfo = ` Viewport: ${pageInfo.viewport.width}x${pageInfo.viewport.height}`;
              }
            } catch (error) {
              console.warn('Failed to get page URL:', error);
            }

            // Build function response with URL and viewport info (required by Gemini)
            const functionResponse: any = {
              name: funcName,
              response: {
                ...result,
                url: currentUrl,  // Gemini requires this
                viewport_info: viewportInfo,
                success: result.success !== false
              }
            };
            
            functionResponses.push(functionResponse);
            
            // Update UI
            updateLastMessage((msg) => ({
              ...msg,
              content: msg.role === 'assistant' ? responseText : msg.content
            }));
          }
        }
        
        // Add function responses back to conversation with new screenshot
        if (functionResponses.length > 0) {
          const userParts: any[] = functionResponses.map(fr => ({
            function_response: fr
          }));
          
          // Add new screenshot
          if (screenshot && screenshot.screenshot) {
            userParts.push({
              inline_data: {
                mime_type: 'image/png',
                data: screenshot.screenshot.split(',')[1]
              }
            });
          }
          
          contents.push({
            role: 'user',
            parts: userParts
          });
        }
      }
      
      // Final update
      updateLastMessage((msg) => ({
        ...msg,
        content: msg.role === 'assistant' ? (responseText || 'Task completed') : msg.content
      }));

      // Post-run summarization with You Advanced Agent (if token available)
      // Wrap in Braintrust trace to capture the summarization step
      try {
        const youToken = settings?.youApiKey;
        if (youToken) {
          const { traced } = await import('./lib/braintrust');
          const objective = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
          const trajectory = execSteps.slice(-50).map(s => `- step ${s.step}: ${s.action}${s.url ? ` @ ${s.url}` : ''} ${s.success ? '(ok)' : '(failed)'}`).join('\n') || '- (no actions executed)';
          const outcome = (responseText || '').slice(0, 1500);
          const prompt = [
            'Summarize the execution and propose next actions.',
            '',
            'Objective:',
            objective,
            '',
            'Execution Trajectory:',
            trajectory,
            '',
            'Outcome (assistant text):',
            outcome,
            '',
            'Your task: Summarize the execution trajectory, assess whether the objective was achieved and why, then propose exactly three high-impact next actions tailored to this context (include a short rationale and the recommended browser action or tool to execute). Return concise Markdown with sections: Summary, Goal assessment, Suggested next actions (1-3).'
          ].join('\n');
          
          const agentText = await traced(
            'you_advanced_agent_summarization',
            async () => {
              const { runYouAdvancedAgentSummary } = await import('./youAgent');
              return await runYouAdvancedAgentSummary(youToken, prompt, { verbosity: 'medium', maxWorkflowSteps: 5 });
            },
            {
              workflow_type: 'post_run_summarization',
              objective_length: objective.length,
              trajectory_steps: execSteps.length,
            }
          );
          
          pushMessage({ id: (Date.now() + 2).toString(), role: 'assistant', content: `---\nSummary & Next Steps (You Agent)\n\n${agentText}` });
        }
      } catch (e) {
        console.warn('You Advanced Agent summarizer failed:', e);
      }
      
      } catch (error: any) {
        console.error('❌ Error with Gemini Computer Use:');
        console.error('Error name:', error?.name);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        console.error('Full error object:', error);
        throw error;
      }
    },
    {
      workflow_type: 'browser_tools',
      initial_message: messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '',
    }
    );
  };

  // Scale coordinates from Gemini's 1000x1000 grid to actual viewport
  const scaleCoordinates = async (x: number, y: number) => {
    try {
      // Get actual viewport dimensions
      const pageInfo = await executeTool('getPageContext', {});
      const viewportWidth = pageInfo?.viewport?.width || 1440;
      const viewportHeight = pageInfo?.viewport?.height || 900;

      // Gemini uses 1000x1000 normalized coordinates
      const scaledX = Math.round((x / 1000) * viewportWidth);
      const scaledY = Math.round((y / 1000) * viewportHeight);
      return { x: scaledX, y: scaledY };
    } catch (error) {
      console.error('Failed to scale coordinates:', error);
      // Fallback to original coordinates if scaling fails
      return { x, y };
    }
  };

  const requiresUserConfirmation = async (functionName: string, args: any): Promise<boolean> => {
    let pageContext: any = {};
    try {
      pageContext = await executeTool('getPageContext', {});
    } catch (e) {
      console.warn('Could not get page context');
    }

    const url = pageContext?.url?.toLowerCase() || '';
    const pageText = pageContext?.text?.toLowerCase() || '';

    const alwaysConfirm = ['key_combination'];

    const isSensitivePage =
      url.includes('checkout') ||
      url.includes('payment') ||
      url.includes('login') ||
      url.includes('signin') ||
      url.includes('admin') ||
      url.includes('delete') ||
      url.includes('remove') ||
      pageText.includes('checkout') ||
      pageText.includes('payment') ||
      pageText.includes('purchase') ||
      pageText.includes('confirm order') ||
      pageText.includes('delete') ||
      pageText.includes('remove account');

    const isSensitiveInput = functionName.includes('type') && (
      args.text?.toLowerCase().includes('password') ||
      args.text?.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/) ||
      pageText.includes('credit card') ||
      pageText.includes('cvv') ||
      pageText.includes('social security')
    );

    const isFormSubmission = functionName === 'type_text_at' && args.press_enter === true;

    if (alwaysConfirm.includes(functionName) || isSensitivePage || isSensitiveInput || isFormSubmission) {
      const confirmMessage = `🔒 Confirm Action\n\nAction: ${functionName}\nPage: ${url}` +
        `${isSensitivePage ? '\n⚠️ Sensitive page' : ''}` +
        `${isSensitiveInput ? '\n⚠️ Sensitive data' : ''}` +
        `${isFormSubmission ? '\n⚠️ Form submission' : ''}\n\nProceed?`;
      return window.confirm(confirmMessage);
    }

    return false;
  };

  const executeBrowserAction = async (functionName: string, args: any) => {
    const userConfirmed = await requiresUserConfirmation(functionName, args);

    if (!userConfirmed && (
      ['key_combination'].includes(functionName) ||
      functionName.includes('type') ||
      functionName === 'type_text_at'
    )) {
      return { success: false, error: 'Action cancelled by user', userCancelled: true };
    }

    switch (functionName) {
      case 'click':
      case 'click_at':
      case 'mouse_click':
        // Scale coordinates from Gemini's 1000x1000 grid to actual viewport
        const clickCoords = await scaleCoordinates(
          args.x || args.coordinate?.x || 0,
          args.y || args.coordinate?.y || 0
        );
        return await executeTool('click', clickCoords);
      
      case 'type':
      case 'type_text':
      case 'keyboard_input':
      case 'input_text':
        return await executeTool('type', { 
          selector: 'input:focus, textarea:focus, [contenteditable="true"]:focus', 
          text: args.text || args.input || args.content
        });
      
      case 'scroll':
      case 'scroll_down':
      case 'scroll_up':
      case 'mouse_scroll':
        const direction = functionName === 'scroll_up' ? 'up' : 
                         functionName === 'scroll_down' ? 'down' : 
                         args.direction || 'down';
        return await executeTool('scroll', { 
          direction,
          amount: args.amount || args.pixels || args.delta || 500
        });
      
      case 'navigate':
      case 'open_web_browser':
      case 'navigate_to':
      case 'go_to':
        return await executeTool('navigate', { 
          url: args.url || args.address || args.uri
        });
      
      case 'get_screenshot':
      case 'take_screenshot':
      case 'screenshot':
        return await executeTool('screenshot', {});
      
      case 'get_page_info':
      case 'get_url':
      case 'get_page_content':
        return await executeTool('getPageContext', {});
      
      case 'wait':
      case 'sleep':
      case 'delay':
        const waitTime = (args.seconds || args.milliseconds / 1000 || 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return { success: true, message: `Waited ${waitTime}ms` };
      
      case 'press_key':
      case 'key_press':
        // Handle special keys like Enter, Tab, etc.
        return await executeTool('type', { 
          selector: 'input:focus, textarea:focus, [contenteditable="true"]:focus', 
          text: args.key || args.keyCode
        });
      
      case 'type_text_at':
        // Type text at coordinates (click first, then type)
        // This mimics Python's playwright keyboard.type() behavior
        if (args.x !== undefined && args.y !== undefined) {
          // Scale coordinates before clicking
          const typeCoords = await scaleCoordinates(args.x, args.y);
          await executeTool('click', typeCoords);
          // Wait for element to focus
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Clear existing text if requested
        if (args.clear_before_typing !== false) {
          // Use keyboard shortcuts to select all and delete (like Python implementation)
          const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
          if (isMac) {
            await executeTool('keyCombo', { keys: ['Meta', 'a'] });
          } else {
            await executeTool('keyCombo', { keys: ['Control', 'a'] });
          }
          await new Promise(resolve => setTimeout(resolve, 50));
          await executeTool('pressKey', { key: 'Delete' });
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Use keyboard_type action which simulates actual keyboard typing
        const typeResult = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'EXECUTE_ACTION',
              action: 'keyboard_type',
              value: args.text || args.content
            },
            (response) => {
              resolve(response);
            }
          );
        });

        // If press_enter is requested, send Enter key
        if (args.press_enter) {
          await new Promise(resolve => setTimeout(resolve, 100));
          await executeTool('pressKey', { key: 'Enter' });
        }

        return typeResult;
      
      case 'key_combination':
        // Press keyboard key combinations like ["Control", "A"] or ["Enter"]
        const keys = args.keys || [args.key] || ['Enter'];
        return await executeTool('keyCombo', { keys });
      
      case 'hover_at':
        // Hover mouse at coordinates
        const hoverCoords = await scaleCoordinates(args.x || 0, args.y || 0);
        return await executeTool('hover', hoverCoords);
      
      case 'scroll_document':
        // Scroll the entire page
        const scrollDir = args.direction || 'down';
        return await executeTool('scroll', { direction: scrollDir, amount: 800 });
      
      case 'scroll_at':
        // Scroll at specific coordinates
        return await executeTool('scroll', { 
          direction: args.direction || 'down', 
          amount: args.magnitude || 800 
        });
      
      case 'wait_5_seconds':
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { success: true, message: 'Waited 5 seconds' };
      
      case 'go_back':
      case 'back':
        // Go back in browser history - properly async
        return new Promise<any>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.goBack(tabs[0].id);
              // Add small delay for navigation to register
              setTimeout(() => {
                resolve({ success: true, message: 'Navigated back' });
              }, 300);
            } else {
              resolve({ success: false, error: 'No active tab found' });
            }
          });
        });

      case 'go_forward':
      case 'forward':
        // Go forward in browser history - properly async
        return new Promise<any>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.goForward(tabs[0].id);
              // Add small delay for navigation to register
              setTimeout(() => {
                resolve({ success: true, message: 'Navigated forward' });
              }, 300);
            } else {
              resolve({ success: false, error: 'No active tab found' });
            }
          });
        });
      
      case 'search':
        // Navigate to Google search
        return await executeTool('navigate', { url: 'https://www.google.com' });
      
      case 'drag_and_drop':
        return await executeTool('dragDrop', { 
          x: args.x, 
          y: args.y, 
          destination_x: args.destination_x, 
          destination_y: args.destination_y 
        });
      
      default:
        console.warn('⚠️ Unknown Gemini function:', functionName, args);
        return { success: false, error: `Unknown function: ${functionName}`, args };
    }
  };

  // Stream with AI SDK using MCP tools
  const streamWithAISDKAndMCP = async (messages: Message[], tools: any) => {
    try {
      // Import streamText and provider SDKs - use wrapped AI SDK for Braintrust tracing
      const { getWrappedAI } = await import('./lib/ai-wrapped');
      const aiModule = await getWrappedAI(settings?.braintrustApiKey);
      const { streamText } = aiModule;
      const { z } = await import('zod');

      // Import the appropriate provider SDK based on settings
      let model;
      if (settings!.provider === 'gateway') {
        if (!settings?.apiKey) {
          throw new Error('AI Gateway API key is required. Please set it in settings.');
        }
        console.log('🔑 [streamWithAISDKAndMCP] Creating AI Gateway client with key:', settings.apiKey.substring(0, 10) + '...');
        const { createGateway } = await import('@ai-sdk/gateway');
        const gatewayClient = createGateway({ apiKey: settings.apiKey });
        model = gatewayClient(settings.model);
        console.log('✅ [streamWithAISDKAndMCP] AI Gateway client created for model:', settings.model);
      } else {
        if (!settings?.apiKey) {
          throw new Error('Google API key is required. Please set it in settings.');
        }
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const googleClient = createGoogleGenerativeAI({ apiKey: settings.apiKey });
        model = googleClient(settings.model);
      }

      // Convert messages to AI SDK format
      const aiMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Define browser history tool
      const browserHistoryTool = {
        getBrowserHistory: {
          description: 'Get browser history. Useful for finding recently visited pages.',
          parameters: z.object({
            query: z.string().optional().describe('Search term to filter history (e.g., "github", "reddit")'),
            maxResults: z.number().optional().describe('Maximum number of results (default: 20)'),
            daysBack: z.number().optional().describe('How many days back to search (default: 7)'),
          }),
          execute: async ({ query = '', maxResults = 20, daysBack = 7 }: { query?: string; maxResults?: number; daysBack?: number }) => {
            const startTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
            const result = await executeTool('getBrowserHistory', { query, maxResults, startTime });
            
            // Format the history results for better readability
            if (result && result.history && Array.isArray(result.history)) {
              const formatted = result.history.map((item: any) => {
                const lastVisit = item.lastVisitTime ? new Date(item.lastVisitTime).toLocaleString() : 'Unknown';
                return `• **${item.title || 'Untitled'}**\n  ${item.url}\n  Last visited: ${lastVisit}`;
              }).join('\n\n');
              
              return `Found ${result.history.length} recent pages:\n\n${formatted}`;
            }
            
            return result;
          },
        },
      };

      // Merge MCP tools with browser history tool
      const allTools = {
        ...tools,
        ...browserHistoryTool,
      };

      const result = streamText({
        model,
        tools: allTools,
        messages: aiMessages,
        maxSteps: 15, // Hard limit on tool calls to prevent infinite loops
        maxTokens: 4000, // Reasonable token limit
        abortSignal: abortControllerRef.current?.signal,
      });
    
      // Add initial assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };
      pushMessage(assistantMessage);

      // Stream the response - collect full text without duplicates
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
        updateLastMessage((msg) => ({
          ...msg,
          content: msg.role === 'assistant' ? fullText : msg.content
        }));
      }

    } catch (error) {
      console.error('❌ Error streaming with AI SDK:', error);
      throw error;
    }
  };

  // Computer Use via AI Gateway (Flash Lite) with Workflow-based orchestration
  const streamWithGatewayComputerUse = async (messages: Message[]) => {
    const { traced } = await import('./lib/braintrust');
    return await traced(
      'browser_tools_workflow_gateway',
      async () => {
        const userQuery = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
        
        // Log model being used (Anthropic models now supported with Bedrock-compatible schemas)
        const isAnthropicModel = settings?.model?.includes('anthropic') || settings?.model?.includes('claude');
        if (isAnthropicModel) {
          console.log('✅ [Gateway Computer Use] Using Anthropic model with Bedrock-compatible tool schemas');
        }
        
        console.log('🚀 [Gateway Computer Use] Starting browser automation workflow');
        console.log('🚀 [Gateway Computer Use] User query:', userQuery.substring(0, 100));
        console.log('🚀 [Gateway Computer Use] Settings:', {
          provider: settings?.provider,
          model: settings?.model,
          hasBraintrust: !!settings?.braintrustApiKey,
          hasYouApi: !!settings?.youApiKey,
        });
        
        // Get initial page context
        let initialPageContext: any = null;
        let currentUrl = '';
        try {
          initialPageContext = await executeTool('getPageContext', {});
          currentUrl = initialPageContext?.url || '';
          console.log('🌐 [Gateway Computer Use] Initial page context retrieved, URL:', currentUrl);
        } catch (e) {
          console.warn('⚠️ Could not get initial page context:', e);
        }
        
        // Helper functions for workflow context
        const getPageContextAfterAction = async (): Promise<PageContext> => {
          try {
            const ctx = await executeTool('getPageContext', {});
            return {
              url: ctx?.url || '',
              title: ctx?.title || '',
              textContent: ctx?.text || ctx?.textContent || '',
              links: ctx?.links || [],
              images: ctx?.images || [],
              forms: ctx?.forms || [],
              metadata: ctx?.metadata || {},
              viewport: ctx?.viewport || { width: 1280, height: 720, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
            };
          } catch (e) {
            console.warn('Failed to get page context after action:', e);
            return { 
              url: '', 
              title: '', 
              textContent: '', 
              links: [], 
              images: [],
              forms: [], 
              metadata: {},
              viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, devicePixelRatio: 1 } 
            };
          }
        };
        
        const enrichToolResponseForWorkflow = async (res: any, _toolName: string) => {
          try {
            const pageCtx = await getPageContextAfterAction();
            return {
              success: res?.success !== false,
              url: pageCtx.url || res?.url,
              pageContext: pageCtx,
            };
          } catch (e) {
            return { success: res?.success !== false, url: res?.url };
          }
        };
        
        // Validate settings
        if (!settings?.apiKey) {
          throw new Error('API key is required');
        }
        
        // Prepare workflow input
        const workflowInput = {
          userQuery,
          settings: {
            provider: settings.provider || 'gateway',
            apiKey: settings.apiKey,
            model: settings.model || 'google/gemini-2.5-flash-lite-preview-09-2025',
            braintrustApiKey: settings.braintrustApiKey,
            braintrustProjectName: settings.braintrustProjectName,
            youApiKey: settings.youApiKey,
            computerUseEngine: settings.computerUseEngine || 'gateway-flash-lite',
          },
          initialContext: initialPageContext ? {
            currentUrl,
            pageContext: initialPageContext,
          } : undefined,
          metadata: {
            timestamp: Date.now(),
          },
        };
        
        // Execute workflow
        const { browserAutomationWorkflow } = await import('./workflows/browser-automation-workflow');
        const workflowOutput = await browserAutomationWorkflow(workflowInput, {
          executeTool,
          enrichToolResponse: enrichToolResponseForWorkflow,
          getPageContextAfterAction,
          updateLastMessage,
          pushMessage,
          settings: workflowInput.settings,
          messages,
          abortSignal: abortControllerRef.current?.signal,
        });
        
        // Log workflow completion
        console.log(`🏁 [Gateway Computer Use] Workflow completed:`, {
          success: workflowOutput.success,
          totalDuration: workflowOutput.totalDuration,
          finalUrl: workflowOutput.finalUrl,
          steps: workflowOutput.executionTrajectory.length,
          workflowId: workflowOutput.metadata?.workflowId,
          hasSummarization: !!workflowOutput.summarization,
          summaryLength: workflowOutput.summarization?.summary?.length || 0,
        });
        
        // Ensure final summary is displayed (fix for streaming not updating UI)
        if (workflowOutput.summarization?.success && workflowOutput.summarization.summary) {
          console.log('📊 [Gateway Computer Use] Displaying final summary (', workflowOutput.summarization.summary.length, 'chars)');
          
          // Import task manager for workflow tasks
          const { convertLegacyTasks } = await import('./lib/task-manager');
          
          // Always push a final summary message to ensure it's visible
          // This ensures the summary shows even if streaming updates didn't work
          const finalSummaryMessage: Message = {
            id: `summary-final-${Date.now()}`,
            role: 'assistant',
            content: `---\n## Summary & Next Steps\n\n${workflowOutput.summarization.summary}`,
            summarization: workflowOutput.summarization,
            executionTrajectory: workflowOutput.executionTrajectory,
            pageContext: workflowOutput.pageContext,
            workflowMetadata: {
              workflowId: workflowOutput.metadata?.workflowId,
              totalDuration: workflowOutput.totalDuration,
              finalUrl: workflowOutput.finalUrl,
            },
            workflowTasks: workflowOutput.taskManager ? 
              convertLegacyTasks(workflowOutput.taskManager.getAllTasks()).map(t => ({
                id: t.id,
                title: t.title,
                description: t.description,
                status: t.status === 'cancelled' || t.status === 'retrying' ? 'pending' as const : t.status,
              }))
              : undefined,
          } as Message;
          
          // Use @ai-sdk-tools/store API correctly - just push the message
          // The store will handle state updates
          pushMessage(finalSummaryMessage);
          
          console.log('✅ [Gateway Computer Use] Final summary message pushed to UI');
        } else {
          console.warn('⚠️ [Gateway Computer Use] No summary to display', {
            hasSummarization: !!workflowOutput.summarization,
            summarizationSuccess: workflowOutput.summarization?.success,
            summaryLength: workflowOutput.summarization?.summary?.length || 0,
          });
          
          // If no summary, at least show a completion message
          pushMessage({
            id: `completion-${Date.now()}`,
            role: 'assistant',
            content: `✅ **Workflow Complete**\n\nExecution finished successfully with ${workflowOutput.executionTrajectory.length} step(s).\n\n**Final URL**: ${workflowOutput.finalUrl || 'N/A'}`,
            executionTrajectory: workflowOutput.executionTrajectory,
            workflowMetadata: {
              workflowId: workflowOutput.metadata?.workflowId,
              totalDuration: workflowOutput.totalDuration,
              finalUrl: workflowOutput.finalUrl,
            },
          });
        }
        
        return workflowOutput;
      },
      { workflow_type: 'browser_tools_gateway', initial_message: messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '' }
    );
  };

  const streamGoogle = async (messages: Message[], signal: AbortSignal) => {
    // Ensure API credentials are available
    const apiKey = ensureApiKey();
    const model = ensureModel();

    // Add initial assistant message
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };
    pushMessage(assistantMessage);

    if (!messages || messages.length === 0) {
      throw new Error('No messages provided to stream');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content || '' }],
          })),
        }),
        signal,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Google API request failed');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            appendToLastMessage(text);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  };

  // Stream with AI SDK (for gateway provider without MCP tools)
  const streamWithAISDK = async (messages: Message[]) => {
    try {
      // Use wrapped AI SDK for Braintrust tracing
      const { getWrappedAI } = await import('./lib/ai-wrapped');
      const aiModule = await getWrappedAI(settings?.braintrustApiKey);
      const { streamText } = aiModule;

      // Import the appropriate provider SDK based on settings
      let model;
      if (settings!.provider === 'gateway') {
        if (!settings?.apiKey) {
          throw new Error('AI Gateway API key is required. Please set it in settings.');
        }
        console.log('🔑 [streamWithAISDK] Creating AI Gateway client with key:', settings.apiKey.substring(0, 10) + '...');
        const { createGateway } = await import('@ai-sdk/gateway');
        const gatewayClient = createGateway({ apiKey: settings.apiKey });
        model = gatewayClient(settings.model);
        console.log('✅ [streamWithAISDK] AI Gateway client created for model:', settings.model);
      } else {
        if (!settings?.apiKey) {
          throw new Error('Google API key is required. Please set it in settings.');
        }
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const googleClient = createGoogleGenerativeAI({ apiKey: settings.apiKey });
        model = googleClient(settings.model);
      }

      // Convert messages to AI SDK format
      const aiMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const result = streamText({
        model,
        messages: aiMessages,
        abortSignal: abortControllerRef.current?.signal,
      });

      // Add initial assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };
      pushMessage(assistantMessage);

      // Stream the response
      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
        updateLastMessage((msg) => ({
          ...msg,
          content: msg.role === 'assistant' ? fullText : msg.content
        }));
      }
    } catch (error) {
      console.error('❌ Error streaming with AI SDK:', error);
      throw error;
    }
  };

  // New handler for AgentPromptComposer
  const handleComposerSubmit = async (query: string, options?: { persona?: any; files?: File[] }) => {
    if (!query.trim() || isLoading || !settings) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      metadata: options?.persona ? {
        persona: options.persona.name,
        personaPrompt: options.persona.systemPrompt,
        attachments: options.files?.map(f => f.name),
      } : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setIsUserScrolled(false); // Reset scroll state when user sends message

    abortControllerRef.current = new AbortController();

    try {
      // Determine if browser tools should be used
      // Auto-detect based on provider + computer use engine settings
      const engine = getComputerUseEngine();
      const shouldUseBrowserTools = browserToolsEnabled || 
        (settings.provider === 'gateway' && engine === 'gateway-flash-lite' && settings.apiKey) ||
        (settings.provider === 'google' && engine === 'google' && settings.apiKey);

      // BROWSER TOOLS MODE - Use selected engine
      if (shouldUseBrowserTools) {
        console.log('🔧 [handleSubmit] Browser tools mode detected', { browserToolsEnabled, provider: settings.provider, engine, hasApiKey: !!settings.apiKey });

        if (engine === 'google') {
          // Safety check: Ensure we have Google API key
          if (settings.provider !== 'google' || !settings.apiKey) {
            setBrowserToolsEnabled(false);
            updateLastMessage((msg) => ({
              ...msg,
              content: msg.role === 'assistant' 
                ? '⚠️ **Browser Tools (Google Computer Use) requires a Google API key**\n\nPlease:\n1. Open Settings (⚙️)\n2. Select "Google" as provider\n3. Add your Google API key\n4. Try again'
                : msg.content
            }));
            setIsLoading(false);
            return;
          }

          if (mcpClientRef.current) {
            try {
              await mcpClientRef.current.close();
            } catch (e) {
              // Silent fail
            }
            mcpClientRef.current = null;
            mcpToolsRef.current = null;
          }

          await streamWithGeminiComputerUse(newMessages);
        } else {
          // gateway-flash-lite
          if (settings.provider !== 'gateway' || !settings.apiKey) {
            setBrowserToolsEnabled(false);
            updateLastMessage((msg) => ({
              ...msg,
              content: msg.role === 'assistant'
                ? '⚠️ **Browser Tools (AI Gateway Flash Lite) requires an AI Gateway API key**\n\nPlease:\n1. Open Settings (⚙️)\n2. Select "AI Gateway" as provider\n3. Add your AI Gateway API key\n4. Try again'
                : msg.content
            }));
            setIsLoading(false);
            return;
          }

          if (mcpClientRef.current) {
            try { await mcpClientRef.current.close(); } catch {}
            mcpClientRef.current = null;
            mcpToolsRef.current = null;
          }

          console.log('🚀 [handleSubmit] Using Gateway Computer Use workflow');
          await streamWithGatewayComputerUse(newMessages);
        }
      } else if (settings.composioApiKey) {
        if (isComposioSessionExpired()) {
          console.warn('Composio session expired, reinitializing...');
          await loadSettings(true);
        }

        const isComputerUseModel = settings.model === 'gemini-2.5-computer-use-preview-10-2025';
        if (isComputerUseModel && settings.provider === 'google') {
          setSettings({ ...settings, model: 'gemini-2.5-pro' });
          console.warn('Switching to gemini-2.5-pro (incompatible with MCP)');
        }

        if (mcpClientRef.current && mcpToolsRef.current) {
          await streamWithAISDKAndMCP(newMessages, mcpToolsRef.current);
        } else if (mcpInitPromiseRef.current) {
          await mcpInitPromiseRef.current;
          if (mcpClientRef.current && mcpToolsRef.current) {
            await streamWithAISDKAndMCP(newMessages, mcpToolsRef.current);
          } else {
            // Use AI SDK for gateway provider, otherwise use Google streaming
            if (settings.provider === 'gateway') {
              await streamWithAISDK(newMessages);
            } else {
              await streamGoogle(newMessages, abortControllerRef.current.signal);
            }
          }
        } else {
          console.log('🔧 [handleSubmit] No browser tools, checking MCP/Tool Router');
          mcpInitPromiseRef.current = (async () => {
            try {
              const storage = await chrome.storage.local.get(['composioToolRouterMcpUrl', 'composioSessionId', 'atlasSettings']);
              if (!storage.composioToolRouterMcpUrl || !storage.composioSessionId) {
                console.log('⚠️ [handleSubmit] No MCP session, will use standard streaming');
                return;
              }
              console.log('🔌 [handleSubmit] MCP session found, initializing client');

              // MCP client creation - check if available in AI SDK
              const aiModule = await import('ai');
              const createMCPClient = (aiModule as any).createMCPClient || (aiModule as any).experimental_createMCPClient;
              
              if (!createMCPClient) {
                console.warn('MCP client creation not available in AI SDK version');
                return;
              }

              const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
              const composioApiKey = storage.atlasSettings?.composioApiKey;

              const transportOptions: any = { sessionId: storage.composioSessionId };
              if (composioApiKey) {
                transportOptions.headers = { 'x-api-key': composioApiKey };
              }

              const mcpClient = await createMCPClient({
                transport: new StreamableHTTPClientTransport(
                  new URL(storage.composioToolRouterMcpUrl),
                  transportOptions
                ),
              });

              const mcpTools = await mcpClient.tools();
              if (Object.keys(mcpTools).length > 0) {
                mcpClientRef.current = mcpClient;
                mcpToolsRef.current = mcpTools;
              } else {
                await mcpClient.close();
              }
            } catch (error) {
              console.error('MCP init failed:', error);
            } finally {
              mcpInitPromiseRef.current = null;
            }
          })();

          await mcpInitPromiseRef.current;

          if (mcpClientRef.current && mcpToolsRef.current) {
            console.log('🔌 [handleSubmit] MCP client ready, calling streamWithAISDKAndMCP');
            await streamWithAISDKAndMCP(newMessages, mcpToolsRef.current);
          } else {
            // Use AI SDK for gateway provider, otherwise use Google streaming
            console.log('🚀 [handleSubmit] No MCP, using standard streaming');
            if (settings.provider === 'gateway') {
              console.log('🟢 [handleSubmit] Calling streamWithAISDK (gateway)');
              await streamWithAISDK(newMessages);
            } else {
              console.log('🔵 [handleSubmit] Calling streamGoogle');
              await streamGoogle(newMessages, abortControllerRef.current.signal);
            }
          }
        }
      } else {
        // Use AI SDK for gateway provider, otherwise use Google streaming
        console.log('🚀 [handleSubmit] Tool router disabled, using standard streaming');
        if (settings.provider === 'gateway') {
          console.log('🟢 [handleSubmit] Calling streamWithAISDK (gateway)');
          await streamWithAISDK(newMessages);
        } else {
          console.log('🔵 [handleSubmit] Calling streamGoogle');
          await streamGoogle(newMessages, abortControllerRef.current.signal);
        }
      }
      
      setIsLoading(false);
    } catch (error: any) {
      // Error handling is the same
      console.error('❌ Chat error occurred:');
      console.error('Error type:', typeof error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Full error object:', error);

      if (error.name !== 'AbortError') {
        // Show detailed error message to user
        const errorDetails = error?.stack || JSON.stringify(error, null, 2);
        const filteredMessages = messages.filter(m => m.content !== '');
        setMessages([
          ...filteredMessages,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error: ${error.message}\n\nDetails:\n\`\`\`\n${errorDetails}\n\`\`\``,
          },
        ]);
      }
      setIsLoading(false);
    }
  };

  // Check if user is scrolled to bottom
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle scroll detection
  const handleScroll = () => {
    setIsUserScrolled(!isAtBottom());
  };

  // Auto-scroll to bottom when messages change (unless user scrolled up)
  useEffect(() => {
    if (!isUserScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isUserScrolled]);

  // Attach scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  if (showSettings && !settings) {
    return (
      <div className="chat-container">
        <div className="welcome-message" style={{ padding: '40px 20px' }}>
          <h2>Welcome to Opulent</h2>
          <p style={{ marginBottom: '20px' }}>Please configure your AI provider to get started.</p>
          <button
            onClick={openSettings}
            className="settings-icon-btn"
            style={{ width: 'auto', padding: '12px 24px' }}
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container dark-mode">
      <div className="chat-header">
        <div style={{ flex: 1 }}>
          <h1>Opulent</h1>
          <p>
            {(settings?.provider
              ? settings.provider === 'gateway' ? 'AI Gateway' : settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1)
              : 'Unknown')} · {browserToolsEnabled ? getComputerUseLabel() : (settings?.model || 'No model')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={toggleBrowserTools}
            className={`settings-icon-btn ${browserToolsEnabled ? 'active' : ''}`}
            title={browserToolsEnabled ? 'Disable Browser Tools' : 'Enable Browser Tools'}
            disabled={isLoading}
          >
            {browserToolsEnabled ? '◉' : '○'}
          </button>
          <button
            onClick={newChat}
            className="settings-icon-btn"
            title="New Chat"
            disabled={isLoading}
          >
            +
          </button>
          <button
            onClick={openSettings}
            className="settings-icon-btn"
            title="Settings"
          >
            ⋯
          </button>
        </div>
      </div>

      {showBrowserToolsWarning && (
        <div style={{
          padding: '12px 16px',
          background: '#fef3c7',
          borderBottom: '1px solid #fbbf24',
          fontSize: '13px',
          color: '#92400e',
        }}>
          <strong>Browser Tools Enabled!</strong> Now using {getComputerUseLabel()}.
          {!settings?.apiKey && (
            <span> Please <a href="#" onClick={(e) => { e.preventDefault(); openSettings(); }} style={{ color: '#2563eb', textDecoration: 'underline' }}>set your API key</a> in settings.</span>
          )}
        </div>
      )}

      <div className="messages-container" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>How can I help you today?</h2>
            <p>I'm Opulent, your AI assistant. I can help you browse the web, analyze content, and perform various tasks.</p>
          </div>
        ) : (
          <>
            {/* Display messages in chronological order (like a normal chat) */}
            {messages.map((message, index) => {
              // Filter out intermediate reasoning updates - they clutter the UI
              if (message.role === 'assistant' && message.content.includes('💭 **Reasoning Update**')) {
                return null;
              }

              const isStepMessage = message.role === 'assistant' && (
                message.content.includes('**Step') || 
                message.content.includes('Planning Phase') ||
                message.content.includes('Planning Complete')
              );

              return (
                <div
                  key={message.id}
                  className={`mx-auto w-full max-w-[44rem] animate-in fade-in slide-in-from-bottom-1 duration-200 py-4 ${
                    message.role === 'user' ? 'grid grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2' : 'px-2'
                  }`}
                  style={{
                    animation: 'fadeInUp 0.4s ease-out forwards',
                  }}
                >
                  <div className={`${
                    message.role === 'user' 
                      ? 'col-start-2 rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground max-w-[85%] ml-auto'
                      : 'leading-7 break-words text-foreground w-full'
                  }`}>
                    {message.content ? (
                      <>
                        {/* Show content based on message type */}
                        {message.role === 'assistant' ? (
                          <>
                            {/* Display tool executions using enhanced structured component */}
                            {message.toolExecutions && message.toolExecutions.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <EnhancedToolCallDisplay 
                                  toolParts={message.toolExecutions.map(exec => ({
                                    type: exec.toolName,
                                    state: exec.state,
                                    input: exec.input,
                                    output: exec.output,
                                    toolCallId: exec.toolCallId,
                                    errorText: exec.errorText,
                                  }))}
                                />
                              </div>
                            )}
                            
                            {/* Display workflow task list (mastra-hitl inspired clean UI) */}
                            {message.workflowTasks && message.workflowTasks.length > 0 && (
                              <WorkflowTaskList
                                  tasks={message.workflowTasks}
                                autoExpand={index === messages.length - 1}
                                emphasizedTasks={new Set(
                                  message.workflowTasks
                                    .filter(t => t.status === 'new' || t.status === 'in_progress')
                                    .map(t => t.id)
                                )}
                                />
                            )}
                            
                            {/* Display reasoning tokens (OpenRouter/Atlas chain-of-thought) - AI Elements primitive */}
                            {message.reasoning && message.reasoning.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <Reasoning 
                                  isStreaming={isLoading && index === messages.length - 1}
                                  defaultOpen={false}
                                  className="rounded-lg border border-border bg-card"
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent className="space-y-2 pt-3">
                                    {message.reasoning.map((thought, idx) => (
                                      <div 
                                        key={idx}
                                        className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground"
                                      >
                                        <div className="font-medium text-foreground mb-1">
                                          Thought {idx + 1}
                                        </div>
                                        <div className="whitespace-pre-wrap">
                                          {thought}
                                        </div>
                                      </div>
                                    ))}
                                  </ReasoningContent>
                                </Reasoning>
                              </div>
                            )}

                            {/* Display planning using enhanced structured component */}
                            {message.planning && (
                              <div style={{ marginBottom: '12px' }}>
                                <EnhancedPlanDisplay 
                                  plan={message.planning.plan}
                                  confidence={message.planning.confidence}
                                  defaultOpen={false}
                                />
                              </div>
                            )}
                            
                            {/* Display page context artifact */}
                            {message.pageContext && (
                              <div style={{ marginBottom: '12px' }}>
                                <PageContextArtifact pageContext={message.pageContext} />
                              </div>
                            )}
                            
                            {/* Display summarization artifact */}
                            {message.summarization && (
                              <div style={{ marginBottom: '12px' }}>
                                <SummarizationArtifact summarization={message.summarization} />
                              </div>
                            )}
                            
                            {/* Display error analysis artifact */}
                            {message.errorAnalysis && (
                              <div style={{ marginBottom: '12px' }}>
                                <ErrorAnalysisArtifact errorAnalysis={message.errorAnalysis} />
                              </div>
                            )}
                            
                            {/* Display execution trajectory artifact */}
                            {message.executionTrajectory && message.executionTrajectory.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <ExecutionTrajectoryArtifact trajectory={message.executionTrajectory} />
                              </div>
                            )}
                            
                            {/* Display workflow metadata artifact */}
                            {message.workflowMetadata && (
                              <div style={{ marginBottom: '12px' }}>
                                <WorkflowMetadataArtifact 
                                  metadata={message.workflowMetadata}
                                  totalDuration={message.workflowMetadata.totalDuration}
                                  finalUrl={message.workflowMetadata.finalUrl}
                                />
                              </div>
                            )}
                            
                            {/* Display step visualization using prompt-kit Steps component */}
                            {isStepMessage && (
                              <div style={{ marginBottom: '12px' }}>
                                <EnhancedStepDisplay messages={[message]} />
                              </div>
                            )}
                            
                            {/* Thinking indicator: Show when tools are processing or when content indicates continuation */}
                            {(() => {
                              const processingTools = message.toolExecutions?.filter(e => e.state === 'input-streaming') || [];
                              const hasProcessingTools = processingTools.length > 0;
                              const isContinuing = message.content?.includes('_Continuing') || message.content?.includes('_Executing step');
                              
                              if (hasProcessingTools || (isContinuing && !message.content.match(/\*\*|#|Step \d+:/))) {
                                return (
                                  <div style={{ 
                                    padding: '12px', 
                                    background: 'rgba(59, 130, 246, 0.05)',
                                    borderRadius: '6px',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '13px',
                                    color: '#6b7280'
                                  }}>
                                    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>
                                      {hasProcessingTools 
                                        ? `Executing ${processingTools.length} tool${processingTools.length > 1 ? 's' : ''}...`
                                        : 'Processing next step...'
                                      }
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Display regular message content - AI Elements Response primitive */}
                            {message.content && (
                              <Response 
                                isAnimating={isLoading && index === messages.length - 1}
                                parseIncompleteMarkdown={true}
                                components={{ a: LinkComponent as any }}
                                className="prose prose-invert max-w-none"
                              >
                                {message.content}
                              </Response>
                            )}
                          </>
                        ) : (
                          message.content
                        )}
                      </>
                    ) : (
                      isLoading && message.role === 'assistant' && (
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      )
                    )}
                  </div>
                    </div>
              );
            })}
          </>
        )}
      </div>

      <div className="input-form">
        <AgentComposerIntegration
          onSubmit={handleComposerSubmit}
          isLoading={isLoading}
          disabled={!settings?.apiKey}
          showSettings={true}
          onSettingsClick={() => setShowSettings(true)}
        />
      </div>
      <div ref={messagesEndRef} />
      
      {/* AI SDK Devtools - shows streaming events, tool calls, and performance metrics */}
      {settings?.devtoolsEnabled && (
        <AIDevtools
          modelId={browserToolsEnabled ? getComputerUseLabel() : (settings?.model || 'unknown')}
          debug={false}
        />
      )}
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <Provider initialMessages={[] as any}>
    <ChatSidebar />
  </Provider>
);