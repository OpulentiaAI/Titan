// Task Management System - Dedicated tooling for task lifecycle management
// Provides robust task state transitions, error handling, retry logic, and dependency management

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled' | 'retrying';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  dependencies?: string[]; // Task IDs this task depends on
  dependents?: string[]; // Task IDs that depend on this task
  metadata?: Record<string, any>;
}

export interface TaskManagerOptions {
  maxConcurrentTasks?: number;
  defaultMaxRetries?: number;
  enableAutoRetry?: boolean;
  retryDelayMs?: number;
}

export interface TaskUpdate {
  id: string;
  status?: TaskStatus;
  description?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private options: Required<TaskManagerOptions>;
  private listeners: Array<(update: TaskUpdate) => void> = [];

  constructor(options: TaskManagerOptions = {}) {
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks ?? 3,
      defaultMaxRetries: options.defaultMaxRetries ?? 3,
      enableAutoRetry: options.enableAutoRetry ?? true,
      retryDelayMs: options.retryDelayMs ?? 1000,
    };
  }

  /**
   * Create a new task
   */
  createTask(
    id: string,
    title: string,
    options: {
      description?: string;
      priority?: TaskPriority;
      maxRetries?: number;
      dependencies?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Task {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id '${id}' already exists`);
    }

    const task: Task = {
      id,
      title,
      description: options.description,
      status: 'pending',
      priority: options.priority ?? 'medium',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.options.defaultMaxRetries,
      dependencies: options.dependencies ?? [],
      dependents: [],
      metadata: options.metadata ?? {},
    };

    // Update dependents for dependencies
    task.dependencies?.forEach(depId => {
      const depTask = this.tasks.get(depId);
      if (depTask) {
        depTask.dependents = depTask.dependents || [];
        depTask.dependents.push(id);
      }
    });

    this.tasks.set(id, task);
    this.notifyListeners({ id, status: 'pending' });

    return task;
  }

  /**
   * Update task status
   */
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    const oldStatus = task.status;
    Object.assign(task, updates);
    task.updatedAt = Date.now();

    // Set timestamps based on status
    if (updates.status === 'in_progress' && !task.startedAt) {
      task.startedAt = Date.now();
    } else if ((updates.status === 'completed' || updates.status === 'error' || updates.status === 'cancelled') && !task.completedAt) {
      task.completedAt = Date.now();
    }

    // Handle status transitions
    if (oldStatus !== updates.status) {
      this.handleStatusTransition(task, oldStatus, updates.status!);
    }

    this.notifyListeners({
      id,
      status: updates.status,
      description: updates.description,
      errorMessage: updates.errorMessage,
      metadata: updates.metadata,
    });

    return task;
  }

  /**
   * Start a task
   */
  startTask(id: string): Task | null {
    return this.updateTask(id, { status: 'in_progress' });
  }

  /**
   * Complete a task
   */
  completeTask(id: string, description?: string): Task | null {
    return this.updateTask(id, { status: 'completed', description });
  }

  /**
   * Fail a task with error
   */
  failTask(id: string, errorMessage: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    // Check if we should retry
    if (this.options.enableAutoRetry && task.retryCount < task.maxRetries) {
      return this.retryTask(id, errorMessage);
    }

    return this.updateTask(id, { status: 'error', errorMessage });
  }

  /**
   * Retry a failed task
   */
  retryTask(id: string, errorMessage?: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.retryCount++;
    task.errorMessage = errorMessage;

    // Reset timestamps for retry
    task.startedAt = undefined;
    task.completedAt = undefined;

    // Schedule retry with delay
    setTimeout(() => {
      this.updateTask(id, { status: 'retrying' });
      setTimeout(() => {
        this.updateTask(id, { status: 'pending', errorMessage: undefined });
      }, 100);
    }, this.options.retryDelayMs);

    return task;
  }

  /**
   * Cancel a task
   */
  cancelTask(id: string): Task | null {
    return this.updateTask(id, { status: 'cancelled' });
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter(task => task.status === status);
  }

  /**
   * Get tasks that can be started (all dependencies completed)
   */
  getRunnableTasks(): Task[] {
    return this.getAllTasks()
      .filter(task => task.status === 'pending')
      .filter(task => {
        return task.dependencies?.every(depId => {
          const depTask = this.tasks.get(depId);
          return depTask?.status === 'completed';
        }) ?? true;
      });
  }

  /**
   * Check if a task can be started
   */
  canStartTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'pending') return false;

    return task.dependencies?.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask?.status === 'completed';
    }) ?? true;
  }

  /**
   * Get task statistics
   */
  getStats() {
    const allTasks = this.getAllTasks();
    const stats = {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      error: allTasks.filter(t => t.status === 'error').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length,
      retrying: allTasks.filter(t => t.status === 'retrying').length,
    };

    return stats;
  }

  /**
   * Add event listener for task updates
   */
  addListener(listener: (update: TaskUpdate) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: (update: TaskUpdate) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.listeners.length = 0;
  }

  /**
   * Handle status transitions
   */
  private handleStatusTransition(task: Task, oldStatus: TaskStatus, newStatus: TaskStatus): void {
    // Handle dependency resolution
    if (newStatus === 'completed') {
      // Notify dependent tasks that they might now be runnable
      task.dependents?.forEach(depId => {
        const depTask = this.tasks.get(depId);
        if (depTask && depTask.status === 'pending' && this.canStartTask(depId)) {
          // Could emit an event here for tasks that become runnable
        }
      });
    }

    // Handle error propagation
    if (newStatus === 'error') {
      // Could cancel dependent tasks or mark them as blocked
      task.dependents?.forEach(depId => {
        const depTask = this.tasks.get(depId);
        if (depTask && depTask.status === 'pending') {
          // Mark as blocked due to dependency failure
          this.updateTask(depId, {
            status: 'error',
            errorMessage: `Blocked by failed dependency: ${task.title}`,
          });
        }
      });
    }
  }

  /**
   * Notify listeners of task updates
   */
  private notifyListeners(update: TaskUpdate): void {
    this.listeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        console.error('Error in task listener:', error);
      }
    });
  }
}

/**
 * Create a workflow task manager with common workflow tasks
 */
export function createWorkflowTaskManager(options?: TaskManagerOptions): TaskManager {
  const manager = new TaskManager(options);

  // Create standard workflow tasks with dependencies
  manager.createTask('plan', 'Generate Execution Plan', {
    priority: 'high',
    description: 'Analyze user query and create detailed execution plan',
  });

  manager.createTask('execute', 'Execute Browser Actions', {
    priority: 'high',
    description: 'Execute planned browser automation steps',
    dependencies: ['plan'],
  });

  manager.createTask('analyze', 'Diagnose Execution', {
    priority: 'medium',
    description: 'Review trajectory for errors and determine next actions',
    dependencies: ['execute'],
  });

  manager.createTask('summarize', 'Generate Summary', {
    priority: 'medium',
    description: 'Analyze execution results and provide summary/next steps',
    dependencies: ['analyze'],
  });

  return manager;
}

/**
 * Convert legacy workflow tasks to new TaskManager format
 */
export function convertLegacyTasks(legacyTasks: Array<{id: string, title: string, status?: string, description?: string}>): Task[] {
  return legacyTasks.map(legacy => ({
    id: legacy.id,
    title: legacy.title,
    description: legacy.description,
    status: (legacy.status as TaskStatus) || 'pending',
    priority: 'medium',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
  }));
}
