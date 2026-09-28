/**
 * terrain-field — a painted scene's ground at real scale.
 *
 * The macro shape is the painted scene's own: its heartbeat or `elevation`, then its `landform` and `erosion`, baked on
 * the landform grid by painted-landscape (`paintedTerrainState`). Here that grid is quantised (the form the World page
 * carries), scaled to metres — `span` metres across the painting's width, heights by the same factor × `relief` — and
 * given a fracture-rough detail law below the grid spacing: octaves from `crossover` (4 grid cells by default) down to
 * `min` metres with amplitudes on a Hurst law (0.8, the rock study's fracture regime), a few metres on bare rock, a
 * fraction of that on soil. So the ground under a walker is not the grid's flat facets.
 *
 * Returns the kernel (terrain-kernel.js) bound to the quantised grids — the same one the page runs — plus `pageConfig()`,
 * the grids base64-encoded for the page, and the world's bounds in metres.
 */
import { paintedTerrainState } from '../polygonizer/painted-landscape.js';
import { terrainKernel } from './terrain-kernel.js';
import { atlasField, validateAtlas } from './terrain-atlas.js';

export const TERRAIN_DEFAULTS = Object.freeze({ span: 2400, relief: 1, horizon: 'plain' });
export const HORIZON_MODES = Object.freeze(['plain', 'sea', 'none']);
const PAINT_WIDTH = 24;          // the painting's x span (−12…12)
const PAINT_YC = -9;             // the painting's y centre (−24…6)

const rgbArr = (c) => [c[0], c[1], c[2]];
const rampOf = (p) => ({ stops: [p.shadow, p.base, p.mid, p.highlight].map(rgbArr), pos: (p.positions || [0, 1 / 3, 2 / 3, 1]).slice(), gamma: p.gamma || 1 });

/** Errors (strings) for a terrain spec; [] when it builds. `from` is checked by painted-landscape's own validator. */
export function validateTerrainSpec(spec, at = 'terrain') {
  const e = [];
  if (!spec || typeof spec !== 'object') return [`${at} must be an object { from | world, span?, relief?, horizon?, detail? }`];
  if (spec.world !== undefined) {
    // a composed world (terrain-atlas.js): its features size it, so span / relief / horizon / detail do not apply
    e.push(...validateAtlas(spec.world, `${at}.world`));
    if (spec.from) e.push(`${at}: give either \`from\` (a painted scene) or \`world\` (a composed one), not both`);
    for (const k of ['span', 'relief', 'horizon', 'detail']) if (spec[k] !== undefined) e.push(`${at}.${k} does not apply to a composed world: its features' sizes set its scale`);
    const pl = spec.planet;
    if (pl !== undefined && pl !== false && pl !== true && !(pl && typeof pl === 'object' && (pl.radius === undefined || (Number.isFinite(pl.radius) && pl.radius >= 20000 && pl.radius <= 7e6)))) e.push(`${at}.planet must be true or { radius }: metres, 20000–7000000 (Earth's 6371000 is the default for a continent)`);
    return e;
  }
  if (!spec.from || typeof spec.from !== 'object' || Array.isArray(spec.from)) e.push(`${at}.from must be a painted-landscape recipe (the scene the world is made from), inline or { ref: '<sketch>' }; or give \`world\` to compose one from features`);
  const num = (k, lo, hi, what) => { if (spec[k] !== undefined && !(Number.isFinite(spec[k]) && spec[k] >= lo && spec[k] <= hi)) e.push(`${at}.${k} must be ${what}`); };
  num('span', 50, 200000, 'the metres the painting\'s width covers, 50–200000 (2400 default)');
  num('relief', 0.05, 20, 'a vertical scale on top of the span\'s, 0.05–20 (1 default)');
  if (spec.horizon !== undefined && !HORIZON_MODES.includes(spec.horizon)) e.push(`${at}.horizon must be one of ${HORIZON_MODES.join(', ')} (how the ground continues past the painting)`);
  const pl = spec.planet;
  if (pl !== undefined && pl !== false && pl !== true) {
    if (!pl || typeof pl !== 'object' || (pl.radius !== undefined && !(Number.isFinite(pl.radius) && pl.radius >= 2 * (spec.span ?? TERRAIN_DEFAULTS.span) && pl.radius <= 200000))) e.push(`${at}.planet must be true or { radius }: metres, at least twice the span and at most 200000 (float precision at the surface)`);
  }
  const d = spec.detail;
  if (d !== undefined && d !== false) {
    if (!d || typeof d !== 'object') e.push(`${at}.detail must be false or { rock?, soil?, hurst?, crossover?, min? } (metres)`);
    else {
      const dn = (k, lo, hi, what) => { if (d[k] !== undefined && !(Number.isFinite(d[k]) && d[k] >= lo && d[k] <= hi)) e.push(`${at}.detail.${k} must be ${what}`); };
      dn('rock', 0, 100, 'the rock roughness in metres, 0–100'); dn('soil', 0, 100, 'the soil roughness in metres, 0–100');
      dn('hurst', 0.1, 1.5, 'a roughness exponent 0.1–1.5 (0.8 is fractured rock)'); dn('crossover', 0.5, 5000, 'the longest detail wavelength in metres');
      dn('min', 0.05, 100, 'the shortest detail wavelength in metres (0.5 default)');
    }
  }
  return e;
}

