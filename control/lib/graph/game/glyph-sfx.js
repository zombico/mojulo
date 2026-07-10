/**
 * glyph-sfx — the game UI language's SFX VERB SHELF, productized (game-ui-language.plan.md, U4).
 *
 * Eleven parameterized "juice" verbs across three raymarch mechanisms — emission BEADS on
 * parametric paths, emission FIELDS, and EXTINCTION filaments (darkness as a substance) — composed
 * into ONE `volSample` transfer function and wrapped as an `effects[]` overlay layer
 * (buildVolumeFrag, overlay). The spikes (glyph-{wisps,sfx,shonen}) proved each verb; this file is
 * the promotion: a pure composer, `composeGlyphSfx(layers) → { frag, customUniforms }`, that a world
 * manifest's `sfx` channel lowers into `payload.effects`.
 *
 * Doctrine carried from the spikes' hard-won lessons:
 *   - Animation rides `uTime` (U3 made it deterministic under camera bakes — the spikes' spatial-
 *     phase workaround is retired). buildVolumeFrag declares `uTime` + provides `vrHash13`.
 *   - GAIN BUDGET: a soft-knee `emis/(1+emis)` at the end guarantees no verb stack can white out
 *     the form it decorates (the accumulate blow-out lesson) — bounded by construction, not by
 *     hand-tuned gains.
 *   - PRECISION: squared/small constants format at f6 (the kokusen `width²` → toFixed(3) →
 *     divide-by-zero → invisible-bolts lesson).
 *   - SAMPLING COUPLING: thin extinction filaments need a fine march; each verb declares its
 *     `steps` floor and the composer takes the max (kokusen forces 240; beads/fields want ~96).
 *
 * The verb GLSL runs with these locals in scope: `cc` (the layer's world anchor), `ph` (uTime ×
 * the verb's rate), `frame` (floor(uTime×8) — a per-frame index for flicker), `TAU`, and `halo`.
 */

const f3 = (v) => (+v).toFixed(3);
const f6 = (v) => (+v).toFixed(6);        // squared/small constants underflow f3 → GLSL div-by-zero
const col = (c) => `vec3(${(c || [1, 1, 1]).map(f3).join(', ')})`;
const vec3lit = (a) => `vec3(${(a || [0, 0, 0]).map(f6).join(', ')})`;

// ── the verb shelf ────────────────────────────────────────────────────────────
// Each verb: { summary, when, mechanism, rate, steps, defaults, glsl(params) → block }.
// mechanism ∈ 'bead' (emission beads on a path) | 'field' (emission volume) | 'extinction'
// (absorbs, never emits — black-negative-space). `rate` scales uTime → ph. `steps` = march floor.

