/**
 * Fixed-timestep game loop: simulation time advances in equal chunks,
 * decoupled from however often frames happen to be drawn. All times are
 * milliseconds.
 *
 * Mechanism: each {@link GameLoop.tick} adds real elapsed time to an
 * accumulator, then drains it in `stepMs`-sized chunks, calling `update` once
 * per chunk — so the same wall-clock span always runs the same number of
 * updates, whatever the frame rate. Whatever is left over (less than one
 * step) is carried into the next tick and reported to `render` as `alpha`, in
 * [0, 1): the fraction of a step the simulation state is ahead of the last
 * update. A renderer can blend the previous and current update states by
 * alpha to stay smooth between updates.
 *
 * The elapsed time fed into the accumulator is clamped to `maxFrameMs`.
 * Without that clamp, one slow frame (tab backgrounded, GC pause, debugger)
 * needs ever more updates per frame than the last — the "spiral of death" —
 * and the loop never catches up. With it, a bad frame costs at most
 * `maxFrameMs` of simulation time: the game dilates instead of freezing.
 *
 * This follows Glenn Fiedler, "Fix Your Timestep!"
 * (https://gafferongames.com/post/fix_your_timestep/).
 */
export interface GameLoopOptions {
  /** Called once per drained step, in order, while accumulated time lasts. */
  update: (stepMs: number) => void;
  /** Called once per tick; `alpha` is in [0, 1) — see the module doc. */
  render: (alpha: number) => void;
  /** Fixed simulation step in ms. Default: 1/60 s. */
  stepMs?: number;
  /** Clamp on real elapsed time per tick, in ms. Default: 250. */
  maxFrameMs?: number;
}

export const DEFAULT_STEP_MS = 1000 / 60;
export const DEFAULT_MAX_FRAME_MS = 250;

export class GameLoop {
  readonly stepMs: number;
  readonly maxFrameMs: number;

  #update: (stepMs: number) => void;
  #render: (alpha: number) => void;
  #accumulatorMs = 0;
  // Time of the previous tick; undefined until the first tick bases the clock.
  #lastMs: number | undefined;

  constructor(options: GameLoopOptions) {
    const stepMs = options.stepMs ?? DEFAULT_STEP_MS;
    const maxFrameMs = options.maxFrameMs ?? DEFAULT_MAX_FRAME_MS;
    // `!(x > 0)` also catches NaN, which a plain `x <= 0` check would pass.
    if (!(stepMs > 0) || !Number.isFinite(stepMs)) {
      // Interpolates `stepMs` (post-`??`), not `options.stepMs`: this branch
      // only runs when options.stepMs was explicitly set (an omitted one
      // becomes the always-valid default), so the two are equal here -- but
      // `stepMs` is narrowed to `number`, where `options.stepMs` is
      // `number | undefined` and trips restrict-template-expressions.
      throw new RangeError(`stepMs must be a positive finite number, got ${stepMs}`);
    }
    if (!(maxFrameMs > 0) || !Number.isFinite(maxFrameMs)) {
      throw new RangeError(`maxFrameMs must be a positive finite number, got ${maxFrameMs}`);
    }
    this.stepMs = stepMs;
    this.maxFrameMs = maxFrameMs;
    this.#update = options.update;
    this.#render = options.render;
  }

  /**
   * Advance the loop to `nowMs`, draining accumulated time into `update`
   * calls and then drawing via `render`. Call once per frame with a monotonic
   * clock reading (`performance.now()` in the browser); the first call only
   * bases the clock. A non-monotonic reading (or a repeated one) is treated
   * as zero elapsed time rather than corrupting the accumulator.
   */
  tick(nowMs: number): void {
    if (this.#lastMs === undefined) {
      this.#lastMs = nowMs;
      this.#render(0);
      return;
    }
    let elapsedMs = nowMs - this.#lastMs;
    this.#lastMs = nowMs;
    if (elapsedMs > this.maxFrameMs) elapsedMs = this.maxFrameMs;
    if (elapsedMs < 0) elapsedMs = 0;
    this.#accumulatorMs += elapsedMs;
    // Subtract before updating so the invariant "accumulator < one step"
    // holds even if `update` inspects the loop or throws mid-step.
    while (this.#accumulatorMs >= this.stepMs) {
      this.#accumulatorMs -= this.stepMs;
      this.#update(this.stepMs);
    }
    this.#render(this.#accumulatorMs / this.stepMs);
  }

  /**
   * Drop pending accumulated time and re-base the clock: the next `tick`
   * starts fresh, as if the loop had just been constructed. For resuming
   * after a pause where the gap should not be simulated at all — distinct
   * from the clamp, which simulates a bounded slice of the gap.
   */
  reset(): void {
    this.#accumulatorMs = 0;
    this.#lastMs = undefined;
  }
}
