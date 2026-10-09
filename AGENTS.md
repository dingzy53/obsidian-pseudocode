# Plain Pseudocode: agent guide

Obsidian community plugin (TypeScript, bundled to `main.js` by esbuild). It renders ` ```algo ` code blocks as plain HTML text. Read `README.md` for the user-facing syntax.

## Layout

- `src/parse.ts`: pure parsing (`parse`, `tokenize`, `opensBlock`) and the keyword lists (`DEFAULT_KEYWORDS`, `compileKeywords`). No imports.
- `src/snippets.ts`: pure snippet logic (`parseSnippets`, `matchSnippet`, `expand`). No imports.
- `src/render.ts`: builds the DOM from a parsed model. The math renderer and the display options are injected.
- `src/editor.ts`: CodeMirror 6 extension: smart Enter, snippet expansion and tabstops. Everything is limited to ` ```algo ` fences, except snippets with the `n` option, which run in the note text. It gets the snippets through a getter, so it never imports the plugin.
- `src/settings.ts`: the `Settings` shape, its defaults and how it is stored. Pure, no `obsidian` import.
- `src/settings-tab.ts`: the settings tab.
- `src/main.ts`: plugin lifecycle only (settings, code block processor, command, editor extension). Keep it small.
- `styles.css`: all styling, via Obsidian CSS variables. No inline styles except the `--algo-ln-w` and `--algo-font-size` variables.
- `test/*.test.ts`: `node:test` suites for `parse.ts`, `snippets.ts`, `settings.ts` and `editor.ts`.

Each rendered block is a `MarkdownRenderChild` that the plugin keeps while it is on screen. `saveSettings` redraws them all, so every display setting goes through `render` options rather than global classes.

## Commands

```bash
npm ci            # install
npm run dev       # esbuild watch mode
npm run build     # tsc type-check + production bundle -> main.js
npm test          # unit tests (Node 22+, uses --experimental-strip-types)
npm run lint      # eslint with eslint-plugin-obsidianmd
```

Run `npm run lint && npm test && npm run build` before every commit. Lint reports one known warning (`prefer-setting-definitions`): the declarative settings API needs Obsidian 1.13, above the current `minAppVersion`.

To try a build in a real vault, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/plain-pseudocode/` (leave `data.json` alone) and reload the plugin, for example with the Obsidian CLI: `obsidian plugin:reload id=plain-pseudocode`. The unit tests drive the editor through a stand-in view, so they do not cover real keyboard or input-method input.

## Rules

- **No runtime dependencies.** Only the `obsidian` API and the `@codemirror/*` packages Obsidian provides (kept external in `esbuild.config.mjs`). The `@codemirror/*` versions in `devDependencies` are pinned to Obsidian's peer versions, so do not bump them on their own.
- Relative imports in `src/` use the `.ts` extension, so Node can run the tests directly.
- Never use `innerHTML`, `outerHTML` or `insertAdjacentHTML`. Build DOM with `createEl` and text nodes.
- No hardcoded colours or fonts. Use Obsidian CSS variables so themes and snippets work.
- Do not log to the console except for real errors. Do not set default hotkeys. Use sentence case for UI text.
- Do not commit `main.js` or `node_modules/`.
- Do not change the plugin `id` (`plain-pseudocode`) or the `algo` code block language, which are public API.
- Add or update tests when changing `parse.ts`, `snippets.ts`, `settings.ts` or `editor.ts`.
- Keyword lists and snippet text that equal their default are not written to `data.json` (`storedSettings`), so changed defaults reach users who never edited them. Keep it that way for any new text default.
- Syntax colours come from the theme's `--code-*` variables through the `--algo-*` variables in `styles.css`. A new token kind needs a class, a variable and a README line.
- Snippet definitions are data (JSON with comments). Never `eval` them or build functions from them.
- A test loads the `jsonc` example in `README.md`, so keep that block valid when the snippet format changes.
- The `algo` snippet and the **Insert pseudocode block** command create the same block (empty title, `Input:`, `Output:`). `parse` reads a block that starts with a labelled row as untitled; keep the three in step.
- Keep the settings tab short: a new option must earn its row.

## Releasing

Releases are automatic on a tag push (`.github/workflows/release.yml`). The tag must equal `manifest.json` `version`, with **no `v` prefix**.

```bash
npm version patch   # or minor / major: bumps package.json, manifest.json and versions.json, commits, tags
git push --follow-tags
```

`.npmrc` sets `tag-version-prefix=""` so the tag is a bare `x.y.z`. Update `minAppVersion` in `manifest.json` by hand first if a newer Obsidian API is used.

The workflow checks that tag, `manifest.json`, `package.json` and `versions.json` agree, then lints, tests and builds. It attests `main.js` and `styles.css` (the same shape as Obsidian's sample plugin) and publishes a GitHub release with exactly `main.js`, `manifest.json` and `styles.css`. Do not attach other files or attest more subjects: the directory's review flags extra assets and rejected a combined attestation.

## Submitting to the community directory (first release only)

Prerequisites are already in place: `README.md`, `LICENSE`, `manifest.json` at the repo root, and a release whose tag equals the manifest version. Then sign in at https://community.obsidian.md, link the GitHub account, and add the plugin. Later releases need no resubmission. The directory reads `manifest.json` from the default branch, and the `id` must be unique and must not contain `obsidian`.
