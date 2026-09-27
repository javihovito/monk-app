# Monk Face

A living galaxy for Monk: a wireframe orb in a deep-space nebula, surrounded by a slowly
turning network of star clusters. One WebGL context, three passes per frame (sky, network, orb).
three.js is pinned and bundled; nothing loads from a CDN, so it works offline.

```sh
npm install
npm run dev      # demo page with a button for every state
npm run check    # typecheck, colour-token lint, unit tests
npm run build
```

## Embedding

```ts
import { createFace } from '@monk/face';

const face = createFace(canvas, { theme: 'dark' });

face.setState('listening');       // idle | arming | listening | processing | speaking | error
face.attachMic(micStream);        // MediaStream; tap only, nothing is played
face.attachPlayback(ttsNode);     // AudioNode, <audio> element or MediaStream; tap only
face.pushAudioLevels({ level, bass, treble }); // levels from elsewhere, e.g. a Python loop
face.setTheme('light');
face.setPerformanceMode('auto');  // auto | on | off
face.destroy();                   // stops the loop, releases audio taps and the WebGL context
```

- Without a mic or playback tap, the orb uses a deterministic synthetic voice.
- In `arming`, the face moves to `listening` by itself once the mic delivers real audio
  (turn off with `autoListen: false`).
- A polite live region announces the state; pass `liveRegion` to use your own element.
- Reduced motion follows the OS setting (or `setReducedMotion(true | false | null)`).

## Monk page

`monk.html` is the face Monk's Python voice loop drives over `ws://127.0.0.1:8767/face`.
Messages (JSON, one per frame; see `src/math/bridge.ts`):

- `{"type":"state","state":"listening"}`
- `{"type":"levels","level":0.4,"bass":0.2,"treble":0.1}`
- `{"type":"caption","who":"user"|"monk","text":"...","final":true}`: fading captions under the orb
- `{"type":"info","items":[{"kind":"meeting","text":"Design review at 3:00 PM"}]}`: shown while idle

For viewing on another device, open `monk.html?ws=ws://<mac-ip>:8767/face&token=<token>`;
the token is passed through to the socket.

## Layout

- `src/math/`: pure, unit-tested logic (state table, easing, audio levels, galaxy drive,
  performance decision, seeded network layout). No WebGL.
- `src/engine/`: three.js code that only draws numbers the maths already computed.
- `demo/`: the demo page. All UI colours live in `demo/tokens.css`.
