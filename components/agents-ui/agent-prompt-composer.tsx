// Agent Prompt Composer - Full Featured
// Complete prompt input with templates, personas, voice, attachments, and settings
// Production-hardened with error boundaries and accessibility

"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  BookTemplate,
  FileText,
  Mic,
  Paperclip,
  Send,
  Settings,
  Sparkles,
  X,
  ArrowUp,
} from "lucide-react";
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { MinorErrorBoundary } from "../ErrorBoundary";
import { logEvent } from "../../lib/braintrust";

export type PromptTemplate = {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  category?: string;
};

export type Persona = {
  id: string;
  name: string;
  avatar?: string;
  systemPrompt: string;
  description?: string;
  capabilities?: string[];
};

export interface AgentPromptComposerProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string, options?: { persona?: Persona; template?: PromptTemplate; files?: File[] }) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  templates?: PromptTemplate[];
  personas?: Persona[];
  showVoiceInput?: boolean;
  showFileAttachment?: boolean;
  showSettings?: boolean;
  maxHeight?: number;
  className?: string;
  onSettingsClick?: () => void;
}

const AgentPromptComposerComponent = ({
  value = "",
  onChange,
  onSubmit,
  placeholder = "Ask anything...",
  disabled = false,
  isLoading = false,
  templates = [],
  personas = [],
  showVoiceInput = true,
  showFileAttachment = true,
  showSettings = true,
  maxHeight = 100,
  className,
  onSettingsClick,
}: AgentPromptComposerProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);

  // Component mount logging
  useEffect(() => {
    if (!mountedRef.current) {
      logEvent('prompt_composer_mounted', {
        hasTemplates: templates.length > 0,
        templateCount: templates.length,
        featuresEnabled: {
          voice: showVoiceInput,
          files: showFileAttachment,
          settings: showSettings,
        },
      });

      console.log('🎨 [PromptComposer] Component mounted', {
        templates: templates.length,
        features: { voice: showVoiceInput, files: showFileAttachment, settings: showSettings },
      });

      mountedRef.current = true;
    }

    return () => {
      // Log unmount
      if (mountedRef.current) {
        logEvent('prompt_composer_unmounted', {
          wasLoading: isLoading,
          hadValue: !!value,
          hadFiles: attachedFiles.length > 0,
        });
        console.log('🎨 [PromptComposer] Component unmounted');
      }
    };
  }, []); // Only run on mount/unmount

  // Auto-resize textarea - cap at maxHeight
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px'; // Start at h-12 (48px)
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [value, maxHeight]);

  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled && !isLoading) {
      // Log submission event to Braintrust
      logEvent('prompt_composer_submit', {
        promptLength: value.length,
        hasFiles: attachedFiles.length > 0,
        fileCount: attachedFiles.length,
        fileNames: attachedFiles.map(f => f.name),
      });

      console.log('📝 [PromptComposer] Submitting prompt', {
        length: value.length,
        files: attachedFiles.length,
      });

      onSubmit?.(value, {
        files: attachedFiles.length > 0 ? attachedFiles : undefined,
      });
      setAttachedFiles([]); // Clear files after submit
    }
  }, [value, disabled, isLoading, onSubmit, attachedFiles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const applyTemplate = useCallback((template: PromptTemplate) => {
    // Log template application to Braintrust
    logEvent('prompt_composer_template_applied', {
      templateId: template.id,
      templateName: template.name,
      templateCategory: template.category,
      promptLength: template.prompt.length,
    });

    console.log('📋 [PromptComposer] Template applied', {
      name: template.name,
      category: template.category,
      length: template.prompt.length,
    });

    onChange?.(template.prompt);
    // Focus textarea after applying template
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [onChange]);

  const toggleRecording = useCallback(() => {
    const newState = !isRecording;
    setIsRecording(newState);

    // Log voice recording toggle to Braintrust
    logEvent(newState ? 'prompt_composer_voice_started' : 'prompt_composer_voice_stopped', {
      previousState: isRecording,
      newState,
    });

    console.log(`🎤 [PromptComposer] Voice recording ${newState ? 'started' : 'stopped'}`);
    
    // Voice recording logic would be implemented here
    // For production: integrate with Web Speech API or similar
  }, [isRecording]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 0) {
      // Log file attachment to Braintrust
      logEvent('prompt_composer_files_attached', {
        fileCount: files.length,
        fileNames: files.map(f => f.name),
        fileSizes: files.map(f => f.size),
        fileTypes: files.map(f => f.type),
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
      });

      console.log('📎 [PromptComposer] Files attached', {
        count: files.length,
        names: files.map(f => f.name),
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
      });
    }

    setAttachedFiles(prev => [...prev, ...files]);
    // Reset input to allow selecting same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    const file = attachedFiles[index];
    
    // Log file removal to Braintrust
    logEvent('prompt_composer_file_removed', {
      fileName: file?.name,
      fileSize: file?.size,
      remainingFiles: attachedFiles.length - 1,
    });

    console.log('📎 [PromptComposer] File removed', {
      name: file?.name,
      remaining: attachedFiles.length - 1,
    });

    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, [attachedFiles]);

  const enhancePrompt = useCallback(() => {
    if (value.trim()) {
      const originalLength = value.length;
      const enhanced = `Please provide a detailed, comprehensive analysis of the following:\n\n${value}\n\nInclude:\n- Key insights and findings\n- Practical recommendations\n- Potential challenges and solutions\n- Next steps`;
      
      // Log prompt enhancement to Braintrust
      logEvent('prompt_composer_enhanced', {
        originalLength,
        enhancedLength: enhanced.length,
        expansionRatio: (enhanced.length / originalLength).toFixed(2),
      });

      console.log('✨ [PromptComposer] Prompt enhanced', {
        originalLength,
        enhancedLength: enhanced.length,
        expansion: `${((enhanced.length / originalLength - 1) * 100).toFixed(0)}%`,
      });

      onChange?.(enhanced);
    }
  }, [value, onChange]);

  return (
    <MinorErrorBoundary componentName="AgentPromptComposer">
      <div className={cn("space-y-3 w-full", className)}>
        {/* File Attachments Display - Using Tailwind v4 OKLCH colors */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, idx) => (
              <div
                key={`file-${idx}-${file.name}`}
                className="flex items-center gap-2 rounded-md border border-border bg-secondary text-secondary-foreground px-2 py-1 text-xs shadow-sm hover:shadow transition-shadow"
              >
                <Paperclip className="h-3 w-3 text-primary" />
                <span className="max-w-[200px] truncate font-medium">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Input Area - ChatGPT-style with rounded-3xl and white/5 background */}
        <div className="relative mx-auto flex w-full max-w-screen-md items-end rounded-3xl bg-white/5 dark:bg-white/5 shadow-sm transition-shadow hover:shadow-md">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="h-12 flex-grow resize-none bg-transparent text-sm text-white dark:text-white outline-none border-0 placeholder:text-white/50 dark:placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              maxHeight: `${maxHeight}px`,
              overflowY: 'auto',
              paddingLeft: '1.25rem',   // 20px (pl-5)
              paddingRight: '1rem',     // 16px (pr-4)
              paddingTop: '0.75rem',    // 12px (py-3)
              paddingBottom: '0.75rem'  // 12px (py-3)
            }}
            aria-label="Prompt input"
          />

          {/* Action Buttons - ChatGPT-style */}
          <div className="flex items-center justify-end pb-2 pr-2">
            {/* Send/Cancel Button - ChatGPT-style rounded-full */}
            {!isLoading ? (
              <Button
                disabled={!value.trim() || disabled}
                onClick={handleSubmit}
                className="flex size-8 items-center justify-center rounded-full bg-white dark:bg-white transition-opacity disabled:opacity-10 hover:bg-white/90 dark:hover:bg-white/90 shadow-none border-0"
                aria-label="Send message"
              >
                <ArrowUp className="size-5 text-black dark:text-black [&_path]:stroke-black [&_path]:stroke-[1]" />
              </Button>
            ) : (
              <Button
                onClick={() => {/* Cancel handler */}}
                className="flex size-8 items-center justify-center rounded-full bg-white dark:bg-white hover:bg-white/90 dark:hover:bg-white/90 shadow-none border-0"
                aria-label="Cancel"
              >
                <div className="size-2.5 bg-black dark:bg-black rounded-full" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </MinorErrorBoundary>
  );
};

