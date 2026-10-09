# Plain Pseudocode

Write pseudocode as plain indented text in Obsidian and get a centred, line-numbered block with bold, coloured keywords, indentation guides and right-aligned comments. Rendering is pure text: no LaTeX, no images, no dependencies.

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
        hi <- mid - 1        // search left half
return -1
```
````

## Syntax

The source stays readable as plain text. Nothing below needs a backslash command.

### Header

- **Line 1** is the title, **line 2** the input and **line 3** the output. The `Input:` and `Output:` labels are optional, and an empty value or `-` hides the row.
- Write another label to have it shown instead: `Require:`, `Ensure:`, `Data:`, `Result:`, `Parameters:`, `Returns:`, `Precondition:`, `Postcondition:` or `Globals:`.
- More labelled rows may follow line 3. The first line without one of these labels is step 1.
- Line 1 may stay empty: a block that starts with `Input:` (or another label) simply has no title.

````
```algo
Heap insert
Require: a min-heap $H$ of size $n$
Ensure: $H$ is a min-heap of size $n + 1$
Data: key $k$
H[n + 1] <- k
```
````

### Steps

Each non-blank line is a numbered step, and indentation (tabs, 2 or 4 spaces) sets the nesting. A blank line leaves a small gap.

| You write | You get |
| --- | --- |
| A keyword (see [Keywords](#keywords)) | Bold, in the colour of its kind. |
| `<-` `->` `<->` `<=` `>=` `!=` `=>` `<=>` `...` | ← → ↔ ≤ ≥ ≠ ⇒ ⇔ … |
| `42`, `3.14` | A number, coloured. |
| `// text` | A muted `▷ text` comment. After a step it is aligned to the right edge of the block. On a line of its own it stays in place. |
| `$x_i$` | Obsidian's built-in math. Use `\$` for a literal dollar sign. |
| `Merge-Sort(A)` | A capitalised name followed by `(` is shown in small caps. |
| `function merge_sort(A)` | The name after `function` or `procedure` is shown in small caps, and so are later calls such as `merge_sort(B)`. |
| `"if not found"` | Text in double quotes is left alone: no bold keywords inside. Coloured. |
| `` `x` `` | Inline code. |

### Keywords

There are five lists of keywords, close to what the LaTeX `algorithmic` packages use. Every list can be edited under **Settings → Plain Pseudocode → Keywords**: add words, remove them, or replace them all, for example with keywords in your own language. Letter case does not matter.

| List | Default words | Where they count |
| --- | --- | --- |
| Control flow | `if then else elif elsif elseif` `for foreach forall while do repeat until loop` `switch case default otherwise` `try catch finally` `begin end endif endfor endwhile endloop endswitch endfunction endprocedure` `function procedure return break continue` | Anywhere in a step. |
| Loop words | `to downto from in each all by step parallel` | Only on a line that starts with `for`, `foreach` or `forall`, so "add x to S" stays plain. Shown like control flow. |
| Statements | `print read write input output call swap assert error throw raise yield goto exit halt` | Only as the first word of a step, so "the error is small" stays plain. |
| Operators | `and or not xor mod` | Anywhere in a step. |
| Constants | `true false nil null` | Anywhere in a step. |

A word that is assigned to is never a keyword, so `end <- n` and `step = 2` keep their variables plain.

### Colours

Keywords are bold, as in LaTeX, and each kind of token also gets a colour. The colours are the ones your theme uses for code, so they fit light and dark themes alike. Turn **Syntax colors** off in the settings for the plain black-and-white look.

To pick your own colours, set these variables from a CSS snippet:

```css
.algo-colors {
  --algo-control: var(--color-blue);    /* control flow and loop words */
  --algo-statement: var(--color-cyan);  /* print, swap, error, ... */
  --algo-operator: var(--color-red);    /* and, or, not, mod */
  --algo-constant: var(--color-purple); /* true, false, nil */
  --algo-number: var(--color-purple);
  --algo-function: var(--color-yellow); /* function names */
  --algo-string: var(--color-green);    /* "text in quotes" */
  --algo-comment: var(--text-muted);
}
```

## Quick input

