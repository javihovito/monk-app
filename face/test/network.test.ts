import { describe, expect, it } from 'vitest';
import { buildNetwork } from '../src/math/network';

const len = (p: number[]) => Math.hypot(p[0], p[1], p[2]);

describe('buildNetwork', () => {
  it('is identical for the same seed and different for another', () => {
    expect(buildNetwork({ seed: 7 })).toEqual(buildNetwork({ seed: 7 }));
    expect(buildNetwork({ seed: 7 }).nodes[0].position).not.toEqual(buildNetwork({ seed: 8 }).nodes[0].position);
  });

  it('treats an undefined option as the default', () => {
    expect(buildNetwork({ seed: undefined })).toEqual(buildNetwork());
  });

  it('has eight clusters of 6 to 8 nodes and about 100 nodes in total', () => {
    const { nodes } = buildNetwork();
    expect(nodes).toHaveLength(100);
    for (let c = 0; c < 8; c++) {
      const n = nodes.filter((x) => x.cluster === c).length;
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  it('places cluster centres on the 13 to 25 unit shell', () => {
    const { nodes } = buildNetwork();
    for (let c = 0; c < 8; c++) {
      const members = nodes.filter((x) => x.cluster === c);
      const centre = [0, 1, 2].map((k) => members.reduce((s, m) => s + m.position[k], 0) / members.length);
      expect(len(centre)).toBeGreaterThan(13 - 3.5);
      expect(len(centre)).toBeLessThan(25 + 3.5);
    }
  });

  it('only links nodes closer than the link distance', () => {
    const { nodes, edges } = buildNetwork();
    expect(edges.length).toBeGreaterThan(0);
    for (const [a, b] of edges) {
      const pa = nodes[a].position;
      const pb = nodes[b].position;
      expect(Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])).toBeLessThan(10);
    }
  });

  it('a thinner layout is the same galaxy with fewer points', () => {
    const full = buildNetwork();
    const thin = buildNetwork({ density: 0.5 });
    expect(thin.nodes.length).toBeLessThan(full.nodes.length);
    expect(thin.dust.length).toBeLessThan(full.dust.length);
    const fullSet = new Set(full.nodes.map((n) => n.position.join(',')));
    for (const n of thin.nodes) expect(fullSet.has(n.position.join(','))).toBe(true);
    const dustSet = new Set(full.dust.map((d) => d.join(',')));
    for (const d of thin.dust) expect(dustSet.has(d.join(','))).toBe(true);
  });
});
