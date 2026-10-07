import { Prec } from "@codemirror/state";
import { keymap, type EditorView } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { opensBlock } from "./parse.ts";

const OPEN_FENCE = /^\s*(`{3,}|~{3,})\s*algo\b/;
const ANY_FENCE = /^\s*(`{3,}|~{3,})/;

// Line index within the enclosing ```algo block (0 = first line after the fence), or -1 if outside.
function lineInAlgoBlock(view: EditorView, lineNo: number): number {
  const doc = view.state.doc;
  for (let n = lineNo - 1; n >= 1; n--) {
    const text = doc.line(n).text;
    if (!ANY_FENCE.test(text)) continue;
    return OPEN_FENCE.test(text) ? lineNo - n - 1 : -1;
  }
  return -1;
}

export function smartEnter(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (!sel.empty) return false;

  const line = view.state.doc.lineAt(sel.head);
  const idx = lineInAlgoBlock(view, line.number);
  if (idx < 0) return false;

  const lead = /^\s*/.exec(line.text)![0];
  const before = line.text.slice(0, sel.head - line.from);
  // The first three lines are title / input / output: never indent after them.
  const extra = idx >= 3 && opensBlock(before) ? view.state.facet(indentUnit) || "    " : "";
  const insert = "\n" + lead + extra;

  view.dispatch({
    changes: { from: sel.head, insert },
    selection: { anchor: sel.head + insert.length },
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

export const algoEnter = Prec.high(keymap.of([{ key: "Enter", run: smartEnter }]));
