# The fixed-timestep loop

## Contents

- [The problem it solves](#the-problem-it-solves)
- [The mechanism](#the-mechanism)
- [The clamp, and reset](#the-clamp-and-reset)
- [Driving it](#driving-it)
- [Testing](#testing)
- [See also](#see-also)

`src/loop.ts` is the engine's first module: a loop that keeps simulation
time separate from render time. This article is the narrative version of
its module doc — the why, a worked timeline, and how to drive it. The
pattern is Glenn Fiedler's "Fix Your Timestep!"; what follows is how it
landed here and what each piece is for.

## The problem it solves

Game logic wants a fixed, deterministic unit of time: the same physics
step applied the same number of times for the same wall-clock span, on
any machine, at any frame rate. Rendering gets whatever the display
gives — 60 Hz, 144 Hz, a stutter. Tying simulation to frames couples
game speed to frame rate; tying it to a wall clock in irregular chunks
makes physics integration depend on frame timing. The fix: simulate in
fixed-size chunks, render as often as you like, and bridge the two.

## The mechanism

`GameLoop` holds an **accumulator**. Each call to `tick(nowMs)` — one
per render frame, with a monotonic clock reading — adds real elapsed
time, then drains the accumulator in `stepMs` chunks:

```text
stepMs = 20, previous tick at t=1000

tick(1050)   elapsed = 50 → accumulator = 50
             50 ≥ 20 → update   accumulator = 30
             30 ≥ 20 → update   accumulator = 10
             render(alpha = 10/20 = 0.5)
```

`update` runs zero, one, or several times per frame — however many whole
steps fit the real time that passed. The sub-step leftover is never
thrown away; it carries into the next tick and is reported to `render`
as `alpha`, in [0, 1): the fraction of a step the simulation state is
ahead of the last update. A renderer interpolates between the previous
and current update states by alpha, which is what keeps motion smooth
when frames and steps don't line up. Concretely: keep the state from
step N and step N+1, and draw `prev + (curr − prev) × alpha`.

Two edge cases are handled rather than hoped away:

- **The first tick** only bases the clock (there is no previous reading
  to subtract), and renders alpha 0 so the first frame still draws.
- **Non-monotonic time** — a repeated or backwards reading — counts as
  zero elapsed time instead of corrupting the accumulator with negative
  debt. `performance.now()` is monotonic; the loop doesn't require it.

## The clamp, and reset

Real elapsed time is clamped to `maxFrameMs` (default 250 ms) before it
enters the accumulator. Without the clamp, one slow frame needs more
update steps than it budgeted time for, so the next frame needs more
still — the **spiral of death**, ending in a permanently-lagging loop.
With it, a tab-backgrounded minute simulates at most a quarter second:
the game dilates time instead of freezing.

`reset()` is the other tool, for when the gap shouldn't be simulated at
all — pausing, returning from a menu. It zeroes the accumulator and
re-bases the clock so the next tick starts fresh. Clamp for "catch up,
bounded"; reset for "that time never happened".

## Driving it

The core has no timers and no DOM — the caller drives it from any
scheduler, which is what makes it deterministic under test:

```ts
import { GameLoop, startRafLoop } from "rusty-caltrop"; // in-repo: from src/index.ts

const loop = new GameLoop({
  update(stepMs) { /* advance the world by exactly stepMs */ },
  render(alpha) { /* draw, interpolating by alpha */ },
});

const stop = startRafLoop(loop); // browser: rAF + performance.now()
// ...later: stop()
```

`startRafLoop` (`src/raf.ts`) is the one environment-coupled piece. Any
other host — a server, a test, a custom scheduler — calls `tick(nowMs)`
itself.

## Testing

Because nothing inside ticks on its own, a test is just a timeline:
construct the loop with recording callbacks, call `tick` with chosen
timestamps, and assert on what drained. `src/loop.test.ts` covers the
accumulator arithmetic, the clamp (a 100 s gap yields exactly
`floor(250/20)` = 12 steps), backwards time, and reset. When writing
new expectations, recompute the accumulator math by hand first — the
first test run here failed on wrong expected values while the loop was
right every time (AGENTS.md, Traps).

## See also

- [Wiki index](README.md)
- [repo-init.md](repo-init.md) — the landing this module shipped with,
  and the toolchain (`npm run test` etc.) it's checked by.
- [Work in progress](work-in-progress.md) — `startRafLoop` has never run
  in a real browser; tracked there rather than claimed done here.
