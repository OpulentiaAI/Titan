// Chain of Thought Example - Production Usage Patterns
// Demonstrates enhanced reasoning display for browser automation tasks

"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "../ui/chain-of-thought";
import { CodeBlock, CodeBlockCopyButton } from "../ai-elements/code-block";
import { Lightbulb, Search, Target, Zap } from "lucide-react";

export function BrowserAutomationReasoningExample() {
  return (
    <div className="w-full max-w-3xl">
      <ChainOfThought>
        {/* Planning Phase */}
        <ChainOfThoughtStep defaultOpen>
          <ChainOfThoughtTrigger leftIcon={<Search className="size-4" />}>
            Planning: Breaking down the browser automation task
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              User wants to navigate to GitHub trending page and extract top 5 projects
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Required steps: Navigate → Wait for load → Scroll to ensure content → Extract data
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Complexity: Medium (multi-step but straightforward DOM structure)
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>

        {/* Analysis Phase */}
        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger leftIcon={<Lightbulb className="size-4" />}>
            Analysis: Identifying potential challenges
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              GitHub's trending page uses dynamic React rendering - need to wait for content
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Project cards may load lazily on scroll - implement scroll strategy
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Rate limiting possible - implement retry logic with exponential backoff
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>

        {/* Execution Phase */}
        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger leftIcon={<Zap className="size-4" />}>
            Execution: Performing browser actions
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              <strong>Action 1:</strong> Navigate to github.com/trending
              <CodeBlock className="mt-2">
                <CodeBlockCopyButton />
                <code>
{`await page.navigate('https://github.com/trending');
await page.waitForSelector('article.Box-row');`}
                </code>
              </CodeBlock>
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              <strong>Action 2:</strong> Extract project data from first 5 cards
              <CodeBlock className="mt-2">
                <CodeBlockCopyButton />
                <code>
{`const projects = await page.$$eval(
  'article.Box-row:nth-of-type(-n+5)', 
  cards => cards.map(card => ({
    name: card.querySelector('h2')?.textContent,
    description: card.querySelector('p')?.textContent,
    stars: card.querySelector('.f6')?.textContent
  }))
);`}
                </code>
              </CodeBlock>
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>

        {/* Results Phase */}
        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger leftIcon={<Target className="size-4" />}>
            Results: Successfully extracted top 5 trending projects
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              ✅ Navigation successful (1.2s)
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              ✅ All 5 projects extracted with complete metadata
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Total execution time: 3.4 seconds
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>
      </ChainOfThought>
    </div>
  );
}

export function ResearchReasoningExample() {
  return (
    <div className="w-full max-w-3xl">
      <ChainOfThought>
        <ChainOfThoughtStep defaultOpen>
          <ChainOfThoughtTrigger leftIcon={<Search className="size-4" />}>
            Research: Finding information about Next.js performance
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              Initial query: "Next.js performance optimization techniques"
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Query expansion generated 5 diverse angles to explore
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Submodular optimization selected 5 most diverse sources
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>

        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger leftIcon={<Lightbulb className="size-4" />}>
            Evaluation: Assessing completeness
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              Found: Image optimization, code splitting, ISR strategies
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Missing: Server component patterns, streaming insights
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Completeness score: 0.65 → Need additional search iteration
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>

        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger leftIcon={<Target className="size-4" />}>
            Synthesis: Comprehensive answer generated
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              Combined insights from 8 sources across 2 search iterations
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Final completeness score: 0.92
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Delivered actionable recommendations with code examples
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>
      </ChainOfThought>
    </div>
  );
}