export const SFX_VERBS = {
  enchant: {
    summary: 'Two opposed wisps on a tilted orbit — "this item is magic".',
    when: 'magic/enchanted items, special pickups, an idle "look at me" shimmer',
    mechanism: 'bead', rate: 1.0, steps: 96,
    defaults: { color: [0.2, 1.0, 0.75], orbitR: 0.85, cz: 0.62, gain: 8 },
    glsl: (p) => `
  for (int w = 0; w < 2; w++){
    for (int k = 0; k < 8; k++){
      float A = ph + float(w) * 3.14159 - float(k) * 0.35;
      vec3 bead = cc + vec3(${f3(p.orbitR)} * cos(A), ${f3(p.orbitR)} * sin(A), ${f3(p.cz)} + 0.22 * sin(2.0 * A + float(w) * 1.57));
      float wgt = exp(-0.5 * float(k));
      emis += ${col(p.color)} * ${f3(p.gain)} * wgt * halo(p_, bead, 0.16 - 0.008 * float(k));
    }
  }`,
  },

  heal: {
    summary: 'A fountain of warm wisps spiralling up — heal / blessing.',
    when: 'healing, restore, blessing, heal-over-time',
    mechanism: 'bead', rate: 1.0, steps: 96,
    defaults: { color: [1.0, 0.75, 0.4], cz: 0.12, height: 1.5, gain: 7 },
    glsl: (p) => `
  for (int w = 0; w < 2; w++){
    for (int k = 0; k < 8; k++){
      float s = fract(ph / TAU + float(w) * 0.5 - float(k) * 0.045);
      float A = s * 12.566 + float(w) * 3.14159;
      float r = 0.5 * (1.0 - 0.3 * s);
      vec3 bead = cc + vec3(r * cos(A), r * sin(A), ${f3(p.cz)} + ${f3(p.height)} * s);
      float wgt = sin(3.14159 * s) * exp(-0.3 * float(k));
      emis += ${col(p.color)} * ${f3(p.gain)} * wgt * halo(p_, bead, 0.15);
    }
  }`,
  },

  charge: {
    summary: 'Wisps spiral inward and brighten on arrival — charge-up / attract.',
    when: 'charging, powering up, attracting energy, a channel',
    mechanism: 'bead', rate: 1.0, steps: 96,
    defaults: { color: [0.55, 0.75, 1.0], cz: 0.65, gain: 8 },
    glsl: (p) => `
  for (int w = 0; w < 2; w++){
    for (int k = 0; k < 8; k++){
      float s = 1.0 - fract(ph / TAU + float(w) * 0.5 - float(k) * 0.05);
      float A = s * 9.42478 + float(w) * 3.14159;
      float r = 0.15 + 1.3 * s;
      vec3 bead = cc + vec3(r * cos(A), r * sin(A), ${f3(p.cz)} + 0.55 * s);
      float wgt = (0.15 + 0.85 * (1.0 - s) * (1.0 - s)) * sin(3.14159 * s);
      emis += ${col(p.color)} * ${f3(p.gain)} * wgt * halo(p_, bead, 0.14);
    }
  }`,
  },

  hit: {
    summary: 'Six radial spokes bursting out with a gravity arc — impact.',
    when: 'a hit landing, an impact, an explosion punctuation',
    mechanism: 'bead', rate: 1.0, steps: 96,
    defaults: { color: [1.0, 0.35, 0.15], cz: 0.75, gain: 9 },
    glsl: (p) => `
  {
    float s0 = fract(ph / TAU);
    for (int j = 0; j < 6; j++){
      for (int k = 0; k < 4; k++){
        float s = max(s0 - float(k) * 0.05, 0.0);
        float A = float(j) * 1.0472 + 0.35;
        float e = 1.0 - (1.0 - s) * (1.0 - s);
        float r = 0.25 + 1.35 * e;
        vec3 bead = cc + vec3(r * cos(A), r * sin(A), ${f3(p.cz)} + 0.8 * s - 0.85 * s * s);
        float wgt = (1.0 - s) * (1.0 - s) * exp(-0.6 * float(k));
        emis += ${col(p.color)} * ${f3(p.gain)} * wgt * halo(p_, bead, 0.15);
      }
    }
  }`,
  },

  accumulate: {
    summary: 'Streams flow in from outside, growing toward the centre — gather / wind-up.',
    when: 'gathering energy, a wind-up telegraph, resources converging',
    mechanism: 'bead', rate: 1.0, steps: 96,
    defaults: { color: [0.75, 0.45, 1.0], gain: 6, reach: 2.1, cz: 0.65 },
    glsl: (p) => `
  for (int w = 0; w < 3; w++){
    for (int k = 0; k < 10; k++){
      float s = fract(ph / TAU + float(w) * 0.3333 - float(k) * 0.03);
      float A = s * 18.85 + float(w) * 2.094;
      float r = 0.18 + ${f3(p.reach)} * s;
      vec3 bead = cc + vec3(r * cos(A), r * sin(A), ${f3(p.cz)} + 1.1 * s * s);
      float wgt = min(pow(1.0 - s, 1.6), 0.55) * exp(-0.25 * float(k)) + 0.02;
      emis += ${col(p.color)} * ${f3(p.gain)} * wgt * halo(p_, bead, 0.10 + 0.07 * (1.0 - s));
    }
  }`,
  },

  ward: {
    summary: 'Three wisps orbiting a vertical ring — a protective circle.',
    when: 'protection, a shield/barrier, warded/blessed status',
    mechanism: 'bead', rate: 1.0, steps: 96,
    defaults: { color: [1.0, 0.85, 0.35], ringR: 0.95, cz: 0.72, gain: 7 },
    glsl: (p) => `
  for (int w = 0; w < 3; w++){
    for (int k = 0; k < 6; k++){
      float A = ph + float(w) * 2.094 - float(k) * 0.22;
      vec3 bead = cc + vec3(${f3(p.ringR)} * cos(A), 0.22 * sin(A * 3.0), ${f3(p.cz)} + 0.85 * sin(A));
      float wgt = exp(-0.45 * float(k));
      emis += ${col(p.color)} * ${f3(p.gain)} * wgt * halo(p_, bead, 0.13);
    }
  }`,
  },

  sparkle: {
    summary: 'Hash-scattered twinkles — the collectible / treasure tell.',
    when: 'collectibles, treasure, a shiny pickup, "grab me"',
    mechanism: 'bead', rate: 1.0, steps: 80,
    defaults: { color: [1.0, 0.95, 0.7], gain: 10, spread: [1.7, 1.1, 1.3], cz: 0.75 },
    glsl: (p) => `
  for (int k = 0; k < 12; k++){
    vec3 h = vec3(vrHash13(vec3(float(k), 3.1, 7.7)), vrHash13(vec3(float(k), 11.3, 2.9)), vrHash13(vec3(float(k), 5.7, 13.1)));
    vec3 sp = cc + (h - 0.5) * vec3(${(p.spread || [1.7, 1.1, 1.3]).map(f3).join(', ')}) + vec3(0.0, 0.0, ${f3(p.cz)});
    float tw = fract(ph / TAU + vrHash13(vec3(float(k), 1.0, 1.0)));
    float b = pow(max(sin(3.14159 * tw), 0.0), 8.0);
    emis += ${col(p.color)} * ${f3(p.gain)} * b * halo(p_, sp, 0.09);
  }`,
  },

  drain: {
    summary: "Heal's dark mirror — wisps spiral down and away, brightest at the body.",
    when: 'draining, poison, decay, life leaving, a curse',
    mechanism: 'bead', rate: 1.0, steps: 96,
    defaults: { color: [0.45, 0.9, 0.35], gain: 7, cz: 1.5 },
    glsl: (p) => `
  for (int w = 0; w < 2; w++){
    for (int k = 0; k < 8; k++){
      float s = fract(ph / TAU + float(w) * 0.5 - float(k) * 0.04);
      float A = -s * 9.42478 + float(w) * 3.14159;
      float r = 0.25 + 1.1 * s;
      vec3 bead = cc + vec3(r * cos(A), r * sin(A), ${f3(p.cz)} - 1.45 * s);
      float wgt = pow(1.0 - s, 1.5) * sin(3.14159 * s) * exp(-0.3 * float(k));
      emis += ${col(p.color)} * ${f3(p.gain)} * wgt * halo(p_, bead, 0.14);
    }
  }`,
  },

  aura: {
    summary: 'A soft breathing glow — the base emphasis every verb composes with.',
    when: 'ambient emphasis, "this matters", a gentle highlight; composes under other verbs',
    mechanism: 'field', rate: 1.0, steps: 64,
    defaults: { color: [0.6, 0.8, 1.0], base: 0.35, pulse: 0.3, r: 0.85, cz: 0.65 },
    glsl: (p) => `
  emis += ${col(p.color)} * (${f3(p.base)} + ${f3(p.pulse)} * (0.5 + 0.5 * sin(ph))) * halo(p_, cc + vec3(0.0, 0.0, ${f3(p.cz)}), ${f3(p.r)});`,
  },

  'ssj-aura': {
    summary: 'A ki envelope — pulsing sheath, white-hot core, rising flame tongues.',
    when: 'powered-up state, a transformation, an overcharged boss, "super mode"',
    mechanism: 'field', rate: 1.0, steps: 110,
    defaults: { color: [1.0, 0.82, 0.25], coreZ: 0.95, height: 2.1, gain: 6.5 },
    glsl: (p) => `
  {
    vec3 q = (p_ - cc - vec3(0.0, 0.0, ${f3(p.coreZ)})) / vec3(0.60, 0.50, 1.05);
    emis += ${col(p.color)} * (0.45 + 0.18 * sin(ph)) * exp(-dot(q, q));
    vec3 q2 = (p_ - cc - vec3(0.0, 0.0, ${f3(p.coreZ)})) / vec3(0.34, 0.30, 0.88);
    emis += vec3(1.0, 0.97, 0.85) * 0.35 * exp(-dot(q2, q2));
    for (int k = 0; k < 14; k++){
      float h1 = vrHash13(vec3(float(k), 2.7, 9.1));
      float h2 = vrHash13(vec3(float(k), 6.3, 4.9));
      float s = fract(h1 + ph / TAU);
      float A = h2 * TAU + 0.5 * sin(ph + float(k));
      float r = 0.62 * pow(1.0 - s, 0.6) + 0.10;
      vec3 bead = cc + vec3(r * cos(A), r * sin(A), 0.1 + ${f3(p.height)} * s);
      vec3 d = (p_ - bead) / vec3(0.15, 0.15, 0.45);
      float flick = 0.7 + 0.3 * sin(ph * 2.0 + h2 * TAU);
      emis += ${col(p.color)} * ${f3(p.gain)} * pow(sin(3.14159 * s), 0.8) * flick * exp(-dot(d, d));
    }
  }`,
  },

  kokusen: {
    summary: 'Black-flash currents — jagged black lightning silhouetted against an aura.',
    when: 'a dark/forbidden power, a black-flash burst, a corrupted or shadow effect',
    mechanism: 'extinction', rate: 1.0, steps: 240,
    defaults: { color: [1.0, 0.12, 0.15], cz: 0.95, auraR: [0.85, 0.7, 1.1], arcR: 0.6, zBase: 0.3, zSpan: 1.3, width: 0.022 },
    glsl: (p) => `
  {
    vec3 q = (p_ - cc - vec3(0.0, 0.0, ${f3(p.cz)})) / vec3(${(p.auraR || [0.85, 0.7, 1.1]).map(f3).join(', ')});
    emis += ${col(p.color)} * (0.35 + 0.3 * (0.5 + 0.5 * sin(ph * 2.0))) * exp(-dot(q, q));
    for (int j = 0; j < 9; j++){
      float gj = vrHash13(vec3(float(j), frame, 7.3));
      if (gj < 0.3) continue;
      float A0 = vrHash13(vec3(float(j), 3.3, 1.7)) * TAU + ph;
      vec3 prev = vec3(0.0);
      for (int k = 0; k < 8; k++){
        float u = float(k) / 7.0;
        float A = A0 + u * 2.2;
        float rr = ${f3(p.arcR)} + 0.18 * sin(u * 9.0 + float(j) * 2.1);
        vec3 jit = vec3(
          vrHash13(vec3(float(j), float(k), frame)),
          vrHash13(vec3(float(k), float(j), frame + 3.0)),
          vrHash13(vec3(frame, float(j), float(k)))) - 0.5;
        vec3 node = cc + vec3(rr * cos(A), rr * sin(A), ${f3(p.zBase)} + ${f3(p.zSpan)} * u) + jit * 0.3;
        if (k > 0){
          vec3 pa = p_ - prev, ba = node - prev;
          float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          float sd = length(pa - ba * hh);
          ext += vec3(200.0) * exp(-(sd * sd) / ${f6(p.width * p.width)});   // absorbs, never emits — black lightning
        }
        if (k == 7) emis += ${col(p.color)} * 3.0 * gj * halo(p_, node, 0.07);
        prev = node;
      }
    }
  }`,
  },
};

