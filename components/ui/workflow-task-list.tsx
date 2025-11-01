/**
 * Workflow Task List - Adapted from mastra-hitl todo.tsx
 * Shows real-time task progression with status indicators
 */

import { CheckCircle2, Circle, Clock, Sparkles, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface WorkflowTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled' | 'retrying' | 'new';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  createdAt?: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
}

interface WorkflowTaskListProps {
  tasks: WorkflowTask[];
  emphasizedTasks?: Set<string>; // Task IDs to emphasize
  autoExpand?: boolean; // Auto-expand when new tasks are added
  className?: string;
}

const statusConfig = {
  new: {
    icon: Sparkles,
    color: 'text-purple-600',
    label: 'New',
  },
  pending: {
    icon: Circle,
    color: 'text-gray-500',
    label: 'Pending',
  },
  in_progress: {
    icon: Clock,
    color: 'text-blue-600',
    label: 'In Progress',
  },
  retrying: {
    icon: Clock,
    color: 'text-amber-600',
    label: 'Retrying',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    label: 'Completed',
  },
  error: {
    icon: Circle,
    color: 'text-red-600',
    label: 'Error',
  },
  cancelled: {
    icon: Circle,
    color: 'text-gray-400',
    label: 'Cancelled',
  },
};

export function WorkflowTaskList({
  tasks,
  emphasizedTasks = new Set(),
  autoExpand = true,
  className,
}: WorkflowTaskListProps) {
  const [isManualOpen, setIsOpen] = useState<boolean | undefined>(undefined);
  
  // Auto-expand if there are new or in-progress tasks
  const hasActiveTasks = useMemo(() => {
    return tasks.some(t => t.status === 'new' || t.status === 'in_progress' || t.status === 'retrying');
  }, [tasks]);
  
  const isOpen = isManualOpen ?? (autoExpand && hasActiveTasks);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('my-3', className)}
      style={{
        animation: 'fadeInUp 0.4s ease-out forwards',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"
        aria-expanded={isOpen}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            !isOpen && '-rotate-90',
          )}
        />
        Workflow Tasks ({tasks.filter(t => t.status === 'completed').length}/{tasks.length})
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'mt-2 grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex flex-col gap-1 overflow-hidden pl-6">
          {tasks.map((task) => {
            const config = statusConfig[task.status];
            const StatusIcon = config.icon;
            const isCompleted = task.status === 'completed';
            const isError = task.status === 'error';
            const isActive = task.status === 'in_progress' || task.status === 'retrying';
            const isNew = task.status === 'new';
            const isEmphasized = emphasizedTasks.has(task.id) || isNew;

            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-start gap-2 py-1',
                  isEmphasized && 'font-semibold',
                )}
              >
                {isActive ? (
                  <div className="flex h-4 w-4 mt-0.5 items-center justify-center rounded-full border-2 border-blue-500">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                ) : (
                  <StatusIcon 
                    className={cn(
                      'h-4 w-4 mt-0.5 flex-shrink-0',
                      config.color,
                    )}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-sm text-slate-700 dark:text-slate-300',
                      isCompleted && 'text-slate-400 dark:text-slate-500 line-through',
                      isActive && 'text-blue-600 dark:text-blue-400',
                      isError && 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {task.description}
                    </div>
                  )}
                  {isError && task.errorMessage && (
                    <div className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                      Error: {task.errorMessage}
                    </div>
                  )}
                  {task.status === 'retrying' && task.retryCount !== undefined && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Retry {task.retryCount}/{task.maxRetries || 3}
                    </div>
                  )}
                </div>
                {isNew && (
                  <Sparkles
                    aria-hidden
                    className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Keyframes for fadeInUp animation (add to globals.css if not present)
// @keyframes fadeInUp {
//   from {
//     opacity: 0;
//     transform: translateY(8px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }

