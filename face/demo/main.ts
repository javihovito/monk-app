import { createFace, FACE_STATES, type FaceEngine, type FaceState } from '../src/index';

let canvas = document.getElementById('face') as HTMLCanvasElement;
let face: FaceEngine;
let micStream: MediaStream | null = null;
let tone: { ctx: AudioContext; out: GainNode; stop: () => void } | null = null;

const stateRow = document.getElementById('states')!;
const buttons = new Map<FaceState, HTMLButtonElement>();
for (const s of FACE_STATES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s;
  b.addEventListener('click', () => face.setState(s));
  stateRow.append(b);
  buttons.set(s, b);
}

function reflect(state: FaceState): void {
  for (const [s, b] of buttons) b.setAttribute('aria-pressed', String(s === state));
}

function mount(): void {
  const state = face ? face.getState() : 'idle';
  face = createFace(canvas, { state });
  face.onStateChange(reflect);
  reflect(state);
  if (micStream) face.attachMic(micStream);
  if (tone) face.attachPlayback(tone.out);
}

document.getElementById('mic')!.addEventListener('click', async () => {
  face.setState('arming');
  try {
    micStream ??= await navigator.mediaDevices.getUserMedia({ audio: true });
    face.attachMic(micStream); // moves to "listening" once real audio arrives
  } catch {
    face.setState('error');
  }
});

// A speech-ish test tone: a buzzy carrier with a syllable-rate tremolo, tapped as "playback".
document.getElementById('tone')!.addEventListener('click', () => {
  if (tone) {
    tone.stop();
    tone = null;
    face.detachPlayback();
    face.setState('idle');
    return;
  }
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 160;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.12;
  const out = ctx.createGain();
  out.gain.value = 0.12;
  lfo.connect(lfoGain).connect(out.gain);
  osc.connect(out).connect(ctx.destination);
  osc.start();
  lfo.start();
  tone = { ctx, out, stop: () => { osc.stop(); lfo.stop(); void ctx.close(); } };
  face.attachPlayback(out);
  face.setState('speaking');
});

document.getElementById('recreate')!.addEventListener('click', () => {
  face.destroy();
  // A released WebGL context can't be reused, so recreate on a fresh canvas.
  const fresh = canvas.cloneNode() as HTMLCanvasElement;
  canvas.replaceWith(fresh);
  canvas = fresh;
  mount();
});

mount();
Object.assign(window, { face: () => face });
