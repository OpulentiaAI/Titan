/**
 * Chrome Extension Sidepanel Verification Test
 * Loads extension and opens sidepanel using Chrome DevTools Protocol
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🎨 CHROME EXTENSION SIDEPANEL VERIFICATION                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const distPath = resolve(PROJECT_ROOT, 'dist');
  if (!existsSync(distPath)) {
    console.error('❌ dist/ folder not found. Please run: npm run build');
    process.exit(1);
  }

  console.log('🌐 Launching Chrome with extension...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--load-extension=${distPath}`,
      '--disable-extensions-except=' + distPath,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  try {
    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get extension pages
    const targets = await browser.targets();
    const extensionTargets = targets.filter(t => 
      t.type() === 'service_worker' || 
      t.url().includes('chrome-extension://') ||
      t.url().includes('sidepanel')
    );

    console.log(`📋 Found ${extensionTargets.length} extension targets\n`);

    // Find the sidepanel page
    let sidepanelPage: Page | null = null;
    
    for (const target of targets) {
      const url = target.url();
      if (url.includes('sidepanel.html')) {
        sidepanelPage = await target.page();
        if (sidepanelPage) {
          console.log(`✅ Found sidepanel page: ${url}\n`);
          break;
        }
      }
    }

    // If sidepanel not found, try to open it manually
    if (!sidepanelPage) {
      console.log('⚠️  Sidepanel not auto-opened, trying to open manually...\n');
      
      // Create a new page and navigate to extension
      const page = await browser.newPage();
      
      // Get extension ID from manifest
      const manifestPath = resolve(distPath, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      
      // Try to access chrome://extensions to get the ID
      await page.goto('chrome://extensions', { waitUntil: 'networkidle0' });
      
      // Enable developer mode and get extension ID
      await page.evaluate(() => {
        const devModeToggle = document.querySelector('extensions-manager')?.shadowRoot
          ?.querySelector('extensions-toolbar')?.shadowRoot
          ?.querySelector('#devMode');
        if (devModeToggle) {
          (devModeToggle as HTMLElement).click();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to find extension by name and get its ID
      const extensionInfo = await page.evaluate(() => {
        const manager = document.querySelector('extensions-manager');
        if (!manager) return null;
        
        const items = manager.shadowRoot?.querySelectorAll('extensions-item');
        if (!items) return null;
        
        for (const item of Array.from(items)) {
          const name = item.shadowRoot?.querySelector('#name')?.textContent;
          if (name?.includes('Opulent') || name?.includes('Chat')) {
            const id = item.getAttribute('id');
            return { id, name };
          }
        }
        return null;
      });

      if (extensionInfo?.id) {
        console.log(`✅ Found extension ID: ${extensionInfo.id}\n`);
        const sidepanelUrl = `chrome-extension://${extensionInfo.id}/sidepanel.html`;
        console.log(`📄 Opening sidepanel: ${sidepanelUrl}\n`);
        
        sidepanelPage = await browser.newPage();
        await sidepanelPage.goto(sidepanelUrl, { 
          waitUntil: 'networkidle0',
          timeout: 30000,
        });
      } else {
        console.log('⚠️  Could not find extension ID automatically\n');
        console.log('💡 Manual steps:');
        console.log('   1. Open chrome://extensions');
        console.log('   2. Enable Developer mode');
        console.log('   3. Find your extension');
        console.log('   4. Click "side panel" or open the sidepanel');
        console.log('   5. Inspect the sidepanel page in DevTools\n');
        
        // Keep browser open
        await new Promise(resolve => setTimeout(resolve, 30000));
        return;
      }
    }

    if (!sidepanelPage) {
      console.error('❌ Could not open sidepanel');
      await browser.close();
      return;
    }

    // Set viewport
    await sidepanelPage.setViewport({ width: 1400, height: 900 });

    console.log('⏳ Waiting for React app to mount...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Wait for content
    try {
      await sidepanelPage.waitForSelector('#root', { timeout: 10000 });
      await sidepanelPage.waitForFunction(
        () => {
          const root = document.getElementById('root');
          return root && root.children.length > 0;
        },
        { timeout: 10000 }
      );
      console.log('✅ React app mounted\n');
    } catch (e) {
      console.log('⚠️  Content may still be loading...\n');
    }

    // Get page info
    const pageInfo = await sidepanelPage.evaluate(() => {
      return {
        title: document.title,
        bodyHTML: document.body.innerHTML.length,
        rootHTML: document.getElementById('root')?.innerHTML.length || 0,
        rootChildren: document.getElementById('root')?.children.length || 0,
        scripts: document.querySelectorAll('script').length,
        stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
      };
    });

    console.log('📄 Page Info:');
    console.log(`   Title: ${pageInfo.title}`);
    console.log(`   Body HTML length: ${pageInfo.bodyHTML}`);
    console.log(`   Root HTML length: ${pageInfo.rootHTML}`);
    console.log(`   Root children: ${pageInfo.rootChildren}`);
    console.log(`   Scripts: ${pageInfo.scripts}`);
    console.log(`   Stylesheets: ${pageInfo.stylesheets}\n`);

    // Verify fonts
    console.log('🔍 Verifying GT America Font...\n');
    
    const fontInfo = await sidepanelPage.evaluate(() => {
      const body = document.body;
      const bodyStyle = window.getComputedStyle(body);
      const root = document.getElementById('root');
      const rootStyle = root ? window.getComputedStyle(root) : null;
      
      return {
        bodyFont: bodyStyle.fontFamily,
        rootFont: rootStyle?.fontFamily || 'none',
        gtAmericaLoaded: document.fonts.check('1em GT America') || 
                         document.fonts.check('1em "GT America"'),
        fontFaces: Array.from(document.styleSheets).flatMap(sheet => {
          try {
            return Array.from(sheet.cssRules)
              .filter(rule => rule instanceof CSSFontFaceRule)
              .map(rule => (rule as CSSFontFaceRule).fontFamily);
          } catch {
            return [];
          }
        }),
      };
    });

    console.log(`   Body font: ${fontInfo.bodyFont}`);
    console.log(`   Root font: ${fontInfo.rootFont}`);
    console.log(`   GT America loaded: ${fontInfo.gtAmericaLoaded ? '✅' : '❌'}`);
    console.log(`   Font faces found: ${fontInfo.fontFaces.length}\n`);

    // Verify colors
    console.log('🎨 Verifying Colors...\n');
    
    const colorInfo = await sidepanelPage.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      
      return {
        background: body.backgroundColor,
        foreground: body.color,
        cssVars: {
          background: root.getPropertyValue('--background'),
          foreground: root.getPropertyValue('--foreground'),
          fontSans: root.getPropertyValue('--font-sans'),
        },
        darkMode: document.documentElement.classList.contains('dark'),
      };
    });

    console.log(`   Background: ${colorInfo.background}`);
    console.log(`   Foreground: ${colorInfo.foreground}`);
    console.log(`   CSS var --background: ${colorInfo.cssVars.background || 'none'}`);
    console.log(`   CSS var --font-sans: ${colorInfo.cssVars.fontSans || 'none'}`);
    console.log(`   Dark mode: ${colorInfo.darkMode ? '❌' : '✅ Light mode'}\n`);

    // Take screenshot
    console.log('📸 Taking screenshot...\n');
    const screenshotPath = resolve(PROJECT_ROOT, 'test-kitchen/screenshots/sidepanel-chrome.png');
    const screenshotDir = resolve(PROJECT_ROOT, 'test-kitchen/screenshots');
    
    if (!existsSync(screenshotDir)) {
      const { mkdirSync } = await import('fs');
      mkdirSync(screenshotDir, { recursive: true });
    }

    await sidepanelPage.screenshot({ 
      path: screenshotPath,
      fullPage: true,
    });

    console.log(`✅ Screenshot saved: ${screenshotPath}\n`);

    // Open DevTools
    console.log('🔧 Opening Chrome DevTools...\n');
    console.log('💡 You can now:');
    console.log('   1. Inspect elements in the Elements panel');
    console.log('   2. Check fonts in Computed styles');
    console.log('   3. Verify CSS variables in Styles panel');
    console.log('   4. Check Console for any errors\n');

    // Keep browser open for inspection
    console.log('👀 Browser will stay open for 30 seconds for inspection...\n');
    console.log('   Press Ctrl+C to close early\n');
    
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed\n');
  }
}

main().catch(console.error);

