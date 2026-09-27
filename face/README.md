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
face.setTheme('light');
face.setPerformanceMode('auto');  // auto | on | off
face.destroy();                   // stops the loop, releases audio taps and the WebGL context
```

- Without a mic or playback tap, the orb uses a deterministic synthetic voice.
- In `arming`, the face moves to `listening` by itself once the mic delivers real audio
  (turn off with `autoListen: false`).
- A polite live region announces the state; pass `liveRegion` to use your own element.
- Reduced motion follows the OS setting (or `setReducedMotion(true | false | null)`).

## Layout

- `src/math/`: pure, unit-tested logic (state table, easing, audio levels, galaxy drive,
  performance decision, seeded network layout). No WebGL.
- `src/engine/`: three.js code that only draws numbers the maths already computed.
- `demo/`: the demo page. All UI colours live in `demo/tokens.css`.
