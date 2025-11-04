// Guardrails System - Tool Permission and Safety Management
// Implements permission-based tool execution, rate limiting, and safety checks

import { z } from 'zod';

/**
 * Permission level for tools
 */
export type PermissionLevel = 'public' | 'restricted' | 'admin' | 'blocked';

/**
 * User/Agent role with permissions
 */
export interface Role {
  name: string;
  description: string;
  permissions: Permission[];
  rateLimits?: RateLimitConfig;
}

/**
 * Permission definition
 */
export interface Permission {
  tool: string | string[]; // Tool name or pattern (e.g., "navigate", "type_*")
  level: PermissionLevel;
  conditions?: PermissionCondition[];
  restrictions?: Restriction[];
}

/**
 * Permission condition
 */
export interface PermissionCondition {
  type: 'domain' | 'sensitive_data' | 'size_limit' | 'custom';
  check: (args: any) => boolean;
  message: string;
}

/**
 * Restriction on tool usage
 */
export interface Restriction {
  type: 'domain_whitelist' | 'domain_blacklist' | 'data_type' | 'max_size' | 'regex';
  value: any;
  message: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number; // Max requests per window
  windowMs: number; // Time window in milliseconds
  toolLimits?: Record<string, { maxRequests: number; windowMs: number }>;
}

/**
 * Guardrail violation
 */
export interface GuardrailViolation {
  type: 'permission' | 'rate_limit' | 'restriction' | 'safety';
  tool: string;
  args: any;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: number;
  tool: string;
  args: any;
  result: 'allowed' | 'blocked' | 'requires_approval';
  violation?: GuardrailViolation;
  user?: string;
  metadata?: Record<string, any>;
}

/**
 * Predefined roles with permissions
 */
export const PredefinedRoles: Record<string, Role> = {
  // Guest: Read-only access
  guest: {
    name: 'guest',
    description: 'Read-only access with strict restrictions',
    permissions: [
      {
        tool: 'getPageContext',
        level: 'public',
      },
      {
        tool: 'getBrowserHistory',
        level: 'restricted',
        conditions: [
          {
            type: 'custom',
            check: (args) => (args.maxResults || 10) <= 10,
            message: 'Guests limited to 10 history results',
          },
        ],
      },
      {
        tool: ['navigate', 'click', 'type', 'screenshot'],
        level: 'blocked',
      },
    ],
    rateLimits: {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
    },
  },

  // User: Standard access with safety restrictions
  user: {
    name: 'user',
    description: 'Standard user with safe operations',
    permissions: [
      {
        tool: 'navigate',
        level: 'restricted',
        restrictions: [
          {
            type: 'domain_whitelist',
            value: [
              'github.com',
              'npmjs.com',
              'stackoverflow.com',
              'developer.mozilla.org',
              'v6.ai-sdk.dev',
            ],
            message: 'Navigation restricted to whitelisted domains',
          },
        ],
      },
      {
        tool: ['click', 'scroll', 'wait', 'pressKey'],
        level: 'public',
      },
      {
        tool: 'type',
        level: 'restricted',
        conditions: [
          {
            type: 'sensitive_data',
            check: (args) => {
              const sensitivePatterns = [
                /password/i,
                /credit[_\s]?card/i,
                /ssn/i,
                /api[_\s]?key/i,
              ];
              const text = args.text || '';
              return !sensitivePatterns.some((pattern) => pattern.test(text));
            },
            message: 'Typing sensitive data requires approval',
          },
        ],
      },
      {
        tool: ['getPageContext', 'screenshot', 'getBrowserHistory'],
        level: 'public',
      },
      {
        tool: ['hover', 'dragDrop', 'clearInput'],
        level: 'public',
      },
      {
        tool: 'keyCombo',
        level: 'restricted',
        conditions: [
          {
            type: 'custom',
            check: (args) => {
              // Block dangerous key combinations
              const dangerous = ['Alt+F4', 'Ctrl+W', 'Cmd+Q'];
              const combo = args.keys?.join('+') || '';
              return !dangerous.includes(combo);
            },
            message: 'Dangerous key combination blocked',
          },
        ],
      },
    ],
    rateLimits: {
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute
      toolLimits: {
        navigate: { maxRequests: 20, windowMs: 60 * 1000 },
        screenshot: { maxRequests: 10, windowMs: 60 * 1000 },
      },
    },
  },

  // Admin: Full access with audit logging
  admin: {
    name: 'admin',
    description: 'Full access to all tools with audit logging',
    permissions: [
      {
        tool: '*', // All tools
        level: 'public',
      },
    ],
    rateLimits: {
      maxRequests: 1000,
      windowMs: 60 * 1000, // 1 minute
    },
  },

  // Automation: For CI/CD and automated workflows
  automation: {
    name: 'automation',
    description: 'Automated workflows with enhanced permissions',
    permissions: [
      {
        tool: '*',
        level: 'public',
      },
    ],
    rateLimits: {
      maxRequests: 500,
      windowMs: 60 * 1000,
    },
  },
};

/**
 * Guardrails System
 */
