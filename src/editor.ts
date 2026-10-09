import { EditorSelection, Prec, StateEffect, StateField, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { fieldOf, opensBlock } from "./parse.ts";
import { expand, matchSnippet, type Match, type Range, type Snippet } from "./snippets.ts";

const OPEN_FENCE = /^\s*(`{3,}|~{3,})\s*algo\b/;
const ANY_FENCE = /^\s*(`{3,}|~{3,})/;

// Line index within the enclosing ```algo block (0 = first line after the fence), or -1 if outside.
function lineInAlgoBlock(doc: Text, lineNo: number): number {
  for (let n = lineNo - 1; n >= 1; n--) {
    const text = doc.line(n).text;
    if (!ANY_FENCE.test(text)) continue;
    return OPEN_FENCE.test(text) ? lineNo - n - 1 : -1;
  }
  return -1;
}

// The first three lines are title / input / output, and labelled header rows may follow.
function isStep(doc: Text, lineNo: number): boolean {
  return lineInAlgoBlock(doc, lineNo) >= 3 && !fieldOf(doc.line(lineNo).text);
}

// The tabstops of the snippet being filled in. `from`..`to` spans the whole expansion.
interface Session extends Range {
  stops: Range[][];
  active: number;
}

const setSession = StateEffect.define<Session | null>();
const tabstopMark = Decoration.mark({ class: "algo-tabstop" });

const sessionField = StateField.define<Session | null>({
  create: () => null,
  update(session, tr) {
    for (const e of tr.effects) if (e.is(setSession)) return e.value;
    if (!session) return null;
    if (tr.docChanged) {
      const map = (r: Range): Range => ({ from: tr.changes.mapPos(r.from, -1), to: tr.changes.mapPos(r.to, 1) });
      session = { ...session, ...map(session), stops: session.stops.map((group) => group.map(map)) };
    }
    // Moving the cursor out of the snippet ends it.
    const head = tr.state.selection.main.head;
    return head < session.from || head > session.to ? null : session;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (session) =>
      session
        ? Decoration.set(
            session.stops.flat().filter((r) => r.from < r.to).map((r) => tabstopMark.range(r.from, r.to)),
            true,
          )
        : Decoration.none,
    ),
});

const select = (group: Range[]) => EditorSelection.create(group.map((r) => EditorSelection.range(r.from, r.to)));

// Replaces the trigger that ends at `pos` and selects the first tabstop.
function expandSnippet(view: EditorView, match: Match, pos: number): void {
  const { state } = view;
  const indent = /^\s*/.exec(state.doc.lineAt(pos).text)![0];
  const { text, stops } = expand(match.snippet.replacement, match.groups, indent, state.facet(indentUnit) || "    ");
  const from = pos - match.length;
  const to = from + text.length;
  const shifted = stops.map((group) => group.map((r) => ({ from: from + r.from, to: from + r.to })));

  view.dispatch({
    changes: { from, to: pos, insert: text },
    selection: shifted.length ? select(shifted[0]) : { anchor: to },
    effects: setSession.of(shifted.length ? { from, to, stops: shifted, active: 0 } : null),
    scrollIntoView: true,
    // Not "input.type", so undo brings back the typed trigger in one step.
    userEvent: "input.snippet",
  });
}

function findSnippet(view: EditorView, pos: number, snippets: Snippet[], autoOnly: boolean): Match | null {
  const { doc } = view.state;
  const line = doc.lineAt(pos);
  const match = matchSnippet(snippets, line.text.slice(0, pos - line.from), line.text.slice(pos - line.from), autoOnly);
  return match && isStep(doc, line.number) ? match : null;
}

// Runs for every typed character: expand an auto snippet as soon as its trigger is complete.
export function expandOnInput(view: EditorView, from: number, to: number, text: string, snippets: Snippet[]): boolean {
  if (!snippets.length || view.composing || view.state.selection.ranges.length > 1) return false;
  const { doc } = view.state;
  const line = doc.lineAt(from);
  const before = line.text.slice(0, from - line.from) + text;
  const match = matchSnippet(snippets, before, doc.sliceString(to, Math.min(to + 1, doc.lineAt(to).to)), true);
  if (!match || !isStep(doc, line.number)) return false;

  const pos = from + text.length;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: pos }, userEvent: "input.type" });
  expandSnippet(view, match, pos);
  return true;
}

function moveStop(view: EditorView, dir: 1 | -1): boolean {
  const session = view.state.field(sessionField, false);
  if (!session) return false;
  const active = session.active + dir;
  if (active < 0) return true;
  const done = active >= session.stops.length;
  view.dispatch({
    selection: done ? { anchor: session.to } : select(session.stops[active]),
    effects: setSession.of(done ? null : { ...session, active }),
    scrollIntoView: true,
  });
  return true;
}

// Tab: expand the trigger before the cursor, else jump to the next tabstop, else leave Tab alone.
export function snippetTab(view: EditorView, snippets: Snippet[]): boolean {
  const sel = view.state.selection;
  if (snippets.length && sel.ranges.length === 1 && sel.main.empty) {
    const match = findSnippet(view, sel.main.head, snippets, false);
    if (match) {
      expandSnippet(view, match, sel.main.head);
      return true;
    }
  }
  return moveStop(view, 1);
}

export const snippetShiftTab = (view: EditorView) => moveStop(view, -1);

export function smartEnter(view: EditorView): boolean {
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.head);
  // While a snippet is being filled in, Enter accepts its values and continues after the line.
  const inSnippet = !!view.state.field(sessionField, false);
  if (!inSnippet && !sel.empty) return false;
  const pos = inSnippet ? line.to : sel.head;

  const idx = lineInAlgoBlock(view.state.doc, line.number);
  if (idx < 0) return false;

  const lead = /^\s*/.exec(line.text)![0];
  const before = line.text.slice(0, pos - line.from);
  // Mid-line, only a finished `... do` / `... then` pushes the rest of the line into the block.
  const midLine = line.text.slice(pos - line.from).trim() !== "";
  const opens = isStep(view.state.doc, line.number) && opensBlock(before, midLine);
  const insert = "\n" + lead + (opens ? view.state.facet(indentUnit) || "    " : "");

  view.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + insert.length },
    effects: setSession.of(null),
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

// `snippets` is read on every key press, so setting changes apply without reloading the editor.
export function algoEditor(snippets: () => Snippet[]): Extension {
  return [
    sessionField,
    Prec.highest(
      keymap.of([
        { key: "Tab", run: (view) => snippetTab(view, snippets()) },
        { key: "Shift-Tab", run: snippetShiftTab },
      ]),
    ),
    Prec.high(keymap.of([{ key: "Enter", run: smartEnter }])),
    EditorView.inputHandler.of((view, from, to, text) => expandOnInput(view, from, to, text, snippets())),
  ];
}
