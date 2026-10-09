// Pure snippet logic: reading the definitions, matching a trigger and filling in a replacement. No imports.

export interface Snippet {
  trigger: string;
  // Set for `r` snippets: the trigger as a pattern anchored at the cursor.
  pattern: RegExp | null;
  replacement: string;
  auto: boolean;
  lineStart: boolean;
  word: boolean;
}

export interface Match {
  snippet: Snippet;
  // How many characters before the cursor the trigger covers.
  length: number;
  // Capture groups of a regex trigger, for `[[0]]`, `[[1]]`, ...
  groups: string[];
}

export interface Range {
  from: number;
  to: number;
}

export interface Expansion {
  text: string;
  // Tabstops in visiting order. Each entry holds every place that shares one number.
  stops: Range[][];
}

export const DEFAULT_SNIPPETS = `[
  // Type "for" and a space at the start of a step. Tab moves to the next value.
  { "trigger": "for ", "replacement": "for \${0:i} from \${1:1} to \${2:n}", "options": "Ab" }
]
`;

// JSON, plus // and /* */ comments and trailing commas.
function relax(source: string): string {
  const dropCommas = (s: string) => s.replace(/,(\s*[\]}])/g, "$1");
  let out = "";
  let code = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"') {
      const start = i++;
      while (i < source.length && source[i] !== '"') i += source[i] === "\\" ? 2 : 1;
      out += dropCommas(code) + source.slice(start, ++i);
      code = "";
    } else if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      // Keep the line count, so JSON error positions still point at the right line.
      code += source.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
    } else {
      code += c;
      i++;
    }
  }
  return out + dropCommas(code);
}

function toSnippet(raw: unknown, n: number): Snippet {
  const fail = (why: string): never => {
    throw new Error(`Snippet ${n}: ${why}`);
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("expected { ... }");
  const { trigger, replacement, options = "" } = raw as Record<string, unknown>;
  if (typeof trigger !== "string" || !trigger) return fail('"trigger" must be a non-empty string');
  if (typeof replacement !== "string") return fail('"replacement" must be a string');
  if (typeof options !== "string") return fail('"options" must be a string');
  const unknown = /[^Abwr]/.exec(options);
  if (unknown) fail(`unknown option "${unknown[0]}" (use A, b, w, r)`);

  let pattern: RegExp | null = null;
  if (options.includes("r")) {
    try {
      pattern = new RegExp(`(?:${trigger})$`);
    } catch (e) {
      fail(`bad regular expression (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return {
    trigger,
    pattern,
    replacement,
    auto: options.includes("A"),
    lineStart: options.includes("b"),
    word: options.includes("w"),
  };
}

// On any mistake the whole text is rejected, so a typo never half-applies.
export function parseSnippets(source: string): { snippets: Snippet[]; error: string | null } {
  try {
    const data: unknown = source.trim() ? JSON.parse(relax(source)) : [];
    if (!Array.isArray(data)) throw new Error("Expected a list of snippets inside [ ]");
    return { snippets: data.map((raw, i) => toSnippet(raw, i + 1)), error: null };
  } catch (e) {
    return { snippets: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// First snippet whose trigger ends at the cursor. `before` and `after` are the line around the cursor.
export function matchSnippet(snippets: Snippet[], before: string, after: string, autoOnly: boolean): Match | null {
  for (const snippet of snippets) {
    if (autoOnly && !snippet.auto) continue;
    let length = 0;
    let groups: string[] = [];
    if (snippet.pattern) {
      const m = snippet.pattern.exec(before);
      if (!m) continue;
      length = m[0].length;
      groups = m.slice(1).map((g) => g ?? "");
    } else if (before.endsWith(snippet.trigger)) {
      length = snippet.trigger.length;
    }
    if (!length) continue;

    const head = before.slice(0, before.length - length);
    if (head.includes("//")) continue;
    if (snippet.lineStart && head.trim()) continue;
    if (snippet.word && (/\w$/.test(head) || /^\w/.test(after))) continue;
    return { snippet, length, groups };
  }
  return null;
}

// \$ | ${1:default} | $1 | [[1]] | newline | tab
const PLACEHOLDER = /\\\$|\$\{(\d+)(?::([^}]*))?\}|\$(\d+)|\[\[(\d+)\]\]|\n|\t/g;

// `indent` is the current line's leading whitespace, `unit` one level of indentation.
export function expand(replacement: string, groups: string[], indent: string, unit: string): Expansion {
  // A bare `$1` repeats the default of `${1:x}`, wherever that one sits.
  const defaults = new Map<number, string>();
  for (const m of replacement.matchAll(PLACEHOLDER)) {
    if (m[1] !== undefined && m[2] !== undefined && !defaults.has(+m[1])) defaults.set(+m[1], m[2]);
  }

  const stops = new Map<number, Range[]>();
  let text = "";
  let last = 0;
  for (const m of replacement.matchAll(PLACEHOLDER)) {
    text += replacement.slice(last, m.index);
    last = m.index + m[0].length;
    const stop = m[1] ?? m[3];
    if (m[0] === "\\$") text += "$";
    else if (m[0] === "\n") text += "\n" + indent;
    else if (m[0] === "\t") text += unit;
    else if (m[4] !== undefined) text += groups[+m[4]] ?? "";
    else if (stop !== undefined) {
      const value = m[2] ?? defaults.get(+stop) ?? "";
      const ranges = stops.get(+stop) ?? [];
      ranges.push({ from: text.length, to: text.length + value.length });
      stops.set(+stop, ranges);
      text += value;
    }
  }
  text += replacement.slice(last);

  return { text, stops: [...stops.keys()].sort((a, b) => a - b).map((n) => stops.get(n)!) };
}
