import { Plugin, finishRenderMath, loadMathJax, renderMath } from "obsidian";
import { algoEnter } from "./editor.ts";
import { parse } from "./parse.ts";
import { render, type MathFn } from "./render.ts";

const TEMPLATE = "```algo\nAlgorithm name\nInput: \nOutput: \n\n```\n";

export default class PlainPseudocode extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("algo", async (source, el) => {
      let math: MathFn = (tex) => document.createTextNode(`$${tex}$`);
      let usedMath = false;
      if (source.includes("$")) {
        try {
          await loadMathJax();
          math = (tex) => {
            usedMath = true;
            return renderMath(tex, false);
          };
        } catch (e) {
          console.error("plain-pseudocode: MathJax unavailable", e);
        }
      }
      render(parse(source), el, math);
      if (usedMath) await finishRenderMath();
    });

    this.registerEditorExtension(algoEnter);

    this.addCommand({
      id: "insert-pseudocode-block",
      name: "Insert pseudocode block",
      editorCallback: (editor) => {
        const cur = editor.getCursor();
        const lead = cur.ch > 0 && editor.getLine(cur.line).trim() ? "\n" : "";
        editor.replaceSelection(lead + TEMPLATE);
        const titleLine = cur.line + (lead ? 1 : 0) + 1;
        editor.setSelection(
          { line: titleLine, ch: 0 },
          { line: titleLine, ch: editor.getLine(titleLine).length },
        );
      },
    });
  }
}
