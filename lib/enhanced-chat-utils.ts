/*
* Enhanced Chat Utilities and Styling Patterns
* Provides utilities for implementing advanced chat features
* including streaming, reasoning, sources, and tool views
*/

import type { ToolUIPart } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Enhanced message types matching the reference implementation
export interface EnhancedMessageType {
  key: string;
  from: "user" | "assistant";
  sources?: Array<{
    href: string;
    title: string;
  }>;
  versions: Array<{
    id: string;
    content: string;
  }>;
  reasoning?: {
    content: string;
    duration: number;
  };
  tools?: Array<{
    name: string;
    description: string;
    status: ToolUIPart["state"];
    parameters: Record<string, unknown>;
    result: string | undefined;
    error: string | undefined;
  }>;
  avatar: string;
  name: string;
  isReasoningComplete?: boolean;
  isContentComplete?: boolean;
  isReasoningStreaming?: boolean;
}

// Enhanced tool execution types
export interface ToolExecutionState {
  isExecuting: boolean;
  isStreaming: boolean;
  progress: number;
  result?: string;
  error?: string;
}

// Chat styling patterns matching the reference
export const chatStyles = {
  // Container styles
  container: "relative flex h-screen w-full flex-col overflow-hidden bg-secondary",
  
  // Message styles
  userMessage: "group-[.is-user]:rounded-xl group-[.is-user]:rounded-br-sm group-[.is-user]:border group-[.is-user]:bg-background group-[.is-user]:text-foreground",
  assistantMessage: "group-[.is-assistant]:bg-transparent group-[.is-assistant]:p-0 group-[.is-assistant]:text-foreground",
  
  // Prompt input styles
  promptInput: "divide-y-0 rounded-xl",
  promptTextarea: "px-5 md:text-base",
  promptFooter: "p-2.5",
  
  // Button styles
  toolButton: "!rounded-full border text-foreground",
  searchButton: "!rounded-l-full text-foreground",
  voiceButton: "rounded-full bg-foreground font-medium text-background",
  thinkButton: "!rounded-full text-foreground",
  
  // Dropdown styles
  dropdownItem: "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
  dropdownIcon: "mr-2 size-4",
  
  // Branch styles
  branchSelector: "px-0",
  
  // Sources styles
  sourcesTrigger: "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80",
  sourcesContent: "mt-2 rounded-lg border bg-card p-3 shadow-sm",
  
  // Reasoning styles
  reasoningContent: "mt-4 text-sm data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-hidden data-[state=closed]:animate-out data-[state=open]:animate-in",
  
  // Streaming animations
  shimmer: "animate-pulse bg-gradient-to-r from-muted via-muted to-muted bg-[length:200%_100%]",
} as const;

// Streaming utilities
export class StreamingUtils {
  static streamText = async (
    text: string,
    onUpdate: (partial: string) => void,
    onComplete?: () => void,
    delay = 30
  ) => {
    const words = text.split(" ");
    let currentContent = "";

    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? " " : "") + words[i];
      onUpdate(currentContent);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * delay + delay / 2)
      );
    }

    onComplete?.();
  };

  static streamReasoning = async (
    reasoning: string,
    onUpdate: (partial: string) => void,
    onComplete?: () => void
  ) => {
    await StreamingUtils.streamText(reasoning, onUpdate, onComplete, 20);
  };

  static streamContent = async (
    content: string,
    onUpdate: (partial: string) => void,
    onComplete?: () => void
  ) => {
    await StreamingUtils.streamText(content, onUpdate, onComplete, 40);
  };
}

// Enhanced message creation utilities
export class MessageBuilder {
  static createUserMessage = (
    content: string,
    name = "User"
  ): EnhancedMessageType => ({
    key: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: "user",
    versions: [
      {
        id: `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
      },
    ],
    avatar: "",
    name,
  });

  static createAssistantMessage = (
    content: string,
    options: Partial<EnhancedMessageType> = {}
  ): EnhancedMessageType => ({
    key: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: "assistant",
    versions: [
      {
        id: `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
      },
    ],
    name: options.name || "Assistant",
    avatar: options.avatar || "",
    sources: options.sources,
    tools: options.tools,
    reasoning: options.reasoning,
    isReasoningComplete: false,
    isContentComplete: false,
    isReasoningStreaming: !!options.reasoning,
  });

  static createReasoning = (
    content: string,
    duration: number
  ): EnhancedMessageType["reasoning"] => ({
    content,
    duration,
  });

  static createSources = (
    sources: Array<{ href: string; title: string }>
  ): EnhancedMessageType["sources"] => sources;

  static createTools = (
    tools: Array<{
      name: string;
      description: string;
      status: ToolUIPart["state"];
      parameters: Record<string, unknown>;
      result?: string;
      error?: string;
    }>
  ): EnhancedMessageType["tools"] => tools;
}

// File action handlers
export class FileActionHandler {
  static uploadFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        // Handle file upload
        console.log("Files selected:", files);
      }
    };
    input.click();
  };

  static uploadPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        // Handle photo upload
        console.log("Photos selected:", files);
      }
    };
    input.click();
  };

  static takeScreenshot = async () => {
    try {
      // Capture screen using Screen Capture API
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      // Handle screenshot logic
      console.log("Screen capture started");
    } catch (error) {
      console.error("Screen capture failed:", error);
    }
  };

  static takePhoto = async () => {
    try {
      // Access camera and take photo
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      // Handle photo capture logic
      console.log("Camera access started");
    } catch (error) {
      console.error("Camera access failed:", error);
    }
  };
}

// Utility for generating mock data for development
export class MockDataGenerator {
  static generateRandomResponse = (): string => {
    const responses = [
      "That's a great question! Let me help you understand this concept better.",
      "I'd be happy to explain this topic in detail. Here's what I recommend...",
      "This is an interesting topic that comes up frequently. The solution involves...",
      "Great choice of topic! This is something that many developers encounter.",
      "That's definitely worth exploring. From what I can see, the best approach is...",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  static generateRandomReasoning = (): EnhancedMessageType["reasoning"] => ({
    content: "Let me think about this question carefully. I need to provide a comprehensive and helpful response.",
    duration: Math.floor(Math.random() * 5) + 2,
  });

  static generateSources = (): EnhancedMessageType["sources"] => [
    {
      href: "https://example.com/docs",
      title: "Documentation",
    },
    {
      href: "https://example.com/api",
      title: "API Reference",
    },
  ];
}

// Performance optimization utilities
export class PerformanceUtils {
  static debounce = <T extends (...args: any[]) => void>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  static throttle = <T extends (...args: any[]) => void>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  };

  static memoize = <T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T => {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>) => {
      const key = keyGenerator
        ? keyGenerator(...args)
        : JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  };
}
