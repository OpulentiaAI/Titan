// Script to set a web search API key in browser extension storage
// Run this in the browser console while the extension is loaded

const youApiKey = 'ydc-sk-73e008775485cecf-7amBugk9VyOK17smt4LzLwcrVQ5K6UBK-14332916<__>1SO0a7ETU8N2v5f4EbzspvJg';

chrome.storage.local.get(['atlasSettings'], (result) => {
  const currentSettings = result.atlasSettings || {};
  const updatedSettings = {
    ...currentSettings,
    youApiKey: youApiKey
  };

  chrome.storage.local.set({ atlasSettings: updatedSettings }, () => {
    console.log('✅ Web search API key set successfully!');
    console.log('Key:', youApiKey);
    console.log('Settings updated:', updatedSettings);
  });
});
