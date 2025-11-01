// Preflight Validation - Checks all critical environment variables before workflow execution
// Ensures all required API keys and configuration are present

export interface PreflightCheck {
  name: string;
  required: boolean;
  present: boolean;
  value?: string;
  maskedValue?: string;
  message: string;
  critical: boolean;
}

export interface PreflightResult {
  passed: boolean;
  checks: PreflightCheck[];
  missingCritical: string[];
  warnings: string[];
  summary: string;
}

const CRITICAL_ENV_VARS = {
  // Main AI Provider (at least one required)
  OPENAI_API_KEY: { required: false, critical: false, description: 'OpenAI API key (via Vercel Gateway)' },
  GATEWAY_API_KEY: { required: false, critical: false, description: 'Vercel AI Gateway API key' },
  AI_GATEWAY_API_KEY: { required: false, critical: false, description: 'Vercel AI Gateway API key (alternative)' },
  ANTHROPIC_API_KEY: { required: false, critical: false, description: 'Anthropic API key' },
  
  // You.com API (required for summarization)
  YOU_API_KEY: { required: true, critical: true, description: 'You.com API key for advanced summarization' },
  
  // Optional but recommended
  BRAINTRUST_API_KEY: { required: false, critical: false, description: 'Braintrust API key for observability' },
} as const;

/**
 * Mask sensitive API key values for logging
 */
function maskApiKey(key: string | undefined): string {
  if (!key || key.length < 10) return '***';
  return `${key.substring(0, 10)}...${key.substring(key.length - 4)}`;
}

/**
 * Validate that at least one main AI provider key is present
 */
function validateMainProvider(checks: PreflightCheck[]): boolean {
  const mainProviderKeys = ['OPENAI_API_KEY', 'GATEWAY_API_KEY', 'AI_GATEWAY_API_KEY', 'ANTHROPIC_API_KEY'];
  return mainProviderKeys.some(key => {
    const check = checks.find(c => c.name === key);
    return check?.present || false;
  });
}

/**
 * Run preflight validation on all critical environment variables
 */
export function validatePreflight(env: Record<string, string | undefined> = process.env): PreflightResult {
  const checks: PreflightCheck[] = [];
  const missingCritical: string[] = [];
  const warnings: string[] = [];
  
  // Check each critical environment variable
  for (const [key, config] of Object.entries(CRITICAL_ENV_VARS)) {
    const value = env[key];
    const present = !!value && value.length > 10; // Basic validation: key should be substantial
    
    const check: PreflightCheck = {
      name: key,
      required: config.required,
      present,
      value: present ? value : undefined,
      maskedValue: present ? maskApiKey(value) : undefined,
      message: present 
        ? `✅ ${config.description}`
        : config.required 
          ? `❌ Missing required: ${config.description}`
          : `⚠️  Optional: ${config.description}`,
      critical: config.critical,
    };
    
    checks.push(check);
    
    if (config.required && !present) {
      missingCritical.push(key);
    } else if (!present && !config.required) {
      warnings.push(`${key} not set (optional)`);
    }
  }
  
  // Validate that at least one main provider key exists
  const hasMainProvider = validateMainProvider(checks);
  if (!hasMainProvider) {
    missingCritical.push('MAIN_PROVIDER_KEY');
    warnings.push('No main AI provider key found (OPENAI_API_KEY, GATEWAY_API_KEY, AI_GATEWAY_API_KEY, or ANTHROPIC_API_KEY)');
  }
  
  const passed = missingCritical.length === 0;
  
  // Generate summary
  const summary = passed
    ? `✅ Preflight check passed - All critical environment variables present`
    : `❌ Preflight check failed - Missing ${missingCritical.length} critical variable(s)`;
  
  return {
    passed,
    checks,
    missingCritical,
    warnings,
    summary,
  };
}

/**
 * Log preflight results in a formatted way
 */
export function logPreflightResults(result: PreflightResult, verbose = true): void {
  const prefix = '🔍 [PREFLIGHT]';
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 PREFLIGHT VALIDATION');
  console.log('='.repeat(80));
  
  console.log(`\n${prefix} ${result.summary}\n`);
  
  if (verbose) {
    console.log(`${prefix} Environment Variable Status:\n`);
    
    // Group by critical/optional
    const criticalChecks = result.checks.filter(c => c.critical || c.required);
    const optionalChecks = result.checks.filter(c => !c.critical && !c.required);
    
    if (criticalChecks.length > 0) {
      console.log(`${prefix} Critical Variables:`);
      criticalChecks.forEach(check => {
        const icon = check.present ? '✅' : '❌';
        const value = check.maskedValue ? ` (${check.maskedValue})` : '';
        console.log(`${prefix}   ${icon} ${check.name}${value}`);
        if (!check.present && check.required) {
          console.log(`${prefix}      ${check.message}`);
        }
      });
      console.log('');
    }
    
    if (optionalChecks.length > 0) {
      console.log(`${prefix} Optional Variables:`);
      optionalChecks.forEach(check => {
        const icon = check.present ? '✅' : '⚪';
        const value = check.maskedValue ? ` (${check.maskedValue})` : '';
        console.log(`${prefix}   ${icon} ${check.name}${value}`);
      });
      console.log('');
    }
  }
  
  if (result.warnings.length > 0) {
    console.log(`${prefix} Warnings:`);
    result.warnings.forEach(warning => {
      console.log(`${prefix}   ⚠️  ${warning}`);
    });
    console.log('');
  }
  
  if (!result.passed) {
    console.log(`${prefix} ❌ Missing Critical Variables:`);
    result.missingCritical.forEach(key => {
      console.log(`${prefix}   - ${key}`);
    });
    console.log('');
  }
  
  console.log('='.repeat(80) + '\n');
}

/**
 * Throw error if preflight fails (for strict validation)
 */
export function assertPreflight(result: PreflightResult): void {
  if (!result.passed) {
    const missing = result.missingCritical.join(', ');
    throw new Error(
      `Preflight validation failed. Missing critical environment variables: ${missing}\n` +
      `Please set the required environment variables before running the workflow.`
    );
  }
}

/**
 * Get environment variable with fallback support
 */
export function getEnvVar(key: string, fallback?: string): string | undefined {
  return process.env[key] || fallback;
}

/**
 * Get masked environment variable for logging
 */
export function getMaskedEnvVar(key: string, fallback?: string): string {
  const value = getEnvVar(key, fallback);
  return value ? maskApiKey(value) : 'not set';
}