/**
 * terrainField({ from, span?, relief?, horizon?, detail?, seed? }) → { kernel, heightAt, groundAt, normalAt, colorAt,
 * K, pageConfig(), bounds, meta }. `from` is a painted-landscape manifest (already resolved from a ref by the caller).
 */
export function terrainField(spec) {
  const errs = validateTerrainSpec(spec); if (errs.length) throw new Error(`terrain: ${errs.join('; ')}`);
  if (spec.world) return atlasField(spec);
  const span = spec.span ?? TERRAIN_DEFAULTS.span, relief = spec.relief ?? TERRAIN_DEFAULTS.relief, mode = spec.horizon ?? TERRAIN_DEFAULTS.horizon;
  const P = paintedTerrainState({ kind: 'painted-landscape', ...spec.from });
  const st = P.state; const N = st.nx * st.ny; const s = span / PAINT_WIDTH, zs = s * relief;
  // quantise: the page carries exactly these, so the server reads them too
  let lo = Infinity, hi = -Infinity; for (let k = 0; k < N; k++) { if (st.z[k] < lo) lo = st.z[k]; if (st.z[k] > hi) hi = st.z[k]; }
  const hStep = (hi - lo) / 65535 || 1e-9; const hq = new Uint16Array(N); for (let k = 0; k < N; k++) hq[k] = Math.round((st.z[k] - lo) / hStep);
  const hard = new Uint8Array(N); for (let k = 0; k < N; k++) hard[k] = Math.round(Math.max(0, Math.min(1, st.hard[k])) * 255);
  let aMax = 0; for (let k = 0; k < N; k++) if (st.apron[k] > aMax) aMax = st.apron[k];
  const apronStep = aMax > 0 ? aMax / 255 : 1; const apron = new Uint8Array(N); for (let k = 0; k < N; k++) apron[k] = Math.round(st.apron[k] / apronStep);
  const sorted = Float64Array.from(st.z).sort(); const p10 = sorted[Math.floor(0.1 * (N - 1))]; const range = (hi - lo) || 1;
  const sea = mode === 'sea' ? (Number.isFinite(P.waterLevel) ? P.waterLevel : p10 - 0.02 * range) : (Number.isFinite(P.waterLevel) ? P.waterLevel : null);
  const horizon = { mode, fall: 18, amp: mode === 'sea' ? 0.05 * range : 0.35 * range, base: mode === 'sea' ? sea - 0.15 * range : p10 + 0.1 * range };
  const cellM = st.dx * s; const d = spec.detail === false ? { rock: 0, soil: 0 } : (spec.detail || {});
  const L0 = d.crossover ?? 4 * cellM, Lmin = d.min ?? 0.5, H = d.hurst ?? 0.8;
  const octaves = []; for (let L = L0; L >= Lmin && octaves.length < 16; L /= 2) octaves.push([L, (L / L0) ** H]);
  const seedNum = hashSeed(spec.seed ?? spec.from.seed ?? 'terrain') % 100003;
  const K = {
    nx: st.nx, ny: st.ny, x0: st.x0, y0: st.y0, dx: st.dx, hq, hMin: lo, hStep, hard, apron, apronStep,
    s, zs, yc: PAINT_YC, rect: [P.domain.x0, P.domain.x1, P.domain.y0, P.domain.y1], horizon, sea,
    beds: st.strata ? { b: st.strata.layers.map((l) => l.b), hard: st.strata.layers.map((l) => (l.hard ? 1 : 0)), tanD: st.strata.tanD, cx: st.strata.cx, cy: st.strata.cy } : null,
    detail: { octaves, norm: octaves.reduce((a, o) => a + o[1], 0) || 1, rock: d.rock ?? 0.06 * L0, soil: d.soil ?? 0.012 * L0, seed: seedNum },
    light: [P.light.x, P.light.y, P.light.z], lambert: P.lambert,
    ramps: { soil: rampOf(P.palette), stone: rampOf(P.stone), scree: rampOf(P.scree), beds: P.beds.map(rampOf) },
  };
  if (spec.planet) {
    // the painting at the north pole of a sphere; continents past it, relative to the painting's horizon base
    const R = (spec.planet === true ? null : spec.planet.radius) ?? 8 * span; const half = Math.hypot(PAINT_WIDTH, 30) / 2 * s;
    const baseM = horizon.base * zs, amp = Math.max(0.6 * range * zs, 0.02 * R);
    K.planet = { R, inner: (1.3 * half) / R, outer: (3.5 * half) / R, cont: { amp, wl: 0.9 * R, bias: 0.05, base: baseM }, seed: (seedNum + 911) % 100003, sea: (sea !== null ? sea * zs : baseM - 0.12 * amp) };
  }
  const kernel = terrainKernel(K);
  const toW = (x, y) => kernel.toWorld(x, y);
  const [wx0, wy0] = toW(P.domain.x0, P.domain.y0), [wx1, wy1] = toW(P.domain.x1, P.domain.y1);
  return {
    K, kernel, heightAt: kernel.heightAt, groundAt: kernel.groundAt, normalAt: kernel.normalAt, colorAt: kernel.colorAt,
    bounds: { x: [wx0, wx1], y: [wy0, wy1], z: [lo * zs, hi * zs], cell: cellM },
    meta: { span, relief, horizon: mode, sea: sea === null ? null : sea * zs, planet: K.planet || null, sky: P.sky, rock: P.rockName, octaves: octaves.length, scree: st.scree.map((r) => ({ ...r, ...Object.fromEntries([['x', r.x * s], ['y', (r.y - PAINT_YC) * s], ['z0', r.z0 * zs], ['size', r.size * s]]) })) },
    /** The kernel's inputs for the World page: grids as base64, everything else as is. */
    pageConfig() { return pageConfigOf(K); },
  };
}

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
function pageConfigOf(K) {
  const { hq: q, hard: h, apron: a, grade, ...rest } = K;
  return { ...rest, grids: { hq: b64(q), hard: b64(h), apron: b64(a) }, ...(grade ? { grade: grade.map((L) => ({ ...L, dq: b64(L.dq), w: b64(L.w), ...(L.paint ? { paint: { ...L.paint, pc: b64(L.paint.pc) } } : {}) })) } : {}) };
}

/**
 * The same field with graded ground laid over it (terrain-city.js): `layers` become the kernel's `K.grade`, so the
 * server and the page stand on the same datum. No layers → the field itself.
 */
export function gradedField(field, layers) {
  if (!layers || !layers.length) return field;
  const K = { ...field.K, grade: layers };
  if (field.atlas) { const g = field.withK(K); return g; }
  const kernel = terrainKernel(K);
  return { ...field, K, kernel, heightAt: kernel.heightAt, groundAt: kernel.groundAt, normalAt: kernel.normalAt, colorAt: kernel.colorAt, pageConfig() { return pageConfigOf(K); } };
}

function hashSeed(seed) {
  if (Number.isFinite(seed)) return Math.floor(seed) >>> 0;
  const t = String(seed); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0;
}
