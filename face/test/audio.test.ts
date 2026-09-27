import { describe, expect, it } from 'vitest';
import { bandLevels, boostMic, MIC_FLOOR, smoothLevels, syntheticVoice } from '../src/math/audio';
import { galaxyFor } from '../src/math/galaxy';

describe('audio levels', () => {
  it('splits bins into bass, voice and treble bands', () => {
    const bins = new Uint8Array(100);
    bins.fill(255, 0, 6);
    expect(bandLevels(bins)).toEqual({ level: 0, bass: 1, treble: 0 });
    bins.fill(0);
    bins.fill(255, 10, 60);
    expect(bandLevels(bins).level).toBeCloseTo(1);
    bins.fill(0);
    bins.fill(255, 65, 100);
    expect(bandLevels(bins).treble).toBeCloseTo(1);
    expect(bandLevels([])).toEqual({ level: 0, bass: 0, treble: 0 });
  });

  it('boosts the mic with a floor and clamps', () => {
    expect(boostMic({ level: 0, bass: 0, treble: 0 }).level).toBe(MIC_FLOOR);
    expect(boostMic({ level: 0.2, bass: 0, treble: 0 }).level).toBeCloseTo(MIC_FLOOR + 0.48);
    expect(boostMic({ level: 1, bass: 1, treble: 1 }).level).toBe(1);
  });

  it('attacks fast and decays slowly', () => {
    const up = smoothLevels({ level: 0, bass: 0, treble: 0 }, { level: 1, bass: 1, treble: 1 }, 1 / 60);
    expect(up.level).toBeCloseTo(0.45, 6);
    const down = smoothLevels({ level: 1, bass: 1, treble: 1 }, { level: 0, bass: 0, treble: 0 }, 1 / 60);
    expect(down.level).toBeCloseTo(0.92, 6);
  });

  it('smooths the same at 30 and 60 fps', () => {
    const a = { level: 0, bass: 0, treble: 0 };
    const b = { level: 0, bass: 0, treble: 0 };
    for (let i = 0; i < 20; i++) smoothLevels(a, { level: 0.8, bass: 0.3, treble: 0.1 }, 1 / 60);
    for (let i = 0; i < 10; i++) smoothLevels(b, { level: 0.8, bass: 0.3, treble: 0.1 }, 1 / 30);
    expect(a.level).toBeCloseTo(b.level, 10);
  });

  it('synthetic voice is deterministic, bounded and varies like speech', () => {
    expect(syntheticVoice(3.21)).toEqual(syntheticVoice(3.21));
    let min = 1;
    let max = 0;
    for (let t = 0; t < 20; t += 0.05) {
      const v = syntheticVoice(t);
      for (const x of [v.level, v.bass, v.treble]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
      min = Math.min(min, v.level);
      max = Math.max(max, v.level);
    }
    expect(max - min).toBeGreaterThan(0.4);
  });
});

describe('galaxy drive', () => {
  it('brightens lines from 12% toward 65% and clamps', () => {
    expect(galaxyFor(0).lineOpacity).toBeCloseTo(0.12);
    expect(galaxyFor(1).lineOpacity).toBeCloseTo(0.65);
    expect(galaxyFor(5)).toEqual(galaxyFor(1));
    expect(galaxyFor(1).swell).toBeLessThan(1.06);
  });
});
