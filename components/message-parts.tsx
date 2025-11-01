// Message Parts Component - Adapted from Sparka
// Handles rendering of different message part types (text, reasoning, tools, artifacts)
// Production-hardened with error boundaries, memoization, and edge case handling

"use client";

import { memo, useMemo } from "react";
import type { Message } from "../types";
import { MessageReasoning } from "./message-reasoning";
import { TextMessagePart } from "./text-message-part";
import { ToolExecutionDisplay, type ToolExecution } from "./ToolExecutionDisplay";
import { MinorErrorBoundary } from "./ErrorBoundary";

type MessagePartsProps = {
  message: Message;
  isLoading?: boolean;
  isReadonly?: boolean;
};

/**
 * Group contiguous reasoning parts together
 * Groups other parts individually
 */
function groupMessageParts(message: Message) {
  const groups: Array<
    | { kind: "reasoning"; startIndex: number; endIndex: number }
    | { kind: "text" | "tool"; index: number }
  > = [];

  const parts = message.parts || [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.type === "reasoning") {
      const start = i;
      while (i < parts.length && parts[i].type === "reasoning") {
        i++;
      }
      const end = i - 1;
      groups.push({ kind: "reasoning", startIndex: start, endIndex: end });
      i = end;
    } else if (part.type === "text") {
      groups.push({ kind: "text", index: i });
    } else if (part.type === "tool") {
      groups.push({ kind: "tool", index: i });
    }
  }

  return groups;
}

/**
 * Render reasoning parts grouped together
 */
function PureMessageReasoningParts({
  message,
  startIdx,
  endIdx,
  isLoading,
}: {
  message: Message;
  startIdx: number;
  endIdx: number;
  isLoading: boolean;
}) {
  const parts = message.parts || [];
  const reasoningParts = parts.slice(startIdx, endIdx + 1).filter(p => p.type === "reasoning");
  const reasoningTexts = reasoningParts.map(p => p.content || "").filter(Boolean);

  if (reasoningTexts.length === 0) {
    return null;
  }

  return (
    <MessageReasoning
      isLoading={isLoading}
      reasoning={reasoningTexts}
    />
  );
}

const MessageReasoningParts = memo(PureMessageReasoningParts);

/**
 * Main MessageParts component
 * Renders all parts of a message in the correct order
 */
export function PureMessageParts({
  message,
  isLoading = false,
}: MessagePartsProps) {
  // Validate message
  if (!message || !message.id) {
    return null;
  }

  const groups = useMemo(() => groupMessageParts(message), [message]);

  return (
    <MinorErrorBoundary componentName="MessageParts">
      <>
        {groups.map((group, groupIdx) => {
          try {
            if (group.kind === "reasoning") {
              const key = `message-${message.id}-reasoning-${groupIdx}`;
              const isLast = group.endIndex === (message.parts?.length || 0) - 1;
              return (
                <MessageReasoningParts
                  endIdx={group.endIndex}
                  isLoading={isLoading && isLast}
                  key={key}
                  message={message}
                  startIdx={group.startIndex}
                />
              );
            }

            if (group.kind === "text") {
              const key = `message-${message.id}-text-${group.index}`;
              const part = message.parts?.[group.index];
              if (!part || part.type !== "text") return null;
              
              return (
                <TextMessagePart
                  key={key}
                  content={part.content || ""}
                  isStreaming={isLoading && group.index === (message.parts?.length || 0) - 1}
                />
              );
            }

            if (group.kind === "tool") {
              const key = `message-${message.id}-tool-${group.index}`;
              const part = message.parts?.[group.index];
              if (!part || part.type !== "tool") return null;

              // Convert to ToolExecution format with validation
              const toolExecution: ToolExecution = {
                toolCallId: part.toolCallId || `tool-${group.index}`,
                toolName: part.toolName || "unknown",
                state: part.state || "input-available",
                input: part.input,
                output: part.output,
                errorText: part.errorText,
                timestamp: part.timestamp,
              };

              return (
                <ToolExecutionDisplay
                  key={key}
                  toolExecutions={[toolExecution]}
                />
              );
            }

            return null;
          } catch (error) {
            console.error(`Error rendering message part group ${groupIdx}:`, error);
            return null;
          }
        })}
      </>
    </MinorErrorBoundary>
  );
}

export const MessageParts = memo(PureMessageParts);

