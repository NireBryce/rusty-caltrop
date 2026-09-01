---
name: work-in-progress
description: How to record active work as a thread on wiki/work-in-progress.md, and keep that entry current as the work progresses or closes.
---

# Tracking work in progress

## Applies to

Two moments, both in this repo:

- **You notice a hanging thread** — something incomplete, undecided, or
  unverified — while doing something else, and it's not yet solid enough
  to be a GitHub issue (`propose-issue`), an `AGENTS.md` fact, or a wiki
  article. Add it.
- **A thread already on the page changes state** — you made progress on
  it, or it's actually done. Update it in the same change that made it
  true, not as a follow-up (same discipline `docs-sync` holds itself to).

Doesn't apply to routine work with nothing open at the end — most changes
don't leave a thread behind, and manufacturing one to have something to
write defeats the page's purpose. Skip it. Also doesn't apply once
something is solid enough to be a fact: a verified, working feature
belongs in `AGENTS.md` or a wiki article, not left dangling here after
it's actually true.

## The page

[wiki/work-in-progress.md](../../wiki/work-in-progress.md) — two sections
that matter, both `##` headings so `npm run wiki-lint` keeps their anchors
honest:

- **Open threads** — a bullet list, one thread per bullet.
- **Resolved threads** — where a bullet moves once it closes.

Read the page's own "What this page is" section before editing it; this
skill is the mechanical half, that section is the intent.

## Opening a thread

Append one bullet to **Open threads**:

```md
- **Short bold title.** One or two sentences: what's incomplete or open,
  and why it matters. Noticed YYYY-MM-DD.
```

- **Title is bold, short, and names the thing**, not the observation —
  `**"startRafLoop" has never run in a real browser.**`, not `**Found a
  gap in raf.ts.**` Match the existing bullets' shape.
- **Date is absolute** (wiki/styleguide.md's rule, same as every other
  page) — "noticed" here, not "opened" or "filed", since that's the verb
  the page's own prose uses.
- **Cite real files and commands**, not impressions — the same discipline
  AGENTS.md asks of everything else here. If citing another wiki page or
  `AGENTS.md` section, that's fine inline; it doesn't need its own See
  also entry unless the relationship is substantial enough that the other
  page should link back (see below).
- Run `node scripts/check-wiki.mjs gen-contents wiki/work-in-progress.md`
  only if you changed a heading — appending a bullet under an existing
  `##` doesn't touch the Contents block, so most edits need no regen.

## Progressing a thread

If a thread isn't closed but the open question has narrowed (an option's
been ruled out, a fix is half-landed, a decision's been made but not yet
executed), edit its bullet in place to say the current state — don't
append a second bullet for the same thread, and don't let the "noticed"
date drift; add a second sentence instead of replacing the first if the
history of what was tried is worth keeping.

## Resolving a thread

When a thread's work actually lands — verified the way AGENTS.md's Traps
section insists (a real run, not just a reasoned conclusion) — move its
line from **Open threads** to **Resolved threads**, compressed to one
line:

```md
- **Short bold title.** Landed in <commit/PR/file>. YYYY-MM-DD.
```

Delete the bullet from Open threads in the same edit; don't leave it in
both places. If the thread resolved into something durable — a fact
`AGENTS.md` now states, a new wiki article, a filed issue — say where it
landed, so a reader can follow it further. If it resolved as "not doing
this", say that plainly instead of pretending it wasn't real.

## Keeping cross-links honest

If a thread is substantially about another wiki page's subject (like
[fixed-timestep-loop.md](../../wiki/fixed-timestep-loop.md)'s relation to
the `startRafLoop` thread), add a one-line mention to both pages' `## See
also` sections — the reciprocal-linking rule wiki/styleguide.md states for
every page, this one included. Not required for every thread; most won't
warrant it.

## Verify before finishing

`npm run wiki-lint` after any edit to the page — it catches a broken link,
a bad anchor, or (if a heading changed) a stale Contents block. This
script isn't wired into `preflight`, so it won't run itself; running it is
part of this skill, not optional cleanup.

## See also

- [wiki/work-in-progress.md](../../wiki/work-in-progress.md) — the page
  itself.
- `docs-sync` skill — same "fix it in the change that makes it stale"
  discipline, for docs that state current facts rather than open threads.
- `propose-issue` skill — where a thread goes if it turns out to deserve a
  tracked GitHub issue instead of staying on this page.
- `new-skill` skill — followed to write this file; read it before editing
  this skill's own frontmatter.
