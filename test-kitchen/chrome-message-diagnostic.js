/**
 * Chrome Extension Message Flow Diagnostic
 * Run this in the Chrome DevTools console while using the extension
 * 
 * Usage:
 * 1. Open extension sidepanel
 * 2. Open DevTools (F12)
 * 3. Copy and paste this entire script into console
 * 4. Type a query (e.g., "go to hackernews")
 * 5. Watch the console for detailed message flow tracking
 */

(function() {
  console.log('🔬 Chrome Message Flow Diagnostic Loaded');
  console.log('═'.repeat(80));
  console.log('This will track all message pushes and updates in real-time');
  console.log('═'.repeat(80) + '\n');
  
  const startTime = performance.now();
  const messageLog = [];
  
  // Track message array mutations
  let messageCount = 0;
  let lastMessageContent = '';
  
  // Create a diagnostic overlay
  const createDiagnosticOverlay = () => {
    const overlay = document.createElement('div');
    overlay.id = 'workflow-diagnostic';
    overlay.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      max-width: 400px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #00ffff;">
        🔬 WORKFLOW DIAGNOSTIC
      </div>
      <div id="diagnostic-content"></div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  };
  
  const overlay = createDiagnosticOverlay();
  const diagnosticContent = document.getElementById('diagnostic-content');
  
  const logToDiagnostic = (message, color = '#00ff00') => {
    const elapsed = (performance.now() - startTime).toFixed(2);
    const entry = document.createElement('div');
    entry.style.cssText = `color: ${color}; margin-bottom: 5px; border-left: 2px solid ${color}; padding-left: 5px;`;
    entry.textContent = `[${elapsed}ms] ${message}`;
    diagnosticContent.appendChild(entry);
    diagnosticContent.scrollTop = diagnosticContent.scrollHeight;
    
    console.log(`🔬 [${elapsed}ms] ${message}`);
  };
  
  logToDiagnostic('Diagnostic started', '#00ffff');
  
  // Monitor message list container
  const checkMessages = () => {
    const messages = document.querySelectorAll('.message');
    if (messages.length !== messageCount) {
      const delta = messages.length - messageCount;
      messageCount = messages.length;
      logToDiagnostic(`📨 Message count: ${messageCount} (${delta > 0 ? '+' : ''}${delta})`, '#ffff00');
      
      // Check last message content
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        const content = lastMsg.textContent?.substring(0, 80) || '';
        
        if (content !== lastMessageContent) {
          lastMessageContent = content;
          logToDiagnostic(`💬 Last message: "${content}..."`, '#ffffff');
          
          // Check for summary indicators
          if (content.includes('Generating summary')) {
            logToDiagnostic('⚠️  PLACEHOLDER DETECTED', '#ff9900');
          } else if (content.includes('Summary & Next Steps')) {
            logToDiagnostic('✅ SUMMARY PRESENT', '#00ff00');
          }
        }
      }
    }
  };
  
  // Monitor workflow tasks
  const checkWorkflowTasks = () => {
    const taskElements = document.querySelectorAll('[class*="WorkflowTask"], [class*="workflow-task"]');
    if (taskElements.length > 0) {
      logToDiagnostic(`📋 Workflow tasks visible: ${taskElements.length}`, '#00ccff');
    }
  };
  
  // Monitor every 100ms
  const monitorInterval = setInterval(() => {
    checkMessages();
    checkWorkflowTasks();
  }, 100);
  
  // Monitor for 2 minutes, then stop
  setTimeout(() => {
    clearInterval(monitorInterval);
    logToDiagnostic('Diagnostic stopped (2min timeout)', '#ff0000');
  }, 120000);
  
  // Provide manual controls
  window.workflowDiagnostic = {
    stop: () => {
      clearInterval(monitorInterval);
      logToDiagnostic('Diagnostic manually stopped', '#ff0000');
    },
    checkNow: () => {
      checkMessages();
      checkWorkflowTasks();
    },
    clear: () => {
      diagnosticContent.innerHTML = '';
      logToDiagnostic('Log cleared', '#00ffff');
    },
    hide: () => {
      overlay.style.display = 'none';
    },
    show: () => {
      overlay.style.display = 'block';
    },
    getLog: () => {
      return messageLog;
    }
  };
  
  console.log('\n✅ Diagnostic loaded! Available commands:');
  console.log('  workflowDiagnostic.stop()     - Stop monitoring');
  console.log('  workflowDiagnostic.checkNow() - Check messages immediately');
  console.log('  workflowDiagnostic.clear()    - Clear diagnostic log');
  console.log('  workflowDiagnostic.hide()     - Hide overlay');
  console.log('  workflowDiagnostic.show()     - Show overlay');
  console.log('  workflowDiagnostic.getLog()   - Get full log\n');
  
  logToDiagnostic('Waiting for workflow execution...', '#00ffff');
})();

