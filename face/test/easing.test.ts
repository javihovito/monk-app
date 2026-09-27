import { describe, expect, it } from 'vitest';
import { approach, approachRgb, easeFactor } from '../src/math/easing';

describe('easing', () => {
  it('60 small steps and 30 double steps land in the same place', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 60; i++) a = approach(a, 1, 3, 1 / 60);
    for (let i = 0; i < 30; i++) b = approach(b, 1, 3, 1 / 30);
    expect(a).toBeCloseTo(b, 10);
    expect(a).toBeCloseTo(1 - Math.exp(-3), 10);
  });

  it('matches across 120 fps and uneven frame times', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 120; i++) a = approach(a, 5, 2, 1 / 120);
    for (const dt of [0.1, 0.25, 0.05, 0.3, 0.2, 0.1]) b = approach(b, 5, 2, dt);
    expect(a).toBeCloseTo(b, 10);
  });

  it('never overshoots and ignores non-positive dt', () => {
    expect(approach(0, 1, 1000, 1)).toBeLessThanOrEqual(1);
    expect(approach(0.3, 1, 5, 0)).toBe(0.3);
    expect(easeFactor(5, -1)).toBe(0);
  });

  it('eases colours per channel', () => {
    const c: [number, number, number] = [0, 0, 0];
    approachRgb(c, [1, 0.5, 0.25], 4, 10);
    expect(c[0]).toBeCloseTo(1, 6);
    expect(c[1]).toBeCloseTo(0.5, 6);
    expect(c[2]).toBeCloseTo(0.25, 6);
  });
});
