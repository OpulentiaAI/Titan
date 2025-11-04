// Enhanced Chat Example with Complete Tool View Styling
// Based on patterns from the reference implementation
// Includes: streaming, reasoning, sources, branch navigation, file actions

"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/ui/chain-of-thought";
import {
  AudioWaveformIcon,
  CameraIcon,
  ChevronDownIcon,
  FileIcon,
  ImageIcon,
  LightbulbIcon,
  PaperclipIcon,
  ScreenShareIcon,
  SearchIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Branch,
  BranchMessages,
  BranchNext,
  BranchPage,
  BranchPrevious,
  BranchSelector,
} from "@/components/ai-elements/branch";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";

// Enhanced message types matching the reference implementation
interface EnhancedMessageType {
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

const models = [
  { id: "grok-3", name: "Grok-3" },
  { id: "grok-2-1212", name: "Grok-2-1212" },
];

// Mock messages with enhanced metadata
const mockMessages: EnhancedMessageType[] = [
  {
    avatar: "",
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content: "Can you explain how to use React hooks effectively?",
      },
    ],
    name: "Hayden Bleasel",
  },
  {
    avatar: "",
    key: nanoid(),
    from: "assistant",
    sources: [
      {
        href: "https://react.dev/reference/react",
        title: "React Documentation",
      },
      {
        href: "https://react.dev/reference/react-dom",
        title: "React DOM Documentation",
      },
    ],
    tools: [
      {
        name: "mcp",
        description: "Searching React documentation",
        status: "input-available",
        parameters: {
          query: "React hooks best practices",
          source: "react.dev",
        },
        result: `{
  "query": "React hooks best practices",
  "results": [
    {
      "title": "Rules of Hooks",
      "url": "https://react.dev/warnings/invalid-hook-call-warning",
      "snippet": "Hooks must be called at the top level of your React function components or custom hooks."
    }
  ]
}`,
        error: undefined,
      },
    ],
    versions: [
      {
        id: nanoid(),
        content: `# React Hooks Best Practices
React hooks are a powerful feature that let you use state and other React features without writing classes. Here are some key tips:

## Rules of Hooks
1. **Only call hooks at the top level** of your component or custom hooks
2. **Don't call hooks inside loops, conditions, or nested functions**

## Common Hooks
- **useState**: For local component state
- **useEffect**: For side effects like data fetching
- **useContext**: For consuming context
- **useCallback**: For memoizing functions
- **useMemo**: For memoizing values

Would you like me to explain any specific hook in more detail?`,
      },
    ],
    name: "OpenAI",
  },
  {
    avatar: "",
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content: "Yes, could you explain useCallback and useMemo in more detail?",
      },
      {
        id: nanoid(),
        content: "I'm particularly interested in understanding when to use useCallback vs useMemo.",
      },
      {
        id: nanoid(),
        content: "Thanks! Could you dive deeper into performance optimization with these hooks?",
      },
    ],
    name: "Hayden Bleasel",
  },
  {
    avatar: "",
    key: nanoid(),
    from: "assistant",
    reasoning: {
      content: `The user is asking for detailed explanation of useCallback and useMemo. I should provide clear distinctions between these hooks and their performance implications.`,
      duration: 8,
    },
    versions: [
      {
        id: nanoid(),
        content: `## useCallback vs useMemo
Both hooks help with **performance optimization**, but serve different purposes:

### useCallback
\`useCallback\` memoizes __functions__ to prevent unnecessary re-renders:
\`\`\`jsx
const handleClick = useCallback(() => {
  console.log(count);
}, [count]);
\`\`\`

### useMemo
\`useMemo\` memoizes *values* to avoid expensive recalculations:
\`\`\`jsx
const sortedList = useMemo(() => expensiveSort(items), [items]);
\`\`\`

### When to use which?
- Use **useCallback** for event handlers passed to child components
- Use **useMemo** for expensive calculations

### Performance Note
Don't overuse these hooks - they have overhead. Only use when you have identified performance issues.`,
      },
    ],
    name: "OpenAI",
  },
];

const mockResponses = [
  "That's a great question! Let me help you understand this concept better.",
  "I'd be happy to explain this topic in detail. Here's what I recommend...",
  "This is an interesting topic that comes up frequently. The solution involves...",
  "Great choice of topic! This is something that many developers encounter.",
];

