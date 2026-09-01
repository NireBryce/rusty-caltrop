import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_FRAME_MS,
  DEFAULT_STEP_MS,
  GameLoop,
} from './loop.js';
import type { GameLoopOptions } from './loop.js';

/** Loop recording every update step and render alpha, with a 20 ms step. */
function harness(opts: Partial<GameLoopOptions> = {}) {
  const updates: number[] = [];
  const alphas: number[] = [];
  const loop = new GameLoop({
    stepMs: 20,
    update: (stepMs) => updates.push(stepMs),
    render: (alpha) => alphas.push(alpha),
    ...opts,
  });
  return { loop, updates, alphas };
}

describe('defaults', () => {
  it('uses a 60 Hz step and a 250 ms frame clamp', () => {
    const updates: number[] = [];
    const loop = new GameLoop({ update: (s) => updates.push(s), render: () => {} });
    expect(loop.stepMs).toBe(DEFAULT_STEP_MS);
    expect(loop.stepMs).toBeCloseTo(16.667, 2);
    expect(loop.maxFrameMs).toBe(DEFAULT_MAX_FRAME_MS);
    expect(updates).toEqual([]);
  });

  it('rejects a non-positive or non-finite step', () => {
    expect(() => harness({ stepMs: 0 })).toThrow(RangeError);
    expect(() => harness({ stepMs: -20 })).toThrow(RangeError);
    expect(() => harness({ stepMs: Number.NaN })).toThrow(RangeError);
    expect(() => harness({ maxFrameMs: 0 })).toThrow(RangeError);
  });
});

describe('tick', () => {
  it('only bases the clock on the first tick, rendering alpha 0', () => {
    const { loop, updates, alphas } = harness();
    loop.tick(1000);
    expect(updates).toEqual([]);
    expect(alphas).toEqual([0]);
  });

  it('drains whole steps and keeps the sub-step remainder as alpha', () => {
    const { loop, updates, alphas } = harness();
    loop.tick(1000);
    loop.tick(1050); // 50 ms elapsed, 20 ms step -> 2 updates, 10 ms left
    expect(updates).toEqual([20, 20]);
    expect(alphas[1]).toBeCloseTo(0.5, 10);
  });

  it('carries the remainder into later ticks', () => {
    const { loop, updates, alphas } = harness();
    loop.tick(1000);
    loop.tick(1025); // 25 ms -> 1 update, 5 ms left
    loop.tick(1030); // +5 ms -> 10 ms left, not enough for a step
    loop.tick(1050); // +20 ms -> 30 ms -> 1 update, 10 ms left
    expect(updates).toEqual([20, 20]);
    expect(alphas[1]).toBeCloseTo(0.25, 10);
    expect(alphas[2]).toBeCloseTo(0.5, 10);
    expect(alphas[3]).toBeCloseTo(0.5, 10);
  });

  it('clamps long gaps instead of spiraling', () => {
    const { loop, updates, alphas } = harness({ maxFrameMs: 250 });
    loop.tick(1000);
    loop.tick(101_000); // 100 s away, but only 250 ms may be simulated
    expect(updates).toHaveLength(12); // floor(250 / 20)
    expect(updates.every((step) => step === 20)).toBe(true);
    expect(alphas[1]).toBeCloseTo(0.5, 10); // 250 - 12*20 = 10 ms left
  });

  it('treats repeated and backwards timestamps as zero elapsed time', () => {
    const { loop, updates, alphas } = harness();
    loop.tick(1000);
    loop.tick(1000); // same timestamp
    loop.tick(999); // went backwards
    expect(updates).toEqual([]);
    expect(alphas).toEqual([0, 0, 0]);
  });
});

describe('reset', () => {
  it('discards accumulated time and re-bases the clock', () => {
    const { loop, updates, alphas } = harness();
    loop.tick(1000);
    loop.tick(1030); // 1 update, 10 ms pending
    loop.reset();
    loop.tick(1031); // fresh clock: bases again, simulates nothing
    loop.tick(1051); // 20 ms since the new base -> 1 update
    expect(updates).toEqual([20, 20]);
    expect(alphas).toEqual([0, 0.5, 0, 0]);
  });
});
