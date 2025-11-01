/**
 * Braintrust ingest preview (safe, non-prod)
 *
 * Reads tmp/production-validation task outputs (thread.json, performance.json),
 * aggregates results, and writes a local preview file that mirrors the payload
 * we would send to Braintrust spans/evals. No network calls; safe for prod.
 */

import * as fs from 'fs';
import * as path from 'path';

type Thread = { id?: string; messages?: any[] };
type Performance = { metrics?: Record<string, any>; summary?: Record<string, any> };

interface TaskRecord {
  taskId: string;
  thread?: Thread;
  performance?: Performance;
  workspacePkg?: any;
}

interface AggregateSummary {
  totalTasks: number;
  withThread: number;
  withPerformance: number;
  llmCalls?: number;
  userMessages?: number;
  avgExecutionTimeSec?: number;
  successRate?: number;
}

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, 'tmp', 'production-validation');

function safeReadJSON(filePath: string): any | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function findTaskDirs(): string[] {
  if (!fs.existsSync(TMP_DIR)) return [];
  return fs
    .readdirSync(TMP_DIR)
    .map((name) => path.join(TMP_DIR, name))
    .filter((p) => fs.statSync(p).isDirectory() && path.basename(p).startsWith('task-'));
}

function collectTasks(): TaskRecord[] {
  const taskDirs = findTaskDirs();
  const out: TaskRecord[] = [];
  for (const dir of taskDirs) {
    const taskId = path.basename(dir);
    const thread = safeReadJSON(path.join(dir, 'thread.json')) as Thread | undefined;
    const performance = safeReadJSON(path.join(dir, 'performance.json')) as Performance | undefined;
    const pkg = safeReadJSON(path.join(dir, 'workspace', 'package.json'));
    out.push({ taskId, thread, performance, workspacePkg: pkg });
  }
  return out;
}

function summarize(tasks: TaskRecord[]): AggregateSummary {
  const totalTasks = tasks.length;
  const withThread = tasks.filter((t) => !!t.thread).length;
  const withPerformance = tasks.filter((t) => !!t.performance).length;

  // Best-effort metrics if present in performance.json
  const execTimes: number[] = [];
  let successCount = 0;
  let totalOps = 0;
  let userMsgs = 0;
  let llmCalls = 0;

  for (const t of tasks) {
    const p = t.performance as any;
    if (p?.summary?.executionTimeSec) execTimes.push(Number(p.summary.executionTimeSec));
    if (p?.summary?.success) successCount += 1;
    if (p?.summary?.totalOperations) totalOps += Number(p.summary.totalOperations);
    if (p?.summary?.userMessages) userMsgs += Number(p.summary.userMessages);
    if (p?.summary?.llmCalls) llmCalls += Number(p.summary.llmCalls);
  }

  const avgExecutionTimeSec = execTimes.length
    ? Number((execTimes.reduce((a, b) => a + b, 0) / execTimes.length).toFixed(2))
    : undefined;
  const successRate = totalTasks ? Number(((successCount / totalTasks) * 100).toFixed(1)) : undefined;

  return {
    totalTasks,
    withThread,
    withPerformance,
    llmCalls,
    userMessages: userMsgs,
    avgExecutionTimeSec,
    successRate,
  };
}

function buildBraintrustPreview(tasks: TaskRecord[]) {
  // Represent what we would send as spans/events
  const spans = tasks.map((t) => ({
    name: 'production_validation_task',
    metadata: {
      taskId: t.taskId,
      threadId: (t.thread as any)?.id,
      messageCount: (t.thread as any)?.messages?.length ?? 0,
      performance: (t.performance as any)?.summary || (t.performance as any)?.metrics,
      workspaceName: t.workspacePkg?.name,
      workspaceVersion: t.workspacePkg?.version,
      timestamp: Date.now(),
    },
  }));

  return { type: 'braintrust_ingest_preview', createdAt: new Date().toISOString(), spans };
}

async function main() {
  const tasks = collectTasks();
  const summary = summarize(tasks);
  const preview = buildBraintrustPreview(tasks);

  const outDir = path.join(TMP_DIR);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const summaryPath = path.join(outDir, 'completed-tests-summary.enriched.json');
  const previewPath = path.join('test-kitchen', 'test-output', 'braintrust-ingest-preview.json');
  const previewDir = path.dirname(previewPath);
  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

  const payload = { summary, tasks: tasks.map((t) => ({ taskId: t.taskId, hasThread: !!t.thread, hasPerformance: !!t.performance })) };
  fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(previewPath, JSON.stringify(preview, null, 2));

  console.log('✅ Aggregated summary written to:', summaryPath);
  console.log('✅ Braintrust ingest preview written to:', previewPath);
}

main().catch((e) => {
  console.error('❌ Ingest preview failed:', e);
  process.exit(1);
});


