# PLAN: fix obsidian / CodeMirror peer dependency conflict on fresh install

> Branch: `fix/codemirror-peer-deps` (from `main`) · Date: 2026-11-23 · Status: Planned (not yet implemented).

## Context & Symptom

On `main`, running `npm install` or adding a devDependency (such as `wdio-obsidian-service`) fails with `npm error code ERESOLVE`:

- Root `package.json` pins `"@codemirror/state": "6.5.0"` and `"@codemirror/view": "6.38.6"`, while declaring `"obsidian": "latest"`.
- `npm` resolves `"obsidian": "latest"` to `1.14.4`, whose `peerDependencies` require `@codemirror/state@"6.7.6"` and `@codemirror/view@"6.43.13"`, causing `ERESOLVE unable to resolve dependency tree`.

## Verified Root Cause (`package.json` & `package-lock.json`)

1. `package.json:30-43` specifies:
   - `"@codemirror/language": "^6.11.0"`
   - `"@codemirror/state": "6.5.0"`
   - `"@codemirror/view": "6.38.6"`
   - `"obsidian": "latest"`
2. `package-lock.json` originally locked `obsidian@1.13.1` (whose `peerDependencies` matched `@codemirror/state: "6.5.0"` and `@codemirror/view: "6.38.6"`).
3. After `obsidian@1.14.4` became `latest` on npm with updated CodeMirror peer pins (`6.7.6` / `6.43.13`), floating `"obsidian": "latest"` in `package.json` broke clean dependency resolution whenever `npm install` re-evaluates `package.json`.

## Proposed Fix Design

### 1. Pin `"obsidian"` instead of floating `"latest"` (`package.json`)

- Replace `"obsidian": "latest"` with an explicit version pin in `devDependencies` (recommended: `"1.14.4"` to match `obsidian-equation-refs`, or `"1.13.1"` if preferring to lock types to `minAppVersion: "1.13.0"`).

### 2. Align CodeMirror `devDependencies` with the pinned `obsidian` peerDependencies (`package.json`)

- For `"obsidian": "1.14.4"`:
  - `"@codemirror/state": "6.7.6"`
  - `"@codemirror/view": "6.43.13"`
  - `"@codemirror/language": "^6.13.1"`
- Check `src/editor.ts` and `test/editor.test.ts` for any CodeMirror 6 API or type differences after updating.
- Keep `manifest.json` `minAppVersion: "1.13.0"` unchanged unless a newer runtime Obsidian API is introduced, and keep `@codemirror/*` external in `esbuild.config.mjs` so runtime continues using Obsidian's bundled CodeMirror.

### 3. Regenerate `package-lock.json` cleanly

- Run `npm install` (without `--legacy-peer-deps` or `--force`) so `package-lock.json` resolves cleanly on any machine and in CI.

## Order of Work

1. `[ ]` Pin `"obsidian"` and align `@codemirror/state`, `@codemirror/view`, and `@codemirror/language` in `package.json`.
2. `[ ]` Regenerate `package-lock.json` via `npm install` and verify zero `ERESOLVE` warnings/errors.
3. `[ ]` Check `src/editor.ts` and `test/editor.test.ts` against the updated types.

## Verification Plan

- `rm -rf node_modules && npm ci`
- `npm install --package-lock-only` (confirm clean peer resolution without `--legacy-peer-deps`)
- `npm run lint`
- `npm test` (`node --experimental-strip-types --test "test/*.test.ts"`)
- `npm run build` (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`)
