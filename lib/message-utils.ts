import type { Message } from "../types";
import { convertTasks } from "./task-manager";

type WorkflowOutput = any; // Keep flexible to avoid import churn in tests

function classifyOutcome(workflowOutput: WorkflowOutput) {
  const steps: Array<{ action?: string; success?: boolean }> =
    (workflowOutput?.executionTrajectory as any[]) || [];
  const total = steps.length;
  const successCount = steps.filter((s) => s.success).length;
  const failureCount = steps.filter((s) => s.success === false).length;
  const hadFailures = failureCount > 0;
  const navSuccess = steps.some(
    (s) => (s.action || "").toLowerCase().includes("nav") && s.success === true
  );
  const pageContextAvailable = !!workflowOutput?.pageContext?.url;

  let status: "success" | "partial" | "failed" = "failed";
  if (pageContextAvailable && !hadFailures) status = "success";
  else if (navSuccess || pageContextAvailable) status = "partial";

  return {
    status,
    total,
    successCount,
    failureCount,
    hadFailures,
    navSuccess,
    pageContextAvailable,
  };
}

function statusEmoji(status: string) {
  return status === "success" ? "✅" : status === "partial" ? "⚠️" : "❌";
}

export function buildFinalSummaryMessage(workflowOutput: WorkflowOutput): Message {
  const outcome = classifyOutcome(workflowOutput);
  const statusLine = `${statusEmoji(outcome.status)} Status: ${
    outcome.status.charAt(0).toUpperCase() + outcome.status.slice(1)
  }`;
  const stepsLine = `Steps: ${outcome.total} total — ${outcome.successCount} success, ${outcome.failureCount} failed`;
  const finalUrl = workflowOutput?.finalUrl || workflowOutput?.pageContext?.url || "N/A";
  const duration = typeof workflowOutput?.totalDuration === "number" ? `${workflowOutput.totalDuration}ms` : "N/A";
  const hasSummary = !!workflowOutput?.summarization?.summary;

  const topline = hasSummary
    ? workflowOutput.summarization.summary
    : outcome.status === "success"
      ? "Execution completed successfully and page context is available."
      : outcome.status === "partial"
        ? "Execution partially completed. Some required steps were omitted or failed."
        : "Execution did not complete as requested. Review the steps and retry.";

  const recommendations = (() => {
    if (outcome.status === "success") {
      return "Next Steps:\n- Proceed with analysis/report consumption.\n- Optionally capture a screenshot for audit.";
    }
    if (outcome.status === "partial") {
      return "Next Steps:\n- Confirm the page context is gathered after navigation.\n- Add an explicit verification step for the natural language report.\n- Re-run with improved checks for required elements.";
    }
    return "Next Steps:\n- Verify target URL and connectivity.\n- Add error handling + retry on navigation.\n- Skip dependent steps when the page is not ready.\n- Re-run the full flow after adjustments.";
  })();

  const taskCompleted = outcome.status === "success" ? "YES" : "NO";

  const content = [
    "---",
    "## Summary & Next Steps",
    "",
    statusLine,
    stepsLine,
    `Final URL: ${finalUrl}`,
    `Duration: ${duration}`,
    "",
    topline,
    "",
    recommendations,
    "",
    `TASK_COMPLETED: ${taskCompleted}`,
  ].join("\n");

  const msg: Message = {
    id: `summary-final-${Date.now()}`,
    role: "assistant",
    content,
    summarization: workflowOutput?.summarization,
    executionTrajectory: workflowOutput?.executionTrajectory,
    pageContext: workflowOutput?.pageContext,
    workflowMetadata: {
      workflowId: workflowOutput?.metadata?.workflowId,
      totalDuration: workflowOutput?.totalDuration,
      finalUrl: workflowOutput?.finalUrl,
    },
    workflowTasks: workflowOutput?.taskManager
      ? convertTasks(workflowOutput.taskManager.getAllTasks()).map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status === "cancelled" || t.status === "retrying" ? ("pending" as const) : t.status,
        }))
      : undefined,
  } as Message;

  return msg;
}
