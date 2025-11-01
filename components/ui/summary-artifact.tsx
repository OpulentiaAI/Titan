// Summary Artifact - Displays final workflow summary with actions
// Now mandatory since finalization is disabled for speed

"use client";

import * as React from "react";
import { memo, useState } from "react";
import { cn } from "../../lib/utils";
import { MinorErrorBoundary } from "../ErrorBoundary";
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "../ai-elements/artifact";
import {
  CopyIcon,
  DownloadIcon,
  RefreshCwIcon,
  ShareIcon,
  FileTextIcon,
} from "lucide-react";
import { Streamdown } from "streamdown";

export interface SummaryArtifactProps {
  summary: string;
  duration?: number;
  stepCount?: number;
  success?: boolean;
  className?: string;
  onRegenerate?: () => void;
  onShare?: () => void;
}

const SummaryArtifactComponent: React.FC<SummaryArtifactProps> = ({
  summary,
  duration,
  stepCount,
  success = true,
  className,
  onRegenerate,
  onShare,
}) => {
  const [copied, setCopied] = useState(false);

  if (!summary || summary.trim() === '') {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'Just now';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <MinorErrorBoundary componentName="SummaryArtifact">
      <Artifact className={className}>
        <ArtifactHeader>
          <div>
            <ArtifactTitle>
              <FileTextIcon className="inline-block size-4 mr-1.5" />
              Execution Summary
            </ArtifactTitle>
            <ArtifactDescription>
              {success ? '✅' : '⚠️'} Generated in {formatDuration(duration)}
              {stepCount !== undefined && ` • ${stepCount} step${stepCount !== 1 ? 's' : ''}`}
            </ArtifactDescription>
          </div>
          <ArtifactActions>
            <ArtifactAction
              icon={CopyIcon}
              label={copied ? "Copied!" : undefined}
              onClick={handleCopy}
              tooltip="Copy to clipboard"
            />
            {onRegenerate && (
              <ArtifactAction
                icon={RefreshCwIcon}
                onClick={onRegenerate}
                tooltip="Regenerate summary"
              />
            )}
            <ArtifactAction
              icon={DownloadIcon}
              onClick={handleDownload}
              tooltip="Download as markdown"
            />
            {onShare && (
              <ArtifactAction
                icon={ShareIcon}
                onClick={onShare}
                tooltip="Share summary"
              />
            )}
          </ArtifactActions>
        </ArtifactHeader>
        <ArtifactContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Streamdown content={summary} />
          </div>
        </ArtifactContent>
      </Artifact>
    </MinorErrorBoundary>
  );
};

export const SummaryArtifact = memo(SummaryArtifactComponent);

