// Sandbox Lifecycle Logging - Daytona-style Braintrust spans
// Wraps browser/page lifecycle operations (create, start, cleanup) with telemetry

import { traced, logEvent } from './braintrust.js';
import type { Browser, Page } from 'puppeteer';

export interface SandboxLifecycleMetrics {
  createDuration?: number;
  startDuration?: number;
  cleanupDuration?: number;
  totalDuration?: number;
  pageCount?: number;
  error?: string;
}

/**
 * Create browser sandbox with Braintrust span
 * Equivalent to Daytona sandbox.create()
 */
export async function createSandbox(
  options?: { headless?: boolean; args?: string[] }
): Promise<{ browser: Browser; metrics: SandboxLifecycleMetrics }> {
  return await traced(
    'sandbox_create',
    async () => {
      const startTime = Date.now();
      const puppeteer = await import('puppeteer');
      
      try {
        const browser = await puppeteer.default.launch({
          headless: options?.headless ?? true,
          args: options?.args ?? ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const duration = Date.now() - startTime;

        logEvent('sandbox_created', {
          duration_ms: duration,
          headless: options?.headless ?? true,
          args_count: options?.args?.length ?? 0,
        });

        return {
          browser,
          metrics: {
            createDuration: duration,
          },
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logEvent('sandbox_create_error', {
          duration_ms: duration,
          error: error?.message || String(error),
        });
        throw error;
      }
    },
    {
      operation: 'create',
      ...options,
    }
  );
}

/**
 * Start sandbox page with Braintrust span
 * Equivalent to Daytona sandbox.start()
 */
export async function startSandbox(
  browser: Browser
): Promise<{ page: Page; metrics: SandboxLifecycleMetrics }> {
  return await traced(
    'sandbox_start',
    async () => {
      const startTime = Date.now();

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        const duration = Date.now() - startTime;

        logEvent('sandbox_started', {
          duration_ms: duration,
          viewport: { width: 1280, height: 720 },
        });

        return {
          page,
          metrics: {
            startDuration: duration,
          },
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logEvent('sandbox_start_error', {
          duration_ms: duration,
          error: error?.message || String(error),
        });
        throw error;
      }
    },
    {
      operation: 'start',
    }
  );
}

/**
 * Cleanup sandbox with Braintrust span
 * Equivalent to Daytona sandbox.delete() or cleanup
 */
export async function cleanupSandbox(
  browser: Browser,
  pages?: Page[]
): Promise<SandboxLifecycleMetrics> {
  return await traced(
    'sandbox_cleanup',
    async () => {
      const startTime = Date.now();
      const metrics: SandboxLifecycleMetrics = {};

      try {
        // Close all pages first
        if (pages && pages.length > 0) {
          await Promise.all(
            pages.map(page => page.close().catch(err => {
              console.warn('[Sandbox] Error closing page:', err);
            }))
          );
          metrics.pageCount = pages.length;
        }

        // Close browser
        await browser.close();

        const duration = Date.now() - startTime;
        metrics.cleanupDuration = duration;

        logEvent('sandbox_cleaned_up', {
          duration_ms: duration,
          page_count: metrics.pageCount ?? 0,
        });

        return metrics;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        metrics.cleanupDuration = duration;
        metrics.error = error?.message || String(error);

        logEvent('sandbox_cleanup_error', {
          duration_ms: duration,
          error: metrics.error,
          page_count: metrics.pageCount ?? 0,
        });

        // Still try to close browser even if there was an error
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[Sandbox] Error during forced browser close:', closeError);
        }

        return metrics;
      }
    },
    {
      operation: 'cleanup',
      page_count: pages?.length ?? 0,
    }
  );
}

/**
 * Stagehand event logging wrapper
 * Logs Stagehand-related events (evaluation, step execution, etc.)
 */
export function logStagehandEvent(
  eventType: string,
  metadata?: Record<string, any>
): void {
  logEvent(`stagehand_${eventType}`, {
    timestamp: Date.now(),
    ...metadata,
  });
}

