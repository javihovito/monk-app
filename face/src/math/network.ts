import { mulberry32 } from './random';

export type Vec3 = [number, number, number];
export type Rgb = [number, number, number];

/** Cool cluster palette (sRGB 0..1): teal, cyan, blue, purple, green-teal, indigo, blue-teal, violet. */
export const CLUSTER_PALETTE: readonly Rgb[] = [
  [0.18, 0.83, 0.75],
  [0.13, 0.83, 0.93],
  [0.23, 0.51, 0.96],
  [0.66, 0.33, 0.97],
  [0.2, 0.83, 0.6],
  [0.39, 0.4, 0.95],
  [0.05, 0.65, 0.72],
  [0.55, 0.36, 0.96],
];
export const STRAY_COLOR: Rgb = [0.48, 0.55, 0.66];

export interface NetworkNode {
  position: Vec3;
  color: Rgb;
  /** Base sprite size (world-ish units before perspective). */
  size: number;
  /** -1 for strays. */
  cluster: number;
}

export interface NetworkLayout {
  nodes: NetworkNode[];
  /** Index pairs into `nodes`. */
  edges: Array<[number, number]>;
  dust: Vec3[];
}

export interface NetworkOptions {
  seed?: number;
  clusters?: number;
  /** Total node target, clusters plus strays. */
  totalNodes?: number;
  dust?: number;
  linkDistance?: number;
  /** 0..1: fraction of stray nodes and dust kept (performance mode). Cluster nodes are always kept. */
  density?: number;
}

export const NETWORK_DEFAULTS: Required<NetworkOptions> = {
  seed: 2610,
  clusters: 8,
  totalNodes: 100,
  dust: 400,
  linkDistance: 10,
  density: 1,
};

function onSphere(rand: () => number): Vec3 {
  const u = rand() * 2 - 1;
  const th = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(th), u, s * Math.sin(th)];
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Deterministic galaxy layout. Every random draw happens in the same order
 * regardless of `density`, so a thinner layout is the same galaxy with points removed.
 */
export function buildNetwork(options: NetworkOptions = {}): NetworkLayout {
  const o = { ...NETWORK_DEFAULTS };
  for (const [k, v] of Object.entries(options)) if (v !== undefined) (o as Record<string, number>)[k] = v;
  const rand = mulberry32(o.seed);
  const nodes: NetworkNode[] = [];

  for (let c = 0; c < o.clusters; c++) {
    const dir = onSphere(rand);
    const radius = 13 + rand() * 12;
    const centre: Vec3 = [dir[0] * radius, dir[1] * radius, dir[2] * radius];
    const count = 6 + Math.floor(rand() * 3);
    const color = CLUSTER_PALETTE[c % CLUSTER_PALETTE.length];
    for (let i = 0; i < count; i++) {
      const off = onSphere(rand);
      const spread = 0.8 + rand() * 2.7;
      nodes.push({
        position: [centre[0] + off[0] * spread, centre[1] + off[1] * spread, centre[2] + off[2] * spread],
        color,
        size: 1.1 + rand() * 0.9,
        cluster: c,
      });
    }
  }

  const strays = Math.max(0, o.totalNodes - nodes.length);
  for (let i = 0; i < strays; i++) {
    const dir = onSphere(rand);
    const radius = 8 + rand() * 24;
    const size = 0.6 + rand() * 0.6;
    const keep = rand() < o.density;
    if (!keep) continue;
    nodes.push({ position: [dir[0] * radius, dir[1] * radius, dir[2] * radius], color: STRAY_COLOR, size, cluster: -1 });
  }

  const dust: Vec3[] = [];
  for (let i = 0; i < o.dust; i++) {
    const dir = onSphere(rand);
    const radius = 60 + rand() * 60;
    const keep = rand() < o.density;
    if (keep) dust.push([dir[0] * radius, dir[1] * radius, dir[2] * radius]);
  }

  const edges: Array<[number, number]> = [];
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      if (dist(nodes[a].position, nodes[b].position) < o.linkDistance) edges.push([a, b]);
    }
  }

  return { nodes, edges, dust };
}
