// Universal Artifact Renderer
// Automatically detects artifact type and renders appropriate component

import React from 'react';
import { ExecutionPlanArtifact } from './execution-plan-artifact';
import { ToolResultsArtifact } from './tool-results-artifact';
import { EvaluationArtifact } from './evaluation-artifact';
import { AlertCircle } from 'lucide-react';

interface ArtifactData {
  metadata: {
    id: string;
    type: string;
    version: number;
    createdAt: number;
    updatedAt: number;
    status: 'streaming' | 'complete' | 'error';
  };
  data: any;
  error?: string;
}

interface ArtifactRendererProps {
  artifact: ArtifactData;
}

/**
 * Renders the appropriate artifact component based on type
 */
export function ArtifactRenderer({ artifact }: ArtifactRendererProps) {
  const { type, status } = artifact.metadata;
  const { data, error } = artifact;

  // Error state
  if (status === 'error' && error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <h3 className="text-sm font-semibold text-red-900">Artifact Error</h3>
        </div>
        <p className="text-sm text-red-700">{error}</p>
        <p className="text-xs text-red-600 mt-2">Type: {type}</p>
      </div>
    );
  }

  // Render based on type
  switch (type) {
    case 'execution_plan':
      return <ExecutionPlanArtifact data={data} status={status} />;

    case 'tool_results':
      return <ToolResultsArtifact data={data} status={status} />;

    case 'evaluation':
      return <EvaluationArtifact data={data} status={status} />;

    case 'page_context':
      return <PageContextArtifact data={data} status={status} />;

    case 'summarization':
      return <SummarizationArtifact data={data} status={status} />;

    default:
      return <GenericArtifact artifact={artifact} />;
  }
}

/**
 * Renders all artifacts in a message
 */
interface ArtifactsContainerProps {
  artifacts: Record<string, ArtifactData>;
}

export function ArtifactsContainer({ artifacts }: ArtifactsContainerProps) {
  const artifactList = Object.values(artifacts);

  if (artifactList.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mt-4">
      {artifactList.map((artifact) => (
        <ArtifactRenderer key={artifact.metadata.id} artifact={artifact} />
      ))}
    </div>
  );
}

/**
 * Page Context Artifact Component
 */
function PageContextArtifact({
  data,
  status,
}: {
  data: any;
  status: 'streaming' | 'complete' | 'error';
}) {
  const { url, title, textContent, links = [], forms = [], screenshot } = data;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Page Context</h3>

      {url && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">URL:</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline break-all"
          >
            {url}
          </a>
        </div>
      )}

      {title && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Title:</p>
          <p className="text-sm text-gray-900 font-medium">{title}</p>
        </div>
      )}

      {textContent && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Content Preview:</p>
          <p className="text-sm text-gray-700 line-clamp-3">{textContent}</p>
        </div>
      )}

      {links.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Links ({links.length})
          </p>
          <div className="max-h-32 overflow-y-auto">
            {links.slice(0, 10).map((link: any, index: number) => (
              <a
                key={index}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline truncate"
              >
                {link.text || link.href}
              </a>
            ))}
            {links.length > 10 && (
              <p className="text-xs text-gray-500 mt-1">
                ...and {links.length - 10} more
              </p>
            )}
          </div>
        </div>
      )}

      {forms.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Forms ({forms.length})
          </p>
          <div className="space-y-2">
            {forms.map((form: any, index: number) => (
              <div key={index} className="rounded bg-gray-50 border border-gray-200 p-2">
                <p className="text-xs font-mono text-gray-700">
                  {form.action || 'No action'} ({form.method || 'GET'})
                </p>
                <p className="text-xs text-gray-600">
                  {form.fields?.length || 0} field(s)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {screenshot && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Screenshot:</p>
          <img
            src={screenshot}
            alt="Page screenshot"
            className="rounded border border-gray-300 max-w-full h-auto"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Summarization Artifact Component
 */
function SummarizationArtifact({
  data,
  status,
}: {
  data: any;
  status: 'streaming' | 'complete' | 'error';
}) {
  const { summary, keyActions = [], outcome, nextSteps = [], confidence } = data;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Execution Summary</h3>

      {summary && (
        <div className="mb-3">
          <p className="text-sm text-gray-700">{summary}</p>
        </div>
      )}

      {keyActions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Key Actions:</p>
          <ul className="space-y-1">
            {keyActions.map((action: string, index: number) => (
              <li key={index} className="text-sm text-gray-700">
                • {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {outcome && (
        <div className="mb-3 rounded bg-blue-50 border border-blue-200 p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">Outcome:</p>
          <p className="text-sm text-blue-900">{outcome}</p>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Next Steps:</p>
          <ul className="space-y-1">
            {nextSteps.map((step: string, index: number) => (
              <li key={index} className="text-sm text-gray-700">
                {index + 1}. {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {confidence !== undefined && (
        <div className="rounded bg-gray-50 border border-gray-200 p-2">
          <p className="text-xs text-gray-600">
            Confidence: {(confidence * 100).toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Generic fallback for unknown artifact types
 */
function GenericArtifact({ artifact }: { artifact: ArtifactData }) {
  const { type } = artifact.metadata;
  const { data } = artifact;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Artifact: {type}
      </h3>
      <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-96">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Hook to get all artifacts from a message
 */
export function useMessageArtifacts(message: any) {
  return React.useMemo(() => {
    return message.artifacts || {};
  }, [message]);
}
