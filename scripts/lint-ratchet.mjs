#!/usr/bin/env node
// ESLint findings (the strictTypeChecked+stylisticTypeChecked tier, see
// eslint.config.js) + knip findings (unused exports/files/deps) + an
// oversized-file line-count check, ratcheted against a committed baseline
// so a commit can lower any category but never raise one. Ported from
// NireBryce/nixos-configs' flake/scripts/lint.py (statix+deadnix+oversized-
// file, same ratchet, same reasoning below).
//
// Why a ratchet instead of requiring each category to sit at zero: adopting
// typescript-eslint's strict(TypeChecked) tier or knip cold, with a
// clean-tree requirement, means fixing (or ignoring around) everything
// either tool flags before it can be turned on at all -- disproportionate
// to what a small, still-forming codebase needs (AGENTS.md, "Calibrate
// severity"). The ratchet is the compromise: today's counts become the
// floor, so nothing already here is an error, but a commit that adds a NEW
// finding in any category is one, and a commit that fixes one lowers the
// floor for every commit after it -- the number can go down by accident
// (fixing something for an unrelated reason still lowers it) but can never
// quietly go back up.
//
//     lint-ratchet.mjs check      # compare current counts to the baseline;
//                                 # the normal path -- this is what `npm
//                                 # run lint` and CI run. Exits 1 if any
//                                 # category regressed. Auto-lowers (and
//                                 # rewrites) the baseline file in place if
//                                 # any category improved -- the caller is
//                                 # expected to `git add` it back.
//     lint-ratchet.mjs show       # current counts, findings listed, no
//                                 # baseline comparison and no exit-code
//                                 # judgement. For a human checking what's
//                                 # actually flagged without touching the
//                                 # ratchet.
//     lint-ratchet.mjs bootstrap  # write the current counts as the
//                                 # baseline, unconditionally -- not part
//                                 # of the normal flow. Only for
//                                 # deliberately accepting today's findings
//                                 # as the new floor (first setup, or a
//                                 # decision that a batch of findings is
//                                 # being knowingly left for later).
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(SCRIPT_DIR);
const BASELINE_PATH = path.join(SCRIPT_DIR, 'lint-ratchet-baseline.json');
const BIN = {
  eslint: path.join(ROOT, 'node_modules/.bin/eslint'),
  knip: path.join(ROOT, 'node_modules/.bin/knip'),
};

// Files over this many lines are an oversized-file finding below. Small on
// purpose: this is a learning project, and the point is to notice "this
// should probably be two modules" while it's still one commit away to
// split, not after a file has grown tangled enough that splitting it is a
// project of its own.
const OVERSIZED_LIMIT = 400;

// Generated files this check would otherwise trip on every time their size
// changes for reasons that have nothing to do with this repo's own code
// growing unwieldy. Each entry needs a reason, same convention as
// check-dep-versions.mjs's ALLOWED_BEHIND_LATEST.
const OVERSIZED_IGNORE = new Set([
  'package-lock.json', // npm-generated; grows with the dependency tree, not with hand-written code
]);

// eslint and knip both exit non-zero when they *find* something to report
// -- that's not a failed run, so only a genuinely missing binary (ENOENT)
// is fatal here; anything else still carries stdout/stderr to parse.
async function execCapture(bin, args, toolName) {
  try {
    return await run(bin, args, { cwd: ROOT });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`lint-ratchet: '${toolName}' not found at ${bin} -- run 'npm install' first.`);
      process.exit(2);
    }
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

/** One string per ESLint message, "path:line: rule -- message". */
async function eslintFindings() {
  const { stdout } = await execCapture(BIN.eslint, ['.', '-f', 'json'], 'eslint');
  const files = JSON.parse(stdout || '[]');
  const findings = [];
  for (const file of files) {
    const relPath = path.relative(ROOT, file.filePath);
    for (const m of file.messages) {
      findings.push(`${relPath}:${m.line}: ${m.ruleId ?? '(parse error)'} -- ${m.message}`);
    }
  }
  return findings;
}

/**
 * One string per knip issue entry, "file: category -- name". knip's JSON
 * groups issues by file, then by category (dependencies, exports, files,
 * ...) as arrays under that file's object -- flattened here the same way
 * statix's report/diagnostics nesting is flattened in the ported script,
 * since the ratchet only needs a stable count plus something readable for
 * `show`, not knip's full per-category structure.
 */
