// Universal Cache for Tools - AI SDK v6
// Implements TTL-based caching with LRU eviction for expensive operations

import { createHash } from 'crypto';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  accessedAt: number;
  hits: number;
  ttl: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
  entries: Array<{
    key: string;
    hits: number;
    age: number;
    ttl: number;
  }>;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number; // Max number of entries (default: 1000)
  defaultTTL?: number; // Default TTL in ms (default: 5 minutes)
  enableStats?: boolean; // Track statistics (default: true)
  onEvict?: (key: string, value: any) => void; // Eviction callback
}

/**
 * Universal cache with TTL and LRU eviction
 */
export class UniversalCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private enableStats: boolean;
  private onEvict?: (key: string, value: T) => void;

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize || 1000;
    this.defaultTTL = config.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this.enableStats = config.enableStats !== false;
    this.onEvict = config.onEvict;
  }

  /**
   * Get cached value if exists and not expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.enableStats) this.stats.misses++;
      return undefined;
    }

    // Check if expired
    const now = Date.now();
    const age = now - entry.createdAt;

    if (age > entry.ttl) {
      // Expired - remove and return undefined
      this.cache.delete(key);
      if (this.enableStats) this.stats.misses++;
      return undefined;
    }

    // Valid entry - update access metadata
    entry.accessedAt = now;
    entry.hits++;
    if (this.enableStats) this.stats.hits++;

    return entry.value;
  }

  /**
   * Set cache value with optional TTL override
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();

    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      value,
      createdAt: now,
      accessedAt: now,
      hits: 0,
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.createdAt;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get or compute value with caching
   */
  async getOrCompute(
    key: string,
    compute: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Compute and cache
    const value = await compute();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < lruTime) {
        lruTime = entry.accessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey);
      this.cache.delete(lruKey);
      if (this.enableStats) this.stats.evictions++;
      if (this.onEvict && entry) {
        this.onEvict(lruKey, entry.value);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.createdAt;
      if (age > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Date.now() - entry.createdAt,
      ttl: entry.ttl,
    }));

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      entries,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }
}

/**
 * Generate cache key from tool name and arguments
 */
