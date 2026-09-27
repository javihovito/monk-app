/** Pure mapping from "how much the AI is saying" to what the galaxy does. */
export interface GalaxyDrive {
  lineOpacity: number;
  nodeScale: number;
  nodeBrightness: number;
  swell: number;
  rotSpeed: number;
  push: number;
  shake: number;
  skyBloom: number;
  skyNebula: number;
}

export const LINE_REST = 0.12;
export const LINE_PEAK = 0.65;

/** `drive` is 0..1: the galaxy weight for the current state times the AI's voice level. */
export function galaxyFor(drive: number): GalaxyDrive {
  const g = Math.max(0, Math.min(1, drive));
  return {
    lineOpacity: LINE_REST + (LINE_PEAK - LINE_REST) * g,
    nodeScale: 1 + 0.6 * g,
    nodeBrightness: 1 + 0.9 * g,
    swell: 1 + 0.04 * g,
    rotSpeed: 0.012 + 0.05 * g,
    push: 3 * g,
    shake: 0.04 * g,
    skyBloom: 1 + 1.8 * g,
    skyNebula: 1 + 0.6 * g,
  };
}

/** A gentle stand-in voice for "thinking", so the galaxy stirs while the AI works. */
export function thinkingHum(clock: number): number {
  return 0.3 + 0.1 * Math.sin(clock * 1.3);
}
