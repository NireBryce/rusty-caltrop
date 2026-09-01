# AGENTS.md

> **Written by agents, for agents.** An agent's working notes, not
> documentation — pitched at something with no memory between sessions, dwelling
> on mistakes because repeating them is the failure mode it exists to prevent.
> The human entry point is `README.md`, once one exists. The owner corrects the
> load-bearing claims; the framing is the machine's.
>
> This file is the canonical one; `CLAUDE.md` is a symlink to it, so every
> "see CLAUDE.md" reference resolves here. Skills referenced by name below are
> plain markdown at `.claude/skills/<name>/SKILL.md` — any agent can read them
> as files, with or without a harness that loads skills automatically.
>
> These files were generalized from `NireBryce/nixos-configs` on 2026-08-30.
> Dated incidents referenced in them happened **there**, not here — they are
> inherited evidence for why a rule exists, not local history to go looking
> for. This repo's own incidents get recorded the same way as they happen.

Landing work targets `main` via the `ship` skill. Don't assume a branch —
check `git branch --show-current`.

## State

Early: the first real module (fixed-timestep loop) is landed with its
toolchain. Commits exist (`main` pushed). Facts here are updated by the
change that changes them.

- Package manager: **npm**, lockfile `package-lock.json`. Toolchain:
  **Node 24** (`nodejs_24`), provided by the Nix flake dev shell (`nix
  develop` or direnv `.envrc`); version pinned by `flake.nix` +
  `flake.lock`, mirrored by the `engines` field in `package.json` and CI.
- Script names are standardized (see Commands); all are wired up.
- Nothing stateful yet: the package is `private` and unpublished; no
  deployed environment, database, or downstream consumer.

## Commands

npm, lockfile `package-lock.json`. Standard names — every session (and the
`ship` skill's step 0, and CI) can run them without discovering what
they're called this time:

```sh
npm run typecheck   # tsc --noEmit -- must pass
npm run lint        # eslint (strictTypeChecked+stylisticTypeChecked) + knip + oversized-file check, ratcheted -- must pass
npm run test        # vitest run (watchless) -- must pass
npm run build       # tsc -p tsconfig.build.json -> dist/
npm run check-deps  # deps current with npm latest (needs registry) -- must pass
npm run wiki-lint   # wiki/'s own links, anchors, and Contents blocks -- not in preflight yet
npm run preflight   # typecheck + lint + test + check-deps -- ship's step 0
```

New tooling gets one of these names or a deliberate, written-down reason not
to — a `ship` preflight that quietly skips a check is a green light pointing
at nothing. `check-deps` is one deliberate name beyond the compile/lint/test
core: not a code check but a currency audit (`scripts/check-dep-versions.mjs`)
that fails when a dep in package.json is declared on a major behind npm's
current `latest`. Deliberate exceptions live in that script, each with its
reason. It needs the network, so preflight does too.

`wiki-lint` is the other deliberate name, and deliberately **not** wired
into `preflight`: it checks `wiki/`'s own browsability mechanics
(`scripts/check-wiki.mjs` — every relative link resolves, every
`#fragment` resolves to a real heading, every page's `## Contents` block
matches its own headings) rather than anything that gates code correctness,
so a stale wiki page doesn't block shipping code. Run it by hand after
editing `wiki/`; see `wiki/styleguide.md`. Ported from
`NireBryce/nixos-configs`' `wiki/scripts/check_wiki.py`, scoped down to the
three checks that are fully mechanical and need no category/host/route
table structure this repo doesn't have.

`lint` is `scripts/lint-ratchet.mjs check`, not a bare `eslint .`: it covers
three categories — ESLint on the strictTypeChecked+stylisticTypeChecked tier
(not just `recommended`; the stricter tier is what actually catches implicit
`any`, unsafe casts, and unawaited promises), `knip` (unused exports/files/
deps), and a same-repo oversized-file line-count check (limit and ignored
generated files are in the script) — and ratchets each against
`scripts/lint-ratchet-baseline.json` rather than requiring today's count to
be zero. A commit that adds a new finding in any category fails; one that
fixes a finding lowers that category's floor in the baseline file (rewritten
in place — `git add` it back). `lint-ratchet.mjs show`/`bootstrap` are for
inspecting current findings or deliberately resetting the floor; `check` is
what `lint` and CI run. Ported from `NireBryce/nixos-configs`'
statix+deadnix+oversized-file ratchet (`flake/scripts/lint.py`) — same
reasoning is in this script's own header. `eslint.config.js`'s explicit
rules (`switch-exhaustiveness-check`, `no-fallthrough`) are there because
neither preset includes them, each with the specific silent-failure shape
it's guarding against in its own comment.

