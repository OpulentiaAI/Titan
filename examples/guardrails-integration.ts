// Guardrails Integration Examples
// Demonstrates permission-based tool execution and safety checks

import {
  GuardrailsSystem,
  PredefinedRoles,
  withGuardrails,
  globalGuardrails,
  type Permission,
  type Role,
} from '../lib/guardrails';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Example 1: Basic Permission Checking
 */
export async function exampleBasicPermissionCheck() {
  // Create guardrails with 'user' role
  const guardrails = new GuardrailsSystem('user');

  // Check various tool permissions
  const checks = await Promise.all([
    guardrails.checkPermission('navigate', { url: 'https://github.com' }),
    guardrails.checkPermission('navigate', { url: 'https://malicious-site.com' }),
    guardrails.checkPermission('type', { text: 'hello world' }),
    guardrails.checkPermission('type', { text: 'password: secret123' }),
    guardrails.checkPermission('click', { selector: 'button' }),
  ]);

  console.log('Permission checks:', checks);
  // Output:
  // [
  //   { allowed: true },
  //   { allowed: false, reason: 'Navigation restricted to whitelisted domains' },
  //   { allowed: true },
  //   { allowed: true, requiresApproval: true, reason: 'Typing sensitive data requires approval' },
  //   { allowed: true }
  // ]
}

/**
 * Example 2: Role-based Access Control
 */
export async function exampleRoleBasedAccess() {
  const tools = ['navigate', 'click', 'type', 'getPageContext'];

  console.log('\n=== Guest Role ===');
  const guest = new GuardrailsSystem('guest');
  for (const tool of tools) {
    const result = await guest.checkPermission(tool, {});
    console.log(`${tool}: ${result.allowed ? '✅ Allowed' : '❌ Blocked'}`);
  }

  console.log('\n=== User Role ===');
  const user = new GuardrailsSystem('user');
  for (const tool of tools) {
    const result = await user.checkPermission(tool, {});
    console.log(`${tool}: ${result.allowed ? '✅ Allowed' : '❌ Blocked'}`);
  }

  console.log('\n=== Admin Role ===');
  const admin = new GuardrailsSystem('admin');
  for (const tool of tools) {
    const result = await admin.checkPermission(tool, {});
    console.log(`${tool}: ${result.allowed ? '✅ Allowed' : '❌ Blocked'}`);
  }
}

/**
 * Example 3: Rate Limiting
 */
export async function exampleRateLimiting() {
  const guardrails = new GuardrailsSystem('user');

  console.log('Testing rate limits (100 requests/minute)...');

  let allowed = 0;
  let blocked = 0;

  // Try to make 150 requests rapidly
  for (let i = 0; i < 150; i++) {
    const result = await guardrails.checkPermission('getPageContext', {});
    if (result.allowed) {
      allowed++;
    } else {
      blocked++;
    }
  }

  console.log(`Allowed: ${allowed}, Blocked: ${blocked}`);
  // Output: Allowed: 100, Blocked: 50

  const stats = guardrails.getStats();
  console.log('Stats:', stats);
}

/**
 * Example 4: Circuit Breaker Pattern
 */
