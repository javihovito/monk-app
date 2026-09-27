import type { FaceEngine } from './engine/engine';
import { parseBridgeMessage, reconnectDelay, type CaptionSpeaker, type InfoItem } from './math/bridge';

export const DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:8767/face';

export interface BridgeOptions {
  onStatus?: (connected: boolean) => void;
  onCaption?: (who: CaptionSpeaker, text: string, final: boolean) => void;
  onInfo?: (items: InfoItem[]) => void;
  /** Monk is about to send spoken-reply audio to this page at `rate` Hz. */
  onTtsStart?: (rate: number) => void;
  /** One chunk of Int16 LE mono reply audio. */
  onTtsChunk?: (chunk: ArrayBuffer) => void;
  onTtsEnd?: () => void;
}

export interface BridgeConnection {
  readonly connected: boolean;
  sendJson(msg: unknown): void;
  sendBinary(data: ArrayBufferView | ArrayBuffer): void;
  close(): void;
}

/**
 * Connects a face to a local voice loop over WebSocket (see math/bridge for the protocol).
 * Reconnects with backoff; the face goes idle while the loop is unreachable.
 */
export function connectBridge(face: FaceEngine, url = DEFAULT_BRIDGE_URL, opts: BridgeOptions = {}): BridgeConnection {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer = 0;
  let closed = false;
  let connected = false;

  const open = (): void => {
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      attempt = 0;
      connected = true;
      opts.onStatus?.(true);
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        opts.onTtsChunk?.(e.data);
        return;
      }
      const msg = typeof e.data === 'string' ? parseBridgeMessage(e.data) : null;
      if (!msg) return;
      if (msg.type === 'state') face.setState(msg.state);
      else if (msg.type === 'levels') face.pushAudioLevels(msg.levels);
      else if (msg.type === 'caption') opts.onCaption?.(msg.who, msg.text, msg.final);
      else if (msg.type === 'info') opts.onInfo?.(msg.items);
      else if (msg.type === 'tts') opts.onTtsStart?.(msg.rate);
      else opts.onTtsEnd?.();
    };
    ws.onclose = () => {
      connected = false;
      opts.onStatus?.(false);
      face.setState('idle');
      if (!closed) timer = window.setTimeout(open, reconnectDelay(attempt++));
    };
  };

  const send = (data: string | ArrayBufferView | ArrayBuffer): void => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(data as ArrayBuffer);
  };

  open();
  return {
    get connected() {
      return connected;
    },
    sendJson: (msg) => send(JSON.stringify(msg)),
    sendBinary: (data) => send(data),
    close() {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
