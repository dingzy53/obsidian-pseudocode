import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../src/parse.ts";
import { DEFAULT_SNIPPETS, expand, matchSnippet, parseSnippets } from "../src/snippets.ts";

const one = (json: string) => {
  const { snippets, error } = parseSnippets(`[${json}]`);
  assert.equal(error, null);
  return snippets;
};

test("default definitions load", () => {
  const { snippets, error } = parseSnippets(DEFAULT_SNIPPETS);
  assert.equal(error, null);
  assert.deepEqual(
    snippets.map((s) => [s.trigger, s.auto, s.lineStart, s.where, s.note]),
    [["for ", true, true, null, false], ["mk", true, false, "text", false], ["algo ", true, true, null, true]],
  );
  assert.equal(expand(snippets[2].replacement, [], "", "").text, "```algo\n\nInput: \nOutput: \n\n```");
  // Dollar, tabstop 0, dollar, space, tabstop 1.
  assert.deepEqual(expand(snippets[1].replacement, [], "", ""), {
    text: "$$ ",
    stops: [[{ from: 1, to: 1 }], [{ from: 3, to: 3 }]],
  });
});

test("the block from the algo snippet reads as an untitled block", () => {
  const { text, stops } = expand(parseSnippets(DEFAULT_SNIPPETS).snippets[2].replacement, [], "", "");
  const body = (source: string) => source.split("\n").slice(1, -1).join("\n");
  assert.deepEqual(parse(body(text)), { title: "", fields: [], steps: [] });

  // Fill in the last three tabstops (input, output, first step) and leave the title empty.
  let filled = text;
  for (const [stop, value] of [[3, "return A"], [2, "sorted A"], [1, "array A"]] as const) {
    const at = stops[stop][0].from;
    filled = filled.slice(0, at) + value + filled.slice(at);
  }
  const model = parse(body(filled));
  assert.equal(model.title, "");
  assert.deepEqual(model.fields, [
    { label: "Input", value: "array A" },
    { label: "Output", value: "sorted A" },
  ]);
  assert.deepEqual(model.steps.map((s) => s.text), ["return A"]);
});

