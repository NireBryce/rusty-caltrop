#!/usr/bin/env node
// Static checks of wiki/'s own browsability mechanics: every relative
// markdown link resolves to a real file, every #fragment resolves to a
// real heading (GitHub's own slug algorithm, not a hand-derived guess),
// and every page's `## Contents` block still matches its own headings.
// Ported from NireBryce/nixos-configs' wiki/scripts/check_wiki.py, scoped
// down to the three checks that are fully mechanical and apply with no
// repo-specific table structure -- that script's other checks (imports,
// category/host tables, `just` recipe names, sops key enrollment, caddy
// routes) verify wiki claims against structures (a category tree, a hosts
// list, a reverse proxy) this repo doesn't have.
//
//     check-wiki.mjs check        # links + anchors + contents. Exit 1 on
//                                  # any finding. What `npm run wiki-lint`
//                                  # runs.
//     check-wiki.mjs gen-contents <file.md> [file.md ...]
//                                  # rewrites each page's `## Contents`
//                                  # block in place to match its current
//                                  # headings -- the fix for a STALE
//                                  # CONTENTS finding. Idempotent. Not run
//                                  # by `check`, since it writes files
//                                  # rather than reporting (same split as
//                                  # this repo's --fix review flows).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(SCRIPT_DIR);

// Every markdown file these checks scan: all of wiki/ plus AGENTS.md
// itself, which links into wiki/ pages too (CLAUDE.md is a symlink to it,
// so checking AGENTS.md once covers both names).
async function docFiles() {
  const entries = await readdir(path.join(ROOT, 'wiki'), { recursive: true, withFileTypes: true });
  const wikiFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
  return [...wikiFiles, path.join(ROOT, 'AGENTS.md')];
}

const FENCE = /^(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;

// Yields {level, text} for every real heading line, in document order,
// skipping anything inside a fenced code block -- without fence tracking a
// shell comment like `# opt-in local hooks` inside a ```sh block (see
// repo-init.md's "Fresh clone setup") would be misread as a level-1
// heading.
function* iterHeadings(text) {
  let inFence = false;
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING.exec(line);
    if (m) yield { level: m[1].length, text: m[2] };
  }
}

// GitHub's own heading-anchor algorithm -- reverse-engineered against real
// rendered output, not assumed: lowercase, drop every character that isn't
// a letter/digit/space/hyphen/underscore (backticks, colons, periods,
// em-dashes, quotes all just disappear, nothing put in their place), then
// turn each remaining space into a hyphen. `seen` is a Map this function
// mutates so repeated headings on one page get GitHub's own `-1`/`-2`
// suffix instead of colliding -- pass a fresh Map per page, fed every
// heading on that page in document order, not per heading.
function githubSlug(raw, seen) {
  let s = raw.toLowerCase();
  // Explicit membership test, not a char-class range: `[a-z0-9 -_]` reads
  // as innocuous but " -_" is itself a range (space through underscore in
  // ASCII), which let punctuation like commas through silently.
  s = [...s].filter((c) => /[a-z0-9]/.test(c) || c === ' ' || c === '-' || c === '_').join('');
  s = s.replace(/ /g, '-');
  const n = seen.get(s) ?? 0;
  seen.set(s, n + 1);
  return n === 0 ? s : `${s}-${n}`;
}

async function pageAnchors(file) {
  const text = await readFile(file, 'utf8');
  const seen = new Map();
  return new Set([...iterHeadings(text)].map(({ text: t }) => githubSlug(t, seen)));
}

const MD_LINK = /\[[^\]]*\]\(([^)]+)\)/g;

// Every relative markdown link across wiki/ and AGENTS.md resolves to a
// real file. Skips http(s)/mailto targets and a pure in-page anchor
// (`(#see-also)`, no file component). Percent-decodes the target first, so
// a path with an encoded space is checked as the real path it is.
async function checkLinks(files) {
  const findings = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const m of text.matchAll(MD_LINK)) {
      const target = m[1].trim();
      if (/^(https?:|mailto:)/.test(target)) continue;
      const [filePart] = target.split('#');
      if (filePart === '') continue;
      const resolved = path.resolve(path.dirname(file), decodeURIComponent(filePart));
      try {
        await readFile(resolved);
      } catch {
        findings.push(`BROKEN LINK  ${path.relative(ROOT, file)}: (${target}) -> ` +
          `${path.relative(ROOT, resolved)} does not exist`);
      }
    }
  }
  return findings;
}

// Every #fragment on a markdown link -- same-file or into another page --
// resolves to a real heading on the target page, per githubSlug above.
// This is the half checkLinks deliberately doesn't check (its own header
// says so): the file half only.
async function checkAnchors(files) {
  const cache = new Map();
  const findings = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const m of text.matchAll(MD_LINK)) {
      const target = m[1].trim();
      if (/^(https?:|mailto:)/.test(target)) continue;
      if (!target.includes('#')) continue;
      const [filePart, frag] = target.split('#').map(decodeURIComponent);
      if (!frag) continue; // a bare (#) with nothing after it -- not real
      const resolved = filePart === '' ? file : path.resolve(path.dirname(file), filePart);
      if (!cache.has(resolved)) {
        try {
          cache.set(resolved, await pageAnchors(resolved));
        } catch {
          continue; // checkLinks already reports the missing file
        }
      }
      if (!cache.get(resolved).has(frag)) {
        findings.push(`BROKEN ANCHOR  ${path.relative(ROOT, file)}: (${target}) -> ` +
          `${path.relative(ROOT, resolved)} has no heading matching #${frag}`);
      }
    }
  }
  return findings;
}

