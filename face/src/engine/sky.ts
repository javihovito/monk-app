import * as THREE from 'three';
import { skyFragment, skyVertex } from './shaders/sky';
import type { Rgb } from './orb';

export interface SkyFrame {
  orbColor: Rgb;
  /** Bloom multiplier; rises with the AI's voice. */
  bloom: number;
  /** Nebula brightness multiplier. */
  nebula: number;
}

/** Full-screen quad drawn first, with depth testing off. */
export class Sky {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.Camera();
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uClock: { value: 0 },
        uOrbColor: { value: new THREE.Vector3() },
        uBloom: { value: 1 },
        uNebula: { value: 1 },
      },
    }));
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  setResolution(w: number, h: number): void {
    (this.mesh.material.uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }

  update(f: SkyFrame, clock: number): void {
    const u = this.mesh.material.uniforms;
    u.uClock.value = clock;
    (u.uOrbColor.value as THREE.Vector3).set(...f.orbColor);
    u.uBloom.value = f.bloom;
    u.uNebula.value = f.nebula;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
