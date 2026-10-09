import test from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { algoEditor, expandAtCursor, expandOnInput, smartEnter, snippetShiftTab, snippetTab } from "../src/editor.ts";
import { parseSnippets, DEFAULT_SNIPPETS } from "../src/snippets.ts";

// Minimal stand-in for EditorView: state + dispatch, which is all the handlers use.
function editor(doc: string, cursorMarker = "|") {
  const pos = doc.indexOf(cursorMarker);
  let state = EditorState.create({
    doc: doc.replace(cursorMarker, ""),
    selection: { anchor: pos },
    extensions: [indentUnit.of("    "), EditorState.allowMultipleSelections.of(true), algoEditor(() => [])],
  });
  const view: any = { get state() { return state; }, dispatch(spec: any) { state = state.update(spec).state; } };
  return {
    view,
    // Types like a keyboard would: one character at a time, through the snippet handler first.
    type(text: string, snippets = DEFAULTS) {
      for (const ch of text) {
        const ranges = state.selection.ranges;
        if (ranges.length === 1 && expandOnInput(view, ranges[0].from, ranges[0].to, ch, snippets)) continue;
        view.dispatch(state.replaceSelection(ch));
      }
    },
    // The document with [..] around every selection range and | at an empty cursor.
    show() {
      let text = state.doc.toString();
      for (const r of [...state.selection.ranges].reverse()) {
        text = text.slice(0, r.from) + (r.empty ? "|" : `[${text.slice(r.from, r.to)}]`) + text.slice(r.to);
      }
      return text;
    },
  };
}

const DEFAULTS = parseSnippets(DEFAULT_SNIPPETS).snippets;
const snippets = (json: string) => {
  const { snippets, error } = parseSnippets(json);
  assert.equal(error, null);
  return snippets;
};

function press(doc: string): string {
  const e = editor(doc);
  const handled = smartEnter(e.view);
  return (handled ? "H:" : "D:") + e.show();
}

// The step lines of the block, as `show` prints them.
const steps = (shown: string) => shown.split("\n").slice(4, -1).join("\n");

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

test("header lines never indent, labelled rows included", () => {
  assert.match(press("```algo\nSort\nInput: A\nOutput: A\nData:|\n```"), /Data:\n\|/);
});

test("indents after a loop header without do", () => {
  assert.match(press(block("for i from 1 to n|")), /to n\n {4}\|/);
  assert.match(press(block("    while x > 0|")), /0\n {8}\|/);
});

test("default snippet: for + space expands and Tab walks the values", () => {
  const e = editor(block("    |"));
  e.type("for ");
  assert.equal(steps(e.show()), "    for [i] from 1 to n");
  e.type("k");
  assert.ok(snippetTab(e.view, DEFAULTS));
  assert.equal(steps(e.show()), "    for k from [1] to n");
  assert.ok(snippetTab(e.view, DEFAULTS));
  assert.equal(steps(e.show()), "    for k from 1 to [n]");
  assert.ok(snippetShiftTab(e.view));
  assert.equal(steps(e.show()), "    for k from [1] to n");
  e.type("0");
  snippetTab(e.view, DEFAULTS);
  e.type("m-1");
  assert.ok(snippetTab(e.view, DEFAULTS));
  assert.equal(steps(e.show()), "    for k from 0 to m-1|");
  // The snippet is finished: Tab is free again for indenting.
  assert.equal(snippetTab(e.view, DEFAULTS), false);
});

test("default snippet: for + Tab expands too, without the space", () => {
  const e = editor(block("    |"));
  e.type("for");
  assert.equal(steps(e.show()), "    for|");
  assert.ok(snippetTab(e.view, DEFAULTS));
  assert.equal(steps(e.show()), "    for [i] from 1 to n");

  const other = editor(block("|"));
  other.type("foreach");
  assert.equal(snippetTab(other.view, DEFAULTS), false);
});

test("default snippet leaves other words and places alone", () => {
  const typed = (doc: string, text: string) => {
    const e = editor(doc);
    e.type(text);
    return e.show();
  };
  assert.equal(steps(typed(block("|"), "foreach x ")), "foreach x |");
  assert.equal(steps(typed(block("|"), "forall ")), "forall |");
  assert.equal(steps(typed(block("wait |"), "for ")), "wait for |");
  assert.equal(steps(typed(block("x // |"), "for ")), "x // for |");
  assert.equal(typed("|", "for "), "for |");
  assert.equal(typed("|", "mk"), "mk|");
  assert.equal(typed("```python\n|\n```", "for "), "```python\nfor |\n```");
  assert.equal(typed(block("x") + "\n|", "for "), block("x") + "\nfor |");
});

test("snippets work on every line of the block, header and comments included", () => {
  const typed = (doc: string, text: string) => {
    const e = editor(doc);
    e.type(text);
    return e.show();
  };
  assert.equal(typed("```algo\n|\n```", "for "), "```algo\nfor [i] from 1 to n\n```");
  assert.equal(typed("```algo\nSort\nInput: array |\nOutput: A\n```", "mk"), "```algo\nSort\nInput: array $|$ \nOutput: A\n```");
  assert.equal(steps(typed(block("x <- 1 // |"), "mk")), "x <- 1 // $|$ ");
});

