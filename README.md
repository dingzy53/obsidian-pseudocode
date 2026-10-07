# Plain Pseudocode

Write pseudocode as plain indented text in Obsidian and get a centred, line-numbered block with bold keywords and indentation guides. Rendering is pure text: no LaTeX, no images, no dependencies.

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

- **Line 1** is the title, **line 2** the input and **line 3** the output. The `Input:` and `Output:` prefixes are optional, and an empty value or `-` hides the row.
- **Line 4 onwards** are the steps. Each non-blank line is numbered, and indentation (tabs, 2 or 4 spaces) sets the nesting.
- Keywords such as `if then else for while do repeat until return function and or not` are bold. On `for` lines, `to downto in each all by step` are bold too.
- `<-` `->` `<=` `>=` `!=` become ← → ≤ ≥ ≠.
- `// text` becomes a muted `▷ text` comment.
- `$x_i$` is rendered with Obsidian's built-in math. Use `\$` for a literal dollar sign.
- `Merge-Sort(A)` (capitalised, followed by `(`) is shown in small caps.

## Quick input

- Run **Insert pseudocode block** from the command palette (bind it to a hotkey under **Settings → Hotkeys**).
- Inside an `algo` block, **Enter** keeps the indentation and adds a level after a line ending in `do`, `then`, `else`, `repeat`, `loop` or `:`.

## Install

Search for **Plain Pseudocode** under **Settings → Community plugins → Browse**. To install manually, download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest) into `<vault>/.obsidian/plugins/plain-pseudocode/` and enable the plugin.

## Styling

Colours and fonts follow your theme. Override any `.algo-*` rule from a CSS snippet (see `styles.css`).

## License

[MIT](LICENSE)
