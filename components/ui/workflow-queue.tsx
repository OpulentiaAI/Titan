// Workflow Queue - Iterative task queue that updates as workflows resolve
// Displays pending, in-progress, completed, and error states

"use client";

import * as React from "react";
import { memo, useMemo } from "react";
import { MinorErrorBoundary } from "../ErrorBoundary";
import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
  QueueList,
  QueueItem,
  QueueItemIndicator,
  QueueItemContent,
  QueueItemDescription,
  QueueItemActions,
  QueueItemAction,
  type QueueTodo,
} from "../ai-elements/queue";
import { CheckCircle, Loader2, XCircle, Clock, RotateCcw, X } from "lucide-react";
import { TextShimmer } from "../core/text-shimmer";

export interface WorkflowQueueProps {
  tasks: QueueTodo[];
  className?: string;
  defaultOpen?: boolean;
  onTaskRetry?: (taskId: string) => void;
  onTaskCancel?: (taskId: string) => void;
}

const WorkflowQueueComponent: React.FC<WorkflowQueueProps> = ({
  tasks,
  className,
  defaultOpen = true,
  onTaskRetry,
  onTaskCancel,
}) => {
  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'completed');
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const error = tasks.filter(t => t.status === 'error');
    const cancelled = tasks.filter(t => t.status === 'cancelled');
    const pending = tasks.filter(t => t.status === 'pending' || !t.status);

    return { completed, inProgress, error, cancelled, pending };
  }, [tasks]);

  const totalCount = tasks.length;
  const completedCount = groupedTasks.completed.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (tasks.length === 0) {
    return null;
  }

  return (
    <MinorErrorBoundary componentName="WorkflowQueue">
      <Queue className={className}>
        {/* In Progress Section */}
        {groupedTasks.inProgress.length > 0 && (
          <QueueSection defaultOpen={true}>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={groupedTasks.inProgress.length}
                label="In Progress"
                icon={<Loader2 className="size-4 animate-spin text-blue-500" />}
              />
            </QueueSectionTrigger>
            <QueueSectionContent>
              <QueueList>
                {groupedTasks.inProgress.map((task) => (
                  <QueueItem key={task.id}>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator status="in_progress" />
                      <QueueItemContent>
                        <TextShimmer duration={1.5} spread={2} className="font-medium">
                          {task.title}
                        </TextShimmer>
                      </QueueItemContent>
                    </div>
                    {task.description && (
                      <QueueItemDescription>{task.description}</QueueItemDescription>
                    )}
                  </QueueItem>
                ))}
              </QueueList>
            </QueueSectionContent>
          </QueueSection>
        )}

        {/* Pending Section */}
        {groupedTasks.pending.length > 0 && (
          <QueueSection defaultOpen={groupedTasks.inProgress.length === 0}>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={groupedTasks.pending.length}
                label="Pending"
                icon={<Clock className="size-4 text-muted-foreground" />}
              />
            </QueueSectionTrigger>
            <QueueSectionContent>
              <QueueList>
                {groupedTasks.pending.map((task) => (
                  <QueueItem key={task.id}>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator status="pending" />
                      <QueueItemContent>{task.title}</QueueItemContent>
                      <QueueItemActions>
                        <QueueItemAction
                          aria-label="Cancel task"
                          title="Cancel task"
                          onClick={() => {
                            onTaskCancel?.(task.id);
                          }}
                        >
                          <X className="size-3" />
                        </QueueItemAction>
                      </QueueItemActions>
                    </div>
                    {task.description && (
                      <QueueItemDescription>{task.description}</QueueItemDescription>
                    )}
                  </QueueItem>
                ))}
              </QueueList>
            </QueueSectionContent>
          </QueueSection>
        )}

        {/* Completed Section */}
        {groupedTasks.completed.length > 0 && (
          <QueueSection defaultOpen={false}>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={groupedTasks.completed.length}
                label="Completed"
                icon={<CheckCircle className="size-4 text-green-500" />}
              />
              <span className="text-xs text-muted-foreground">
                {progressPercent}%
              </span>
            </QueueSectionTrigger>
            <QueueSectionContent>
              <QueueList>
                {groupedTasks.completed.map((task) => (
                  <QueueItem key={task.id}>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator completed={true} />
                      <QueueItemContent completed={true}>{task.title}</QueueItemContent>
                    </div>
                    {task.description && (
                      <QueueItemDescription completed={true}>
                        {task.description}
                      </QueueItemDescription>
                    )}
                  </QueueItem>
                ))}
              </QueueList>
            </QueueSectionContent>
          </QueueSection>
        )}

        {/* Error Section */}
        {groupedTasks.error.length > 0 && (
          <QueueSection defaultOpen={true}>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={groupedTasks.error.length}
                label="Errors"
                icon={<XCircle className="size-4 text-red-500" />}
              />
            </QueueSectionTrigger>
            <QueueSectionContent>
              <QueueList>
                {groupedTasks.error.map((task) => (
                  <QueueItem key={task.id}>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator status="error" />
                      <QueueItemContent className="text-red-600 dark:text-red-400">
                        {task.title}
                      </QueueItemContent>
                      <QueueItemActions>
                        <QueueItemAction
                          aria-label="Retry task"
                          title="Retry task"
                          onClick={() => {
                            onTaskRetry?.(task.id);
                          }}
                        >
                          <RotateCcw className="size-3" />
                        </QueueItemAction>
                      </QueueItemActions>
                    </div>
                    {task.description && (
                      <QueueItemDescription className="text-red-600/80 dark:text-red-400/80">
                        {task.description}
                      </QueueItemDescription>
                    )}
                  </QueueItem>
                ))}
              </QueueList>
            </QueueSectionContent>
          </QueueSection>
        )}

        {/* Cancelled Section */}
        {groupedTasks.cancelled.length > 0 && (
          <QueueSection defaultOpen={false}>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={groupedTasks.cancelled.length}
                label="Cancelled"
                icon={<X className="size-4 text-gray-500" />}
              />
            </QueueSectionTrigger>
            <QueueSectionContent>
              <QueueList>
                {groupedTasks.cancelled.map((task) => (
                  <QueueItem key={task.id}>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator status="cancelled" />
                      <QueueItemContent className="text-gray-600 dark:text-gray-400 line-through">
                        {task.title}
                      </QueueItemContent>
                    </div>
                    {task.description && (
                      <QueueItemDescription className="text-gray-600/80 dark:text-gray-400/80">
                        {task.description}
                      </QueueItemDescription>
                    )}
                  </QueueItem>
                ))}
              </QueueList>
            </QueueSectionContent>
          </QueueSection>
        )}
      </Queue>
    </MinorErrorBoundary>
  );
};

export const WorkflowQueue = memo(WorkflowQueueComponent);

