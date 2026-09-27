import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VisualParams } from '../math/states';
import type { AudioLevels } from '../math/audio';
import { glowFragment, glowVertex, orbFragment, orbVertex } from './shaders/orb';

export type { Rgb } from '../math/states';

/** Everything the orb needs for one frame. Already eased; the orb only draws it. */
export type OrbFrame = VisualParams & AudioLevels;

const RING_RADII = [1.55, 1.65, 1.75];
const RING_TILTS: Array<[number, number]> = [
  [1.1, 0.2],
  [0.5, -0.9],
  [-0.7, 0.6],
];
const RING_SPEEDS = [0.22, -0.16, 0.12];

export interface OrbOptions {
  detail: number;
}

export class Orb {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly glow: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly rings: Array<THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>> = [];
  private readonly spin = new THREE.Group();
  private noiseTime = 0;

  constructor(opts: OrbOptions) {
    this.mesh = new THREE.Mesh(Orb.sphere(1, opts.detail), new THREE.ShaderMaterial({
      vertexShader: orbVertex,
      fragmentShader: orbFragment,
      wireframe: true,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uClock: { value: 0 },
        uNoiseTime: { value: 0 },
        uBase: { value: 0 },
        uAmp: { value: 0 },
        uLevel: { value: 0 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uBreath: { value: 1 },
        uColorA: { value: new THREE.Vector3() },
        uColorB: { value: new THREE.Vector3() },
        uOpacity: { value: 1 },
        uFresnelPow: { value: 2 },
      },
    }));

    this.glow = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 6), new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Vector3() },
        uGlow: { value: 0 },
        uLight: { value: 0 },
      },
    }));

    for (let i = 0; i < RING_RADII.length; i++) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 256; k++) {
        const a = (k / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * RING_RADII[i], 0, Math.sin(a) * RING_RADII[i]));
      }
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          transparent: true,
          depthWrite: false,
          opacity: 0,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.rotation.set(RING_TILTS[i][0], 0, RING_TILTS[i][1]);
      ring.visible = false;
      this.rings.push(ring);
      this.group.add(ring);
    }

    this.spin.add(this.glow, this.mesh);
    this.group.add(this.spin);
  }

  /** Wireframe sphere with shared vertices so displacement never tears the mesh. */
  private static sphere(radius: number, detail: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    const merged = mergeVertices(geo);
    geo.dispose();
    return merged;
  }

  setDetail(detail: number): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = Orb.sphere(1, detail);
    old.dispose();
  }

  update(f: OrbFrame, clock: number, dt: number): void {
    this.noiseTime += dt * f.noiseSpeed;

    const u = this.mesh.material.uniforms;
    u.uClock.value = clock;
    u.uNoiseTime.value = this.noiseTime;
    u.uBase.value = f.base;
    u.uAmp.value = f.amp;
    u.uLevel.value = f.level;
    u.uBass.value = f.bass;
    u.uTreble.value = f.treble;
    u.uBreath.value = f.breath;
    (u.uColorA.value as THREE.Vector3).set(...f.colorA);
    (u.uColorB.value as THREE.Vector3).set(...f.colorB);
    u.uOpacity.value = f.opacity;
    u.uFresnelPow.value = f.fresnelPow;

    const g = this.glow.material.uniforms;
    (g.uColor.value as THREE.Vector3).set(...f.colorA);
    g.uGlow.value = f.glow * (1 + f.level * 0.5);

    this.spin.rotation.y += dt * f.rotSpeed;
    this.spin.rotation.x = Math.sin(clock * 0.11) * 0.18;
    this.group.scale.setScalar(1 + f.level * 0.08 + f.bass * 0.05);

    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.rotation.y += dt * RING_SPEEDS[i];
      ring.material.opacity = f.ringOpacity * (0.55 + i * 0.15);
      ring.material.color.setRGB(...f.colorB, THREE.SRGBColorSpace);
      ring.visible = f.ringOpacity > 0.003;
    }
  }

  /** Additive glow disappears on a light background; use normal blending there. */
  setTheme(light: boolean): void {
    const blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.glow.material.blending = blending;
    this.glow.material.uniforms.uLight.value = light ? 1 : 0;
    for (const r of this.rings) r.material.blending = blending;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
    for (const r of this.rings) {
      r.geometry.dispose();
      r.material.dispose();
    }
  }
}
