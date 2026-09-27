/** Sample-rate conversion and PCM packing for the remote talk path. Pure. */

export const MIC_WIRE_RATE = 16000;

/**
 * Downsamples float audio to `outRate` by averaging each output window, then packs
 * it as little-endian Int16 (the wire format Monk's STT expects). Clamps to [-1, 1].
 */
export function toInt16(input: Float32Array, inRate: number, outRate = MIC_WIRE_RATE): Int16Array {
  if (inRate <= 0 || outRate <= 0) return new Int16Array(0);
  const ratio = inRate / outRate;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.max(a + 1, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b && j < input.length; j++) s += input[j];
    const v = Math.max(-1, Math.min(1, s / (b - a)));
    out[i] = v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff);
  }
  return out;
}

/** Unpacks little-endian Int16 PCM into floats in [-1, 1). */
export function fromInt16(buf: ArrayBuffer): Float32Array<ArrayBuffer> {
  const view = new DataView(buf);
  const n = Math.floor(buf.byteLength / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

/** Upper bound on one remote turn, in seconds; the page stops sending after this. */
export const MAX_TALK_SECONDS = 30;
