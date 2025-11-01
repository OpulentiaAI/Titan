// Artifact Viewer - Comprehensive UI for displaying all message artifacts
// Displays planning, execution trajectory, page context, tool executions, and summarization

"use client";

import * as React from "react";
import { memo } from "react";
import { MinorErrorBoundary } from "./ErrorBoundary";
import { PlanningDisplay } from "./PlanningDisplay";
import { WorkflowQueue } from "./ui/workflow-queue";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "./ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "./ui/tabs";
import { 
  Badge 
} from "./ui/badge";
import {
  Brain,
  Workflow,
  FileText,
  Globe,
  Wrench,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { PlanningStepOutput, SummarizationStepOutput } from "../schemas/workflow-schemas";
import type { PageContext } from "../types";

export interface ArtifactViewerProps {
  planning?: PlanningStepOutput;
  summarization?: SummarizationStepOutput;
  executionTrajectory?: Array<{
    step: number;
    action: string;
    url?: string;
    success: boolean;
    timestamp: number;
  }>;
  workflowMetadata?: {
    workflowId?: string;
    conversationId?: string;
    totalDuration?: number;
    finalUrl?: string;
  };
  pageContext?: PageContext;
  workflowTasks?: Array<{
    id: string;
    title: string;
    status?: "pending" | "in_progress" | "completed" | "error";
    description?: string;
  }>;
  toolExecutions?: Array<{
    toolName: string;
    status: string;
    params?: any;
    result?: any;
    duration?: number;
    timestamp: number;
  }>;
  defaultTab?: string;
  className?: string;
}

const PureArtifactViewer: React.FC<ArtifactViewerProps> = ({
  planning,
  summarization,
  executionTrajectory,
  workflowMetadata,
  pageContext,
  workflowTasks,
  toolExecutions,
  defaultTab = "summary",
  className,
}) => {
  // Count available artifacts
  const artifactCount = [
    planning,
    summarization,
    executionTrajectory,
    workflowMetadata,
    pageContext,
    workflowTasks,
    toolExecutions,
  ].filter(Boolean).length;

  if (artifactCount === 0) {
    return null;
  }

  return (
    <MinorErrorBoundary componentName="ArtifactViewer">
      <Tabs defaultValue={defaultTab} className={className}>
        <TabsList className="grid w-full grid-cols-4">
          {summarization && (
            <TabsTrigger value="summary" className="gap-2">
              <FileText className="size-3.5" />
              Summary
            </TabsTrigger>
          )}
          {planning && (
            <TabsTrigger value="planning" className="gap-2">
              <Brain className="size-3.5" />
              Plan
            </TabsTrigger>
          )}
          {(executionTrajectory || toolExecutions) && (
            <TabsTrigger value="execution" className="gap-2">
              <Wrench className="size-3.5" />
              Execution
            </TabsTrigger>
          )}
          {(pageContext || workflowMetadata) && (
            <TabsTrigger value="context" className="gap-2">
              <Globe className="size-3.5" />
              Context
            </TabsTrigger>
          )}
        </TabsList>

        {/* Summary Tab */}
        {summarization && (
          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4" />
                    Summarization
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={summarization.success ? "default" : "destructive"}>
                      {summarization.success ? "Success" : "Failed"}
                    </Badge>
                    <Badge variant="outline">
                      <Clock className="mr-1 size-3" />
                      {(summarization.duration / 1000).toFixed(2)}s
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  Generated summary based on {summarization.stepCount} execution steps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="markdown-content text-sm leading-relaxed">
                    {summarization.summary}
                  </div>
                </div>
                
                {summarization.knowledgeItems && summarization.knowledgeItems.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold">Knowledge Items</h4>
                    <div className="space-y-1">
                      {summarization.knowledgeItems.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          <span className="font-medium">{item.title}</span>
                          {item.url && <span className="ml-2">• {item.url}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {summarization.error && (
                  <div className="mt-4 rounded-md bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">{summarization.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Planning Tab */}
        {planning && (
          <TabsContent value="planning">
            <PlanningDisplay planning={planning} defaultOpen={true} />
          </TabsContent>
        )}

        {/* Execution Tab */}
        {(executionTrajectory || toolExecutions || workflowTasks) && (
          <TabsContent value="execution" className="space-y-4">
            {/* Workflow Tasks */}
            {workflowTasks && workflowTasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="size-4" />
                    Workflow Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <WorkflowQueue tasks={workflowTasks} />
                </CardContent>
              </Card>
            )}

            {/* Execution Trajectory */}
            {executionTrajectory && executionTrajectory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="size-4" />
                    Execution Trajectory
                  </CardTitle>
                  <CardDescription>
                    {executionTrajectory.length} steps executed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {executionTrajectory.map((step, idx) => {
                      const isLast = idx === executionTrajectory.length - 1;
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`rounded-full p-1.5 ${
                              step.success 
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}>
                              <CheckCircle className="size-3" />
                            </div>
                            {!isLast && (
                              <div className="h-full w-px bg-border my-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Step {step.step}: {step.action}
                              </span>
                              <Badge variant={step.success ? "secondary" : "destructive"} className="text-xs">
                                {step.success ? "✓" : "✗"}
                              </Badge>
                            </div>
                            {step.url && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {step.url}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(step.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tool Executions */}
            {toolExecutions && toolExecutions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="size-4" />
                    Tool Executions
                  </CardTitle>
                  <CardDescription>
                    {toolExecutions.length} tool calls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {toolExecutions.map((exec, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{exec.toolName}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                              {exec.status}
                            </Badge>
                            {exec.duration !== undefined && (
                              <Badge variant="secondary" className="text-xs">
                                {exec.duration}ms
                              </Badge>
                            )}
                          </div>
                        </div>
                        {exec.params && Object.keys(exec.params).length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Params:</span>{' '}
                            {JSON.stringify(exec.params)}
                          </div>
                        )}
                        {exec.result && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Result:</span>{' '}
                            {typeof exec.result === 'object' 
                              ? JSON.stringify(exec.result).substring(0, 100) + '...'
                              : String(exec.result)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Context Tab */}
        {(pageContext || workflowMetadata) && (
          <TabsContent value="context" className="space-y-4">
            {/* Workflow Metadata */}
            {workflowMetadata && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="size-4" />
                    Workflow Metadata
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {workflowMetadata.workflowId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Workflow ID:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">
                        {workflowMetadata.workflowId}
                      </code>
                    </div>
                  )}
                  {workflowMetadata.conversationId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conversation ID:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">
                        {workflowMetadata.conversationId}
                      </code>
                    </div>
                  )}
                  {workflowMetadata.totalDuration !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Duration:</span>
                      <span className="font-medium">
                        {(workflowMetadata.totalDuration / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  {workflowMetadata.finalUrl && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Final URL:</span>
                      <a 
                        href={workflowMetadata.finalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline max-w-xs truncate"
                      >
                        {workflowMetadata.finalUrl}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Page Context */}
            {pageContext && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="size-4" />
                    Page Context
                  </CardTitle>
                  {pageContext.url && (
                    <CardDescription className="truncate">
                      {pageContext.url}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Page Info */}
                  <div className="space-y-2 text-sm">
                    {pageContext.title && (
                      <div>
                        <span className="font-medium">Title:</span>{' '}
                        <span className="text-muted-foreground">{pageContext.title}</span>
                      </div>
                    )}
                    {pageContext.viewport && (
                      <div className="flex gap-4">
                        <div>
                          <span className="font-medium">Viewport:</span>{' '}
                          <span className="text-muted-foreground">
                            {pageContext.viewport.width}×{pageContext.viewport.height}
                          </span>
                        </div>
                        {pageContext.viewport.devicePixelRatio && (
                          <div>
                            <span className="font-medium">DPR:</span>{' '}
                            <span className="text-muted-foreground">
                              {pageContext.viewport.devicePixelRatio}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Links */}
                  {pageContext.links && pageContext.links.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Links ({pageContext.links.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {pageContext.links.slice(0, 10).map((link, idx) => (
                          <div key={idx} className="text-xs">
                            <a 
                              href={link.href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {link.text || link.href}
                            </a>
                          </div>
                        ))}
                        {pageContext.links.length > 10 && (
                          <p className="text-xs text-muted-foreground italic">
                            ... and {pageContext.links.length - 10} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Forms */}
                  {pageContext.forms && pageContext.forms.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Forms ({pageContext.forms.length})
                      </h4>
                      <div className="space-y-2">
                        {pageContext.forms.map((form, idx) => (
                          <div key={idx} className="rounded-md bg-muted p-2 text-xs">
                            {form.id && <div><span className="font-medium">ID:</span> {form.id}</div>}
                            {form.action && <div><span className="font-medium">Action:</span> {form.action}</div>}
                            {form.inputs && form.inputs.length > 0 && (
                              <div className="mt-1">
                                <span className="font-medium">Inputs:</span> {form.inputs.length}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Text Content Preview */}
                  {pageContext.textContent && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Text Content</h4>
                      <div className="rounded-md bg-muted p-3 text-xs font-mono max-h-40 overflow-y-auto">
                        {pageContext.textContent.substring(0, 500)}
                        {pageContext.textContent.length > 500 && (
                          <span className="text-muted-foreground italic">
                            ... ({pageContext.textContent.length - 500} more chars)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Planning Tab */}
        {planning && (
          <TabsContent value="planning">
            <PlanningDisplay planning={planning} defaultOpen={true} />
          </TabsContent>
        )}

        {/* Execution Tab */}
        {(executionTrajectory || toolExecutions) && (
          <TabsContent value="execution" className="space-y-4">
            {workflowTasks && workflowTasks.length > 0 && (
              <WorkflowQueue tasks={workflowTasks} />
            )}

            {executionTrajectory && executionTrajectory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Execution Timeline</CardTitle>
                  <CardDescription>
                    {executionTrajectory.filter(s => s.success).length}/{executionTrajectory.length} steps successful
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {executionTrajectory.map((step, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between rounded-md border p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${
                            step.success ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="font-medium">Step {step.step}:</span>
                          <span>{step.action}</span>
                        </div>
                        {step.url && (
                          <span className="text-xs text-muted-foreground truncate max-w-xs">
                            {step.url}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {toolExecutions && toolExecutions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="size-4" />
                    Tool Call Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {toolExecutions.map((exec, idx) => (
                      <details key={idx} className="group">
                        <summary className="cursor-pointer rounded-md border p-2 text-sm hover:bg-muted">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{exec.toolName}</span>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">
                                {exec.status}
                              </Badge>
                              {exec.duration !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {exec.duration}ms
                                </span>
                              )}
                            </div>
                          </div>
                        </summary>
                        <div className="mt-2 ml-4 space-y-2 text-xs">
                          {exec.params && (
                            <div>
                              <span className="font-medium">Parameters:</span>
                              <pre className="mt-1 rounded bg-muted p-2 overflow-x-auto">
                                {JSON.stringify(exec.params, null, 2)}
                              </pre>
                            </div>
                          )}
                          {exec.result && (
                            <div>
                              <span className="font-medium">Result:</span>
                              <pre className="mt-1 rounded bg-muted p-2 overflow-x-auto">
                                {JSON.stringify(exec.result, null, 2).substring(0, 300)}
                                {JSON.stringify(exec.result).length > 300 && '...'}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Context Tab */}
        {(pageContext || workflowMetadata) && (
          <TabsContent value="context" className="space-y-4">
            {workflowMetadata && (
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {workflowMetadata.workflowId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Workflow ID:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">
                        {workflowMetadata.workflowId}
                      </code>
                    </div>
                  )}
                  {workflowMetadata.totalDuration !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">
                        {(workflowMetadata.totalDuration / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  {workflowMetadata.finalUrl && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Final URL:</span>
                      <a 
                        href={workflowMetadata.finalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-xs"
                      >
                        {workflowMetadata.finalUrl}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {pageContext && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="size-4" />
                    Page State
                  </CardTitle>
                  {pageContext.title && (
                    <CardDescription>{pageContext.title}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-muted-foreground text-xs">Links</div>
                      <div className="font-medium">{pageContext.links?.length || 0}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Forms</div>
                      <div className="font-medium">{pageContext.forms?.length || 0}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Images</div>
                      <div className="font-medium">{pageContext.images?.length || 0}</div>
                    </div>
                  </div>

                  {pageContext.metadata && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">Metadata</h4>
                      {pageContext.metadata.description && (
                        <div className="text-xs text-muted-foreground">
                          {pageContext.metadata.description}
                        </div>
                      )}
                      {pageContext.metadata.keywords && (
                        <div className="flex gap-1 flex-wrap">
                          {pageContext.metadata.keywords.split(',').map((kw: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {kw.trim()}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </MinorErrorBoundary>
  );
};

export const ArtifactViewer = memo(PureArtifactViewer);

