#!/usr/bin/env tsx
/**
 * End-to-End Test for Navigation Tool with Telemetry
 * Tests the navigation tool in a real Chrome extension environment
 * Captures background script logs, sidepanel logs, and telemetry data
 */

import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '..', 'dist');
const TEST_LOG_FILE = path.join(__dirname, 'e2e-test-logs.txt');

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  logs: string[];
  errors: string[];
  telemetry?: unknown;
}

const testResults: TestResult[] = [];

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);

  // Also write to file
  fs.appendFileSync(TEST_LOG_FILE, logMessage + '\n');
}

function logTestStart(testName: string) {
  log(`\n${'='.repeat(80)}`);
  log(`🧪 STARTING TEST: ${testName}`);
  log('='.repeat(80));
}

function logTestEnd(testName: string, status: 'PASS' | 'FAIL', duration: number, logs: string[], errors: string[]) {
  log(`\n${'='.repeat(80)}`);
  log(`✅ TEST COMPLETED: ${testName}`);
  log(`   Status: ${status}`);
  log(`   Duration: ${duration}ms`);
  log(`   Logs: ${logs.length} entries`);
  log(`   Errors: ${errors.length} entries`);
  log('='.repeat(80));
}

async function clearLogs() {
  if (fs.existsSync(TEST_LOG_FILE)) {
    fs.unlinkSync(TEST_LOG_FILE);
  }
  log('📝 Test log file initialized');
}

async function setupBrowser(): Promise<puppeteer.Browser | null> {
  log('🚀 Setting up Chrome browser for testing...');

  const browser = await puppeteer.launch({
    headless: false, // Keep visible for debugging
    devtools: true, // Open devtools to see logs
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    defaultViewport: null,
  });

  log('✅ Browser launched successfully');
  return browser;
}

async function testBasicNavigation(browser: puppeteer.Browser): Promise<TestResult> {
  const testName = 'Basic Navigation with Telemetry';
  const startTime = Date.now();
  const logs: string[] = [];
  const errors: string[] = [];

  logTestStart(testName);

  try {
    // Get all pages and find the sidepanel
    const pages = await browser.pages();
    log(`📄 Found ${pages.length} pages`);

    let sidepanelPage = pages.find((p: puppeteer.Page) => p.url().includes('sidepanel.html'));
    if (!sidepanelPage) {
      // Try to create a new page and navigate to sidepanel
      sidepanelPage = await browser.newPage();
      await sidepanelPage.goto(`file://${EXTENSION_PATH}/sidepanel.html`);
    }

    if (!sidepanelPage) {
      throw new Error('Could not find or create sidepanel page');
    }

    log('✅ Sidepanel page loaded');

    // Capture console logs from sidepanel
    sidepanelPage.on('console', (msg: puppeteer.ConsoleMessage) => {
      const text = msg.text();
      logs.push(`[SIDEPANEL] ${text}`);
      log(`[SIDEPANEL-CONSOLE] ${text}`);
    });

    sidepanelPage.on('pageerror', (error: Error) => {
      const text = error.message;
      errors.push(`[SIDEPANEL-ERROR] ${text}`);
      log(`❌ [SIDEPANEL-ERROR] ${text}`);
    });

    // Enable browser tools if needed
    log('🔧 Checking if browser tools are enabled...');
    try {
      await sidepanelPage.waitForSelector('button[title*="Browser Tools"]', { timeout: 5000 });
      const browserToolsButton = await sidepanelPage.$('button[title*="Browser Tools"]');
      if (browserToolsButton) {
        const buttonText = await browserToolsButton.textContent();
        log(`🔘 Browser tools button found: ${buttonText}`);

        if (buttonText?.includes('○')) {
          log('🔄 Clicking to enable browser tools...');
          await browserToolsButton.click();
          await sidepanelPage.waitForTimeout(1000);
        }
      }
    } catch (e) {
      logs.push(`[SETUP] Browser tools check failed: ${e}`);
    }

    // Find the input field and send a navigation command
    log('📝 Sending navigation command...');
    const inputSelector = 'textarea[placeholder*="How can I help you"], textarea[placeholder*="Message"]';
    await sidepanelPage.waitForSelector(inputSelector, { timeout: 10000 });

    const input = await sidepanelPage.$(inputSelector);
    if (!input) {
      throw new Error('Could not find input field');
    }

    await input.click();
    await input.type('go to google.com', { delay: 50 });
    log('✅ Typed "go to google.com" into input');

    // Submit the form
    log('📤 Submitting command...');
    const submitButton = await sidepanelPage.$('button[type="submit"], button:has-text("Send"), button:has-text("Submit")');
    if (submitButton) {
      await submitButton.click();
      log('✅ Clicked submit button');
    } else {
      // Try pressing Enter
      await input.press('Enter');
      log('✅ Pressed Enter to submit');
    }

    // Wait for navigation to complete
    log('⏳ Waiting for navigation to complete...');
    await sidepanelPage.waitForTimeout(5000);

    // Check for telemetry logs in background script
    log('📊 Checking for telemetry logs...');
    const telemetryLogs = logs.filter(log => log.includes('[TELEMETRY]'));
    log(`📈 Found ${telemetryLogs.length} telemetry entries`);

    telemetryLogs.forEach(telemetryLog => {
      log(`   ${telemetryLog}`);
    });

    // Look for success indicators
    const successLogs = logs.filter(log =>
      log.includes('SUCCESS') ||
      log.includes('navigate: SUCCESS') ||
      log.includes('Final summary')
    );

    const errorLogs = logs.filter(log =>
      log.includes('FAILURE') ||
      log.includes('ERROR') ||
      log.includes('Error:')
    );

    log(`✅ Success indicators: ${successLogs.length}`);
    log(`❌ Error indicators: ${errorLogs.length}`);

    const duration = Date.now() - startTime;
    const status = successLogs.length > 0 && errorLogs.length === 0 ? 'PASS' : 'FAIL';

    logTestEnd(testName, status, duration, logs, errors);

    return {
      testName,
      status,
      duration,
      logs,
      errors,
      telemetry: telemetryLogs
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`[TEST-ERROR] ${errorMessage}`);
    log(`❌ Test failed with error: ${errorMessage}`);

    logTestEnd(testName, 'FAIL', duration, logs, errors);

    return {
      testName,
      status: 'FAIL',
      duration,
      logs,
      errors
    };
  }
}

