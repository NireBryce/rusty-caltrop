# Work in progress

## Contents

- [What this page is](#what-this-page-is)
- [Open threads](#open-threads)
- [Resolved threads](#resolved-threads)
- [See also](#see-also)

## What this page is

Every other page in `wiki/` is a finished narrative: a thing that happened,
written up once it's over. This page is the opposite — a running list of
things noticed mid-work that aren't finished, aren't yet a GitHub issue
(`propose-issue` skill), and aren't yet solid enough to be a fact in
`AGENTS.md` or a full article here. A thread lands here the moment it's
noticed, with a date, and leaves the moment it resolves — into a commit, an
issue, an `AGENTS.md` entry, another wiki page, or a deliberate "not doing
this" — at which point its bullet moves to
[Resolved threads](#resolved-threads) with one line on where it landed.

The `work-in-progress` skill (`.claude/skills/work-in-progress/SKILL.md`)
is what keeps this mechanical: add a thread when you notice one, move it
when it closes, don't let it rot open once the work it names is actually
done. `npm run wiki-lint` still checks this page's own mechanics (links,
anchors, the Contents block) same as any other — see
[styleguide.md](styleguide.md).

## Open threads

- **`startRafLoop` has never run in a real browser.** `src/raf.ts` is only
  exercised indirectly — `src/loop.test.ts` covers `GameLoop`'s
  accumulator math, not `requestAnimationFrame`/`performance.now()`
  themselves. Per AGENTS.md's "Typecheck passing proves typecheck passing"
  trap, this module has climbed typecheck → lint → tests → build and
  stopped there; nothing has driven it in a real page. No demo/example
  exists yet to run it against. Noticed 2026-09-01.
- **No renderer or actual game content exists yet.** The engine so far is
  one primitive (the fixed-timestep loop, [fixed-timestep-loop.md](fixed-timestep-loop.md))
  plus its browser driver — README's "Currently" line says the whole
  story. Nothing turns a `tick`/`update`/`render` cycle into pixels.
  Whether the next module is a renderer, an ECS, or something else is
  undecided. Noticed 2026-09-01.
- **`wiki-lint` runs by hand only.** Deliberately not wired into
  `preflight` or CI (AGENTS.md, Commands) — a reasoned choice, not an
  oversight — but that means a stale page can sit unnoticed between
  whenever someone last ran it and whenever they next think to. Worth
  revisiting whether that's still the right call once the wiki has grown
  past its current five narrative pages. Noticed 2026-09-01.
- **README's Development section doesn't mention the opt-in git hooks.**
  `repo-init.md`'s "Fresh clone setup" has
  `git config core.hooksPath .githooks`; README's Development section —
  the section an actual fresh clone reads — doesn't carry it forward, so
  a clone that never opens the wiki never gets the pre-commit fast-feedback
  layer. Might be deliberate (README stays terse and CI is the real
  backstop per `.githooks/pre-commit`'s own header) rather than an
  oversight — parked here instead of resolved on the spot. Noticed
  2026-09-01.
- **`.vscode/` is untracked but not gitignored.** Nothing has committed it
  so far, but `.gitignore` stops `node_modules/`, `dist/`, `.direnv/`, and
  `result` by name and says nothing about `.vscode/` — a future
  `git add .` in an editor session could pull in local editor config.
  Noticed 2026-09-01.

## Resolved threads

None yet — this page opened 2026-09-01. When a thread above closes, its
bullet moves here as a single line: what it was, where it landed, when.

## See also

- [Wiki index](README.md)
- [Wiki style guide](styleguide.md) — the mechanics (`## Contents`,
  linking, `npm run wiki-lint`) this page follows same as any other.
- [The fixed-timestep loop](fixed-timestep-loop.md) — `src/raf.ts`'s
  unrun-in-a-browser thread above is about this page's own subject.
- [Repo init](repo-init.md) — the fresh-clone hooks thread above is about
  its "Fresh clone setup" section.
- `propose-issue` skill — where a thread goes if it turns out to deserve a
  tracked GitHub issue instead of staying here.
- `docs-sync` skill — the sibling discipline for docs that describe
  *current* facts, as opposed to this page's open questions.
