import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default include is **/*.test.ts, which reaches into .direnv/ (nix store
    // copies of flake inputs) and runs other repos' test files. Ours live in
    // src/ only.
    include: ['src/**/*.test.ts'],
  },
});
