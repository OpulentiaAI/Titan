// Background service worker for the extension

// Memory store for browser context
interface BrowserMemory {
  recentPages: Array<{ url: string; title: string; timestamp: number; context?: any }>;
  userPreferences: Record<string, any>;
  sessionData: Record<string, any>;
}

const memory: BrowserMemory = {
  recentPages: [],
  userPreferences: {},
  sessionData: {}
};

// Telemetry store for tracking tool execution
interface TelemetryEvent {
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  parameters?: any;
  tabId?: number;
}

const telemetryStore: {
  events: TelemetryEvent[];
  stats: {
    totalNavigations: number;
    successfulNavigations: number;
    failedNavigations: number;
    averageDuration: number;
  };
} = {
  events: [],
  stats: {
    totalNavigations: 0,
    successfulNavigations: 0,
    failedNavigations: 0,
    averageDuration: 0
  }
};

// Helper function to get active tab with retry logic
async function getActiveTabWithRetry(maxRetries = 3, delayMs = 100): Promise<chrome.tabs.Tab | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get the currently focused window with windowTypes to exclude devtools
      const currentWindow = await chrome.windows.getLastFocused({
        populate: true,
        windowTypes: ['normal']
      });

      if (!currentWindow || !currentWindow.tabs) {
        if (attempt === maxRetries) {
          console.warn('[getActiveTabWithRetry] No focused window found after all retries');
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // Get the active AND highlighted tab (the one that's actually visible to the user)
      let activeTab = currentWindow.tabs.find(tab => tab.active === true && tab.highlighted === true);

      // Fallback to just active if highlighted not found
      if (!activeTab) {
        activeTab = currentWindow.tabs.find(tab => tab.active === true);
      }

      if (activeTab) {
        return activeTab;
      }

      if (attempt === maxRetries) {
        console.warn('[getActiveTabWithRetry] No active tab found after all retries');
        return null;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      console.warn(`[getActiveTabWithRetry] Attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        console.error('[getActiveTabWithRetry] All attempts failed');
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

// Function to record telemetry
function recordTelemetry(event: Omit<TelemetryEvent, 'timestamp'>): void {
  const telemetryEvent: TelemetryEvent = {
    ...event,
    timestamp: Date.now()
  };

  telemetryStore.events.push(telemetryEvent);

  // Keep only last 1000 events to prevent memory issues
  if (telemetryStore.events.length > 1000) {
    telemetryStore.events.shift();
  }

  // Update stats
  telemetryStore.stats.totalNavigations++;
  if (event.success) {
    telemetryStore.stats.successfulNavigations++;
  } else {
    telemetryStore.stats.failedNavigations++;
  }

  // Calculate running average
  const successfulEvents = telemetryStore.events.filter(e => e.success);
  if (successfulEvents.length > 0) {
    telemetryStore.stats.averageDuration =
      successfulEvents.reduce((sum, e) => sum + e.duration, 0) / successfulEvents.length;
  }

  // Log telemetry for debugging
  console.log(`[TELEMETRY] ${event.toolName}: ${event.success ? 'SUCCESS' : 'FAILURE'} (${event.duration}ms)`,
    event.error ? `Error: ${event.error}` : '');
}

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: Error) => console.error(error));

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Track page visits for memory
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab.url && tab.title) {
        addToMemory({
          url: tab.url,
          title: tab.title,
          timestamp: Date.now()
        });
      }
    });
  }
});

// Add page to memory
function addToMemory(page: { url: string; title: string; timestamp: number }) {
  memory.recentPages.unshift(page);
  if (memory.recentPages.length > 100) {
    memory.recentPages.pop();
  }

  // Save to chrome.storage for persistence
  chrome.storage.local.set({ browserMemory: memory });
}

// Load memory from storage on startup
chrome.storage.local.get('browserMemory', (result) => {
  if (result.browserMemory) {
    Object.assign(memory, result.browserMemory);
  }
});

// Listen for messages from the sidebar and content scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Get current tab info
  if (request.type === 'GET_TAB_INFO') {
    (async () => {
      try {
        const activeTab = await getActiveTabWithRetry();
        if (activeTab) {
          sendResponse({
            url: activeTab.url,
            title: activeTab.title,
            id: activeTab.id
          });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      } catch (error) {
        console.error('[GET_TAB_INFO] Error:', error);
        sendResponse({ error: 'Failed to get tab info' });
      }
    })();
    return true;
  }

  // Generic tool execution router for sidepanel/workflow
  if (request.type === 'EXECUTE_TOOL') {
    (async () => {
      try {
        const toolName: string = request.toolName;
        // Support both `parameters` and `params` from different callers
        const params: any = request.parameters || request.params || {};

        // Helper to get active tab id with retry logic
        const getActiveTabId = async (): Promise<number | null> => {
          const activeTab = await getActiveTabWithRetry();
          return activeTab?.id ?? null;
        };

        if (toolName === 'navigate') {
          const startTime = Date.now();
          const url: string | undefined = params.url || params.target || params.href;
          const tabId = await getActiveTabId();

          try {
            if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) {
              const duration = Date.now() - startTime;
              recordTelemetry({
                toolName: 'navigate',
                duration,
                success: false,
                error: 'Invalid or missing URL for navigate',
                parameters: { url, hasUrl: !!url, protocol: url?.split('://')[0] },
                tabId: tabId || undefined
              });
              sendResponse({ success: false, error: 'Invalid or missing URL for navigate' });
              return;
            }

            if (!tabId) {
              const duration = Date.now() - startTime;
              recordTelemetry({
                toolName: 'navigate',
                duration,
                success: false,
                error: 'No active tab found',
                parameters: { url },
                tabId: undefined
              });
              sendResponse({ success: false, error: 'No active tab found' });
              return;
            }

            await chrome.tabs.update(tabId, { url });
            const duration = Date.now() - startTime;
            recordTelemetry({
              toolName: 'navigate',
              duration,
              success: true,
              parameters: { url, tabId },
              tabId
            });
            sendResponse({ success: true, url });
            return;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            recordTelemetry({
              toolName: 'navigate',
              duration,
              success: false,
              error: errorMessage,
              parameters: { url, tabId },
              tabId: tabId || undefined
            });
            sendResponse({ success: false, error: errorMessage });
            return;
          }
        }

        if (toolName === 'getPageContext') {
          const tabId = await getActiveTabId();
          if (!tabId) {
            sendResponse({ success: false, error: 'No active tab found' });
            return;
          }
          await ensureContentScript(tabId);
          const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' });
          sendResponse(response);
          return;
        }

        // Map tool names to content-script actions
        const actionMap: Record<string, string> = {
          click: 'click',
          click_at: 'click',
          clickElement: 'click',
          type: 'fill',
          type_text: 'fill',
          type_text_at: 'fill',
          typeText: 'fill',
          scroll: 'scroll',
          scroll_down: 'scroll',
          scroll_up: 'scroll',
          pressKey: 'press_key',
          press_key: 'press_key',
          keyCombo: 'key_combination',
          key_combination: 'key_combination',
          dragDrop: 'drag_drop',
          drag_drop: 'drag_drop',
          keyboardType: 'keyboard_type',
          clearInput: 'clear_input',
          hover: 'hover',
          mouseMove: 'mouse_move',
          wait: 'wait',
          wait_for: 'wait',
          getBrowserHistory: 'get_browser_history',
        };

        if (toolName === 'screenshot') {
          // Reuse the existing screenshot flow by delegating
          chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' }, (resp) => {
            sendResponse(resp);
          });
          return true; // Keep channel open for async response
        }

        const action = actionMap[toolName] || toolName;
        const tabId = await getActiveTabId();
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }
        await ensureContentScript(tabId);

        // Build EXECUTE_ACTION payload for content script
        const payload = {
          type: 'EXECUTE_ACTION',
          action,
          target: params.selector || params.target,
          selector: params.selector,
          value: params.value || params.text,
          coordinates: params.coordinates,
          direction: params.direction,
          amount: params.amount,
          key: params.key,
          keys: params.keys,
          destination: params.destination,
        };

        const response = await chrome.tabs.sendMessage(tabId, payload);
        sendResponse(response);
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  // Get browser history
  if (request.type === 'GET_HISTORY') {
    const query = request.query || '';
    const maxResults = request.maxResults || 100;
    const startTime = request.startTime || Date.now() - (7 * 24 * 60 * 60 * 1000); // Last 7 days

    chrome.history.search({
      text: query,
      maxResults,
      startTime
    }, (results) => {
      sendResponse({ history: results });
    });
    return true;
  }

  // Get browser memory
  if (request.type === 'GET_MEMORY') {
    sendResponse({ memory });
    return true;
  }

  // Get telemetry data
  if (request.type === 'GET_TELEMETRY') {
    sendResponse({ telemetry: telemetryStore });
    return true;
  }

  // Clear telemetry data
  if (request.type === 'CLEAR_TELEMETRY') {
    telemetryStore.events = [];
    telemetryStore.stats = {
      totalNavigations: 0,
      successfulNavigations: 0,
      failedNavigations: 0,
      averageDuration: 0
    };
    sendResponse({ success: true });
    return true;
  }

  // Get page context from content script
  // Helper function to ensure content script is injected
  async function ensureContentScript(tabId: number): Promise<void> {
    try {
      // Try to ping the content script
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    } catch (error) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (injectError) {
        throw injectError;
      }
    }
  }

  if (request.type === 'GET_PAGE_CONTEXT') {
    (async () => {
      try {
        const activeTab = await getActiveTabWithRetry();
        if (activeTab?.id) {
          await ensureContentScript(activeTab.id);
          const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PAGE_CONTEXT' });
          sendResponse(response); // Return response directly, not wrapped
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  // Execute action on page
  if (request.type === 'EXECUTE_ACTION') {
    (async () => {
      try {
        const activeTab = await getActiveTabWithRetry();
        if (activeTab?.id) {
          await ensureContentScript(activeTab.id);
          const response = await chrome.tabs.sendMessage(activeTab.id, {
            type: 'EXECUTE_ACTION',
            action: request.action,
            target: request.target,
            selector: request.selector,
            value: request.value,
            key: request.key,
            keys: request.keys,
            coordinates: request.coordinates,
            destination: request.destination,
            direction: request.direction,
            amount: request.amount
          });
          sendResponse(response);
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  // Take screenshot
  if (request.type === 'TAKE_SCREENSHOT') {
    (async () => {
      try {

        // Define restricted protocols (but allow regular web pages)
        const restrictedProtocols = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://'];
        const isRestricted = (url: string | undefined) => {
          if (!url) return true;
          // Allow http:// and https:// pages (including google.com)
          if (url.startsWith('http://') || url.startsWith('https://')) return false;
          // Block internal browser pages
          return restrictedProtocols.some(protocol => url.startsWith(protocol));
        };

        // Get the currently focused window with windowTypes to exclude devtools
        const currentWindow = await chrome.windows.getLastFocused({
          populate: true,
          windowTypes: ['normal']
        });

        if (!currentWindow || !currentWindow.tabs) {
          console.error('❌ No focused window found');
          sendResponse({ success: false, error: 'No browser window found' });
          return;
        }

        // Get the active AND highlighted tab (the one that's actually visible to the user)
        let activeTab = currentWindow.tabs.find(tab => tab.active === true && tab.highlighted === true);

        // Fallback to just active if highlighted not found
        if (!activeTab) {
          activeTab = currentWindow.tabs.find(tab => tab.active === true);
        }

        if (!activeTab) {
          console.error('❌ No active tab found in window');
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }


        // Check if the current tab is restricted
        if (isRestricted(activeTab.url)) {
          // Navigate to google.com automatically
          if (activeTab.id) {
            await chrome.tabs.update(activeTab.id, { url: 'https://www.google.com' });

            // Wait for the page to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get the updated tab
            const updatedTab = await chrome.tabs.get(activeTab.id);

            // Update activeTab reference
            activeTab = updatedTab;
          } else {
            sendResponse({
              success: false,
              error: 'Cannot navigate from restricted page'
            });
            return;
          }
        }


        // Ensure windowId is defined
        if (currentWindow.id === undefined) {
          throw new Error('Window ID is undefined');
        }

        // Capture the visible tab in the current window
        const dataUrl = await chrome.tabs.captureVisibleTab(currentWindow.id, {
          format: 'png',
          quality: 80
        });

        sendResponse({ success: true, screenshot: dataUrl });
      } catch (error) {
        console.error('❌ Screenshot capture error:', error);

        // Provide more detailed error information
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Error details:', errorMsg);
        sendResponse({
          success: false,
          error: `Screenshot failed: ${errorMsg}`
        });
      }
    })().catch(err => {
      // Handle unhandled promise rejections from the IIFE
      console.error('[SCREENSHOT] Unhandled promise rejection:', err instanceof Error ? err.message : String(err));
    });
    return true;
  }

  // Navigate to URL
  if (request.type === 'NAVIGATE') {
    (async () => {
      try {
        const activeTab = await getActiveTabWithRetry();
        if (activeTab?.id) {
          await chrome.tabs.update(activeTab.id, { url: request.url });
          sendResponse({ success: true, url: request.url });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (request.type === 'EXECUTE_SCRIPT') {
    sendResponse({
      success: false,
      error: 'EXECUTE_SCRIPT is disabled for security reasons. Use content script messaging instead.'
    });
    return true;
  }

  // Get bookmarks
  if (request.type === 'GET_BOOKMARKS') {
    chrome.bookmarks.getTree((bookmarkTree) => {
      sendResponse({ bookmarks: bookmarkTree });
    });
    return true;
  }

  // Store in memory
  if (request.type === 'STORE_MEMORY') {
    const { key, value } = request;
    memory.sessionData[key] = value;
    chrome.storage.local.set({ browserMemory: memory });
    sendResponse({ success: true });
    return true;
  }

  // Page loaded notification from content script
  if (request.type === 'PAGE_LOADED') {
    console.log('Page loaded:', request.url);
    return false;
  }

  // Workflow-based chat endpoint
  if (request.type === 'WORKFLOW_CHAT_START') {
    (async () => {
      try {
        const { startWorkflowChat } = await import('./lib/workflow-chat-handler');
        const response = await startWorkflowChat({
          messages: request.messages,
          settings: request.settings,
        });

        // Store workflow run ID for resumption
        await chrome.storage.local.set({
          [`workflow-run-${response.workflowRunId}`]: {
            startTime: Date.now(),
            messages: request.messages,
          },
        });

        // Send workflow run ID in response
        sendResponse({
          success: true,
          workflowRunId: response.workflowRunId,
          // Note: Stream cannot be sent via chrome.runtime messaging
          // Sidepanel will need to use fetch or direct streaming
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  // Resume workflow chat stream
  if (request.type === 'WORKFLOW_CHAT_RESUME') {
    (async () => {
      try {
        const { resumeWorkflowChat } = await import('./lib/workflow-chat-handler');
        const stream = await resumeWorkflowChat(request.workflowRunId);

        if (!stream) {
          sendResponse({
            success: false,
            error: 'Workflow run not found or cannot be resumed',
          });
          return;
        }

        sendResponse({
          success: true,
          // Note: Stream needs to be handled differently
          // This is a simplified response
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  // Cancel workflow chat
  if (request.type === 'WORKFLOW_CHAT_CANCEL') {
    (async () => {
      try {
        const { cancelWorkflowChat } = await import('./lib/workflow-chat-handler');
        const cancelled = cancelWorkflowChat(request.workflowRunId);

        sendResponse({
          success: cancelled,
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  // Retry workflow task
  if (request.type === 'RETRY_TASK') {
    (async () => {
      try {
        const taskManager = (globalThis as any).currentWorkflowTaskManager;
        if (taskManager && typeof taskManager.retryTask === 'function') {
          taskManager.retryTask(request.taskId, 'Retried from UI');
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active task manager found' });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  // Cancel workflow task
  if (request.type === 'CANCEL_TASK') {
    (async () => {
      try {
        const taskManager = (globalThis as any).currentWorkflowTaskManager;
        if (taskManager && typeof taskManager.cancelTask === 'function') {
          taskManager.cancelTask(request.taskId);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active task manager found' });
        }
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }
});

console.log('Atlas background service worker loaded');
