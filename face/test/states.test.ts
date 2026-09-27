import { describe, expect, it } from 'vitest';
import { cloneParams, FACE_STATES, STATE_TABLE, stepVisual, targetAt } from '../src/math/states';

describe('state table', () => {
  it('defines every parameter for every state', () => {
    const keys = Object.keys(targetAt('idle', 0)).sort();
    for (const s of FACE_STATES) {
      const t = targetAt(s, 0);
      expect(Object.keys(t).sort()).toEqual(keys);
      for (const v of Object.values(t)) {
        if (Array.isArray(v)) v.forEach((c) => expect(Number.isFinite(c)).toBe(true));
        else expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('listening is the only warm-gold state and error is still', () => {
    expect(STATE_TABLE.listening.colorA[0]).toBeGreaterThan(STATE_TABLE.listening.colorA[2]);
    expect(STATE_TABLE.error.amp).toBe(0);
    expect(STATE_TABLE.error.rotSpeed).toBe(0);
  });

  it('only speaking and processing move the galaxy', () => {
    for (const s of FACE_STATES) expect(STATE_TABLE[s].galaxy > 0).toBe(s === 'speaking' || s === 'processing');
  });

  it('processing cycles from teal toward purple', () => {
    const a = targetAt('processing', 0).colorA;
    const b = targetAt('processing', Math.PI / 0.6).colorA;
    expect(b[2]).toBeGreaterThan(a[2]);
    expect(b[1]).toBeLessThan(a[1]);
  });

  it('eases to a new state within about a second, frame-rate independently', () => {
    const at60 = cloneParams(targetAt('idle', 0));
    const at30 = cloneParams(targetAt('idle', 0));
    const goal = targetAt('listening', 0);
    for (let i = 0; i < 60; i++) stepVisual(at60, goal, 1 / 60);
    for (let i = 0; i < 30; i++) stepVisual(at30, goal, 1 / 30);
    expect(at60.glow).toBeCloseTo(at30.glow, 10);
    const start = STATE_TABLE.idle.glow;
    expect((at60.glow - start) / (goal.glow - start)).toBeGreaterThan(0.95);
  });
});

describe('state labels', () => {
  it('names every state', async () => {
    const { STATE_LABELS } = await import('../src/math/states');
    for (const s of FACE_STATES) expect(STATE_LABELS[s].length).toBeGreaterThan(0);
  });
});
