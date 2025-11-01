// Task Manager Integration Test
// Tests the integration of TaskManager with the browser automation workflow

import { TaskManager, createWorkflowTaskManager, convertLegacyTasks } from '../../lib/task-manager';

describe('Task Manager Integration', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = createWorkflowTaskManager();
  });

  test('should create workflow task manager with standard tasks', () => {
    const tasks = taskManager.getAllTasks();
    expect(tasks).toHaveLength(3);

    const taskIds = tasks.map(t => t.id);
    expect(taskIds).toContain('plan');
    expect(taskIds).toContain('execute');
    expect(taskIds).toContain('summarize');

    // Check dependencies
    const executeTask = taskManager.getTask('execute');
    const summarizeTask = taskManager.getTask('summarize');

    expect(executeTask?.dependencies).toContain('plan');
    expect(summarizeTask?.dependencies).toContain('execute');
  });

  test('should handle task state transitions', () => {
    // Start planning
    taskManager.startTask('plan');
    expect(taskManager.getTask('plan')?.status).toBe('in_progress');

    // Complete planning
    taskManager.completeTask('plan', 'Planning completed');
    expect(taskManager.getTask('plan')?.status).toBe('completed');

    // Check that execute task can now start
    const runnableTasks = taskManager.getRunnableTasks();
    expect(runnableTasks.some(t => t.id === 'execute')).toBe(true);
  });

  test('should handle task retry logic', () => {
    // Start and fail a task
    taskManager.startTask('plan');
    taskManager.failTask('plan', 'Test failure');

    expect(taskManager.getTask('plan')?.status).toBe('error');
    expect(taskManager.getTask('plan')?.retryCount).toBe(1);

    // Retry the task
    taskManager.retryTask('plan', 'Retrying after failure');

    const planTask = taskManager.getTask('plan');
    expect(planTask?.status).toBe('pending');
    expect(planTask?.retryCount).toBe(1);
  });

  test('should handle task cancellation', () => {
    // Start a task
    taskManager.startTask('plan');
    expect(taskManager.getTask('plan')?.status).toBe('in_progress');

    // Cancel it
    taskManager.cancelTask('plan');
    expect(taskManager.getTask('plan')?.status).toBe('cancelled');
  });

  test('should convert legacy tasks correctly', () => {
    const legacyTasks = [
      { id: 'plan', title: 'Planning', status: 'completed' },
      { id: 'execute', title: 'Executing', status: 'in_progress' },
    ];

    const convertedTasks = convertLegacyTasks(legacyTasks);

    expect(convertedTasks).toHaveLength(2);
    expect(convertedTasks[0].id).toBe('plan');
    expect(convertedTasks[0].status).toBe('completed');
    expect(convertedTasks[1].id).toBe('execute');
    expect(convertedTasks[1].status).toBe('in_progress');
  });

  test('should provide task statistics', () => {
    const stats = taskManager.getStats();
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(3); // All start as pending
    expect(stats.completed).toBe(0);
  });

  test('should handle event listeners', () => {
    const mockListener = jest.fn();
    taskManager.addListener(mockListener);

    taskManager.startTask('plan');

    expect(mockListener).toHaveBeenCalledWith({
      id: 'plan',
      status: 'in_progress'
    });

    taskManager.removeListener(mockListener);
  });

  test('should enforce dependency constraints', () => {
    // Execute task should not be runnable initially
    expect(taskManager.canStartTask('execute')).toBe(false);

    // Complete planning
    taskManager.completeTask('plan');

    // Now execute should be runnable
    expect(taskManager.canStartTask('execute')).toBe(true);

    // But summarize should not be runnable yet
    expect(taskManager.canStartTask('summarize')).toBe(false);

    // Complete execute
    taskManager.completeTask('execute');

    // Now summarize should be runnable
    expect(taskManager.canStartTask('summarize')).toBe(true);
  });
});