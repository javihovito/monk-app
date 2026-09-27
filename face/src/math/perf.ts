export type PerfMode = 'auto' | 'on' | 'off';

export interface PerfState {
  /** Smoothed frames per second. */
  fps: number;
  /** Seconds the smoothed fps has stayed below the threshold. */
  lowFor: number;
  /** Latched: once degraded in auto mode, it stays degraded (no flapping). */
  degraded: boolean;
}

export const PERF_FPS_THRESHOLD = 45;
export const PERF_LOW_SECONDS = 3;
/** Smoothing rate for the fps estimate, per second. */
const FPS_RATE = 3;

export function initialPerf(): PerfState {
  return { fps: 60, lowFor: 0, degraded: false };
}

/** Advances the frame-rate monitor by one frame of `dt` seconds. Pure. */
export function stepPerf(s: PerfState, dt: number): PerfState {
  if (s.degraded || dt <= 0) return s;
  const k = 1 - Math.exp(-FPS_RATE * dt);
  const fps = s.fps + (1 / dt - s.fps) * k;
  const lowFor = fps < PERF_FPS_THRESHOLD ? s.lowFor + dt : 0;
  return { fps, lowFor, degraded: lowFor >= PERF_LOW_SECONDS };
}

export function perfActive(mode: PerfMode, s: PerfState): boolean {
  return mode === 'on' || (mode === 'auto' && s.degraded);
}
