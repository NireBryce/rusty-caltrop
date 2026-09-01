# Wiki

## Contents

- [Pages](#pages)
- [Keeping this from rotting](#keeping-this-from-rotting)

A topic index over `wiki/`'s narrative articles — the story behind a change,
as opposed to `AGENTS.md`'s current-state facts and commands. Nothing here
restates what a page says; this is a link layer so a reader (or an agent)
can find the right article without already knowing its filename.

**Not a replacement for `AGENTS.md`.** `AGENTS.md` is still the entry point
and the one thing worth reading cold before touching this repo. This index
exists for once you already know roughly what you're after.

## Pages

In the order they landed:

- [Repo init](repo-init.md) — how the repo went from an empty GitHub
  project to a working scaffold: the one deliberate direct push to `main`,
  the PR flow since, and the CI trap that shipped in PR #1.
- [The fixed-timestep loop](fixed-timestep-loop.md) — `src/loop.ts`'s
  accumulator mechanism, the clamp and the spiral of death it prevents,
  and how a caller drives it without the loop owning any timer.
- [Dependency currency and `check-deps`](dep-currency.md) — the incident
  that bought the "add at current latest major" rule, and the exceptions
  that are allowed to sit behind it.
- [The lint ratchet](lint-ratchet.md) — where `npm run lint`'s three
  checks (`eslint` strict tier, `knip`, oversized files) came from, and
  why they're ratcheted against a baseline instead of just required to
  pass.
- [Wiki style guide](styleguide.md) — this wiki's own house style: naming,
  the per-page Contents block and how `npm run wiki-lint` keeps it and
  every link honest, and content shape.

## Keeping this from rotting

Same rule as everywhere else in this repo: whichever change makes a page
stale — a fact it states, a file it links to — corrects that page in the
same change, not as a follow-up (`docs-sync` skill). A new page gets a
line here and a "See also" link to and from whichever existing page it's
most related to, so the wiki stays a graph a reader can walk instead of a
flat pile only findable by directory listing.
