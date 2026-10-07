import test from "node:test";
import assert from "node:assert/strict";
import { parse, tokenize, opensBlock } from "../src/parse.ts";

const kinds = (s: string) => tokenize(s).map((t) => (t.t === "comment" ? "comment" : `${t.t}:${t.v}`));

test("header with labels", () => {
  const m = parse("Sort\nInput: array A\nOutput: sorted A\nreturn A");
  assert.equal(m.title, "Sort");
  assert.equal(m.input, "array A");
  assert.equal(m.output, "sorted A");
  assert.equal(m.steps.length, 1);
});

test("header without labels, dash and empty hide the row", () => {
  const m = parse("T\narray A\n-\nx");
  assert.equal(m.input, "array A");
  assert.equal(m.output, "");
  assert.equal(parse("T\n\n\nx").input, "");
});

test("short sources do not crash", () => {
  assert.deepEqual(parse(""), { title: "", input: "", output: "", steps: [] });
  assert.equal(parse("Only title").steps.length, 0);
});

test("indent levels: 2 spaces, 4 spaces, tabs", () => {
  const lv = (src: string) => parse(`T\nI\nO\n${src}`).steps.map((s) => s.level);
  assert.deepEqual(lv("a\n  b\n    c\nd"), [0, 1, 2, 0]);
  assert.deepEqual(lv("a\n    b\n        c"), [0, 1, 2]);
  assert.deepEqual(lv("a\n\tb\n\t\tc"), [0, 1, 2]);
});

test("indented base is normalised", () => {
  assert.deepEqual(parse("T\nI\nO\n    a\n        b").steps.map((s) => s.level), [0, 1]);
});

test("blank and trailing lines", () => {
  const m = parse("T\nI\nO\na\n\nb\n\n\n");
  assert.deepEqual(m.steps.map((s) => s.blank), [false, true, false]);
});

test("symbols", () => {
  assert.deepEqual(kinds("a <- b <= c >= d != e -> f").filter((k) => k.startsWith("sym")), [
    "sym:←", "sym:≤", "sym:≥", "sym:≠", "sym:→",
  ]);
});

test("keywords are bold, case-insensitive, whole words only", () => {
  assert.deepEqual(kinds("While x Do").filter((k) => k.startsWith("kw")), ["kw:While", "kw:Do"]);
  assert.ok(!kinds("iffy done").some((k) => k.startsWith("kw")));
});

test("for-only keywords", () => {
  assert.ok(kinds("for i <- 1 to n do").includes("kw:to"));
  assert.ok(!kinds("add x to S").includes("kw:to"));
});

test("math and escaped dollar", () => {
  assert.deepEqual(kinds("x $a_i$ y"), ["text:x ", "math:a_i", "text: y"]);
  assert.deepEqual(kinds("cost \\$5"), ["text:cost $5"]);
});

test("comment keeps math and symbols but no keywords", () => {
  const t = tokenize("x <- 1 // if $n$ <= 3");
  const c = t[t.length - 1]!;
  assert.equal(c.t, "comment");
  if (c.t !== "comment") return;
  assert.deepEqual(c.c.map((x) => (x.t === "comment" ? "c" : x.t)), ["text", "math", "text", "sym", "text"]);
});

test("function names", () => {
  assert.ok(kinds("Merge-Sort(A)").includes("fn:Merge-Sort"));
  assert.ok(!kinds("Merge Sort").some((k) => k.startsWith("fn")));
  assert.ok(kinds("If(x)").includes("kw:If"));
});

test("opensBlock", () => {
  for (const l of ["while x do", "if x then", "else", "repeat", "for i in S:", "function F(x)", "x // do"]) {
    assert.equal(opensBlock(l), l !== "x // do", l);
  }
  assert.equal(opensBlock("return x"), false);
  assert.equal(opensBlock("else if a then // note"), true);
});

test("spaces before a comment are dropped", () => {
  assert.deepEqual(kinds("lo <- 1      // note").slice(-2), ["text: 1", "comment"]);
});
