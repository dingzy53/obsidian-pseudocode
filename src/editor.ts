import {
  EditorSelection,
  Prec,
  StateEffect,
  StateField,
  type ChangeDesc,
  type Extension,
  type EditorState,
  type Text,
} from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { findFences } from "./link.ts";
import { fieldOf, isSeparator, opensBlock } from "./parse.ts";
import { expand, matchSnippet, type Match, type Range, type Snippet } from "./snippets.ts";

// The algo-aware view of a line: whether it sits in a fenced block, and which row of its header it is.
// `index` counts lines from the opening fence, or from the last separator of a class block (0 = first line).
function blockAt(doc: Text, lineNo: number): { algo: boolean; index: number } | null {
  const fences = findFences(doc.iterLines(1, lineNo));
  const fence = fences[fences.length - 1];
  if (!fence || fence.close !== null) return null;
  let start = fence.open + 1;
  for (let n = start + 1; n < lineNo; n++) if (isSeparator(doc.line(n).text)) start = n;
  return { algo: fence.algo, index: lineNo - start - 1 };
}

// Finds the snippet to expand on line `lineNo`. Most snippets belong inside an algo block.
// Those marked for the note run in plain text only, never inside any code block.
function findMatch(doc: Text, lineNo: number, before: string, after: string, snippets: Snippet[], autoOnly: boolean) {
  let block: ReturnType<typeof blockAt> | undefined;
  return matchSnippet(snippets, before, after, autoOnly, (snippet) => {
    // Looked up only once a trigger has matched: it reads the note from the top.
    if (block === undefined) block = blockAt(doc, lineNo);
    return snippet.note ? !block : !!block?.algo;
  });
}

// The snippet being filled in. `to` is where it ends, `parent` the snippet it was expanded inside.
interface Session {
  stops: Range[][];
  active: number;
  to: number;
  parent: Session | null;
}

const setSession = StateEffect.define<Session | null>();
const tabstopMark = Decoration.mark({ class: "algo-tabstop" });

const within = (group: Range[], from: number, to: number) => group.some((r) => from >= r.from && to <= r.to);

function mapSession(session: Session, changes: ChangeDesc): Session {
  return {
    active: session.active,
    stops: session.stops.map((group) =>
      group.map((r) => ({ from: changes.mapPos(r.from, -1), to: changes.mapPos(r.to, 1) })),
    ),
    to: changes.mapPos(session.to, 1),
    parent: session.parent && mapSession(session.parent, changes),
  };
}

const sessionField = StateField.define<Session | null>({
  create: () => null,
  update(session, tr) {
    for (const e of tr.effects) if (e.is(setSession)) return e.value;
    if (!session) return null;
    // A snippet lasts only while its current value is being typed. Undo, an edit elsewhere or
    // moving the cursor away ends it, so Tab never jumps to a place that no longer exists.
    if (tr.isUserEvent("undo") || tr.isUserEvent("redo")) return null;
    if (tr.docChanged) {
      const active = session.stops[session.active];
      let inside = true;
      tr.changes.iterChangedRanges((from, to) => {
        if (!within(active, from, to)) inside = false;
      });
      if (!inside) return null;
      session = mapSession(session, tr.changes);
    }
    const active = session.stops[session.active];
    return tr.state.selection.ranges.every((r) => within(active, r.from, r.to)) ? session : null;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (session) => {
      const marks = [];
      for (let s = session; s; s = s.parent) {
        for (const r of s.stops.flat()) if (r.from < r.to) marks.push(tabstopMark.range(r.from, r.to));
      }
      return Decoration.set(marks, true);
    }),
});

const select = (group: Range[]) => EditorSelection.create(group.map((r) => EditorSelection.range(r.from, r.to)));

// Nothing is left to do on a last tabstop that is empty: typing there is just typing.
const finished = (session: Session) =>
  !session.parent &&
  session.active === session.stops.length - 1 &&
  session.stops[session.active].every((r) => r.from === r.to);

// Replaces the trigger that ends at `pos` and selects the first tabstop.
function expandSnippet(view: EditorView, match: Match, pos: number): void {
  const { state } = view;
  const indent = /^\s*/.exec(state.doc.lineAt(pos).text)![0];
  const { text, stops } = expand(match.snippet.replacement, match.groups, indent, state.facet(indentUnit) || "    ");
  const from = pos - match.length;
  const to = from + text.length;
  const changes = state.changes({ from, to: pos, insert: text });
  // Expanding inside a tabstop of another snippet: come back to that one afterwards.
  const outer = state.field(sessionField, false);
  const session: Session | null = stops.length
    ? {
        stops: stops.map((group) => group.map((r) => ({ from: from + r.from, to: from + r.to }))),
        active: 0,
        to,
        parent: outer ? mapSession(outer, changes) : null,
      }
    : null;

  view.dispatch({
    changes,
    selection: session ? select(session.stops[0]) : { anchor: to },
    effects: session && !finished(session) ? setSession.of(session) : [],
    scrollIntoView: true,
    // Not "input.type", so undo brings back the typed trigger in one step.
    userEvent: "input.snippet",
  });
}