export function EnhancedChainOfThoughtChatExample() {
  const [model, setModel] = useState<string>(models[0].id);
  const [text, setText] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [useMicrophone, setUseMicrophone] = useState<boolean>(false);
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [messages, setMessages] = useState<EnhancedMessageType[]>([]);

  // Streaming utilities
  const streamReasoning = async (
    messageKey: string,
    versionId: string,
    reasoningContent: string
  ) => {
    const words = reasoningContent.split(" ");
    let currentContent = "";
    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? " " : "") + words[i];
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.key === messageKey) {
            return {
              ...msg,
              reasoning: msg.reasoning
                ? { ...msg.reasoning, content: currentContent }
                : undefined,
            };
          }
          return msg;
        })
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 30 + 20)
      );
    }
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.key === messageKey) {
          return {
            ...msg,
            isReasoningComplete: true,
            isReasoningStreaming: false,
          };
        }
        return msg;
      })
    );
  };

  const streamContent = async (
    messageKey: string,
    versionId: string,
    content: string
  ) => {
    const words = content.split(" ");
    let currentContent = "";
    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? " " : "") + words[i];
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.key === messageKey) {
            return {
              ...msg,
              versions: msg.versions.map((v) =>
                v.id === versionId ? { ...v, content: currentContent } : v
              ),
            };
          }
          return msg;
        })
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 50 + 25)
      );
    }
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.key === messageKey) {
          return { ...msg, isContentComplete: true };
        }
        return msg;
      })
    );
  };

  const streamResponse = useCallback(
    async (
      messageKey: string,
      versionId: string,
      content: string,
      reasoning?: { content: string; duration: number }
    ) => {
      setStatus("streaming");
      if (reasoning) {
        await streamReasoning(messageKey, versionId, reasoning.content);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await streamContent(messageKey, versionId, content);
      setStatus("ready");
    },
    []
  );

  const streamMessage = useCallback(
    async (message: EnhancedMessageType) => {
      if (message.from === "user") {
        setMessages((prev) => [...prev, message]);
        return;
      }
      const newMessage = {
        ...message,
        versions: message.versions.map((v) => ({ ...v, content: "" })),
        reasoning: message.reasoning
          ? { ...message.reasoning, content: "" }
          : undefined,
        isReasoningComplete: false,
        isContentComplete: false,
        isReasoningStreaming: !!message.reasoning,
      };
      setMessages((prev) => [...prev, newMessage]);
      const firstVersion = message.versions[0];
      if (!firstVersion) return;
      await streamResponse(
        newMessage.key,
        firstVersion.id,
        firstVersion.content,
        message.reasoning
      );
    },
    [streamResponse]
  );

  const addUserMessage = useCallback(
    (content: string) => {
      const userMessage: EnhancedMessageType = {
        key: `user-${Date.now()}`,
        from: "user",
        versions: [
          {
            id: `user-${Date.now()}`,
            content,
          },
        ],
        avatar: "",
        name: "User",
      };
      setMessages((prev) => [...prev, userMessage]);
      setTimeout(() => {
        const assistantMessageKey = `assistant-${Date.now()}`;
        const assistantMessageId = `version-${Date.now()}`;
        const randomResponse =
          mockResponses[Math.floor(Math.random() * mockResponses.length)];
        const shouldHaveReasoning = Math.random() > 0.5;
        const reasoning = shouldHaveReasoning
          ? {
              content:
                "Let me think about this question carefully. I need to provide a comprehensive response.",
              duration: 3,
            }
          : undefined;
        const assistantMessage: EnhancedMessageType = {
          key: assistantMessageKey,
          from: "assistant",
          versions: [
            {
              id: assistantMessageId,
              content: "",
            },
          ],
          name: "Assistant",
          avatar: "",
          reasoning: reasoning ? { ...reasoning, content: "" } : undefined,
          isReasoningComplete: false,
          isContentComplete: false,
          isReasoningStreaming: !!reasoning,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        streamResponse(
          assistantMessageKey,
          assistantMessageId,
          randomResponse,
          reasoning
        );
      }, 500);
    },
    [streamResponse]
  );

  useEffect(() => {
    setMessages([]);
    const processMessages = async () => {
      for (let i = 0; i < mockMessages.length; i++) {
        await streamMessage(mockMessages[i]);
        if (i < mockMessages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };
    const timer = setTimeout(() => {
      processMessages();
    }, 100);
    return () => {
      clearTimeout(timer);
      setMessages([]);
    };
  }, [streamMessage]);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    if (!hasText) return;
    setStatus("submitted");
    addUserMessage(message.text);
    setText("");
  };

  const handleFileAction = (action: string) => {
    toast.success("File action", {
      description: action,
    });
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-secondary">
      <div className="flex h-full w-full flex-col">
        <div className="flex-1 overflow-hidden">
          <div className="mx-auto h-full max-w-4xl">
            <Conversation className="h-full">
              <ConversationContent className="h-full">
                {messages.map(({ versions, ...message }) => (
                  <Branch defaultBranch={0} key={message.key}>
                    <BranchMessages>
                      {versions.map((version) => (
                        <Message
                          from={message.from}
                          key={`${message.key}-${version.id}`}
                        >
                          <div>
                            {message.sources?.length && (
                              <Sources>
                                <SourcesTrigger
                                  count={message.sources.length}
                                />
                                <SourcesContent>
                                  {message.sources.map((source) => (
                                    <Source
                                      href={source.href}
                                      key={source.href}
                                      title={source.title}
                                    />
                                  ))}
                                </SourcesContent>
                              </Sources>
                            )}
                            {message.reasoning && (
                              <Reasoning
                                duration={message.reasoning.duration}
                                isStreaming={message.isReasoningStreaming}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>
                                  {message.reasoning.content}
                                </ReasoningContent>
                              </Reasoning>
                            )}
                            {(message.from === "user" ||
                              message.isReasoningComplete ||
                              !message.reasoning) && (
                              <MessageContent
                                className={cn(
                                  "group-[.is-user]:rounded-xl group-[.is-user]:rounded-br-sm group-[.is-user]:border group-[.is-user]:bg-background group-[.is-user]:text-foreground",
                                  "group-[.is-assistant]:bg-transparent group-[.is-assistant]:p-0 group-[.is-assistant]:text-foreground"
                                )}
                              >
                                <Response>{version.content}</Response>
                              </MessageContent>
                            )}
                          </div>
                        </Message>
                      ))}
                    </BranchMessages>
                    {versions.length > 1 && (
                      <BranchSelector className="px-0" from={message.from}>
                        <BranchPrevious />
                        <BranchPage />
                        <BranchNext />
                      </BranchSelector>
                    )}
                  </Branch>
                ))}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>
        </div>
        <div className="shrink-0 p-4">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-4">
              <PromptInput
                className="divide-y-0 rounded-xl"
                onSubmit={handleSubmit}
              >
                <PromptInputTextarea
                  className="px-5 md:text-base"
                  onChange={(event) => setText(event.target.value)}
                  placeholder="How can I help?"
                  value={text}
                />
                <PromptInputFooter className="p-2.5">
                  <PromptInputTools>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <PromptInputButton
                          className="!rounded-full border text-foreground"
                          variant="outline"
                        >
                          <PaperclipIcon size={16} />
                          <span className="sr-only">Attach</span>
                        </PromptInputButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => handleFileAction("upload-file")}
                        >
                          <FileIcon className="mr-2" size={16} />
                          Upload file
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleFileAction("upload-photo")}
                        >
                          <ImageIcon className="mr-2" size={16} />
                          Upload photo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleFileAction("take-screenshot")}
                        >
                          <ScreenShareIcon className="mr-2" size={16} />
                          Take screenshot
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleFileAction("take-photo")}
                        >
                          <CameraIcon className="mr-2" size={16} />
                          Take photo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="flex items-center rounded-full border">
                      <PromptInputButton
                        className="!rounded-l-full text-foreground"
                        onClick={() => setUseWebSearch(!useWebSearch)}
                        variant="ghost"
                      >
                        <SearchIcon size={16} />
                        <span>DeepSearch</span>
                      </PromptInputButton>
                      <div className="h-full w-px bg-border" />
                      <PromptInputButton
                        className="rounded-r-full"
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ChevronDownIcon size={16} />
                      </PromptInputButton>
                    </div>
                    <PromptInputButton
                      className="!rounded-full text-foreground"
                      variant="outline"
                    >
                      <LightbulbIcon size={16} />
                      <span>Think</span>
                    </PromptInputButton>
                  </PromptInputTools>
                  <div className="flex items-center gap-2">
                    <PromptInputModelSelect
                      onValueChange={setModel}
                      value={model}
                    >
                      <PromptInputModelSelectTrigger>
                        <PromptInputModelSelectValue />
                      </PromptInputModelSelectTrigger>
                      <PromptInputModelSelectContent>
                        {models.map((model) => (
                          <PromptInputModelSelectItem
                            key={model.id}
                            value={model.id}
                          >
                            {model.name}
                          </PromptInputModelSelectItem>
                        ))}
                      </PromptInputModelSelectContent>
                    </PromptInputModelSelect>
                    <PromptInputButton
                      className="rounded-full bg-foreground font-medium text-background"
                      onClick={() => setUseMicrophone(!useMicrophone)}
                      variant="default"
                    >
                      <AudioWaveformIcon size={16} />
                      <span className="sr-only">Voice</span>
                    </PromptInputButton>
                  </div>
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Browser Automation Reasoning Example
export function BrowserAutomationReasoningExample() {
  return (
    <div className="w-full max-w-3xl">
      <ChainOfThought>
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
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>

        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger leftIcon={<LightbulbIcon className="size-4" />}>
            Analysis: Identifying potential challenges
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              GitHub's trending page uses dynamic React rendering - need to wait for content
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              Project cards may load lazily on scroll - implement scroll strategy
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>

        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger leftIcon={<Zap className="size-4" />}>
            Execution: Performing browser actions
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>
              ✅ Navigation successful (1.2s)
            </ChainOfThoughtItem>
            <ChainOfThoughtItem>
              ✅ All 5 projects extracted with complete metadata
            </ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>
      </ChainOfThought>
    </div>
  );
}