test("default snippet: mk makes inline math and Tab leaves it", () => {
  const e = editor(block("x <- |"));
  e.type("mk");
  assert.equal(steps(e.show()), "x <- $|$ ");
  e.type("a_i");
  assert.ok(snippetTab(e.view, DEFAULTS));
  assert.equal(steps(e.show()), "x <- $a_i$ |");
  // Nothing is left to fill in, so Tab is free again and typing is just typing.
  assert.equal(snippetTab(e.view, DEFAULTS), false);
  e.type("+ 1");
  assert.equal(steps(e.show()), "x <- $a_i$ + 1|");
});

test("mk does not fire inside math", () => {
  const e = editor(block("x <- $|$"));
  e.type("mk");
  assert.equal(steps(e.show()), "x <- $mk|$");
});

test("a snippet inside a tabstop of another: Tab returns to the outer one", () => {
  const e = editor(block("|"));
  e.type("for mk");
  assert.equal(steps(e.show()), "for $|$  from 1 to n");
  e.type("i");
  snippetTab(e.view, DEFAULTS);
  assert.equal(steps(e.show()), "for $i$ | from 1 to n");
  snippetTab(e.view, DEFAULTS);
  assert.equal(steps(e.show()), "for $i$  from [1] to n");
  snippetTab(e.view, DEFAULTS);
  assert.equal(steps(e.show()), "for $i$  from 1 to [n]");
  snippetTab(e.view, DEFAULTS);
  assert.equal(snippetTab(e.view, DEFAULTS), false);
});

test("editing outside the current value ends the snippet", () => {
  // Undoing or deleting the expansion must not leave tabstops behind for Tab to jump to.
  const deleted = editor(block("|"));
  deleted.type("for ");
  const line = deleted.view.state.doc.line(5);
  deleted.view.dispatch({ changes: { from: line.from, to: line.to, insert: "for x in S:" }, selection: { anchor: line.from + 11 } });
  assert.equal(snippetTab(deleted.view, DEFAULTS), false);
  assert.equal(steps(deleted.show()), "for x in S:|");

  const elsewhere = editor(block("|"));
  elsewhere.type("for k");
  elsewhere.view.dispatch({ changes: { from: elsewhere.view.state.doc.line(5).to, insert: ":" } });
  assert.equal(snippetTab(elsewhere.view, DEFAULTS), false);

  const undone = editor(block("|"));
  undone.type("for k");
  snippetTab(undone.view, DEFAULTS);
  undone.type("0");
  const pos = undone.view.state.selection.main.head;
  undone.view.dispatch({ changes: { from: pos - 1, to: pos }, userEvent: "undo" });
  assert.equal(snippetTab(undone.view, DEFAULTS), false);
});

test("moving the cursor out of the current value ends the snippet", () => {
  const e = editor(block("|"));
  e.type("for ");
  e.view.dispatch({ selection: { anchor: e.view.state.doc.line(5).to } });
  assert.equal(snippetTab(e.view, DEFAULTS), false);
});

test("a trigger that is already in the document expands too (input methods)", () => {
  const e = editor(block("    for |"));
  assert.ok(expandAtCursor(e.view, DEFAULTS));
  assert.equal(steps(e.show()), "    for [i] from 1 to n");
  assert.equal(expandAtCursor(e.view, DEFAULTS), false);

  assert.equal(expandAtCursor(editor(block("wait for |")).view, DEFAULTS), false);
  assert.equal(expandAtCursor(editor("for |").view, DEFAULTS), false);
});

test("leaving the snippet ends it", () => {
  const e = editor(block("|\nnext"));
  e.type("for ");
  e.view.dispatch({ selection: { anchor: e.view.state.doc.length } });
  assert.equal(snippetTab(e.view, DEFAULTS), false);
});

test("Enter ends the snippet", () => {
  const e = editor(block("|"));
  e.type("for ");
  snippetTab(e.view, DEFAULTS);
  snippetTab(e.view, DEFAULTS);
  snippetTab(e.view, DEFAULTS);
  assert.ok(smartEnter(e.view));
  assert.equal(steps(e.show()), "for i from 1 to n\n    |");
  assert.equal(snippetTab(e.view, DEFAULTS), false);
});

test("Enter while filling in a snippet keeps the values and the line whole", () => {
  const untouched = editor(block("|"));
  untouched.type("for ");
  assert.ok(smartEnter(untouched.view));
  assert.equal(steps(untouched.show()), "for i from 1 to n\n    |");

  const typed = editor(block("    |"));
  typed.type("for k");
  assert.ok(smartEnter(typed.view));
  assert.equal(steps(typed.show()), "    for k from 1 to n\n        |");
  assert.equal(snippetTab(typed.view, DEFAULTS), false);
});

