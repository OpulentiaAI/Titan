/**
 * Chrome Extension Sidepanel Verification - Direct Navigation
 * Navigates directly to sidepanel.html and verifies styles with DevTools
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

async function findExtensionId(distPath: string): Promise<string | null> {
  // Try to find extension ID from Chrome's extension directory
  // On macOS, extensions are stored in ~/Library/Application Support/Google/Chrome/Default/Extensions
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) return null;

  const chromeExtDir = resolve(
    homeDir,
    'Library/Application Support/Google/Chrome/Default/Extensions'
  );

  if (!existsSync(chromeExtDir)) return null;

  try {
    // Look for extensions that match our manifest
    const manifestPath = resolve(distPath, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const extensionName = manifest.name;

    const extensions = readdirSync(chromeExtDir);
    
    // Check each extension for matching name
    for (const extId of extensions) {
      const extPath = resolve(chromeExtDir, extId);
      const versions = readdirSync(extPath);
      
      for (const version of versions) {
        const versionManifest = resolve(extPath, version, 'manifest.json');
        if (existsSync(versionManifest)) {
          try {
            const versionManifestContent = JSON.parse(readFileSync(versionManifest, 'utf-8'));
            if (versionManifestContent.name === extensionName) {
              return extId;
            }
          } catch {
            // Continue
          }
        }
      }
    }
  } catch {
    // Continue
  }

  return null;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🎨 CHROME EXTENSION SIDEPANEL VERIFICATION - DIRECT NAVIGATION         ║');
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
      '--auto-open-devtools-for-tabs',
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    devtools: true,
  });

  try {
    console.log('⏳ Waiting for extension to load...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to find extension ID
    console.log('📋 Finding extension ID...\n');
    let extensionId = await findExtensionId(distPath);

    if (!extensionId) {
      console.log('⚠️  Could not find extension ID automatically\n');
      console.log('💡 Please manually:');
      console.log('   1. Open chrome://extensions');
      console.log('   2. Enable Developer mode');
      console.log('   3. Find your extension');
      console.log('   4. Copy the extension ID\n');
      console.log('   Or navigate to: chrome-extension://[YOUR-EXTENSION-ID]/sidepanel.html\n');
      
      // Open extensions page
      const page = await browser.newPage();
      await page.goto('chrome://extensions', { waitUntil: 'networkidle0' });
      
      console.log('⏳ Waiting 60 seconds for you to get the extension ID and open sidepanel...\n');
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      await browser.close();
      return;
    }

    console.log(`✅ Found extension ID: ${extensionId}\n`);
    
    // Open sidepanel directly
    const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
    console.log(`📄 Opening sidepanel: ${sidepanelUrl}\n`);
    
    const sidepanelPage = await browser.newPage();
    await sidepanelPage.setViewport({ width: 1400, height: 900 });
    
    try {
      await sidepanelPage.goto(sidepanelUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      console.log('✅ Sidepanel loaded\n');
    } catch (error: any) {
      console.log(`⚠️  Error loading sidepanel: ${error.message}\n`);
      console.log('💡 The extension may need to be reloaded. Try:');
      console.log('   1. Go to chrome://extensions');
      console.log('   2. Click the reload button on your extension');
      console.log('   3. Then run this test again\n');
      
      await browser.close();
      return;
    }

    // Wait for React app
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

    // Comprehensive verification
    console.log('📊 Verifying styles with DevTools...\n');
    
    const verification = await sidepanelPage.evaluate(() => {
      const root = document.getElementById('root');
      const bodyStyle = window.getComputedStyle(document.body);
      const rootStyle = root ? window.getComputedStyle(root) : null;
      const htmlStyle = window.getComputedStyle(document.documentElement);
      
      // Check all font faces
      const fontFaces: string[] = [];
      try {
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            Array.from(sheet.cssRules).forEach(rule => {
              if (rule instanceof CSSFontFaceRule) {
                fontFaces.push(rule.fontFamily);
              }
            });
          } catch (e) {
            // Cross-origin stylesheet
          }
        });
      } catch (e) {
        // Continue
      }
      
      return {
        title: document.title,
        url: window.location.href,
        rootChildren: root?.children.length || 0,
        bodyFont: bodyStyle.fontFamily,
        bodyBg: bodyStyle.backgroundColor,
        bodyColor: bodyStyle.color,
        rootFont: rootStyle?.fontFamily || 'none',
        gtAmericaLoaded: document.fonts.check('1em GT America') || 
                         document.fonts.check('1em "GT America"') ||
                         document.fonts.check('16px GT America'),
        fontFaces,
        cssVars: {
          background: htmlStyle.getPropertyValue('--background'),
          foreground: htmlStyle.getPropertyValue('--foreground'),
          fontSans: htmlStyle.getPropertyValue('--font-sans'),
          fontMono: htmlStyle.getPropertyValue('--font-mono'),
        },
        darkMode: document.documentElement.classList.contains('dark'),
      };
    });

    console.log('📄 Page Info:');
    console.log(`   URL: ${verification.url}`);
    console.log(`   Title: ${verification.title}`);
    console.log(`   Root children: ${verification.rootChildren}\n`);

    console.log('🎨 Style Verification:');
    console.log(`   Body font: ${verification.bodyFont}`);
    console.log(`   Root font: ${verification.rootFont}`);
    console.log(`   Body background: ${verification.bodyBg}`);
    console.log(`   Body color: ${verification.bodyColor}`);
    console.log(`   GT America loaded: ${verification.gtAmericaLoaded ? '✅' : '❌'}`);
    console.log(`   Dark mode: ${verification.darkMode ? '❌' : '✅ Light mode'}`);
    console.log(`   Font faces found: ${verification.fontFaces.length}\n`);

    if (verification.fontFaces.length > 0) {
      console.log('📝 Font Faces:');
      verification.fontFaces.forEach((face, i) => {
        console.log(`   ${i + 1}. ${face}`);
      });
      console.log('');
    }

    console.log('🎨 CSS Variables:');
    console.log(`   --background: ${verification.cssVars.background || 'none'}`);
    console.log(`   --foreground: ${verification.cssVars.foreground || 'none'}`);
    console.log(`   --font-sans: ${verification.cssVars.fontSans || 'none'}`);
    console.log(`   --font-mono: ${verification.cssVars.fontMono || 'none'}\n`);

    // Take screenshot
    console.log('📸 Taking screenshot...\n');
    const screenshotPath = resolve(PROJECT_ROOT, 'test-kitchen/screenshots/sidepanel-verified.png');
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

    console.log('🔧 Chrome DevTools is open!\n');
    console.log('💡 Use DevTools to verify:');
    console.log('   1. Elements → Select <body> → Computed → font-family');
    console.log('   2. Elements → Select <body> → Computed → background-color');
    console.log('   3. Elements → Select :root → Styles → CSS variables');
    console.log('   4. Network → Filter "fonts" → Verify GT America fonts loaded\n');

    console.log('👀 Browser will stay open for 60 seconds...\n');
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

