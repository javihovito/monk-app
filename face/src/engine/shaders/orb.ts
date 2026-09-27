import { simplex3 } from './simplex';

/**
 * Orb mesh. Displacement = 3-octave simplex noise scaled by "how much is going on":
 * a small base, a slow breath, and the audio drive. At rest it barely ripples.
 */
export const orbVertex = /* glsl */ `
uniform float uClock;
uniform float uNoiseTime;
uniform float uBase;
uniform float uAmp;
uniform float uLevel;
uniform float uBass;
uniform float uTreble;

varying vec3 vNormalV;
varying vec3 vViewPos;
varying float vDisp;

${simplex3}

void main() {
  vec3 n = normalize(position);
  float t = uNoiseTime;

  float lo = snoise(n * 1.0 + vec3(t * 0.30, t * 0.20, -t * 0.25));
  float mid = snoise(n * 2.0 + vec3(-t * 0.45, t * 0.35, t * 0.30));
  // The high octave only switches on with audio.
  float hiGate = clamp((uLevel + uTreble) * 2.5, 0.0, 1.0);
  float hi = snoise(n * 3.6 + vec3(t * 0.9, -t * 0.7, t * 0.8)) * hiGate;
  float noise = 0.5 * lo + 0.3 * mid + 0.2 * hi;

  float breath = (0.5 + 0.5 * sin(uClock * 0.7)) * 0.04;
  float drive = uBase + breath + uLevel * uAmp * 0.55 + uBass * uAmp * 0.35;

  // Small bass "push": a wave that rolls over the surface on low end.
  float push = sin(n.y * 3.0 + uClock * 3.2) * uBass * uAmp * 0.08;

  float d = clamp(noise * drive + push, -0.45, 0.45);
  vDisp = d;

  vec3 displaced = n * (1.0 + d);
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * mv;
}
`;

export const orbFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uFresnelPow;

varying vec3 vNormalV;
varying vec3 vViewPos;
varying float vDisp;

void main() {
  vec3 viewDir = normalize(-vViewPos);
  float facing = abs(dot(normalize(vNormalV), viewDir));
  float fresnel = pow(1.0 - facing, uFresnelPow);
  // Parts that push outward lean toward the secondary colour.
  vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.18, vDisp) * 0.7);
  float alpha = uOpacity * (0.05 + 0.95 * fresnel);
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * Glow shell: back faces of a larger sphere. The halo peaks just outside the
 * orb's silhouette and falls to zero at the shell's own edge AND toward the centre,
 * so it reads as a halo rather than a filled disc.
 */
export const glowVertex = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vec3 viewDir = normalize(-vViewPos);
  // 0 at the shell's silhouette, 1 at its centre. The orb's rim sits around 0.6.
  float d = abs(dot(normalize(vNormalV), viewDir));
  float outer = smoothstep(0.0, 0.62, d);          // fade out toward the shell edge
  float inner = 1.0 - smoothstep(0.58, 0.92, d);   // fade out toward the centre
  float halo = pow(outer, 2.2) * inner;
  gl_FragColor = vec4(uColor * halo * uGlow, halo * uGlow);
}
`;
