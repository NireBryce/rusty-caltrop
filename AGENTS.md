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

Scaffolded, no source yet: commits exist (`main` pushed), and the agent
scaffolding plus the Nix flake dev shell are landed — but no `package.json`
and no source. Every claim below with a **FILL IN** marker is a
fact to establish the moment it exists, not a placeholder to leave in
place. Update this section in the same change that changes the fact — an
agent's notes that lag the tree are worse than none.

- Package manager: **npm**. Toolchain: **Node 24** (`nodejs_24`), provided by
  the Nix flake dev shell (`nix develop` or direnv `.envrc`); version pinned
  by `flake.nix` + `flake.lock`. Record an `engines` field when
  `package.json` exists.
- **FILL IN** the script names this repo standardizes on (see Commands).
- **FILL IN** anything stateful: a deployed environment, a published package
  name on npm, a database, another repo that vendors this one.

## Commands

**FILL IN** the package manager and lockfile, then standardize on these npm
script names so every session (and the `ship` skill's step 0, and CI) can run
them without discovering what they're called this time:

```sh
<pm> run typecheck   # tsc --noEmit (or the framework's equivalent) -- must pass
<pm> run lint        # eslint (or equivalent) -- must pass
<pm> run test        # the test runner, in watchless mode -- must pass
<pm> run build       # produce the artifact, only if this repo ships one
<pm> run preflight   # typecheck + lint + test in one shot -- ship's step 0
```

If a script doesn't exist yet because the tooling isn't set up, that is a gap
to say out loud, not one to route around silently — a `ship` preflight that
quietly skips typecheck because `tsc` was never wired up is a green light
pointing at nothing.

## Architecture

**FILL IN** once the project has shape: entry points, directory layout, where
tests live, what the module boundaries are. Until then, assume nothing —
"look at the imports" beats "assume the layout".

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
- `wiki/` — narrative articles (repo history, how-tos), e.g.
  `wiki/repo-init.md`. Same discipline.

## Skills

| skill | for |
| --- | --- |
| `ship` | landing work on `main`: branch → PR → confirm → merge → confirm → delete-branch |
| `investigate-bug` | checking whether a reported bug is already known before re-deriving it |
| `propose-issue` | proposing a GitHub issue for a defect noticed along the way |
| `secrets-hygiene` | not leaking `.env` values and tokens into the transcript |
| `docs-sync` | keeping README/docs true after a change |
| `prune-permissions` | pruning dead entries from `.claude/settings.local.json` |
| `new-skill` | writing a new skill in this repo |

Read the skill before doing the matching task; each one is a triggered step,
not a suggestion.
