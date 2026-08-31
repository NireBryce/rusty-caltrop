---
name: propose-issue
description: How to propose filing a GitHub issue when you notice a genuine bug in this repo's own code/docs while working on something else.
---

# Proposing repo bugs for the issue tracker

## Applies to

You're doing something else — building, reading a module, running the tests
— and you notice an actual defect along the way: a command in a doc that
doesn't work, an option that no longer exists, a claim in `AGENTS.md` or the
README that the code now contradicts, dead code, a failing edge case. Not
something you were asked to look into (fix that directly and say so), and
not a style opinion (no failure scenario, no issue).

## This repo already has two ways to record a bug, and neither is a tracker

AGENTS.md's own convention: **"A bug recorded in a comment stays in the
file"** — fix lands, comment stays, or if the code it described is gone, it
moves to a `history` heading instead of being deleted. The README/docs are
the second, for facts a reader needs. Both are records — they make sure the
next reader knows. Neither makes sure the bug gets *worked*. That's what
filing a GitHub issue adds, and it's why this skill exists: propose the
issue in addition to whichever of the above the bug also warrants, not
instead of it.

## This never extends to a third-party repo

Every `gh issue create` in this skill files in **this repo** (`gh` uses the
`origin` remote; never pass `--repo` naming some other project). That's not
incidental — this skill files here only, full stop, even for a bug whose
real fix belongs upstream (a dependency, a framework, whatever). Filing
there is a different, heavier action with its own rule in AGENTS.md: never
without the owner saying so explicitly, in those words, unprompted — not
satisfied by this skill's own step 3 ask-the-user confirmation, and not
satisfied by folding it into some other approval. If a bug genuinely belongs
upstream, this skill still applies for tracking it *here*; filing it at the
third-party project is a separate ask you make by name, not a step of this
flow.

## Why propose instead of just filing

Filing is outward-facing the moment `gh issue create` returns — same reason
the `ship` skill gates a merge, just one confirmation instead of two, since
closing a wrongly-filed issue costs nothing the way an unwound merge does.

## Steps

1. **Verify it, don't recall it.** Re-open the file or re-run the command.
   The discipline that applies to fixing a bug applies to reporting one too;
   a half-remembered impression is how a false one gets filed.
2. **Check it isn't already tracked.** Same commands `investigate-bug` step 1
   uses, for the same reason — this is the checking side run from the other
   direction:

   ```sh
   gh issue list --state all --search "<keywords>"
   grep -rni "<keywords>" README.md docs/ AGENTS.md 2>/dev/null
   ```

   Stop here if it's already covered.
3. **Ask, showing the real content.** Ask the user (through whatever
   ask/confirm mechanism your harness provides) with the title and a short
   body already drafted — the decision should land on the actual text, not
   on a vague "should I file something?" — and name which label you'd use
   (`bug` for a defect, `documentation` for a doc that's wrong,
   `enhancement` for a gap that isn't strictly broken).
4. **On yes:**

   ```sh
   gh issue create \
     --title "..." --label bug \
     --body "..."
   ```

   Body: what's wrong, where (`file:line`), how you noticed it, and a fix
   sketch if one's obvious. Close the body with a provenance line naming
   the agent that filed it, for the same reason commits carry the trailer
   (AGENTS.md, Conventions):

   ```
   🤖 Filed by <agent name>
   ```

   Report the issue URL back in your reply.
5. **On no:** don't file it, say so, and still leave whatever comment or doc
   correction the bug warrants regardless — declining the issue doesn't mean
   the knowledge should evaporate too.

## Calibrate

Know what this repo is (AGENTS.md, "Calibrate severity") before sizing what
deserves a tracker entry. Propose for what would actually bite someone on
the next session or the next run — not every small wart noticed in passing.
Mention the minor ones in your reply and leave it at that; run this flow
only on things worth the owner's round-trip.