export class GuardrailsSystem {
  private role: Role;
  private auditLog: AuditLogEntry[] = [];
  private rateLimitTracker: Map<string, number[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(role: Role | string = 'user') {
    this.role = typeof role === 'string' ? PredefinedRoles[role] || PredefinedRoles.user : role;
  }

  /**
   * Check if tool execution is allowed
   */
  async checkPermission(
    tool: string,
    args: any = {}
  ): Promise<{ allowed: boolean; reason?: string; requiresApproval?: boolean }> {
    const timestamp = Date.now();

    // 1. Check circuit breaker
    const breaker = this.circuitBreakers.get(tool);
    if (breaker && breaker.isOpen()) {
      const violation: GuardrailViolation = {
        type: 'safety',
        tool,
        args,
        message: 'Circuit breaker open - tool failing too frequently',
        severity: 'high',
        timestamp,
      };

      this.logAudit({
        timestamp,
        tool,
        args,
        result: 'blocked',
        violation,
      });

      return { allowed: false, reason: violation.message };
    }

    // 2. Check rate limits
    const rateLimitCheck = this.checkRateLimit(tool);
    if (!rateLimitCheck.allowed) {
      const violation: GuardrailViolation = {
        type: 'rate_limit',
        tool,
        args,
        message: rateLimitCheck.reason!,
        severity: 'medium',
        timestamp,
      };

      this.logAudit({
        timestamp,
        tool,
        args,
        result: 'blocked',
        violation,
      });

      return rateLimitCheck;
    }

    // 3. Check permissions
    const permission = this.findPermission(tool);
    if (!permission) {
      const violation: GuardrailViolation = {
        type: 'permission',
        tool,
        args,
        message: `No permission found for tool: ${tool}`,
        severity: 'high',
        timestamp,
      };

      this.logAudit({
        timestamp,
        tool,
        args,
        result: 'blocked',
        violation,
      });

      return { allowed: false, reason: violation.message };
    }

    if (permission.level === 'blocked') {
      const violation: GuardrailViolation = {
        type: 'permission',
        tool,
        args,
        message: `Tool blocked for role: ${this.role.name}`,
        severity: 'high',
        timestamp,
      };

      this.logAudit({
        timestamp,
        tool,
        args,
        result: 'blocked',
        violation,
      });

      return { allowed: false, reason: violation.message };
    }

    // 4. Check conditions
    if (permission.conditions) {
      for (const condition of permission.conditions) {
        if (!condition.check(args)) {
          const requiresApproval = permission.level === 'restricted';

          this.logAudit({
            timestamp,
            tool,
            args,
            result: requiresApproval ? 'requires_approval' : 'blocked',
          });

          if (requiresApproval) {
            return {
              allowed: true,
              requiresApproval: true,
              reason: condition.message,
            };
          } else {
            const violation: GuardrailViolation = {
              type: 'restriction',
              tool,
              args,
              message: condition.message,
              severity: 'medium',
              timestamp,
            };

            return { allowed: false, reason: condition.message };
          }
        }
      }
    }

    // 5. Check restrictions
    if (permission.restrictions) {
      for (const restriction of permission.restrictions) {
        const restrictionCheck = this.checkRestriction(restriction, args);
        if (!restrictionCheck.allowed) {
          const violation: GuardrailViolation = {
            type: 'restriction',
            tool,
            args,
            message: restrictionCheck.reason!,
            severity: 'medium',
            timestamp,
          };

          this.logAudit({
            timestamp,
            tool,
            args,
            result: 'blocked',
            violation,
          });

          return restrictionCheck;
        }
      }
    }

    // All checks passed
    this.logAudit({
      timestamp,
      tool,
      args,
      result: 'allowed',
    });

    this.recordRateLimit(tool);

    return { allowed: true };
  }

  /**
   * Find permission for tool
   */
  private findPermission(tool: string): Permission | null {
    for (const permission of this.role.permissions) {
      const tools = Array.isArray(permission.tool) ? permission.tool : [permission.tool];

      for (const pattern of tools) {
        if (pattern === '*' || pattern === tool) {
          return permission;
        }

        // Check wildcard patterns (e.g., "type_*")
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
          if (regex.test(tool)) {
            return permission;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(tool: string): { allowed: boolean; reason?: string } {
    if (!this.role.rateLimits) return { allowed: true };

    const now = Date.now();
    const config = this.role.rateLimits.toolLimits?.[tool] || this.role.rateLimits;

    const key = `${this.role.name}:${tool}`;
    const timestamps = this.rateLimitTracker.get(key) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < config.windowMs);

    if (validTimestamps.length >= config.maxRequests) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowMs / 1000}s`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record rate limit timestamp
   */
  private recordRateLimit(tool: string): void {
    if (!this.role.rateLimits) return;

    const now = Date.now();
    const key = `${this.role.name}:${tool}`;
    const timestamps = this.rateLimitTracker.get(key) || [];

    timestamps.push(now);
    this.rateLimitTracker.set(key, timestamps);
  }

  /**
   * Check restriction
   */
  private checkRestriction(
    restriction: Restriction,
    args: any
  ): { allowed: boolean; reason?: string } {
    switch (restriction.type) {
      case 'domain_whitelist':
        if (args.url) {
          try {
            const url = new URL(args.url);
            const domain = url.hostname.replace('www.', '');
            const allowed = restriction.value.some((d: string) => domain.includes(d));
            if (!allowed) {
              return { allowed: false, reason: restriction.message };
            }
          } catch {
            return { allowed: false, reason: 'Invalid URL format' };
          }
        }
        break;

      case 'domain_blacklist':
        if (args.url) {
          try {
            const url = new URL(args.url);
            const domain = url.hostname.replace('www.', '');
            const blocked = restriction.value.some((d: string) => domain.includes(d));
            if (blocked) {
              return { allowed: false, reason: restriction.message };
            }
          } catch {
            return { allowed: false, reason: 'Invalid URL format' };
          }
        }
        break;

      case 'max_size':
        const size = JSON.stringify(args).length;
        if (size > restriction.value) {
          return { allowed: false, reason: restriction.message };
        }
        break;

      case 'regex':
        const text = JSON.stringify(args);
        if (restriction.value.test(text)) {
          return { allowed: false, reason: restriction.message };
        }
        break;
    }

    return { allowed: true };
  }

  /**
   * Log audit entry
   */
  private logAudit(entry: AuditLogEntry): void {
    this.auditLog.push(entry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(filters?: {
    tool?: string;
    result?: 'allowed' | 'blocked' | 'requires_approval';
    since?: number;
  }): AuditLogEntry[] {
    let log = this.auditLog;

    if (filters) {
      if (filters.tool) {
        log = log.filter((entry) => entry.tool === filters.tool);
      }
      if (filters.result) {
        log = log.filter((entry) => entry.result === filters.result);
      }
      if (filters.since) {
        log = log.filter((entry) => entry.timestamp >= filters.since);
      }
    }

    return log;
  }

  /**
   * Get guardrail statistics
   */
  getStats(): {
    totalRequests: number;
    allowed: number;
    blocked: number;
    requiresApproval: number;
    violations: Record<string, number>;
    topTools: Array<{ tool: string; count: number }>;
  } {
    const totalRequests = this.auditLog.length;
    const allowed = this.auditLog.filter((e) => e.result === 'allowed').length;
    const blocked = this.auditLog.filter((e) => e.result === 'blocked').length;
    const requiresApproval = this.auditLog.filter(
      (e) => e.result === 'requires_approval'
    ).length;

    const violations: Record<string, number> = {};
    this.auditLog.forEach((entry) => {
      if (entry.violation) {
        violations[entry.violation.type] = (violations[entry.violation.type] || 0) + 1;
      }
    });

    const toolCounts: Record<string, number> = {};
    this.auditLog.forEach((entry) => {
      toolCounts[entry.tool] = (toolCounts[entry.tool] || 0) + 1;
    });

    const topTools = Object.entries(toolCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count }));

    return {
      totalRequests,
      allowed,
      blocked,
      requiresApproval,
      violations,
      topTools,
    };
  }

  /**
   * Register circuit breaker for tool
   */
  registerCircuitBreaker(tool: string, config?: {
    failureThreshold?: number;
    resetTimeout?: number;
  }): void {
    this.circuitBreakers.set(tool, new CircuitBreaker(config));
  }

  /**
   * Record tool execution result for circuit breaker
   */
  recordToolResult(tool: string, success: boolean): void {
    const breaker = this.circuitBreakers.get(tool);
    if (breaker) {
      if (success) {
        breaker.recordSuccess();
      } else {
        breaker.recordFailure();
      }
    }
  }

  /**
   * Get current role
   */
  getRole(): Role {
    return this.role;
  }

  /**
   * Change role
   */
  setRole(role: Role | string): void {
    this.role = typeof role === 'string' ? PredefinedRoles[role] || PredefinedRoles.user : role;
  }
}

/**
 * Circuit Breaker for failing tools
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private failureThreshold: number;
  private resetTimeout: number;

  constructor(config: { failureThreshold?: number; resetTimeout?: number } = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeout = config.resetTimeout || 60000; // 1 minute
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half_open';
        return false;
      }
      return true;
    }
    return false;
  }

  getState(): 'closed' | 'open' | 'half_open' {
    return this.state;
  }
}

/**
 * Global guardrails instance
 */
export const globalGuardrails = new GuardrailsSystem('user');

/**
 * Create tool with guardrails
 */
export function withGuardrails<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  executor: T,
  guardrails?: GuardrailsSystem
): T {
  const guard = guardrails || globalGuardrails;

  return (async (...args: any[]) => {
    const toolArgs = args[0] || {};

    // Check permission
    const check = await guard.checkPermission(toolName, toolArgs);

    if (!check.allowed) {
      throw new Error(`Tool execution blocked: ${check.reason}`);
    }

    if (check.requiresApproval) {
      // In practice, this would trigger approval flow
      console.warn(`Tool requires approval: ${check.reason}`);
    }

    try {
      const result = await executor(...args);
      guard.recordToolResult(toolName, true);
      return result;
    } catch (error) {
      guard.recordToolResult(toolName, false);
      throw error;
    }
  }) as T;
}
