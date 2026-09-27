/**
 * Full-screen sky: deep-space base, three drifting nebula layers, an orb-coloured
 * bloom behind the centre, two twinkling star layers and a vignette.
 * Coordinates are in screen space scaled by height, so the star grid stays square.
 */
export const skyVertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const skyFragment = /* glsl */ `
uniform vec2 uResolution;
uniform float uClock;
uniform vec3 uOrbColor;
uniform float uBloom;
uniform float uNebula;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 5 octaves, each rotated so the grid never lines up.
float fbm(vec2 p) {
  const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise(p);
    p = R * p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

// One layer of hashed-grid stars. density = cells per screen height.
float stars(vec2 p, float density, float threshold, float sizePx, float speed) {
  vec2 g = p * density;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash21(cell);
  if (h < threshold) return 0.0;
  vec2 offset = vec2(hash21(cell + 7.7), hash21(cell + 3.1)) - 0.5;
  float cellPx = uResolution.y / density;
  float dist = length(f - offset * 0.7) * cellPx;
  float core = exp(-dist * dist / (sizePx * sizePx));
  float tw = 0.55 + 0.45 * sin(uClock * speed * (0.6 + h) + h * 40.0);
  float bright = (h - threshold) / (1.0 - threshold);
  return core * tw * (0.35 + 0.65 * bright);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float r = length(p);
  float t = uClock;

  // Near-black navy, darker toward the edges.
  vec3 col = mix(vec3(0.028, 0.040, 0.085), vec3(0.008, 0.011, 0.028), smoothstep(0.1, 0.95, r));

  // Nebula wisps: soft thresholds so they read as filaments, not fog.
  float n1 = fbm(p * 1.7 + vec2(t * 0.006, -t * 0.004));
  float n2 = fbm(p * 2.2 + vec2(-t * 0.005, t * 0.003) + 11.0);
  float n3 = fbm(p * 1.3 + vec2(t * 0.003, t * 0.005) + 23.0);
  col += vec3(0.04, 0.26, 0.22) * smoothstep(0.56, 0.82, n1) * 0.45 * uNebula;
  col += vec3(0.22, 0.08, 0.34) * smoothstep(0.58, 0.84, n2) * 0.45 * uNebula;
  col += vec3(0.05, 0.12, 0.36) * smoothstep(0.57, 0.85, n3) * 0.35 * uNebula;

  // Stars, dimmed where the bloom sits so the orb stays the focus.
  float s = stars(p, 180.0, 0.972, 0.9, 1.7) + stars(p, 42.0, 0.93, 2.2, 0.8) * 0.8;
  col += vec3(0.85, 0.92, 1.0) * s * smoothstep(0.05, 0.4, r);

  // Orb-coloured bloom behind the centre (the orb's screen radius is ~0.29).
  float bloom = 0.07 * exp(-pow(r / 0.32, 2.0))
              + 0.045 * exp(-pow(r / 0.55, 2.0))
              + 0.02 * exp(-pow(r / 1.00, 2.0));
  col += uOrbColor * bloom * uBloom;
  col += vec3(0.75, 0.95, 1.0) * 0.035 * exp(-pow(r / 0.07, 2.0)) * uBloom;

  // Gentle vignette.
  col *= 1.0 - 0.45 * smoothstep(0.45, 1.1, r);

  gl_FragColor = vec4(col, 1.0);
}
`;
