import { connectBridge, createFace, DEFAULT_BRIDGE_URL, type FaceEngine } from '../src/index';
import { setupThemeSwitch } from './theme';

// Full-screen face driven by Monk's voice loop. Override the socket with ?ws=ws://host:port/path
const url = new URLSearchParams(location.search).get('ws') ?? DEFAULT_BRIDGE_URL;
const canvas = document.getElementById('face') as HTMLCanvasElement;
const status = document.getElementById('connection')!;

let face: FaceEngine | null = null;
const theme = setupThemeSwitch((t) => face?.setTheme(t));
face = createFace(canvas, { theme });
connectBridge(face, url, { onStatus: (ok) => { status.hidden = ok; } });
status.hidden = false;
Object.assign(window, { face: () => face });
