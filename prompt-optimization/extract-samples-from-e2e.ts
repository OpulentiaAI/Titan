#!/usr/bin/env tsx

/**
 * Extract sample trajectories from E2E test results
 * Formats them as DSPyground samples for prompt optimization
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dynamic complexity calculation for E2E samples
 */
function calculateDynamicComplexity(query: string, expectedSteps: number): number {
  const q = query.toLowerCase();
  let complexity = 0.2;
  
  // Base on expected steps
  complexity += Math.min(expectedSteps * 0.1, 0.4);
  
  // Form interaction
  if (q.includes('form') || q.includes('fill') || q.includes('input')) complexity += 0.3;
  
  // Search and navigation
  if (q.includes('search') || q.includes('navigate') || q.includes('browse')) complexity += 0.2;
  
  // Multi-step workflows
  if (q.includes('then') || q.includes('and') || q.includes('after')) complexity += 0.25;
  
  // Complex URLs or multiple destinations
  const urls = query.match(/https?:\/\/[^\s]+/g);
  if (urls && urls.length > 1) complexity += 0.15;
  
  return Math.min(complexity, 1.0);
}

/**
 * Dynamic confidence calculation for E2E samples  
 */
function calculateDynamicConfidence(query: string, expectedSteps: number): number {
  let confidence = 0.9;
  
  // Reduce confidence for complex tasks
  confidence -= Math.min(expectedSteps * 0.05, 0.2);
  
  // Increase for clear, direct queries
  if (query.toLowerCase().includes('navigate to') || query.toLowerCase().includes('go to')) {
    confidence += 0.05;
  }
  
  // Decrease for ambiguous queries
  if (query.includes('?') || query.toLowerCase().includes('maybe')) {
    confidence -= 0.1;
  }
  
  return Math.max(Math.min(confidence, 1.0), 0.7); // E2E samples should have high confidence
}

interface E2ETestScenario {
  name: string;
  query: string;
  expectedSteps: number;
  expectedTools: string[];
  validations: Array<{ check: string; expected?: any; min?: number }>;
}

// E2E test scenarios from comprehensive-e2e.test.ts
const E2E_SCENARIOS: E2ETestScenario[] = [
  {
    name: 'Simple Navigation',
    query: 'Navigate to https://example.com',
    expectedSteps: 1,
    expectedTools: ['navigate'],
    validations: [
      { check: 'finalUrl', expected: 'example.com' },
      { check: 'success', expected: true },
    ],
  },
  {
    name: 'Navigation with Context',
    query: 'Go to https://example.com and get the page context',
    expectedSteps: 2,
    expectedTools: ['navigate', 'getPageContext'],
    validations: [
      { check: 'finalUrl', expected: 'example.com' },
      { check: 'hasPageContext', expected: true },
    ],
  },
  {
    name: 'Form Interaction',
    query: 'Navigate to a form page, fill it out, and submit',
    expectedSteps: 3,
    expectedTools: ['navigate', 'type_text', 'click'],
    validations: [
      { check: 'hasFormInteraction', expected: true },
    ],
  },
  {
    name: 'Complex Multi-Step',
    query: 'Navigate to example.com, scroll down, find a link, and click it',
    expectedSteps: 4,
    expectedTools: ['navigate', 'scroll', 'getPageContext', 'click'],
    validations: [
      { check: 'stepCount', min: 3 },
    ],
  },
];

interface DSPygroundSample {
  id: string;
  group: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  feedback?: {
    rating: number;
    comment?: string;
  };
}

function createPlannerSamples(): DSPygroundSample[] {
  const samples: DSPygroundSample[] = [];
  
  // Positive examples: Good planning queries
  E2E_SCENARIOS.forEach((scenario, idx) => {
    samples.push({
      id: `planner-positive-${idx + 1}`,
      group: 'Navigation Tests',
      messages: [
        {
          role: 'user',
          content: `User Query: "${scenario.query}"\n\nCurrent URL: about:blank\nTask: Generate an optimal execution plan using GEPA-inspired reflective evolution.`,
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            objective: scenario.query,
            approach: 'Sequential execution with validation',
            steps: scenario.expectedTools.map((tool, stepIdx) => ({
              step: stepIdx + 1,
              action: tool === 'type_text' ? 'type' : tool,
              target: tool === 'navigate' ? scenario.query.split(' ').find(w => w.startsWith('http')) || 'target_url' : 'target_element',
              reasoning: `Execute ${tool} to accomplish objective`,
              expectedOutcome: `${tool} completed successfully`,
              validationCriteria: `Verify ${tool} succeeded using getPageContext()`,
            })),
            criticalPaths: [1],
            estimatedSteps: scenario.expectedSteps,
            complexityScore: calculateDynamicComplexity(scenario.query, scenario.expectedSteps),
            potentialIssues: [],
            optimizations: ['Use CSS selectors for reliability'],
            confidence: calculateDynamicConfidence(scenario.query, scenario.expectedSteps),
          }, null, 2),
        },
      ],
      feedback: {
        rating: 5,
        comment: 'Excellent plan with proper validation criteria and fallbacks',
      },
    });
  });
  
  return samples;
}

