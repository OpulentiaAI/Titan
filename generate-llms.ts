#!/usr/bin/env tsx

import { writeFile } from 'fs/promises';

// Key AI SDK documentation files to include
const docFiles = [
  'content/docs/03-ai-sdk-core/01-overview.mdx',
  'content/docs/03-ai-sdk-core/05-generating-text.mdx',
  'content/docs/03-ai-sdk-core/10-generating-structured-data.mdx',
  'content/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx',
  'content/docs/03-ai-sdk-core/16-mcp-tools.mdx',
  'content/docs/03-ai-sdk-core/20-prompt-engineering.mdx',
  'content/docs/03-ai-sdk-core/25-settings.mdx',
  'content/docs/03-ai-sdk-core/30-embeddings.mdx',
  'content/docs/03-ai-sdk-core/31-reranking.mdx',
  'content/docs/03-ai-sdk-core/35-image-generation.mdx',
  'content/docs/03-ai-sdk-core/36-transcription.mdx',
  'content/docs/03-ai-sdk-core/37-speech.mdx',
  'content/docs/03-ai-sdk-core/40-middleware.mdx',
  'content/docs/03-ai-sdk-core/45-provider-management.mdx',
  'content/docs/03-ai-sdk-core/50-error-handling.mdx',
  'content/docs/03-ai-sdk-core/55-testing.mdx',
  'content/docs/03-ai-sdk-core/60-telemetry.mdx',
];

async function fetchDocContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return '';
    }
    return await response.text();
  } catch (error) {
    console.warn(`Error fetching ${url}:`, error);
    return '';
  }
}

async function main() {
  try {
    console.log('Fetching AI SDK documentation content...');

    let fullContent = '# AI SDK Documentation\n\n';
    fullContent += 'This file contains the complete AI SDK documentation for LLM consumption.\n\n';
    fullContent += '---\n\n';

    for (const file of docFiles) {
      const url = `https://raw.githubusercontent.com/vercel/ai/main/${file}`;
      console.log(`Fetching ${file}...`);

      const content = await fetchDocContent(url);
      if (content) {
        fullContent += `## ${file}\n\n`;
        fullContent += content;
        fullContent += '\n\n---\n\n';
      }
    }

    console.log(`Total content length: ${fullContent.length} characters`);
    console.log(`Approximate tokens: ${Math.round(fullContent.length / 4)}`);

    await writeFile('llms.txt', fullContent);
    console.log('Successfully created llms.txt');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();