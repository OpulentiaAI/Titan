"use client"

import * as React from "react"
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/components/ui/plan"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import type { PlanningStepOutput } from "../schemas/workflow-schemas"

export interface PlanningDisplayProps {
  planning?: PlanningStepOutput
  isStreaming?: boolean
  defaultOpen?: boolean
  onExecute?: () => void
  className?: string
}

export const PlanningDisplay: React.FC<PlanningDisplayProps> = ({
  planning,
  isStreaming = false,
  defaultOpen = false,
  onExecute,
  className,
}) => {
  if (!planning) {
    return null
  }

  const { plan, confidence, planningBlock } = planning

  return (
    <Plan isStreaming={isStreaming} defaultOpen={defaultOpen} className={className}>
      <PlanHeader>
        <div className="flex-1">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <PlanTitle>
              {plan.objective || "Execution Plan"}
            </PlanTitle>
          </div>
          <PlanDescription>
            {plan.approach || `Execute ${plan.steps.length} steps with ${(confidence * 100).toFixed(0)}% confidence`}
          </PlanDescription>
        </div>
        <PlanTrigger />
      </PlanHeader>

      <PlanContent>
        <div className="space-y-4 text-sm">
          {/* Plan Overview */}
          <div>
            <h3 className="mb-2 font-semibold">Plan Overview</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Steps:</span>
                <span className="font-medium">{plan.steps.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Complexity:</span>
                <span className="font-medium">{(plan.complexityScore * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Confidence:</span>
                <span className="font-medium">{(confidence * 100).toFixed(0)}%</span>
              </div>
              {plan.estimatedSteps && (
                <div className="flex items-center justify-between">
                  <span>Estimated Steps:</span>
                  <span className="font-medium">{plan.estimatedSteps}</span>
                </div>
              )}
            </div>
          </div>

          {/* Execution Steps */}
          {plan.steps.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Execution Steps</h3>
              <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
                {plan.steps.map((step, index) => (
                  <li key={index} className="pl-2">
                    <div className="font-medium text-foreground">
                      {step.action}: {step.target}
                    </div>
                    {step.reasoning && (
                      <div className="text-xs mt-1 text-muted-foreground">
                        {step.reasoning}
                      </div>
                    )}
                    {step.expectedOutcome && (
                      <div className="text-xs mt-1 italic text-muted-foreground">
                        Expected: {step.expectedOutcome}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Critical Paths */}
          {plan.criticalPaths && plan.criticalPaths.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Critical Paths</h3>
              <div className="text-muted-foreground">
                Steps: {plan.criticalPaths.join(", ")}
              </div>
            </div>
          )}

          {/* Potential Issues */}
          {plan.potentialIssues && plan.potentialIssues.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-amber-600 dark:text-amber-400">
                Potential Issues
              </h3>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {plan.potentialIssues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Optimizations */}
          {plan.optimizations && plan.optimizations.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-green-600 dark:text-green-400">
                Optimizations
              </h3>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {plan.optimizations.map((opt, index) => (
                  <li key={index}>{opt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Planning Block (formatted instructions) */}
          {planningBlock && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">
                Detailed Instructions
              </h3>
              <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                {planningBlock}
              </pre>
            </div>
          )}
        </div>
      </PlanContent>

      {onExecute && (
        <PlanFooter className="justify-end">
          <PlanAction>
            <Button size="sm" onClick={onExecute}>
              Execute Plan
            </Button>
          </PlanAction>
        </PlanFooter>
      )}
    </Plan>
  )
}

// Helper to extract planning data from message content
export function extractPlanningFromMessage(message: { content?: string; planning?: PlanningStepOutput }): PlanningStepOutput | null {
  // Check if planning data is directly available
  if (message.planning) {
    return message.planning
  }

  // Try to parse from content if it contains planning information
  // This is a fallback for messages that might have planning embedded
  if (message.content?.includes("Planning Complete") || message.content?.includes("Plan Generated")) {
    // For now, return null - the actual planning data should come from the workflow output
    // In a real implementation, you'd parse the markdown or store planning in message metadata
    return null
  }

  return null
}

