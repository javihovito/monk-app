import * as THREE from 'three';
import { boostMic, SILENT, smoothLevels, syntheticVoice, type AudioLevels } from '../math/audio';
import { galaxyFor, thinkingHum } from '../math/galaxy';
import { approach } from '../math/easing';
import { initialPerf, perfActive, stepPerf, type PerfMode, type PerfState } from '../math/perf';
import { audioSourceFor, cloneParams, FACE_STATES, STATE_LABELS, stepVisual, targetAt, type FaceState, type VisualParams } from '../math/states';
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
  /** Initial theme. Default 'dark'. */
  theme?: FaceTheme;
  /** Performance mode: 'auto' (default) measures frame rate and drops quality once. */
  performance?: PerfMode;
  /**
   * Where to announce the current state for screen readers. Default: a visually hidden
   * polite live region inserted after the canvas. Pass false to handle it yourself.
   */
  liveRegion?: HTMLElement | false;
}

export type FaceTheme = 'dark' | 'light';

const ORB_CAMERA_DISTANCE = 4.2;
const PERF_ORB_DETAIL = 12;
const PERF_NETWORK_DENSITY = 0.45;
/** Reduced motion slows the animation clock to this fraction. */
const REDUCED_MOTION_SPEED = 0.2;

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
  private external: AudioLevels | null = null;
  private externalAt = -1;
  private readonly listeners = new Set<(s: FaceState) => void>();

  private theme: FaceTheme = 'dark';
  private light = 0;
  private perfMode: PerfMode;
  private perf: PerfState = initialPerf();
  private perfApplied = false;
  private readonly motionQuery: MediaQueryList | null;
  private reducedMotionOverride: boolean | null = null;
  private motionSpeed = 1;
  private readonly liveRegion: HTMLElement | null;
  private readonly ownsLiveRegion: boolean;

  private rafId = 0;
  private lastTime = -1;
  /** Real seconds since start: drives easing, audio and perf. */
  private time = 0;
  /** Animation clock: advances slower under reduced motion. Drives every phase. */
  private clock = 0;
  private destroyed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly opts: FaceOptions = {}) {
    this.state = opts.state ?? 'idle';
    this.visual = cloneParams(targetAt(this.state, 0));
    this.orbFrame = { ...this.visual, ...SILENT };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x05070d, 1);
    this.renderer.autoClear = false;

    this.orbCamera.position.set(0, 0, ORB_CAMERA_DISTANCE);
    this.orb = new Orb({ detail: opts.orbDetail ?? 24 });
    this.orbScene.add(this.orb.group);
    this.network = new Network({ seed: opts.seed });

    this.perfMode = opts.performance ?? 'auto';
    this.motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.motionSpeed = this.reducedMotion() ? REDUCED_MOTION_SPEED : 1;

    if (opts.liveRegion === false) {
      this.liveRegion = null;
      this.ownsLiveRegion = false;
    } else if (opts.liveRegion) {
      this.liveRegion = opts.liveRegion;
      this.ownsLiveRegion = false;
    } else {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.className = 'monk-face-status';
      Object.assign(el.style, {
        position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0',
        overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: '0',
      });
      canvas.after(el);
      this.liveRegion = el;
      this.ownsLiveRegion = true;
    }
    this.announce();

    this.setTheme(opts.theme ?? 'dark', true);
    this.applyPerf();

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
    this.announce();
    for (const fn of this.listeners) fn(state);
  }

  private announce(): void {
    if (this.liveRegion) this.liveRegion.textContent = STATE_LABELS[this.state];
  }

  getTheme(): FaceTheme {
    return this.theme;
  }

  /** Switches theme. The sky eases between them; blending switches at once. */
  setTheme(theme: FaceTheme, immediate = false): void {
    this.theme = theme;
    const isLight = theme === 'light';
    this.renderer.setClearColor(isLight ? 0xeef2f7 : 0x05070d, 1);
    this.orb.setTheme(isLight);
    this.network.setTheme(isLight);
    if (immediate) this.light = isLight ? 1 : 0;
  }

  getPerformanceMode(): PerfMode {
    return this.perfMode;
  }

  /** 'on' forces the lighter scene, 'off' never uses it, 'auto' decides from frame rate. */
  setPerformanceMode(mode: PerfMode): void {
    this.perfMode = mode;
    this.applyPerf();
  }

  /** True while the lighter scene is in use. */
  isPerformanceActive(): boolean {
    return this.perfApplied;
  }

  private applyPerf(): void {
    const active = perfActive(this.perfMode, this.perf);
    if (active === this.perfApplied) return;
    this.perfApplied = active;
    this.orb.setDetail(active ? PERF_ORB_DETAIL : this.opts.orbDetail ?? 24);
    this.network.setLayout({ seed: this.opts.seed, density: active ? PERF_NETWORK_DENSITY : 1 });
    this.resize();
  }

  /** Force reduced motion on or off; null follows the operating system. */
  setReducedMotion(value: boolean | null): void {
    this.reducedMotionOverride = value;
  }

  /** Read each frame; the animation clock's speed eases toward it, so a change never jumps. */
  private reducedMotion(): boolean {
    return this.reducedMotionOverride ?? this.motionQuery?.matches ?? false;
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
  /**
   * Feeds audio levels computed elsewhere (e.g. a Python voice loop over a WebSocket).
   * While fresh (under 250 ms old) they replace the taps and the synthetic voice.
   * Values are 0..1; pass them already boosted for the mic if you want the floor.
   */
  pushAudioLevels(levels: Partial<AudioLevels>): void {
    this.external = { level: levels.level ?? 0, bass: levels.bass ?? 0, treble: levels.treble ?? 0 };
    this.externalAt = this.time;
  }

  private readAudio(): AudioLevels {
    const src = audioSourceFor(this.state);
    if (src !== 'none' && this.external && this.time - this.externalAt < 0.25) return this.external;
    if (src === 'mic') return this.micTap ? boostMic(this.micTap.read()) : syntheticVoice(this.time);
    if (src === 'playback') return this.playbackTap ? this.playbackTap.read() : syntheticVoice(this.time + 7.3);
    if (this.state === 'arming' && this.micTap) {
      this.micTap.read();
      if (this.micTap.hasSignal && this.opts.autoListen !== false) this.setState('listening');
    }
    return SILENT;
  }

  private resize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    const maxRatio = this.perfApplied ? 1 : this.opts.maxPixelRatio ?? 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
    this.renderer.setSize(w, h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.sky.setResolution(size.x, size.y);
    this.network.setViewport(w, h, this.renderer.getPixelRatio());
    this.orbCamera.aspect = w / h;
    // On portrait screens, back the camera off so the orb keeps fitting the width.
    const distance = ORB_CAMERA_DISTANCE / Math.min(1, Math.max(0.35, w / h));
    this.orbCamera.position.z = distance;
    this.sky.setOrbRadius(0.5 / (distance * Math.tan(THREE.MathUtils.degToRad(22.5))));
    this.orbCamera.updateProjectionMatrix();
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.tick);
    const dt = this.lastTime < 0 ? 0 : Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.time += dt;

    // Reduced motion slows a separate animation clock (never multiplies absolute time,
    // which would make every phase jump when the setting changes).
    this.motionSpeed = approach(this.motionSpeed, this.reducedMotion() ? REDUCED_MOTION_SPEED : 1, 2, dt);
    const adt = dt * this.motionSpeed;
    this.clock += adt;

    if (this.perfMode === 'auto' && !this.perf.degraded && this.time > 1) {
      this.perf = stepPerf(this.perf, dt);
      if (this.perf.degraded) this.applyPerf();
    }

    this.light = approach(this.light, this.theme === 'light' ? 1 : 0, 5, dt);

    stepVisual(this.visual, targetAt(this.state, this.clock), dt);
    smoothLevels(this.audio, this.readAudio(), dt);
    Object.assign(this.orbFrame, this.visual, this.audio);

    // The galaxy answers the AI, not the user: voice while speaking, a hum while thinking.
    const voice = this.state === 'processing' ? thinkingHum(this.clock) : this.state === 'speaking' ? this.audio.level : 0;
    const g = galaxyFor(this.visual.galaxy * voice);
    // No shake at all when motion is reduced.
    g.shake *= Math.max(0, (this.motionSpeed - REDUCED_MOTION_SPEED) / (1 - REDUCED_MOTION_SPEED));

    this.orb.update(this.orbFrame, this.clock, adt);
    this.network.update(g, this.clock, adt);
    this.sky.update({
      orbColor: this.visual.colorA,
      bloom: g.skyBloom * (0.6 + this.visual.glow),
      nebula: g.skyNebula,
      light: this.light,
    }, this.clock);

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
    if (this.ownsLiveRegion) this.liveRegion?.remove();
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
