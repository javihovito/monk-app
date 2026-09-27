import * as THREE from 'three';
import { buildNetwork, type NetworkOptions } from '../math/network';
import { dustFragment, dustVertex, lineFragment, lineVertex, nodeFragment, nodeVertex } from './shaders/network';

/** Everything the network needs for one frame, already eased. */
export interface NetworkFrame {
  lineOpacity: number;
  nodeScale: number;
  nodeBrightness: number;
  /** Uniform scale of the whole network (swell). */
  swell: number;
  rotSpeed: number;
  /** Camera push-in, in world units. */
  push: number;
  /** Camera shake amplitude, in world units. */
  shake: number;
}

export const NETWORK_REST: NetworkFrame = {
  lineOpacity: 0.12,
  nodeScale: 1,
  nodeBrightness: 1,
  swell: 1,
  rotSpeed: 0.012,
  push: 0,
  shake: 0,
};

const CAMERA_DISTANCE = 42;

export class Network {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.5, 400);
  private readonly group = new THREE.Group();
  private readonly nodes: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly lines: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly dust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private spin = 0;

  constructor(options: NetworkOptions = {}) {
    this.nodes = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      vertexShader: nodeVertex,
      fragmentShader: nodeFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: 1 },
        uViewportHeight: { value: 800 },
        uSizeScale: { value: 1 },
        uBrightness: { value: 1 },
        uAlpha: { value: 1 },
      },
    }));
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0.12 } },
    }));
    this.dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: 1 },
        uAlpha: { value: 0.45 },
        uColor: { value: new THREE.Vector3(0.45, 0.52, 0.66) },
      },
    }));
    this.group.add(this.lines, this.nodes);
    this.scene.add(this.group, this.dust);
    this.camera.position.set(0, 0, CAMERA_DISTANCE);
    this.setLayout(options);
  }

  /** Rebuilds geometry from a (seeded, deterministic) layout. */
  setLayout(options: NetworkOptions): void {
    const layout = buildNetwork(options);

    const pos = new Float32Array(layout.nodes.length * 3);
    const col = new Float32Array(layout.nodes.length * 3);
    const size = new Float32Array(layout.nodes.length);
    layout.nodes.forEach((n, i) => {
      pos.set(n.position, i * 3);
      col.set(n.color, i * 3);
      size[i] = n.size;
    });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ng.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    ng.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    const lp = new Float32Array(layout.edges.length * 6);
    const lc = new Float32Array(layout.edges.length * 6);
    layout.edges.forEach(([a, b], i) => {
      lp.set(layout.nodes[a].position, i * 6);
      lp.set(layout.nodes[b].position, i * 6 + 3);
      lc.set(layout.nodes[a].color, i * 6);
      lc.set(layout.nodes[b].color, i * 6 + 3);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));

    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(layout.dust.flat()), 3));

    this.nodes.geometry.dispose();
    this.lines.geometry.dispose();
    this.dust.geometry.dispose();
    this.nodes.geometry = ng;
    this.lines.geometry = lg;
    this.dust.geometry = dg;
  }

  setViewport(width: number, height: number, pixelRatio: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.nodes.material.uniforms.uPixelRatio.value = pixelRatio;
    this.nodes.material.uniforms.uViewportHeight.value = height;
    this.dust.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  update(f: NetworkFrame, clock: number, dt: number): void {
    this.spin += dt * f.rotSpeed;
    this.group.rotation.y = this.spin;
    this.group.rotation.x = Math.sin(clock * 0.05) * 0.12;
    this.group.rotation.z = Math.sin(clock * 0.031) * 0.05;
    this.group.scale.setScalar(f.swell);
    this.dust.rotation.y = this.spin * 0.3;

    // Slow drift of a couple of units over minutes, a slight push-in and a near-invisible shake.
    const sx = f.shake * (Math.sin(clock * 23.1) + Math.sin(clock * 37.7) * 0.5);
    const sy = f.shake * (Math.sin(clock * 29.3) + Math.sin(clock * 41.9) * 0.5);
    this.camera.position.set(
      Math.sin(clock * 0.013) * 2.0 + sx,
      Math.cos(clock * 0.017) * 1.2 + sy,
      CAMERA_DISTANCE + Math.sin(clock * 0.009) * 1.5 - f.push,
    );
    this.camera.lookAt(0, 0, 0);

    this.lines.material.uniforms.uOpacity.value = f.lineOpacity;
    this.nodes.material.uniforms.uSizeScale.value = f.nodeScale;
    this.nodes.material.uniforms.uBrightness.value = f.nodeBrightness;
  }

  dispose(): void {
    for (const o of [this.nodes, this.lines, this.dust]) {
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}
