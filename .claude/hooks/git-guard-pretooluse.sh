#!/usr/bin/env bash
# PreToolUse hook (Bash matcher). Deterministic guard against destructive git
# actions -- ones that discard commits, working-tree changes, stashes, or
# branches with no straightforward undo. Same shape as
# .claude/hooks/secrets-guard-pretooluse.sh: pattern-matches the command
# before it runs and asks for confirmation rather than hard-denying, because
# every pattern here has a real legitimate use. Notably the `ship` skill
# itself runs `git reset --hard origin/main` as its documented recovery step
# for an accidental commit to the trunk, and
# `git push origin --delete <branch-name>` as its routine post-merge cleanup
# (SKILL.md) -- both should still get a confirmation prompt here, they just
# aren't wrong to run. This is a mechanical backstop for AGENTS.md's general
# "confirm first" stance on anything hard to reverse, not a replacement for
# judgment, and it does not gate on branch name -- that policy (only push
# directly to a branch the owner named outright) is already the ship skill's
# job, not this hook's.
#
# Deliberately "ask", never "deny": every pattern below is something a real
# git workflow legitimately needs sometimes. The hook exists so the pause
# happens even when the exact command was typed on reflex, the same reason
# secrets-guard-pretooluse.sh exists for bare env dumps.
#
# Known limits: this is pattern-matching on the command string, not a git
# parser. It does not follow shell variables/aliases, does not know what a
# rebase or push will actually touch, and a short-option cluster it doesn't
# special-case (e.g. some flag combined with -f in an order this doesn't
# anticipate) can slip through. Extend the patterns below rather than
# assuming every destructive shape is covered.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")

# Only look at commands that actually invoke git.
if ! grep -qE '(^|[;&|]|[[:space:]])git([[:space:]]|$)' <<<"$command"; then
    exit 0
fi

# A short-option cluster or long flag carrying -f/--force (e.g. -f, -uf,
# -fd, --force), but not the safe long forms that refuse to overwrite work
# they haven't seen.
force_flag_re='(^|[[:space:]])-[a-zA-Z]*f[a-zA-Z]*([[:space:]]|$)|(^|[[:space:]])--force([[:space:]]|$)'
safe_force_re='--force-with-lease|--force-if-includes'

reason=""

# git push --force / -f
if [ -z "$reason" ] && grep -qE '\bpush\b' <<<"$command" \
    && grep -qE -- "$force_flag_re" <<<"$command" \
    && ! grep -qE -- "$safe_force_re" <<<"$command"; then
    reason="This looks like a force push (--force/-f, not --force-with-lease) -- it can overwrite remote history and silently discard someone else's commits. Confirm this is intended, or use --force-with-lease so it fails instead of overwriting unseen work."
fi

# git push --delete / -d <ref>, or the :branch colon-refspec deletion form
if [ -z "$reason" ] && grep -qE '\bpush\b' <<<"$command" \
    && grep -qE -- '--delete\b|(^|[[:space:]])-d([[:space:]]|$)|[[:space:]]:[A-Za-z]' <<<"$command"; then
    reason="This looks like it deletes a remote branch or tag. Confirm the ref is actually meant to go -- this is the routine post-merge cleanup step in the ship skill, but is otherwise hard to undo once someone else has fetched it."
fi

# git reset --hard
if [ -z "$reason" ] && grep -qE '\breset\b' <<<"$command" && grep -qE -- '--hard\b' <<<"$command"; then
    reason="'git reset --hard' discards uncommitted changes and moves the branch, losing any commits not reachable elsewhere. Confirm nothing unsaved is about to be dropped -- this is also the ship skill's documented recovery step for an accidental commit to main, so it's expected in that specific case."
fi

# git clean with -f/--force (deletes untracked files; add -d/-x and it also
# takes directories and gitignored files)
if [ -z "$reason" ] && grep -qE '\bclean\b' <<<"$command" && grep -qE -- "$force_flag_re" <<<"$command"; then
    reason="'git clean -f' permanently deletes untracked files (with -d or -x it also takes directories and gitignored files) -- there's no undo. Confirm nothing not yet committed is about to be taken."
fi

# git checkout/switch forcing away local modifications
if [ -z "$reason" ] && grep -qE '\b(checkout|switch)\b' <<<"$command" && grep -qE -- "$force_flag_re" <<<"$command"; then
    reason="A forced checkout/switch discards local modifications to tracked files with no undo. Confirm nothing uncommitted is about to be lost."
fi
if [ -z "$reason" ] && grep -qE '\bcheckout\b[[:space:]]+(--[[:space:]]+)?\.([[:space:]]|$)' <<<"$command"; then
    reason="'git checkout -- .' (or 'git checkout .') discards all uncommitted changes in the working tree with no undo. Confirm that's actually intended."
fi

# git branch -D (force delete, unlike the plain -d the ship skill uses for
# its own already-merged post-PR cleanup)
if [ -z "$reason" ] && grep -qE '\bbranch\b' <<<"$command" \
    && grep -qE -- '(^|[[:space:]])-[a-zA-Z]*D[a-zA-Z]*([[:space:]]|$)' <<<"$command"; then
    reason="'-D' force-deletes a branch even if it has commits not merged anywhere else -- unlike the plain '-d' the ship skill uses for its already-merged post-PR cleanup. Confirm the branch's commits are actually safe to lose."
fi

# history rewriting
if [ -z "$reason" ] && grep -qE '\b(filter-branch|filter-repo)\b' <<<"$command"; then
    reason="This rewrites repository history wholesale. Confirm this is really intended -- it changes commit hashes for everything downstream and can't be undone once pushed."
fi

# git stash drop / clear
if [ -z "$reason" ] && grep -qE '\bstash\b' <<<"$command" && grep -qE '\b(drop|clear)\b' <<<"$command"; then
    reason="This permanently discards stashed changes with no undo. Confirm the stash isn't still needed."
fi

if [ -n "$reason" ]; then
    jq -n --arg reason "$reason" '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "ask",
            permissionDecisionReason: $reason
        }
    }'
fi

exit 0
