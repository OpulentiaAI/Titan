/**
 * Next.js API Route: Workflow-based Chat Endpoint
 * 
 * This file is for future Next.js migration.
 * When migrating to Next.js, place this in: app/api/chat/route.ts
 * 
 * Based on: https://useworkflow.dev/docs/api-reference/workflow-ai/workflow-chat-transport
 */

import { startWorkflow } from 'workflow';
import { streamText } from 'ai';
import { getWrappedAI } from '@/lib/ai-wrapped';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long-running workflows

export async function POST(request: Request) {
  try {
    const { messages, workflowRunId } = await request.json();

    // If resuming, use existing workflow run
    if (workflowRunId) {
      // Resume workflow stream (implementation depends on workflow SDK)
      const stream = await resumeWorkflowStream(workflowRunId);
      
      if (!stream) {
        return new Response('Workflow run not found', { status: 404 });
      }

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'x-workflow-run-id': workflowRunId,
        },
      });
    }

    // Start new workflow-based chat
    const workflowRunId = await startWorkflow(async () => {
      const { getWrappedAI } = await import('@/lib/ai-wrapped');
      const ai = await getWrappedAI();
      
      const result = await streamText({
        model: ai.model, // Use your model
        messages,
      });

      return result;
    });

    // Create response stream
    const stream = createChatStream(workflowRunId, messages);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'x-workflow-run-id': workflowRunId,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET endpoint for resuming interrupted streams
 * GET /api/chat/{runId}/stream
 */
export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const runId = params.runId;
    const stream = await resumeWorkflowStream(runId);

    if (!stream) {
      return new Response('Workflow run not found', { status: 404 });
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'x-workflow-run-id': runId,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Resume stream error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Create chat stream from workflow
 */
async function createChatStream(
  workflowRunId: string,
  messages: any[]
): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Run workflow and stream results
        // This is a simplified example - actual implementation would
        // use the workflow SDK's streaming capabilities
        
        controller.enqueue(
          encoder.encode(`data: {"type":"workflow_started","runId":"${workflowRunId}"}\n\n`)
        );

        // Stream workflow results
        // ... workflow execution logic ...

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        controller.enqueue(
          encoder.encode(`data: {"type":"error","error":"${errorMsg}"}\n\n`)
        );
        controller.close();
      }
    },
  });
}

/**
 * Resume workflow stream
 */
async function resumeWorkflowStream(
  runId: string
): Promise<ReadableStream | null> {
  // Implementation would use workflow SDK to resume stream
  // This is a placeholder
  return null;
}

