import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_KEYWORDS } from "../src/parse.ts";
import { DEFAULT_SETTINGS, loadSettings, renderOptions, storedSettings } from "../src/settings.ts";
import { DEFAULT_SNIPPETS } from "../src/snippets.ts";

test("nothing stored gives the defaults", () => {
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings(undefined), DEFAULT_SETTINGS);
});

test("stored values win, missing keyword lists fall back", () => {
  const s = loadSettings({ align: "left", keywords: { constant: "true false none" } });
  assert.equal(s.align, "left");
  assert.equal(s.fontSize, 100);
  assert.equal(s.keywords.constant, "true false none");
  assert.equal(s.keywords.control, DEFAULT_KEYWORDS.control);
});

test("unedited keyword lists and snippets are not stored, so new defaults reach them", () => {
  const data = storedSettings(loadSettings(null));
  assert.equal("snippets" in data, false);
  assert.equal("keywords" in data, false);
  assert.equal(data.align, "center");
  assert.deepEqual(loadSettings(data), DEFAULT_SETTINGS);
});

test("edited keyword lists and snippets are stored and come back", () => {
  const edited = loadSettings(null);
  edited.snippets = "[]";
  edited.keywords = { ...edited.keywords, operator: "and or" };
  const data = storedSettings(edited);
  assert.equal(data.snippets, "[]");
  assert.deepEqual(data.keywords, { operator: "and or" });
  assert.deepEqual(loadSettings(JSON.parse(JSON.stringify(data))), edited);
  assert.notEqual(edited.snippets, DEFAULT_SNIPPETS);
});

test("render options carry the compiled keyword lists", () => {
  const options = renderOptions(loadSettings({ keywords: { statement: "Print, Spawn" } }));
  assert.deepEqual([...options.keywords.statement], ["print", "spawn"]);
  assert.ok(options.keywords.control.has("while"));
});
