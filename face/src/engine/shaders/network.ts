/** Soft glowing node sprites: bright core, half-bright at 30% radius, zero at the edge. */
export const nodeVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uViewportHeight;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Perspective size: shrinks with distance.
  gl_PointSize = aSize * uSizeScale * uViewportHeight * 0.38 / -mv.z * uPixelRatio;
}
`;

export const nodeFragment = /* glsl */ `
uniform float uBrightness;
uniform float uAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = 0.5 * (1.0 - smoothstep(0.0, 0.3, d)) + 0.5 * (1.0 - smoothstep(0.3, 1.0, d));
  vec3 col = mix(vColor, vec3(1.0), 0.35 * (1.0 - smoothstep(0.0, 0.2, d)));
  gl_FragColor = vec4(col * uBrightness, a * uAlpha);
}
`;

export const lineVertex = /* glsl */ `
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const lineFragment = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, uOpacity);
}
`;

export const dustFragment = /* glsl */ `
uniform float uAlpha;
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(uColor, (1.0 - d) * uAlpha);
}
`;

export const dustVertex = /* glsl */ `
uniform float uPixelRatio;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 1.6 * uPixelRatio;
}
`;