## Architecture

- `src/` is the whole package; `dist/` is build output (gitignored).
- `src/loop.ts` — `GameLoop`, the fixed-timestep core (see its module doc
  for the accumulator mechanism). Environment-agnostic: no timers of its
  own; callers drive it with `tick(nowMs)` from any scheduler. All times
  are milliseconds.
- `src/raf.ts` — the one browser-coupled piece: `startRafLoop` drives a
  loop from `requestAnimationFrame` + `performance.now()`.
- `src/index.ts` — public re-exports; import from the package root.
- Tests are co-located as `src/*.test.ts` (vitest). `typecheck` covers
  them; `build` excludes them via `tsconfig.build.json`. The vitest
  `include` glob is pinned in `vitest.config.ts` — see Traps before
  loosening it.
- `scripts/` — repo scripts as real files. `check-dep-versions.mjs` backs
  `npm run check-deps` (see Commands); its deliberate exceptions must each
  carry a reason in the file. `lint-ratchet.mjs` backs `npm run lint` (see
  Commands) the same way; its baseline lives alongside it in
  `lint-ratchet-baseline.json`, and its oversized-file ignore list follows
  the same each-entry-carries-a-reason convention. `check-wiki.mjs` backs
  `npm run wiki-lint` (see Commands and `wiki/styleguide.md`); its
  `gen-contents` subcommand is the fixer for a stale `## Contents` block,
  not run automatically by `check`.

## Traps

### A predicted-green is not a checked-green (2026-08-31)

The bootstrap PR's body predicted "green with skip warnings" and asked to
merge without reading the runs; both were red within 9 seconds. Mechanism:
the install step assumed empty-dir `npm install` exits 0 — true on old npm,
false on npm 11 (exit 254, ENOENT on the missing package.json). Two rules
fall out: CI on this repo completes in seconds, so `gh run list` is part of
the merge preview, not a follow-up; and any step's tolerance for a missing
package.json is unverified until run against the npm version CI actually
uses.

### Typecheck passing proves typecheck passing

`tsc --noEmit` green means types are sound. It says nothing about runtime
behavior, about tests having been run, or about the build output being what
you assume it is. The ladder is: typecheck → lint → tests → build → real run
in the real environment. Claim rungs you actually climbed, and say which rung
a "verified" means when reporting it.

### A green test suite that doesn't cover the changed path is still green

Run the tests, then check the coverage story of *the thing you changed* — a
passing suite that never executes the new branch is a false positive with a
checkmark on it.

### Default test globs reach into .direnv (2026-08-31)

The first `npm run test` on the freshly wired vitest executed 26 tests from
`.direnv/flake-inputs/<hash>-source/` — nix store copies of flake inputs,
including another repo's test file, which half-ran and then failed the suite
for having no top-level tests. Mechanism: vitest's default include is
`**/*.test.ts` and it does not respect `.gitignore`, where `.direnv/` lives.
`vitest.config.ts` pins `include: ['src/**/*.test.ts']`; if a second test
root ever appears, that line is the one to move.

### Wrong expected values can hide behind a real bug's red

Same first run as the trap above: four test failures, of which one was a
harness bug (docstring promised a 20 ms step, harness never set it) and
three were arithmetic slips in the tests' expected values — the loop was
right every time. Hand-recompute the accumulator math before suspecting the
loop; when a fix makes different tests fail, re-derive each expectation from
the mechanism, not from what would make it pass.

## Working in this repo

**Verify by running, not by reasoning.** Reading code settles what it says,
not what it does. Before reporting anything as fixed, run the real command
(`typecheck`/`test`/`build`, a real invocation of the CLI or server) rather
than tracing the logic and concluding it must work now.

**Ask "did it work before?" first.** `git stash && <run> && git stash pop` —
or checking out the previous commit in a throwaway worktree — settles
regression-vs-always-broken faster than any argument about mechanism:
conclusions drawn from source are hypotheses, and the tree is right there.

**Calibrate severity.** Know what this repo is before sizing a response to a
problem — a personal project with no users and a deployed service paying
traffic deserve different incident framing. When in doubt, ask; "this is
broken and here is the fix" beats either panic or a shrug.

**Bugs serialize.** One defect found by a run usually has neighbors the same
run didn't reach. Diagnosing the reported symptom is the start, not the end:
check the adjacent paths that share the mechanism before declaring done.

