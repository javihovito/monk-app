import { bandLevels, type AudioLevels } from '../math/audio';

export type PlaybackSource = AudioNode | HTMLMediaElement | MediaStream;

/**
 * A read-only tap on an audio signal. It never changes what is heard: the
 * analyser is a dead end, and nothing is rerouted away from the speakers.
 */
export class AudioTap {
  private readonly analyser: AnalyserNode;
  private readonly bins: Uint8Array<ArrayBuffer>;
  private readonly cleanup: () => void;
  private signalSeen = false;

  private constructor(analyser: AnalyserNode, cleanup: () => void) {
    this.analyser = analyser;
    this.bins = new Uint8Array(analyser.frequencyBinCount);
    this.cleanup = cleanup;
  }

  private static analyser(ctx: BaseAudioContext): AnalyserNode {
    const a = ctx.createAnalyser();
    a.fftSize = 256;
    a.smoothingTimeConstant = 0.5;
    return a;
  }

  static fromStream(ctx: AudioContext, stream: MediaStream): AudioTap {
    const src = ctx.createMediaStreamSource(stream);
    const a = AudioTap.analyser(ctx);
    src.connect(a);
    return new AudioTap(a, () => src.disconnect());
  }

  /** Taps an existing node in the app's own graph; its routing is left alone. */
  static fromNode(node: AudioNode): AudioTap {
    const a = AudioTap.analyser(node.context);
    node.connect(a);
    return new AudioTap(a, () => {
      try { node.disconnect(a); } catch { /* already gone */ }
    });
  }

  static fromElement(ctx: AudioContext, el: HTMLMediaElement): AudioTap {
    const capture = (el as HTMLMediaElement & { captureStream?: () => MediaStream }).captureStream;
    if (capture) return AudioTap.fromStream(ctx, capture.call(el));
    // No captureStream: route through Web Audio but keep it audible, unchanged.
    const src = ctx.createMediaElementSource(el);
    const a = AudioTap.analyser(ctx);
    src.connect(ctx.destination);
    src.connect(a);
    return new AudioTap(a, () => src.disconnect(a));
  }

  /** True once any non-silent frame has been read. */
  get hasSignal(): boolean {
    return this.signalSeen;
  }

  read(): AudioLevels {
    this.analyser.getByteFrequencyData(this.bins);
    if (!this.signalSeen) {
      for (let i = 0; i < this.bins.length; i++) if (this.bins[i] > 8) { this.signalSeen = true; break; }
    }
    return bandLevels(this.bins);
  }

  dispose(): void {
    this.cleanup();
    this.analyser.disconnect();
  }
}
