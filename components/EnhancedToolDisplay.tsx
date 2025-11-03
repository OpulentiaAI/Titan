"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Loader2,
  Settings,
  ChevronDown,
  Clock,
  Zap,
  TrendingUp,
  AlertCircle,
  Mouse,
  Keyboard,
  Navigation,
  Image,
  Globe,
  History,
  Eye,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export interface EnhancedToolDisplayProps {
  steps: Array<{
    stepNumber: number;
    toolCalls: Array<{
      toolCallId: string;
      toolName: string;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
      errorText?: string;
      timestamp?: number;
      duration?: number;
      retries?: number;
    }>;
    state: 'pending' | 'in-progress' | 'completed' | 'error';
    text?: string;
    toolResults?: Array<{
      toolCallId: string;
      result?: Record<string, unknown>;
      error?: string;
    }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
  isExecuting: boolean;
  currentStep: number;
  summary?: {
    totalSteps: number;
    totalToolCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number;
  } | null;
  className?: string;
}

/**
 * Tool icon mapping for better visual recognition
 */
const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  screenshot: Image,
  click: Mouse,
  type: Keyboard,
  scroll: Navigation,
  navigate: Globe,
  getPageContext: Eye,
  getBrowserHistory: History,
  wait: Clock,
  pressKey: Keyboard,
  keyCombo: Keyboard,
};

/**
 * Get tool display name with proper formatting
 */
function getToolDisplayName(toolName: string): string {
  const displayNames: Record<string, string> = {
    getPageContext: 'Page Analysis',
    getBrowserHistory: 'History Search',
    keyCombo: 'Key Combination',
  };
  
  return displayNames[toolName] || toolName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

/**
 * Format tool execution time
 */
function formatDuration(duration?: number): string {
  if (!duration) return '';
  
  if (duration < 1000) {
    return `${duration}ms`;
  }
  
  return `${(duration / 1000).toFixed(1)}s`;
}

/**
 * Get state color and information
 */
function getStateInfo(state: string) {
  switch (state) {
    case 'input-streaming':
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Loader2,
        iconSpin: true,
        label: 'Processing Input',
        variant: 'secondary' as const
      };
    case 'input-available':
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: CheckCircle,
        iconSpin: false,
        label: 'Input Ready',
        variant: 'default' as const
      };
    case 'output-available':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        iconSpin: false,
        label: 'Complete',
        variant: 'default' as const
      };
    case 'output-error':
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: XCircle,
        iconSpin: false,
        label: 'Error',
        variant: 'destructive' as const
      };
    case 'pending':
      return {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: Clock,
        iconSpin: false,
        label: 'Pending',
        variant: 'secondary' as const
      };
    case 'in-progress':
      return {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: Loader2,
        iconSpin: true,
        label: 'In Progress',
        variant: 'secondary' as const
      };
    case 'completed':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        iconSpin: false,
        label: 'Completed',
        variant: 'default' as const
      };
    case 'error':
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: XCircle,
        iconSpin: false,
        label: 'Error',
        variant: 'destructive' as const
      };
    default:
      return {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: Clock,
        iconSpin: false,
        label: 'Unknown',
        variant: 'secondary' as const
      };
  }
}

/**
 * Format tool input/output for display
 */
function formatToolData(data?: Record<string, unknown>): string {
  if (!data) return '';
  
  // Special formatting for common tool parameters
  if (data.text && typeof data.text === 'string') {
    const text = data.text as string;
    return text.length > 50 ? `"${text.substring(0, 50)}..."` : `"${text}"`;
  }
  
  if (data.url) {
    return `URL: ${data.url}`;
  }
  
  if (data.x !== undefined && data.y !== undefined) {
    return `Coordinates: (${data.x}, ${data.y})`;
  }
  
  if (data.direction) {
    return `Direction: ${data.direction}`;
  }
  
  if (data.amount) {
    return `Amount: ${data.amount}px`;
  }
  
  // Generic formatting for other data
  const keys = Object.keys(data);
  if (keys.length === 0) return 'No parameters';
  if (keys.length === 1) {
    const [key, value] = Object.entries(data)[0];
    return `${key}: ${String(value)}`;
  }
  
  return `${keys.length} parameters`;
}

/**
 * Create deterministic tool result structure
 */
export function createDeterministicToolResult<T>(
  toolName: string,
  success: boolean,
  data?: T,
  error?: string,
  metadata: Record<string, any> = {}
) {
  return {
    toolCallId: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    toolName,
    state: success ? 'output-available' as const : 'output-error' as const,
    input: metadata.input,
    output: success ? data : undefined,
    errorText: success ? undefined : error,
    timestamp: Date.now(),
    success,
    metadata,
  };
}

/**
 * Enhanced Tool Display with AI SDK 6 features
 * Implements all reliability patterns and deterministic returns
 */
