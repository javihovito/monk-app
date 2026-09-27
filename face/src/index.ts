import { FaceEngine, type FaceOptions } from './engine/engine';

export { FaceEngine } from './engine/engine';
export type { FaceOptions, FaceTheme } from './engine/engine';
export type { PerfMode } from './math/perf';
export type { PlaybackSource } from './engine/audio';
export { FACE_STATES, type FaceState } from './math/states';

/** Mounts the face on a canvas. The engine has no dependency on any backend. */
export function createFace(canvas: HTMLCanvasElement, options?: FaceOptions): FaceEngine {
  return new FaceEngine(canvas, options);
}
