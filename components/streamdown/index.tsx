"use client";

import { createContext, memo, useId, useMemo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { BundledTheme } from "shiki";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

// Simplified version without harden-react-markdown dependency for browser extension compatibility
// Use sanitizeHTML manually if needed for user-generated content

export type StreamdownProps = Options & {
  parseIncompleteMarkdown?: boolean;
  className?: string;
  shikiTheme?: [BundledTheme, BundledTheme];
  defaultOrigin?: string;
  allowedLinkPrefixes?: string[];
  allowedImagePrefixes?: string[];
};

export const ShikiThemeContext = createContext<[BundledTheme, BundledTheme]>([
  "github-light" as BundledTheme,
  "github-dark" as BundledTheme,
]);

// Simple incomplete markdown parser
function parseIncompleteMarkdown(markdown: string): string {
  // Remove incomplete code blocks
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockTicks = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tickMatch = line.match(/^`{3,}/);
    
    if (tickMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockTicks = tickMatch[0].length;
        result.push(line);
      } else if (tickMatch[0].length === codeBlockTicks) {
        inCodeBlock = false;
        result.push(line);
      } else {
        result.push(line);
      }
    } else if (!inCodeBlock || i < lines.length - 1) {
      result.push(line);
    }
  }

  return result.join('\n');
}

// Simple block parser - split on double newlines
function parseMarkdownIntoBlocks(markdown: string): string[] {
  if (!markdown) return [];
  
  // Split on double newlines but keep code blocks together
  const blocks: string[] = [];
  let currentBlock = '';
  let inCodeBlock = false;
  
  const lines = markdown.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for code block delimiters
    if (line.match(/^`{3,}/)) {
      inCodeBlock = !inCodeBlock;
    }
    
    // Add line to current block
    currentBlock += (currentBlock ? '\n' : '') + line;
    
    // If we hit an empty line outside code block, finalize current block
    if (!inCodeBlock && line.trim() === '' && currentBlock.trim()) {
      blocks.push(currentBlock.trim());
      currentBlock = '';
    }
  }
  
  // Add final block if exists
  if (currentBlock.trim()) {
    blocks.push(currentBlock.trim());
  }
  
  return blocks.length > 0 ? blocks : [markdown];
}

type BlockProps = Options & {
  content: string;
  shouldParseIncompleteMarkdown: boolean;
};

const Block = memo(
  ({ content, shouldParseIncompleteMarkdown, ...props }: BlockProps) => {
    const parsedContent = useMemo(
      () =>
        typeof content === "string" && shouldParseIncompleteMarkdown
          ? parseIncompleteMarkdown(content.trim())
          : content,
      [content, shouldParseIncompleteMarkdown]
    );

    return <ReactMarkdown {...props}>{parsedContent}</ReactMarkdown>;
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

Block.displayName = "Block";

export const Streamdown = memo(
  ({
    children,
    parseIncompleteMarkdown: shouldParseIncompleteMarkdown = true,
    components,
    rehypePlugins,
    remarkPlugins,
    className,
    shikiTheme = ["github-light", "github-dark"],
    ...props
  }: StreamdownProps) => {
    const generatedId = useId();
    const blocks = useMemo(
      () =>
        parseMarkdownIntoBlocks(typeof children === "string" ? children : ""),
      [children]
    );

    return (
      <ShikiThemeContext.Provider value={shikiTheme}>
        <div className={cn("space-y-4", className)} {...props}>
          {blocks.map((block, index) => (
            <Block
              components={components}
              content={block}
              key={`${generatedId}-block_${index}`}
              rehypePlugins={[rehypeKatex, ...(rehypePlugins ?? [])]}
              remarkPlugins={[remarkGfm, remarkMath, ...(remarkPlugins ?? [])]}
              shouldParseIncompleteMarkdown={shouldParseIncompleteMarkdown}
            />
          ))}
        </div>
      </ShikiThemeContext.Provider>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.shikiTheme === nextProps.shikiTheme
);
Streamdown.displayName = "Streamdown";