test("Enter with a selection outside a snippet is left to the editor", () => {
  const e = editor(block("abc|"));
  e.view.dispatch({ selection: { anchor: e.view.state.selection.main.head - 2, head: e.view.state.selection.main.head } });
  assert.equal(smartEnter(e.view), false);
});

test("Tab-triggered snippet with new lines and indentation", () => {
  const list = snippets('[{ "trigger": "ife", "replacement": "if ${0:cond} then\\n\\t$1\\nelse\\n\\t$2", "options": "b" }]');
  const e = editor(block("    |"));
  e.type("ife", list);
  assert.equal(steps(e.show()), "    ife|");
  assert.ok(snippetTab(e.view, list));
  assert.equal(steps(e.show()), "    if [cond] then\n        \n    else\n        ");
  e.type("x", list);
  snippetTab(e.view, list);
  assert.equal(steps(e.show()), "    if x then\n        |\n    else\n        ");
});

test("tabstops with the same number are edited together", () => {
  const list = snippets('[{ "trigger": "sw ", "replacement": "swap A[${0:i}] and A[${1:j}] // was A[$0]", "options": "A" }]');
  const e = editor(block("|"));
  e.type("sw ", list);
  assert.equal(steps(e.show()), "swap A[[i]] and A[j] // was A[[i]]");
  e.type("lo", list);
  snippetTab(e.view, list);
  assert.equal(steps(e.show()), "swap A[lo] and A[[j]] // was A[lo]");
});

test("regex trigger with a capture group", () => {
  const list = snippets('[{ "trigger": "([A-Za-z])(\\\\d)", "replacement": "[[0]]_[[1]]", "options": "Ar" }]');
  const e = editor(block("|"));
  e.type("x <- a1", list);
  assert.equal(steps(e.show()), "x <- a_1|");
});

test("default snippet: algo + space in the note makes a block, Enter walks the header", () => {
  const e = editor("Some text\n|\nmore");
  e.type("algo ");
  assert.equal(e.show(), "Some text\n```algo\n|\nInput: \nOutput: \n\n```\nmore");
  e.type("Sort");
  assert.ok(smartEnter(e.view));
  assert.equal(e.show(), "Some text\n```algo\nSort\nInput: |\nOutput: \n\n```\nmore");
  e.type("array mk");
  e.type("A");
  assert.ok(smartEnter(e.view));
  assert.ok(smartEnter(e.view));
  assert.equal(e.show(), "Some text\n```algo\nSort\nInput: array $A$ \nOutput: |\n\n```\nmore");
  e.type("sorted");
  assert.ok(smartEnter(e.view));
  assert.equal(e.show(), "Some text\n```algo\nSort\nInput: array $A$ \nOutput: sorted\n|\n```\nmore");
  // The block is set up: from here on Enter and Tab are the usual ones.
  e.type("while x do");
  assert.ok(smartEnter(e.view));
  assert.equal(snippetTab(e.view, DEFAULTS), false);
  assert.match(e.show(), /while x do\n {4}\|\n```\nmore$/);
});

test("algo + Tab works too, and Tab walks the header", () => {
  const e = editor("|");
  e.type("algo");
  assert.ok(snippetTab(e.view, DEFAULTS));
  assert.equal(e.show(), "```algo\n|\nInput: \nOutput: \n\n```");
  snippetTab(e.view, DEFAULTS);
  snippetTab(e.view, DEFAULTS);
  assert.equal(e.show(), "```algo\n\nInput: \nOutput: |\n\n```");
  snippetTab(e.view, DEFAULTS);
  assert.equal(e.show(), "```algo\n\nInput: \nOutput: \n|\n```");
});

test("the block shortcut only runs in the note text, at the start of a line", () => {
  const typed = (doc: string, text: string) => {
    const e = editor(doc);
    e.type(text);
    return e.show();
  };
  assert.equal(typed("the |", "algo "), "the algo |");
  assert.equal(typed("|", "algorithm "), "algorithm |");
  assert.equal(steps(typed(block("|"), "algo ")), "algo |");
  assert.equal(typed("```python\n|\n```", "algo "), "```python\nalgo |\n```");
  assert.equal(typed("```\n|\n```", "algo "), "```\nalgo |\n```");
  // After a closed block the note text starts again.
  assert.match(typed("```python\nx\n```\n|", "algo "), /^```python\nx\n```\n```algo\n\|\nInput: /);
});

test("a fence inside a longer fence does not start a block", () => {
  // Four backticks wrap an example: the algo lines inside are plain text of that example.
  const doc = "````\n```algo\nT\nInput: A\nOutput: A\n|\n```\n````";
  const e = editor(doc);
  e.type("for ");
  assert.equal(e.show(), doc.replace("|", "for |"));
  assert.ok(press(doc.replace("|", "while x do|")).startsWith("D:"));
  // A tilde fence is not closed by backticks.
  assert.equal(steps(press("~~~algo\nT\nI\nO\n```\nwhile x do|\n~~~").slice(2)), "```\nwhile x do\n    |");
});
