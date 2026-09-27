import { createFace, type OrbFrame } from '../src/index';

let canvas = document.getElementById('face') as HTMLCanvasElement;
let face = createFace(canvas);
const overrides: Partial<OrbFrame> = {};

document.querySelectorAll<HTMLInputElement>('#debug input[type=range]').forEach((input) => {
  input.addEventListener('input', () => {
    (overrides as Record<string, number>)[input.name] = Number(input.value);
    face.setOrbFrame(overrides);
  });
});

document.getElementById('recreate')!.addEventListener('click', () => {
  face.destroy();
  // A released WebGL context can't be reused, so recreate on a fresh canvas.
  const fresh = canvas.cloneNode() as HTMLCanvasElement;
  canvas.replaceWith(fresh);
  canvas = fresh;
  face = createFace(canvas);
  face.setOrbFrame(overrides);
});

Object.assign(window, { face: () => face });
