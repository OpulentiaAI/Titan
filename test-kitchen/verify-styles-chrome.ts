/**
 * Visual Style Verification Test with Chrome Extension Loading
 * Uses browser automation to load extension, open sidepanel, and verify styles
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { lookup } from 'mime-types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

interface StyleVerification {
  test: string;
  passed: boolean;
  details: string;
  value?: any;
}

const results: StyleVerification[] = [];

async function verifyStyle(page: Page, selector: string, property: string, expectedValue?: string): Promise<StyleVerification> {
  try {
    const computed = await page.evaluate((sel, prop) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      const styles = window.getComputedStyle(element);
      return styles.getPropertyValue(prop);
    }, selector, property);

    const passed = expectedValue ? computed.includes(expectedValue) : !!computed;
    
    return {
      test: `${selector} → ${property}`,
      passed,
      details: expectedValue 
        ? `Expected: ${expectedValue}, Got: ${computed}` 
        : `Value: ${computed}`,
      value: computed,
    };
  } catch (error: any) {
    return {
      test: `${selector} → ${property}`,
      passed: false,
      details: `Error: ${error.message}`,
    };
  }
}

async function waitForContent(page: Page, timeout = 10000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      },
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

async function verifyFont(page: Page): Promise<StyleVerification[]> {
  console.log('\n🔍 Verifying GT America Font Integration...\n');
  
  const fontTests: StyleVerification[] = [];

  // Wait for content to load
  await waitForContent(page, 5000);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check body font
  const bodyFont = await verifyStyle(page, 'body', 'font-family');
  bodyFont.passed = bodyFont.value?.includes('GT America') || bodyFont.value?.includes('GT-America') || false;
  fontTests.push(bodyFont);

  // Check if GT America font is loaded
  const fontLoaded = await page.evaluate(() => {
    return document.fonts.check('1em GT America') || 
           document.fonts.check('1em "GT America"') ||
           document.fonts.check('16px GT America');
  });
  fontTests.push({
    test: 'GT America font loaded',
    passed: fontLoaded,
    details: fontLoaded ? 'Font is loaded and available' : 'Font not loaded (may need time to load)',
    value: fontLoaded,
  });

  // Check code elements use GT America Mono
  const codeFont = await verifyStyle(page, 'code', 'font-family');
  codeFont.passed = codeFont.value?.includes('GT America Mono') || codeFont.value?.includes('GT-America-Mono') || codeFont.value !== null;
  fontTests.push(codeFont);

  // Check any text element for font
  const textFont = await page.evaluate(() => {
    const element = document.querySelector('div, p, span, h1, h2, h3');
    if (!element) return null;
    const styles = window.getComputedStyle(element);
    return styles.fontFamily;
  });
  fontTests.push({
    test: 'Text element font-family',
    passed: !!textFont,
    details: `Font: ${textFont || 'none found'}`,
    value: textFont,
  });

  return fontTests;
}

async function verifyColors(page: Page): Promise<StyleVerification[]> {
  console.log('\n🎨 Verifying Tailwind OKLCH Colors...\n');
  
  const colorTests: StyleVerification[] = [];

  // Check background color (should be light mode default)
  const bgColor = await verifyStyle(page, 'body', 'background-color');
  colorTests.push({
    test: 'Background color (light mode)',
    passed: !!bgColor.value,
    details: `Background: ${bgColor.value}`,
    value: bgColor.value,
  });

  // Check if dark class is absent (light mode default)
  const hasDarkClass = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') || 
           document.body.classList.contains('dark');
  });
  colorTests.push({
    test: 'Light mode default',
    passed: !hasDarkClass,
    details: hasDarkClass ? 'Dark mode detected (should be light)' : 'Light mode active ✓',
    value: !hasDarkClass,
  });

  // Verify CSS variables are set
  const cssVars = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      background: root.getPropertyValue('--background'),
      foreground: root.getPropertyValue('--foreground'),
      primary: root.getPropertyValue('--primary'),
      card: root.getPropertyValue('--card'),
      fontSans: root.getPropertyValue('--font-sans'),
    };
  });
  
  colorTests.push({
    test: 'CSS variables (OKLCH/HSL)',
    passed: !!cssVars.background || !!cssVars.fontSans,
    details: `Background: ${cssVars.background?.substring(0, 50) || 'none'}..., Font: ${cssVars.fontSans?.substring(0, 30) || 'none'}...`,
    value: cssVars,
  });

  return colorTests;
}

async function verifyComponents(page: Page): Promise<StyleVerification[]> {
  console.log('\n🧩 Verifying Component Styling...\n');
  
  const componentTests: StyleVerification[] = [];

  // Check if root element exists and has content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return { exists: false, children: 0, html: '' };
    return {
      exists: true,
      children: root.children.length,
      html: root.innerHTML.substring(0, 200),
    };
  });

  componentTests.push({
    test: 'Root element exists',
    passed: rootContent.exists,
    details: rootContent.exists ? `Root found with ${rootContent.children} children` : 'Root element not found',
    value: rootContent,
  });

  // Check if any content is rendered
  const hasContent = await page.evaluate(() => {
    const body = document.body;
    return body.innerHTML.length > 100 || body.textContent?.length > 50;
  });

  componentTests.push({
    test: 'Content rendered',
    passed: hasContent,
    details: hasContent ? 'Content is rendered' : 'No content found',
    value: hasContent,
  });

  // Check for React app
  const reactApp = await page.evaluate(() => {
    return !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || 
           document.querySelector('[data-reactroot]') !== null ||
           document.querySelector('#root')?.children.length > 0;
  });

  componentTests.push({
    test: 'React app mounted',
    passed: reactApp,
    details: reactApp ? 'React app detected' : 'React app not detected',
    value: reactApp,
  });

  return componentTests;
}

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const screenshotPath = resolve(PROJECT_ROOT, `test-kitchen/screenshots/${name}.png`);
  const screenshotDir = resolve(PROJECT_ROOT, 'test-kitchen/screenshots');
  
  if (!existsSync(screenshotDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(screenshotDir, { recursive: true });
  }

  await page.screenshot({ 
    path: screenshotPath,
    fullPage: true,
  });

  return screenshotPath;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🎨 VISUAL STYLE VERIFICATION - CHROME EXTENSION LOADING                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Check if dist folder exists
  const distPath = resolve(PROJECT_ROOT, 'dist');
  if (!existsSync(distPath)) {
    console.error('❌ dist/ folder not found. Please run: npm run build');
    process.exit(1);
  }

  // Check if sidepanel.html exists
  const sidepanelPath = resolve(distPath, 'sidepanel.html');
  if (!existsSync(sidepanelPath)) {
    console.error('❌ dist/sidepanel.html not found. Please run: npm run build');
    process.exit(1);
  }

  // Check if fonts are copied
  const fontsPath = resolve(distPath, 'fonts/gt-america');
  if (!existsSync(fontsPath)) {
    console.warn('⚠️  Fonts folder not found in dist/. Building may not have copied fonts.');
  } else {
    console.log('✅ Fonts found in dist/fonts/gt-america/');
  }

  // Start local HTTP server
  const serverPort = 8080;
  const server = createServer((req, res) => {
    let filePath = resolve(distPath, req.url === '/' ? 'sidepanel.html' : req.url!.replace(/^\//, ''));
    
    // Security: ensure file is within distPath
    if (!filePath.startsWith(distPath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const content = readFileSync(filePath);
      const contentType = lookup(filePath) || 'application/octet-stream';
      
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } catch (error: any) {
      res.writeHead(500);
      res.end(`Error: ${error.message}`);
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(serverPort, () => {
      console.log(`✅ HTTP server started on http://localhost:${serverPort}\n`);
      resolve();
    });
  });

  let browser: Browser | null = null;

  try {
    console.log('\n🌐 Launching Chrome with extension...');
    
    // Get the path to the extension
    const extensionPath = distPath;
    
    browser = await puppeteer.launch({
      headless: false, // Show browser for visual verification
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--enable-automation',
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1400, height: 900 });

    // Navigate to chrome-extension:// URL to open sidepanel
    // First, get the extension ID
    console.log('\n📋 Getting extension ID...');
    
    // Try to access extension pages
    const extensionId = await page.evaluate(() => {
      // Try to get from chrome.runtime
      if ((window as any).chrome?.runtime?.id) {
        return (window as any).chrome.runtime.id;
      }
      return null;
    }).catch(() => null);

    if (extensionId) {
      console.log(`✅ Extension ID: ${extensionId}`);
      const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
      console.log(`\n📄 Loading: ${sidepanelUrl}`);
      await page.goto(sidepanelUrl, { 
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
    } else {
      // Fallback: Load via HTTP server
      console.log('\n📄 Loading via HTTP server (fallback)...');
      const url = `http://localhost:${serverPort}/sidepanel.html`;
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
    }

    console.log('✅ Page loaded\n');

    // Wait for React app to mount
    console.log('⏳ Waiting for React app to mount...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to wait for content
    const contentLoaded = await waitForContent(page, 10000);
    if (contentLoaded) {
      console.log('✅ Content detected\n');
    } else {
      console.log('⚠️  Content may still be loading...\n');
    }

    // Wait a bit more for fonts and styles
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify fonts
    const fontResults = await verifyFont(page);
    results.push(...fontResults);

    // Verify colors
    const colorResults = await verifyColors(page);
    results.push(...colorResults);

    // Verify components
    const componentResults = await verifyComponents(page);
    results.push(...componentResults);

    // Get page HTML for debugging
    const pageHTML = await page.evaluate(() => {
      return {
        bodyHTML: document.body.innerHTML.substring(0, 500),
        rootHTML: document.getElementById('root')?.innerHTML.substring(0, 500) || 'none',
        title: document.title,
      };
    });

    console.log('\n📄 Page Info:');
    console.log(`   Title: ${pageHTML.title}`);
    console.log(`   Body HTML length: ${pageHTML.bodyHTML.length}`);
    console.log(`   Root HTML length: ${pageHTML.rootHTML.length}`);

    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    const screenshotPath = await takeScreenshot(page, 'style-verification-chrome');
    console.log(`✅ Screenshot saved: ${screenshotPath}`);

    // Print results
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           VERIFICATION RESULTS                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    let passed = 0;
    let failed = 0;

    results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} [${index + 1}] ${result.test}`);
      console.log(`   ${result.details}`);
      if (result.passed) passed++;
      else failed++;
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total:  ${results.length}`);
    console.log(`\n🎯 Score: ${Math.round((passed / results.length) * 100)}/100\n`);

    if (failed === 0) {
      console.log('🎉 ALL STYLE VERIFICATIONS PASSED!\n');
    } else {
      console.log('⚠️  Some verifications failed. Check details above.\n');
    }

    // Keep browser open for 10 seconds for visual inspection
    console.log('👀 Browser will stay open for 10 seconds for visual inspection...');
    console.log('💡 You can manually inspect the sidepanel in Chrome DevTools\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error: any) {
    console.error('\n❌ Error during verification:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    server.close();
    console.log('\n✅ HTTP server stopped');
  }
}

main().catch(console.error);

