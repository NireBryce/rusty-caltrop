# Dependency currency and `check-deps`

## Contents

- [The incident](#the-incident)
- [The rule](#the-rule)
- [The judgement calls](#the-judgement-calls)
- [Future deps](#future-deps)
- [See also](#see-also)

How this repo keeps `package.json` from rotting, and the incident that
bought the rule — same day the first manifest was written, 2026-08-31.

## The incident

The repo's first `package.json` was authored fresh, and its dependency
ranges were chosen as "known-good major": eslint `^9.0.0`, typescript
`^5.6.0`, vitest `^3.0.0`. All of it installed cleanly and resolved —
and npm immediately warned that eslint 9.39.5, the newest 9.x, is
deprecated and unsupported, with 10.x current. Nothing was broken; that
is the trap. "Installs and resolves" is not "current", and a manifest
written today has no excuse for yesterday's majors. The versions were
picked from habit rather than from the registry — the one source of
truth for what current means.

## The rule

**A dependency added or edited is added at the current latest major.**
Enforced by `npm run check-deps` (`scripts/check-dep-versions.mjs`),
the fourth step of preflight and of CI: for every registry dependency,
the script compares the declared range's major against npm's `latest`
dist-tag and fails behind it, printing the declared spec, the current
version, and the exact fix command. A dep that lands on a PR below
current goes red on that PR — the closest a repo can get to checking
"at the moment of addition".

## The judgement calls

- **Majors only.** Minors and patches ride the caret range and arrive
  with `npm install`; deprecations and breaking changes land on majors.
  Comparing minors would make the check churn without catching what it
  exists to catch.
- **Exceptions are code, with reasons and exit conditions.** Two deps
  may legitimately sit behind npm's latest major, listed in
  `ALLOWED_BEHIND_LATEST` in the script: `@types/node` tracks the
  *runtime* major (`nodejs_24` in `flake.nix`, node 24 in CI) — newer
  type packages describe APIs the engine never runs on; and
  `typescript` caps below 7 because typescript-eslint's peer range
  does, with no stable TypeScript 6 existing to bridge. Each entry says
  what would let it come off the list. An exception without a reason is
  just rot with a permission slip.
- **The check can't tell "just added" from "drifted since", and
  doesn't try.** Every run re-audits everything against the registry's
  *current* answer, so additions are caught immediately and slow drift
  within one cycle too. The cost is that preflight needs the network —
  recorded in AGENTS.md's Commands.

## Future deps

The mechanics generalize: add the dep at current (`npm i pkg@latest`
does this), and if a deliberate ceiling is ever needed, it goes in
`ALLOWED_BEHIND_LATEST` with its reason — nowhere else. `npm outdated`
still exists for within-major bumps; the check is about majors, not
about pinning every patch.

## See also

- [Wiki index](README.md)
- [lint-ratchet.md](lint-ratchet.md) — the other preflight check added
  the same week, same "exception is code, with a reason" convention.
- [repo-init.md](repo-init.md) — the landing `check-deps` shipped with.
