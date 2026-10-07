import test from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { smartEnter } from "../src/editor.ts";

// Minimal stand-in for EditorView: enough for smartEnter (state + dispatch).
function press(doc: string, cursorMarker = "|"): string {
  const pos = doc.indexOf(cursorMarker);
  let state = EditorState.create({
    doc: doc.replace(cursorMarker, ""),
    selection: { anchor: pos },
    extensions: [indentUnit.of("    ")],
  });
  const view = { get state() { return state; }, dispatch(spec: any) { state = state.update(spec).state; } };
  const handled = smartEnter(view as any);
  const head = state.selection.main.head;
  const text = state.doc.toString();
  return (handled ? "H:" : "D:") + text.slice(0, head) + "|" + text.slice(head);
}

const block = (body: string) => "```algo\nSort\nInput: A\nOutput: A\n" + body + "\n```";

test("indents after do / then / else", () => {
  assert.match(press(block("while x do|")), /do\n {4}\|/);
  assert.match(press(block("    if x then|")), /then\n {8}\|/);
  assert.match(press(block("else|")), /else\n {4}\|/);
});

test("keeps indent otherwise", () => {
  assert.match(press(block("    x <- 1|")), /1\n {4}\|/);
  assert.match(press(block("x <- 1|")), /1\n\|/);
});

test("header lines never indent", () => {
  assert.match(press("```algo\nSort|\nInput: A\nOutput: A\n```"), /^H:```algo\nSort\n\|/);
  assert.match(press("```algo\nSort\nInput:|\nOutput: A\n```"), /Input:\n\|/);
});

test("mid-line split carries the rest down", () => {
  assert.match(press(block("while| x do")), /while\n\| x do/);
});

test("outside algo blocks falls through to default Enter", () => {
  assert.ok(press("hello do|").startsWith("D:"));
  assert.ok(press("```python\nwhile x do|\n```").startsWith("D:"));
  assert.ok(press(block("x") + "\nafter do|").startsWith("D:"));
});

test("on the fence line itself is outside", () => {
  assert.ok(press("```algo|\nSort\n```").startsWith("D:"));
});
