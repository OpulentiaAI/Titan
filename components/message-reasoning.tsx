// Message Reasoning Component - Production Hardened
// Displays AI reasoning/thinking process with enhanced chain-of-thought visualization
// Supports both simple reasoning arrays and structured thought steps

"use client";

import { memo, useMemo } from "react";
import {
  Reasoning,
  ReasoningContentContainer,
  ReasoningTrigger,
} from "./ai-elements/reasoning";
import { Response } from "./ai-elements/response";
import {
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
} from "./ui/chain-of-thought";
import { MinorErrorBoundary } from "./ErrorBoundary";
import { Brain, Lightbulb, Search, Target, Zap } from "lucide-react";
import { TextShimmer } from "./core/text-shimmer";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string[];
  useChainOfThought?: boolean; // Enable enhanced chain-of-thought display
};

function PureMessageReasoning({ 
  isLoading, 
  reasoning,
  useChainOfThought = false 
}: MessageReasoningProps) {
  if (!reasoning || reasoning.length === 0) {
    return null;
  }

  // Parse reasoning into structured steps (always called, used conditionally)
  const structuredSteps = useMemo(() => {
    return reasoning.map((r, idx) => {
      // Detect step type from content
      const lowerR = r.toLowerCase();
      let iconType = 'brain';
      let title = `Thought ${idx + 1}`;
      let stepType = 'thought';

      if (lowerR.includes('search') || lowerR.includes('find')) {
        iconType = 'search';
        title = 'Searching';
        stepType = 'search';
      } else if (lowerR.includes('analyz') || lowerR.includes('consider')) {
        iconType = 'lightbulb';
        title = 'Analyzing';
        stepType = 'analyze';
      } else if (lowerR.includes('solution') || lowerR.includes('implement')) {
        iconType = 'target';
        title = 'Solution';
        stepType = 'solution';
      } else if (lowerR.includes('execut') || lowerR.includes('perform')) {
        iconType = 'zap';
        title = 'Executing';
        stepType = 'execute';
      }

      // Extract first line as summary if it's short
      const lines = r.split('\n');
      const firstLine = lines[0];
      if (firstLine && firstLine.length < 100) {
        title = firstLine;
      }

      return {
        id: `${stepType}-${idx}-${r.substring(0, 10).replace(/\s/g, '')}`,
        iconType,
        title,
        content: lines.length > 1 ? lines.slice(1).join('\n').trim() : r,
        rawContent: r,
      };
    });
  }, [reasoning]);

  // Chain of thought display mode
  if (useChainOfThought && structuredSteps) {
    return (
      <MinorErrorBoundary componentName="MessageReasoningChainOfThought">
        <Reasoning className="mb-2" isStreaming={isLoading}>
          <ReasoningTrigger data-testid="message-reasoning-toggle" />
          <ReasoningContentContainer
            className="mt-0 data-[state=open]:mt-3"
            data-testid="message-reasoning-cot"
          >
            <ChainOfThought>
              {structuredSteps.map((step, idx) => {
                // Render icon based on type
                const Icon = step.iconType === 'search' ? Search
                  : step.iconType === 'lightbulb' ? Lightbulb
                  : step.iconType === 'target' ? Target
                  : step.iconType === 'zap' ? Zap
                  : Brain;

                return (
                  <ChainOfThoughtStep key={step.id} defaultOpen={idx === 0}>
                    <ChainOfThoughtTrigger leftIcon={<Icon className="size-4" />}>
                      {isLoading ? (
                        <TextShimmer duration={1.5} spread={2} className="font-medium">
                          {step.title}
                        </TextShimmer>
                      ) : (
                        step.title
                      )}
                    </ChainOfThoughtTrigger>
                    <ChainOfThoughtContent>
                      <ChainOfThoughtItem>
                        <Response className="grid gap-2 text-sm">
                          {step.content || step.rawContent}
                        </Response>
                      </ChainOfThoughtItem>
                    </ChainOfThoughtContent>
                  </ChainOfThoughtStep>
                );
              })}
            </ChainOfThought>
          </ReasoningContentContainer>
        </Reasoning>
      </MinorErrorBoundary>
    );
  }

  // Default simple display mode
  return (
    <MinorErrorBoundary componentName="MessageReasoning">
      <Reasoning className="mb-2" isStreaming={isLoading}>
        <ReasoningTrigger data-testid="message-reasoning-toggle" />
        <ReasoningContentContainer
          className="mt-0 flex flex-col gap-4 text-muted-foreground data-[state=open]:mt-3"
          data-testid="message-reasoning"
        >
          <MultiReasoningContent reasoning={reasoning} />
        </ReasoningContentContainer>
      </Reasoning>
    </MinorErrorBoundary>
  );
}

const MultiReasoningContent = memo(function MultiReasoningContent({
  reasoning,
}: {
  reasoning: string[];
}) {
  if (!reasoning || reasoning.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-4 list-none" aria-label="Reasoning steps">
      {reasoning.map((r, i) => (
        <li className="border-l pl-4" key={`reasoning-${i}-${r.substring(0, 20)}`}>
          <Response className="grid gap-2">{r}</Response>
        </li>
      ))}
    </ul>
  );
});

export const MessageReasoning = memo(PureMessageReasoning);

// Export enhanced version with chain-of-thought enabled by default
export const EnhancedMessageReasoning = memo((props: Omit<MessageReasoningProps, 'useChainOfThought'>) => (
  <MessageReasoning {...props} useChainOfThought={true} />
));

EnhancedMessageReasoning.displayName = "EnhancedMessageReasoning";