const CONTENTS_HEADING = /^##\s+Contents\s*$/m;
const CONTENTS_ITEM = /^-\s+\[(.+)\]\(#([^)]+)\)\s*$/gm;
const NEXT_HEADING = /^##\s+/m;

// [[headingText, slug], ...] a fresh `## Contents` block for this page
// should list, in document order -- level-2 headings only, excluding
// "Contents" itself. Slugs every heading on the page (not just level-2)
// so GitHub's per-page dedup counter lands on the right ones even though
// only level-2 headings make it into the returned list; see
// wiki/styleguide.md for why Contents is H2-only (a page nesting steps
// under one H2 stays a flat top-level list, not a full outline).
function expectedContentsItems(text) {
  const seen = new Map();
  const items = [];
  for (const { level, text: t } of iterHeadings(text)) {
    const slug = githubSlug(t, seen);
    if (level === 2 && t.trim() !== 'Contents') items.push([t, slug]);
  }
  return items;
}

// [[headingText, slug], ...] a page's existing `## Contents` block
// actually lists, read back from the file -- or null if the page has no
// such section.
function actualContentsItems(text) {
  const m = CONTENTS_HEADING.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const end = NEXT_HEADING.exec(rest);
  const section = end ? rest.slice(0, end.index) : rest;
  return [...section.matchAll(CONTENTS_ITEM)].map((mm) => [mm[1], mm[2]]);
}

function sameItems(a, b) {
  return a.length === b.length && a.every(([t, s], i) => t === b[i][0] && s === b[i][1]);
}

// Every page's `## Contents` block matches what expectedContentsItems
// would generate from its own headings right now -- catches a heading
// renamed, added, or removed without the list above it following along.
// Skips a page with no `## Contents` section rather than demanding every
// page have one.
async function checkContents(wikiFiles) {
  const findings = [];
  for (const file of wikiFiles) {
    const text = await readFile(file, 'utf8');
    const actual = actualContentsItems(text);
    if (actual === null) continue;
    if (!sameItems(actual, expectedContentsItems(text))) {
      findings.push(`STALE CONTENTS  ${path.relative(ROOT, file)}: its '## Contents' ` +
        `list doesn't match its own headings -- fix with \`gen-contents ${path.relative(ROOT, file)}\``);
    }
  }
  return findings;
}

// Rewrites `file`'s `## Contents` block in place to match its current
// headings -- inserting one right after the title if it doesn't have one
// yet. Idempotent. Replaces ONLY the contiguous run of `- [text](#slug)`
// lines right after the heading, never "everything up to the next ##" --
// several pages put a line of intro prose between Contents and the first
// real section, and that span-based approach would delete it.
async function regenerateContents(file) {
  const text = await readFile(file, 'utf8');
  const items = expectedContentsItems(text);
  const block = `## Contents\n\n${items.map(([t, s]) => `- [${t}](#${s})`).join('\n')}\n`;
  const m = CONTENTS_HEADING.exec(text);
  let newText;
  if (m) {
    const rest = text.slice(m.index + m[0].length);
    const lines = rest.split(/(?<=\n)/);
    let i = 0;
    while (i < lines.length && lines[i].trim() === '') i++;
    while (i < lines.length && /^-\s+\[.+\]\(#[^)]+\)\s*$/.test(lines[i].trimEnd())) i++;
    const tail = m.index + m[0].length + lines.slice(0, i).join('').length;
    newText = text.slice(0, m.index) + block + text.slice(tail);
  } else {
    const lines = text.split(/(?<=\n)/);
    if (!lines[0]?.startsWith('# ')) {
      console.log(`SKIP ${path.relative(ROOT, file)}: no '# Title' line to insert Contents after`);
      return;
    }
    let insertAt = 1;
    while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
    newText = lines.slice(0, insertAt).join('') + block + '\n' + lines.slice(insertAt).join('');
  }
  if (newText !== text) await writeFile(file, newText);
}

const [, , cmd, ...args] = process.argv;

if (cmd === 'gen-contents') {
  if (args.length === 0) {
    console.log('usage: check-wiki.mjs gen-contents <file.md> [file.md ...]');
    process.exit(1);
  }
  for (const p of args) await regenerateContents(path.resolve(p));
} else if (cmd === 'check' || cmd === undefined) {
  const files = await docFiles();
  const wikiFiles = files.filter((f) => f !== path.join(ROOT, 'AGENTS.md'));
  const findings = [
    ...(await checkLinks(files)),
    ...(await checkAnchors(files)),
    ...(await checkContents(wikiFiles)),
  ];
  if (findings.length === 0) {
    console.log('check-wiki: no findings');
  } else {
    for (const f of findings) console.log(f);
    console.log(`check-wiki: ${findings.length} finding(s)`);
    process.exit(1);
  }
} else {
  console.log('usage: check-wiki.mjs [check | gen-contents <file.md> ...]');
  process.exit(1);
}
