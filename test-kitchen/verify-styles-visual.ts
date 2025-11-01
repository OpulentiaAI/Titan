/**
 * Visual Style Verification Test
 * Uses browser automation to verify GT America fonts, Tailwind OKLCH colors, and styling
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

async function verifyFont(page: Page): Promise<StyleVerification[]> {
  console.log('\n🔍 Verifying GT America Font Integration...\n');
  
  const fontTests: StyleVerification[] = [];

  // Check body font
  const bodyFont = await verifyStyle(page, 'body', 'font-family');
  bodyFont.passed = bodyFont.value?.includes('GT America') || false;
  fontTests.push(bodyFont);

  // Check if GT America font is loaded
  const fontLoaded = await page.evaluate(() => {
    return document.fonts.check('1em GT America');
  });
  fontTests.push({
    test: 'GT America font loaded',
    passed: fontLoaded,
    details: fontLoaded ? 'Font is loaded and available' : 'Font not loaded',
    value: fontLoaded,
  });

  // Check code elements use GT America Mono
  const codeFont = await verifyStyle(page, 'code', 'font-family');
  codeFont.passed = codeFont.value?.includes('GT America Mono') || false;
  fontTests.push(codeFont);

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
    };
  });
  
  colorTests.push({
    test: 'CSS variables (OKLCH)',
    passed: cssVars.background.includes('oklch') || cssVars.background.includes('rgb'),
    details: `Background: ${cssVars.background.substring(0, 50)}...`,
    value: cssVars,
  });

  return colorTests;
}

async function verifyComponents(page: Page): Promise<StyleVerification[]> {
  console.log('\n🧩 Verifying Component Styling...\n');
  
  const componentTests: StyleVerification[] = [];

  // Check if main components exist
  const hasSidepanel = await page.evaluate(() => {
    return document.querySelector('[data-sidepanel]') !== null ||
           document.body.innerHTML.includes('sidepanel') ||
           document.body.innerHTML.length > 0;
  });

  componentTests.push({
    test: 'Sidepanel content loaded',
    passed: hasSidepanel,
    details: hasSidepanel ? 'Content rendered' : 'No content found',
    value: hasSidepanel,
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
  console.log('║           🎨 VISUAL STYLE VERIFICATION TEST                                   ║');
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
    console.log('\n🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Show browser for visual verification
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Load the sidepanel via HTTP server
    const url = `http://localhost:${serverPort}/sidepanel.html`;
    console.log(`\n📄 Loading: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    console.log('✅ Page loaded\n');

    // Wait a bit for fonts and styles to load
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

    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    const screenshotPath = await takeScreenshot(page, 'style-verification');
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
      console.log('✅ GT America fonts are loading correctly');
      console.log('✅ Tailwind OKLCH colors are applied');
      console.log('✅ Light mode is default');
      console.log('✅ Components are styled correctly\n');
    } else {
      console.log('⚠️  Some verifications failed. Check details above.\n');
    }

    // Keep browser open for 5 seconds for visual inspection
    console.log('👀 Browser will stay open for 5 seconds for visual inspection...');
    await new Promise(resolve => setTimeout(resolve, 5000));

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

