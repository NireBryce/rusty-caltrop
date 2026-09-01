import tseslint from 'typescript-eslint';

// strictTypeChecked + stylisticTypeChecked, not recommended*: this is the
// tier that actually teaches something on a learning project (catches
// implicit `any`, unsafe casts, unawaited promises) rather than the floor
// tier that mostly checks for typos.
//
// Findings from this tier are NOT required to hit zero -- `npm run lint`
// (scripts/lint-ratchet.mjs) ratchets the count against a committed
// baseline instead of demanding a clean tree, so turning this tier on
// doesn't require fixing every pre-existing finding before it can land.
// See that script's header for the full reasoning (ported from
// NireBryce/nixos-configs' statix+deadnix ratchet).
export default tseslint.config(
  { ignores: ['dist/'] },

  // Untyped baseline for every linted file, config files and scripts/
  // included -- catches real mistakes without needing type info.
  ...tseslint.configs.recommended,

  {
    // The type-checked tier below needs `projectService` to resolve a
    // tsconfig that actually covers the file being linted. Scoped to
    // src/**/*.ts (what tsconfig.json's `include` covers) rather than
    // applied globally: eslint.config.js, scripts/*.mjs and
    // vitest.config.ts aren't in that include, so project service can't
    // find them -- pointed the type-aware rules at everything and those
    // three failed to parse ("not found by the project service") instead
    // of just linting without type info like they did before.
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // no-floating-promises, no-misused-promises (strictTypeChecked) and
      // no-non-null-assertion (stylisticTypeChecked) already come from the
      // presets above -- not re-listed here since they need no override.
      // They matter for the same reason as the two below: an unawaited
      // promise inside a raf/tick callback silently does nothing (same
      // shape as Home Manager's mkOrder-550 silently losing a hook), and
      // `x!` is "trust me" exactly like reading `lsblk` inside the wrong
      // mount namespace -- looks right, is a lie precisely when it matters.
      //
      // The two below ARE listed explicitly because neither preset
      // includes them:

      // A game-state (or any) union gaining a member with no matching
      // `case` doesn't error -- it falls through to nothing and the bug
      // shows up as a symptom far from the switch, same shape as
      // NireBryce/nixos-configs' flake-parts module class not being
      // validated until the far-away import site. Not in any preset
      // (opt-in because it can be noisy on unions that never need to grow);
      // worth the noise here on purpose.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // Core JS rule, not TS-aware, but same failure shape one level up:
      // a missing `break` silently runs the next case's body too. Not
      // pulled in by any typescript-eslint preset (those don't extend
      // eslint:recommended), so it needs to be named explicitly.
      'no-fallthrough': 'error',

      // strictTypeChecked's no-empty-function otherwise flags a test's
      // `render: () => {}` stub -- a legitimate no-op callback where a
      // test doesn't care about that half of the interface, not a mistake.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],

      // strictTypeChecked's restrict-template-expressions sets
      // allowNumber: false along with the other allow* flags -- fine for
      // catching an accidental `${someObject}`, but interpolating a plain
      // number into an error message (as in loop.ts's RangeError text) is
      // safe and common enough that most adopters of this preset re-allow
      // it; every other allow* flag stays off.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
);
