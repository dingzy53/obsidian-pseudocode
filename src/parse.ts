// Pure parsing logic. No imports, so it runs in Obsidian, in Node tests and in a browser harness alike.

export interface Step {
  level: number;
  text: string;
  blank: boolean;
}

export interface Field {
  label: string;
  value: string;
}

export interface Model {
  title: string;
  fields: Field[];
  steps: Step[];
}

export type Token =
  | { t: "text" | "kw" | "fn" | "sym" | "math" | "str" | "code"; v: string }
  | { t: "comment"; c: Token[] };

export interface TokenizeOptions {
  // Header values and comments: math, symbols and code only.
  plain?: boolean;
  // Extra bold words, lower case.
  keywords?: ReadonlySet<string>;
  // Names from `declaredFunctions`, styled where they are called.
  functions?: ReadonlySet<string>;
}

const TAB = 4;

const words = (s: string) => new Set(s.split(" "));

const KEYWORDS = words(
  "if then else elif elsif elseif for foreach forall while do repeat until loop return break continue " +
    "switch case default otherwise try catch finally begin function procedure end " +
    "endif endfor endwhile endloop endswitch endfunction endprocedure " +
    "and or not xor mod div true false null nil",
);

// Only bold as the first word of a step, so "the error is small" stays plain.
const LEADING = words("print read write input output call swap assert error throw raise yield goto exit halt");

// Only bold on lines that start a certain way, so "add x to S" stays plain.
const CONTEXT: [RegExp, Set<string>][] = [
  [/^\s*(parallel\s+)?(for|foreach|forall)\b/i, words("to downto in each all by step from parallel")],
  [/^\s*(switch|case)\b/i, words("of")],
];

const SYMBOLS: Record<string, string> = {
  "<-": "←",
  "->": "→",
  "<->": "↔",
  "=>": "⇒",
  "<=>": "⇔",
  "<=": "≤",
  ">=": "≥",
  "!=": "≠",
  "...": "…",
};

// Labelled header rows. Line 2 and line 3 may leave the label out.
const FIELD =
  /^\s*(inputs?|outputs?|require|ensure|data|result|param(?:eter)?s|returns|precondition|postcondition|globals?)\s*:(.*)$/i;

const expandTabs = (s: string) => s.replace(/\t/g, " ".repeat(TAB));

export function fieldOf(line: string): Field | null {
  const m = FIELD.exec(line);
  return m ? { label: m[1][0].toUpperCase() + m[1].slice(1), value: m[2].trim() } : null;
}

export function parse(source: string): Model {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  // Lines 2 and 3 are always header rows; labelled rows may follow them.
  const fields: Field[] = [];
  let at = 1;
  for (; at < lines.length; at++) {
    const labelled = fieldOf(lines[at]);
    if (at > 2 && !labelled) break;
    const field = labelled ?? { label: at === 1 ? "Input" : "Output", value: lines[at].trim() };
    if (field.value && field.value !== "-") fields.push(field);
  }

  const rest = lines.slice(at).map((l) => expandTabs(l.trimEnd()));
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const indents = rest.filter((l) => l.trim()).map(indentOf);
  const base = indents.length ? Math.min(...indents) : 0;
  const offsets = indents.map((n) => n - base).filter((n) => n > 0);
  const unit = offsets.length ? Math.min(...offsets) : TAB;

  return {
    title: (lines[0] ?? "").trim(),
    fields,
    steps: rest.map((l) =>
      l.trim()
        ? { level: Math.round((indentOf(l) - base) / unit), text: l.trim(), blank: false }
        : { level: 0, text: "", blank: true },
    ),
  };
}

const DECLARATION = /^(?:function|procedure)\s+([A-Za-z_][\w-]*)/i;

// Names introduced by `function foo(...)` / `procedure foo(...)`, so calls to them are styled too.
export function declaredFunctions(steps: Step[]): Set<string> {
  const names = new Set<string>();
  for (const step of steps) {
    const m = DECLARATION.exec(step.text);
    if (m) names.add(m[1]);
  }
  return names;
}