export const SFX_VERB_IDS = Object.keys(SFX_VERBS);

/**
 * composeGlyphSfx(layers, opts) → { frag, customUniforms, dataTextures } — an effects[] layer.
 *
 * @param {Array} layers  [{ verb, at:[x,y,z], color?, rate?, params? }]. `at` is the world anchor
 *   (already resolved from an entity by the caller). Each verb's GLSL runs with `cc = at`,
 *   `ph = uTime * rate`, `frame`, `TAU`, `halo` in scope.
 * @param {object} [opts]  { maxDist=24 }
 * @returns { globals, maxSteps, maxDist } — pass to finalizeSfxLayer to get the effects layer;
 *   null if no valid layers.
 *
 * The GLSL point is `p_` (volSample's arg) and the halo helper's arg is `pt`, both distinct from
 * the JS `p` params object the verb builders read (p.color, p.gain) — no name collision.
 */
export function composeGlyphSfx(layers, opts = {}) {
  const valid = (Array.isArray(layers) ? layers : []).filter(
    (L) => L && SFX_VERBS[L.verb] && Array.isArray(L.at) && L.at.length === 3,
  );
  if (!valid.length) return null;

  let maxSteps = 64;
  const blocks = valid.map((L) => {
    const verb = SFX_VERBS[L.verb];
    if (verb.steps > maxSteps) maxSteps = verb.steps;
    const params = { ...verb.defaults, ...(L.params || {}) };
    if (L.color) params.color = L.color;
    const rate = Number.isFinite(L.rate) ? L.rate : verb.rate;
    return `  { vec3 cc = ${vec3lit(L.at)}; float ph = uTime * ${f3(rate)}; ${verb.glsl(params)}
  }`;
  });

  const globals = `
float halo(vec3 pt, vec3 c, float r){ vec3 d = pt - c; return exp(-dot(d,d)/(r*r)); }
const float TAU = 6.28318530718;
void volSample(vec3 p_, out vec3 emis, out vec3 ext){
  emis = vec3(0.0); ext = vec3(0.01);
  float frame = floor(uTime * 8.0);   // per-frame index for flicker (kokusen re-jitter)
${blocks.join('\n')}
  emis = emis / (1.0 + emis);         // gain budget: soft-knee → no verb stack can white out
}`;

  // buildVolumeFrag is imported lazily so the composer stays a pure data module when only the
  // registry/vocab is needed (cards, tests) — the GLSL wrapper is only pulled when actually rendering.
  return { globals, maxSteps, maxDist: Number.isFinite(opts.maxDist) ? opts.maxDist : 24 };
}

