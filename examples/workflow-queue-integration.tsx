// Example: How to integrate WorkflowQueue into the workflow
// Shows real-time progress tracking as tasks complete

import { WorkflowQueue } from "../components/ui/workflow-queue";
import type { QueueTodo } from "../components/ai-elements/queue";

/**
 * Example 1: Browser Automation Workflow with Real-Time Queue
 */
export function BrowserAutomationWithQueue() {
  const tasks: QueueTodo[] = [
    {
      id: "plan-1",
      title: "Generate execution plan",
      description: "Planning agent creating step-by-step actions",
      status: "completed",
    },
    {
      id: "nav-1",
      title: "Navigate to target page",
      description: "Opening https://sdk.vercel.ai",
      status: "completed",
    },
    {
      id: "ctx-1",
      title: "Get page context",
      description: "Extracting page elements and structure",
      status: "in_progress",
    },
    {
      id: "act-1",
      title: "Execute planned actions",
      description: "Performing 3 automated actions",
      status: "pending",
    },
    {
      id: "sum-1",
      title: "Generate summary",
      description: "Creating execution report and next steps",
      status: "pending",
    },
  ];

  return (
    <div className="space-y-4">
      <h2>Browser Automation Progress</h2>
      <WorkflowQueue tasks={tasks} defaultOpen={true} />
    </div>
  );
}

/**
 * Example 2: Integration with BrowserAutomationWorkflow
 * 
 * In workflows/browser-automation-workflow.ts, track tasks:
 */
export const WORKFLOW_INTEGRATION_EXAMPLE = `
// At the start of the workflow:
const workflowTasks: QueueTodo[] = [
  { id: 'plan', title: 'Planning', status: 'pending' },
  { id: 'navigate', title: 'Navigate', status: 'pending' },
  { id: 'execute', title: 'Execute Actions', status: 'pending' },
  { id: 'summarize', title: 'Summarize', status: 'pending' },
];

// Update task status via context.updateLastMessage:
context.updateLastMessage((msg) => ({
  ...msg,
  workflowTasks: workflowTasks.map(t => 
    t.id === 'plan' ? { ...t, status: 'in_progress' } : t
  ),
}));

// After each step completes:
context.updateLastMessage((msg) => ({
  ...msg,
  workflowTasks: msg.workflowTasks?.map(t => 
    t.id === 'plan' 
      ? { ...t, status: 'completed', description: 'Planned 4 steps' }
      : t.id === 'navigate'
      ? { ...t, status: 'in_progress' }
      : t
  ),
}));

// On error:
context.updateLastMessage((msg) => ({
  ...msg,
  workflowTasks: msg.workflowTasks?.map(t => 
    t.id === 'navigate' 
      ? { ...t, status: 'error', description: 'Page load timeout' }
      : t
  ),
}));
`;

/**
 * Example 3: Display in sidepanel.tsx
 */
export const SIDEPANEL_INTEGRATION_EXAMPLE = `
import { WorkflowQueue } from './components/ui/workflow-queue';

// In message rendering:
{message.workflowTasks && message.workflowTasks.length > 0 && (
  <div className="mb-3">
    <WorkflowQueue tasks={message.workflowTasks} defaultOpen={true} />
  </div>
)}
`;

/**
 * Example 4: Dynamic task updates
 */
export function DynamicTaskUpdatesExample() {
  // As workflow progresses, tasks update automatically
  const scenarioStages = [
    // Initial state
    [
      { id: '1', title: 'Planning', status: 'in_progress' as const },
      { id: '2', title: 'Navigation', status: 'pending' as const },
      { id: '3', title: 'Execution', status: 'pending' as const },
      { id: '4', title: 'Summary', status: 'pending' as const },
    ],
    // After planning
    [
      { id: '1', title: 'Planning', status: 'completed' as const, description: '5 steps planned' },
      { id: '2', title: 'Navigation', status: 'in_progress' as const },
      { id: '3', title: 'Execution', status: 'pending' as const },
      { id: '4', title: 'Summary', status: 'pending' as const },
    ],
    // After navigation
    [
      { id: '1', title: 'Planning', status: 'completed' as const },
      { id: '2', title: 'Navigation', status: 'completed' as const, description: 'Loaded in 1.2s' },
      { id: '3', title: 'Execution', status: 'in_progress' as const },
      { id: '4', title: 'Summary', status: 'pending' as const },
    ],
    // All complete
    [
      { id: '1', title: 'Planning', status: 'completed' as const },
      { id: '2', title: 'Navigation', status: 'completed' as const },
      { id: '3', title: 'Execution', status: 'completed' as const, description: '5/5 actions successful' },
      { id: '4', title: 'Summary', status: 'completed' as const, description: 'Generated in 8.3s' },
    ],
  ];

  return (
    <div className="space-y-6">
      {scenarioStages.map((stage, idx) => (
        <div key={idx}>
          <h3>Stage {idx + 1}</h3>
          <WorkflowQueue tasks={stage} />
        </div>
      ))}
    </div>
  );
}

