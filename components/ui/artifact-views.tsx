// Comprehensive artifact views for all orchestration outputs
// Every output from the workflow should have a dedicated artifact/tool view component
// Production-hardened with error boundaries, memoization, and edge case handling

"use client";

import * as React from "react";
import { memo, useMemo } from "react";
import { cn } from "../../lib/utils";
import { MinorErrorBoundary } from "../ErrorBoundary";
import type { 
  PageContextStepOutput,
  SummarizationStepOutput,
  BrowserAutomationWorkflowOutput 
} from "../../schemas/workflow-schemas";

// Import and re-export the new SummaryArtifact
import { SummaryArtifact } from "./summary-artifact";
export { SummaryArtifact };
export type { SummaryArtifactProps } from "./summary-artifact";

/**
 * Page Context Artifact View
 * Displays page context information as a structured artifact
 */
export interface PageContextArtifactProps {
  pageContext: PageContextStepOutput;
  className?: string;
}

const PageContextArtifactComponent: React.FC<PageContextArtifactProps> = ({
  pageContext,
  className,
}) => {
  // Safely extract context with fallback
  const ctx = pageContext?.pageContext;
  
  if (!ctx) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 text-sm text-muted-foreground", className)}>
        No page context available
      </div>
    );
  }

  // Memoize link preview to avoid re-rendering
  const linkPreview = useMemo(() => {
    if (!ctx.links || ctx.links.length === 0) return null;
    
    return (
      <div className="mb-4">
        <h4 className="text-xs font-medium mb-2 text-muted-foreground">
          Links ({ctx.links.length})
        </h4>
        <div className="max-h-32 overflow-auto space-y-1">
          {ctx.links.slice(0, 10).map((link, idx) => (
            <div key={`link-${idx}-${link.href}`} className="text-xs">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                aria-label={link.text || link.href}
              >
                {link.text || link.href}
              </a>
            </div>
          ))}
          {ctx.links.length > 10 && (
            <div className="text-xs text-muted-foreground">
              ... and {ctx.links.length - 10} more
            </div>
          )}
        </div>
      </div>
    );
  }, [ctx.links]);

  // Memoize text preview
  const textPreview = useMemo(() => {
    if (!ctx.text) return null;
    const preview = ctx.text.substring(0, 500);
    const hasMore = ctx.text.length > 500;
    
    return (
      <div className="mb-4">
        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Page Text (Preview)</h4>
        <div className="max-h-32 overflow-auto rounded border bg-muted p-2 text-xs whitespace-pre-wrap">
          {preview}
          {hasMore && "..."}
        </div>
      </div>
    );
  }, [ctx.text]);

  return (
    <MinorErrorBoundary componentName="PageContextArtifact">
      <div className={cn("rounded-lg border bg-card p-4", className)}>
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">📄 Page Context</h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">URL:</span>{" "}
              <span className="font-mono break-all">{ctx.url || "Unknown"}</span>
            </div>
            {ctx.title && (
              <div>
                <span className="text-muted-foreground">Title:</span>{" "}
                <span>{ctx.title}</span>
              </div>
            )}
            {ctx.viewport && (
              <div>
                <span className="text-muted-foreground">Viewport:</span>{" "}
                <span>{ctx.viewport.width} × {ctx.viewport.height}</span>
              </div>
            )}
          </div>
        </div>

        {textPreview}
        {linkPreview}

        {pageContext.success !== undefined && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="mr-1">Status:</span>
            <span className={cn(
              "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-medium",
              pageContext.success ? "text-foreground" : "text-destructive"
            )}>
              {pageContext.success ? "✅ Success" : "❌ Failed"}
            </span>
            {typeof pageContext.duration === "number" && pageContext.duration > 0 && (
              <span className="ml-1">({pageContext.duration}ms)</span>
            )}
          </div>
        )}
      </div>
    </MinorErrorBoundary>
  );
};

export const PageContextArtifact = memo(PageContextArtifactComponent);

/**
 * Summarization Artifact View - Enhanced with Artifact pattern
 * Mandatory display since finalization is disabled for speed
 * Now with copy, download, and share actions
 */
export interface SummarizationArtifactProps {
  summarization: SummarizationStepOutput;
  className?: string;
  onRegenerate?: () => void;
}

