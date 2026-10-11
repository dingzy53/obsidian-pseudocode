import { PluginSettingTab, TextAreaComponent, type App, type Setting, type SettingDefinitionItem } from "obsidian";
import type PlainPseudocode from "./main.ts";
import { DEFAULT_KEYWORDS, type KeywordGroup } from "./parse.ts";
import type { Settings } from "./settings.ts";
import { DEFAULT_SNIPPETS } from "./snippets.ts";

const LIST = "keywords.";
const SNIPPET_GUIDE = "https://github.com/dingzy53/obsidian-pseudocode#snippets";

// A control is bound to a setting by its key. A keyword list is one level down, hence the dot.
type Key = Exclude<keyof Settings, "keywords" | "snippets"> | `keywords.${KeywordGroup}`;

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

  getSettingDefinitions(): SettingDefinitionItem<Key>[] {
    return [
      {
        name: "Alignment",
        desc: "Where a block sits across the width of the note.",
        control: { type: "dropdown", key: "align", options: { left: "Left", center: "Center", right: "Right" } },
      },
      {
        name: "Font size",
        desc: "Percent of the note's text size.",
        control: { type: "slider", key: "fontSize", min: 70, max: 150, step: 5 },
      },
      {
        name: "Font",
        desc: "Both follow your theme.",
        control: { type: "dropdown", key: "font", options: { text: "Text font", mono: "Monospace font" } },
      },
      { name: "Line numbers", control: { type: "toggle", key: "lineNumbers" } },
      {
        name: "Indent guides",
        desc: "Vertical lines that mark each nesting level.",
        control: { type: "toggle", key: "indentGuides" },
      },
      {
        name: "Syntax colors",
        desc: "Give keywords, names, numbers and text in quotes the colors your theme uses for code. Turn off for plain black and white.",
        control: { type: "toggle", key: "colors" },
      },
      {
        name: "Comments",
        desc: "Where a comment at the end of a step is placed.",
        control: {
          type: "dropdown",
          key: "commentAlign",
          options: { right: "Aligned to the right", inline: "Right after the step" },
        },
      },
      {
        name: "Comment marker",
        desc: "Shown in place of the two slashes. Leave empty for none.",
        control: { type: "text", key: "commentMarker" },
      },
      {
        type: "group",
        heading: "Keywords",
        cls: "algo-keywords",
        items: [
          {
            name: "Word lists",
            desc: "Words are separated by spaces, in any letter case. Each list has its own color.",
            render: (setting) => this.restoreKeywords(setting),
          },
          ...KEYWORD_ROWS.map(([group, name, desc]) => ({
            name,
            desc,
            control: { type: "textarea" as const, key: `keywords.${group}` as const, rows: 3 },
          })),
        ],
      },
      {
        type: "group",
        heading: "Snippets",
        items: [
          {
            name: "Enable snippets",
            desc: "Expand triggers as you type. Tab jumps to the next value.",
            control: { type: "toggle", key: "snippetsEnabled" },
          },
          {
            name: "Snippet definitions",
            desc: createFragment((f) => {
              f.appendText("A list of triggers and their replacements. ");
              f.createEl("a", { text: "See the snippet guide", href: SNIPPET_GUIDE });
              f.appendText(" for the format and a complete example.");
            }),
            render: (setting) => this.snippetEditor(setting),
          },
        ],
      },
    ];
  }

  getControlValue(key: Key): unknown {
    const s = this.plugin.settings;
    return key.startsWith(LIST) ? s.keywords[key.slice(LIST.length) as KeywordGroup] : s[key as keyof Settings];
  }

  // The default writes every setting to disk. Ours goes through `saveSettings`, which leaves out
  // text that equals its default and redraws the blocks on screen.
  setControlValue(key: Key, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    if (key.startsWith(LIST)) s.keywords = { ...s.keywords, [key.slice(LIST.length)]: value };
    else Object.assign(s, { [key]: value });
    return this.plugin.saveSettings(key !== "snippetsEnabled");
  }

  private restoreKeywords(setting: Setting) {
    setting.addButton((b) =>
      b.setButtonText("Restore defaults").onClick(() => {
        this.plugin.settings.keywords = { ...DEFAULT_KEYWORDS };
        void this.plugin.saveSettings();
        this.update();
      }),
    );
  }

  // The definitions are kept as typed, mistakes included, so a half-written edit survives closing the tab.
  private snippetEditor(setting: Setting) {
    const { plugin } = this;
    const apply = (text: string) => {
      plugin.settings.snippets = text;
      const error = plugin.loadSnippets();
      status.setText(error ? `Not applied: ${error}` : `${plugin.snippets.length} active.`);
      status.toggleClass("mod-warning", error !== null);
    };
    const change = (text: string) => {
      apply(text);
      void plugin.saveSettings(false);
    };

    setting.settingEl.addClass("algo-snippets-row");
    setting.addButton((b) =>
      b.setButtonText("Restore default").onClick(() => {
        area.setValue(DEFAULT_SNIPPETS);
        change(DEFAULT_SNIPPETS);
      }),
    );
    const area = new TextAreaComponent(setting.settingEl);
    area.inputEl.addClass("algo-snippets-input");
    area.inputEl.spellcheck = false;
    area.setValue(plugin.settings.snippets).onChange(change);
    const status = setting.settingEl.createDiv({ cls: "setting-item-description algo-snippets-status" });
    apply(plugin.settings.snippets);

    return () => {
      area.inputEl.remove();
      status.remove();
      setting.settingEl.removeClass("algo-snippets-row");
    };
  }
}
