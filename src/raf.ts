import type { GameLoop } from './loop.js';

/**
 * Drive `loop` from `requestAnimationFrame`. Browser-only (DOM clock and
 * scheduler) — everything else in the engine is environment-agnostic and
 * driven by calling `tick` from whatever scheduler the host provides.
 *
 * Returns a stop function. One pending frame may still fire after stopping;
 * it returns immediately without ticking. Start again by calling this anew.
 */
export function startRafLoop(loop: GameLoop): () => void {
  let running = true;
  const frame = () => {
    if (!running) return;
    loop.tick(performance.now());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => {
    running = false;
  };
}
