// Comprehensive Debug Logger
// Provides structured, filterable debug logging for all components
// Supports environment-based log levels and component filtering

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Component = 
  | 'WORKFLOW' 
  | 'PLANNING' 
  | 'STREAMING' 
  | 'TOOL' 
  | 'MESSAGE' 
  | 'ARTIFACT' 
  | 'AGENT' 
  | 'CACHE' 
  | 'ORCHESTRATION'
  | 'EVALUATOR'
  | 'SUMMARIZER'
  | 'CONTEXT';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: Component;
  message: string;
  data?: any;
  duration?: number;
  stack?: string;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private enabledComponents: Set<Component> = new Set();
  private minLevel: LogLevel = 'debug';
  private maxLogs = 10000; // Prevent memory issues

  constructor() {
    // Initialize from environment variables
    const debugEnv = process.env.DEBUG || '';
    const debugComponents = process.env.DEBUG_COMPONENTS || '';
    const logLevel = (process.env.LOG_LEVEL || 'debug').toLowerCase() as LogLevel;

    // Set minimum log level
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    this.minLevel = levels.includes(logLevel) ? logLevel : 'debug';

    // Enable all components if DEBUG=true or specific components
    if (debugEnv === 'true' || debugEnv === '1') {
      // Enable all components
      Object.values([
        'WORKFLOW', 'PLANNING', 'STREAMING', 'TOOL', 'MESSAGE', 
        'ARTIFACT', 'AGENT', 'CACHE', 'ORCHESTRATION', 'EVALUATOR', 
        'SUMMARIZER', 'CONTEXT'
      ] as Component[]).forEach(c => this.enabledComponents.add(c));
    } else if (debugComponents) {
      // Enable specific components (comma-separated)
      debugComponents.split(',').forEach(c => {
        const comp = c.trim().toUpperCase() as Component;
        if (comp) this.enabledComponents.add(comp);
      });
    }

    // Enable by default if no environment vars set (for development)
    if (this.enabledComponents.size === 0) {
      Object.values([
        'WORKFLOW', 'PLANNING', 'STREAMING', 'TOOL', 'MESSAGE', 
        'ARTIFACT', 'AGENT', 'ORCHESTRATION'
      ] as Component[]).forEach(c => this.enabledComponents.add(c));
    }
  }

  private shouldLog(level: LogLevel, component: Component): boolean {
    if (!this.enabledComponents.has(component)) {
      return false;
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLevel);
    
    return currentLevelIndex >= minLevelIndex;
  }

  private addLog(entry: LogEntry) {
    if (this.logs.length >= this.maxLogs) {
      // Remove oldest 10% of logs
      this.logs.splice(0, Math.floor(this.maxLogs * 0.1));
    }
    this.logs.push(entry);
  }

  private formatMessage(component: Component, message: string, data?: any, duration?: number): string {
    const icons: Record<Component, string> = {
      WORKFLOW: '🔄',
      PLANNING: '🧠',
      STREAMING: '📡',
      TOOL: '🛠️',
      MESSAGE: '💬',
      ARTIFACT: '📦',
      AGENT: '🤖',
      CACHE: '💾',
      ORCHESTRATION: '🎯',
      EVALUATOR: '✅',
      SUMMARIZER: '📝',
      CONTEXT: '🌐',
    };

    const icon = icons[component] || '📋';
    let msg = `${icon} [${component}] ${message}`;
    
    if (duration !== undefined) {
      msg += ` (${duration}ms)`;
    }
    
    return msg;
  }

  debug(component: Component, message: string, data?: any, duration?: number) {
    if (!this.shouldLog('debug', component)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      component,
      message,
      data,
      duration,
    };

    this.addLog(entry);
    console.log(`🔍 ${this.formatMessage(component, message, data, duration)}`);
    if (data) {
      console.log(`   Data:`, this.sanitizeData(data));
    }
  }

  info(component: Component, message: string, data?: any, duration?: number) {
    if (!this.shouldLog('info', component)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      component,
      message,
      data,
      duration,
    };

    this.addLog(entry);
    console.log(`📋 ${this.formatMessage(component, message, data, duration)}`);
    if (data) {
      console.log(`   Data:`, this.sanitizeData(data));
    }
  }

  warn(component: Component, message: string, data?: any, duration?: number) {
    if (!this.shouldLog('warn', component)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      component,
      message,
      data,
      duration,
    };

    this.addLog(entry);
    console.warn(`⚠️ ${this.formatMessage(component, message, data, duration)}`);
    if (data) {
      console.warn(`   Data:`, this.sanitizeData(data));
    }
  }

  error(component: Component, message: string, error?: Error | any, duration?: number) {
    if (!this.shouldLog('error', component)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      component,
      message,
      data: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      duration,
      stack: error instanceof Error ? error.stack : undefined,
    };

    this.addLog(entry);
    console.error(`❌ ${this.formatMessage(component, message, error, duration)}`);
    if (error instanceof Error) {
      console.error(`   Error: ${error.name}: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack:`, error.stack.split('\n').slice(0, 5).join('\n'));
      }
    } else if (error) {
      console.error(`   Data:`, this.sanitizeData(error));
    }
  }

  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return data;
    
    // Handle circular references and large objects
    try {
      const json = JSON.stringify(data, (key, value) => {
        // Limit string lengths
        if (typeof value === 'string' && value.length > 500) {
          return value.substring(0, 500) + '... (truncated)';
        }
        // Limit array lengths
        if (Array.isArray(value) && value.length > 50) {
          return [...value.slice(0, 50), `... (${value.length - 50} more items)`];
        }
        return value;
      }, 2);
      
      return JSON.parse(json);
    } catch (e) {
      return '[Circular or non-serializable data]';
    }
  }

  // Performance timing helpers
  time(component: Component, label: string): () => void {
    const start = Date.now();
    this.debug(component, `⏱️ Starting: ${label}`);
    
    return () => {
      const duration = Date.now() - start;
      this.debug(component, `⏱️ Completed: ${label}`, undefined, duration);
    };
  }

  // Get all logs for export/analysis
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Get logs filtered by component
  getLogsByComponent(component: Component): LogEntry[] {
    return this.logs.filter(log => log.component === component);
  }

  // Get logs filtered by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Clear logs
  clear() {
    this.logs = [];
  }

  // Export logs to JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Get summary statistics
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<LogLevel, number>,
      byComponent: {} as Record<Component, number>,
      errors: this.logs.filter(l => l.level === 'error').length,
      warnings: this.logs.filter(l => l.level === 'warn').length,
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byComponent[log.component] = (stats.byComponent[log.component] || 0) + 1;
    });

    return stats;
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();

