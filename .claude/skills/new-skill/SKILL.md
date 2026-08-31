---
name: new-skill
description: How to write a new SKILL.md in this repo, keeping its frontmatter description concise and accurate and its scope details elsewhere.
---

# Writing a new skill

## Applies to

Creating a new `.claude/skills/<name>/SKILL.md` in this repo, or editing an
existing one's frontmatter `description`. Not for editing a skill's body
content alone — only touch this when the description needs to change too.

## The rule

Frontmatter `description` is **one sentence: what the skill does or is
for.** Nothing else lives there — no file paths, no parenthetical scope
lists, no "use before/when X, but not Y" trigger conditions. All of that
goes in `## Applies to`, the section immediately after the H1 title, every
time.

This isn't just tone. A harness's live skill listing shows only
`name: description` — that listing is the only information available when
deciding whether a skill is relevant *before* loading it. A description
crammed with scope caveats reads as noise there. The body, by contrast, is
loaded in full the moment the skill actually fires — trigger detail placed
in `## Applies to` costs nothing and reads better once you're already
reading the whole file.

## Why (history)

Inherited with the file (nixos-configs, 2026-08-22): the owner corrected
this across every skill in that repo — descriptions had grown into full
parenthetical-laden trigger specs. Worked example from that pass, on a
"create a module" skill: a first attempt, "Known traps in creating,
renaming, or wiring a module in this repo", was rejected as still not saying
what the skill *does*; "How to create, rename, or wire a module in this
repo" was accepted. Prefer active "How to `<verb>`…" phrasing over a "Known
traps in…" noun phrase for a procedural skill — "traps" framing reads as
scope, not purpose. The `ship` skill's description ("Branch -> PR ->
confirm -> merge -> confirm -> delete-branch flow for landing work on main
in this repo") shows the same test passing without literal "How to" wording
— a short flow description is fine as long as it states purpose, not scope.

## Steps

1. **Pick a name**: kebab-case, matching the directory exactly
   (`.claude/skills/<name>/SKILL.md`). One `SKILL.md` per directory; there's
   no separate registry to update — the directory is discovered
   automatically.
2. **Draft the description first, alone, before writing the body.** One
   sentence, stating what the skill does. Then test it by covering the body
   and asking: from the name plus this one sentence, would a session
   deciding whether to load this skill understand what it's for? If the
   honest answer needs a second clause — "…but only when X" or a
   parenthetical — that clause belongs in `## Applies to`, not here.
3. **Write `## Applies to` immediately after the title.** This is where all
   of the following belongs, wherever it exists for this skill: which files
   or situations trigger it, explicit non-triggers (see `ship`'s table of
   "ask means main" vs. "ordinary push" cases), named example files,
   exceptions to the general rule.
4. **Write the rest of the body** in whatever shape the task actually
   needs, picking only sections that earn their place: `Why this exists`
   (with a dated story where there is one — inherited incidents say where
   they happened; local ones get recorded as they occur), `Steps`/
   `Procedure`, gotchas specific to the task, `See also` linking sibling
   skills and docs. Cite real files and commands, not invented ones — grep
   to confirm a path before naming it, the same discipline AGENTS.md asks
   of everything else in this repo.
5. **Re-read the description against the finished body.** Descriptions get
   written first and bodies grow while writing; if the body ends up
   covering more, or less, than the description claims, fix the description
   to match. It has to stay accurate, not merely short — undersold and
   overclaimed are both wrong, and only one of those errors looks like the
   thing this skill warns against.
6. **Check it next to its siblings.** Skim a few other `SKILL.md`
   frontmatters for length and tone. If this one reads noticeably longer or
   more parenthetical than its neighbors, it hasn't had this treatment yet.

## A quick before/after

Bad — crams scope and triggers into the sentence itself:

> Known traps in creating, renaming, or wiring a module in this repo,
> including directory-collector pitfalls, name-collision gaps, and config
> shadowing (see below).

Good — states purpose; everything after "repo" moved into `## Applies to`
and the body:

> How to create, rename, or wire a module in this repo.

## See also

- Any existing `.claude/skills/*/SKILL.md` in this repo — read a couple
  before writing a new one; they're the worked examples, not this file's
  prose about them.
- `docs-sync` skill — if the new skill's task touches something the README
  or `docs/` documents, that skill covers keeping the docs in sync as a
  separate step, not something to fold into this one.
