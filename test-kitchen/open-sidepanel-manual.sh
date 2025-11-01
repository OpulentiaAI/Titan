#!/bin/bash

# Manual Chrome Extension Sidepanel Opener
# This script helps you manually open and verify the sidepanel

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║     🎨 CHROME EXTENSION SIDEPANEL - MANUAL VERIFICATION                       ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if dist exists
if [ ! -d "dist" ]; then
    echo "❌ dist/ folder not found. Please run: npm run build"
    exit 1
fi

echo "✅ Extension built in dist/"
echo ""
echo "📋 Manual Verification Steps:"
echo ""
echo "1. Open Chrome and go to: chrome://extensions"
echo ""
echo "2. Enable 'Developer mode' (toggle in top-right)"
echo ""
echo "3. Click 'Load unpacked'"
echo ""
echo "4. Select this folder: $(pwd)/dist"
echo ""
echo "5. Find your extension in the list (should be 'Opulent Chat Sidebar')"
echo ""
echo "6. Click the extension icon in Chrome toolbar OR"
echo "   Right-click the extension → 'Inspect popup/side panel'"
echo ""
echo "7. In DevTools:"
echo "   - Elements tab: Inspect body and #root elements"
echo "   - Computed styles: Check font-family for 'GT America'"
echo "   - Styles tab: Check CSS variables (--font-sans, --background)"
echo "   - Console: Check for any errors"
echo "   - Network tab: Verify fonts are loading from /fonts/gt-america/"
echo ""
echo "8. To verify fonts:"
echo "   - In Elements panel, select <body>"
echo "   - In Computed styles, check 'font-family'"
echo "   - Should show: 'GT America', ..."
echo ""
echo "9. To verify colors:"
echo "   - Check Computed styles → 'background-color'"
echo "   - Should be: rgb(255, 255, 255) for light mode"
echo "   - Check :root in Styles panel for CSS variables"
echo ""
echo "✅ Screenshot saved: test-kitchen/screenshots/sidepanel-manual.png"
echo ""
echo "Press Enter when done inspecting..."
read