const SummarizationArtifactComponent: React.FC<SummarizationArtifactProps> = ({
  summarization,
  className,
  onRegenerate,
}) => {
  if (!summarization) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 text-sm text-muted-foreground", className)}>
        No summarization available
      </div>
    );
  }

  // SummaryArtifact is already imported at the top of the file
  return (
    <SummaryArtifact
      summary={summarization.summary || ''}
      duration={summarization.duration}
      stepCount={summarization.stepCount}
      success={summarization.success}
      className={className}
      onRegenerate={onRegenerate}
    />
  );
};

export const SummarizationArtifact = memo(SummarizationArtifactComponent);

/**
 * Error Analysis Artifact View
 * Displays structured error analysis with recap, blame, and improvement
 */
export interface ErrorAnalysisArtifactProps {
  errorAnalysis: {
    recap: string;
    blame: string;
    improvement: string;
  };
  className?: string;
}

const ErrorAnalysisArtifactComponent: React.FC<ErrorAnalysisArtifactProps> = ({
  errorAnalysis,
  className,
}) => {
  if (!errorAnalysis || !errorAnalysis.recap) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 text-sm text-muted-foreground", className)}>
        No error analysis available
      </div>
    );
  }

  return (
    <MinorErrorBoundary componentName="ErrorAnalysisArtifact">
      <div className={cn("rounded-lg border bg-card p-4", className)}>
        <h3 className="text-sm font-semibold mb-3">🔍 Error Analysis</h3>
        
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="text-xs font-medium mb-2 text-muted-foreground">Recap</h4>
            <div className="bg-background rounded border p-2 text-xs whitespace-pre-wrap">
              {errorAnalysis.recap}
            </div>
          </div>

          {errorAnalysis.blame && (
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">Root Cause</h4>
              <div className="bg-background rounded border p-2 text-xs whitespace-pre-wrap">
                {errorAnalysis.blame}
              </div>
            </div>
          )}

          {errorAnalysis.improvement && (
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">Improvements</h4>
              <div className="bg-background rounded border p-2 text-xs whitespace-pre-wrap">
                {errorAnalysis.improvement}
              </div>
            </div>
          )}
        </div>
      </div>
    </MinorErrorBoundary>
  );
};

export const ErrorAnalysisArtifact = memo(ErrorAnalysisArtifactComponent);

/**
 * Execution Trajectory Artifact View
 * Displays step-by-step execution history
 */
export interface ExecutionTrajectoryArtifactProps {
  trajectory: Array<{
    step: number;
    action: string;
    url?: string;
    success: boolean;
    timestamp: number;
  }>;
  className?: string;
}

