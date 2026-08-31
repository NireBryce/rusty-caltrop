#!/usr/bin/env bash
# PostToolUse hook (Bash matcher). Safety net for secrets-hygiene: if a
# secret-shaped value shows up in a Bash tool's output anyway -- despite the
# PreToolUse guard (secrets-guard-pretooluse.sh), or from a command that
# guard doesn't cover -- flag it immediately rather than relying on the model
# noticing on its own before quoting the result. See
# .claude/skills/secrets-hygiene/SKILL.md.
#
# Deliberately narrow: matches known secret *shapes* -- private key blocks,
# service-prefixed tokens (GitHub, npm, AWS, Slack, Stripe, Google), JWTs,
# credentialed connection URLs, and PASSWORD/SECRET/TOKEN/API_KEY
# assignments with a real-looking value. Does NOT flag .env.example-style
# placeholders or obvious dummy values -- `changeme`, `xxx`, `your-key-here`
# aren't secrets even in plaintext.
#
# First match wins; this is a tripwire, not an inventory.
set -euo pipefail

input=$(cat)
# Extract stdout/stderr as RAW text, not `tostring` on the whole object --
# tostring re-serializes an object to compact JSON, which turns real
# newlines inside .stdout into literal two-character `\n` escapes and glues
# the rest of the JSON structure onto that same "line". That silently broke
# every newline-sensitive check in the inherited version of this hook
# (nixos-configs, 2026-08-26: a plain list of key names with no values at
# all was flagged, because the JSON-escaped remainder of the blob became
# "content after the key name").
text=$(jq -r '
    if (.tool_response | type) == "object" then
        [(.tool_response.stdout // ""), (.tool_response.stderr // "")] | join("\n")
    elif (.tool_response | type) == "string" then
        .tool_response
    else
        empty
    end
' <<<"$input" 2>/dev/null || true)

hit=""
grep -qE -- '-----BEGIN (OPENSSH|RSA|EC|DSA|PGP|ENCRYPTED) PRIVATE KEY-----' <<<"$text" && hit="a private key block"
[ -z "$hit" ] && grep -qE 'gh[pousr]_[A-Za-z0-9]{20,}' <<<"$text" && hit="a GitHub token (ghp_/gho_/...)"
[ -z "$hit" ] && grep -qE 'npm_[A-Za-z0-9]{20,}' <<<"$text" && hit="an npm access token (npm_...)"
[ -z "$hit" ] && grep -qE 'AKIA[0-9A-Z]{16}' <<<"$text" && hit="an AWS access key id (AKIA...)"
[ -z "$hit" ] && grep -qE 'xox[baprs]-[A-Za-z0-9-]{10,}' <<<"$text" && hit="a Slack token (xox...)"
[ -z "$hit" ] && grep -qE '(sk|rk)_live_[A-Za-z0-9]{16,}' <<<"$text" && hit="a Stripe live key"
[ -z "$hit" ] && grep -qE 'AIza[0-9A-Za-z_-]{35}' <<<"$text" && hit="a Google API key (AIza...)"
[ -z "$hit" ] && grep -qE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}' <<<"$text" && hit="a JWT (eyJ...)"
[ -z "$hit" ] && grep -qE '[a-z+]{2,10}://[^:/@[:space:]]+:[^@/[:space:]]{6,}@' <<<"$text" && hit="a credentialed connection URL (user:password@host)"
# KEY=value with a real-looking value: 12+ chars of credential-ish
# characters, minus obvious placeholders. Two steps rather than one regex --
# the value character class includes hyphens, so "your-token-here" and
# "changeme12345" both match the shape; grep -E has no lookahead to exclude
# them inline, so filter the matches after the fact instead. A placeholder
# word anywhere in the matched text (value or name) is a false positive
# waiting to happen, not a secret.
if [ -z "$hit" ]; then
    vals=$(grep -oE '(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CLIENT_SECRET)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9+/_-]{12,}' <<<"$text" || true)
    vals=$(grep -viE 'changeme|placeholder|your[-_](key|token|secret|password)|example|dummy|xxxxx' <<<"$vals" || true)
    [ -n "$vals" ] && hit="a bare PASSWORD/SECRET/TOKEN/API_KEY value"
fi

if [ -n "$hit" ]; then
    jq -n --arg hit "$hit" '{
        decision: "block",
        reason: ("This tool output looks like it contains " + $hit + " in plaintext. STOP before quoting or summarizing it in your reply: refer to it by name only, tell the user it leaked, and recommend rotation rather than continuing the original task as if nothing happened. See .claude/skills/secrets-hygiene/SKILL.md."),
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: ("secrets-hygiene guard: possible plaintext secret (" + $hit + ") detected in this tool output. Do not repeat it in your reply; name it only, and flag rotation.")
        }
    }'
fi

exit 0
