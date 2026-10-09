import { PluginSettingTab, Setting, TextAreaComponent, type App } from "obsidian";
import type PlainPseudocode from "./main.ts";
import { DEFAULT_KEYWORDS, type KeywordGroup } from "./parse.ts";
import type { Settings } from "./settings.ts";
import { DEFAULT_SNIPPETS } from "./snippets.ts";

const SNIPPET_GUIDE = "https://github.com/dingzy53/obsidian-pseudocode#snippets";

// One row per keyword list: name, and where its words are bold.
const KEYWORD_ROWS: [KeywordGroup, string, string][] = [
  ["control", "Control flow", "Bold anywhere in a step."],
  ["loop", "Loop words", "Bold only on a line that starts with for, foreach or forall."],
  ["statement", "Statements", "Bold only as the first word of a step."],
  ["operator", "Operators", "Bold anywhere in a step."],
  ["constant", "Constants", "Bold anywhere in a step."],
];

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

    const toggle = (name: string, desc: string, key: "lineNumbers" | "indentGuides" | "colors") =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle((t) =>
          t.setValue(s[key]).onChange((v) => {
            s[key] = v;
            save();
          }),
        );

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

    toggle("Line numbers", "", "lineNumbers");
    toggle("Indent guides", "Vertical lines that mark each nesting level.", "indentGuides");
    toggle(
      "Syntax colors",
      "Give keywords, names, numbers and text in quotes the colors your theme uses for code. Turn off for plain black and white.",
      "colors",
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

    const lists: Partial<Record<KeywordGroup, TextAreaComponent>> = {};
    new Setting(containerEl)
      .setName("Keywords")
      .setDesc("Words are separated by spaces, in any letter case. Each list has its own color.")
      .setHeading()
      .addButton((b) =>
        b.setButtonText("Restore defaults").onClick(() => {
          s.keywords = { ...DEFAULT_KEYWORDS };
          for (const [group] of KEYWORD_ROWS) lists[group]?.setValue(DEFAULT_KEYWORDS[group]);
          save();
        }),
      );

    for (const [group, name, desc] of KEYWORD_ROWS) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addTextArea((t) => {
          lists[group] = t;
          t.inputEl.addClass("algo-keywords-input");
          t.inputEl.spellcheck = false;
          t.setValue(s.keywords[group]).onChange((v) => {
            s.keywords = { ...s.keywords, [group]: v };
            save();
          });
        });
    }

    new Setting(containerEl).setName("Snippets").setHeading();

    new Setting(containerEl)
      .setName("Enable snippets")
      .setDesc("Expand triggers as you type. Tab jumps to the next value.")
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