// Convenience functions for each component
export const workflowDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('WORKFLOW', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('WORKFLOW', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('WORKFLOW', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('WORKFLOW', msg, error, duration),
  time: (label: string) => debugLogger.time('WORKFLOW', label),
};

export const planningDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('PLANNING', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('PLANNING', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('PLANNING', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('PLANNING', msg, error, duration),
  time: (label: string) => debugLogger.time('PLANNING', label),
};

export const streamingDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('STREAMING', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('STREAMING', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('STREAMING', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('STREAMING', msg, error, duration),
  time: (label: string) => debugLogger.time('STREAMING', label),
};

export const toolDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('TOOL', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('TOOL', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('TOOL', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('TOOL', msg, error, duration),
  time: (label: string) => debugLogger.time('TOOL', label),
};

export const messageDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('MESSAGE', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('MESSAGE', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('MESSAGE', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('MESSAGE', msg, error, duration),
  time: (label: string) => debugLogger.time('MESSAGE', label),
};

export const artifactDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('ARTIFACT', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('ARTIFACT', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('ARTIFACT', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('ARTIFACT', msg, error, duration),
  time: (label: string) => debugLogger.time('ARTIFACT', label),
};

export const agentDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('AGENT', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('AGENT', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('AGENT', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('AGENT', msg, error, duration),
  time: (label: string) => debugLogger.time('AGENT', label),
};

export const cacheDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('CACHE', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('CACHE', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('CACHE', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('CACHE', msg, error, duration),
  time: (label: string) => debugLogger.time('CACHE', label),
};

export const orchestrationDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('ORCHESTRATION', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('ORCHESTRATION', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('ORCHESTRATION', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('ORCHESTRATION', msg, error, duration),
  time: (label: string) => debugLogger.time('ORCHESTRATION', label),
};

export const evaluatorDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('EVALUATOR', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('EVALUATOR', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('EVALUATOR', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('EVALUATOR', msg, error, duration),
  time: (label: string) => debugLogger.time('EVALUATOR', label),
};

export const summarizerDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('SUMMARIZER', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('SUMMARIZER', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('SUMMARIZER', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('SUMMARIZER', msg, error, duration),
  time: (label: string) => debugLogger.time('SUMMARIZER', label),
};

export const contextDebug = {
  debug: (msg: string, data?: any, duration?: number) => debugLogger.debug('CONTEXT', msg, data, duration),
  info: (msg: string, data?: any, duration?: number) => debugLogger.info('CONTEXT', msg, data, duration),
  warn: (msg: string, data?: any, duration?: number) => debugLogger.warn('CONTEXT', msg, data, duration),
  error: (msg: string, error?: Error | any, duration?: number) => debugLogger.error('CONTEXT', msg, error, duration),
  time: (label: string) => debugLogger.time('CONTEXT', label),
};

