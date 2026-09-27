import { FACE_STATES, type FaceState } from './states';
import type { AudioLevels } from './audio';

/**
 * Wire protocol for a local voice loop (e.g. Monk's Python process) driving the face.
 * One JSON object per WebSocket message:
 *   {"type": "state", "state": "listening"}
 *   {"type": "levels", "level": 0.4, "bass": 0.2, "treble": 0.1}   // 0..1, ~30 per second
 *   {"type": "caption", "who": "user" | "monk", "text": "...", "final": true}
 *   {"type": "info", "items": [{"kind": "meeting" | "email", "text": "..."}]}   // at most 3 shown
 *   {"type": "tts", "rate": 22050}  then binary Int16 LE mono chunks, then {"type": "tts_end"}
 *
 * Page → Monk (remote talk, LAN token mode only):
 *   {"type": "ptt", "down": true | false}  with binary Int16 LE mono 16 kHz frames in between
 */
export type CaptionSpeaker = 'user' | 'monk';
export interface InfoItem {
  kind: 'meeting' | 'email' | 'other';
  text: string;
}

export type BridgeMessage =
  | { type: 'state'; state: FaceState }
  | { type: 'levels'; levels: AudioLevels }
  | { type: 'caption'; who: CaptionSpeaker; text: string; final: boolean }
  | { type: 'info'; items: InfoItem[] }
  | { type: 'tts'; rate: number }
  | { type: 'tts_end' };

export const MAX_CAPTION_CHARS = 280;
export const MAX_INFO_ITEMS = 3;
const MAX_INFO_CHARS = 120;

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
  if (m.type === 'caption' && (m.who === 'user' || m.who === 'monk') && typeof m.text === 'string') {
    // Keep the tail of long replies: the newest words are what is being spoken.
    const text = m.text.length > MAX_CAPTION_CHARS ? '…' + m.text.slice(-MAX_CAPTION_CHARS) : m.text;
    return { type: 'caption', who: m.who, text, final: m.final === true };
  }
  if (m.type === 'tts' && typeof m.rate === 'number' && m.rate >= 8000 && m.rate <= 96000) {
    return { type: 'tts', rate: m.rate };
  }
  if (m.type === 'tts_end') return { type: 'tts_end' };
  if (m.type === 'info' && Array.isArray(m.items)) {
    const items: InfoItem[] = [];
    for (const it of m.items) {
      if (!it || typeof it !== 'object' || typeof (it as Record<string, unknown>).text !== 'string') continue;
      const r = it as Record<string, unknown>;
      const kind = r.kind === 'meeting' || r.kind === 'email' ? r.kind : 'other';
      items.push({ kind, text: (r.text as string).slice(0, MAX_INFO_CHARS) });
      if (items.length === MAX_INFO_ITEMS) break;
    }
    return { type: 'info', items };
  }
  return null;
}

/**
 * Adds `token` to a WebSocket URL's query unless it already carries one.
 * Used when the face is opened on another device over the local network.
 */
export function withToken(url: string, token: string | null): string {
  if (!token) return url;
  const u = new URL(url);
  if (!u.searchParams.has('token')) u.searchParams.set('token', token);
  return u.toString();
}

/** Reconnect delay: 0.5 s doubling to a 10 s cap. */
export function reconnectDelay(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** Math.max(0, attempt));
}