export async function exampleCircuitBreaker() {
  const guardrails = new GuardrailsSystem('user');

  // Register circuit breaker for navigate tool
  guardrails.registerCircuitBreaker('navigate', {
    failureThreshold: 3,
    resetTimeout: 5000, // 5 seconds
  });

  console.log('Simulating tool failures...');

  // Simulate 3 failures
  for (let i = 0; i < 3; i++) {
    guardrails.recordToolResult('navigate', false);
    console.log(`Failure ${i + 1} recorded`);
  }

  // Try to use tool - should be blocked
  const check1 = await guardrails.checkPermission('navigate', {
    url: 'https://github.com',
  });
  console.log('After failures:', check1);
  // Output: { allowed: false, reason: 'Circuit breaker open - tool failing too frequently' }

  // Wait for reset timeout
  console.log('Waiting 5 seconds for circuit breaker reset...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Try again - should be allowed (half-open state)
  const check2 = await guardrails.checkPermission('navigate', {
    url: 'https://github.com',
  });
  console.log('After reset:', check2);
  // Output: { allowed: true }

  // Record success - circuit closes
  guardrails.recordToolResult('navigate', true);
}

/**
 * Example 5: Creating Guarded Tools
 */
export function createGuardedTools(
  executeTool: (name: string, args: any) => Promise<any>,
  guardrails: GuardrailsSystem
) {
  return {
    navigate: tool({
      description: 'Navigate to URL with permission check',
      parameters: z.object({ url: z.string().url() }),
      execute: withGuardrails(
        'navigate',
        async ({ url }: { url: string }) => {
          return await executeTool('navigate', { url });
        },
        guardrails
      ),
    }),

    click: tool({
      description: 'Click element with permission check',
      parameters: z.object({ selector: z.string() }),
      execute: withGuardrails(
        'click',
        async ({ selector }: { selector: string }) => {
          return await executeTool('click', { selector });
        },
        guardrails
      ),
    }),

    type: tool({
      description: 'Type text with permission check',
      parameters: z.object({ selector: z.string(), text: z.string() }),
      execute: withGuardrails(
        'type',
        async ({ selector, text }: { selector: string; text: string }) => {
          return await executeTool('type', { selector, text });
        },
        guardrails
      ),
    }),

    getPageContext: tool({
      description: 'Get page context with permission check',
      parameters: z.object({}),
      execute: withGuardrails(
        'getPageContext',
        async () => {
          return await executeTool('getPageContext', {});
        },
        guardrails
      ),
    }),
  };
}

/**
 * Example 6: Custom Role with Specific Permissions
 */
export function createCustomRole(): Role {
  return {
    name: 'research_bot',
    description: 'Bot for web research with limited permissions',
    permissions: [
      {
        tool: 'navigate',
        level: 'restricted',
        restrictions: [
          {
            type: 'domain_whitelist',
            value: [
              'github.com',
              'stackoverflow.com',
              'developer.mozilla.org',
              'npmjs.com',
              'wikipedia.org',
            ],
            message: 'Research bot limited to research domains',
          },
        ],
      },
      {
        tool: 'getPageContext',
        level: 'public',
      },
      {
        tool: 'screenshot',
        level: 'public',
      },
      {
        tool: ['click', 'type', 'keyCombo'],
        level: 'blocked',
      },
      {
        tool: 'scroll',
        level: 'public',
      },
    ],
    rateLimits: {
      maxRequests: 50,
      windowMs: 60 * 1000,
      toolLimits: {
        screenshot: { maxRequests: 5, windowMs: 60 * 1000 },
      },
    },
  };
}

export async function exampleCustomRole() {
  const customRole = createCustomRole();
  const guardrails = new GuardrailsSystem(customRole);

  console.log('\n=== Research Bot Role ===');

  // Should be allowed
  console.log('Navigate to GitHub:', await guardrails.checkPermission('navigate', {
    url: 'https://github.com',
  }));

  // Should be blocked (not in whitelist)
  console.log('Navigate to Facebook:', await guardrails.checkPermission('navigate', {
    url: 'https://facebook.com',
  }));

  // Should be allowed
  console.log('Get page context:', await guardrails.checkPermission('getPageContext', {}));

  // Should be blocked
  console.log('Click button:', await guardrails.checkPermission('click', {
    selector: 'button',
  }));
}

/**
 * Example 7: Audit Log Analysis
 */
export async function exampleAuditLogAnalysis() {
  const guardrails = new GuardrailsSystem('user');

  // Generate some activity
  await guardrails.checkPermission('navigate', { url: 'https://github.com' });
  await guardrails.checkPermission('click', { selector: 'button' });
  await guardrails.checkPermission('type', { text: 'password: secret' });
  await guardrails.checkPermission('navigate', { url: 'https://malicious.com' });

  // Get full audit log
  const fullLog = guardrails.getAuditLog();
  console.log('Full audit log:', fullLog);

  // Get blocked requests only
  const blockedLog = guardrails.getAuditLog({ result: 'blocked' });
  console.log('Blocked requests:', blockedLog);

  // Get requests requiring approval
  const approvalLog = guardrails.getAuditLog({ result: 'requires_approval' });
  console.log('Requests requiring approval:', approvalLog);

  // Get recent requests (last 60 seconds)
  const recentLog = guardrails.getAuditLog({ since: Date.now() - 60000 });
  console.log('Recent requests:', recentLog);

  // Get statistics
  const stats = guardrails.getStats();
  console.log('\nStatistics:');
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Allowed: ${stats.allowed}`);
  console.log(`Blocked: ${stats.blocked}`);
  console.log(`Requires approval: ${stats.requiresApproval}`);
  console.log('Violations:', stats.violations);
  console.log('Top tools:', stats.topTools);
}

/**
 * Example 8: Integration with Workflow
 */
export async function workflowWithGuardrails(
  model: any,
  executeTool: (name: string, args: any) => Promise<any>
) {
  // Create guardrails with appropriate role
  const guardrails = new GuardrailsSystem('user');

  // Register circuit breakers for critical tools
  guardrails.registerCircuitBreaker('navigate', {
    failureThreshold: 3,
    resetTimeout: 60000,
  });

  // Create guarded tools
  const guardedTools = createGuardedTools(executeTool, guardrails);

  // Use tools in workflow
  try {
    console.log('Navigating to GitHub...');
    await guardedTools.navigate.execute({ url: 'https://github.com' });

    console.log('Getting page context...');
    await guardedTools.getPageContext.execute({});

    console.log('Clicking search button...');
    await guardedTools.click.execute({ selector: 'button[type="submit"]' });

    // Get stats
    const stats = guardrails.getStats();
    console.log('\nWorkflow completed successfully');
    console.log('Total tool calls:', stats.totalRequests);
    console.log('Success rate:', ((stats.allowed / stats.totalRequests) * 100).toFixed(1) + '%');
  } catch (error: any) {
    console.error('Workflow failed:', error.message);
  }
}

/**
 * Example 9: Dynamic Permission Updates
 */
export async function exampleDynamicPermissions() {
  const guardrails = new GuardrailsSystem('user');

  console.log('Initial check - navigate to example.com:');
  const check1 = await guardrails.checkPermission('navigate', {
    url: 'https://example.com',
  });
  console.log(check1);
  // Output: { allowed: false, reason: 'Navigation restricted to whitelisted domains' }

  // Upgrade to admin role
  console.log('\nUpgrading to admin role...');
  guardrails.setRole('admin');

  console.log('After upgrade - navigate to example.com:');
  const check2 = await guardrails.checkPermission('navigate', {
    url: 'https://example.com',
  });
  console.log(check2);
  // Output: { allowed: true }
}

/**
 * Example 10: Sensitive Data Detection
 */
export async function exampleSensitiveDataDetection() {
  const guardrails = new GuardrailsSystem('user');

  const testCases = [
    { text: 'hello world', label: 'Normal text' },
    { text: 'my password is secret123', label: 'Password' },
    { text: 'credit card: 4111111111111111', label: 'Credit card' },
    { text: 'api_key: sk-1234567890', label: 'API key' },
    { text: 'SSN: 123-45-6789', label: 'SSN' },
  ];

  console.log('\n=== Sensitive Data Detection ===');
  for (const testCase of testCases) {
    const result = await guardrails.checkPermission('type', { text: testCase.text });
    console.log(`${testCase.label}:`, result.requiresApproval ? '⚠️ Requires approval' : '✅ Allowed');
  }
}
