// Comprehensive unit test for the background EXECUTE_TOOL navigate handler with telemetry
// Run with: npx tsx tests/navigation.test.ts (or via npm run test:navigation)

// 1) Setup a minimal chrome API mock used by background.ts
type MessageListener = (
  request: any,
  sender: any,
  sendResponse: (response?: any) => void
) => boolean | void;

const messageListeners: MessageListener[] = [];

let lastUpdatedUrl: string | null = null;
let updateCallCount = 0;

// Mock telemetry store
let mockTelemetryEvents: any[] = [];
let mockTelemetryStats = {
  totalNavigations: 0,
  successfulNavigations: 0,
  failedNavigations: 0,
  averageDuration: 0
};

// Expose a very small subset of the Chrome APIs used in background.ts
(globalThis as any).chrome = {
  sidePanel: {
    setPanelBehavior: async () => {},
  },
  action: {
    onClicked: { addListener: () => {} },
  },
  webNavigation: {
    onCompleted: { addListener: () => {} },
  },
  storage: {
    local: {
      get: (_keys: any, cb: (result: any) => void) => cb({}),
      set: (_obj: any) => {},
    },
  },
  runtime: {
    onMessage: {
      addListener: (fn: MessageListener) => {
        messageListeners.push(fn);
      },
    },
    sendMessage: (_msg: any, _cb?: (response: any) => void) => {},
  },
  tabs: {
    query: async (_query: any) => {
      return [
        { id: 1001, url: 'https://example.com', title: 'Example', active: true, highlighted: true },
      ];
    },
    update: async (tabId: number, updateProps: { url?: string }) => {
      if (!tabId) throw new Error('No tab id');
      if (updateProps.url) {
        lastUpdatedUrl = updateProps.url;
        updateCallCount++;
      }
      return { id: tabId, url: updateProps.url };
    },
    get: async (tabId: number) => ({ id: tabId, url: lastUpdatedUrl ?? 'https://example.com', title: 'Updated' }),
  },
  windows: {
    getLastFocused: async () => ({ id: 1, tabs: [] as any[] }),
  },
  scripting: {
    executeScript: async () => {},
  },
  history: { search: (_opts: any, cb: (results: any[]) => void) => cb([]) },
  bookmarks: { getTree: (cb: (tree: any) => void) => cb([]) },
};

// 2) Import the background file so it registers the onMessage listener
await import('../background');

// Helper to invoke the registered onMessage listener and await async sendResponse
async function invokeMessage(request: any): Promise<any> {
  const listener = messageListeners[0];
  if (!listener) throw new Error('No onMessage listener registered');

  return new Promise((resolve, reject) => {
    try {
      const keepOpen = listener(request, {}, (response: any) => resolve(response));
      // If the listener did not return true (async), still resolve synchronously
      if (keepOpen !== true) resolve(undefined);
    } catch (err) {
      reject(err);
    }
  });
}

// Helper to get telemetry data
async function getTelemetry(): Promise<any> {
  return new Promise((resolve) => {
    const listener = messageListeners[0];
    listener({ type: 'GET_TELEMETRY' }, {}, (response: any) => {
      resolve(response);
    });
  });
}

// Helper to clear telemetry
async function clearTelemetry(): Promise<any> {
  return new Promise((resolve) => {
    const listener = messageListeners[0];
    listener({ type: 'CLEAR_TELEMETRY' }, {}, (response: any) => {
      resolve(response);
    });
  });
}

// 3) Tests
function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

async function testValidNavigate() {
  console.log('\n📋 Test: Valid navigation with telemetry...');
  const url = 'https://www.google.com';
  const res = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url } });

  assert(res && res.success === true, 'navigate should succeed');
  assert(res.url === url, 'navigate should echo target url');
  assert(lastUpdatedUrl === url, 'tabs.update should be called with url');

  // Verify telemetry was recorded
  const telemetry = await getTelemetry();
  assert(telemetry.telemetry.events.length > 0, 'Telemetry events should be recorded');
  const lastEvent = telemetry.telemetry.events[telemetry.telemetry.events.length - 1];
  assert(lastEvent.toolName === 'navigate', 'Event should be for navigate tool');
  assert(lastEvent.success === true, 'Event should indicate success');
  assert(typeof lastEvent.duration === 'number', 'Event should have duration');
  assert(lastEvent.parameters.url === url, 'Event should record URL parameter');
  assert(lastEvent.tabId === 1001, 'Event should record tab ID');

  // Verify stats
  assert(telemetry.telemetry.stats.totalNavigations > 0, 'Stats should track total navigations');
  assert(telemetry.telemetry.stats.successfulNavigations > 0, 'Stats should track successful navigations');

  console.log('  ✓ Navigation succeeded with telemetry tracked');
  console.log(`  ✓ Duration: ${lastEvent.duration}ms`);
  console.log(`  ✓ Tab ID: ${lastEvent.tabId}`);
}