export const EnhancedToolDisplay: React.FC<EnhancedToolDisplayProps> = ({
  steps,
  isExecuting,
  currentStep,
  summary,
  className,
}) => {
  const [openSteps, setOpenSteps] = React.useState<Set<number>>(new Set([steps.length - 1]))

  const toggleStep = (stepNumber: number) => {
    setOpenSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepNumber)) {
        next.delete(stepNumber)
      } else {
        next.add(stepNumber)
      }
      return next
    })
  }

  // Calculate overall progress
  const completedSteps = steps.filter(step => 
    step.state === 'completed' || step.state === 'error'
  ).length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  // Get tool icon
  const getToolIcon = (toolName: string) => {
    const IconComponent = toolIcons[toolName] || Zap;
    return IconComponent;
  };

  if (steps.length === 0 && !isExecuting) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Header */}
      {(steps.length > 1 || isExecuting) && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-base">Tool Execution Progress</CardTitle>
                  <CardDescription>
                    {isExecuting ? 'Currently executing tools...' : 'Tool execution completed'}
                  </CardDescription>
                </div>
              </div>
              {summary && (
                <Badge variant="outline" className="text-sm">
                  {summary.successfulCalls}/{summary.totalToolCalls} successful
                </Badge>
              )}
            </div>
          </CardHeader>
          {steps.length > 1 && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Step {currentStep} of {steps.length}
                  </span>
                  <span className="text-muted-foreground">
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Tool Execution Steps */}
      <div className="space-y-3">
        {steps.map((step, stepIndex) => {
          const isActive = stepIndex === currentStep - 1 || stepIndex === currentStep;
          const isCompleted = step.state === 'completed';
          const hasError = step.state === 'error';
          const isOpen = openSteps.has(step.stepNumber);
          const stepInfo = getStateInfo(step.state);

          return (
            <motion.div
              key={step.stepNumber}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: stepIndex * 0.1 }}
              className={cn(
                "border rounded-lg transition-all duration-300",
                isActive && "ring-2 ring-blue-200",
                isCompleted && "border-green-200 bg-green-50/50",
                hasError && "border-red-200 bg-red-50/50"
              )}
            >
              <Collapsible open={isOpen} onOpenChange={() => toggleStep(step.stepNumber)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-full",
                          stepInfo.bgColor
                        )}>
                          <stepInfo.icon className={cn(
                            "h-4 w-4",
                            stepInfo.color,
                            stepInfo.iconSpin && "animate-spin"
                          )} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">
                            Step {step.stepNumber}: {step.text || 'Processing...'}
                          </CardTitle>
                          <CardDescription>
                            {step.toolCalls.length} tool call{step.toolCalls.length !== 1 ? 's' : ''}
                            {step.usage && ` • ${step.usage.totalTokens} tokens`}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Step Status Badge */}
                        <Badge variant={stepInfo.variant} className="text-xs">
                          {stepInfo.label}
                        </Badge>
                        
                        {/* Expand/Collapse Icon */}
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isOpen && "rotate-180"
                        )} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* Tool Calls in this Step */}
                    <div className="space-y-3">
                      {step.toolCalls.map((toolCall) => {
                        const toolStateInfo = getStateInfo(toolCall.state);
                        const ToolIcon = getToolIcon(toolCall.toolName);
                        const displayName = getToolDisplayName(toolCall.toolName);

                        return (
                          <div
                            key={toolCall.toolCallId}
                            className={cn(
                              "p-3 rounded-md border-l-4 transition-all",
                              toolStateInfo.borderColor,
                              toolStateInfo.bgColor
                            )}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <ToolIcon className={cn(
                                  "h-4 w-4",
                                  toolStateInfo.color,
                                  toolStateInfo.iconSpin && "animate-spin"
                                )} />
                                <span className="text-sm font-medium">
                                  {displayName}
                                </span>
                                {toolCall.duration && (
                                  <Badge variant="outline" className="text-xs">
                                    {formatDuration(toolCall.duration)}
                                  </Badge>
                                )}
                                {toolCall.retries && toolCall.retries > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {toolCall.retries} retry{toolCall.retries > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant={toolStateInfo.variant} className="text-xs">
                                {toolStateInfo.label}
                              </Badge>
                            </div>

                            {/* Tool Input */}
                            {toolCall.input && (
                              <div className="mb-2">
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  Input:
                                </div>
                                <div className="text-xs font-mono bg-muted p-2 rounded break-all">
                                  {formatToolData(toolCall.input)}
                                </div>
                              </div>
                            )}

                            {/* Tool Output */}
                            {toolCall.output && toolCall.state === 'output-available' && (
                              <div className="mb-2">
                                <div className="text-xs font-medium text-green-700 mb-1">
                                  Output:
                                </div>
                                <div className="text-xs font-mono bg-green-50 p-2 rounded border border-green-200 break-all">
                                  {formatToolData(toolCall.output)}
                                </div>
                              </div>
                            )}

                            {/* Tool Error */}
                            {toolCall.errorText && toolCall.state === 'output-error' && (
                              <div className="mb-2">
                                <div className="text-xs font-medium text-red-700 mb-1">
                                  Error:
                                </div>
                                <div className="text-xs font-mono bg-red-50 p-2 rounded border border-red-200 break-all text-red-800">
                                  {toolCall.errorText}
                                </div>
                              </div>
                            )}

                            {/* Tool Timestamp */}
                            {toolCall.timestamp && (
                              <div className="text-xs text-muted-foreground">
                                {new Date(toolCall.timestamp).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Step Summary */}
                    {step.toolResults && step.toolResults.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Step Summary:
                        </div>
                        <div className="text-xs">
                          {step.toolResults.length} tool result{step.toolResults.length !== 1 ? 's' : ''} processed
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          );
        })}

        {/* Loading indicator for current step */}
        {isExecuting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-4 border-blue-200 bg-blue-50/50"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <div className="text-sm font-medium text-blue-900">
                  Step {currentStep}: Executing tools...
                </div>
                <div className="text-xs text-blue-700">
                  Please wait while the AI processes your request
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Execution Summary */}
      {!isExecuting && summary && steps.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Execution Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {summary.totalSteps}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Steps
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {summary.successfulCalls}
                </div>
                <div className="text-xs text-muted-foreground">
                  Successful Calls
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {summary.failedCalls}
                </div>
                <div className="text-xs text-muted-foreground">
                  Failed Calls
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {summary.successRate.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Success Rate
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};