export const AgentPromptComposer = memo(AgentPromptComposerComponent);

// Default templates for browser automation
export const DEFAULT_BROWSER_AUTOMATION_TEMPLATES: PromptTemplate[] = [
  {
    id: "nav-extract",
    name: "Navigate & Extract",
    prompt: "Navigate to [URL] and extract:\n- Page title\n- All visible links\n- Main content text\n- Form fields (if any)",
    description: "Navigate to page and extract comprehensive information",
    category: "extraction",
  },
  {
    id: "form-fill",
    name: "Form Automation",
    prompt: "Navigate to [URL] and fill out the form:\n- Field 1: [value]\n- Field 2: [value]\n- Then submit",
    description: "Automate form filling and submission",
    category: "interaction",
  },
  {
    id: "search-analyze",
    name: "Search & Analyze",
    prompt: "Go to [SEARCH_ENGINE], search for '[QUERY]', and:\n1. Get top 5 results\n2. Open first result\n3. Summarize the content\n4. Extract key information",
    description: "Comprehensive search and analysis workflow",
    category: "research",
  },
  {
    id: "multi-page",
    name: "Multi-Page Navigation",
    prompt: "Starting from [START_URL]:\n1. Navigate and verify page loaded\n2. Find and click [LINK_TEXT] link\n3. On new page, get page context\n4. Summarize findings across both pages",
    description: "Navigate multiple pages and aggregate information",
    category: "navigation",
  },
  {
    id: "data-collection",
    name: "Data Collection",
    prompt: "Go to [URL] and collect:\n- All product names\n- Prices\n- Availability status\n- Product links\n\nReturn as structured list",
    description: "Extract structured data from listings",
    category: "extraction",
  },
  {
    id: "login-workflow",
    name: "Login & Access",
    prompt: "Log in to [SITE]:\n1. Navigate to login page\n2. Enter username: [USERNAME]\n3. Enter password: [PASSWORD]\n4. Submit form\n5. Verify login successful\n6. Navigate to [TARGET_PAGE]",
    description: "Authentication and protected page access",
    category: "interaction",
  },
];

