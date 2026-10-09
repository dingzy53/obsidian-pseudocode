import { MarkdownRenderChild, Plugin, finishRenderMath, loadMathJax, renderMath } from "obsidian";
import { algoEditor } from "./editor.ts";
import { parse } from "./parse.ts";
import { render, type MathFn } from "./render.ts";
import { AlgoSettingTab, DEFAULT_SETTINGS, renderOptions, type Settings } from "./settings.ts";
import { parseSnippets, type Snippet } from "./snippets.ts";

const TEMPLATE = "```algo\nAlgorithm name\nInput: \nOutput: \n\n```\n";

// One rendered block. Kept by the plugin while it is on screen, so a settings change can redraw it.
class AlgoBlock extends MarkdownRenderChild {
  private plugin: PlainPseudocode;
  private source: string;

  constructor(el: HTMLElement, plugin: PlainPseudocode, source: string) {
    super(el);
    this.plugin = plugin;
    this.source = source;
  }

  onload() {
    this.plugin.blocks.add(this);
  }

  onunload() {
    this.plugin.blocks.delete(this);
  }

  async draw() {
    let math: MathFn = (tex) => document.createTextNode(`$${tex}$`);
    let usedMath = false;
    if (this.source.includes("$")) {
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
    // Nothing is awaited between clearing and filling, so overlapping redraws cannot double up.
    this.containerEl.empty();
    render(parse(this.source), this.containerEl, math, renderOptions(this.plugin.settings));
    if (usedMath) await finishRenderMath();
  }
}

export default class PlainPseudocode extends Plugin {
  settings: Settings = DEFAULT_SETTINGS;
  snippets: Snippet[] = [];
  blocks = new Set<AlgoBlock>();

  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<Settings> | null) };
    this.loadSnippets();
    this.addSettingTab(new AlgoSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor("algo", (source, el, ctx) => {
      const block = new AlgoBlock(el, this, source);
      ctx.addChild(block);
      return block.draw();
    });

    this.registerEditorExtension(algoEditor(() => (this.settings.snippetsEnabled ? this.snippets : [])));

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

  // Reads the snippet text from the settings. On a mistake the last working set stays active.
  loadSnippets(): string | null {
    const { snippets, error } = parseSnippets(this.settings.snippets);
    if (error === null) this.snippets = snippets;
    return error;
  }

  // `redraw` is for settings that change how a block looks.
  async saveSettings(redraw = true) {
    await this.saveData(this.settings);
    if (redraw) for (const block of this.blocks) void block.draw();
  }
}
