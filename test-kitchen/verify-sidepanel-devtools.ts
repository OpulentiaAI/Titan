/**
 * Chrome Extension Sidepanel Verification with DevTools
 * Loads extension, opens sidepanel, and uses DevTools Protocol to verify styles
 */

import puppeteer, { Browser, Page, CDPSession } from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

async function openSidepanel(browser: Browser, extensionId: string): Promise<Page | null> {
  // Use Chrome DevTools Protocol to trigger sidepanel
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  
  const client = await page.target().createCDPSession();
  
  try {
    // Navigate to a page first
    await page.goto('https://example.com', { waitUntil: 'networkidle0' });
    
    // Try to open sidepanel via extension API
    const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
    
    // Open sidepanel page directly
    const sidepanelPage = await browser.newPage();
    await sidepanelPage.goto(sidepanelUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
    
    return sidepanelPage;
  } catch (error: any) {
    console.log(`⚠️  Error opening sidepanel: ${error.message}`);
    return null;
  }
}

async function getExtensionId(browser: Browser): Promise<string | null> {
  const page = await browser.newPage();
  
  try {
    await page.goto('chrome://extensions', { waitUntil: 'networkidle0' });
    
    // Enable developer mode
    await page.evaluate(() => {
      const manager = document.querySelector('extensions-manager');
      if (manager) {
        const devMode = manager.shadowRoot
          ?.querySelector('extensions-toolbar')
          ?.shadowRoot
          ?.querySelector('#devMode') as HTMLElement;
        if (devMode && !devMode.hasAttribute('checked')) {
          devMode.click();
        }
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get extension ID
    const extensionId = await page.evaluate(() => {
      const manager = document.querySelector('extensions-manager');
      if (!manager) return null;
      
      const items = Array.from(manager.shadowRoot?.querySelectorAll('extensions-item') || []);
      
      for (const item of items) {
        const name = item.shadowRoot?.querySelector('#name')?.textContent || '';
        if (name.includes('Opulent') || name.includes('Chat') || name.includes('Sidebar')) {
          const id = item.getAttribute('id');
          if (id) return id;
        }
      }
      
      // Try to get first extension ID
      if (items.length > 0) {
        return items[0].getAttribute('id');
      }
      
      return null;
    });
    
    await page.close();
    return extensionId;
  } catch (error: any) {
    console.log(`⚠️  Error getting extension ID: ${error.message}`);
    await page.close();
    return null;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🎨 CHROME EXTENSION SIDEPANEL VERIFICATION WITH DEVTOOLS               ║');
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
      '--auto-open-devtools-for-tabs', // Auto-open DevTools
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    devtools: true, // Open DevTools automatically
  });

  try {
    console.log('⏳ Waiting for extension to load...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get extension ID
    console.log('📋 Getting extension ID...\n');
    const extensionId = await getExtensionId(browser);
    
    if (!extensionId) {
      console.log('⚠️  Could not get extension ID automatically\n');
      console.log('💡 Opening chrome://extensions for manual inspection...\n');
      
      const page = await browser.newPage();
      await page.goto('chrome://extensions', { waitUntil: 'networkidle0' });
      
      console.log('📋 Please:');
      console.log('   1. Find your extension in the list');
      console.log('   2. Copy its ID (long string of letters)');
      console.log('   3. Open sidepanel manually');
      console.log('   4. Inspect it in DevTools\n');
      
      console.log('⏳ Waiting 30 seconds for manual inspection...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      await browser.close();
      return;
    }

    console.log(`✅ Extension ID: ${extensionId}\n`);
    
    // Open sidepanel
    console.log('📄 Opening sidepanel...\n');
    const sidepanelPage = await openSidepanel(browser, extensionId);
    
    if (!sidepanelPage) {
      console.log('⚠️  Could not open sidepanel automatically\n');
      console.log('💡 Manual steps:');
      console.log(`   1. Navigate to: chrome-extension://${extensionId}/sidepanel.html`);
      console.log('   2. Or click the extension icon and open sidepanel');
      console.log('   3. DevTools should open automatically\n');
      
      console.log('⏳ Waiting 30 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      await browser.close();
      return;
    }

    console.log('✅ Sidepanel opened\n');

    // Set viewport
    await sidepanelPage.setViewport({ width: 1400, height: 900 });

    // Wait for content
    console.log('⏳ Waiting for React app to mount...\n');
    
    try {
      await sidepanelPage.waitForSelector('#root', { timeout: 10000 });
      await sidepanelPage.waitForFunction(
        () => {
          const root = document.getElementById('root');
          return root && root.children.length > 0;
        },
        { timeout: 15000 }
      );
      console.log('✅ React app mounted\n');
    } catch (e) {
      console.log('⚠️  Content may still be loading...\n');
    }

    // Additional wait for fonts/styles
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get comprehensive page info
    console.log('📊 Getting page information...\n');
    
    const pageInfo = await sidepanelPage.evaluate(() => {
      const root = document.getElementById('root');
      
      return {
        title: document.title,
        url: window.location.href,
        bodyHTML: document.body.innerHTML.length,
        rootHTML: root?.innerHTML.length || 0,
        rootChildren: root?.children.length || 0,
        scripts: document.querySelectorAll('script').length,
        stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
        allElements: document.querySelectorAll('*').length,
        bodyFont: window.getComputedStyle(document.body).fontFamily,
        bodyBg: window.getComputedStyle(document.body).backgroundColor,
        rootFont: root ? window.getComputedStyle(root).fontFamily : 'none',
        gtAmericaLoaded: document.fonts.check('1em GT America') || 
                         document.fonts.check('1em "GT America"') ||
                         document.fonts.check('16px GT America'),
        cssVars: {
          background: getComputedStyle(document.documentElement).getPropertyValue('--background'),
          foreground: getComputedStyle(document.documentElement).getPropertyValue('--foreground'),
          fontSans: getComputedStyle(document.documentElement).getPropertyValue('--font-sans'),
        },
        darkMode: document.documentElement.classList.contains('dark'),
      };
    });

    console.log('📄 Page Information:');
    console.log(`   URL: ${pageInfo.url}`);
    console.log(`   Title: ${pageInfo.title}`);
    console.log(`   Body HTML length: ${pageInfo.bodyHTML}`);
    console.log(`   Root HTML length: ${pageInfo.rootHTML}`);
    console.log(`   Root children: ${pageInfo.rootChildren}`);
    console.log(`   Total elements: ${pageInfo.allElements}`);
    console.log(`   Scripts: ${pageInfo.scripts}`);
    console.log(`   Stylesheets: ${pageInfo.stylesheets}\n`);

    console.log('🎨 Style Information:');
    console.log(`   Body font: ${pageInfo.bodyFont}`);
    console.log(`   Root font: ${pageInfo.rootFont}`);
    console.log(`   Body background: ${pageInfo.bodyBg}`);
    console.log(`   GT America loaded: ${pageInfo.gtAmericaLoaded ? '✅' : '❌'}`);
    console.log(`   Dark mode: ${pageInfo.darkMode ? '❌' : '✅ Light mode'}\n`);

    console.log('🎨 CSS Variables:');
    console.log(`   --background: ${pageInfo.cssVars.background || 'none'}`);
    console.log(`   --foreground: ${pageInfo.cssVars.foreground || 'none'}`);
    console.log(`   --font-sans: ${pageInfo.cssVars.fontSans || 'none'}\n`);

    // Take screenshot
    console.log('📸 Taking screenshot...\n');
    const screenshotPath = resolve(PROJECT_ROOT, 'test-kitchen/screenshots/sidepanel-devtools.png');
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

    // Open DevTools (should already be open)
    console.log('🔧 Chrome DevTools is open!\n');
    console.log('💡 You can now:');
    console.log('   1. Inspect elements in the Elements panel');
    console.log('   2. Check fonts in Computed styles');
    console.log('   3. Verify CSS variables in Styles panel');
    console.log('   4. Check Console for any errors');
    console.log('   5. View Network tab to see font loading\n');

    // Keep browser open for inspection
    console.log('👀 Browser will stay open for 60 seconds for inspection...\n');
    console.log('   Press Ctrl+C to close early\n');
    
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed\n');
  }
}

main().catch(console.error);

