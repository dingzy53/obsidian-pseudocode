import test from "node:test";
import assert from "node:assert/strict";
import { blockLink, findFences, idFromTitle } from "../src/link.ts";

const lines = (text: string) => text.split("\n");

test("fences: algo or not, closed or not", () => {
  const found = findFences(lines("a\n```algo\nT\n```\nb\n```python\nx\n```\n```algo\nT"));
  assert.deepEqual(found, [
    { algo: true, open: 1, close: 3 },
    { algo: false, open: 5, close: 7 },
    { algo: true, open: 8, close: null },
  ]);
});

test("fences: a longer fence wraps shorter ones, tildes are closed by tildes", () => {
  assert.deepEqual(findFences(lines("````\n```algo\nT\n```\n````")), [{ algo: false, open: 0, close: 4 }]);
  assert.deepEqual(findFences(lines("~~~algo\n```\nx\n~~~")), [{ algo: true, open: 0, close: 3 }]);
});

test("ids come from the name before the argument list", () => {
  assert.equal(idFromTitle("SiftUp(i)"), "SiftUp");
  assert.equal(idFromTitle("Priority Queue"), "PriorityQueue");
  assert.equal(idFromTitle("binary search"), "BinarySearch");
  assert.equal(idFromTitle("Merge-Sort(A)"), "Merge-Sort");
  assert.equal(idFromTitle("HeapSort(A[1,...,n])"), "HeapSort");
  assert.equal(idFromTitle("Mönch's sort"), "MnchsSort");
  for (const t of ["", "(x)", "排序", "  "]) assert.equal(idFromTitle(t), "Algo", t);
});

test("a link to a block without an id adds one right after the fence", () => {
  const note = "text\n```algo\nSiftUp(i)\nInput: i\nOutput: -\nx <- 1\n```\n\nmore";
  assert.deepEqual(blockLink(lines(note), 4), {
    id: "SiftUp",
    alias: "SiftUp",
    insert: { line: 6, text: "\n^SiftUp" },
  });
  // Any line of the block works, the fences included, and nothing outside it.
  for (const at of [1, 2, 5, 6]) assert.equal(blockLink(lines(note), at)?.id, "SiftUp");
  for (const at of [0, 7, 8]) assert.equal(blockLink(lines(note), at), null);
});

test("an id that is already there is reused", () => {
  const note = "```algo\nSiftUp(i)\nI\nO\nx\n```\n^heap-up\n\ntext";
  assert.deepEqual(blockLink(lines(note), 2), { id: "heap-up", alias: "SiftUp", insert: null });
});

test("text or a fence right after the fence is kept apart from the id", () => {
  const next = blockLink(lines("```algo\nA\nI\nO\nx\n```\nlooks like text"), 1)!;
  assert.equal(next.insert!.text, "\n^A\n");
  // A following fence needs one too: without it the id line is a paragraph, and not an id of the block.
  assert.equal(blockLink(lines("```algo\nA\nI\nO\nx\n```\n```algo\nB"), 1)!.insert!.text, "\n^A\n");
  // A blank line or the end of the note already is the gap.
  assert.equal(blockLink(lines("```algo\nA\nI\nO\nx\n```\n\nB"), 1)!.insert!.text, "\n^A");
  assert.equal(blockLink(lines("```algo\nA\nI\nO\nx\n```"), 1)!.insert!.text, "\n^A");
});

test("an id that is taken gets a number, wherever the other one is written", () => {
  const note = [
    "> [!definition]",
    ">^CompleteBinaryTree",
    "a paragraph ^Para",
    "```algo",
    "CompleteBinaryTree",
    "I",
    "O",
    "x",
    "```",
    "```algo",
    "Para(x)",
    "I",
    "O",
    "x",
    "```",
    "```algo",
    "HeapSort(A)",
    "I",
    "O",
    "x",
    "```",
    "^HeapSort",
    "```algo",
    "HeapSort(A)",
    "I",
    "O",
    "x",
    "```",
  ];
  assert.equal(blockLink(note, 4)!.id, "CompleteBinaryTree-2");
  assert.equal(blockLink(note, 10)!.id, "Para-2");
  assert.equal(blockLink(note, 23)!.id, "HeapSort-2");
  // The first one already has its id.
  assert.deepEqual(blockLink(note, 16), { id: "HeapSort", alias: "HeapSort", insert: null });
});

test("the title of a class block is its first line; untitled blocks fall back", () => {
  const cls = blockLink(lines("```algo\nPriority Queue\nData: H\n---\nA\nI\nO\nx\n```"), 4)!;
  assert.equal(cls.id, "PriorityQueue");
  assert.equal(cls.alias, "Priority Queue");

  const untitled = blockLink(lines("```algo\nInput: A\nOutput: B\nx\n```"), 1)!;
  assert.deepEqual([untitled.id, untitled.alias], ["Algo", "Algo"]);
  assert.equal(blockLink(lines("```algo\n---\nA\nI\nO\nx\n```"), 1)!.id, "Algo");
});

test("only closed algo blocks can be linked", () => {
  assert.equal(blockLink(lines("```python\nx\n```"), 1), null);
  assert.equal(blockLink(lines("```algo\nA\nI\nO\nx"), 1), null);
});
