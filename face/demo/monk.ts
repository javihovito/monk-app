import { connectBridge, createFace, createOverlay, createRemoteTalk, DEFAULT_BRIDGE_URL, safeBridgeUrl, withToken, type FaceEngine, type RemoteTalk } from '../src/index';
import { setupThemeSwitch } from './theme';

// Full-screen face driven by Monk's voice loop.
// ?ws=ws://host:port/path overrides the socket (same host or loopback only); ?token=... is passed through for LAN viewing.
const params = new URLSearchParams(location.search);
const url = withToken(safeBridgeUrl(params.get('ws'), location.hostname, DEFAULT_BRIDGE_URL), params.get('token'));
const canvas = document.getElementById('face') as HTMLCanvasElement;
const status = document.getElementById('connection')!;

let face: FaceEngine | null = null;
const theme = setupThemeSwitch((t) => face?.setTheme(t));
face = createFace(canvas, { theme });
const overlay = createOverlay();
face.onStateChange((s) => overlay.setState(s));

let talk: RemoteTalk | null = null;
const bridge = connectBridge(face, url, {
  onStatus: (ok) => { status.hidden = ok; },
  onCaption: (who, text, final) => overlay.caption(who, text, final),
  onInfo: (items) => overlay.info(items),
  onTtsStart: (rate) => talk?.ttsStart(rate),
  onTtsChunk: (chunk) => talk?.ttsChunk(chunk),
  onTtsEnd: () => talk?.ttsEnd(),
});

// Hold-to-talk only on another device (the Mini has its own mic) and only where the mic is allowed.
const onTheMini = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ((!onTheMini || params.has('talk')) && window.isSecureContext && 'mediaDevices' in navigator) {
  talk = createRemoteTalk(face, bridge);
}
status.hidden = false;
Object.assign(window, { face: () => face });