**"push" means the `ship` skill**, landing on `main` through a PR with its
two confirmations. The owner naming a branch outright (`main` included) means
push directly there instead, bypassing the flow. The skill has the flow and
why.

**Never file anything outside this repo — an issue or PR on any other
project, upstream or not — without the owner saying so explicitly, in those
words, unprompted.** A yes to a bundled "ok to do these four things" does not
cover an upstream filing folded into it, even if it was one of the four and
nothing was hidden.

**Filing here can still reach another project's repo via GitHub
autolinking.** A title or body containing `owner/repo#123` cross-references
and pings that repo — a real ping, nothing filed there needed. Plain prose
naming a project does not trigger it. Grep for the `owner/repo#number` shape
before naming a specific upstream issue/PR in anything filed here.

## Conventions

**Provenance trailer on every agent-authored commit:
`Co-Authored-By: <agent>`, naming the agent that wrote it — no model name,
no email.** Claude's canonical form is `Co-Authored-By: Claude`; any other
agent uses the same shape with its own name. The reasoning (inherited, and
general): an agent cannot verify which model is executing it — the name comes
from a system prompt that may be stale or generic — so the trailer records
the agent, which it does know, and omits the model, which it doesn't.
`.githooks/commit-msg` (active after `git config core.hooksPath .githooks`)
auto-corrects only the `Claude <model> <email>` shape; any other agent's
trailer passes through untouched, so form it correctly at write time.

**A bug recorded in a comment stays in the file.** Nobody reads `git log`;
the comment is what the next editor sees. Do not trim one because the fix
landed. If a change strands a comment entirely, move it to a `history`
heading at the bottom of the file — still written to stand alone (dates,
mechanism, what was tried, outcome), but under the same compression
discipline as every other comment: facts kept, narration cut.

**When a rename makes the old name ungreppable, say what it was** on the
declaration it now lives in.

**Scripts are real files.** No burying one language inside another's tooling:
no `node -e "$(cat <<'EOF' ...)"` heredocs, no Python inside bash one-liners.
Inline-in-a-string code gets no highlighting, linting, or indentation help —
exactly when quoting bugs stop being visible. A little logic: a real `.ts`
(or `.mjs`) file under `scripts/`. Mostly logic: the whole tool in that
language. (Inherited rule; the original shipped both bugs the shape invites.)

**Comments exist to carry what the code can't** — mechanism, traps, why-not
the obvious alternative. Not narration of what the next line does. Same test
as the repo this was generalized from: if removing the comment changes
nothing a reader could derive from the code, remove it.

**Check for an existing integration before hand-writing one.** The ecosystem
has a config/plugin/helper for most things (framework adapters, ESLint
plugins, test utilities); check before writing the bespoke version, and read
the current docs rather than recalling them — third-party APIs drift.

## Docs

- `README.md` — the human entry point. **Maintained the same way this file
  is**: a change that makes it stale corrects it in the same change, not as a
  follow-up. The `docs-sync` skill is the checklist for that.
- `docs/` — if and when deeper notes exist. Same discipline.
- `wiki/` — narrative articles (repo history, how-tos). `wiki/README.md`
  is the topic index — start there rather than guessing a filename; its
  own house style (naming, the per-page `## Contents` block, linking) is
  `wiki/styleguide.md`. Same discipline, including keeping that index and
  each page's "See also" links and `## Contents` block current when a
  page moves, a heading changes, or a new page lands — `npm run wiki-lint`
  catches the mechanical half of that. One page in there isn't a finished
  narrative: `wiki/work-in-progress.md` tracks hanging threads while
  they're still open, kept current by the `work-in-progress` skill rather
  than by this same-change rule.

## Skills

| skill | for |
| --- | --- |
| `ship` | landing work on `main`: branch → PR → confirm → merge → confirm → delete-branch |
| `investigate-bug` | checking whether a reported bug is already known before re-deriving it |
| `propose-issue` | proposing a GitHub issue for a defect noticed along the way |
| `secrets-hygiene` | not leaking `.env` values and tokens into the transcript |
| `docs-sync` | keeping README/docs true after a change |
| `work-in-progress` | tracking a hanging thread on `wiki/work-in-progress.md` until it resolves |
| `prune-permissions` | pruning dead entries from `.claude/settings.local.json` |
| `new-skill` | writing a new skill in this repo |

Read the skill before doing the matching task; each one is a triggered step,
not a suggestion.
