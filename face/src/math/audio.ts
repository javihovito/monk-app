import { easeFactor } from './easing';

export interface AudioLevels {
  level: number;
  bass: number;
  treble: number;
}

export const SILENT: AudioLevels = { level: 0, bass: 0, treble: 0 };

function avg(bins: ArrayLike<number>, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(bins.length, Math.max(a + 1, Math.floor(to)));
  let s = 0;
  for (let i = a; i < b; i++) s += bins[i];
  return b > a ? s / (b - a) / 255 : 0;
}

/** Byte frequency bins (0..255) to levels: voice = bins 10–60%, bass = first 6, treble = 65%+. */
export function bandLevels(bins: ArrayLike<number>): AudioLevels {
  const n = bins.length;
  if (n === 0) return { ...SILENT };
  return {
    level: avg(bins, n * 0.1, n * 0.6),
    bass: avg(bins, 0, 6),
    treble: avg(bins, n * 0.65, n),
  };
}

export const MIC_GAIN = 2.4;
export const MIC_FLOOR = 0.05;

/** Boost the mic so the orb never looks dead between syllables. */
export function boostMic(l: AudioLevels): AudioLevels {
  const b = (v: number) => Math.min(1, MIC_FLOOR + v * MIC_GAIN);
  return { level: b(l.level), bass: b(l.bass), treble: b(l.treble) };
}

/** Per-frame factors at 60 fps, converted to rates so smoothing is frame-rate independent. */
export const ATTACK = 0.45;
export const DECAY = 0.08;
const ATTACK_RATE = -Math.log(1 - ATTACK) * 60;
const DECAY_RATE = -Math.log(1 - DECAY) * 60;

function smooth1(prev: number, next: number, dt: number): number {
  const rate = next > prev ? ATTACK_RATE : DECAY_RATE;
  return prev + (next - prev) * easeFactor(rate, dt);
}

/** Fast attack, slow decay: it breathes instead of twitching. Mutates and returns `prev`. */
export function smoothLevels(prev: AudioLevels, next: AudioLevels, dt: number): AudioLevels {
  prev.level = smooth1(prev.level, next.level, dt);
  prev.bass = smooth1(prev.bass, next.bass, dt);
  prev.treble = smooth1(prev.treble, next.treble, dt);
  return prev;
}

/**
 * Deterministic speech-like envelope for when no real audio is available:
 * syllables at ~4-6 Hz inside phrases of a few seconds with short pauses.
 */
export function syntheticVoice(t: number): AudioLevels {
  const phrase = Math.max(0, Math.sin(t * 0.9) * 0.8 + Math.sin(t * 0.37 + 1.3) * 0.5 + 0.2);
  const phraseGate = Math.min(1, phrase * 1.6);
  const syll = Math.pow(Math.abs(Math.sin(t * 5.1) * 0.7 + Math.sin(t * 7.3 + 0.8) * 0.3), 1.5);
  const level = Math.min(1, phraseGate * (0.15 + 0.6 * syll));
  const bass = Math.min(1, phraseGate * (0.1 + 0.45 * Math.abs(Math.sin(t * 2.6 + 0.4))));
  const treble = Math.min(1, phraseGate * 0.35 * Math.pow(Math.abs(Math.sin(t * 9.7 + 2.1)), 3));
  return { level, bass, treble };
}
