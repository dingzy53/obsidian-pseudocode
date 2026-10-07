# Plain Pseudocode: agent guide

Obsidian community plugin (TypeScript, bundled to `main.js` by esbuild). It renders ` ```algo ` code blocks as plain HTML text. Read `README.md` for the user-facing syntax.

## Layout

- `src/parse.ts`: pure parsing (`parse`, `tokenize`, `opensBlock`). No imports.
- `src/render.ts`: builds the DOM from a parsed model. The math renderer is injected.
- `src/editor.ts`: CodeMirror 6 smart-Enter keymap, active only inside ` ```algo ` fences.
- `src/main.ts`: plugin lifecycle only (code block processor, command, editor extension). Keep it small.
- `styles.css`: all styling, via Obsidian CSS variables. No inline styles except the `--algo-ln-w` variable.
- `test/*.test.ts`: `node:test` suites for `parse.ts` and `editor.ts`.

## Commands

```bash
npm ci            # install
npm run dev       # esbuild watch mode
npm run build     # tsc type-check + production bundle -> main.js
npm test          # unit tests (Node 22+, uses --experimental-strip-types)
npm run lint      # eslint with eslint-plugin-obsidianmd
```

Run `npm run lint && npm test && npm run build` before every commit.

## Rules

- **No runtime dependencies.** Only the `obsidian` API and the `@codemirror/*` packages Obsidian provides (kept external in `esbuild.config.mjs`). The `@codemirror/*` versions in `devDependencies` are pinned to Obsidian's peer versions, so do not bump them on their own.
- Relative imports in `src/` use the `.ts` extension, so Node can run the tests directly.
- Never use `innerHTML`, `outerHTML` or `insertAdjacentHTML`. Build DOM with `createEl` and text nodes.
- No hardcoded colours or fonts. Use Obsidian CSS variables so themes and snippets work.
- Do not log to the console except for real errors. Do not set default hotkeys. Use sentence case for UI text.
- Do not commit `main.js` or `node_modules/`.
- Do not change the plugin `id` (`plain-pseudocode`) or the `algo` code block language, which are public API.
- Add or update tests when changing `parse.ts` or `editor.ts`.

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
