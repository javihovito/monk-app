import * as THREE from 'three';
import { boostMic, SILENT, smoothLevels, syntheticVoice, type AudioLevels } from '../math/audio';
import { galaxyFor, thinkingHum } from '../math/galaxy';
import { audioSourceFor, cloneParams, FACE_STATES, stepVisual, targetAt, type FaceState, type VisualParams } from '../math/states';
import { AudioTap, type PlaybackSource } from './audio';
import { Network } from './network';
import { Orb, type OrbFrame } from './orb';
import { Sky } from './sky';

export interface FaceOptions {
  /** Cap on devicePixelRatio. */
  maxPixelRatio?: number;
  /** Icosahedron detail for the orb mesh. */
  orbDetail?: number;
  /** Seed for the star network layout. Same seed, same galaxy. */
  seed?: number;
  /** Initial state. */
  state?: FaceState;
  /** Move from "arming" to "listening" on its own once the mic delivers real audio. Default true. */
  autoListen?: boolean;
}

/**
 * One renderer, one WebGL context. Passes per frame: sky, star network,
 * then clear depth and draw the orb with its own camera.
 */
export class FaceEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly orbScene = new THREE.Scene();
  private readonly orbCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  private readonly orb: Orb;
  private readonly sky = new Sky();
  private readonly network: Network;
  private readonly resizeObserver: ResizeObserver;

  private state: FaceState;
  private readonly visual: VisualParams;
  private readonly audio: AudioLevels = { ...SILENT };
  private readonly orbFrame: OrbFrame;
  private audioCtx: AudioContext | null = null;
  private micTap: AudioTap | null = null;
  private playbackTap: AudioTap | null = null;
  private readonly listeners = new Set<(s: FaceState) => void>();

  private rafId = 0;
  private lastTime = -1;
  private clock = 0;
  private destroyed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly opts: FaceOptions = {}) {
    this.state = opts.state ?? 'idle';
    this.visual = cloneParams(targetAt(this.state, 0));
    this.orbFrame = { ...this.visual, ...SILENT };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x05070d, 1);
    this.renderer.autoClear = false;

    this.orbCamera.position.set(0, 0, 4.2);
    this.orb = new Orb({ detail: opts.orbDetail ?? 24 });
    this.orbScene.add(this.orb.group);
    this.network = new Network({ seed: opts.seed });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.rafId = requestAnimationFrame(this.tick);
  }

  getState(): FaceState {
    return this.state;
  }

  /** The one entry point for the AI's state. Every visual eases toward it. */
  setState(state: FaceState): void {
    if (!FACE_STATES.includes(state)) throw new Error(`Unknown face state: ${String(state)}`);
    if (state === this.state) return;
    this.state = state;
    for (const fn of this.listeners) fn(state);
  }

  onStateChange(fn: (s: FaceState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private context(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    return this.audioCtx;
  }

  /** Taps the user's mic stream. Tap only; nothing is played back. */
  attachMic(stream: MediaStream): void {
    this.detachMic();
    this.micTap = AudioTap.fromStream(this.context(), stream);
  }

  detachMic(): void {
    this.micTap?.dispose();
    this.micTap = null;
  }

  /** Taps the AI's spoken reply: an AudioNode in your graph, a media element, or a stream. */
  attachPlayback(source: PlaybackSource): void {
    this.detachPlayback();
    if (source instanceof AudioNode) this.playbackTap = AudioTap.fromNode(source);
    else if (source instanceof MediaStream) this.playbackTap = AudioTap.fromStream(this.context(), source);
    else this.playbackTap = AudioTap.fromElement(this.context(), source);
  }

  detachPlayback(): void {
    this.playbackTap?.dispose();
    this.playbackTap = null;
  }

  /** Real audio when a tap exists for the current state's source, else a synthetic envelope. */
  private readAudio(): AudioLevels {
    const src = audioSourceFor(this.state);
    if (src === 'mic') return this.micTap ? boostMic(this.micTap.read()) : syntheticVoice(this.clock);
    if (src === 'playback') return this.playbackTap ? this.playbackTap.read() : syntheticVoice(this.clock + 7.3);
    if (this.state === 'arming' && this.micTap) {
      this.micTap.read();
      if (this.micTap.hasSignal && this.opts.autoListen !== false) this.setState('listening');
    }
    return SILENT;
  }

  private resize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxPixelRatio ?? 2));
    this.renderer.setSize(w, h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.sky.setResolution(size.x, size.y);
    this.network.setViewport(w, h, this.renderer.getPixelRatio());
    this.orbCamera.aspect = w / h;
    this.orbCamera.updateProjectionMatrix();
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.tick);
    const dt = this.lastTime < 0 ? 0 : Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.clock += dt;

    stepVisual(this.visual, targetAt(this.state, this.clock), dt);
    smoothLevels(this.audio, this.readAudio(), dt);
    Object.assign(this.orbFrame, this.visual, this.audio);

    // The galaxy answers the AI, not the user: voice while speaking, a hum while thinking.
    const voice = this.state === 'processing' ? thinkingHum(this.clock) : this.state === 'speaking' ? this.audio.level : 0;
    const g = galaxyFor(this.visual.galaxy * voice);

    this.orb.update(this.orbFrame, this.clock, dt);
    this.network.update(g, this.clock, dt);
    this.sky.update({ orbColor: this.visual.colorA, bloom: g.skyBloom * (0.6 + this.visual.glow), nebula: g.skyNebula }, this.clock);

    this.renderer.clear(true, true, true);
    this.renderer.render(this.sky.scene, this.sky.camera);
    this.renderer.render(this.network.scene, this.network.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.orbScene, this.orbCamera);
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.listeners.clear();
    this.detachMic();
    this.detachPlayback();
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.orb.dispose();
    this.sky.dispose();
    this.network.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
