#!/usr/bin/env bash
# PreToolUse hook (Bash matcher). Deterministic guard for the exact mistake
# documented in .claude/skills/secrets-hygiene/SKILL.md (inherited incident:
# nixos-configs 2026-08-26, a whole-file secrets dump printed into the
# transcript when only an exit-code check was needed). This is a pattern
# match, not a judgment call, so it runs every time rather than depending on
# the model remembering to be careful.
#
# Three things trip it:
#   1. `cat`/`bat`/`less`/`more`/`head`/`tail` reading a real .env file --
#      prints every secret in the file. `.env.example`/`.env.sample`/
#      `.env.template` are explicitly exempted: placeholders are safe to
#      show and deliberately committed.
#   2. a bare `printenv` with no variable names -- dumps the entire
#      environment, live credentials included. `printenv ONE_VAR` is narrow
#      and passes.
#   3. a bare `env` used to LIST the environment (at end of command, or
#      piped) -- same dump. `env VAR=x cmd` (setting, not listing) has
#      arguments after it and passes.
# All ask for confirmation rather than hard-denying: there's a real
# alternative for each (see the reason text), but a rare legitimate case
# (e.g. actually needing the whole file) shouldn't be flatly impossible.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")

reason=""

# 1. reading a real .env file. Match .env, .env.local, .env.production, etc.
# but NOT .env.example / .env.sample / .env.template.
if grep -qE '\b(cat|bat|less|more|head|tail)\b[^|;&]*[[:space:]].{0,40}\.env($|[./[:space:]"'"'"'])' <<<"$command" \
    && ! grep -qE '\.env\.(example|sample|template)' <<<"$command"; then
    reason="Reading a real .env file prints every secret in it into the transcript. If you just need to know a key is set, use \`grep -o '^KEY=' .env\` (name only) or \`test -n \"\$KEY\"\` on the environment; if you need one value's shape, check its length rather than printing it. See .claude/skills/secrets-hygiene/SKILL.md."
fi

# 2. bare printenv (no variable names after it).
if [ -z "$reason" ] && grep -qE '(^|[;&|[:space:]])printenv([[:space:]]*$|[[:space:]]*[|;&>])' <<<"$command"; then
    reason="A bare 'printenv' dumps the entire environment -- live credentials included -- into the transcript. Name the variable you need (\`printenv CI\`), or test it without printing (\`test -n \"\$TOKEN\" && echo set\`). See .claude/skills/secrets-hygiene/SKILL.md."
fi

# 3. bare `env` used to list the environment: at end of the command string,
# or immediately followed by a pipe/redirect/separator. `env FOO=bar cmd`
# (the set-and-run form) has non-separator characters after it and won't
# match.
if [ -z "$reason" ] && grep -qE '(^|[;&|[:space:]])env([[:space:]]*$|[[:space:]]*[|;&>])' <<<"$command"; then
    reason="A bare 'env' dumps the entire environment -- live credentials included -- into the transcript, even piped through grep (a broad grep shows the values too). Name the variable you need (\`printenv CI\`), or test it without printing (\`test -n \"\$TOKEN\" && echo set\`). See .claude/skills/secrets-hygiene/SKILL.md."
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
