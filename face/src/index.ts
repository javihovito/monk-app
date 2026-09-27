import { FaceEngine, type FaceOptions } from './engine/engine';

export type { FaceOptions } from './engine/engine';
export type { OrbFrame } from './engine/orb';

/** Mounts the face on a canvas. The engine has no dependency on any backend. */
export function createFace(canvas: HTMLCanvasElement, options?: FaceOptions): FaceEngine {
  return new FaceEngine(canvas, options);
}
