// Agent Prompt Composer Integration Example
// Shows how to integrate the full-featured composer with browser automation workflow

"use client";

import { AgentPromptComposer, DEFAULT_BROWSER_AUTOMATION_TEMPLATES, DEFAULT_PERSONAS, type Persona, type PromptTemplate } from "./agent-prompt-composer";
import { useState, useCallback } from "react";
import type { Message } from "../../types";

interface AgentComposerIntegrationProps {
  onSubmit: (query: string, options?: { persona?: Persona; files?: File[] }) => void;
  isLoading?: boolean;
  disabled?: boolean;
  showSettings?: boolean;
  onSettingsClick?: () => void;
  modelSelector?: React.ReactNode;
}

export function AgentComposerIntegration({
  onSubmit,
  isLoading = false,
  disabled = false,
  showSettings = true,
  onSettingsClick,
  modelSelector,
}: AgentComposerIntegrationProps) {
  const [promptValue, setPromptValue] = useState("");

  const handleSubmit = useCallback((value: string, options?: { persona?: Persona; template?: PromptTemplate; files?: File[] }) => {
    // Construct enhanced message with persona context
    let enhancedQuery = value;

    // If persona selected, wrap query with persona context
    if (options?.persona) {
      enhancedQuery = `<PERSONA>${options.persona.name}</PERSONA>\n<SYSTEM_CONTEXT>${options.persona.systemPrompt}</SYSTEM_CONTEXT>\n\n<USER_QUERY>${value}</USER_QUERY>`;
    }

    // If files attached, note them in query
    if (options?.files && options.files.length > 0) {
      const fileList = options.files.map(f => f.name).join(', ');
      enhancedQuery += `\n\n<ATTACHED_FILES>${fileList}</ATTACHED_FILES>`;
    }

    onSubmit(enhancedQuery, options);
    setPromptValue(""); // Clear after submit
  }, [onSubmit]);

  return (
    <AgentPromptComposer
      value={promptValue}
      onChange={setPromptValue}
      onSubmit={handleSubmit}
      placeholder="Describe what you want to automate or research..."
      isLoading={isLoading}
      disabled={disabled}
      templates={DEFAULT_BROWSER_AUTOMATION_TEMPLATES}
      personas={DEFAULT_PERSONAS}
      showVoiceInput={true}
      showFileAttachment={true}
      showSettings={showSettings}
      onSettingsClick={onSettingsClick}
      maxHeight={100}
    />
  );
}

// Usage example for sidepanel integration:
export function usageExampleForSidepanel() {
  return `
  // In sidepanel.tsx, replace simple input with:
  
  import { AgentComposerIntegration } from './components/agents-ui/agent-composer-integration';
  
  <AgentComposerIntegration
    onSubmit={(query, options) => {
      // Handle submission with persona context
      const message: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: query,
        metadata: {
          persona: options?.persona?.name,
          personaPrompt: options?.persona?.systemPrompt,
          attachments: options?.files?.map(f => f.name),
        },
      };
      
      // Add to messages and trigger workflow
      addMessage(message);
    }}
    isLoading={isProcessing}
    disabled={!browserToolsEnabled}
    showSettings={true}
    onSettingsClick={() => setShowSettings(true)}
  />
  `;
}

// Example: Custom templates for specific use cases
export const CUSTOM_TEMPLATES_EXAMPLE: PromptTemplate[] = [
  {
    id: "github-trends",
    name: "GitHub Trending Analysis",
    prompt: `Go to https://github.com/trending and:
1. Extract top 5 trending repositories
2. For each repository, get: name, description, stars, language
3. Summarize common themes across trending projects
4. Provide insights on current development trends`,
    description: "Analyze GitHub trending repositories",
    category: "research",
  },
  {
    id: "product-hunt",
    name: "ProductHunt Daily Digest",
    prompt: `Navigate to ProductHunt and:
1. Find today's top 5 products
2. Extract: name, tagline, upvotes, category
3. Click into each product to read full description
4. Summarize the most innovative features across all products`,
    description: "Daily ProductHunt analysis",
    category: "research",
  },
  {
    id: "competitor-analysis",
    name: "Competitor Website Analysis",
    prompt: `Analyze competitor website [URL]:
1. Navigate to homepage
2. Extract main value propositions
3. Identify key features listed
4. Check pricing page (if exists)
5. Review customer testimonials
6. Compile competitive intelligence report`,
    description: "Comprehensive competitor analysis",
    category: "research",
  },
];

// Example: Custom personas for specialized workflows
export const CUSTOM_PERSONAS_EXAMPLE: Persona[] = [
  {
    id: "seo-analyst",
    name: "SEO Analyzer",
    systemPrompt: `You are an SEO analysis specialist. When analyzing web pages, focus on:
- Page titles and meta descriptions
- Header structure (H1, H2, H3)
- Link structure and internal linking
- Content quality and keyword usage
- Page load performance indicators
- Mobile responsiveness signals

Provide actionable SEO recommendations based on current best practices.`,
    description: "For SEO and content analysis",
    capabilities: ["SEO analysis", "Content optimization", "Performance insights"],
  },
  {
    id: "qa-tester",
    name: "QA Automation",
    systemPrompt: `You are a QA automation specialist. When testing web applications:
- Verify all interactive elements work correctly
- Test edge cases and error states
- Check form validation
- Verify navigation flows
- Test accessibility features
- Document any bugs or issues found

Provide detailed test reports with steps to reproduce any issues.`,
    description: "For quality assurance testing",
    capabilities: ["Functional testing", "Bug detection", "Detailed reporting"],
  },
  {
    id: "data-scraper",
    name: "Data Extraction Specialist",
    systemPrompt: `You are a data extraction specialist. When scraping web pages:
- Identify and extract structured data efficiently
- Handle pagination and infinite scroll
- Extract complete datasets (names, prices, links, etc.)
- Format output as structured JSON or tables
- Handle anti-scraping measures gracefully
- Verify data completeness before finishing

Return data in clean, structured formats ready for analysis.`,
    description: "For web scraping and data collection",
    capabilities: ["Data extraction", "Structured output", "Pagination handling"],
  },
];

