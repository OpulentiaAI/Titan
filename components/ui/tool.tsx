"use client"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  ChevronDown,
  Loader2,
  Settings,
  XCircle,
} from "lucide-react"
import { useState, useMemo, memo } from "react"
import { MinorErrorBoundary } from "../ErrorBoundary"
import { TextShimmer } from "../core/text-shimmer"

export type ToolPart = {
  type: string
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  toolCallId?: string
  errorText?: string
}

export type ToolProps = {
  toolPart: ToolPart
  defaultOpen?: boolean
  className?: string
}

const ToolComponent = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!toolPart) {
    return null;
  }

  const { state, input, output, toolCallId, type } = toolPart

  // Memoize state icon to prevent re-renders
  const StateIcon = useMemo(() => {
    switch (state) {
      case "input-streaming":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" aria-label="Processing" />
      case "input-available":
        return <Settings className="h-4 w-4 text-orange-500" aria-label="Ready" />
      case "output-available":
        return <CheckCircle className="h-4 w-4 text-green-500" aria-label="Completed" />
      case "output-error":
        return <XCircle className="h-4 w-4 text-red-500" aria-label="Error" />
      default:
        return <Settings className="text-muted-foreground h-4 w-4" aria-label="Pending" />
    }
  }, [state]);

  // Memoize state badge
  const StateBadge = useMemo(() => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium"
    switch (state) {
      case "input-streaming":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            )}
            role="status"
          >
            <TextShimmer duration={1.5} spread={1.5} as="span">Processing</TextShimmer>
          </span>
        )
      case "input-available":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
            )}
            role="status"
          >
            Ready
          </span>
        )
      case "output-available":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}
            role="status"
          >
            Completed
          </span>
        )
      case "output-error":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
            role="status"
          >
            Error
          </span>
        )
      default:
        return (
          <span
            className={cn(
              baseClasses,
              "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
            )}
            role="status"
          >
            Pending
          </span>
        )
    }
  }, [state]);

  const formatValue = useMemo(() => {
    return (value: unknown): string => {
      if (value === null) return "null"
      if (value === undefined) return "undefined"
      if (typeof value === "string") return value
      if (typeof value === "object") {
        try {
          return JSON.stringify(value, null, 2)
        } catch {
          return String(value)
        }
      }
      return String(value)
    }
  }, []);

  return (
    <MinorErrorBoundary componentName="Tool">
      <div
        className={cn(
          "border-border/40 bg-accent/5 mt-3 overflow-hidden rounded-lg border backdrop-blur-sm",
          className
        )}
        role="article"
        aria-label={`Tool execution: ${type}`}
      >
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="bg-transparent h-auto w-full justify-between rounded-b-none px-3 py-2 font-normal hover:bg-muted/30"
              aria-expanded={isOpen}
              aria-controls={`tool-content-${toolCallId}`}
            >
              <div className="flex items-center gap-2">
                {StateIcon}
                <TextShimmer
                  duration={state === "input-streaming" ? 1.5 : 2}
                  spread={2}
                  className="font-mono text-sm font-medium"
                >
                  {type || "Unknown tool"}
                </TextShimmer>
                {StateBadge}
              </div>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent
            id={`tool-content-${toolCallId}`}
            className={cn(
              "border-border/30 border-t",
              "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden"
            )}
          >
            <div className="bg-transparent space-y-3 p-3">
              {input && Object.keys(input).length > 0 && (
                <div>
                  <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                    <TextShimmer duration={2} spread={2}>Input</TextShimmer>
                  </h4>
                  <div className="bg-muted/50 rounded border-border/30 border p-2 font-mono text-sm">
                    {Object.entries(input).map(([key, value]) => (
                      <div key={key} className="mb-1 wrap-break-word">
                        <span className="text-muted-foreground">{key}:</span>{" "}
                        <span>{formatValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output && (
                <div>
                  <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                    <TextShimmer duration={2} spread={2}>Output</TextShimmer>
                  </h4>
                  <div className="bg-muted/50 max-h-60 overflow-auto rounded border-border/30 border p-2 font-mono text-sm">
                    <pre className="whitespace-pre-wrap wrap-break-word">
                      {formatValue(output)}
                    </pre>
                  </div>
                </div>
              )}

              {state === "output-error" && toolPart.errorText && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
                    <TextShimmer duration={1.5} spread={2}>Error</TextShimmer>
                  </h4>
                  <div className="bg-red-50/50 dark:bg-red-950/20 rounded border border-red-200/50 dark:border-red-800/30 p-2 text-sm wrap-break-word">
                    {toolPart.errorText}
                  </div>
                </div>
              )}

              {state === "input-streaming" && (
                <div className="text-muted-foreground text-sm flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <TextShimmer duration={1.5} spread={2}>Processing tool call...</TextShimmer>
                </div>
              )}

              {toolCallId && (
                <div className="text-muted-foreground border-t border-border/20 pt-2 text-xs">
                  <span className="font-mono break-all">Call ID: {toolCallId}</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </MinorErrorBoundary>
  )
}

export const Tool = memo(ToolComponent);
export { Tool as default };

