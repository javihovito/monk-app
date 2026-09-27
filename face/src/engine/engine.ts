import * as THREE from 'three';
import { Orb, type OrbFrame } from './orb';
import { Sky } from './sky';

export interface FaceOptions {
  /** Cap on devicePixelRatio. */
  maxPixelRatio?: number;
  /** Icosahedron detail for the orb mesh. */
  orbDetail?: number;
}

// Layer 1: a single calm idle look. Layer 4 replaces this with the state table.
const IDLE: OrbFrame = {
  colorA: [0.18, 0.78, 0.72],
  colorB: [0.55, 0.9, 1.0],
  opacity: 0.75,
  fresnelPow: 2.8,
  noiseSpeed: 0.35,
  amp: 0.4,
  base: 0.012,
  glow: 0.35,
  rotSpeed: 0.06,
  ringOpacity: 0,
  level: 0,
  bass: 0,
  treble: 0,
};

/**
 * One renderer, one WebGL context. Passes per frame: (sky, network — later layers),
 * then clear depth and draw the orb with its own camera.
 */
export class FaceEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly orbScene = new THREE.Scene();
  private readonly orbCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  private readonly orb: Orb;
  private readonly sky = new Sky();
  private readonly resizeObserver: ResizeObserver;
  private readonly frame: OrbFrame = { ...IDLE, colorA: [...IDLE.colorA], colorB: [...IDLE.colorB] };
  private rafId = 0;
  private lastTime = -1;
  private clock = 0;
  private destroyed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly opts: FaceOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x05070d, 1);
    this.renderer.autoClear = false;

    this.orbCamera.position.set(0, 0, 4.2);
    this.orb = new Orb({ detail: opts.orbDetail ?? 24 });
    this.orbScene.add(this.orb.group);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Debug/manual override of orb parameters (Layer 1 only; replaced by states later). */
  setOrbFrame(partial: Partial<OrbFrame>): void {
    Object.assign(this.frame, partial);
  }

  private resize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxPixelRatio ?? 2));
    this.renderer.setSize(w, h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.sky.setResolution(size.x, size.y);
    this.orbCamera.aspect = w / h;
    this.orbCamera.updateProjectionMatrix();
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.tick);
    const dt = this.lastTime < 0 ? 0 : Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.clock += dt;

    this.orb.update(this.frame, this.clock, dt);
    this.sky.update({ orbColor: this.frame.colorA, bloom: 1 + this.frame.level * 1.5, nebula: 1 }, this.clock);

    this.renderer.clear(true, true, true);
    this.renderer.render(this.sky.scene, this.sky.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.orbScene, this.orbCamera);
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.orb.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