// One pass, earliest match wins:
// \$ | $math$ | //comment | `code` | "string" | symbol | Function( | function( | word
const INLINE =
  /\\\$|\$([^$\n]+)\$|\/\/(.*)$|`([^`\n]+)`|"[^"\n]*"|<=>|<->|<-|->|<=|>=|=>|!=|\.{3}|\b[A-Z][\w-]*(?=\()|\b[a-z_]\w*(?=\()|\b[A-Za-z]+\b/g;

// A name right after `function` / `procedure`.
const DECLARED_NAME = /\s+([A-Za-z_][\w-]*)/y;

// `end <- n`: a word that is assigned to is a variable, never a keyword.
const ASSIGNED = /^\s*(<-|:=|=(?![=>]))/;

export function tokenize(text: string, options: TokenizeOptions = {}): Token[] {
  const { plain = false, keywords, functions } = options;
  const context = plain ? [] : CONTEXT.filter(([re]) => re.test(text)).map(([, set]) => set);
  const out: Token[] = [];
  let last = 0;
  const push = (t: Token) => {
    const prev = out[out.length - 1];
    if (t.t === "text" && prev && prev.t === "text") prev.v += t.v;
    else out.push(t);
  };
  const isKeyword = (w: string, first: boolean) =>
    KEYWORDS.has(w) ||
    keywords?.has(w) ||
    context.some((set) => set.has(w)) ||
    (first && LEADING.has(w));

  const re = new RegExp(INLINE);
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const s = m[0];
    if (m.index > last) push({ t: "text", v: text.slice(last, m.index) });
    last = m.index + s.length;

    if (s === "\\$") push({ t: "text", v: "$" });
    else if (m[1] !== undefined) push({ t: "math", v: m[1] });
    else if (m[2] !== undefined) {
      const prev = out[out.length - 1];
      if (prev && prev.t === "text") prev.v = prev.v.trimEnd();
      push({ t: "comment", c: tokenize(m[2].trim(), { plain: true }) });
    }
    else if (m[3] !== undefined) push({ t: "code", v: m[3] });
    else if (s[0] === '"') push({ t: plain ? "text" : "str", v: s });
    else if (SYMBOLS[s]) push({ t: "sym", v: SYMBOLS[s] });
    else {
      const w = s.toLowerCase();
      const first = !text.slice(0, m.index).trim();
      if (plain) push({ t: "text", v: s });
      else if (isKeyword(w, first) && !ASSIGNED.test(text.slice(last))) {
        push({ t: "kw", v: s });
        if (w === "function" || w === "procedure") {
          DECLARED_NAME.lastIndex = last;
          const name = DECLARED_NAME.exec(text);
          if (name) {
            push({ t: "text", v: text.slice(last, DECLARED_NAME.lastIndex - name[1].length) });
            push({ t: "fn", v: name[1] });
            last = re.lastIndex = DECLARED_NAME.lastIndex;
          }
        }
      }
      else if ((/^[A-Z]/.test(s) || functions?.has(s)) && text[last] === "(") push({ t: "fn", v: s });
      else push({ t: "text", v: s });
    }
  }
  if (last < text.length) push({ t: "text", v: text.slice(last) });
  return out;
}

const ENDS_OPEN = /(\bdo|\bthen|\belse|\brepeat|\bloop|\bbegin|\botherwise|\btry|\bfinally|:)$/;
const STARTS_OPEN = /^(parallel\s+)?(for|foreach|forall|while|if|elif|elsif|elseif|else\s+if|switch|catch)\b/;

// Should pressing Enter after this line indent the next one?
// `strict` wants the closing `do` / `then` / `:`; otherwise a bare `for i from 1 to n` opens a block too.
export function opensBlock(line: string, strict = false): boolean {
  const s = line.replace(/\/\/.*$/, "").trim().toLowerCase();
  if (ENDS_OPEN.test(s) || /^(function|procedure)\b/.test(s)) return true;
  return !strict && STARTS_OPEN.test(s) && !/\b(do|then)\b/.test(s);
}