// Default personas for different interaction modes
export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "precise",
    name: "Precise Executor",
    systemPrompt: "You are a precise browser automation agent. Execute tasks with explicit validation at each step. Always verify actions succeeded before proceeding. Use keyboard shortcuts when mouse interactions fail.",
    description: "For critical tasks requiring validation",
    capabilities: ["Step-by-step validation", "Keyboard shortcuts", "Error recovery"],
  },
  {
    id: "researcher",
    name: "Research Assistant",
    systemPrompt: "You are a thorough research assistant. When searching for information, use iterative search refinement, read multiple sources, and synthesize comprehensive answers. Always provide sources and key findings.",
    description: "For deep research and analysis",
    capabilities: ["Multi-source research", "Iterative refinement", "Source citations"],
  },
  {
    id: "efficient",
    name: "Speed Optimizer",
    systemPrompt: "You are an efficiency-focused automation agent. Complete tasks in the minimum number of steps while maintaining reliability. Use parallel operations when possible and skip unnecessary verification for simple actions.",
    description: "For simple, repetitive tasks",
    capabilities: ["Fast execution", "Minimal steps", "Parallel operations"],
  },
  {
    id: "explorer",
    name: "Exploratory Navigator",
    systemPrompt: "You are an exploratory web navigator. When given vague objectives, you proactively search, navigate multiple pages, and gather comprehensive information. You ask clarifying questions and provide thorough summaries.",
    description: "For open-ended discovery tasks",
    capabilities: ["Multi-page exploration", "Proactive searching", "Comprehensive summaries"],
  },
  {
    id: "debugger",
    name: "Debug Specialist",
    systemPrompt: "You are a debugging specialist for browser automation. When actions fail, you provide detailed error analysis, try alternative approaches (keyboard shortcuts, different selectors), and explain what went wrong and how to fix it.",
    description: "For troubleshooting failed automation",
    capabilities: ["Error analysis", "Alternative approaches", "Detailed explanations"],
  },
];

// Template categories for organization
export const TEMPLATE_CATEGORIES = {
  extraction: "Data Extraction",
  interaction: "Form & Interaction",
  research: "Research & Analysis",
  navigation: "Multi-Page Navigation",
};