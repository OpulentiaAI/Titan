// Universal Caching Integration Examples
// Demonstrates how to integrate caching with browser automation tools

import {
  globalCache,
  ToolCache,
  withCache,
  CachePresets,
  generateCacheKey,
} from '../lib/universal-cache';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Example 1: Basic Tool Caching
 */
export async function exampleBasicToolCaching() {
  // Create cache for getPageContext tool
  const pageContextCache = new ToolCache('getPageContext', {
    maxSize: 100,
    defaultTTL: 60 * 1000, // 1 minute
  });

  // Execute with caching
  const result1 = await pageContextCache.execute(
    { url: 'https://github.com' },
    async () => {
      console.log('Executing getPageContext (cache miss)');
      return {
        url: 'https://github.com',
        title: 'GitHub',
        text: 'Build software better, together',
        links: [],
        forms: [],
      };
    }
  );

  // Second call uses cache
  const result2 = await pageContextCache.execute(
    { url: 'https://github.com' },
    async () => {
      console.log('This should not execute (cache hit)');
      return { url: 'https://github.com' };
    }
  );

  console.log('Cache stats:', pageContextCache.getStats());
  // Output: { hits: 1, misses: 1, hitRate: 0.5, ... }
}

/**
 * Example 2: Using Global Cache Manager
 */
export async function exampleGlobalCacheManager() {
  // Execute tools with automatic caching
  const navigate1 = await globalCache.executeWithCache(
    'navigate',
    { url: 'https://example.com' },
    async () => {
      console.log('Navigating to example.com');
      return { success: true, url: 'https://example.com' };
    },
    { ttl: 2 * 60 * 1000 } // 2 minutes
  );

  const navigate2 = await globalCache.executeWithCache(
    'navigate',
    { url: 'https://example.com' },
    async () => {
      console.log('This should not execute');
      return { success: true };
    }
  );

  // Get aggregate stats
  const stats = globalCache.getAggregateStats();
  console.log('Aggregate stats:', stats);
  console.log('Navigate tool stats:', stats.tools['navigate']);
}

/**
 * Example 3: Tool Wrapper with Caching
 */
export function createCachedNavigateTool(config?: {
  ttl?: number;
  bypassCache?: boolean;
}) {
  return tool({
    description: 'Navigate to a URL with caching',
    parameters: z.object({
      url: z.string().url(),
    }),
    execute: async ({ url }: { url: string }) => {
      return await globalCache.executeWithCache(
        'navigate',
        { url },
        async () => {
          // Actual navigation logic
          console.log(`Navigating to ${url}`);
          return {
            success: true,
            url,
            timestamp: Date.now(),
          };
        },
        {
          ttl: config?.ttl,
          bypassCache: config?.bypassCache,
        }
      );
    },
  });
}

export function createCachedGetPageContextTool() {
  return tool({
    description: 'Get page context with caching',
    parameters: z.object({
      includeScreenshot: z.boolean().optional(),
    }),
    execute: async ({ includeScreenshot }: { includeScreenshot?: boolean }) => {
      // Different cache key based on screenshot flag
      const cacheKey = generateCacheKey(
        'getPageContext',
        { includeScreenshot },
        'page-context-v1'
      );

      return await globalCache.executeWithCache(
        'getPageContext',
        { includeScreenshot },
        async () => {
          console.log('Fetching page context');
          return {
            url: 'https://current-page.com',
            title: 'Current Page',
            text: 'Page content...',
            screenshot: includeScreenshot ? 'base64-data' : undefined,
          };
        },
        {
          ttl: includeScreenshot ? 30 * 1000 : 60 * 1000, // Screenshots expire faster
        }
      );
    },
  });
}

/**
 * Example 4: Decorator-based Caching
 */
export class BrowserAutomationService {
  @withCache({
    ttl: 5 * 60 * 1000, // 5 minutes
    keyGenerator: (args) => `nav:${args.url}`,
  })
  async navigate(args: { url: string }) {
    console.log(`Navigating to ${args.url}`);
    return {
      success: true,
      url: args.url,
      timestamp: Date.now(),
    };
  }

  @withCache({
    ttl: 60 * 1000, // 1 minute
    bypassCache: (args) => args.forceRefresh === true,
  })
  async getPageContext(args: { forceRefresh?: boolean }) {
    console.log('Fetching page context');
    return {
      url: 'https://current-page.com',
      title: 'Current Page',
      text: 'Content...',
    };
  }
}

/**
 * Example 5: Cache Invalidation Strategies
 */
export class CacheManager {
  /**
   * Invalidate cache when page changes
   */
  async onPageChange(newUrl: string) {
    // Invalidate all page context caches
    globalCache.clearTool('getPageContext');

    // Invalidate navigation cache for old URL
    globalCache.invalidate('navigate', { url: newUrl });

    console.log('Cache invalidated for page change');
  }

  /**
   * Invalidate cache after user interaction
   */
  async onUserInteraction(interaction: { type: string; target: string }) {
    // If user clicks or types, invalidate page context
    if (['click', 'type'].includes(interaction.type)) {
      globalCache.clearTool('getPageContext');
    }

    console.log('Cache invalidated after user interaction');
  }

  /**
   * Periodic cache cleanup
   */
  startPeriodicCleanup(intervalMs: number = 5 * 60 * 1000) {
    setInterval(() => {
      const removed = globalCache.cleanup();
      console.log(`Cleaned up ${removed} expired cache entries`);
    }, intervalMs);
  }
}

/**
 * Example 6: Conditional Caching Based on Tool Type
 */
