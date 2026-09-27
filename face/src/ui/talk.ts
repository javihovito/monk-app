import type { BridgeConnection } from '../bridge';
import type { FaceEngine } from '../engine/engine';
import { fromInt16, MAX_TALK_SECONDS, toInt16 } from '../math/pcm';

export interface RemoteTalk {
  /** Wire these into connectBridge's onTts* options. */
  ttsStart(rate: number): void;
  ttsChunk(chunk: ArrayBuffer): void;
  ttsEnd(): void;
  destroy(): void;
}

/**
 * Hold-to-talk from another device: streams this device's mic to Monk as 16 kHz PCM and
 * plays Monk's spoken reply here. Needs a secure context (HTTPS) for the microphone.
 * The orb follows both locally through the engine's audio taps.
 */
export function createRemoteTalk(face: FaceEngine, bridge: BridgeConnection, parent: HTMLElement = document.body): RemoteTalk {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'talk-button';
  button.textContent = 'Hold to talk';
  button.setAttribute('aria-pressed', 'false');
  parent.append(button);

  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let talking = false;
  let stopTimer = 0;
  let out: GainNode | null = null;
  let ttsRate = 22050;
  let playhead = 0;

  const audio = (): AudioContext => {
    if (!ctx) {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.connect(ctx.destination);
      face.attachPlayback(out);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };

  const start = async (): Promise<void> => {
    if (talking || !bridge.connected) return;
    talking = true;
    button.setAttribute('aria-pressed', 'true');
    button.textContent = 'Listening…';
    try {
      const ac = audio(); // must happen inside the gesture on iOS
      stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!talking) return; // released while the permission prompt was up
      face.attachMic(stream);
      source = ac.createMediaStreamSource(stream);
      processor = ac.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (talking) bridge.sendBinary(toInt16(e.inputBuffer.getChannelData(0), ac.sampleRate));
      };
      // A ScriptProcessor only runs while connected to the destination; it outputs silence.
      source.connect(processor);
      processor.connect(ac.destination);
      bridge.sendJson({ type: 'ptt', down: true });
      stopTimer = window.setTimeout(stop, MAX_TALK_SECONDS * 1000);
    } catch {
      talking = false;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = 'Microphone blocked';
      face.setState('error');
    }
  };

  const stop = (): void => {
    if (!talking) return;
    talking = false;
    clearTimeout(stopTimer);
    processor?.disconnect();
    source?.disconnect();
    processor = null;
    source = null;
    bridge.sendJson({ type: 'ptt', down: false });
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Hold to talk';
  };

  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    void start();
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) button.addEventListener(ev, stop);
  // Keyboard: hold Space or Enter on the focused button.
  button.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      void start();
    }
  });
  button.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') stop();
  });

  return {
    ttsStart(rate) {
      ttsRate = rate;
      const ac = audio();
      playhead = Math.max(playhead, ac.currentTime + 0.05);
    },
    ttsChunk(chunk) {
      if (!ctx || !out) return;
      const samples = fromInt16(chunk);
      if (samples.length === 0) return;
      const buf = ctx.createBuffer(1, samples.length, ttsRate);
      buf.copyToChannel(samples, 0);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(out);
      playhead = Math.max(playhead, ctx.currentTime);
      node.start(playhead);
      playhead += buf.duration;
    },
    ttsEnd() {
      /* playback drains on its own */
    },
    destroy() {
      stop();
      stream?.getTracks().forEach((t) => t.stop());
      face.detachMic();
      face.detachPlayback();
      void ctx?.close();
      button.remove();
    },
  };
}
