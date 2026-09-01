# The lint ratchet: `eslint` (strict) + `knip` + oversized files

Where `npm run lint`'s three checks came from, and why they're ratcheted
against a baseline instead of just required to pass — 2026-08-31.

## Origin

`eslint.config.js` shipped with the fixed-timestep loop extending only
`typescript-eslint`'s `recommended` config — the floor tier, mostly typos
and dead syntax. Looking at `NireBryce/nixos-configs` for lint practice to
generalize turned up `flake/scripts/lint.py`: statix + deadnix +
an oversized-file check, each counted and compared against a committed
baseline rather than required to be zero. Its own header explains why —
turning on a real linter cold, with a clean-tree requirement, means fixing
everything it already finds before it can be adopted at all, which doesn't
fit a small, still-forming codebase (AGENTS.md, "Calibrate severity"). The
mechanism generalizes past Nix cleanly: `scripts/lint-ratchet.mjs` runs the
same idea over TypeScript's closest equivalents.

## The three checks

- **ESLint, `strictTypeChecked` + `stylisticTypeChecked`.** The tier above
  `recommended` that actually needs type information — catches implicit
  `any`, unsafe casts, unawaited promises. Needs `projectService` in
  `eslint.config.js`, scoped to `src/**/*.ts` (what `tsconfig.json`
  actually covers) — pointed at every file instead, it broke on
  `eslint.config.js` itself, `vitest.config.ts`, and `scripts/*.mjs`, none
  of which `tsconfig.json` includes, with "not found by the project
  service" instead of just linting without type info like the untyped tier
  had.
- **`knip`.** TypeScript's nearest match to `deadnix`: unused exports,
  unused files, unused deps. Needed no config — its default entry
  detection found `src/index.ts` and, via the `vitest` devDependency, the
  test files too.
- **Oversized files.** Ported near-verbatim: git-tracked files over a line
  count, deliberately low (400) for a project whose whole point is
  learning to split concerns before a module gets tangled, not after.

## The judgement calls

- **`switch-exhaustiveness-check` and `no-fallthrough` are listed
  explicitly**, not left to a preset, because neither preset includes
  them. Both are the same failure shape as several nixos-configs traps
  (a flake-parts module class not validated until the far-away import
  site; Home Manager's `mkOrder 550` silently losing a hook): something
  added with no matching case, or no `break`, produces no error at the
  point of the mistake — the symptom shows up somewhere else, later.
- **Two preset defaults got overridden, not suppressed.** `no-empty-function`
  flagged a test's `render: () => {}` stub — a legitimate no-op, not a
  mistake — so it now allows arrow functions specifically.
  `restrict-template-expressions` disallows even plain numbers in template
  literals under `strictTypeChecked`; re-allowed via `allowNumber: true`
  since interpolating a number into an error message (as `loop.ts`'s
  `RangeError`s do) is safe and idiomatic. Every other `allow*` flag on
  that rule stays off.
- **The oversized-file check ignores `package-lock.json` by name.**
  npm-generated, grows with the dependency tree rather than with anything
  a person wrote — tripping on it would be pure noise on every dependency
  add. Follows `check-dep-versions.mjs`'s convention: an exception is code,
  with a reason, in the script — not a silent glob.
- **The baseline bootstrapped at all-zero.** Turning the stricter tier on
  surfaced exactly three real ESLint findings (two `restrict-template-
  expressions`, one `no-empty-function`) — small enough to fix outright
  rather than accept into the floor, so the ratchet exists for what's
  found *after* this, not as a place to park what's already here.
- **`knip` flagged its own script as an unused file** until
  `lint-ratchet.mjs` was wired into `package.json`'s `lint` script — a
  useful confirmation that knip's reachability analysis follows
  `package.json`'s `scripts` values, not just `import`/`export`, and a
  reminder that a new `scripts/*.mjs` file needs a script entry pointing
  at it before knip will stop calling it dead.

## Future

A commit that adds a new ESLint/knip finding, or grows a tracked file past
400 lines, fails `npm run lint` (and CI) until fixed or the baseline is
deliberately re-bootstrapped (`node scripts/lint-ratchet.mjs bootstrap`) —
that command is for a knowing decision to accept a batch of findings, not a
way to get a red `lint` to pass. `node scripts/lint-ratchet.mjs show` lists
current findings without touching the baseline, for checking what's
actually flagged before deciding whether it's worth fixing now.
