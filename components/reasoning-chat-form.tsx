"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  AlertCircle,
  CopyIcon,
  GlobeIcon,
  MicIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Action, Actions } from "@/components/ai-elements/actions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";

export function ReasoningChatForm() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { messages, sendMessage, status, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/registry/blocks/ai-elements-reasoning-chat/app/api/chat",
      credentials: "include",
      headers: { "Custom-Header": "value" },
    }),
    onError: (error) => {
      console.error("Chat error:", error);
      if (error.message.includes("Rate limit exceeded")) {
        setError("Rate limit exceeded. Please try again later.");
      } else if (error.message.includes("Invalid messages format")) {
        setError("Invalid request format. Please try again.");
      } else {
        setError("An error occurred. Please try again later.");
      }
    },
    onFinish: () => {
      setError(null); // Clear error on successful completion
    },
  });

  const handleSubmit = (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (message.text?.trim()) {
      setError(null); // Clear previous errors
      sendMessage({ text: message.text });
      setInput("");
    }
  };

  const handleRetry = () => {
    setError(null);
    regenerate();
  };

  return (
    <div className="relative mx-auto size-full h-screen max-w-4xl p-6">
      <div className="flex h-full flex-col">
        <h2 className="font-bold text-2xl">Reasoning Chat</h2>
        <p className="text-muted-foreground text-sm">
          The{" "}
          <span className="rounded-sm border-[1px] border-border bg-muted px-1 py-0.5 font-light font-mono text-black tracking-tight">
            Reasoning
          </span>{" "}
          component displays AI reasoning content, automatically opening during
          streaming and closing when finished.
        </p>
        {/* Error Display */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
            <button
              className="ml-auto text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message, messageIndex) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case "text": {
                        const isLastMessage =
                          messageIndex === messages.length - 1;

                        return (
                          <div key={`${message.id}-${i}`}>
                            <Response key={`${message.id}-${i}`}>
                              {part.text}
                            </Response>
                            {message.role === "assistant" && isLastMessage && (
                              <Actions className="mt-2">
                                <Action label="Retry" onClick={handleRetry}>
                                  <RefreshCcwIcon className="size-3" />
                                </Action>
                                <Action
                                  label="Copy"
                                  onClick={() =>
                                    navigator.clipboard.writeText(part.text)
                                  }
                                >
                                  <CopyIcon className="size-3" />
                                </Action>
                              </Actions>
                            )}
                          </div>
                        );
                      }
                      case "reasoning":
                        // Only show reasoning for assistant messages when reasoning is enabled
                        return (
                          message.role === "assistant" && (
                            <Reasoning
                              className="w-full"
                              isStreaming={status === "streaming"}
                              key={`${message.id}-${i}`}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          )
                        );

                      default:
                        return null;
                    }
                  })}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        {/* Prompt input - ChatGPT-style */}
        <div className="relative mx-auto flex w-full max-w-screen-md items-end rounded-3xl bg-white/5 dark:bg-white/5 shadow-sm transition-shadow hover:shadow-md mt-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) {
                  sendMessage({ text: input });
                  setInput("");
                }
              }
            }}
            placeholder="What would you like me to think about today?"
            disabled={status === "streaming"}
            className="h-12 flex-grow resize-none bg-transparent px-4 py-3 text-sm text-white dark:text-white outline-none border-0 placeholder:text-white/50 dark:placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ maxHeight: '100px', overflowY: 'auto' }}
            aria-label="Prompt input"
          />
          
          <div className="flex items-center justify-end pb-2 pr-2">
            {status !== "streaming" ? (
              <button
                disabled={!input.trim()}
                onClick={() => {
                  if (input.trim()) {
                    sendMessage({ text: input });
                    setInput("");
                  }
                }}
                className="flex size-8 items-center justify-center rounded-full bg-white dark:bg-white transition-opacity disabled:opacity-10 hover:bg-white/90 dark:hover:bg-white/90 shadow-none border-0"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-black dark:text-black [&_path]:stroke-black [&_path]:stroke-[1]">
                  <path d="m5 12 7-7 7 7"></path>
                  <path d="M12 19V5"></path>
                </svg>
              </button>
            ) : (
              <button
                onClick={() => {/* Cancel handler */}}
                className="flex size-8 items-center justify-center rounded-full bg-white dark:bg-white hover:bg-white/90 dark:hover:bg-white/90 shadow-none border-0"
                aria-label="Cancel"
              >
                <div className="size-2.5 bg-black dark:bg-black rounded-full" />
              </button>
            )}
          </div>
        </div>
        
        {/* Helper Text */}
        <p className="p-2 text-center text-xs text-[#cdcdcd] dark:text-[#cdcdcd]">
          Opulent Browser can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
