import type { TestCase } from './types.js';

export const TEST_CASES: TestCase[] = [
  {
    input: 'Navigate to https://example.com',
    expectedUrl: 'https://example.com',
    description: 'Simple navigation to a URL',
    category: 'navigation',
  },
  {
    input: 'Go to google.com and search for "test automation"',
    expectedUrl: 'https://www.google.com',
    expectedContent: 'test automation',
    expectedActions: ['navigate', 'type', 'press'],
    description: 'Navigation + search interaction',
    category: 'search',
  },
  {
    input: 'Open https://github.com and scroll down to see more repositories',
    expectedUrl: 'https://github.com',
    expectedActions: ['navigate', 'scroll'],
    description: 'Navigation + scrolling',
    category: 'navigation',
  },
  {
    input: 'Navigate to https://wikipedia.org and search for "artificial intelligence"',
    expectedUrl: 'https://www.wikipedia.org',
    expectedContent: 'artificial intelligence',
    expectedActions: ['navigate', 'type', 'press'],
    description: 'Wikipedia search workflow',
    category: 'search',
  },
  {
    input: 'Go to https://example.com and click on any link',
    expectedUrl: 'https://example.com',
    expectedActions: ['navigate', 'click'],
    description: 'Navigation + link clicking',
    category: 'interaction',
  },
  {
    input: 'Open https://reddit.com, scroll down, and look for posts about technology',
    expectedUrl: 'https://www.reddit.com',
    expectedActions: ['navigate', 'scroll'],
    description: 'Complex navigation with scrolling',
    category: 'complex',
  },
  {
    input: 'Navigate to https://news.ycombinator.com and find the top story',
    expectedUrl: 'https://news.ycombinator.com',
    description: 'Navigation to news site',
    category: 'navigation',
  },
  {
    input: 'Go to https://duckduckgo.com and search for "browser automation"',
    expectedUrl: 'https://duckduckgo.com',
    expectedContent: 'browser automation',
    expectedActions: ['navigate', 'type', 'press'],
    description: 'Search engine interaction',
    category: 'search',
  },
  // Extended dataset to ensure >2 datapoints for eval
  {
    input: 'Navigate to https://stackoverflow.com and search for "puppeteer examples"',
    expectedUrl: 'https://stackoverflow.com',
    expectedContent: 'puppeteer',
    expectedActions: ['navigate', 'type', 'press'],
    description: 'Stack Overflow search',
    category: 'search',
  },
  {
    input: 'Go to https://github.com/trending and scroll down to see trending repositories',
    expectedUrl: 'https://github.com/trending',
    expectedActions: ['navigate', 'scroll'],
    description: 'GitHub trending with scrolling',
    category: 'navigation',
  },
];