const ExecutionTrajectoryArtifactComponent: React.FC<ExecutionTrajectoryArtifactProps> = ({
  trajectory,
  className,
}) => {
  if (!trajectory || trajectory.length === 0) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 text-sm text-muted-foreground", className)}>
        No execution steps recorded
      </div>
    );
  }

  // Memoize statistics
  const stats = useMemo(() => {
    const successCount = trajectory.filter(s => s?.success).length;
    return {
      total: trajectory.length,
      successCount,
      failureCount: trajectory.length - successCount,
    };
  }, [trajectory]);

  // Memoize step rendering for performance
  const renderedSteps = useMemo(() => {
    return trajectory.map((step, idx) => {
      if (!step) return null;

      const formattedTime = step.timestamp 
        ? new Date(step.timestamp).toLocaleTimeString()
        : null;

      return (
        <div
          key={`step-${idx}-${step.step || idx}`}
          className={cn(
            "rounded border p-2 text-xs transition-colors bg-muted"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-mono font-medium shrink-0">Step {step.step || idx + 1}:</span>
              <span className="font-medium truncate">{step.action || "Unknown action"}</span>
              <span className="shrink-0" aria-label={step.success ? "Success" : "Failed"}>
                {step.success ? "✅" : "❌"}
              </span>
            </div>
            {formattedTime && (
              <span className="text-muted-foreground shrink-0">
                {formattedTime}
              </span>
            )}
          </div>
          {step.url && (
            <div className="mt-1 text-muted-foreground truncate" title={step.url}>
              {step.url}
            </div>
          )}
        </div>
      );
    }).filter(Boolean);
  }, [trajectory]);

  return (
    <MinorErrorBoundary componentName="ExecutionTrajectoryArtifact">
      <div className={cn("rounded-lg border bg-card p-4", className)}>
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">🔄 Execution Trajectory</h3>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div>
              <span>Total Steps:</span> <span className="font-medium">{stats.total}</span>
            </div>
            <div>
              <span>✅ Success:</span> <span className="font-medium">{stats.successCount}</span>
            </div>
            {stats.failureCount > 0 && (
              <div>
                <span>❌ Failed:</span> <span className="font-medium">{stats.failureCount}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-auto">
          {renderedSteps}
        </div>
      </div>
    </MinorErrorBoundary>
  );
};

export const ExecutionTrajectoryArtifact = memo(ExecutionTrajectoryArtifactComponent);

/**
 * Workflow Metadata Artifact View
 * Displays workflow execution metadata
 */
export interface WorkflowMetadataArtifactProps {
  metadata: {
    workflowId?: string;
    conversationId?: string;
    braintrustRunId?: string;
  };
  totalDuration?: number;
  finalUrl?: string;
  className?: string;
}

const WorkflowMetadataArtifactComponent: React.FC<WorkflowMetadataArtifactProps> = ({
  metadata,
  totalDuration,
  finalUrl,
  className,
}) => {
  if (!metadata) {
    return null;
  }

  const hasContent = metadata.workflowId || metadata.conversationId || metadata.braintrustRunId || totalDuration !== undefined || finalUrl;
  
  if (!hasContent) {
    return null;
  }

  return (
    <MinorErrorBoundary componentName="WorkflowMetadataArtifact">
      <div className={cn("rounded-lg border bg-muted/50 p-3", className)}>
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Workflow Metadata</h4>
        <div className="space-y-1 text-xs font-mono">
          {metadata.workflowId && (
            <div className="break-all">
              <span className="text-muted-foreground">Workflow ID:</span>{" "}
              <span>{metadata.workflowId}</span>
            </div>
          )}
          {metadata.conversationId && (
            <div className="break-all">
              <span className="text-muted-foreground">Conversation ID:</span>{" "}
              <span>{metadata.conversationId}</span>
            </div>
          )}
          {metadata.braintrustRunId && (
            <div className="break-all">
              <span className="text-muted-foreground">Braintrust Run:</span>{" "}
              <span>{metadata.braintrustRunId}</span>
            </div>
          )}
          {totalDuration !== undefined && (
            <div>
              <span className="text-muted-foreground">Total Duration:</span>{" "}
              <span>{totalDuration}ms</span>
            </div>
          )}
          {finalUrl && (
            <div>
              <span className="text-muted-foreground">Final URL:</span>{" "}
              <a
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
                aria-label={`Navigate to ${finalUrl}`}
              >
                {finalUrl}
              </a>
            </div>
          )}
        </div>
      </div>
    </MinorErrorBoundary>
  );
};

export const WorkflowMetadataArtifact = memo(WorkflowMetadataArtifactComponent);

/**
 * Complete Workflow Output Artifact
 * Orchestrates all artifact views for a complete workflow result
 */
export interface WorkflowOutputArtifactProps {
  output: BrowserAutomationWorkflowOutput;
  className?: string;
  defaultOpen?: boolean;
}

const WorkflowOutputArtifactComponent: React.FC<WorkflowOutputArtifactProps> = ({
  output,
  className,
}) => {
  if (!output) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 text-sm text-muted-foreground", className)}>
        No workflow output available
      </div>
    );
  }

  return (
    <MinorErrorBoundary componentName="WorkflowOutputArtifact">
      <div className={cn("space-y-3", className)}>
        {/* Planning */}
        {output.planning && (
          <EnhancedPlanDisplay
            plan={output.planning.plan}
            confidence={output.planning.confidence}
            defaultOpen={false}
          />
        )}

        {/* Page Context */}
        {output.pageContext && (
          <PageContextArtifact pageContext={output.pageContext} />
        )}

        {/* Execution Trajectory */}
        {output.executionTrajectory && output.executionTrajectory.length > 0 && (
          <ExecutionTrajectoryArtifact trajectory={output.executionTrajectory} />
        )}

        {/* Summarization */}
        {output.summarization && (
          <SummarizationArtifact summarization={output.summarization} />
        )}

        {/* Error Analysis */}
        {output.errorAnalysis && (
          <ErrorAnalysisArtifact errorAnalysis={output.errorAnalysis} />
        )}

        {/* Metadata */}
        {output.metadata && (
          <WorkflowMetadataArtifact
            metadata={output.metadata}
            totalDuration={output.totalDuration}
            finalUrl={output.finalUrl}
          />
        )}
      </div>
    </MinorErrorBoundary>
  );
};

export const WorkflowOutputArtifact = memo(WorkflowOutputArtifactComponent);

// Re-export for convenience
import { EnhancedPlanDisplay } from "./structured-output";
export { EnhancedPlanDisplay };

