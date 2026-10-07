// Pure parsing logic. No imports, so it runs in Obsidian, in Node tests and in a browser harness alike.

export interface Step {
  level: number;
  text: string;
  blank: boolean;
}

export interface Model {
  title: string;
  input: string;
  output: string;
  steps: Step[];
}

export type Token =
  | { t: "text" | "kw" | "fn" | "sym" | "math"; v: string }
  | { t: "comment"; c: Token[] };

const TAB = 4;

const KEYWORDS = new Set(
  (
    "if then else elif for foreach while do repeat until loop return break continue " +
    "function procedure end and or not true false null nil"
  ).split(" "),
);

// Only bold on `for` / `foreach` lines, so "add x to S" stays plain.
const FOR_KEYWORDS = new Set("to downto in each all by step".split(" "));

const SYMBOLS: Record<string, string> = {
  "<-": "←",
  "->": "→",
  "<=": "≤",
  ">=": "≥",
  "!=": "≠",
};

const expandTabs = (s: string) => s.replace(/\t/g, " ".repeat(TAB));

function headerValue(line: string | undefined, label: RegExp): string {
  const v = (line ?? "").replace(label, "").trim();
  return v === "-" ? "" : v;
}

export function parse(source: string): Model {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  const rest = lines.slice(3).map((l) => expandTabs(l.trimEnd()));
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const indents = rest.filter((l) => l.trim()).map(indentOf);
  const base = indents.length ? Math.min(...indents) : 0;
  const offsets = indents.map((n) => n - base).filter((n) => n > 0);
  const unit = offsets.length ? Math.min(...offsets) : TAB;

  return {
    title: (lines[0] ?? "").trim(),
    input: headerValue(lines[1], /^\s*input\s*:/i),
    output: headerValue(lines[2], /^\s*output\s*:/i),
    steps: rest.map((l) =>
      l.trim()
        ? { level: Math.round((indentOf(l) - base) / unit), text: l.trim(), blank: false }
        : { level: 0, text: "", blank: true },
    ),
  };
}

// One pass, earliest match wins: \$ | $math$ | //comment | symbol | Function( | word
const INLINE = /\\\$|\$([^$\n]+)\$|\/\/(.*)$|<-|->|<=|>=|!=|\b[A-Z][\w-]*(?=\()|\b[A-Za-z]+\b/g;

export function tokenize(text: string, plain = false): Token[] {
  const forLine = !plain && /^\s*(for|foreach)\b/i.test(text);
  const out: Token[] = [];
  let last = 0;
  const push = (t: Token) => {
    const prev = out[out.length - 1];
    if (t.t === "text" && prev && prev.t === "text") prev.v += t.v;
    else out.push(t);
  };

  for (const m of text.matchAll(INLINE)) {
    const s = m[0];
    if (m.index > last) push({ t: "text", v: text.slice(last, m.index) });
    last = m.index + s.length;

    if (s === "\\$") push({ t: "text", v: "$" });
    else if (m[1] !== undefined) push({ t: "math", v: m[1] });
    else if (m[2] !== undefined) {
      const prev = out[out.length - 1];
      if (prev && prev.t === "text") prev.v = prev.v.trimEnd();
      push({ t: "comment", c: tokenize(m[2].trim(), true) });
    }
    else if (SYMBOLS[s]) push({ t: "sym", v: SYMBOLS[s] });
    else {
      const w = s.toLowerCase();
      if (plain) push({ t: "text", v: s });
      else if (KEYWORDS.has(w) || (forLine && FOR_KEYWORDS.has(w))) push({ t: "kw", v: s });
      else if (/^[A-Z]/.test(s) && text[last] === "(") push({ t: "fn", v: s });
      else push({ t: "text", v: s });
    }
  }
  if (last < text.length) push({ t: "text", v: text.slice(last) });
  return out;
}

// Should pressing Enter after this line indent the next one?
export function opensBlock(line: string): boolean {
  const s = line.replace(/\/\/.*$/, "").trim().toLowerCase();
  return /(\bdo|\bthen|\belse|\brepeat|\bloop|:)$/.test(s) || /^(function|procedure)\b/.test(s);
}
