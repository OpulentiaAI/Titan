// Polyfills for Node.js test environment
// Some dependencies may expect browser/runtime globals

// Polyfill for Next.js edge runtime __name helper
// Must be set on global scope before any modules are loaded
(globalThis as any).__name = (globalThis as any).__name || ((target: any, value: string) => {
  try {
    Object.defineProperty(target, 'name', { value, configurable: true });
  } catch (e) {
    // Ignore if already defined
  }
});

// Also set on global object for compatibility
(global as any).__name = (globalThis as any).__name;

// Export for explicit import if needed
export {};

