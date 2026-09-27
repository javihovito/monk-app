/**
 * Frame-rate independent exponential easing.
 *
 * `rate` is how many "e-folds" of the remaining distance are covered per second.
 * Covering `1 - exp(-rate * dt)` of the gap each frame gives the same curve
 * whether the frame loop runs at 30, 60 or 120 fps.
 */
export function easeFactor(rate: number, dt: number): number {
  if (dt <= 0 || rate <= 0) return 0;
  return 1 - Math.exp(-rate * dt);
}

export function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * easeFactor(rate, dt);
}

/** Eases each channel of an RGB triple in place. */
export function approachRgb(
  current: [number, number, number],
  target: readonly [number, number, number],
  rate: number,
  dt: number,
): void {
  const k = easeFactor(rate, dt);
  current[0] += (target[0] - current[0]) * k;
  current[1] += (target[1] - current[1]) * k;
  current[2] += (target[2] - current[2]) * k;
}
