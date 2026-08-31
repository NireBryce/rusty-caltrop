# Repo init

How this repo went from an empty GitHub project to a working scaffold,
on 2026-08-31. The short version: one deliberate exception to the PR
flow (an empty first commit), then everything real through PRs —
including the mistake, which is recorded where the next reader will
trip over it.

## The order of events

1. **Empty init commit, pushed straight to `main`** (`18749e9`).
   The GitHub repo existed but had zero commits, so there was no base
   branch to open a PR against. The one-time exception: an empty
   `chore: init` commit pushed directly to `main`, creating the base.
   Every substantive change since lands through the PR flow.

2. **PR #1 — scaffolding and dev shell** (merged as `4cc566b`).
   One commit, because the parts reference each other:
   - Agent scaffolding moved from a staging directory (`agent-files/`)
     to the repo root, where it actually functions: GitHub only reads
     `.github/workflows` at the root, git hooks only run from the
     configured `hooksPath`, and skills are referenced as
     `.claude/skills/`. `CLAUDE.md` is a relative symlink to
     `AGENTS.md` and survives the move intact.
   - Nix flake dev shell pinning `nodejs_24` (npm 11.x), with
     `flake.lock` pinning nixpkgs; `.envrc` wires direnv to it.
   - CI's `setup-node` pin moved 22 → 24 to match the flake.

3. **CI failed. Both runs. Merged anyway.** The PR body predicted
   "green with skip warnings" and nobody read the runs before asking
   to merge — they were red in about 9 seconds. Mechanism: the CI
   install step ran `npm ci || npm install`, assuming empty-dir
   `npm install` exits 0. True on old npm; on npm 11.17 it exits 254
   with ENOENT on the missing `package.json`. As the job's first step
   it took everything down before the skip-with-warning steps could
   run. Recorded as the first entry in AGENTS.md's Traps section.

4. **PR #2 — the fix** (merge commit `3673f26`). The install step now
   gates on `package.json` existing, same skip-with-a-visible-warning
   pattern as the typecheck/lint/test steps. Reproduced locally against
   the npm version CI actually uses before fixing. CI on `main` has
   been green since.

## Decisions worth keeping

- **PR flow over direct pushes, even solo.** The empty-init exception
  was the only direct push to `main`. Everything else went through
  branch → PR → explicit merge confirmation.
- **Toolchain decided once:** Node 24 (`nodejs_24` in `flake.nix`),
  npm as package manager. `flake.lock` pins nixpkgs; CI's node
  version must move with the flake pin, not drift from it.
- **One commit when parts reference each other.** PR #1's commit lands
  the scaffolding and the AGENTS.md state that describes it together —
  a commit that references files a previous commit hasn't created yet
  describes a tree that never existed.

## Fresh clone setup

```sh
git config core.hooksPath .githooks   # opt-in local hooks (pre-commit, commit-msg)
direnv allow                          # or: nix develop
node --version                        # v24.x
```

CI needs no setup — it runs on every PR and on pushes to `main`.

## Not done yet

No `package.json`, no source, no npm scripts, no README. The repo is
deliberately at "scaffolded, waiting for its first source" — AGENTS.md's
State section tracks exactly this and is updated in the same change
that changes it.
