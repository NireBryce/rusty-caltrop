# Wiki style guide

## Contents

- [Naming](#naming)
- [Every page opens with a Contents block](#every-page-opens-with-a-contents-block)
- [Content shape](#content-shape)
- [Linking](#linking)
- [See also](#see-also)

How `wiki/` itself is written, as distinct from the *repo's* conventions
(commit shape, `npm run` names, the `ship` flow — those live in
`AGENTS.md`). Read this before adding a page or a heading.

## Naming

kebab-case, matching the subject (`repo-init.md`, `dep-currency.md`).
`README.md` is reserved for a directory's own index — never a
single-topic page name (`docs-sync` skill states the same rule for
`docs/`).

## Every page opens with a Contents block

A bullet list of every `##` heading on the page, right after the title
and before any intro prose — a reader lands knowing the page's shape
before reading a word of it. Each link targets GitHub's own
heading-slug: lowercase, strip everything that isn't a letter, digit,
space, hyphen or underscore, then turn each remaining space into a
hyphen. Level-2 headings only (a page nesting steps under one `##` with
`###` stays a flat top-level list, not a full outline) — a heading
literally named "Contents" is excluded from its own list.

**Don't hand-derive a slug.** `scripts/check-wiki.mjs` implements the
exact algorithm and two checks that use it: `anchors` (every `#fragment`
link resolves to a real heading, anywhere in `wiki/` or `AGENTS.md`) and
`contents` (every page's Contents block still matches its own current
headings). Both run under `npm run wiki-lint`. After adding, renaming, or
removing a heading, regenerate rather than editing the list by hand:

```sh
node scripts/check-wiki.mjs gen-contents wiki/<the-page>.md
```

Idempotent — running it on an already-correct page is a no-op. Ported
from `NireBryce/nixos-configs`' `wiki/scripts/check_wiki.py`, after that
repo caught a hand-derived anchor that had quietly been wrong; this repo
adopts the same "verify, don't hand-derive" rule from the start rather
than waiting for its own instance of that bug.

## Content shape

- **Index over restatement.** Link to the real source — a module's own
  doc comment, `AGENTS.md`, a skill — rather than copying its content
  into the wiki page. If a page's prose balloons into arguing a fact
  instead of linking to it, that fact probably belongs in the linked
  file instead.
- **Dates are absolute** (`2026-09-01`, never "today" or "last week") —
  the only thing that lets a stale page be recognized as stale by its
  own text.
- **See also sections point both ways**: a page links to the siblings
  it's related to, and gets linked back from them — `wiki/README.md`'s
  own rule for keeping the wiki a graph instead of a flat pile.

## Linking

- Relative paths, recomputed for actual file depth if a page ever moves
  into a subdirectory.
- `npm run wiki-lint` (`scripts/check-wiki.mjs check`) verifies every
  relative link resolves to a real file and every `#fragment` resolves to
  a real heading — run it after editing links by hand, and expect
  `gen-contents` to have already fixed the Contents case.

## See also

- [Wiki index](README.md) — every other page; each one follows the rules
  above.
- AGENTS.md, Commands — `wiki-lint`'s place among the other `npm run`
  scripts, and why it isn't wired into `preflight`.
