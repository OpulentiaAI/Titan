# External Computer Use: Patterns, Prompts, and Tools — Assessment for Atlas

## Executive Summary
A reference open computer-use stack emphasizes deterministic tool contracts, tight coupling to a normalized viewport, conservative mouse/key semantics, and automatic visual verification via screenshots. Example orchestration samples pair these tools with model-specific system prompts and a streaming loop that checks instance health each step. The approach reduces jank and failure loops by: (1) scaling coordinates to a fixed frame, (2) chunking + delaying text input, (3) suppressing micro-moves, (4) returning screenshots consistently, and (5) validating after actions.

Atlas already adopted several analogous guarantees (always-on tool availability, first-step state verification, consistent result objects, follow-ups/todos, summarizer checks). We can still borrow two high-value themes for further reliability:

- Enforce a “verification-after-action” rule beyond navigation (we partly do this in the workflow; we should make it universal in the fallback path too).
- Normalize coordinate semantics (if/when coordinate clicks are used) and suppress micro-movements to reduce no-op churn.

## Sources Reviewed (anonymized)
- Reference OSS computer tool server (xdotool-backed)
- Example “computer-use playground” orchestration sample
- Browser / Cursor guidance (aligned with code patterns)

## Reference Computer Layer

Files: `computer/src/computer.py`, `computer/src/base.py`, `computer/README.md`

Key capabilities:
- Actions: MoveMouse, ClickMouse, DragMouse, Scroll, PressKey, TypeText, Wait, TakeScreenshot, GetCursorPosition.
- Implementation: xdotool + scrot/gnome-screenshot; returns `ToolResult(output, error, base64_image)` for consistent downstream consumption.
- Viewport normalization: scales between API frame and display using target dimensions (e.g., XGA/WXGA). Ensures model tooling “thinks” in a stable resolution while the host may vary.
- Micro-movement suppression: `_should_move_mouse` avoids moving the pointer within a small tolerance (≤5px), reducing noise and accidental oscillations.
- Text input stability: chunk typing with small per-character delay, then optional screenshot; helps dynamic UIs settle.
- Default screenshots: most actions capture a screenshot (configurable) to provide continuous state for models.

Reliability patterns observed:
- Deterministic returns (base64 screenshots on most actions) → predictable inputs for the model on the next step.
- Validations and explicit errors for invalid parameters (e.g., click button mapping, drag path length).
- Timing controls (sleep before screenshots, chunks for typing) to mitigate race conditions.

Applicability to Atlas:
- Our tools are extension-backed (selectors > coordinates). Still, adopting the same spirit improves reliability:
  - If coordinate clicks are used, scale to the current viewport and clamp bounds.
  - Avoid no-op micro moves (store last pointer position and skip tiny deltas).
  - Keep short waits + verification after actions (we do this for navigation; extend it to other actions in fallback).

## Reference Playground Orchestration

Files: `computer-use-playground/src/app/api/chat/route.ts`, `server/actions.ts`, `page.tsx`

Patterns:
- Tools vary by instance type:
  - Ubuntu: `computer`, `bash`, `edit`
  - Browser: `computer` only
- System prompts differ by model and instance type (provider- and environment-specific).
- Streaming with step hooks; health-check on each step (`getInstance`), aborting if the instance dies.
- Frontend visualizes tool calls/results and streams a live desktop.

Reliability themes:
- Model-specific, environment-specific system prompts (keeps the model grounded in the available toolset and constraints).
- Regular instance health checks prevent “zombie” loops.

Applicability to Atlas:
- We already use provider-aware prompts and strict tool instructions. Consider adding a lightweight “tab health” check before long steps (e.g., ensure active tab responds via a ping-like call) to reduce undetected disconnections.

## Documentation Signals (Browser, Cursor Rules)

From code and common practice (docs HTML not easily parsed here), the guidance aligns with:
- Prefer semantic selectors over coordinates; when coordinates are necessary, use a normalized frame.
- Verify state after every state-changing action (screenshot or DOM/context check).
- Use deliberate timing (small waits) post-action to allow rendering to complete.
- Keep tool contracts simple and explicit.

## Comparison to Atlas (Current)

What we already do well:
- Always-on tools at every step; no activeTools gating (streaming-step.ts).
- First-step `getPageContext` enforcement; summarized state verification; screenshot support via our extension.
- Consistent tool results + telemetry (`trackToolExecution`).
- Task scaffolding (`todo`), progress signals (`message_update`), and end-of-run choices (`follow_ups`) with clickable UI.
- Summarizer enforces task-completion heuristics and appends sources.

Gaps and targeted improvements:
- Universal post-action verification: In our workflow tools we verify after nav; ensure click/type/scroll in the fallback path always follow with `getPageContext` or a quick screenshot+context.
- Coordinate semantics: If the agent emits coordinate-based clicks, implement viewport scaling + bounds checks, and suppress micro-moves.
- Timing discipline: Small per-action waits (e.g., 250–500ms) when the page is likely to reflow.
- Health checks: Add a quick “tab reachability” check in long loops to avoid silent failures.

## Recommended Concrete Changes for Atlas

1) Enforce verification-after-action in streaming fallback
- In `steps/streaming-step.ts` fallback tool executes, wrap `click`, `type`, `scroll`, `pressKey` to (a) perform the action, then (b) call `getPageContext` with a short wait (200–400ms). We already added these wrappers for navigation in the workflow; mirror for the fallback path to guarantee verification even outside the workflow.

2) Coordinate normalization (optional)
- If we add/expand coordinate-based actions, normalize by current viewport:
  - Scale/clamp coordinates to `viewport.width/height` (from `getPageContext`).
  - Skip mouse moves within a 3–5px threshold (cache last cursor position in memory for the turn).

3) Typing stability
- Introduce a short inter-character delay for very long text inputs or chunk by 50–100 chars if the host page is known to reflow aggressively.

4) Health-check hook
- Before each streaming step, ping the tab (e.g., a no-op `getPageContext`) and fail fast if unavailable; surface a clear UI message.

5) Prompt addendum (done)
- We have updated system prompts to include structured task tools (todo/message_update/follow_ups) and stronger execution guidance. Keep this aligned with model/provider.

## Quick Mapping Table

- Screenshots after actions → Atlas: prefer `getPageContext` post-action; supplement with screenshot when needed.
- Scaling coords → Atlas: selectors first; if coords used, scale & clamp (future hook).
- Micro-move suppression → Atlas: optional enhancement for coordinate clicks.
- Chunk typing → Atlas: minor delay/chunk for long inputs (feature flag).
- Instance health checks → Atlas: quick tab reachability before each step.

## Conclusion
The referenced reliability approach comes from enforcing a stable perception loop (normalized viewport + screenshot returns) and simple, explicit contracts. Atlas can meet or exceed this by universalizing “verify-after-action,” optionally adopting coordinate scaling if needed, and adding a tab health check. Our additions (todo, message_update, follow_ups) further improve operator visibility and human-in-the-loop control.