async function testTelemetryRetrieval(browser: puppeteer.Browser): Promise<TestResult> {
  const testName = 'Telemetry Data Retrieval';
  const startTime = Date.now();
  const logs: string[] = [];
  const errors: string[] = [];

  logTestStart(testName);

  try {
    const pages = await browser.pages();
    const sidepanelPage = pages.find((p: puppeteer.Page) => p.url().includes('sidepanel.html')) || await browser.newPage();

    // Execute script to get telemetry data
    log('📊 Attempting to retrieve telemetry data...');

    const telemetryData = await sidepanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_TELEMETRY' }, (response) => {
          resolve(response);
        });
      });
    });

    logs.push(`[TELEMETRY-DATA] ${JSON.stringify(telemetryData, null, 2)}`);
    log(`📈 Telemetry data retrieved: ${JSON.stringify(telemetryData, null, 2)}`);

    const duration = Date.now() - startTime;
    const status = telemetryData ? 'PASS' : 'FAIL';

    logTestEnd(testName, status, duration, logs, errors);

    return {
      testName,
      status,
      duration,
      logs,
      errors,
      telemetry: telemetryData
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`[TEST-ERROR] ${errorMessage}`);
    log(`❌ Test failed with error: ${errorMessage}`);

    logTestEnd(testName, 'FAIL', duration, logs, errors);

    return {
      testName,
      status: 'FAIL',
      duration,
      logs,
      errors
    };
  }
}

async function runAllTests(): Promise<void> {
  log('\n🚀 Starting End-to-End Navigation Tests with Telemetry\n');

  await clearLogs();

  const browser = await setupBrowser();

  try {
    // Test 1: Basic Navigation
    const basicNavResult = await testBasicNavigation(browser);
    testResults.push(basicNavResult);

    // Test 2: Telemetry Retrieval
    const telemetryResult = await testTelemetryRetrieval(browser);
    testResults.push(telemetryResult);

  } finally {
    log('\n🔚 Closing browser...');
    await browser.close();
  }

  // Print final summary
  log('\n' + '='.repeat(80));
  log('📊 FINAL TEST SUMMARY');
  log('='.repeat(80));

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;

  log(`✅ Passed: ${passed}/${testResults.length}`);
  log(`❌ Failed: ${failed}/${testResults.length}`);
  log(`⏱️  Total Duration: ${testResults.reduce((sum, r) => sum + r.duration, 0)}ms`);

  testResults.forEach((result: TestResult) => {
    log(`   ${result.status === 'PASS' ? '✅' : '❌'} ${result.testName} (${result.duration}ms)`);
    if (result.errors.length > 0) {
      log(`      Errors: ${result.errors.length}`);
      result.errors.forEach((error: string) => {
        log(`        ${error}`);
      });
    }
  });

  log('='.repeat(80));
  log(`📝 Full logs saved to: ${TEST_LOG_FILE}`);
  log('='.repeat(80));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    log(`\n❌ Test suite failed with error: ${error}`);
    process.exit(1);
  });
}

export { runAllTests, testBasicNavigation, testTelemetryRetrieval };
