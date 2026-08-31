---
name: docs-sync
description: Check whether a change you just made leaves the README or docs/ stale, and fix it in the same change.
---

# Keeping the docs in sync

## Applies to

Run this at the end of any change to this repo that could make something
`README.md` or `docs/` states no longer true. Skip it when the change
touches nothing the docs describe, which is most small internal edits; check
by grepping first rather than reflexively opening every page.

## Why this exists

The rule itself is stated in AGENTS.md's Docs section: "a change that makes
a doc stale corrects it in the same change, not as a follow-up" — the same
discipline AGENTS.md holds itself to for its own State section. That rule is
easy to know and easy to forget in practice, because by the time a change
is done and verified, the docs are the last thing still in mind. This skill
is the deliberate checklist for closing that loop instead of trusting
it'll happen by habit.

## When to run this

At the end of a change that could make a documented fact wrong, for example:

- moving or renaming a file, export, or script that a doc links to or names
- changing a fact a doc states as current: a command, a path, a config
  option, a supported Node version, a dependency the setup instructions
  install
- fixing a bug a doc describes as open, or finding a new one worth
  recording there
- changing the public interface: CLI flags, exported functions, config
  shape, environment variables
- reorganizing directories, or anything that changes where something lives

## Procedure

1. **Name what changed, in doc terms.** Turn the diff into a short list of
   facts, not files — "the build command is now X", "path A moved to B",
   "flag C was removed", "bug D is fixed". This is the thing to search for,
   not the commit description.
2. **Find candidate docs** by grepping for the old name, path, or fact:

   ```sh
   grep -rn "<old-name-or-path-or-fact>" README.md docs/ AGENTS.md
   ```

   `AGENTS.md` is included on purpose — it is maintained under the same
   rule, and its State/Commands sections are exactly where a moved path or
   renamed script goes stale.
3. **Read each candidate against the new state, not against memory** —
   re-derive the fact (run the command, open the file) the way AGENTS.md's
   "verify by running" insists for code, rather than trusting what the doc
   already says or what you assume changed.
4. **Edit stale docs in the same change.** House rules:
   - Dates absolute (`2026-08-30`), never relative ("today", "last week").
   - Relative links recomputed for the actual file depth; verify each
     resolves after editing.
   - kebab-case filenames; `README.md` reserved for a directory's own index.
   - If a fix balloons into new prose that argues a fact rather than
     linking to it, that's a sign the fact belongs in the linked file's
     own header instead — the index is a link layer, not a rewrite.
5. **If no doc actually mentions what changed, say so and stop.** Don't
   manufacture an edit to a doc the change doesn't touch — most changes
   are exactly this case, and the check itself is the value, not an edit
   for its own sake.

## See also

- AGENTS.md, Docs — the rule this skill closes the loop on, and why
  AGENTS.md itself is in the grep.
- `investigate-bug` / `propose-issue` skills — the same
   check-the-record-first discipline from the other side.