/**
 * finalizeSfxLayer(composed) → { frag, customUniforms, dataTextures } — wrap the composed globals
 * in buildVolumeFrag. Split from composeGlyphSfx so the pure-data path (vocab cards, unit tests of
 * the GLSL text) doesn't import the raymarch wrapper.
 */
export async function finalizeSfxLayer(composed) {
  if (!composed) return null;
  const { buildVolumeFrag } = await import('../effects/volume-raymarch.js');
  const frag = buildVolumeFrag({
    globals: composed.globals,
    uniforms: ['uniform float uMaxDist;'],
    overlay: true,
    boundsRadius: 'uMaxDist',
    steps: composed.maxSteps,
  });
  return { frag, customUniforms: { uMaxDist: composed.maxDist }, dataTextures: {} };
}

/**
 * resolveSfxLayers(sfxSpec, entities) → resolved layer list with `at` filled in.
 * A layer anchors either at an explicit `at:[x,y,z]` or `on:'<entityId>'` (→ the entity's
 * transform.pos). Unknown verbs / unresolvable anchors are dropped (teaching happens at the tool).
 */
export function resolveSfxLayers(sfxSpec, entities) {
  const list = Array.isArray(sfxSpec) ? sfxSpec : [];
  const byId = {};
  for (const e of Array.isArray(entities) ? entities : []) if (e && e.id) byId[e.id] = e;
  const out = [];
  for (const L of list) {
    if (!L || !SFX_VERBS[L.verb]) continue;
    let at = Array.isArray(L.at) && L.at.length === 3 ? L.at : null;
    if (!at && L.on && byId[L.on] && byId[L.on].transform && Array.isArray(byId[L.on].transform.pos)) {
      at = byId[L.on].transform.pos;
    }
    if (!at) continue;
    out.push({ verb: L.verb, at, color: L.color, rate: L.rate, params: L.params });
  }
  return out;
}
