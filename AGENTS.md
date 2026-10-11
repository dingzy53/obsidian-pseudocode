# Plain Pseudocode: agent guide

Obsidian community plugin (TypeScript, bundled to `main.js` by esbuild). It renders ` ```algo ` code blocks as plain HTML text. Read `README.md` for the user-facing syntax.

## Layout

- `src/parse.ts`: pure parsing (`parse`, `parseGroup` for class blocks, `isSeparator`, `tokenize`, `opensBlock`) and the keyword lists (`DEFAULT_KEYWORDS`, `compileKeywords`). No imports.
- `src/snippets.ts`: pure snippet logic (`parseSnippets`, `matchSnippet`, `expand`). No imports.
- `src/link.ts`: pure note logic: `findFences` (the one definition of a fenced block, shared by the editor), and `blockLink` for the **Copy link to pseudocode block** command (the `^id` rules). Imports only `parse.ts`.
- `src/render.ts`: builds the DOM from a parsed model or a class group. The math renderer and the display options are injected.
- `src/editor.ts`: CodeMirror 6 extension: smart Enter, snippet expansion and tabstops. Everything is limited to ` ```algo ` fences, except snippets with the `n` option, which run in the note text. It gets the snippets through a getter, so it never imports the plugin.
- `src/settings.ts`: the `Settings` shape, its defaults and how it is stored. Pure, no `obsidian` import.
- `src/settings-tab.ts`: the settings tab, as setting definitions (the declarative API of Obsidian 1.13).
- `src/main.ts`: plugin lifecycle only (settings, code block processor, command, editor extension). Keep it small.
- `styles.css`: all styling, via Obsidian CSS variables. No inline styles except the `--algo-ln-w` and `--algo-font-size` variables.
- `test/*.test.ts`: `node:test` suites for `parse.ts`, `snippets.ts`, `settings.ts`, `link.ts` and `editor.ts`.

Each rendered block is a `MarkdownRenderChild` that the plugin keeps while it is on screen. `saveSettings` redraws them all, so every display setting goes through `render` options rather than global classes.

## Commands

```bash
npm ci            # install
npm run dev       # esbuild watch mode
npm run build     # tsc type-check + production bundle -> main.js
npm test          # unit tests (Node 22+, uses --experimental-strip-types)
npm run lint      # eslint with eslint-plugin-obsidianmd
```

Run `npm run lint && npm test && npm run build` before every commit. Lint must report nothing, warnings included: the community directory runs the same rules on every release and shows each warning on the plugin's page.

