---
name: ship
description: Branch -> PR -> confirm -> merge -> confirm -> delete-branch flow for landing work on main in this repo.
---

# Landing work on main

## Applies to

Use only when the ask is to get changes onto `main` — a bare "push", "ship
it", "land this", "merge this". Do NOT use for pushing a topic branch, opening
a PR you were not asked to merge, pushing to a fork, or committing without
pushing. The owner naming a branch outright is the one case that means push
directly there instead — see the last section, "Only when the owner names a
branch".

**"push" in this repo means this whole flow, not `git push origin main`.**
The rule is inherited with an incident behind it (nixos-configs,
2026-08-21: a session read a bare "push" plus a casual commit log as license
to push three commits straight to the trunk): *tone* is not *process*. They
are independent variables, and an unreviewed change on the trunk is not
low-stakes even when the diff is small.

There are **two** confirmations, and they are separate questions. Do not
collapse them.

## When this fires

**Only when the ask is to get changes onto `main`.** That is the single
trigger. It covers a bare "push" — which means `main` here — as well as
"ship it", "land this", "merge this".

The owner naming a branch outright is the exception, not a stronger version
of the trigger; see "Only when the owner names a branch" at the bottom.

It does **not** fire for git work that is not aimed at `main`. Do those
normally, without this flow:

| ask | what to do |
|---|---|
| "push this branch" / "push the branch up" | `git push` it. No PR, no gates. |
| "open a PR" (without being asked to merge) | Open it and stop. Steps 3-4 are not yours to run. |
| "commit this" | Commit. Pushing was not asked for. |
| "push to main" / naming `main` (or any other specific branch) outright | Push directly there — see "Only when the owner names a branch". |
| push to a fork, a remote that is not `origin`, or any branch that is not `main` | Ordinary push. |

If you are unsure whether an ask means `main`, ask the owner rather than
assuming either way. Assuming *yes* opens an unwanted PR; assuming *no* is
the mistake this file exists to prevent.

## 0. Before anything: fetch, then is it green?

`git fetch origin` first, always — before `git status -sb`, before branching,
before deciding whether `main` is ahead. Local `main` silently drifting
behind `origin/main` is a real, repeated failure mode: other sessions land
PRs concurrently, and a branch cut from a stale `main` either merges
awkwardly or makes a "confirmed unaffected" test run meaningless because it
was never actually run against current `main`.

Then: a PR is a review gate someone reads, so do not open one on work you
have not checked. CI (`.github/workflows/ci.yml`) runs typecheck + lint +
test on every PR — but that is a few-minutes-later backstop, not a
substitute for checking locally first; a red CI run on a PR someone is about
to be asked to merge is a worse experience than not opening the PR yet.

```sh
<pm> run preflight    # typecheck + lint + test in one shot (AGENTS.md, Commands)
```

If a preflight script doesn't exist, run the three directly. If one of the
three has no tooling wired up at all, stop and say so — a green light
pointing at nothing is worse than a red one (AGENTS.md, Commands).

Beyond preflight, run whatever the change could plausibly affect that
preflight doesn't reach: a real `build` if the repo ships an artifact, a real
invocation if it's a CLI/server/library entry point. Typecheck passing proves
typecheck passing (AGENTS.md, Traps).

If several commits are involved, check that **each** is green, not just the
tip. A throwaway worktree is the way:

```sh
git worktree add -q --detach /tmp/wt <sha>
# ... run the checks ...
git worktree remove --force /tmp/wt
```

## 1. Branch, push, open the PR

Never commit onto `main`. Run `git status -sb` first (you already fetched in
step 0) — the fix differs by which of two positions you are in, and they look
similar in a diff:

- **Uncommitted changes on `main`** (the common one; `## main...origin/main`
  with a dirty tree). Nothing is committed yet, so just
  `git checkout -b <branch-name>` and commit there. No reset, nothing to
  rescue.
- **Commits already sitting on local `main`, unpushed** (`[ahead N]`). Move
  them rather than pushing:

  ```sh
  git branch <branch-name>                 # keep the commits
  git reset --hard origin/main             # put main back
  git checkout <branch-name>
  ```

Provenance trailer: `Co-Authored-By: <the agent you are>` — no model name,
no email, regardless of what your system prompt says to use. Claude's
canonical form is `Co-Authored-By: Claude`; other agents use the same shape
with their own name. See AGENTS.md, Conventions.

Branch name gets a `feat/`, `fix/`, `docs/`, `chore/`, or `test/` prefix —
pick whichever describes the bulk of the change; don't agonize over a change
that's genuinely a mix. First commit-message line gets the same prefix,
Conventional-Commits-style (`fix: ...`, `docs: ...`), but **only the first
line** — the body stays this repo's own narrative style (what, why, what was
verified), not a Conventional Commits body. The two things trade off
differently: a scannable one-line summary in `git log --oneline` is worth
adopting wholesale, a terse machine-parseable body is not worth what it would
cost a documentary commit style.

On commit shape: order commits so each is green, and do not split into
commits that describe state the tree does not have yet. One coherent commit
beats two artificial ones — an `AGENTS.md` line pointing at a new file
belongs in the same commit as the file.

