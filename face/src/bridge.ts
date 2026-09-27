import type { FaceEngine } from './engine/engine';
import { parseBridgeMessage, reconnectDelay } from './math/bridge';

export const DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:8767/face';

export interface BridgeOptions {
  onStatus?: (connected: boolean) => void;
}

/**
 * Connects a face to a local voice loop over WebSocket (see math/bridge for the protocol).
 * Reconnects with backoff; the face goes idle while the loop is unreachable.
 * Returns a function that closes the connection for good.
 */
export function connectBridge(face: FaceEngine, url = DEFAULT_BRIDGE_URL, opts: BridgeOptions = {}): () => void {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer = 0;
  let closed = false;

  const open = (): void => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      attempt = 0;
      opts.onStatus?.(true);
    };
    ws.onmessage = (e) => {
      const msg = typeof e.data === 'string' ? parseBridgeMessage(e.data) : null;
      if (!msg) return;
      if (msg.type === 'state') face.setState(msg.state);
      else face.pushAudioLevels(msg.levels);
    };
    ws.onclose = () => {
      opts.onStatus?.(false);
      face.setState('idle');
      if (!closed) timer = window.setTimeout(open, reconnectDelay(attempt++));
    };
  };

  open();
  return () => {
    closed = true;
    clearTimeout(timer);
    ws?.close();
  };
}