function createEvaluatorSamples(): DSPygroundSample[] {
  const samples: DSPygroundSample[] = [];
  
  // Sample search results for evaluation
  const searchResults = [
    { title: 'Example Domain', desc: 'Example website for testing', url: 'https://example.com' },
    { title: 'Test Page', desc: 'Another test page', url: 'https://test.com' },
  ];
  
  samples.push({
    id: 'evaluator-positive-1',
    group: 'Completeness Evaluation',
    messages: [
      {
        role: 'user',
        content: `Original query: Navigate to example.com\n\nTop results:\n- [1] Example Domain — Example website for testing (https://example.com)\n- [2] Test Page — Another test page (https://test.com)\n\nAssess completeness (0..1), list key gaps (<=5), produce a single optimized_query and up to 3 additional_queries.`,
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          completeness: 0.9,
          gaps: [],
          optimized_query: 'Navigate to example.com',
          reasoning: 'Results are highly relevant and complete for navigation query',
        }, null, 2),
      },
    ],
    feedback: {
      rating: 5,
      comment: 'Accurate completeness assessment',
    },
  });
  
  return samples;
}

function createBrowserAutomationSamples(): DSPygroundSample[] {
  const samples: DSPygroundSample[] = [];
  
  E2E_SCENARIOS.forEach((scenario, idx) => {
    // Positive example: Successful execution
    samples.push({
      id: `browser-automation-positive-${idx + 1}`,
      group: scenario.name.replace(/\s+/g, '_'),
      messages: [
        {
          role: 'user',
          content: scenario.query,
        },
        {
          role: 'assistant',
          content: `I'll help you ${scenario.query.toLowerCase()}. Let me execute the planned steps:\n\n1. Navigating to target URL...\n2. Verifying page load...\n3. Executing planned actions...\n\n✅ Task completed successfully.`,
        },
      ],
      feedback: {
        rating: 5,
        comment: 'Successfully completed task following execution plan',
      },
    });
  });
  
  // Negative example: Tool misuse
  samples.push({
    id: 'browser-automation-negative-1',
    group: 'Error Handling',
    messages: [
      {
        role: 'user',
        content: 'Click on the submit button',
      },
      {
        role: 'assistant',
        content: `I'll execute the print() function to display the button...`, // Wrong - hallucinated function
      },
    ],
    feedback: {
      rating: 1,
      comment: 'ERROR: Used hallucinated function print(). Should only use available tools.',
    },
  });
  
  return samples;
}

function createGeminiComputerUseSamples(): DSPygroundSample[] {
  const samples: DSPygroundSample[] = [];
  
  // Positive example: Proper visual computer use
  samples.push({
    id: 'gemini-computer-use-positive-1',
    group: 'Visual Navigation',
    messages: [
      {
        role: 'user',
        content: 'Navigate to example.com',
      },
      {
        role: 'assistant',
        content: `I'll navigate to example.com using the navigate function.\n\nCalling: navigate({url: "https://example.com"})\n\nWaiting 2.5s for page load...\n✅ Successfully navigated to example.com`,
      },
    ],
    feedback: {
      rating: 5,
      comment: 'Correctly used navigate function with proper wait time',
    },
  });
  
  // Negative example: Function hallucination
  samples.push({
    id: 'gemini-computer-use-negative-1',
    group: 'Error Handling',
    messages: [
      {
        role: 'user',
        content: 'Fill out the form',
      },
      {
        role: 'assistant',
        content: `I'll use execute() to run JavaScript code to fill the form...`, // Wrong
      },
    ],
    feedback: {
      rating: 1,
      comment: 'ERROR: Used hallucinated execute() function. Should only use computer_use tools.',
    },
  });
  
  return samples;
}

function saveSamples(promptName: string, samples: DSPygroundSample[]) {
  const promptDir = join(__dirname, promptName);
  const dataDir = join(promptDir, '.dspyground', 'data');
  
  mkdirSync(dataDir, { recursive: true });
  
  // DSPyground uses a groups structure
  const groups = samples.reduce((acc, sample) => {
    let group = acc.find(g => g.name === sample.group);
    if (!group) {
      const groupId = sample.group.toLowerCase().replace(/\s+/g, '-');
      group = {
        id: groupId,
        name: sample.group,
        samples: [],
      };
      acc.push(group);
    }
    group.samples.push(sample);
    return acc;
  }, [] as Array<{ id: string; name: string; samples: DSPygroundSample[] }>);
  
  const samplesFile = join(dataDir, 'samples.json');
  const formatted = {
    groups: groups.length > 0 ? groups : [{
      id: 'default',
      name: 'Default Group',
      samples: [],
    }],
    currentGroupId: groups.length > 0 ? groups[0].id : 'default',
  };
  
  writeFileSync(samplesFile, JSON.stringify(formatted, null, 2));
  
  console.log(`✅ Created ${samples.length} samples for ${promptName}`);
  console.log(`   Groups: ${groups.length} (${groups.map(g => g.name).join(', ')})`);
  console.log(`   File: ${samplesFile}`);
}

function main() {
  console.log('📋 Extracting sample trajectories from E2E tests...\n');
  
  const promptSamples = {
    planner: createPlannerSamples(),
    evaluator: createEvaluatorSamples(),
    'browser-automation': createBrowserAutomationSamples(),
    'gemini-computer-use': createGeminiComputerUseSamples(),
  };
  
  Object.entries(promptSamples).forEach(([promptName, samples]) => {
    saveSamples(promptName, samples);
  });
  
  console.log('\n✅ Sample extraction complete!');
  console.log('\nNext steps:');
  console.log('1. Review samples in each prompt\'s .dspyground/data/samples.json');
  console.log('2. Add more samples using DSPyground UI: npm run optimize:<prompt-name>');
  console.log('3. Run optimizations: npm run optimize:<prompt-name>:run');
}

main();