export function createSmartCachedTool(
  toolName: string,
  executor: (args: any) => Promise<any>,
  options?: {
    cacheable?: (args: any) => boolean;
    ttl?: (args: any) => number;
  }
) {
  return tool({
    description: `Smart cached ${toolName}`,
    parameters: z.record(z.any()),
    execute: async (args: any) => {
      // Check if this call should be cached
      const shouldCache = options?.cacheable ? options.cacheable(args) : true;

      if (!shouldCache) {
        return await executor(args);
      }

      // Determine TTL based on args
      const ttl = options?.ttl ? options.ttl(args) : undefined;

      return await globalCache.executeWithCache(toolName, args, () => executor(args), {
        ttl,
        bypassCache: !shouldCache,
      });
    },
  });
}

/**
 * Example 7: Caching Configuration for Different Tool Types
 */
export const ToolCachingStrategies = {
  // Read-only tools: aggressive caching
  getPageContext: {
    ...CachePresets.standard,
    defaultTTL: 60 * 1000, // 1 minute
  },

  getBrowserHistory: {
    ...CachePresets.longLived,
    defaultTTL: 10 * 60 * 1000, // 10 minutes
  },

  // Navigation: moderate caching
  navigate: {
    ...CachePresets.standard,
    defaultTTL: 2 * 60 * 1000, // 2 minutes
  },

  // Interactive tools: no caching or very short TTL
  click: {
    ...CachePresets.shortLived,
    defaultTTL: 5 * 1000, // 5 seconds
  },

  type: {
    maxSize: 0, // No caching
    defaultTTL: 0,
  },

  // Screenshot: short-lived cache
  screenshot: {
    ...CachePresets.shortLived,
    defaultTTL: 30 * 1000, // 30 seconds
  },
};

/**
 * Example 8: Cache-aware Tool Factory
 */
export function createCacheAwareTools(executeTool: (name: string, args: any) => Promise<any>) {
  return {
    navigate: createSmartCachedTool(
      'navigate',
      async (args) => executeTool('navigate', args),
      {
        cacheable: (args) => !args.bypassCache,
        ttl: () => ToolCachingStrategies.navigate.defaultTTL,
      }
    ),

    getPageContext: createSmartCachedTool(
      'getPageContext',
      async (args) => executeTool('getPageContext', args),
      {
        cacheable: () => true,
        ttl: () => ToolCachingStrategies.getPageContext.defaultTTL,
      }
    ),

    click: createSmartCachedTool(
      'click',
      async (args) => executeTool('click', args),
      {
        cacheable: () => false, // Never cache interactive tools
      }
    ),

    screenshot: createSmartCachedTool(
      'screenshot',
      async (args) => executeTool('screenshot', args),
      {
        cacheable: () => true,
        ttl: () => ToolCachingStrategies.screenshot.defaultTTL,
      }
    ),
  };
}

/**
 * Example 9: Monitoring Cache Performance
 */
export function monitorCachePerformance() {
  setInterval(() => {
    const stats = globalCache.getAggregateStats();

    console.log('=== Cache Performance Report ===');
    console.log(`Total requests: ${stats.totalHits + stats.totalMisses}`);
    console.log(`Hit rate: ${(stats.avgHitRate * 100).toFixed(2)}%`);
    console.log(`Cache size: ${stats.totalSize} entries`);
    console.log(`Evictions: ${stats.totalEvictions}`);
    console.log('\nPer-tool statistics:');

    Object.entries(stats.tools).forEach(([toolName, toolStats]) => {
      const requests = toolStats.hits + toolStats.misses;
      if (requests > 0) {
        console.log(
          `  ${toolName}: ${toolStats.hits}/${requests} hits (${(toolStats.hitRate * 100).toFixed(1)}%)`
        );
      }
    });

    console.log('================================\n');
  }, 60 * 1000); // Report every minute
}

/**
 * Example 10: Integration with Enhanced Streaming
 */
export async function enhancedStreamingWithCaching(
  model: any,
  tools: Record<string, any>,
  messages: any[]
) {
  // Wrap tools with caching
  const cachedTools = Object.entries(tools).reduce((acc, [name, toolDef]) => {
    const originalExecute = toolDef.execute;

    acc[name] = {
      ...toolDef,
      execute: async (args: any) => {
        // Determine if this tool should be cached
        const strategy = (ToolCachingStrategies as any)[name];

        if (!strategy || strategy.maxSize === 0) {
          // No caching for this tool
          return await originalExecute(args);
        }

        // Execute with caching
        return await globalCache.executeWithCache(
          name,
          args,
          () => originalExecute(args),
          {
            ttl: strategy.defaultTTL,
            config: strategy,
          }
        );
      },
    };

    return acc;
  }, {} as Record<string, any>);

  // Use cached tools in streaming
  const { enhancedStreamingStep } = await import('../lib/streaming-enhanced');

  const result = await enhancedStreamingStep({
    model,
    tools: cachedTools,
    messages,
    system: 'Execute browser automation with intelligent caching',
    updateLastMessage: () => {},
    pushMessage: () => {},
    enableStructuredOutput: true,
  });

  // Log cache performance
  console.log('Cache performance:', globalCache.getAggregateStats());

  return result;
}

/**
 * Usage in workflow
 */
export async function workflowWithCaching() {
  // Configure caching strategies
  Object.entries(ToolCachingStrategies).forEach(([toolName, config]) => {
    globalCache.getToolCache(toolName, config);
  });

  // Start monitoring
  monitorCachePerformance();

  // Create cache manager
  const cacheManager = new CacheManager();
  cacheManager.startPeriodicCleanup();

  // Execute workflow with cached tools
  console.log('Workflow with intelligent caching enabled');
}
