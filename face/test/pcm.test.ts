import { describe, expect, it } from 'vitest';
import { fromInt16, toInt16 } from '../src/math/pcm';

describe('pcm', () => {
  it('downsamples 48 kHz to 16 kHz by a factor of three', () => {
    const input = new Float32Array(4800).fill(0.5);
    const out = toInt16(input, 48000);
    expect(out.length).toBe(1600);
    expect(out[0]).toBe(Math.round(0.5 * 0x7fff));
  });

  it('averages each window and clamps', () => {
    const out = toInt16(new Float32Array([1, 0, -1, 2, 2, 2]), 48000, 16000);
    expect(Array.from(out)).toEqual([0, 0x7fff]);
    expect(toInt16(new Float32Array([-3]), 16000)[0]).toBe(-0x8000);
  });

  it('round-trips through little-endian bytes', () => {
    const pcm = toInt16(new Float32Array([0.25, -0.25, 0]), 16000);
    const back = fromInt16(pcm.buffer as ArrayBuffer);
    expect(back[0]).toBeCloseTo(0.25, 3);
    expect(back[1]).toBeCloseTo(-0.25, 3);
    expect(back[2]).toBe(0);
    expect(new Uint8Array(pcm.buffer)[1]).toBe(0x20); // 8192 = 0x2000, little-endian: high byte second
  });

  it('handles bad rates and odd byte counts', () => {
    expect(toInt16(new Float32Array(10), 0).length).toBe(0);
    expect(fromInt16(new ArrayBuffer(3)).length).toBe(1);
  });
});
