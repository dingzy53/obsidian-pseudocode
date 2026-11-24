# PLAN: QA audit fixes (plain-pseudocode)

> Branch: `fix/qa-audit-fixes` (from `fix/codemirror-peer-deps`) · Date: 2026-11-24 · Status: Implemented and verified.

## Scope from `OBSIDIAN_PLUGINS_QA_REPORT.md`

- **P3 / Snippet & command UX**:
  - Remove the trailing space in the `mk` snippet replacement (`"$${0}$$1"` instead of `"$${0}$ $1"`) so leaving math via Tab does not insert an extra space (`src/snippets.ts`, `README.md`, `test/snippets.test.ts`).
  - Make **Insert pseudocode block** never split a non-empty line mid-word and always surround inserted blocks with blank lines (`src/link.ts`, `src/main.ts`, `test/link.test.ts`).
  - Replace raw V8 `JSON.parse` errors in snippet settings with a clear user-facing syntax message (`src/snippets.ts`, `test/snippets.test.ts`).
  - Require Tab (drop `A`) on the inside-block `algo` snippet (`{ "trigger": "algo", ..., "options": "b" }`) so typing `algo ` inside an algorithm never silently converts it into a class block (`src/snippets.ts`, `README.md`, `test/snippets.test.ts`).
- **Wording & spelling consistency**:
  - Change `"Restore default"` to `"Restore defaults"` under Snippets (`src/settings-tab.ts`).
  - Normalize British spelling to US English across `manifest.json`, `package.json`, and `README.md` (including `#colors` anchors).

## Order of Work

1. `[x]` Update default snippets and friendly JSON parse errors (`src/snippets.ts`) plus tests (`test/snippets.test.ts`).
2. `[x]` Extract and wire pure `insertAlgoBlock` (`src/link.ts`, `src/main.ts`) plus tests (`test/link.test.ts`).
3. `[x]` Update settings button text (`src/settings-tab.ts`) and US English wording/anchors (`manifest.json`, `package.json`, `README.md`).
4. `[x]` Run `npm run lint && npm test && npm run build`, mark plan verified, and push `fix/qa-audit-fixes`.
