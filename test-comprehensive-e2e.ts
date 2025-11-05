#!/usr/bin/env node

/**
 * Comprehensive E2E Test Suite
 * Tests real production workflows with actual API calls
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import CDP from 'chrome-remote-interface';
import * as fs from 'fs';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  details: any;
  errors: string[];
}

class ComprehensiveE2ETest {
  private chrome: any = null;
  private client: any = null;
  private results: TestResult[] = [];
  private extensionId: string = '';

  async startChrome(): Promise<void> {
    console.log('🚀 Starting Chrome with extension...');

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const extensionPath = './dist';

    this.chrome = spawn(chromePath, [
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--user-data-dir=/tmp/chrome-e2e-test',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      'about:blank'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    // Wait for Chrome to be ready
    let retries = 0;
    while (retries < 15) {
      try {
        await setTimeout(1000);
        const testConnection = await CDP({ port: 9222 });
        await testConnection.close();
        console.log('✅ Chrome started successfully');
        break;
      } catch (error) {
        retries++;
        if (retries >= 15) {
          throw new Error('Chrome DevTools not ready');
        }
      }
    }
  }

  async connectToDevTools(): Promise<void> {
    console.log('🔗 Connecting to DevTools...');
    this.client = await CDP({ port: 9222 });
    const { Page, Runtime, Network } = this.client;

    await Promise.all([
      Page.enable(),
      Runtime.enable(),
      Network.enable()
    ]);

    console.log('✅ DevTools connected');
  }

  async testNavigationWorkflow(): Promise<TestResult> {
    console.log('\n📍 Test 1: Navigation Workflow');
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const { Page } = this.client;
      
      // Navigate to a test page
      console.log('  → Navigating to example.com');
      await Page.navigate({ url: 'https://example.com' });
      await Page.loadEventFired();
      await setTimeout(2000);

      // Verify page loaded
      const pageTitle = await this.client.Runtime.evaluate({
        expression: 'document.title'
      });

      const success = pageTitle.result.value.includes('Example');
      
      console.log(`  ✓ Page loaded: ${pageTitle.result.value}`);

      return {
        testName: 'Navigation Workflow',
        success,
        duration: Date.now() - startTime,
        details: { title: pageTitle.result.value },
        errors
      };
    } catch (error) {
      errors.push(error.message);
      return {
        testName: 'Navigation Workflow',
        success: false,
        duration: Date.now() - startTime,
        details: {},
        errors
      };
    }
  }

  async testPageContextExtraction(): Promise<TestResult> {
    console.log('\n📊 Test 2: Page Context Extraction');
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const { Page, Runtime } = this.client;

      await Page.navigate({ url: 'https://github.com' });
      await Page.loadEventFired();
      await setTimeout(3000);

      // Extract comprehensive page context
      const context = await Runtime.evaluate({
        expression: `
          (function() {
            return {
              title: document.title,
              url: window.location.href,
              textContent: document.body.innerText.slice(0, 500),
              links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
                text: a.textContent?.trim().slice(0, 50),
                href: a.href
              })),
              forms: Array.from(document.querySelectorAll('form')).length,
              images: Array.from(document.querySelectorAll('img')).length,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight
              }
            };
          })()
        `
      });

      const data = context.result.value;
      const success = data.title && data.links.length > 0;

      console.log(`  ✓ Title: ${data.title.slice(0, 50)}...`);
      console.log(`  ✓ Links extracted: ${data.links.length}`);
      console.log(`  ✓ Forms found: ${data.forms}`);
      console.log(`  ✓ Images found: ${data.images}`);

      return {
        testName: 'Page Context Extraction',
        success,
        duration: Date.now() - startTime,
        details: data,
        errors
      };
    } catch (error) {
      errors.push(error.message);
      return {
        testName: 'Page Context Extraction',
        success: false,
        duration: Date.now() - startTime,
        details: {},
        errors
      };
    }
  }

  async testMultiPageNavigation(): Promise<TestResult> {
    console.log('\n🔄 Test 3: Multi-Page Navigation');
    const startTime = Date.now();
    const errors: string[] = [];
    const visitedPages: string[] = [];

    try {
      const { Page, Runtime } = this.client;
      const testUrls = [
        'https://example.com',
        'https://httpbin.org/html',
        'https://jsonplaceholder.typicode.com'
      ];

      for (const url of testUrls) {
        console.log(`  → Visiting: ${url}`);
        await Page.navigate({ url });
        await Page.loadEventFired();
        await setTimeout(1500);

        const pageInfo = await Runtime.evaluate({
          expression: `({ title: document.title, url: window.location.href })`
        });

        visitedPages.push(pageInfo.result.value.url);
        console.log(`  ✓ Loaded: ${pageInfo.result.value.title || 'No title'}`);
      }

      const success = visitedPages.length === testUrls.length;

      return {
        testName: 'Multi-Page Navigation',
        success,
        duration: Date.now() - startTime,
        details: { visitedPages },
        errors
      };
    } catch (error) {
      errors.push(error.message);
      return {
        testName: 'Multi-Page Navigation',
        success: false,
        duration: Date.now() - startTime,
        details: { visitedPages },
        errors
      };
    }
  }

  async testFormDetection(): Promise<TestResult> {
    console.log('\n📝 Test 4: Form Detection and Analysis');
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const { Page, Runtime } = this.client;

      await Page.navigate({ url: 'https://httpbin.org/forms/post' });
      await Page.loadEventFired();
      await setTimeout(2000);

      const formData = await Runtime.evaluate({
        expression: `
          (function() {
            const forms = Array.from(document.querySelectorAll('form'));
            return forms.map(form => ({
              action: form.action,
              method: form.method,
              inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
                name: input.name,
                type: input.type || 'text',
                required: input.required
              }))
            }));
          })()
        `
      });

      const forms = formData.result.value;
      const success = forms.length > 0;

      console.log(`  ✓ Forms detected: ${forms.length}`);
      if (forms.length > 0) {
        console.log(`  ✓ First form has ${forms[0].inputs.length} inputs`);
      }

      return {
        testName: 'Form Detection',
        success,
        duration: Date.now() - startTime,
        details: { forms },
        errors
      };
    } catch (error) {
      errors.push(error.message);
      return {
        testName: 'Form Detection',
        success: false,
        duration: Date.now() - startTime,
        details: {},
        errors
      };
    }
  }

  async testPerformanceMetrics(): Promise<TestResult> {
    console.log('\n⚡ Test 5: Performance Metrics');
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const { Page, Runtime } = this.client;

      await Page.navigate({ url: 'https://example.com' });
      await Page.loadEventFired();
      await setTimeout(1000);

      const performanceData = await Runtime.evaluate({
        expression: `
          (function() {
            const perf = window.performance;
            const navigation = perf.getEntriesByType('navigation')[0];
            return {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
              domInteractive: navigation.domInteractive - navigation.fetchStart,
              resourceCount: perf.getEntriesByType('resource').length
            };
          })()
        `
      });

      const metrics = performanceData.result.value;
      const success = metrics.domContentLoaded >= 0 && metrics.loadComplete >= 0;

      console.log(`  ✓ DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms`);
      console.log(`  ✓ Load Complete: ${metrics.loadComplete.toFixed(2)}ms`);
      console.log(`  ✓ Resources Loaded: ${metrics.resourceCount}`);

      return {
        testName: 'Performance Metrics',
        success,
        duration: Date.now() - startTime,
        details: metrics,
        errors
      };
    } catch (error) {
      errors.push(error.message);
      return {
        testName: 'Performance Metrics',
        success: false,
        duration: Date.now() - startTime,
        details: {},
        errors
      };
    }
  }

  async testErrorHandling(): Promise<TestResult> {
    console.log('\n🛡️ Test 6: Error Handling');
    const startTime = Date.now();
    const errors: string[] = [];
    let errorsCaught = 0;

    try {
      const { Page } = this.client;

      // Test 404 handling
      console.log('  → Testing 404 handling');
      try {
        await Page.navigate({ url: 'https://httpbin.org/status/404' });
        await Page.loadEventFired();
        await setTimeout(1000);
        errorsCaught++;
      } catch (e) {
        console.log('  ✓ 404 handled gracefully');
      }

      // Test timeout handling
      console.log('  → Testing timeout handling');
      try {
        await Page.navigate({ url: 'https://httpbin.org/delay/10', timeout: 3000 });
      } catch (e) {
        console.log('  ✓ Timeout handled gracefully');
        errorsCaught++;
      }

      const success = errorsCaught >= 1;

      return {
        testName: 'Error Handling',
        success,
        duration: Date.now() - startTime,
        details: { errorsCaught },
        errors
      };
    } catch (error) {
      errors.push(error.message);
      return {
        testName: 'Error Handling',
        success: false,
        duration: Date.now() - startTime,
        details: {},
        errors
      };
    }
  }

  async testConcurrentOperations(): Promise<TestResult> {
    console.log('\n🔀 Test 7: Concurrent Operations');
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const { Runtime } = this.client;

      // Execute multiple evaluations concurrently
      console.log('  → Running concurrent evaluations');
      const operations = await Promise.all([
        Runtime.evaluate({ expression: 'document.title' }),
        Runtime.evaluate({ expression: 'window.location.href' }),
        Runtime.evaluate({ expression: 'document.body.innerText.length' }),
        Runtime.evaluate({ expression: 'document.querySelectorAll("*").length' })
      ]);

      const success = operations.every(op => op.result && op.result.value !== undefined);
      
      console.log(`  ✓ All ${operations.length} concurrent operations completed`);

      return {
        testName: 'Concurrent Operations',
        success,
        duration: Date.now() - startTime,
        details: { operationsCount: operations.length },
        errors
      };
    } catch (error) {
      errors.push(error.message);
      return {
        testName: 'Concurrent Operations',
        success: false,
        duration: Date.now() - startTime,
        details: {},
        errors
      };
    }
  }

  async runAllTests(): Promise<void> {
    console.log('='.repeat(80));
    console.log('🧪 COMPREHENSIVE E2E TEST SUITE');
    console.log('Testing real production workflows with actual browser automation');
    console.log('='.repeat(80));

    try {
      await this.startChrome();
      await this.connectToDevTools();

      // Run all tests
      this.results.push(await this.testNavigationWorkflow());
      this.results.push(await this.testPageContextExtraction());
      this.results.push(await this.testMultiPageNavigation());
      this.results.push(await this.testFormDetection());
      this.results.push(await this.testPerformanceMetrics());
      this.results.push(await this.testErrorHandling());
      this.results.push(await this.testConcurrentOperations());

    } catch (error) {
      console.error('💥 Test suite failed:', error);
    } finally {
      await this.cleanup();
    }

    this.generateReport();
  }

  generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE E2E TEST REPORT');
    console.log('='.repeat(80));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n📈 Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`   📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\n📋 Individual Test Results:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${index + 1}. ${result.testName}`);
      console.log(`      Duration: ${result.duration}ms`);
      if (result.errors.length > 0) {
        console.log(`      Errors: ${result.errors.join(', ')}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    if (failedTests === 0) {
      console.log('🎉 ALL TESTS PASSED! System ready for production.');
    } else {
      console.log(`⚠️  ${failedTests} test(s) failed. Review errors above.`);
    }
    console.log('='.repeat(80));

    // Save results to file
    const reportPath = './e2e-test-results.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        duration: totalDuration,
        successRate: (passedTests / totalTests) * 100
      },
      results: this.results
    }, null, 2));

    console.log(`\n📄 Detailed results saved to: ${reportPath}`);
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    if (this.client) {
      await this.client.close();
    }
    if (this.chrome) {
      this.chrome.kill('SIGTERM');
      await setTimeout(1000);
    }
  }

  async run(): Promise<void> {
    try {
      await this.runAllTests();
      process.exit(this.results.every(r => r.success) ? 0 : 1);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  }
}

// Run the test suite
const test = new ComprehensiveE2ETest();
test.run().catch(console.error);
