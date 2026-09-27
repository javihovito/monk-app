import { approach, approachRgb } from './easing';

export type Rgb = [number, number, number];

export const FACE_STATES = ['idle', 'arming', 'listening', 'processing', 'speaking', 'error'] as const;
export type FaceState = (typeof FACE_STATES)[number];

/** Every visual parameter that differs by state. The one and only place they are defined. */
export interface VisualParams {
  colorA: Rgb;
  colorB: Rgb;
  opacity: number;
  fresnelPow: number;
  noiseSpeed: number;
  amp: number;
  base: number;
  breath: number;
  glow: number;
  rotSpeed: number;
  ringOpacity: number;
  /** 0..1: how strongly the galaxy (network + sky) answers the voice in this state. */
  galaxy: number;
}

interface StateSpec extends VisualParams {
  /** Processing: second colour colorA cycles toward, and cycle speed in rad/s. */
  cycleTo?: Rgb;
  cycleSpeed?: number;
  /** Small glow pulse amplitude and speed. */
  pulse?: number;
  pulseSpeed?: number;
  /** Where the orb's audio comes from. */
  audio: 'none' | 'mic' | 'playback';
}

export const STATE_TABLE: Readonly<Record<FaceState, Readonly<StateSpec>>> = {
  idle: {
    colorA: [0.16, 0.62, 0.58], colorB: [0.4, 0.75, 0.85],
    opacity: 0.6, fresnelPow: 2.8, noiseSpeed: 0.3, amp: 0.35, base: 0.012, breath: 1,
    glow: 0.25, rotSpeed: 0.05, ringOpacity: 0, galaxy: 0, audio: 'none',
  },
  arming: {
    colorA: [0.62, 0.3, 0.12], colorB: [0.82, 0.46, 0.22],
    opacity: 0.6, fresnelPow: 2.6, noiseSpeed: 0.35, amp: 0.3, base: 0.014, breath: 1,
    glow: 0.28, rotSpeed: 0.05, ringOpacity: 0, galaxy: 0, audio: 'none',
  },
  listening: {
    colorA: [1.0, 0.76, 0.26], colorB: [1.0, 0.92, 0.62],
    opacity: 0.95, fresnelPow: 2.2, noiseSpeed: 0.55, amp: 0.7, base: 0.02, breath: 1,
    glow: 0.55, rotSpeed: 0.08, ringOpacity: 0, galaxy: 0, audio: 'mic',
  },
  processing: {
    colorA: [0.2, 0.8, 0.75], colorB: [0.72, 0.62, 1.0],
    cycleTo: [0.62, 0.4, 0.98], cycleSpeed: 0.6, pulse: 0.18, pulseSpeed: 2.4,
    opacity: 0.85, fresnelPow: 2.4, noiseSpeed: 0.8, amp: 0.5, base: 0.05, breath: 1,
    glow: 0.5, rotSpeed: 0.22, ringOpacity: 0.8, galaxy: 1, audio: 'none',
  },
  speaking: {
    colorA: [0.25, 0.95, 0.85], colorB: [0.65, 1.0, 1.0],
    opacity: 0.95, fresnelPow: 2.2, noiseSpeed: 0.6, amp: 0.8, base: 0.02, breath: 1,
    glow: 0.55, rotSpeed: 0.1, ringOpacity: 0, galaxy: 1, audio: 'playback',
  },
  error: {
    colorA: [0.95, 0.24, 0.24], colorB: [1.0, 0.5, 0.45],
    opacity: 0.9, fresnelPow: 4.2, noiseSpeed: 0.05, amp: 0, base: 0.004, breath: 0.15,
    glow: 0.35, rotSpeed: 0, ringOpacity: 0, galaxy: 0, audio: 'none',
  },
};

export function audioSourceFor(state: FaceState): StateSpec['audio'] {
  return STATE_TABLE[state].audio;
}

/** The target for `state` at animation time `clock` (applies colour cycles and pulses). */
export function targetAt(state: FaceState, clock: number): VisualParams {
  const s = STATE_TABLE[state];
  const t: VisualParams = {
    colorA: [...s.colorA], colorB: [...s.colorB],
    opacity: s.opacity, fresnelPow: s.fresnelPow, noiseSpeed: s.noiseSpeed, amp: s.amp, base: s.base,
    breath: s.breath, glow: s.glow, rotSpeed: s.rotSpeed, ringOpacity: s.ringOpacity, galaxy: s.galaxy,
  };
  if (s.cycleTo && s.cycleSpeed) {
    const k = 0.5 - 0.5 * Math.cos(clock * s.cycleSpeed);
    for (let i = 0; i < 3; i++) t.colorA[i] = s.colorA[i] + (s.cycleTo[i] - s.colorA[i]) * k;
  }
  if (s.pulse && s.pulseSpeed) t.glow *= 1 + s.pulse * Math.sin(clock * s.pulseSpeed);
  return t;
}

export function cloneParams(p: VisualParams): VisualParams {
  return { ...p, colorA: [...p.colorA], colorB: [...p.colorB] };
}

/** Rate for state transitions: ~98% of the way in one second. */
export const STATE_EASE_RATE = 4;

const SCALAR_KEYS = [
  'opacity', 'fresnelPow', 'noiseSpeed', 'amp', 'base', 'breath', 'glow', 'rotSpeed', 'ringOpacity', 'galaxy',
] as const;

/** Moves every parameter part of the way toward the target. Nothing snaps. Mutates `current`. */
export function stepVisual(current: VisualParams, target: VisualParams, dt: number, rate = STATE_EASE_RATE): VisualParams {
  approachRgb(current.colorA, target.colorA, rate, dt);
  approachRgb(current.colorB, target.colorB, rate, dt);
  for (const k of SCALAR_KEYS) current[k] = approach(current[k], target[k], rate, dt);
  return current;
}

/** What the live region announces for each state. */
export const STATE_LABELS: Readonly<Record<FaceState, string>> = {
  idle: 'Idle',
  arming: 'Waiting for the microphone',
  listening: 'Listening',
  processing: 'Thinking',
  speaking: 'Speaking',
  error: 'Something went wrong',
};
