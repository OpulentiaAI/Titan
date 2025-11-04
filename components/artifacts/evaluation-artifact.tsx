// Evaluation Artifact Component
// Renders quality assessment with scores and recommendations

import React from 'react';
import { z } from 'zod';
import { evaluationArtifact } from '../../lib/streaming-artifacts';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { AlertCircle, CheckCircle2, TrendingUp, Lightbulb, AlertTriangle } from 'lucide-react';

type EvaluationData = z.infer<typeof evaluationArtifact.schema>;

interface EvaluationArtifactProps {
  data: Partial<EvaluationData>;
  status: 'streaming' | 'complete' | 'error';
}

export function EvaluationArtifact({ data, status }: EvaluationArtifactProps) {
  const {
    quality,
    score = 0,
    completeness = 0,
    correctness = 0,
    issues = [],
    strengths = [],
    shouldProceed,
    retryStrategy,
    timestamp,
  } = data;

  const getQualityColor = (q: string | undefined) => {
    switch (q) {
      case 'excellent':
        return 'bg-green-600';
      case 'good':
        return 'bg-blue-600';
      case 'fair':
        return 'bg-yellow-600';
      case 'poor':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getQualityBadge = (q: string | undefined) => {
    switch (q) {
      case 'excellent':
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Excellent
          </Badge>
        );
      case 'good':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Good
          </Badge>
        );
      case 'fair':
        return (
          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Fair
          </Badge>
        );
      case 'poor':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Poor
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatScore = (s: number) => {
    return (s * 100).toFixed(1);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Execution Evaluation</h3>
            <p className="text-xs text-gray-500">
              Quality assessment and recommendations
            </p>
          </div>
        </div>
        {quality && getQualityBadge(quality)}
      </div>

      {/* Overall Score */}
      <div className="mb-4 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Overall Score</span>
          <span className="text-2xl font-bold text-purple-900">{formatScore(score)}%</span>
        </div>
        <div className={`h-3 rounded-full overflow-hidden bg-white`}>
          <div
            className={`h-full ${getQualityColor(quality)} transition-all duration-500`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
      </div>

      {/* Detailed Scores */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700">Completeness</span>
            <span className="text-sm font-bold text-blue-900">
              {formatScore(completeness)}%
            </span>
          </div>
          <Progress value={completeness * 100} className="h-1.5 bg-white" />
        </div>

        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-green-700">Correctness</span>
            <span className="text-sm font-bold text-green-900">
              {formatScore(correctness)}%
            </span>
          </div>
          <Progress value={correctness * 100} className="h-1.5 bg-white" />
        </div>
      </div>

      {/* Decision Banner */}
      {shouldProceed !== undefined && (
        <div
          className={`mb-4 rounded-lg p-3 ${
            shouldProceed
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {shouldProceed ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-green-900">
                  Quality criteria met. Proceeding to next phase.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-yellow-900">
                  Quality criteria not met. Retry recommended.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <h4 className="text-sm font-semibold text-gray-700">
              Issues Found ({issues.length})
            </h4>
          </div>
          <ul className="space-y-1.5">
            {issues.map((issue, index) => (
              <li
                key={index}
                className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800"
              >
                <span className="font-medium">•</span> {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <h4 className="text-sm font-semibold text-gray-700">
              Strengths ({strengths.length})
            </h4>
          </div>
          <ul className="space-y-1.5">
            {strengths.map((strength, index) => (
              <li
                key={index}
                className="rounded bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800"
              >
                <span className="font-medium">•</span> {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Retry Strategy */}
      {retryStrategy && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-blue-700">Retry Strategy</h4>
          </div>
          <p className="text-sm text-blue-900 mb-2">{retryStrategy.approach}</p>

          {retryStrategy.focusAreas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Focus Areas:</p>
              <ul className="space-y-1">
                {retryStrategy.focusAreas.map((area, index) => (
                  <li key={index} className="text-xs text-blue-800">
                    <span className="font-medium">→</span> {area}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {retryStrategy.estimatedImprovement > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              Expected improvement: +{formatScore(retryStrategy.estimatedImprovement)}%
            </p>
          )}
        </div>
      )}

      {/* Timestamp */}
      {timestamp && (
        <p className="text-xs text-gray-500 mt-4 text-center">
          Evaluated at {new Date(timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/**
 * Hook to subscribe to evaluation artifact updates
 */
export function useEvaluationArtifact(artifactId: string, artifacts: Record<string, any>) {
  const [data, setData] = React.useState<Partial<EvaluationData>>({});
  const [status, setStatus] = React.useState<'streaming' | 'complete' | 'error'>('streaming');

  React.useEffect(() => {
    if (artifacts[artifactId]) {
      setData(artifacts[artifactId].data || {});
      setStatus(artifacts[artifactId].metadata?.status || 'streaming');
    }
  }, [artifactId, artifacts]);

  return { data, status };
}
