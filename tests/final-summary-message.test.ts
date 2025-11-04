import { buildFinalSummaryMessage } from "../lib/message-utils";

function assert(condition: any, message: string) {
  if (!condition) {
    console.error("TEST FAILED:", message);
    process.exit(1);
  }
}

// Minimal mock task manager to satisfy optional workflowTasks mapping
class MockTaskManager {
  getAllTasks() {
    return [
      { id: "t1", title: "Do thing", status: "completed", description: "done" },
      { id: "t2", title: "Next thing", status: "pending" },
    ];
  }
}

// Case 1: With summarization
{
  const workflowOutput = {
    summarization: { success: true, summary: "This is a test summary." },
    executionTrajectory: [{ step: 1, action: "open", success: true, timestamp: Date.now() }],
    pageContext: { url: "https://example.com" },
    metadata: { workflowId: "wf-123" },
    totalDuration: 1234,
    finalUrl: "https://example.com/final",
    taskManager: new MockTaskManager(),
  } as any;

  const msg = buildFinalSummaryMessage(workflowOutput);
  assert(msg.role === "assistant", "role should be assistant");
  assert(
    msg.content.includes("Summary & Next Steps") && msg.content.includes("This is a test summary."),
    "content should include summary heading and text"
  );
  assert(msg.workflowMetadata?.workflowId === "wf-123", "workflowId should be propagated");
  assert(msg.workflowTasks && msg.workflowTasks.length === 2, "workflow tasks should be converted");
}

// Case 2: Without summarization
{
  const workflowOutput = {
    executionTrajectory: [],
  } as any;

  const msg = buildFinalSummaryMessage(workflowOutput);
  assert(msg.content.includes("## Summary & Next Steps"), "fallback still uses unified summary header");
  assert(/Status: (Success|Partial|Failed)/.test(msg.content.replace(/[✅⚠️❌]\s*/g, '')), "includes status line");
  assert(msg.content.includes("TASK_COMPLETED:"), "includes completion flag");
}

console.log("final-summary-message.test.ts: ✅ All assertions passed");
