import { tokenize, type Model, type Token } from "./parse.ts";

// Builds a DOM node for `$tex$`. Injected so this file never depends on Obsidian.
export type MathFn = (tex: string) => Node;

function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

function appendTokens(parent: HTMLElement, tokens: Token[], math: MathFn): void {
  for (const tok of tokens) {
    switch (tok.t) {
      case "kw":
      case "fn":
        el(parent, "span", `algo-${tok.t}`, tok.v);
        break;
      case "math":
        parent.appendChild(math(tok.v));
        break;
      case "comment": {
        const c = el(parent, "span", "algo-comment", "▷ ");
        appendTokens(c, tok.c, math);
        break;
      }
      default:
        parent.appendChild(document.createTextNode(tok.v));
    }
  }
}

export function render(model: Model, root: HTMLElement, math: MathFn): void {
  const outer = el(root, "div", "algo");
  const box = el(outer, "div", "algo-box");
  const numbered = model.steps.filter((s) => !s.blank).length;
  box.style.setProperty("--algo-ln-w", `${String(numbered).length}ch`);

  if (model.title) el(box, "div", "algo-title", model.title);

  const io = [
    ["Input:", model.input],
    ["Output:", model.output],
  ].filter(([, v]) => v);
  if (io.length) {
    const grid = el(box, "div", "algo-io");
    for (const [label, value] of io) {
      el(grid, "span", "algo-io-label", label);
      appendTokens(el(grid, "span", "algo-io-value"), tokenize(value!, true), math);
    }
  }

  const body = el(box, "div", "algo-body");
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
    el(row, "span", "algo-ln", step.blank ? "" : String(++n));
    for (let k = 0; k < level; k++) el(row, "span", "algo-indent");
    if (!step.blank) appendTokens(el(row, "span", "algo-text"), tokenize(step.text), math);
  });
}
