---
name: secrets-hygiene
description: How to avoid printing .env values, API tokens, and private keys into the conversation in this repo, hook-enforced where the pattern is checkable, and what to do when one leaks anyway.
---

# Handling secrets without leaking them

## Applies to

Any command that touches a `.env` file (or `.env.local`, `.env.production`,
any `.env.*` except the `example`/`sample`/`template` variants), an
environment variable carrying a credential, or a log/output stream that
might contain one — checking whether a token is set, reading a value,
comparing two configs. Also applies to reading source files that might have
a real credential committed in them, and to `env`/`printenv`, `docker
logs`/`docker inspect` near a container that takes a secret as an
environment variable or argv.

**Not** a concern for `.env.example` and friends — placeholder values are
safe to `cat`, `git show`, and `git diff`, and are deliberately committed.
The danger is exclusively in anything holding a real value: an actual
`.env`, the live process environment, a token pasted into a test fixture, a
committed credential.

## Why this exists

Inherited with the file (nixos-configs, 2026-08-26): mid-way through wiring
a new secret, the question "can this session even decrypt the secrets file?"
got answered with a command that printed the *entire* file — two live auth
keys in plaintext into the transcript. The owner caught it, not the agent,
before the reply that would have quoted it — a targeted check (one key, or
discarding stdout and reading `$?`) would have answered the same question
with zero exposure. The fix afterward was "rotate the keys," not "redact the
message" — output already sent can't be un-sent.

## Enforced mechanically, not just by memory

Prose guidance is exactly what failed in the inherited incident — the
discipline below was already the obvious approach and got skipped anyway,
under no real pressure, because nothing forced it. So the two most
mechanically-checkable parts of this skill are wired as real hooks in
`.claude/settings.json` (project-scoped, applies every session in this
repo — not something to re-derive from memory each time):

- **`.claude/hooks/secrets-guard-pretooluse.sh`** (`PreToolUse`, `Bash`
  matcher) — pattern-matches the command *before* it runs. A `cat`/`bat`/
  `less`/`more`/`head`/`tail` reading a real `.env` path, or a bare
  `env`/`printenv` dump, triggers `permissionDecision: "ask"` with the
  narrower alternative in the reason text.
- **`.claude/hooks/secrets-guard-posttooluse.sh`** (`PostToolUse`, `Bash`
  matcher) — scans the command's actual output *after* it runs, regardless
  of which command produced it, for secret shapes: a private key block, a
  GitHub/npm/AWS/Slack/Stripe/Google token, a JWT, a credentialed
  connection URL (`user:password@host`), a `PASSWORD=`/`SECRET=`/`TOKEN=`/
  `API_KEY=` assignment with a real-looking value. A hit returns
  `decision: "block"`, which feeds a warning back into context immediately —
  before there's a chance to quote the result in a reply.

Both should be pipe-tested against synthetic hook input before being edited
further — not just written and assumed to work.

**Known limits, honestly**: both only match the `Bash` tool — a secret
surfacing via a file-read tool isn't caught by either. The post-use
scanner's patterns are specific shapes; a secret that doesn't match one of
those (a new kind of credential, a password with no recognizable prefix)
won't be flagged. The pre-use guard only recognizes the `.env` / env-dump
shapes, not every way a secret could leak. The sections below are what's
still judgment rather than pattern-match — read them for the cases the hooks
don't cover, not as a first line of defense that's now redundant.

## Preventing it

1. **Before running a command against secrets, ask: does its default output
   include plaintext I don't actually need?** Testing whether a token is set
   needs only an exit code:

   ```sh
   [ -n "$GITHUB_TOKEN" ] && echo set || echo unset
   node -e 'console.log(process.env.API_KEY ? "set" : "unset")'
   ```

   Reading one value needs only that key:

   ```sh
   grep -o '^API_KEY=' .env      # name only, not the value
   awk -F= '$1=="API_KEY"{print length($2)}' .env   # its length
   ```

   Never `cat .env` when a narrower form answers the actual question.
2. **When a value genuinely must be read** (to hand to a client, to compare
   against something), still read just that one key rather than the whole
   file — the other keys in the file aren't relevant to the task and don't
   need to be in the transcript to accomplish it.
3. **When a command's output size or content isn't predictable up front**,
   redirect it to a file first and inspect that narrowly (`grep`, `wc -l`)
   rather than letting the raw output land directly in a reply.
4. **This applies to the same class of command even when secrets aren't the
   obvious subject** — `env`, `docker inspect`, `docker logs` on a container
   with a secret in its environment, `ps aux` near a process taking a token
   as argv, a test that prints `process.env`. The test is the same: does
   this command's default output plausibly include something that isn't
   meant to be read back, and is there a narrower way to get the answer.
5. **Never write a real credential into source, a test fixture, or a commit
   message** — even "temporarily", even in a test. If you find one already
   committed, that's a rotation plus a history decision for the owner, not
   just a deletion.

## Catching it when something slips through anyway

1. Before quoting or summarizing a tool result that came from any command
   in the categories above, scan it for secret-shaped content: a private
   key block, a token with a known prefix (`ghp_`, `gho_`, `npm_`, `xox`,
   `AKIA`, `sk_live_`, `AIza`), a JWT (`eyJ...`), a connection URL with an
   embedded password, or an `=`-assignment sitting next to a name like
   `PASSWORD`/`SECRET`/`TOKEN`/`API_KEY`.
2. If a tool result already contains one of these, don't requote it in your
   own reply — refer to it by name only ("the `API_KEY` value"). The moment
   it appeared in any tool output it's already exposed; repeating it in
   prose adds nothing but more copies.
3. If a secret did leak, say so immediately, in the same turn, rather than
   continuing whatever task was in progress as if nothing happened. Name
   exactly which secret(s) leaked and recommend rotation — a new token, a
   changed password. Don't offer to "remove it from the transcript" — that
   isn't something available, and implying otherwise understates what
   actually happened.
4. Judge sensitivity honestly rather than flagging everything: a public
   key, a non-secret app identifier, or an `example` placeholder isn't a
   leak even in plaintext — don't claim a rotation is needed for those, but
   don't skip flagging the ones that are (auth tokens, passwords, private
   keys, connection strings).

## See also

- `.claude/hooks/secrets-guard-pretooluse.sh` and
  `.claude/hooks/secrets-guard-posttooluse.sh` — the actual enforcement,
  wired in `.claude/settings.json`'s `hooks.PreToolUse`/`hooks.PostToolUse`.
  Read these before assuming a new risky-command shape is covered; if it
  isn't, extend the pattern match rather than only adding prose here.
- `.gitignore` — must cover `.env` and variants from the first commit; a
  `.env` that lands in git history needs rotation, not just removal.
