# Critical Tool Naming & Schema Fixes

## Issue 1: Tool Naming Inconsistency

### Current State (BROKEN):
- **Prompts use**: `type_text()`, `press_key()`, `key_combination()`
- **Schema allows**: `type`, (missing pressKey, keyCombo)
- **Code implements**: `type`, `pressKey`, `keyCombo`, `screenshot`, `hover`, `dragDrop`

### Impact:
- Agent calls undefined tool names → execution fails
- Planning schema too restrictive → can't plan advanced interactions
- Prompt examples mislead the AI → wrong tool calls

### Fix Strategy:
1. Standardize all tool names to camelCase (matches code)
2. Expand planning schema to include ALL available tools
3. Update all prompts to use correct tool names

## Available Tools (Complete List from sidepanel.tsx):

1. `navigate({ url: string })`
2. `click({ selector: string })`  OR  `click({ x: number, y: number })`
3. `type({ selector: string, text: string })`
4. `scroll({ direction: string, amount?: number })`
5. `wait({ seconds: number })`
6. `getPageContext()`
7. `screenshot()`
8. `pressKey({ key: string })`
9. `clearInput()`
10. `keyCombo({ keys: string[] })`
11. `hover({ x: number, y: number })`
12. `dragDrop({ x: number, y: number, destination_x: number, destination_y: number })`
13. `getBrowserHistory({ query?: string, maxResults?: number })`

## Files Requiring Updates:

### 1. `/home/user/Titan/lib/optimized-prompts.ts` (Lines 13-168)
**Changes:**
- `type_text` → `type`
- `press_key` → `pressKey`
- `key_combination` → `keyCombo`
- Add `screenshot`, `hover`, `dragDrop` tool descriptions

### 2. `/home/user/Titan/planner.ts` (Lines 90-91, 126-168)
**Changes:**
- Expand action enum from 6 tools to 13 tools
- Update system prompt tool names
- Remove references to `waitForElement` (not implemented)
- Add examples for advanced tools

### 3. `/home/user/Titan/workflows/browser-automation-workflow.ts` (Lines 626-900)
**Current State:** Tools correctly named (camelCase)
**No changes needed** - this is the reference implementation
