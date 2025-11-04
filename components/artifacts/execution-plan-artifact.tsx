// Execution Plan Artifact Component
// Renders streaming execution plan with progress tracking

import React from 'react';
import { z } from 'zod';
import { executionPlanArtifact } from '../../lib/streaming-artifacts';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react';

type ExecutionPlanData = z.infer<typeof executionPlanArtifact.schema>;

interface ExecutionPlanArtifactProps {
  data: Partial<ExecutionPlanData>;
  status: 'streaming' | 'complete' | 'error';
}

export function ExecutionPlanArtifact({ data, status }: ExecutionPlanArtifactProps) {
  const {
    objective,
    approach,
    totalSteps = 0,
    completedSteps = 0,
    currentStep,
    steps = [],
    progress = 0,
    estimatedTimeRemaining,
  } = data;

  const getStepIcon = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStepColor = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Execution Plan</h3>
            {status === 'streaming' && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                In Progress
              </Badge>
            )}
            {status === 'complete' && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>
          {objective && (
            <p className="text-sm text-gray-700 font-medium mb-1">{objective}</p>
          )}
          {approach && (
            <p className="text-xs text-gray-500">{approach}</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {totalSteps > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {completedSteps} / {totalSteps} steps
            </span>
            {estimatedTimeRemaining && (
              <span className="text-xs text-gray-500">
                ~{Math.round(estimatedTimeRemaining / 1000)}s remaining
              </span>
            )}
          </div>
          <Progress value={progress * 100} className="h-2" />
          <div className="text-xs text-gray-500 mt-1">
            {Math.round(progress * 100)}% complete
          </div>
        </div>
      )}

      {/* Steps List */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className={`rounded-lg border p-3 transition-colors ${getStepColor(step.status)} ${
                currentStep === index ? 'ring-2 ring-blue-400' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-600">
                      Step {step.step}
                    </span>
                    <code className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-300">
                      {step.action}
                    </code>
                    {step.target && (
                      <span className="text-xs text-gray-500 truncate">
                        → {step.target}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-1">
                    {step.reasoning}
                  </p>
                  {step.result && (
                    <div className="mt-2 rounded bg-white p-2 border border-gray-200">
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold">Result:</span> {step.result}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to subscribe to execution plan artifact updates
 */
export function useExecutionPlanArtifact(artifactId: string, artifacts: Record<string, any>) {
  const [data, setData] = React.useState<Partial<ExecutionPlanData>>({});
  const [status, setStatus] = React.useState<'streaming' | 'complete' | 'error'>('streaming');

  React.useEffect(() => {
    if (artifacts[artifactId]) {
      setData(artifacts[artifactId].data || {});
      setStatus(artifacts[artifactId].metadata?.status || 'streaming');
    }
  }, [artifactId, artifacts]);

  return { data, status };
}
