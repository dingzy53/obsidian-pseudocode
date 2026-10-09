import test from "node:test";
import assert from "node:assert/strict";
import { parse, tokenize, opensBlock, declaredFunctions } from "../src/parse.ts";

const kinds = (s: string, options = {}) =>
  tokenize(s, options).map((t) => (t.t === "comment" ? "comment" : `${t.t}:${t.v}`));
const bold = (s: string, options = {}) => kinds(s, options).filter((k) => k.startsWith("kw:")).map((k) => k.slice(3));

test("header with labels", () => {
  const m = parse("Sort\nInput: array A\nOutput: sorted A\nreturn A");
  assert.equal(m.title, "Sort");
  assert.deepEqual(m.fields, [
    { label: "Input", value: "array A" },
    { label: "Output", value: "sorted A" },
  ]);
  assert.equal(m.steps.length, 1);
});

test("header without labels, dash and empty hide the row", () => {
  const m = parse("T\narray A\n-\nx");
  assert.deepEqual(m.fields, [{ label: "Input", value: "array A" }]);
  assert.deepEqual(parse("T\n\n\nx").fields, []);
  assert.equal(parse("T\n\n\nx").steps.length, 1);
});

test("header labels are shown as written", () => {
  const m = parse("T\nRequire: $n > 0$\nensure: sorted A\nx");
  assert.deepEqual(m.fields.map((f) => f.label), ["Require", "Ensure"]);
  assert.equal(m.steps.length, 1);
});

test("labelled rows may continue the header", () => {
  const m = parse("T\nInput: A\nOutput: B\nData: a heap H\nReturns: -\nresult <- 1\nOutput: late");
  assert.deepEqual(m.fields.map((f) => f.label), ["Input", "Output", "Data"]);
  assert.deepEqual(m.steps.map((s) => s.text), ["result <- 1", "Output: late"]);
});

test("short sources do not crash", () => {
  assert.deepEqual(parse(""), { title: "", fields: [], steps: [] });
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

test("longer symbols win over their prefixes", () => {
  assert.deepEqual(kinds("a <-> b <=> c => d ... e").filter((k) => k.startsWith("sym")), [
    "sym:↔", "sym:⇔", "sym:⇒", "sym:…",
  ]);
  assert.deepEqual(kinds("A[1..n]"), ["text:A[1..n]"]);
});

test("more keywords", () => {
  assert.deepEqual(bold("forall v in V do"), ["forall", "in", "do"]);
  assert.deepEqual(bold("for i from 1 to n"), ["for", "from", "to"]);
  assert.deepEqual(bold("parallel for each u in S"), ["parallel", "for", "each", "in"]);
  assert.deepEqual(bold("switch x"), ["switch"]);
  assert.deepEqual(bold("case color of"), ["case", "of"]);
  assert.deepEqual(bold("one of them"), []);
  assert.deepEqual(bold("try"), ["try"]);
  assert.deepEqual(bold("x <- a mod b"), ["mod"]);
  assert.deepEqual(bold("elseif x then"), ["elseif", "then"]);
});

test("statement keywords are bold only as the first word", () => {
  assert.deepEqual(bold("print x"), ["print"]);
  assert.deepEqual(bold("error \"underflow\""), ["error"]);
  assert.deepEqual(bold("the error is small"), []);
  assert.deepEqual(bold("swap A[i] and A[j]"), ["swap", "and"]);
});

test("an assigned word is a variable, not a keyword", () => {
  assert.deepEqual(bold("end <- n"), []);
  assert.deepEqual(bold("output := 0"), []);
  assert.deepEqual(bold("step = 2"), []);
  assert.deepEqual(bold("return true == x"), ["return", "true"]);
});

test("extra keywords", () => {
  const options = { keywords: new Set(["spawn"]) };
  assert.deepEqual(bold("Spawn worker", options), ["Spawn"]);
  assert.deepEqual(bold("spawn worker"), []);
});

test("strings and code keep their words plain", () => {
  assert.deepEqual(kinds('print "if not found"'), ["kw:print", "text: ", 'str:"if not found"']);
  assert.deepEqual(kinds("set `while` flag"), ["text:set ", "code:while", "text: flag"]);
  assert.deepEqual(kinds('"http://x" // y').slice(0, 1), ['str:"http://x"']);
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
  assert.ok(kinds("n-Max(a)").includes("fn:Max"));
});

test("declared function names", () => {
  assert.deepEqual(kinds("function merge_sort(A, lo)"), ["kw:function", "text: ", "fn:merge_sort", "text:(A, lo)"]);
  assert.deepEqual(kinds("procedure Heap-Fix"), ["kw:procedure", "text: ", "fn:Heap-Fix"]);
  const functions = declaredFunctions(parse("T\n\n\nfunction merge_sort(A)\n  merge_sort(B)\n  floor(x)").steps);
  assert.deepEqual([...functions], ["merge_sort"]);
  assert.ok(kinds("x <- merge_sort(B)", { functions }).includes("fn:merge_sort"));
  assert.ok(!kinds("x <- floor(B)", { functions }).some((k) => k.startsWith("fn")));
  assert.ok(kinds("while(x)", { functions }).includes("kw:while"));
});

test("opensBlock", () => {
  for (const l of ["while x do", "if x then", "else", "repeat", "for i in S:", "function F(x)", "x // do"]) {
    assert.equal(opensBlock(l), l !== "x // do", l);
  }
  assert.equal(opensBlock("return x"), false);
  assert.equal(opensBlock("else if a then // note"), true);
});

test("opensBlock: loop and branch headers without do / then", () => {
  for (const l of ["for i from 1 to n", "while x > 0", "if x = 1", "else if y", "forall v in V", "parallel for i in S", "switch x", "try"]) {
    assert.equal(opensBlock(l), true, l);
  }
  for (const l of ["while x do y <- 1", "if x then return y", "format x", "until x"]) {
    assert.equal(opensBlock(l), false, l);
  }
  assert.equal(opensBlock("while", true), false);
  assert.equal(opensBlock("while x do", true), true);
});

test("spaces before a comment are dropped", () => {
  assert.deepEqual(kinds("lo <- 1      // note").slice(-2), ["text: 1", "comment"]);
});