To try a build in a real vault, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/plain-pseudocode/` (leave `data.json` alone) and reload the plugin, for example with the Obsidian CLI: `obsidian plugin:reload id=plain-pseudocode`. The unit tests drive the editor through a stand-in view, so they do not cover real keyboard or input-method input.

## Rules

- **No runtime dependencies.** Only the `obsidian` API and the `@codemirror/*` packages Obsidian provides (kept external in `esbuild.config.mjs`). The `@codemirror/*` versions in `devDependencies` are pinned to Obsidian's peer versions, so do not bump them on their own.
- Relative imports in `src/` use the `.ts` extension, so Node can run the tests directly.
- Never use `innerHTML`, `outerHTML` or `insertAdjacentHTML`. Build DOM with `createEl` and text nodes.
- No hardcoded colours or fonts. Use Obsidian CSS variables so themes and snippets work.
- Do not log to the console except for real errors. Do not set default hotkeys. Use sentence case for UI text.
- Do not commit `main.js` or `node_modules/`.
- Do not change the plugin `id` (`plain-pseudocode`) or the `algo` code block language, which are public API.
- Add or update tests when changing `parse.ts`, `snippets.ts`, `settings.ts`, `link.ts` or `editor.ts`.
- Keyword lists and snippet text that equal their default are not written to `data.json` (`storedSettings`), so changed defaults reach users who never edited them. Keep it that way for any new text default.
- Syntax colours come from the theme's `--code-*` variables through the `--algo-*` variables in `styles.css`. A new token kind needs a class, a variable and a README line.
- Snippet definitions are data (JSON with comments). Never `eval` them or build functions from them.
- A test loads the `jsonc` example in `README.md`, so keep that block valid when the snippet format changes.
- The `algo` snippet and the **Insert pseudocode block** command create the same block (empty title, `Input:`, `Output:`). `parse` reads a block that starts with a labelled row as untitled; keep the three in step. The in-block `algo` snippet writes the same three rows after a `---` separator.
- A line of dashes inside an `algo` fence splits the block into a class (`parseGroup`). Header rows restart after it, in `parse` and in `blockAt` of `editor.ts`; keep the two in step.
- A `^id` after a fence only counts for Obsidian when a blank line (or the end of the note) follows it. `blockLink` adds that line; checked in a real vault, not just assumed.
- Keep the settings tab short: a new option must earn its row.

## Directory review

The community directory scans each release and publishes the result (see [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines), [Developer policies](https://docs.obsidian.md/Community+directory/Developer+policies) and [Migrate to declarative settings](https://docs.obsidian.md/plugins/guides/migrate-declarative-settings)). It has two parts: source code warnings, which must stay at zero, and behaviour disclosures, which are allowed when the feature needs them.

- **Type-check as the scan does.** `tsconfig.json` sets `"types": []`, so `@types/node` cannot add newer JavaScript to the types. With `lib` at ES2021 this means no `.at()`, `findLast`, `Object.hasOwn`, `structuredClone`, `toSorted` or other ES2022+ API in `src/`. The scan reads them as untyped and reports a row of `no-unsafe-*` warnings (it did for one `.at(-1)`). Do not raise `lib` or add types to get around it.
- **Obsidian API version.** `minAppVersion` is 1.13.0, the first version with setting definitions. An API with a later `@since` needs a `requireApiVersion("x.y.z")` guard around it, or a higher `minAppVersion` (`no-unsupported-api`).
- **Settings tab.** Settings are declared in `getSettingDefinitions()`, with no `display()`: that is what puts them in the Obsidian settings search. Prefer a `control` bound to a key. Use `render` only for a row that needs its own elements (the two restore buttons, the snippet box), and save in it yourself.
- **Saving settings.** `setControlValue` is overridden to go through `saveSettings`. The default writes the whole settings object, which would store default keyword and snippet text and skip the redraw. Keep the override for any new key, and call `this.update()` after changing a value from outside its control.
- **Clipboard.** Listed as a disclosure. Its one use is `copy` in `main.ts`, which writes the block link; nothing reads the clipboard. The README says so. Do not add another use without a need of the same kind.
- **Other disclosures** (network requests, Node or Electron APIs, files outside the vault, browser storage in place of `loadData`/`saveData`): the plugin has none and needs none. Adding one needs a reason a user would accept. The developer policies allow network use and files outside the vault only when the README explains them.
- **Never allowed by the policies:** obfuscated code, client-side telemetry, ads loaded over the network, and code that installs or updates the plugin or its dependencies.
- **Guideline habits the scan does not always catch:** `this.app` and never the global `app`; `async`/`await` rather than `.then()` chains; `setHeading()` or a group `heading` for settings headings, never HTML headings, and no "settings" in a heading; no default hotkeys; the plugin name and the word "command" stay out of command names and ids.

## Releasing

Releases are automatic on a tag push (`.github/workflows/release.yml`). The tag must equal `manifest.json` `version`, with **no `v` prefix**.

```bash
npm version patch   # or minor / major: bumps package.json, manifest.json and versions.json, commits, tags
git push --follow-tags
```

`.npmrc` sets `tag-version-prefix=""` so the tag is a bare `x.y.z`. Update `minAppVersion` in `manifest.json` by hand first if a newer Obsidian API is used. `versions.json` records it per release, so an older Obsidian keeps the last version it can run.

The workflow checks that tag, `manifest.json`, `package.json` and `versions.json` agree, then lints, tests and builds. It attests `main.js` and `styles.css` (the same shape as Obsidian's sample plugin) and publishes a GitHub release with exactly `main.js`, `manifest.json` and `styles.css`. Do not attach other files or attest more subjects: the directory's review flags extra assets and rejected a combined attestation.

## Submitting to the community directory (first release only)

Prerequisites are already in place: `README.md`, `LICENSE`, `manifest.json` at the repo root, and a release whose tag equals the manifest version. Then sign in at https://community.obsidian.md, link the GitHub account, and add the plugin. Later releases need no resubmission. The directory reads `manifest.json` from the default branch, and the `id` must be unique and must not contain `obsidian`.