- Type `algo` and a space (or `algo` and **Tab**) at the start of a line in your note to create a block. The cursor waits on the empty title line. **Enter** or **Tab** then moves to `Input:`, to `Output:` and to the first step.
- Or run **Insert pseudocode block** from the command palette (bind it to a hotkey under **Settings → Hotkeys**). It inserts the same block, with the cursor on the empty title line.
- Inside an `algo` block, **Enter** keeps the indentation. It adds a level after a line ending in `do`, `then`, `else`, `repeat`, `loop`, `begin` or `:`, and after a loop or branch header such as `for i from 1 to n` or `while x > 0`.
- Type `for` and a space (or `for` and **Tab**) at the start of a line to get `for i from 1 to n`, with `i` selected. Type over it, then press **Tab** for `1` and again for `n`.
- Type `mk` to get `$$` with the cursor between the dollars. **Tab** jumps out of the math.
- `algo`, `for` and `mk` are the three built-in snippets. You can change them and add your own.

## Snippets

Snippets expand a short trigger into a longer line with values to fill in, as in [LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite). They run on every line of an `algo` block. Only a snippet with the `n` option runs in the rest of your note, and never inside another code block.

LaTeX Suite itself does nothing inside a code block, and an `algo` block is one. So the snippets you want there, `mk` and your math shortcuts included, are defined here.

Edit them under **Settings → Plain Pseudocode → Snippet definitions**. The text is a JSON list, with `//` comments and trailing commas allowed. A mistake is reported under the box, and your last working snippets stay active until it is fixed.

### One snippet

```json
{ "trigger": "for ", "replacement": "for ${0:i} from ${1:1} to ${2:n}", "options": "Ab" }
```

| Field | Meaning |
| --- | --- |
| `trigger` | The text to type. Case matters. |
| `replacement` | What it turns into. |
| `options` | Optional letters, in any order (see below). |

| Option | Meaning |
| --- | --- |
| `A` | Automatic: expands as soon as the trigger is typed. Without it, type the trigger and press **Tab**. **Tab** works for automatic snippets too, and there it does not need the space a trigger ends with. |
| `b` | Only at the beginning of a line (after the indentation). |
| `w` | Only as a whole word: `len` expands, the end of `maxlen` does not. |
| `r` | The trigger is a regular expression. |
| `m` | Only inside math, between two `$`. |
| `t` | Only outside math. |
| `n` | For the note: runs in the text around your blocks instead of inside them. |

Inside `replacement`:

| You write | Meaning |
| --- | --- |
| `$0`, `$1`, `$2` | Tabstops. The cursor starts at the lowest number, and **Tab** moves to the next one. **Shift+Tab** moves back. After the last one, **Tab** jumps to the end of the snippet. A last tabstop that is empty ends the snippet as soon as the cursor gets there. |
| `${0:i}` | A tabstop with a default value. The value is selected, so typing replaces it and **Tab** keeps it. |
| the same number twice | Linked tabstops: they are selected together and you type into all of them at once. A bare `$0` repeats the default of `${0:i}`. |
| `\n` | A new line at the indentation of the current line. |
| `\t` | One more level of indentation. |
| `[[0]]`, `[[1]]` | With `r`: the first and second capture group of the trigger. |
| `\\$` | A literal dollar sign, where it would otherwise read as a tabstop. Math such as `$n$` or `$x_i$` needs no escaping: only `$` followed by a digit or by `{` and a digit is a tabstop. |

**Enter** accepts the values that are left and starts the next line. On a header row, **Enter** moves to the next value instead, like **Tab**. A snippet can be expanded inside a tabstop of another one: when it is done, **Tab** carries on with the outer snippet. Editing somewhere else, moving the cursor away or **Undo** ends a snippet, and **Tab** is a normal Tab again.

When several triggers match, the one listed first wins. **Undo** right after an automatic expansion gives back the text you typed. Because this is JSON, a backslash in a regular expression is written twice: `\\d` for a digit.

### A complete example

Paste this over the definitions to try everything out.