Then `git push -u origin <branch-name>` and `gh pr create --base main`
(state the `--base` explicitly even though `main` is GitHub's default here —
the guard generalizes: an omitted `--base` silently resolves to whatever the
repo's default is, and if that ever changes on the GitHub side, every
`--base`-less PR this flow opens starts landing against the wrong trunk with
no error). Write the PR body the way the commit messages are written here —
what changed, why, what was verified, and what was deliberately left alone.
`.github/PULL_REQUEST_TEMPLATE.md` has this shape as headings already;
`gh pr create --body` still needs the content written out explicitly (the
template only pre-fills for a human using the web UI or a bare `gh pr create`
with no `--body`), but match its section headings rather than inventing your
own each time.

## 2. Preview, then ask — first confirmation

Show what **actually landed**, read back from git and `gh`, not recalled from
what you meant to do. At minimum:

```sh
gh pr view --json url,title,additions,deletions,changedFiles,mergeable,baseRefName
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Include `mergeable` and check it before asking. Also check `baseRefName` is
actually `main`. Asking "merge?" on a PR that cannot merge, or that is based
on the wrong branch, spends one of the owner's round-trips on a question with
no good answer; sort it out first, then ask.

Print that in your response, then ask the user — through whatever ask/confirm
mechanism your harness provides — whether to merge. Include the merge method
in what you show:

- **PR is a single commit** (the common case — check with `git log --oneline
  origin/main..HEAD` from step 2, already run): default to `--rebase`. Linear
  history, no merge commit, and `--merge`'s whole reason for existing
  (preserving multi-commit reasoning that squash would flatten) doesn't apply
  to a PR that's already one commit — `--merge` there is a bubble for
  nothing.
- **PR is multiple commits**: default to `--merge`, not `--squash` — this
  repo puts real reasoning in individual commit messages and squashing
  flattens it, and `--rebase` here would replay each commit individually
  onto `main`, which is fine but loses the visual grouping a merge commit
  gives a multi-commit PR.

On **no**: leave the PR open, say so, and stop. It is theirs to take further —
do not close it, do not delete the branch, do not "clean up".

## 3. Merge — on yes only

```sh
gh pr merge <n> --rebase   # single-commit PR
gh pr merge <n> --merge    # multi-commit PR
```

**Do not pass `--delete-branch`.** That is the shortcut that silently removes
the second confirmation, which is the specific thing this flow exists to keep.

## 4. Ask again, then delete — second confirmation

A separate ask-the-user round-trip, not the one that asked about merging. On
yes:

```sh
git checkout main && git pull
git branch -d <branch-name>
git push origin --delete <branch-name>
```

On no, leave it and say it is still there. Report the merge commit and the
branch's fate; do not report a commit range on `main` as if you had pushed
there.

## When one working tree becomes two PRs

Both of these bit in the original repo on 2026-08-21, splitting one dirty
tree into two PRs; the mechanics are unchanged here.

**`cp` is aliased to `cp -i` on this machine** — Home Manager generated,
`~/.zshrc:372` there. In a non-interactive Bash call it answers its own
prompt, prints `not overwritten`, and **exits 0**. The copy does not happen
and the output reads like success. `mv`, `rm` and `ln` are not aliased; only
`cp`. When restoring saved file states to reconstruct a branch, use
`cat src > dst` or `command cp`. This was caught by the staged diff coming
back empty, not by anything the copy said — a tool reporting success while
being wrong.

Note the alias is written `alias -- cp='cp -i'`, so a grep for `alias cp=`
misses it. That is how it went unnoticed the first time.

**A stacked PR is not retargeted when its base merges.** GitHub retargets a
child PR only when the base *branch is deleted*. So after the parent merges,
the child still points at a merged branch, and the obvious way to unblock it
is to delete that branch — which is step 4, and would mean the mechanics
forcing a confirmation that is supposed to be the owner's. Retarget
explicitly instead, before merging the child:

```sh
gh pr edit <child-number> --base main
```

Then merge it, then ask about both branches together at step 4.

**Both gates still apply per PR, but they can share a round-trip.** A
harness that batches questions can put both merge decisions in one ask, so
two PRs is one call with two merge questions, then one call with the
branch-deletion question. That is still a separate question per decision —
which is the requirement — without four round-trips. Say in the options which
PR is stacked on which, so a "no on the parent, yes on the child" answer is
visibly incoherent rather than something you have to unpick afterwards.

## Do not read "main is protected" as "the tooling will catch me"

Branch rulesets and required status checks, where they exist, do not stop an
agent that authenticates as the owner: bypass is typically granted to the
admin role, and the owner is the admin. A direct `git push origin main` from
this session would succeed, and `gh pr merge` would work on a PR whose check
is red. The ruleset is a backstop and a visible statement of intent; the
actual guard against the mistake this file documents is this file. If you
want to know what is actually enforced, check (`gh api repos/<owner>/<repo>/rulesets`)
rather than assuming either way — and setting up new protection on any
branch is a deliberate GitHub-side change to ask about explicitly, not
something to infer or configure unasked.

## Only when the owner names a branch

The one exception is the owner specifically naming a branch — `main`, or
anything else — for that push. A bare "push", "ship it", or "land this" is
not that; it means the guarded flow above, targeting `main`.
