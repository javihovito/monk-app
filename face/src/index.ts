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
export { connectBridge, DEFAULT_BRIDGE_URL, type BridgeConnection, type BridgeOptions } from './bridge';
export { withToken, type CaptionSpeaker, type InfoItem } from './math/bridge';
export { createOverlay, type Overlay } from './ui/overlay';
export { createRemoteTalk, type RemoteTalk } from './ui/talk';
