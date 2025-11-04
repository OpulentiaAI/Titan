// Tool Results Artifact Component
// Renders tool execution summary with statistics

import React from 'react';
import { z } from 'zod';
import { toolResultsArtifact } from '../../lib/streaming-artifacts';
import { Badge } from '../ui/badge';
import { CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

type ToolResultsData = z.infer<typeof toolResultsArtifact.schema>;

interface ToolResultsArtifactProps {
  data: Partial<ToolResultsData>;
  status: 'streaming' | 'complete' | 'error';
}

export function ToolResultsArtifact({ data, status }: ToolResultsArtifactProps) {
  const { toolCalls = [], summary } = data;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatArgs = (args: Record<string, any>) => {
    return Object.entries(args)
      .map(([key, value]) => {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        if (stringValue.length > 50) {
          return `${key}: ${stringValue.substring(0, 50)}...`;
        }
        return `${key}: ${stringValue}`;
      })
      .join(', ');
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Tool Execution Summary</h3>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Total Calls</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{summary.totalCalls}</p>
            </div>

            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Successful</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{summary.successCount}</p>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-700">Errors</span>
              </div>
              <p className="text-2xl font-bold text-red-900">{summary.errorCount}</p>
            </div>

            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">Avg Duration</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {formatDuration(summary.averageDuration)}
              </p>
            </div>
          </div>
        )}

        {/* Tool Usage Breakdown */}
        {summary && Object.keys(summary.toolUsage).length > 0 && (
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Tool Usage</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.toolUsage).map(([tool, count]) => (
                <Badge key={tool} variant="outline" className="bg-white">
                  <code className="text-xs font-mono">{tool}</code>
                  <span className="ml-1 text-xs font-semibold">×{count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Tool Calls */}
      {toolCalls.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Execution Timeline ({toolCalls.length} calls)
          </h4>
          <Accordion type="single" collapsible className="space-y-2">
            {toolCalls.map((call, index) => (
              <AccordionItem
                key={index}
                value={`call-${index}`}
                className={`rounded-lg border ${
                  call.success
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <div className="flex items-center gap-2 w-full">
                    {call.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    )}
                    <code className="text-sm font-mono font-semibold">
                      {call.toolName}
                    </code>
                    <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
                      {formatDuration(call.duration)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {/* Arguments */}
                    <div className="rounded bg-white p-2 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Arguments:</p>
                      <code className="text-xs font-mono text-gray-700 break-all">
                        {formatArgs(call.args)}
                      </code>
                    </div>

                    {/* Result */}
                    {call.success && call.result && (
                      <div className="rounded bg-white p-2 border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Result:</p>
                        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                          {typeof call.result === 'string'
                            ? call.result
                            : JSON.stringify(call.result, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Error */}
                    {!call.success && call.error && (
                      <div className="rounded bg-red-100 p-2 border border-red-300">
                        <p className="text-xs font-semibold text-red-700 mb-1">Error:</p>
                        <p className="text-xs text-red-600">{call.error}</p>
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-gray-500">
                      Executed at: {new Date(call.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {toolCalls.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No tool calls recorded yet
        </p>
      )}
    </div>
  );
}

/**
 * Hook to subscribe to tool results artifact updates
 */
export function useToolResultsArtifact(artifactId: string, artifacts: Record<string, any>) {
  const [data, setData] = React.useState<Partial<ToolResultsData>>({});
  const [status, setStatus] = React.useState<'streaming' | 'complete' | 'error'>('streaming');

  React.useEffect(() => {
    if (artifacts[artifactId]) {
      setData(artifacts[artifactId].data || {});
      setStatus(artifacts[artifactId].metadata?.status || 'streaming');
    }
  }, [artifactId, artifacts]);

  return { data, status };
}