async function testInvalidUrl() {
  console.log('\n📋 Test: Invalid URL with telemetry...');
  const res = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url: 'chrome://extensions' } });

  assert(res && res.success === false, 'navigate should fail for invalid URL');
  assert(typeof res.error === 'string', 'error message should be present');
  assert(res.error.includes('Invalid'), 'error should mention invalid URL');

  // Verify telemetry was recorded for failure
  const telemetry = await getTelemetry();
  const lastEvent = telemetry.telemetry.events[telemetry.telemetry.events.length - 1];
  assert(lastEvent.success === false, 'Event should indicate failure');
  assert(typeof lastEvent.error === 'string', 'Event should record error message');
  assert(lastEvent.error.includes('Invalid'), 'Event error should match response error');

  console.log('  ✓ Failed navigation tracked in telemetry');
  console.log(`  ✓ Error recorded: ${lastEvent.error}`);
}

async function testMissingUrl() {
  console.log('\n📋 Test: Missing URL parameter with telemetry...');
  const res = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: {} });

  assert(res && res.success === false, 'navigate should fail for missing URL');
  assert(typeof res.error === 'string', 'error message should be present');

  // Verify telemetry
  const telemetry = await getTelemetry();
  const lastEvent = telemetry.telemetry.events[telemetry.telemetry.events.length - 1];
  assert(lastEvent.success === false, 'Event should indicate failure');
  assert(lastEvent.error.includes('missing'), 'Event should mention missing URL');

  console.log('  ✓ Missing URL tracked in telemetry');
  console.log(`  ✓ Error: ${lastEvent.error}`);
}

async function testHttpUrl() {
  console.log('\n📋 Test: HTTP URL (should work)...');
  const url = 'http://example.com';
  const res = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url } });

  assert(res && res.success === true, 'navigate should succeed for HTTP URLs');
  assert(res.url === url, 'navigate should echo target URL');

  // Verify telemetry
  const telemetry = await getTelemetry();
  const lastEvent = telemetry.telemetry.events[telemetry.telemetry.events.length - 1];
  assert(lastEvent.success === true, 'HTTP navigation should be tracked as success');

  console.log('  ✓ HTTP URL navigation tracked successfully');
}

async function testAlternativeParameterNames() {
  console.log('\n📋 Test: Alternative parameter names (target, href)...');

  // Test with 'target' parameter
  const url1 = 'https://example.com/target';
  const res1 = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { target: url1 } });
  assert(res1 && res1.success === true, 'navigate should work with target parameter');
  assert(res1.url === url1, 'navigate should echo target URL');

  // Test with 'href' parameter
  const url2 = 'https://example.com/href';
  const res2 = await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { href: url2 } });
  assert(res2 && res2.success === true, 'navigate should work with href parameter');
  assert(res2.url === url2, 'navigate should echo href URL');

  console.log('  ✓ Alternative parameter names work correctly');
}

async function testTelemetryStats() {
  console.log('\n📋 Test: Telemetry statistics tracking...');

  // Clear and verify
  await clearTelemetry();
  let telemetry = await getTelemetry();
  assert(telemetry.telemetry.stats.totalNavigations === 0, 'Stats should be cleared');

  // Perform several navigations
  await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url: 'https://test1.com' } });
  await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url: 'https://test2.com' } });
  await invokeMessage({ type: 'EXECUTE_TOOL', toolName: 'navigate', parameters: { url: 'invalid-url' } });

  // Verify stats
  telemetry = await getTelemetry();
  assert(telemetry.telemetry.stats.totalNavigations === 3, 'Should track total navigations');
  assert(telemetry.telemetry.stats.successfulNavigations === 2, 'Should track successful navigations');
  assert(telemetry.telemetry.stats.failedNavigations === 1, 'Should track failed navigations');
  assert(typeof telemetry.telemetry.stats.averageDuration === 'number', 'Should calculate average duration');

  console.log('  ✓ Total navigations: 3');
  console.log('  ✓ Successful: 2, Failed: 1');
  console.log(`  ✓ Average duration: ${telemetry.telemetry.stats.averageDuration.toFixed(2)}ms`);
}

async function run() {
  console.log('🧪 Running navigation tests with telemetry...\n');
  console.log('=' .repeat(50));

  try {
    // Clear telemetry before tests
    await clearTelemetry();

    await testValidNavigate();
    await testInvalidUrl();
    await testMissingUrl();
    await testHttpUrl();
    await testAlternativeParameterNames();
    await testTelemetryStats();

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All navigation step tests passed!\n');
    console.log('Telemetry verification:');
    const finalTelemetry = await getTelemetry();
    console.log(`  • Total events recorded: ${finalTelemetry.telemetry.events.length}`);
    console.log(`  • Success rate: ${((finalTelemetry.telemetry.stats.successfulNavigations / finalTelemetry.telemetry.stats.totalNavigations) * 100).toFixed(1)}%`);

  } catch (err) {
    console.error('\n❌ Navigation step tests failed:', err);
    process.exit(1);
  }
}

await run();

