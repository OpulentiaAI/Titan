// Test cases for Atlas
export const TEST_CASES = [
  {
    description: "Navigate to Google and search",
    category: "navigation",
    input: "Go to google.com and search for 'test'",
    expectedUrl: "https://www.google.com",
    expectedContent: "Google",
    expectedActions: ["navigate"]
  }
];