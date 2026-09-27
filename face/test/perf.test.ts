import { describe, expect, it } from 'vitest';
import { initialPerf, perfActive, stepPerf, type PerfState } from '../src/math/perf';

function run(s: PerfState, fps: number, seconds: number): PerfState {
  for (let t = 0; t < seconds; t += 1 / fps) s = stepPerf(s, 1 / fps);
  return s;
}

describe('performance mode', () => {
  it('stays off at a healthy frame rate', () => {
    expect(run(initialPerf(), 60, 10).degraded).toBe(false);
  });

  it('degrades after about 3 seconds under 45 fps', () => {
    expect(run(initialPerf(), 30, 2.5).degraded).toBe(false);
    expect(run(initialPerf(), 30, 4.5).degraded).toBe(true);
  });

  it('ignores a brief dip', () => {
    let s = run(initialPerf(), 30, 2);
    s = run(s, 60, 2);
    s = run(s, 30, 2);
    expect(s.degraded).toBe(false);
  });

  it('latches once degraded, with no flapping back', () => {
    const s = run(run(initialPerf(), 20, 5), 120, 30);
    expect(s.degraded).toBe(true);
  });

  it('honours the manual override', () => {
    const healthy = initialPerf();
    const slow = run(initialPerf(), 20, 5);
    expect(perfActive('on', healthy)).toBe(true);
    expect(perfActive('off', slow)).toBe(false);
    expect(perfActive('auto', slow)).toBe(true);
    expect(perfActive('auto', healthy)).toBe(false);
  });
});