test("the README example loads", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  // The closing fence is the one at the start of a line: the example has backticks of its own.
  const blocks = [...readme.matchAll(/```jsonc\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  assert.ok(blocks.length > 0);
  for (const block of blocks) {
    const { snippets, error } = parseSnippets(block);
    assert.equal(error, null);
    assert.ok(snippets.length > 10);
  }
});

test("comments and trailing commas are allowed, but not inside strings", () => {
  const { snippets, error } = parseSnippets(`
    // a comment
    [
      /* another
         one */
      { "trigger": "//", "replacement": "a,] /* b */", },
    ]`);
  assert.equal(error, null);
  assert.equal(snippets[0].trigger, "//");
  assert.equal(snippets[0].replacement, "a,] /* b */");
});

test("empty text means no snippets", () => {
  assert.deepEqual(parseSnippets("  \n"), { snippets: [], error: null });
});

test("mistakes are reported and nothing is half-applied", () => {
  const bad = (src: string) => {
    const r = parseSnippets(src);
    assert.equal(r.snippets.length, 0);
    return r.error ?? "";
  };
  assert.ok(bad("[{"));
  assert.match(bad("{}"), /list of snippets/);
  assert.match(bad('[{ "trigger": "a", "replacement": "b" }, { "trigger": "" }]'), /Snippet 2: "trigger"/);
  assert.match(bad('[{ "trigger": "a" }]'), /Snippet 1: "replacement"/);
  assert.match(bad('[{ "trigger": "a", "replacement": "b", "options": "Ax" }]'), /unknown option "x"/);
  assert.match(bad('[{ "trigger": "(", "replacement": "b", "options": "r" }]'), /regular expression/);
  assert.match(bad('[{ "trigger": "a", "replacement": "b", "options": "mt" }]'), /not both/);
  assert.match(bad("[3]"), /Snippet 1/);
});

test("matching: first hit wins, auto filter", () => {
  const list = [
    ...one('{ "trigger": "wh", "replacement": "1" }'),
    ...one('{ "trigger": "h", "replacement": "2", "options": "A" }'),
  ];
  assert.equal(matchSnippet(list, "wh", "", false)?.snippet.replacement, "1");
  assert.equal(matchSnippet(list, "wh", "", true)?.snippet.replacement, "2");
  assert.equal(matchSnippet(list, "x", "", false), null);
});

test("matching: b only at the start of the line", () => {
  const list = one('{ "trigger": "for ", "replacement": "", "options": "b" }');
  assert.equal(matchSnippet(list, "   for ", "", false)?.length, 4);
  assert.equal(matchSnippet(list, "wait for ", "", false), null);
});

test("matching: Tab also takes a trigger without its closing space", () => {
  const list = one('{ "trigger": "for ", "replacement": "", "options": "Ab" }');
  assert.equal(matchSnippet(list, "  for", "", false)?.length, 3);
  assert.equal(matchSnippet(list, "  for", "", true), null);
  assert.equal(matchSnippet(list, "foreach", "", false), null);
  assert.equal(matchSnippet(list, "wait for", "", false), null);
  assert.equal(matchSnippet(one('{ "trigger": " ", "replacement": "x" }'), "a", "", false), null);
});

test("matching: the caller can refuse a snippet and let a later one through", () => {
  const list = [
    ...one('{ "trigger": "x", "replacement": "note", "options": "n" }'),
    ...one('{ "trigger": "x", "replacement": "block" }'),
  ];
  assert.equal(matchSnippet(list, "x", "", false, (s) => s.note)?.snippet.replacement, "note");
  assert.equal(matchSnippet(list, "x", "", false, (s) => !s.note)?.snippet.replacement, "block");
  assert.equal(matchSnippet(list, "x", "", false, () => false), null);
});

test("matching: w needs word boundaries on both sides", () => {
  const list = one('{ "trigger": "inf", "replacement": "", "options": "w" }');
  assert.ok(matchSnippet(list, "x <- inf", "", false));
  assert.ok(matchSnippet(list, "x <- inf", ")", false));
  assert.equal(matchSnippet(list, "x <- sinf", "", false), null);
  assert.equal(matchSnippet(list, "x <- inf", "o", false), null);
});

test("matching: m only inside math, t only outside", () => {
  const math = one('{ "trigger": "sr", "replacement": "^2", "options": "m" }');
  assert.ok(matchSnippet(math, "x <- $asr", "", false));
  assert.equal(matchSnippet(math, "x <- asr", "", false), null);
  assert.equal(matchSnippet(math, "$a$ and sr", "", false), null);
  assert.equal(matchSnippet(math, "cost \\$5 sr", "", false), null);

  const text = one('{ "trigger": "mk", "replacement": "", "options": "t" }');
  assert.ok(matchSnippet(text, "x <- mk", "", false));
  assert.ok(matchSnippet(text, "$a$ // mk", "", false));
  assert.equal(matchSnippet(text, "x <- $amk", "", false), null);
});

test("matching: regex groups", () => {
  const list = one('{ "trigger": "([a-z])(\\\\d)", "replacement": "", "options": "r" }');
  const m = matchSnippet(list, "x <- a1", "", false);
  assert.deepEqual(m && [m.length, m.groups], [2, ["a", "1"]]);
  assert.equal(matchSnippet(list, "a1 ", "", false), null);
});

test("expand: tabstops in number order with their defaults", () => {
  const e = expand("for ${0:i} from ${1:1} to ${2:n}", [], "", "    ");
  assert.equal(e.text, "for i from 1 to n");
  assert.deepEqual(e.stops, [[{ from: 4, to: 5 }], [{ from: 11, to: 12 }], [{ from: 16, to: 17 }]]);

  const swapped = expand("$1 then ${0:x}", [], "", "    ");
  assert.equal(swapped.text, " then x");
  assert.deepEqual(swapped.stops, [[{ from: 6, to: 7 }], [{ from: 0, to: 0 }]]);
});

test("expand: a repeated number mirrors the default", () => {
  const e = expand("$0 + ${0:x}", [], "", "    ");
  assert.equal(e.text, "x + x");
  assert.deepEqual(e.stops, [[{ from: 0, to: 1 }, { from: 4, to: 5 }]]);
});

test("expand: new lines keep the indent, tabs add a level", () => {
  const e = expand("if $0 then\n\t$1\nend", [], "  ", "    ");
  assert.equal(e.text, "if  then\n      \n  end");
});

test("expand: math stays literal, \\$ escapes a dollar", () => {
  assert.equal(expand("$n$ and $x_1$ cost \\$5 [[0]]", ["g"], "", "").text, "$n$ and $x_1$ cost $5 g");
  assert.deepEqual(expand("$n$", [], "", "").stops, []);
});
