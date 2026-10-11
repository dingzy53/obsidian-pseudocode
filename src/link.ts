// Pure note logic: where fenced blocks start and end, and which `^id` line a block can be linked by.

import { fieldOf, isSeparator } from "./parse.ts";

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

export interface Fence {
  algo: boolean;
  // Line numbers count from 0. `close` is null while the block is still open at the end of the text.
  open: number;
  close: number | null;
}

// Every fenced block in `lines`. A longer fence wraps shorter ones, and a tilde fence is not closed by backticks.
export function findFences(lines: Iterable<string>): Fence[] {
  const out: Fence[] = [];
  let mark = "";
  let current: Fence | null = null;
  let n = -1;
  for (const text of lines) {
    n++;
    const m = FENCE.exec(text);
    if (!m) continue;
    if (!current) {
      mark = m[1];
      current = { algo: /^\s*algo\b/.test(m[2]), open: n, close: null };
      out.push(current);
    } else if (m[1][0] === mark[0] && m[1].length >= mark.length && !m[2].trim()) {
      current.close = n;
      current = null;
    }
  }
  return out;
}

// Block identifiers hold Latin letters, digits and dashes.
const OWN_LINE = /^\s*(?:>\s*)?\^([A-Za-z0-9-]+)\s*$/;
const ANYWHERE = /(?:^|[\s>])\^([A-Za-z0-9-]+)\s*$/;

// `SiftUp(i)` becomes `SiftUp`, `Priority Queue` becomes `PriorityQueue`.
export function idFromTitle(title: string): string {
  const name = title.split("(")[0];
  const id = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9-]/g, ""))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")
    .replace(/^-+|-+$/g, "");
  return id || "Algo";
}

// The name shown in a link: the title as written, up to its argument list.
function aliasFromTitle(title: string): string {
  return title.split("(")[0].replace(/[[\]|^#]/g, "").trim();
}

// The title of a block: its first line, unless that line is a separator, a header row or empty.
function titleOf(lines: string[], fence: Fence): string {
  const first = lines[fence.open + 1] ?? "";
  if (fence.close === fence.open + 1 || isSeparator(first) || fieldOf(first)) return "";
  return first.trim();
}

export interface BlockLink {
  id: string;
  alias: string;
  // Set when the block has no id yet: the line to end the new text with, and the text.
  insert: { line: number; text: string } | null;
}

// What a link to the algo block around line `at` needs. Null outside a closed algo block.
export function blockLink(lines: string[], at: number): BlockLink | null {
  const fence = findFences(lines).find((f) => f.close !== null && f.open <= at && at <= f.close);
  if (!fence || !fence.algo || fence.close === null) return null;

  const title = titleOf(lines, fence);
  const alias = aliasFromTitle(title);
  const own = OWN_LINE.exec(lines[fence.close + 1] ?? "");
  if (own) return { id: own[1], alias: alias || own[1], insert: null };

  const taken = new Set<string>();
  for (const line of lines) {
    const m = ANYWHERE.exec(line);
    if (m) taken.add(m[1].toLowerCase());
  }
  const base = idFromTitle(title);
  let id = base;
  for (let n = 2; taken.has(id.toLowerCase()); n++) id = `${base}-${n}`;

  // Obsidian attaches the id to the block above it only when a blank line follows. Text or another
  // fence right after it would make the id line a paragraph of its own, with no link target.
  const next = lines[fence.close + 1];
  const gap = next !== undefined && next.trim() !== "";
  return { id, alias: alias || id, insert: { line: fence.close, text: `\n^${id}${gap ? "\n" : ""}` } };
}
