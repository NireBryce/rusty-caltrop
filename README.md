# rusty-caltrop

**Extremely work-in-progress.** A small game engine in TypeScript, built as
a learning exercise — expect breaking changes, gaps, and reinvented wheels.
Agent working notes live in [AGENTS.md](AGENTS.md).

Currently: a fixed-timestep loop (`src/loop.ts`). Simulation updates run in
equal time chunks decoupled from render frames — real elapsed time is
accumulated per frame and drained in fixed `stepMs` chunks, the sub-step
leftover is handed to the renderer as `alpha` for interpolation, and long
gaps are clamped so one slow frame dilates time instead of freezing it.
Pattern follows [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/).

## Development

Node 24 + npm, via the Nix dev shell (`nix develop`, or direnv).

```sh
npm install
npm run preflight   # typecheck + lint + test + check-deps (needs network)
npm run test        # vitest, watchless
npm run build       # emit dist/
```
