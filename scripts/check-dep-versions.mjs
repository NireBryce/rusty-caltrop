#!/usr/bin/env node
// Fails when a registry dependency in package.json is declared on a major
// behind npm's current `latest` dist-tag. Preflight and CI run this, so a
// dep added or edited below the current major turns the next run red.
// Only majors are compared: minors and patches ride the caret range, while
// deprecations and breaking changes land on majors.
//
// Needs the registry (one `npm view` per dep). Specs that don't look like
// registry ranges (git URLs, file paths, workspace:*) are skipped — their
// currency is not checkable here.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);
const npmViewLatestVersion = (name) => run('npm', ['view', name, 'version']);

// Deps deliberately allowed to sit behind npm's latest major, each with the
// reason it may. Anything listed here skips the check; every entry must say
// why, and what would let it come off the list.
const ALLOWED_BEHIND_LATEST = new Map([
  // Tracks the runtime major (nodejs_24 in flake.nix, node-version 24 in
  // CI), not the newest Node release — newer type packages describe APIs
  // the engine never runs on. Comes off if the flake pin moves to that
  // major.
  ['@types/node', 'pinned to the runtime major (24)'],
  // typescript-eslint's peer range tops out below TypeScript 7 (<6.1.0, and
  // no stable TS 6 exists), so the newest supported TS is the newest 5.x.
  // Comes off when a typescript-eslint release supports TS 7.
  ['typescript', 'typescript-eslint peer ceiling (<6.1.0)'],
]);

const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];

// First integer in a spec is its major: ^10.9.1 -> 10, ~3.2 -> 3. Specs
// with no integer aren't registry version ranges; the caller skips them.
function declaredMajor(spec) {
  const match = /\d+/.exec(spec);
  return match === null ? undefined : Number(match[0]);
}

const manifestPath = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const deps = new Map();
for (const field of DEP_FIELDS) {
  for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
    if (!deps.has(name)) deps.set(name, { field, spec });
  }
}

const results = await Promise.all(
  [...deps].map(async ([name, { field, spec }]) => {
    const major = declaredMajor(spec);
    if (major === undefined) return null;
    if (ALLOWED_BEHIND_LATEST.has(name)) return null;
    let latest;
    try {
      latest = (await npmViewLatestVersion(name)).stdout.trim();
    } catch (err) {
      return { name, field, problem: `registry lookup failed: ${err.message}` };
    }
    const latestMajor = declaredMajor(latest);
    if (latestMajor === undefined || major >= latestMajor) return null;
    const installFlag = field === 'devDependencies' ? '-D ' : '';
    return {
      name,
      field,
      problem: `declared ${spec}, npm latest is ${latest} — add at the current major (npm install ${installFlag}${name}@^${latest})`,
    };
  }),
);

const failures = results.filter((r) => r !== null);
if (failures.length > 0) {
  console.error('package.json has dependencies behind npm latest:');
  for (const f of failures) console.error(`  ${f.name} (${f.field}): ${f.problem}`);
  process.exitCode = 1;
} else {
  console.log(`check-deps: ${deps.size} dependencies current with npm latest (or deliberately excepted).`);
}
