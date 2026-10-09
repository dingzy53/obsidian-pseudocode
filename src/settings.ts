// The settings shape, its defaults and how it is stored. Pure, so the tests can load it.

import { DEFAULT_KEYWORDS, compileKeywords, type KeywordGroup, type KeywordLists } from "./parse.ts";
import type { RenderOptions } from "./render.ts";
import { DEFAULT_SNIPPETS } from "./snippets.ts";

export interface Settings extends Omit<RenderOptions, "keywords"> {
  // The word lists as typed, see `compileKeywords`.
  keywords: KeywordLists;
  snippetsEnabled: boolean;
  // The definitions as typed, see `parseSnippets`.
  snippets: string;
}

export const DEFAULT_SETTINGS: Settings = {
  align: "center",
  fontSize: 100,
  font: "text",
  lineNumbers: true,
  indentGuides: true,
  commentAlign: "right",
  commentMarker: "▷",
  colors: true,
  keywords: DEFAULT_KEYWORDS,
  snippetsEnabled: true,
  snippets: DEFAULT_SNIPPETS,
};

export function loadSettings(data: unknown): Settings {
  const stored = (data ?? {}) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...stored, keywords: { ...DEFAULT_KEYWORDS, ...stored.keywords } };
}

// Keyword lists and snippets that still equal their default are left out,
// so the defaults of a later version reach everyone who has not edited them.
export function storedSettings(settings: Settings): Record<string, unknown> {
  const { keywords, snippets, ...rest } = settings;
  const data: Record<string, unknown> = rest;
  const edited = Object.entries(keywords).filter(([group, list]) => list !== DEFAULT_KEYWORDS[group as KeywordGroup]);
  if (edited.length) data.keywords = Object.fromEntries(edited);
  if (snippets !== DEFAULT_SNIPPETS) data.snippets = snippets;
  return data;
}

export function renderOptions(settings: Settings): RenderOptions {
  return { ...settings, keywords: compileKeywords(settings.keywords) };
}