async function knipFindings() {
  const { stdout } = await execCapture(BIN.knip, ['--reporter', 'json'], 'knip');
  const { issues } = JSON.parse(stdout || '{"issues":[]}');
  const findings = [];
  for (const issue of issues) {
    for (const [category, entries] of Object.entries(issue)) {
      if (category === 'file' || !Array.isArray(entries)) continue;
      for (const entry of entries) {
        const label = typeof entry === 'string' ? entry : (entry.name ?? JSON.stringify(entry));
        findings.push(`${issue.file}: ${category} -- ${label}`);
      }
    }
  }
  return findings;
}

/**
 * One "path: N lines" string per git-tracked file over `limit` lines.
 * Repo-wide, not src/-only, for the same reason lint.py's version checks
 * the whole nixos-configs tree rather than just flake/: AGENTS.md itself is
 * the file most likely to hit this. Tracked files only: an untracked
 * scratch file blowing past the limit isn't this repo's problem yet.
 */
async function oversizedFiles(limit = OVERSIZED_LIMIT) {
  const { stdout } = await run('git', ['ls-files', '-z'], { cwd: ROOT });
  const hits = [];
  for (const name of stdout.split('\0')) {
    if (!name || OVERSIZED_IGNORE.has(name)) continue;
    let text;
    try {
      text = await readFile(path.join(ROOT, name), 'utf8');
    } catch {
      continue; // e.g. a submodule gitlink, or a symlink to nowhere
    }
    const parts = text.split('\n');
    const lineCount = parts.at(-1) === '' ? parts.length - 1 : parts.length;
    if (lineCount > limit) hits.push(`${name}: ${lineCount} lines`);
  }
  return hits;
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return { eslint: 0, knip: 0, oversized_files: 0 };
  }
}

async function saveBaseline(counts) {
  await writeFile(BASELINE_PATH, JSON.stringify(counts, Object.keys(counts).sort(), 2) + '\n');
}

function report(label, findings) {
  if (findings.length === 0) return;
  console.log(`\n-- ${label} (${findings.length}) --`);
  for (const f of findings) console.log(f);
}

async function gather() {
  const [eslint, knip, oversized] = await Promise.all([eslintFindings(), knipFindings(), oversizedFiles()]);
  const counts = { eslint: eslint.length, knip: knip.length, oversized_files: oversized.length };
  return { counts, eslint, knip, oversized };
}

function reportAll({ eslint, knip, oversized }) {
  report('eslint', eslint);
  report('knip', knip);
  report(`oversized files (>${OVERSIZED_LIMIT} lines)`, oversized);
}

async function show() {
  const result = await gather();
  reportAll(result);
  console.log(`\n${JSON.stringify(result.counts)}`);
  return 0;
}

async function check() {
  const result = await gather();
  const baseline = loadBaseline();
  const { counts } = result;

  const regressed = Object.entries(counts).filter(([k, v]) => v > (baseline[k] ?? 0));
  const improved = Object.entries(counts).filter(([k, v]) => v < (baseline[k] ?? 0));

  if (regressed.length > 0) {
    reportAll(result);
    console.log('\nlint-ratchet: REGRESSION -- this commit raises the baseline:');
    for (const [k, now] of regressed) console.log(`  ${k}: ${baseline[k] ?? 0} -> ${now}  (+${now - (baseline[k] ?? 0)})`);
    console.log(`\nbaseline file: ${path.relative(ROOT, BASELINE_PATH)}`);
    return 1;
  }

  if (improved.length > 0) {
    await saveBaseline(counts);
    for (const [k, now] of improved) console.log(`lint-ratchet: ${k} improved: ${baseline[k] ?? 0} -> ${now}; lowered the baseline`);
    console.log(`baseline file rewritten: ${path.relative(ROOT, BASELINE_PATH)} -- add it to this commit`);
    return 0;
  }

  console.log(`lint-ratchet: no change from baseline (${JSON.stringify(counts)})`);
  return 0;
}

async function bootstrap() {
  const { counts } = await gather();
  await saveBaseline(counts);
  console.log(`lint-ratchet: baseline written: ${JSON.stringify(counts)}`);
  return 0;
}

const ACTIONS = { check, show, bootstrap };
const action = ACTIONS[process.argv[2]];
if (!action) {
  console.log(`usage: lint-ratchet.mjs <${Object.keys(ACTIONS).join('|')}>`);
  process.exit(2);
}
process.exitCode = await action();
