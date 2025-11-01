// Setup file - must be loaded before any other code
// Polyfills for Node.js test environment

// Polyfill for Next.js edge runtime __name helper
(globalThis as any).__name = (globalThis as any).__name || ((target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {
    // Ignore if already defined
  }
});

// Ensure it's available on both globalThis and global
(global as any).__name = (globalThis as any).__name;

