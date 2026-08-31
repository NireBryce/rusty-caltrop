---
name: investigate-bug
description: How to check whether a reported bug or symptom is already a known, tracked thread before investigating it yourself.
---

# Checking before investigating

## Applies to

Someone reports an error, a crash, or unexpected/"weird" behavior in this
repo, and you're about to start reproducing or diagnosing it. Run this
**before** that — not after you've already found something and are deciding
whether to write it up (that's the `propose-issue` skill, the filing side of
this same problem; this is the checking side). Doesn't apply when the user
already points you at the specific cause or file — there's nothing to check
for in that case.

## Why this exists

Inherited with the file (nixos-configs, 2026-08-24): a completion bug was
reported ("weird completion errors ... over ssh"). It got fully re-derived
from a live session — hours of tracing — before anyone checked whether it was
already known. It was: diagnosed and written up **two days earlier**, one
link from the docs index's own top level. The sentence naming it was right
there; never checked.

That session had also just spent its whole diagnosis proving a piece of prose
in the agents file ("check before re-deriving") isn't enough on its own to
make the check actually happen — which is why this is a skill (a triggered,
required step) instead of one more line added to AGENTS.md.

## Steps

1. **Before reproducing anything**, check both places a thread can live, with
   a couple of guesses from the report's own wording (symptom text, error
   message, command name):

   ```sh
   gh issue list --state all --search "<keywords>"
   grep -rni "<keywords>" README.md docs/ AGENTS.md 2>/dev/null
   ```

   An issue, a README note, or a comment in the code describing the same
   symptom all count as hits.

2. **A hit means read it fully** — the issue and/or the linked note — before
   doing anything else. Pick up from where it left off (an untested fix, an
   open question, a "not yet confirmed" status) rather than re-deriving from
   zero. If it's stale or wrong, fix *that* rather than starting a parallel
   investigation.

3. **No hit**: proceed as normal — reproduce for real rather than reasoning
   from source (AGENTS.md: verify by running, not by reasoning). Once
   something is actually diagnosed, don't leave it only in your reply:
   follow `propose-issue`'s flow to file or track it, and `docs-sync` for
   anything a doc should now say.

4. **State fixed vs. verified precisely**, the same discipline the rest of
   this repo holds itself to (AGENTS.md, Traps: "typecheck passing proves
   typecheck passing" — the general form is that verification claims name
   the rung actually climbed). A fix that hasn't been through a real run of
   the affected path is *in the tree*, not *fixed* — say which one, in the
   issue and the docs both, not just in the conversation.

## See also

- `propose-issue` skill — the filing side of this same problem, for a bug
  you noticed rather than one that was reported to you.
- `docs-sync` skill — keeping the linked doc current once you've acted, so
  the next check in step 1 finds the real state.