function findSnippet(view: EditorView, pos: number, snippets: Snippet[], autoOnly: boolean): Match | null {
  const { doc } = view.state;
  const line = doc.lineAt(pos);
  const col = pos - line.from;
  return findMatch(doc, line.number, line.text.slice(0, col), line.text.slice(col), snippets, autoOnly);
}

// Runs for every typed character: expand an auto snippet as soon as its trigger is complete.
export function expandOnInput(view: EditorView, from: number, to: number, text: string, snippets: Snippet[]): boolean {
  if (!snippets.length || view.composing || view.state.selection.ranges.length > 1) return false;
  const { doc } = view.state;
  const line = doc.lineAt(from);
  const before = line.text.slice(0, from - line.from) + text;
  const after = doc.sliceString(to, Math.min(to + 1, doc.lineAt(to).to));
  const match = findMatch(doc, line.number, before, after, snippets, true);
  if (!match) return false;

  const pos = from + text.length;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: pos }, userEvent: "input.type" });
  expandSnippet(view, match, pos);
  return true;
}

// Expands an auto snippet whose trigger is already in the document, right before the cursor.
// Text from an input method arrives this way: it is composed first and never passes `expandOnInput`.
export function expandAtCursor(view: EditorView, snippets: Snippet[]): boolean {
  const sel = view.state.selection;
  if (!snippets.length || view.composing || sel.ranges.length > 1 || !sel.main.empty) return false;
  const match = findSnippet(view, sel.main.head, snippets, true);
  if (match) expandSnippet(view, match, sel.main.head);
  return !!match;
}

function gotoStop(view: EditorView, session: Session, active: number): void {
  const next: Session = { ...session, active };
  view.dispatch({
    selection: select(next.stops[active]),
    effects: setSession.of(finished(next) ? null : next),
    scrollIntoView: true,
  });
}

function moveStop(view: EditorView, dir: 1 | -1): boolean {
  let session = view.state.field(sessionField, false) ?? null;
  if (!session) return false;
  let active = session.active + dir;
  if (active < 0) return true;
  // Past the last value: carry on with the snippet this one was expanded inside, if any.
  while (active >= session.stops.length) {
    if (!session.parent) {
      view.dispatch({ selection: { anchor: session.to }, effects: setSession.of(null), scrollIntoView: true });
      return true;
    }
    session = session.parent;
    active = session.active + 1;
  }
  gotoStop(view, session, active);
  return true;
}

// The snippet already made the empty line that Enter would make: the first value that is not on this line
// sits alone on the line right below. Returns its number, or -1 when Enter should make the line itself.
function bodyStop(state: EditorState, session: Session, lineNo: number): number {
  const { doc } = state;
  for (let i = session.active + 1; i < session.stops.length; i++) {
    const at = doc.lineAt(session.stops[i][0].from);
    if (session.stops[i].every((r) => doc.lineAt(r.from).number === lineNo)) continue;
    return at.number === lineNo + 1 && !at.text.trim() ? i : -1;
  }
  return -1;
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

  const block = blockAt(view.state.doc, line.number);
  if (!block?.algo) return false;
  // The first three lines are title / input / output, and labelled header rows may follow.
  const step = block.index >= 3 && !fieldOf(line.text);
  // A header row is one line: there, Enter moves on to the next value of the snippet instead.
  if (inSnippet && !step && moveStop(view, 1)) return true;
  if (inSnippet && step) {
    const session = view.state.field(sessionField, false)!;
    const body = bodyStop(view.state, session, line.number);
    if (body >= 0) {
      gotoStop(view, session, body);
      return true;
    }
  }

  const lead = /^\s*/.exec(line.text)![0];
  const before = line.text.slice(0, pos - line.from);
  // Mid-line, only a finished `... do` / `... then` pushes the rest of the line into the block.
  const midLine = line.text.slice(pos - line.from).trim() !== "";
  const opens = step && opensBlock(before, midLine);
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
    EditorView.domEventHandlers({
      compositionend(_event, view) {
        // Wait until the editor has taken in the composed text.
        window.setTimeout(() => expandAtCursor(view, snippets()), 0);
        return false;
      },
    }),
  ];
}
