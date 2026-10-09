import { declaredFunctions, tokenize, type Model, type Token } from "./parse.ts";

// Builds a DOM node for `$tex$`. Injected so rendering never touches MathJax directly.
export type MathFn = (tex: string) => Node;

export interface RenderOptions {
  align: "left" | "center" | "right";
  // Percent of the surrounding text size.
  fontSize: number;
  font: "text" | "mono";
  lineNumbers: boolean;
  indentGuides: boolean;
  commentAlign: "right" | "inline";
  commentMarker: string;
  // Extra bold words, lower case.
  keywords: ReadonlySet<string>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  return parent.createEl(tag, { cls, text });
}

export function render(model: Model, root: HTMLElement, math: MathFn, options: RenderOptions): void {
  const marker = options.commentMarker.trim();

  const appendComment = (parent: HTMLElement, tokens: Token[], cls: string) => {
    // A no-break space, so a wrapped comment never leaves its marker behind.
    appendTokens(el(parent, "span", cls, marker ? `${marker}\u00a0` : ""), tokens);
  };

  const appendTokens = (parent: HTMLElement, tokens: Token[]) => {
    for (const tok of tokens) {
      switch (tok.t) {
        case "kw":
        case "fn":
        case "str":
          el(parent, "span", `algo-${tok.t}`, tok.v);
          break;
        case "code":
          el(parent, "code", "algo-code", tok.v);
          break;
        case "math":
          parent.appendChild(math(tok.v));
          break;
        case "comment":
          appendComment(parent, tok.c, "algo-comment");
          break;
        default:
          parent.appendChild(document.createTextNode(tok.v));
      }
    }
  };

  const classes = ["algo", `algo-${options.align}`];
  if (options.font === "mono") classes.push("algo-mono");
  if (!options.indentGuides) classes.push("algo-no-guides");
  const outer = el(root, "div", classes.join(" "));
  if (options.fontSize !== 100) outer.style.setProperty("--algo-font-size", `${options.fontSize / 100}em`);

  const box = el(outer, "div", "algo-box");
  const numbered = model.steps.filter((s) => !s.blank).length;
  box.style.setProperty("--algo-ln-w", `${String(numbered).length}ch`);

  if (model.title) el(box, "div", "algo-title", model.title);

  if (model.fields.length) {
    const grid = el(box, "div", "algo-io");
    for (const { label, value } of model.fields) {
      el(grid, "span", "algo-io-label", `${label}:`);
      appendTokens(el(grid, "span", "algo-io-value"), tokenize(value, { plain: true }));
    }
  }

  const body = el(box, "div", "algo-body");
  const tokenizeOptions = { keywords: options.keywords, functions: declaredFunctions(model.steps) };
  let n = 0;
  model.steps.forEach((step, i) => {
    let level = step.level;
    if (step.blank) {
      // Keep scope guides unbroken across a spacer row.
      const prev = model.steps[i - 1];
      const next = model.steps.slice(i + 1).find((s) => !s.blank);
      level = prev && next ? Math.min(prev.blank ? 0 : prev.level, next.level) : 0;
    }
    const row = el(body, "div", step.blank ? "algo-line algo-blank" : "algo-line");
    if (options.lineNumbers) el(row, "span", "algo-ln", step.blank ? "" : String(++n));
    for (let k = 0; k < level; k++) el(row, "span", "algo-indent");
    if (step.blank) return;

    const tokens = tokenize(step.text, tokenizeOptions);
    const last = tokens[tokens.length - 1];
    if (last.t === "comment" && tokens.length === 1) {
      // A comment on its own line stays where it is written.
      appendComment(el(row, "span", "algo-text"), last.c, "algo-comment algo-comment-alone");
    } else if (last.t === "comment" && options.commentAlign === "right") {
      // A comment after a step goes to the right edge, or below the step when both do not fit.
      const content = el(row, "span", "algo-content");
      appendTokens(el(content, "span", "algo-text"), tokens.slice(0, -1));
      appendComment(content, last.c, "algo-comment algo-comment-right");
    } else {
      appendTokens(el(row, "span", "algo-text"), tokens);
    }
  });
}
