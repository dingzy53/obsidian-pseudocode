import test from "node:test";
import assert from "node:assert/strict";
import { parse, tokenize, opensBlock, declaredFunctions, compileKeywords, DEFAULT_KEYWORDS } from "../src/parse.ts";

const kinds = (s: string, options = {}) =>
  tokenize(s, options).map((t) => (t.t === "comment" ? "comment" : `${t.t}:${t.v}`));
const bold = (s: string, options = {}) => kinds(s, options).filter((k) => k.startsWith("kw:")).map((k) => k.slice(3));
// Each keyword with its kind, e.g. "if:control".
const kw = (s: string, options = {}) =>
  tokenize(s, options).flatMap((t) => (t.t === "kw" ? [`${t.v}:${t.k}`] : []));

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

test("an empty title line keeps the header rows in place", () => {
  const m = parse("\nInput: A\nOutput: B\nx");
  assert.equal(m.title, "");
  assert.deepEqual(m.fields, [
    { label: "Input", value: "A" },
    { label: "Output", value: "B" },
  ]);
  assert.deepEqual(m.steps.map((s) => s.text), ["x"]);

  // The freshly inserted template, with one step typed and nothing else filled in.
  const fresh = parse("\nInput: \nOutput: \nfor i from 1 to n\n");
  assert.deepEqual([fresh.title, fresh.fields.length], ["", 0]);
  assert.deepEqual(fresh.steps.map((s) => s.text), ["for i from 1 to n"]);

  const half = parse("\nInput: A\nOutput: \nwhile x:\n\ty");
  assert.deepEqual(half.fields, [{ label: "Input", value: "A" }]);
  assert.deepEqual(half.steps.map((s) => s.level), [0, 1]);

  // A blank line above a real title is still just a blank line.
  assert.equal(parse("\nSort\nInput: A\nOutput: B\nx").title, "Sort");
  assert.deepEqual(parse("\nInput: \nOutput: \n"), { title: "", fields: [], steps: [] });
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
  assert.deepEqual(kinds("A[i..n]"), ["text:A[i..n]"]);
});

test("more keywords", () => {
  assert.deepEqual(bold("forall v in V do"), ["forall", "in", "do"]);
  assert.deepEqual(bold("for i from 1 to n"), ["for", "from", "to"]);
  assert.deepEqual(bold("parallel for each u in S"), ["parallel", "for", "each", "in"]);
  assert.deepEqual(bold("switch x"), ["switch"]);
  assert.deepEqual(bold("add x to S"), []);
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

test("each keyword has a kind", () => {
  assert.deepEqual(kw("if x and not y then return true"), [
    "if:control", "and:operator", "not:operator", "then:control", "return:control", "true:constant",
  ]);
  assert.deepEqual(kw("print x mod 2"), ["print:statement", "mod:operator"]);
  assert.deepEqual(kw("for i from 1 to n"), ["for:control", "from:control", "to:control"]);
});

test("keyword lists can be replaced", () => {
  const keywords = compileKeywords({
    ...DEFAULT_KEYWORDS,
    control: "si alors, SINON",
    statement: "spawn",
    constant: "",
  });
  assert.deepEqual(kw("Si x alors true sinon false", { keywords }), ["Si:control", "alors:control", "sinon:control"]);
  assert.deepEqual(kw("if x then", { keywords }), []);
  assert.deepEqual(kw("spawn worker", { keywords }), ["spawn:statement"]);
  assert.deepEqual(kw("then spawn worker", { keywords }), []);
  assert.deepEqual(kw("spawn worker"), []);
});

test("numbers", () => {
  assert.deepEqual(kinds("x <- 3.14 + 2n + x1"), ["text:x ", "sym:←", "text: ", "num:3.14", "text: + 2n + x1"]);
  assert.deepEqual(kinds("A[1..n]"), ["text:A[", "num:1", "text:..n]"]);
  assert.deepEqual(tokenize("at most 3", { plain: true }), [{ t: "text", v: "at most 3" }]);
});

test("strings and code keep their words plain", () => {
  assert.deepEqual(kinds('print "if not found"'), ["kw:print", "text: ", 'str:"if not found"']);
  assert.deepEqual(kinds("set `while` flag"), ["text:set ", "code:while", "text: flag"]);
  assert.deepEqual(kinds('"http://x" // y').slice(0, 1), ['str:"http://x"']);
});

test("math and escaped dollar", () => {
  assert.deepEqual(kinds("x $a_i$ y"), ["text:x ", "math:a_i", "text: y"]);
  assert.deepEqual(kinds("cost \\$x"), ["text:cost $x"]);
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
  assert.deepEqual(kinds("lo <- 1      // note").slice(-2), ["num:1", "comment"]);
  assert.deepEqual(kinds("lo <- x      // note").slice(-2), ["text: x", "comment"]);
});