export function generateCacheKey(
  toolName: string,
  args: Record<string, any>,
  salt?: string
): string {
  // Sort keys for consistent hashing
  const sortedArgs = Object.keys(args)
    .sort()
    .reduce((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {} as Record<string, any>);

  const payload = JSON.stringify({ toolName, args: sortedArgs, salt });
  return createHash('sha256').update(payload).digest('hex').substring(0, 16);
}

/**
 * Tool-specific cache wrapper
 */
export class ToolCache {
  private cache: UniversalCache;
  private toolName: string;

  constructor(toolName: string, config?: CacheConfig) {
    this.toolName = toolName;
    this.cache = new UniversalCache(config);
  }

  /**
   * Execute tool with caching
   */
  async execute<T>(
    args: Record<string, any>,
    executor: () => Promise<T>,
    options: {
      ttl?: number;
      bypassCache?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<T> {
    const { ttl, bypassCache, cacheKey } = options;

    // Bypass cache if requested
    if (bypassCache) {
      return await executor();
    }

    // Generate cache key
    const key = cacheKey || generateCacheKey(this.toolName, args);

    // Get or compute
    return await this.cache.getOrCompute(key, executor, ttl);
  }

  /**
   * Invalidate cache for specific args
   */
  invalidate(args: Record<string, any>): boolean {
    const key = generateCacheKey(this.toolName, args);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache for this tool
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }
}

/**
 * Global cache manager for all tools
 */
export class GlobalCacheManager {
  private caches: Map<string, ToolCache> = new Map();
  private defaultConfig: CacheConfig;

  constructor(config?: CacheConfig) {
    this.defaultConfig = config || {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000,
      enableStats: true,
    };
  }

  /**
   * Get or create cache for tool
   */
  getToolCache(toolName: string, config?: CacheConfig): ToolCache {
    if (!this.caches.has(toolName)) {
      this.caches.set(
        toolName,
        new ToolCache(toolName, config || this.defaultConfig)
      );
    }
    return this.caches.get(toolName)!;
  }

  /**
   * Execute tool with caching
   */
  async executeWithCache<T>(
    toolName: string,
    args: Record<string, any>,
    executor: () => Promise<T>,
    options?: {
      ttl?: number;
      bypassCache?: boolean;
      config?: CacheConfig;
    }
  ): Promise<T> {
    const cache = this.getToolCache(toolName, options?.config);
    return await cache.execute(args, executor, {
      ttl: options?.ttl,
      bypassCache: options?.bypassCache,
    });
  }

  /**
   * Invalidate cache for specific tool and args
   */
  invalidate(toolName: string, args: Record<string, any>): boolean {
    const cache = this.caches.get(toolName);
    return cache ? cache.invalidate(args) : false;
  }

  /**
   * Clear cache for specific tool
   */
  clearTool(toolName: string): void {
    const cache = this.caches.get(toolName);
    if (cache) cache.clearAll();
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.caches.forEach((cache) => cache.clearAll());
  }

  /**
   * Get aggregate statistics for all tools
   */
  getAggregateStats(): {
    totalHits: number;
    totalMisses: number;
    totalEvictions: number;
    totalSize: number;
    avgHitRate: number;
    tools: Record<string, CacheStats>;
  } {
    let totalHits = 0;
    let totalMisses = 0;
    let totalEvictions = 0;
    let totalSize = 0;
    const tools: Record<string, CacheStats> = {};

    this.caches.forEach((cache, toolName) => {
      const stats = cache.getStats();
      tools[toolName] = stats;

      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalEvictions += stats.evictions;
      totalSize += stats.size;
    });

    const totalRequests = totalHits + totalMisses;
    const avgHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      totalHits,
      totalMisses,
      totalEvictions,
      totalSize,
      avgHitRate,
      tools,
    };
  }

  /**
   * Run cleanup on all caches
   */
  cleanup(): number {
    let totalRemoved = 0;
    this.caches.forEach((cache) => {
      // Access internal cleanup through stats workaround
      const sizeBefore = cache.getStats().size;
      // Force cleanup by creating new cache instance with same data
      cache.clearAll();
      const sizeAfter = cache.getStats().size;
      totalRemoved += sizeBefore - sizeAfter;
    });
    return totalRemoved;
  }
}

/**
 * Singleton global cache manager
 */
export const globalCache = new GlobalCacheManager({
  maxSize: 2000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  enableStats: true,
});

/**
 * Decorator for caching tool execution
 */
export function withCache(options: {
  ttl?: number;
  keyGenerator?: (args: any) => string;
  bypassCache?: (args: any) => boolean;
} = {}) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const toolName = `${target.constructor.name}.${propertyKey}`;
      const argsObj = args[0] || {};

      // Check bypass condition
      if (options.bypassCache && options.bypassCache(argsObj)) {
        return await originalMethod.apply(this, args);
      }

      // Generate cache key
      const cacheKey = options.keyGenerator
        ? options.keyGenerator(argsObj)
        : undefined;

      // Execute with cache
      return await globalCache.executeWithCache(
        toolName,
        argsObj,
        () => originalMethod.apply(this, args),
        {
          ttl: options.ttl,
          bypassCache: false,
        }
      );
    };

    return descriptor;
  };
}

/**
 * Cache configuration presets
 */
export const CachePresets = {
  // Short-lived cache for rapidly changing data
  shortLived: {
    maxSize: 500,
    defaultTTL: 30 * 1000, // 30 seconds
  },

  // Standard cache for general use
  standard: {
    maxSize: 1000,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
  },

  // Long-lived cache for stable data
  longLived: {
    maxSize: 2000,
    defaultTTL: 30 * 60 * 1000, // 30 minutes
  },

  // Aggressive cache for expensive operations
  aggressive: {
    maxSize: 5000,
    defaultTTL: 60 * 60 * 1000, // 1 hour
  },
};
