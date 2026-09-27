import { connectBridge, createFace, createOverlay, DEFAULT_BRIDGE_URL, withToken, type FaceEngine } from '../src/index';
import { setupThemeSwitch } from './theme';

// Full-screen face driven by Monk's voice loop.
// ?ws=ws://host:port/path overrides the socket; ?token=... is passed through for LAN viewing.
const params = new URLSearchParams(location.search);
const url = withToken(params.get('ws') ?? DEFAULT_BRIDGE_URL, params.get('token'));
const canvas = document.getElementById('face') as HTMLCanvasElement;
const status = document.getElementById('connection')!;

let face: FaceEngine | null = null;
const theme = setupThemeSwitch((t) => face?.setTheme(t));
face = createFace(canvas, { theme });
const overlay = createOverlay();
face.onStateChange((s) => overlay.setState(s));
connectBridge(face, url, {
  onStatus: (ok) => { status.hidden = ok; },
  onCaption: (who, text, final) => overlay.caption(who, text, final),
  onInfo: (items) => overlay.info(items),
});
status.hidden = false;
Object.assign(window, { face: () => face });
