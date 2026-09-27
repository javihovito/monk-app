import { FACE_STATES, type FaceState } from './states';
import type { AudioLevels } from './audio';

/**
 * Wire protocol for a local voice loop (e.g. Monk's Python process) driving the face.
 * One JSON object per WebSocket message:
 *   {"type": "state", "state": "listening"}
 *   {"type": "levels", "level": 0.4, "bass": 0.2, "treble": 0.1}   // 0..1, ~30 per second
 */
export type BridgeMessage =
  | { type: 'state'; state: FaceState }
  | { type: 'levels'; levels: AudioLevels };

const clamp01 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Parses one message; returns null for anything malformed or unknown. Pure. */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  if (m.type === 'state' && typeof m.state === 'string' && (FACE_STATES as readonly string[]).includes(m.state)) {
    return { type: 'state', state: m.state as FaceState };
  }
  if (m.type === 'levels') {
    return { type: 'levels', levels: { level: clamp01(m.level), bass: clamp01(m.bass), treble: clamp01(m.treble) } };
  }
  return null;
}

/** Reconnect delay: 0.5 s doubling to a 10 s cap. */
export function reconnectDelay(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** Math.max(0, attempt));
}
