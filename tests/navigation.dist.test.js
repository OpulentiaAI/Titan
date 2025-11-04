// Unit test for dist/background.js EXECUTE_TOOL navigate handler
// Run with: node tests/navigation.dist.test.js

const messageListeners = [];
let lastUpdatedUrl = null;

global.chrome = {
  sidePanel: { setPanelBehavior: async () => ({}) },
  action: { onClicked: { addListener: () => {} } },
  webNavigation: { onCompleted: { addListener: () => {} } },
  storage: { local: { get: (_k, cb) => cb({}), set: (_o) => {} } },
  runtime: {
    onMessage: { addListener: (fn) => messageListeners.push(fn) },
    sendMessage: (_msg, _cb) => {},
  },
  tabs: {
    query: async () => [{ id: 2001, url: 'https://example.com', title: 'Example', active: true, highlighted: true }],
    update: async (tabId, updateProps) => {
      if (updateProps && updateProps.url) lastUpdatedUrl = updateProps.url;
      return { id: tabId, url: updateProps.url };
    },
    get: async (tabId) => ({ id: tabId, url: lastUpdatedUrl ?? 'https://example.com', title: 'Updated' }),
    sendMessage: async (_tabId, payload) => ({ success: true, echo: payload }),
    captureVisibleTab: async () => 'data:image/png;base64,xyz',
  },
  windows: { getLastFocused: async () => ({ id: 1, tabs: [{ id: 2001, url: 'https://example.com', active: true, highlighted: true }] }) },
  scripting: { executeScript: async () => {} },
  history: { search: (_opts, cb) => cb([]) },
  bookmarks: { getTree: (cb) => cb([]) },
};

// Import compiled background script (registers the listener)
await import('../dist/background.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function invokeMessage(request) {
  const listener = messageListeners[0];
  if (!listener) throw new Error('No onMessage listener registered');
  return new Promise((resolve, reject) => {
    try {
      const keepOpen = listener(request, {}, (res) => resolve(res));
      if (keepOpen !== true) resolve(undefined);
    } catch (e) { reject(e); }
  });
}

(async () => {
  try {
    // Valid navigate
    const target = 'https://www.google.com';
    const ok = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url: target } });
    assert(ok && ok.success === true, 'navigate should succeed');
    assert(ok.url === target, 'url should echo back');
    assert(lastUpdatedUrl === target, 'tabs.update called with url');
    console.log('✔ dist valid navigate');

    // Invalid (non-http) navigate
    const bad = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url: 'chrome://extensions' } });
    assert(bad && bad.success === false, 'navigate should fail for invalid schema');
    console.log('✔ dist invalid navigate');

    console.log('\nAll dist navigation tests passed.');
  } catch (err) {
    console.error('Dist navigation tests failed:', err);
    process.exit(1);
  }
})();
