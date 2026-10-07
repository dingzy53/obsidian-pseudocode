# Plain Pseudocode

An Obsidian plugin that renders pseudocode as **plain text**: centred, line-numbered, with bold keywords and indentation guides.
No LaTeX, no images, no runtime dependencies, just Obsidian.

The source stays readable when unrendered, and indentation *is* the structure.

````
```algo
Binary Search
Input: sorted array $A[1..n]$, key $x$
Output: index $i$ with $A[i] = x$, or -1
lo <- 1, hi <- n
while lo <= hi do
    mid <- floor((lo + hi) / 2)
    if A[mid] = x then
        return mid
    else if A[mid] < x then
        lo <- mid + 1        // search right half
    else
        hi <- mid - 1
return -1
```
````

## Syntax

| Line | Meaning |
|---|---|
| 1 | Title (algorithm / statement name) |
| 2 | Input. The `Input:` prefix is optional. Leave it empty or write `-` to hide the row. |
| 3 | Output. The `Output:` prefix is optional. Same rules. |
| 4+ | Steps. Every non-blank line gets a line number. Blank lines are spacers. |

- **Indentation** sets nesting. Tabs, 2 spaces or 4 spaces all work.
- **Keywords** are bold: `if then else elif for foreach while do repeat until loop return break continue function procedure end and or not true false null nil`.
  On `for` lines, `to downto in each all by step` are bold too.
- **Symbols:** `<-` → ←, `->` → →, `<=` → ≤, `>=` → ≥, `!=` → ≠.
- **Comments:** `// text` renders as `▷ text` in muted italics.
- **Math:** `$x_i$` is rendered with Obsidian's built-in MathJax. Use `\$` for a literal dollar sign.
- **Function calls:** `Merge-Sort(A)` (capitalised, followed by `(`) is shown in small caps.

## Quick input

- Command **Insert pseudocode block** (bind it to a hotkey in *Settings → Hotkeys*) inserts the template with the title selected.
- Inside an `algo` block, **Enter** keeps the current indentation and adds one level after a line ending in `do`, `then`, `else`, `repeat`, `loop` or `:`, or starting with `function` / `procedure`. Elsewhere Enter is untouched.

## Styling

Colours and fonts follow your theme. Override any `.algo-*` rule (see `styles.css`) from a CSS snippet.

## Install

Copy `main.js`, `manifest.json` and `styles.css` from a release into `<vault>/.obsidian/plugins/plain-pseudocode/`, then enable the plugin. BRAT also works with this repository.

## Develop

```
npm install
npm test        # parser + smart-Enter tests
npm run build   # type-check and bundle to main.js
```