```jsonc
[
  // The default. "A" expands it without Tab, "b" keeps it to the start of a line.
  // The trigger ends with a space, so "foreach", "forall" and "format" can still be typed.
  // Result: for i from 1 to n     (i selected, Tab goes to 1, then to n)
  { "trigger": "for ", "replacement": "for ${0:i} from ${1:1} to ${2:n}", "options": "Ab" },

  // The default that creates a block. "n" makes it run in the note, outside any code block.
  // Enter or Tab moves from the title ($0) to the input, the output and the first step.
  { "trigger": "algo ", "replacement": "```algo\\n$0\\nInput: $1\\nOutput: $2\\n$3\\n```", "options": "Abn" },

  // Another default. "t" keeps it out of math, so $mk$ can still be typed.
  // Result: $$ with the cursor between the dollars, then Tab to continue after the math.
  { "trigger": "mk", "replacement": "$${0}$ $1", "options": "At" },

  // No "A": type "fore" and press Tab.
  // \n starts a new line, \t indents it. $2 is an empty tabstop inside the loop body.
  { "trigger": "fore", "replacement": "for each ${0:x} in ${1:S} do\n\t$2", "options": "b" },

  { "trigger": "wh", "replacement": "while ${0:condition} do\n\t$1", "options": "b" },

  // Several lines. The numbers set the order, not the position:
  // the condition is filled in first, then both branches from top to bottom.
  { "trigger": "ife", "replacement": "if ${0:condition} then\n\t$1\nelse\n\t$2", "options": "b" },

  { "trigger": "fn", "replacement": "function ${0:Name}(${1:args})\n\t$2\n\treturn ${3:result}", "options": "b" },

  // Linked tabstops: both $0 are typed at once.
  // Result: i <- i + 1
  { "trigger": "inc", "replacement": "${0:i} <- $0 + ${1:1}", "options": "b" },

  // "w": a whole word only. "len" + Tab expands, "maxlen" + Tab does not.
  { "trigger": "len", "replacement": "length(${0:A})", "options": "w" },

  // Automatic, anywhere on the line. The replacement is math, and its dollars need no escaping.
  { "trigger": "ooo", "replacement": "$\\infty$", "options": "A" },

  // "m": only inside math. Typing sr between two dollars gives ^2.
  { "trigger": "sr", "replacement": "^2", "options": "Am" },
  { "trigger": "leq", "replacement": "\\leq ", "options": "Am" },

  // Inside math, a letter followed by a digit becomes a subscript: a1 gives a_1.
  { "trigger": "([A-Za-z])(\\d)", "replacement": "[[0]]_[[1]]", "options": "Arm" },

  // "r": a regular expression. [[0]] is the first group in ( ).
  // Typing i++ gives: i <- i + 1
  { "trigger": "(\\w+)\\+\\+", "replacement": "[[0]] <- [[0]] + 1", "options": "Ar" },

  // Two groups. Type a12 and press Tab to get the math $a_{12}$.
  { "trigger": "([A-Za-z])(\\d+)", "replacement": "$[[0]]_{[[1]]}$", "options": "rw" },

  // A literal dollar in front of a tabstop is written \\$.
  // Result: cost $5
  { "trigger": "cost", "replacement": "cost \\$${0:5}", "options": "w" },
]
```

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Alignment | Center | Puts the block on the left, in the centre or on the right of the note. |
| Font size | 100 | Percent of the note's text size. |
| Font | Text font | The theme's text font or its monospace font. |
| Line numbers | On | Numbers each step. |
| Indent guides | On | Vertical lines that mark each nesting level. |
| Syntax colors | On | Colours each kind of token. Off gives black and white. See [Colours](#colours). |
| Comments | Aligned to the right | Or right after the step, as in earlier versions. |
| Comment marker | `▷` | Shown in place of `//`. |
| Keywords | five lists | The words to show in bold. See [Keywords](#keywords). |
| Enable snippets | On | Turns all snippets off without deleting them. |
| Snippet definitions | `algo`, `for` and `mk` | See [Snippets](#snippets). |

Changes apply at once to every block that is open.

## Install

Search for **Plain Pseudocode** under **Settings → Community plugins → Browse**. To install manually, download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest) into `<vault>/.obsidian/plugins/plain-pseudocode/` and enable the plugin.

## Styling

Colours and fonts follow your theme. Override any `.algo-*` rule from a CSS snippet (see `styles.css`), or just the [colour variables](#colours).

## License

[MIT](LICENSE)
