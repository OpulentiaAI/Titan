"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import type { ToolPart } from "./tool";
import { Tool } from "./tool";
import { CodeBlock, CodeBlockCopyButton } from "./code-block";
import { Actions, Action } from "./actions";

export interface StructuredOutputProps {
  type: "plan" | "tool-call" | "code" | "json";
  data: any;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Enhanced Plan Display Component
 * Displays execution plans with rich formatting
 */
export interface EnhancedPlanDisplayProps {
  plan: {
    objective: string;
    approach: string;
    steps: Array<{
      step: number;
      action: string;
      target: string;
      reasoning?: string;
      expectedOutcome?: string;
      validationCriteria?: string;
      fallbackAction?: any;
    }>;
    criticalPaths?: number[];
    complexityScore?: number;
    potentialIssues?: string[];
    optimizations?: string[];
  };
  confidence?: number;
  className?: string;
  defaultOpen?: boolean;
}

export const EnhancedPlanDisplay: React.FC<EnhancedPlanDisplayProps> = ({
  plan,
  confidence,
  className,
  defaultOpen = false,
}) => {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.objective}</h3>
        <p className="text-sm text-muted-foreground mt-1">{plan.approach}</p>
        {confidence !== undefined && (
          <div className="mt-2 text-xs text-muted-foreground">
            Confidence: {(confidence * 100).toFixed(0)}%
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Steps */}
        <div>
          <h4 className="text-sm font-medium mb-2">Execution Steps</h4>
          <ol className="list-decimal list-inside space-y-2">
            {plan.steps.map((step, idx) => (
              <li key={idx} className="text-sm">
                <div className="font-medium">
                  {step.action}: {step.target}
                </div>
                {step.reasoning && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {step.reasoning}
                  </div>
                )}
                {step.expectedOutcome && (
                  <div className="text-xs italic text-muted-foreground mt-1">
                    Expected: {step.expectedOutcome}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* Critical Paths */}
        {plan.criticalPaths && plan.criticalPaths.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Critical Paths</h4>
            <div className="text-xs text-muted-foreground">
              Steps: {plan.criticalPaths.join(", ")}
            </div>
          </div>
        )}

        {/* Potential Issues */}
        {plan.potentialIssues && plan.potentialIssues.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-amber-600 dark:text-amber-400">
              Potential Issues
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              {plan.potentialIssues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Optimizations */}
        {plan.optimizations && plan.optimizations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">
              Optimizations
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              {plan.optimizations.map((opt, idx) => (
                <li key={idx}>{opt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Enhanced Tool Call Display Component
 * Displays tool executions with rich formatting
 */
export interface EnhancedToolCallDisplayProps {
  toolParts: ToolPart[];
  className?: string;
}

export const EnhancedToolCallDisplay: React.FC<EnhancedToolCallDisplayProps> = ({
  toolParts,
  className,
}) => {
  if (!toolParts || toolParts.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {toolParts.map((toolPart) => (
        <Tool
          key={toolPart.toolCallId || `${toolPart.type}-${Date.now()}`}
          toolPart={toolPart}
          defaultOpen={toolPart.state === "output-error" || toolPart.state === "output-available"}
        />
      ))}
    </div>
  );
};

/**
 * JSON Output Display Component
 * Displays JSON data with formatting and copy button
 */
export interface JSONDisplayProps {
  data: any;
  className?: string;
  title?: string;
}

export const JSONDisplay: React.FC<JSONDisplayProps> = ({
  data,
  className,
  title,
}) => {
  const jsonString = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {title && (
        <div className="border-b px-4 py-2">
          <h4 className="text-sm font-medium">{title}</h4>
        </div>
      )}
      <CodeBlock code={jsonString} language="json">
        <CodeBlockCopyButton />
      </CodeBlock>
    </div>
  );
};

/**
 * Generic Structured Output Component
 * Routes to appropriate display component based on type
 */
export const StructuredOutput: React.FC<StructuredOutputProps> = ({
  type,
  data,
  className,
  defaultOpen,
}) => {
  switch (type) {
    case "plan":
      return (
        <EnhancedPlanDisplay
          plan={data}
          confidence={data.confidence}
          className={className}
          defaultOpen={defaultOpen}
        />
      );
    case "tool-call":
      return (
        <EnhancedToolCallDisplay
          toolParts={Array.isArray(data) ? data : [data]}
          className={className}
        />
      );
    case "code":
      return (
        <CodeBlock
          code={typeof data === "string" ? data : JSON.stringify(data, null, 2)}
          language={data.language || "text"}
          className={className}
        >
          <CodeBlockCopyButton />
        </CodeBlock>
      );
    case "json":
      return <JSONDisplay data={data} className={className} />;
    default:
      return (
        <div className={cn("rounded-lg border bg-card p-4", className)}>
          <pre className="text-sm overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
  }
};

export { Actions, Action };

