import { PluginSettingTab, Setting, TextAreaComponent, type App } from "obsidian";
import type PlainPseudocode from "./main.ts";
import type { RenderOptions } from "./render.ts";
import { DEFAULT_SNIPPETS } from "./snippets.ts";

export interface Settings extends Omit<RenderOptions, "keywords"> {
  // Space-separated words.
  extraKeywords: string;
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
  extraKeywords: "",
  snippetsEnabled: true,
  snippets: DEFAULT_SNIPPETS,
};

const SNIPPET_GUIDE = "https://github.com/dingzy53/obsidian-pseudocode#snippets";

export function renderOptions(settings: Settings): RenderOptions {
  return { ...settings, keywords: new Set(settings.extraKeywords.toLowerCase().split(/[\s,]+/).filter(Boolean)) };
}

export class AlgoSettingTab extends PluginSettingTab {
  private plugin: PlainPseudocode;

  constructor(app: App, plugin: PlainPseudocode) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl, plugin } = this;
    const s = plugin.settings;
    const save = () => void plugin.saveSettings();
    const saveSnippets = () => void plugin.saveSettings(false);
    containerEl.empty();

    new Setting(containerEl)
      .setName("Alignment")
      .setDesc("Where a block sits across the width of the note.")
      .addDropdown((d) =>
        d
          .addOptions({ left: "Left", center: "Center", right: "Right" })
          .setValue(s.align)
          .onChange((v) => {
            s.align = v as Settings["align"];
            save();
          }),
      );

    new Setting(containerEl)
      .setName("Font size")
      .setDesc("Percent of the note's text size.")
      .addSlider((sl) =>
        sl
          .setLimits(70, 150, 5)
          .setValue(s.fontSize)
          .onChange((v) => {
            s.fontSize = v;
            save();
          }),
      );

    new Setting(containerEl)
      .setName("Font")
      .setDesc("Both follow your theme.")
      .addDropdown((d) =>
        d
          .addOptions({ text: "Text font", mono: "Monospace font" })
          .setValue(s.font)
          .onChange((v) => {
            s.font = v as Settings["font"];
            save();
          }),
      );

    new Setting(containerEl).setName("Line numbers").addToggle((t) =>
      t.setValue(s.lineNumbers).onChange((v) => {
        s.lineNumbers = v;
        save();
      }),
    );

    new Setting(containerEl)
      .setName("Indent guides")
      .setDesc("Vertical lines that mark each nesting level.")
      .addToggle((t) =>
        t.setValue(s.indentGuides).onChange((v) => {
          s.indentGuides = v;
          save();
        }),
      );

    new Setting(containerEl)
      .setName("Comments")
      .setDesc("Where a comment at the end of a step is placed.")
      .addDropdown((d) =>
        d
          .addOptions({ right: "Aligned to the right", inline: "Right after the step" })
          .setValue(s.commentAlign)
          .onChange((v) => {
            s.commentAlign = v as Settings["commentAlign"];
            save();
          }),
      );

    new Setting(containerEl)
      .setName("Comment marker")
      .setDesc("Shown in place of the two slashes. Leave empty for none.")
      .addText((t) =>
        t.setValue(s.commentMarker).onChange((v) => {
          s.commentMarker = v;
          save();
        }),
      );

    new Setting(containerEl)
      .setName("Extra keywords")
      .setDesc("More words to show in bold, separated by spaces.")
      .addText((t) =>
        t.setValue(s.extraKeywords).onChange((v) => {
          s.extraKeywords = v;
          save();
        }),
      );

    new Setting(containerEl).setName("Snippets").setHeading();

    new Setting(containerEl)
      .setName("Enable snippets")
      .setDesc("Expand triggers as you type inside a pseudocode block. Tab jumps to the next value.")
      .addToggle((t) =>
        t.setValue(s.snippetsEnabled).onChange((v) => {
          s.snippetsEnabled = v;
          saveSnippets();
        }),
      );

    const guide = createFragment((f) => {
      f.appendText("A list of triggers and their replacements. ");
      f.createEl("a", { text: "See the snippet guide", href: SNIPPET_GUIDE });
      f.appendText(" for the format and a complete example.");
    });
    const apply = (text: string) => {
      s.snippets = text;
      const error = plugin.loadSnippets();
      status.setText(error ? `Not applied: ${error}` : `${plugin.snippets.length} active.`);
      status.toggleClass("mod-warning", error !== null);
    };

    new Setting(containerEl)
      .setName("Snippet definitions")
      .setDesc(guide)
      .addButton((b) =>
        b.setButtonText("Restore default").onClick(() => {
          area.setValue(DEFAULT_SNIPPETS);
          apply(DEFAULT_SNIPPETS);
          saveSnippets();
        }),
      );

    const area = new TextAreaComponent(containerEl);
    area.inputEl.addClass("algo-snippets-input");
    area.inputEl.spellcheck = false;
    area.setValue(s.snippets).onChange((v) => {
      apply(v);
      saveSnippets();
    });
    const status = containerEl.createDiv({ cls: "setting-item-description algo-snippets-status" });
    apply(s.snippets);
  }
}
