// Mock atlasTask function for testing
export async function atlasTask(model, settings, input) {
  console.log('Atlas background service worker loaded');

  // Simulate some processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock successful result
  return {
    success: true,
    steps: 1,
    finalUrl: 'https://www.google.com',
    error: null,
    messages: [
      { role: 'user', content: input },
      { role: 'assistant', content: 'Navigating to Google' }
    ],
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30
    }
  };
}