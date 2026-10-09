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

// The kinds of keyword a step can show. Each has its own class, so each can have its own colour.
export type KeywordKind = "control" | "statement" | "operator" | "constant";

// The word lists a user can edit. `loop` words are shown as `control`, but only on `for` lines.
export type KeywordGroup = KeywordKind | "loop";
export type KeywordLists = Record<KeywordGroup, string>;
export type Keywords = Record<KeywordGroup, ReadonlySet<string>>;

export type Token =
  | { t: "text" | "fn" | "sym" | "math" | "str" | "num" | "code"; v: string }
  | { t: "kw"; v: string; k: KeywordKind }
  | { t: "comment"; c: Token[] };

export interface TokenizeOptions {
  // Header values and comments: math, symbols and code only.
  plain?: boolean;
  // Defaults to `DEFAULT_KEYWORDS`.
  keywords?: Keywords;
  // Names from `declaredFunctions`, styled where they are called.
  functions?: ReadonlySet<string>;
}

const TAB = 4;

// Close to the LaTeX `algorithmic` / `algpseudocode` / `algorithm2e` vocabulary.
export const DEFAULT_KEYWORDS: KeywordLists = {
  // Bold anywhere in a step.
  control:
    "if then else elif elsif elseif for foreach forall while do repeat until loop " +
    "switch case default otherwise try catch finally begin end " +
    "endif endfor endwhile endloop endswitch endfunction endprocedure " +
    "function procedure return break continue",
  // Only on a line that starts with for / foreach / forall, so "add x to S" stays plain.
  loop: "to downto from in each all by step parallel",
  // Only as the first word of a step, so "the error is small" stays plain.
  statement: "print read write input output call swap assert error throw raise yield goto exit halt",
  operator: "and or not xor mod",
  constant: "true false nil null",
};

export function compileKeywords(lists: KeywordLists): Keywords {
  const set = (s: string) => new Set(s.toLowerCase().split(/[\s,]+/).filter(Boolean));
  return {
    control: set(lists.control),
    loop: set(lists.loop),
    statement: set(lists.statement),
    operator: set(lists.operator),
    constant: set(lists.constant),
  };
}

const BUILT_IN = compileKeywords(DEFAULT_KEYWORDS);

const FOR_LINE = /^\s*(parallel\s+)?(for|foreach|forall)\b/i;

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

  // A block may start with its header rows: the title line was left empty.
  const untitled = lines.length > 0 && fieldOf(lines[0]) !== null;
  const first = untitled ? 0 : 1;

  // The two lines after the title are always header rows; labelled rows may follow them.
  const fields: Field[] = [];
  let at = first;
  for (; at < lines.length; at++) {
    const labelled = fieldOf(lines[at]);
    if (at > first + 1 && !labelled) break;
    const field = labelled ?? { label: at === first ? "Input" : "Output", value: lines[at].trim() };
    if (field.value && field.value !== "-") fields.push(field);
  }

  const rest = lines.slice(at).map((l) => expandTabs(l.trimEnd()));
  const indentOf = (l: string) => l.length - l.trimStart().length;
  const indents = rest.filter((l) => l.trim()).map(indentOf);
  const base = indents.length ? Math.min(...indents) : 0;
  const offsets = indents.map((n) => n - base).filter((n) => n > 0);
  const unit = offsets.length ? Math.min(...offsets) : TAB;

  return {
    title: untitled ? "" : (lines[0] ?? "").trim(),
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
// \$ | $math$ | //comment | `code` | "string" | symbol | Function( | function( | word | number
const INLINE =
  /\\\$|\$([^$\n]+)\$|\/\/(.*)$|`([^`\n]+)`|"[^"\n]*"|<=>|<->|<-|->|<=|>=|=>|!=|\.{3}|\b[A-Z][\w-]*(?=\()|\b[a-z_]\w*(?=\()|\b[A-Za-z]+\b|\b\d+(?:\.\d+)?\b/g;

// A name right after `function` / `procedure`.
const DECLARED_NAME = /\s+([A-Za-z_][\w-]*)/y;

// `end <- n`: a word that is assigned to is a variable, never a keyword.
const ASSIGNED = /^\s*(<-|:=|=(?![=>]))/;

export function tokenize(text: string, options: TokenizeOptions = {}): Token[] {
  const { plain = false, keywords = BUILT_IN, functions } = options;
  const forLine = FOR_LINE.test(text);
  const out: Token[] = [];
  let last = 0;
  const push = (t: Token) => {
    const prev = out[out.length - 1];
    if (t.t === "text" && prev && prev.t === "text") prev.v += t.v;
    else out.push(t);
  };
  const kindOf = (w: string, first: boolean): KeywordKind | null => {
    if (keywords.control.has(w)) return "control";
    if (keywords.operator.has(w)) return "operator";
    if (keywords.constant.has(w)) return "constant";
    if (forLine && keywords.loop.has(w)) return "control";
    return first && keywords.statement.has(w) ? "statement" : null;
  };

  const re = new RegExp(INLINE);
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const s = m[0];
    if (m.index > last) push({ t: "text", v: text.slice(last, m.index) });
    last = m.index + s.length;

    if (s === "\\$") push({ t: "text", v: "$" });
    else if (m[1] !== undefined) push({ t: "math", v: m[1] });
    else if (m[2] !== undefined) {
      const prev = out[out.length - 1];
      if (prev && prev.t === "text" && !(prev.v = prev.v.trimEnd())) out.pop();
      push({ t: "comment", c: tokenize(m[2].trim(), { plain: true }) });
    }
    else if (m[3] !== undefined) push({ t: "code", v: m[3] });
    else if (s[0] === '"') push({ t: plain ? "text" : "str", v: s });
    else if (SYMBOLS[s]) push({ t: "sym", v: SYMBOLS[s] });
    else if (plain) push({ t: "text", v: s });
    else if (/^\d/.test(s)) push({ t: "num", v: s });
    else {
      const w = s.toLowerCase();
      const kind = ASSIGNED.test(text.slice(last)) ? null : kindOf(w, !text.slice(0, m.index).trim());
      if (kind) {
        push({ t: "kw", v: s, k: kind });
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
