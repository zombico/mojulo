/**
 * world-contract.js — what each handoff demands of a world payload, as data
 * (world-contract-tiers, W0).
 *
 * A TIER is a set of declarations a resolved world payload carries plus the gate that
 * proves a reader honoured them. Tiers are monotonic (T(n) ⊂ T(n+1)); a payload DECLARES a
 * tier when every declaration up to it is present, and ATTAINS it when the tier's gate
 * passes on that kind. This module measures the declarations only — pure, no dice, no
 * engine knowledge; the gates live in scripts/export-*.mjs and stamp their own results.
 *
 * Two things a tier is not: a fidelity rank (T0 is a finished look, on purpose), and an
 * engine. The engine is the WITNESS — the first reader that cannot proceed without the
 * tier's declarations. The declaration shapes checked here are the ones the emitters
 * already read (`faces`, `walk`, `metersPerUnit`, `outNormal`, `lights`, `pbr`,
 * `textures`); the contract names them, it does not invent any.
 *
 * The one advisory that rides with the contract, `imports_dark`, is the check that would
 * have caught the black-sky box in lib/ instead of in Unreal: an enclosed volume (a ceiling
 * over the spawn) with no lights and no openings imports dark in any renderer that does
 * transport. Reported, never a refusal (W5).
 */

export const WORLD_TIERS = Object.freeze([
  {
    id: 'T0', name: 'coherent',
    declares: ['faces', 'fills', 'walk_seat', 'floor_under_spawn', 'units_valid'],
    gate: 'world-scene kinds characterization + engine-portability advisory + Godot locomotion_probe (unlit)',
    witness: 'the World runtime; Godot / Unity / Unreal unlit',
  },
  {
    id: 'T1', name: 'baked',
    declares: ['out_normals', 'lights'],
    gate: 'the GI bake machine gate (corner match, no blackened back-faces); the in-substrate pool bake',
    witness: 'Cycles via bake-world-gi.mjs; the World\'s own per-corner pools',
  },
  {
    id: 'T2', name: 'transported',
    declares: ['eye_plausible', 'lights_positioned', 'locomotion_row'],
    gate: 'export-godot.mjs --lit + locomotion_probe; lights_carried in the ledger',
    witness: 'Godot',
  },
  {
    id: 'T3', name: 'materialized',
    declares: ['material_identity', 'textures_resolved'],
    gate: 'export-unity.mjs materials probe (MOJULO_UNITY); slot-swap count in the ledger',
    witness: 'Unity 6 (URP)',
  },
  {
    id: 'T4', name: 'physical',
    declares: ['lights_physical', 'units_declared'],
    gate: 'export-unreal.mjs (lights_carried, materials_unlit, clips_bound); the lit eyes gate',
    witness: 'Unreal 5 (Interchange + Lumen)',
  },
]);

const LIGHT_TYPES = new Set(['directional', 'point', 'spot']);
const EYE_MIN_M = 1.0;   // a child stooping
const EYE_MAX_M = 2.2;   // a tall adult on tiptoe

const isVec = (v, n) => Array.isArray(v) && v.length >= n && v.slice(0, n).every(Number.isFinite);
const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : 0);

function faceBounds(f) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const c of f.corners) {
    if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
    if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
    if (c[2] < z0) z0 = c[2]; if (c[2] > z1) z1 = c[2];
  }
  return { x0, y0, z0, x1, y1, z1 };
}

const isOpening = (f) => f.water === true || (Number.isFinite(f.alpha) && f.alpha < 1);
// A face is coloured by `fill`, per-corner `cornerFills`, a texture, a `bg` (a shadow decal or
// a signage card carries its backdrop colour there and no fill at all), or is a `card` outright.
const hasFill = (f) => typeof f.fill === 'string' || Array.isArray(f.cornerFills) || typeof f.texture === 'string' || typeof f.bg === 'string' || f.card != null;
const hasNormal = (f) => isVec(f.outNormal, 3);
const hasMaterialIdentity = (f) => Array.isArray(f.pbr) || typeof f.material === 'string' || typeof f.texture === 'string' || f.emissive != null;

/** The walk seat in one shape, tolerant of the three authored spellings. */
function walkSeat(walk) {
  if (!walk || typeof walk !== 'object') return null;
  const eye = [walk.eye, walk.eyeHeight, walk.minEye].find(Number.isFinite);
  const spawn = [walk.spawn, walk.start].find((s) => isVec(s, 2));
  return { eye: Number.isFinite(eye) ? eye : null, spawn: spawn || null };
}

/**
 * assessWorldTier(payload, { walkable }) →
 *   { tier, next, missing: { T0: [...], … }, missing_for_next, measured, advisories }
 *
 * `tier` is the highest tier whose declarations (and every lower tier's) are all present,
 * or null when T0 itself is not met. `walkable` defaults to "the payload carries a walk
 * seat"; pass it explicitly for a kind the runtime walks by default, so a missing seat is
 * named rather than excused. Every `missing` entry reads `declaration — reason`.
 */
export function assessWorldTier(payload = {}, { walkable = Boolean(payload && payload.walk) } = {}) {
  const faces = Array.isArray(payload.faces) ? payload.faces.filter((f) => f && Array.isArray(f.corners) && f.corners.length >= 3) : [];
  const lights = Array.isArray(payload.lights) ? payload.lights.filter(Boolean) : [];
  const mpuRaw = payload.metersPerUnit;
  const mpuDeclared = Number.isFinite(Number(mpuRaw)) && Number(mpuRaw) > 0;
  const mpu = mpuDeclared ? Number(mpuRaw) : 1;
  const seat = walkSeat(payload.walk);
  const missing = { T0: [], T1: [], T2: [], T3: [], T4: [] };

  // ── measured, once ────────────────────────────────────────────────────────────────────────
  let filled = 0, normals = 0, material = 0, openings = 0;
  const texKeys = new Set();
  let wx0 = Infinity, wy0 = Infinity, wz0 = Infinity, wx1 = -Infinity, wy1 = -Infinity, wz1 = -Infinity;
  for (const f of faces) {
    if (hasFill(f)) filled += 1;
    if (hasNormal(f)) normals += 1;
    if (hasMaterialIdentity(f)) material += 1;
    if (isOpening(f)) openings += 1;
    if (typeof f.texture === 'string') texKeys.add(f.texture);
    const b = faceBounds(f);
    if (b.x0 < wx0) wx0 = b.x0; if (b.x1 > wx1) wx1 = b.x1;
    if (b.y0 < wy0) wy0 = b.y0; if (b.y1 > wy1) wy1 = b.y1;
    if (b.z0 < wz0) wz0 = b.z0; if (b.z1 > wz1) wz1 = b.z1;
  }
  const measured = {
    faces: faces.length,
    filled_pct: pct(filled, faces.length),
    out_normal_pct: pct(normals, faces.length),
    material_identity_pct: pct(material, faces.length),
    lights: lights.length,
    openings,
    metersPerUnit: mpuDeclared ? mpu : null,
    eye_m: seat && seat.eye != null ? Math.round(seat.eye * mpu * 1000) / 1000 : null,
    ceiling_over_spawn: false,
    floor_under_spawn: false,
  };

  // spawn-relative reads: a floor under the feet, a ceiling over the head
  if (seat && seat.spawn) {
    const [sx, sy] = seat.spawn;
    const feetZ = Number.isFinite(seat.spawn[2]) ? seat.spawn[2] : 0;
    const eye = seat.eye != null ? seat.eye : 0;
    const tol = Math.max(0.25 * eye, 0.05);
    const eps = 1e-6;
    for (const f of faces) {
      if (isOpening(f)) continue;
      const b = faceBounds(f);
      if (sx < b.x0 - eps || sx > b.x1 + eps || sy < b.y0 - eps || sy > b.y1 + eps) continue;
      if (b.z1 <= feetZ + tol) measured.floor_under_spawn = true;
      if (eye > 0 && b.z0 > feetZ + eye) measured.ceiling_over_spawn = true;
      if (measured.floor_under_spawn && measured.ceiling_over_spawn) break;
    }
  }

  // ── T0 coherent ──────────────────────────────────────────────────────────────────────────
  if (!faces.length) missing.T0.push('faces — none');
  else if (filled < faces.length) missing.T0.push(`fills — ${faces.length - filled} of ${faces.length} faces carry no fill`);
  if (walkable) {
    if (!seat) missing.T0.push('walk_seat — no walk seat (eye + spawn) on a walkable kind; the runtime default of 1.6 is not a declaration');
    else {
      if (seat.eye == null) missing.T0.push('walk_seat — walk carries no eye height');
      if (!seat.spawn) missing.T0.push('walk_seat — walk carries no spawn');
    }
    if (seat && seat.spawn && faces.length && !measured.floor_under_spawn) missing.T0.push('floor_under_spawn — no face at or below the feet under the spawn point');
  }
  if (mpuRaw != null && !mpuDeclared) missing.T0.push(`units_valid — metersPerUnit ${JSON.stringify(mpuRaw)} is not a positive number`);

  // ── T1 baked ─────────────────────────────────────────────────────────────────────────────
  if (faces.length && normals < faces.length) missing.T1.push(`out_normals — ${measured.out_normal_pct}% of faces carry outNormal (a bake reads winding from it)`);
  if (!lights.length) missing.T1.push('lights — none declared (positioned fixtures, or the vexar sun as a directional entry)');
  else {
    const bad = lights.filter((l) => !LIGHT_TYPES.has(l.type) || !isVec(l.color, 3) || !Number.isFinite(l.intensity)
      || ((l.type === 'point' || l.type === 'spot') && !isVec(l.position, 3))
      || (l.type === 'directional' && !isVec(l.direction, 3)));
    if (bad.length) missing.T1.push(`lights — ${bad.length} of ${lights.length} lack the KHR_lights_punctual shape (type, color, intensity, position or direction)`);
  }

  // ── T2 transported ───────────────────────────────────────────────────────────────────────
  if (walkable && seat && seat.eye != null) {
    const eyeM = seat.eye * mpu;
    if (eyeM < EYE_MIN_M || eyeM > EYE_MAX_M) {
      missing.T2.push(`eye_plausible — walker eye ${Math.round(eyeM * 100) / 100} m after metersPerUnit ${mpu}; a person's is ${EYE_MIN_M}–${EYE_MAX_M} m (declare the authoring unit)`);
    }
  }
  if (lights.length && faces.length) {
    const pad = 0.1 * Math.max(wx1 - wx0, wy1 - wy0, wz1 - wz0, 1e-9);
    const out = lights.filter((l) => (l.type === 'point' || l.type === 'spot') && isVec(l.position, 3)
      && (l.position[0] < wx0 - pad || l.position[0] > wx1 + pad || l.position[1] < wy0 - pad || l.position[1] > wy1 + pad || l.position[2] < wz0 - pad || l.position[2] > wz1 + pad));
    if (out.length) missing.T2.push(`lights_positioned — ${out.length} of ${lights.length} positioned lights sit outside the world's bounds`);
  } else if (!lights.length) missing.T2.push('lights_positioned — no lights to position');
  const rigs = payload.figures && typeof payload.figures === 'object' ? Object.values(payload.figures).filter((f) => f && f.rig === true) : [];
  if (rigs.length && !rigs.some((f) => f.clips && typeof f.clips === 'object' && (f.clips.idle || f.clips.forward || f.clips.walk))) {
    missing.T2.push(`locomotion_row — ${rigs.length} rig figure(s) carry no idle / forward clip; a kernel cannot make them move`);
  }

  // ── T3 materialized ──────────────────────────────────────────────────────────────────────
  if (faces.length && material < faces.length) missing.T3.push(`material_identity — ${measured.material_identity_pct}% of faces name a material (pbr / material / texture / emissive); the rest are the exporter's default`);
  const texTable = payload.textures && typeof payload.textures === 'object' ? payload.textures : {};
  const unresolved = [...texKeys].filter((k) => !texTable[k]);
  if (unresolved.length) missing.T3.push(`textures_resolved — ${unresolved.length} texture key(s) resolve to no asset: ${unresolved.slice(0, 3).join(', ')}${unresolved.length > 3 ? ', …' : ''}`);

  // ── T4 physical ──────────────────────────────────────────────────────────────────────────
  if (!lights.length) missing.T4.push('lights_physical — no lights');
  else {
    const weak = lights.filter((l) => !(Number.isFinite(l.intensity) && l.intensity > 0)
      || (l.type === 'spot' && !(Number.isFinite(l.innerCone) && Number.isFinite(l.outerCone))));
    if (weak.length) missing.T4.push(`lights_physical — ${weak.length} of ${lights.length} lack a physical intensity (candela / lux) or, for a spot, both cones`);
  }
  if (!mpuDeclared) missing.T4.push('units_declared — metersPerUnit is inferred (absent ⇒ metres); T4 declares every physical quantity');

  // ── the ladder ───────────────────────────────────────────────────────────────────────────
  let tier = null, next = null;
  for (const t of WORLD_TIERS) {
    if (missing[t.id].length) { next = t.id; break; }
    tier = t.id;
  }
  const advisories = [];
  if (walkable && measured.ceiling_over_spawn && !lights.length && !openings) advisories.push('imports_dark');

  return { tier, next, missing, missing_for_next: next ? missing[next] : [], measured, advisories };
}

/** tierName(id) → the tier's word, for notes. */
export function tierName(id) {
  const t = WORLD_TIERS.find((x) => x.id === id);
  return t ? t.name : null;
}

/**
 * contractLedgerEntry(assessment) → the honest-loss ledger row every engine pack carries
 * (W1): what the payload declares, and what the next tier would need. One line, no refusal.
 */
export function contractLedgerEntry(a) {
  const declares = a.tier ? `${a.tier} (${tierName(a.tier)})` : 'below T0';
  const note = a.next
    ? `declares ${declares}; for ${a.next} (${tierName(a.next)}): ${a.missing_for_next.join('; ')}`
    : `declares ${declares} — every tier's declarations are present; attainment is each gate's to stamp`;
  return {
    tier: a.tier, next: a.next, missing_for_next: a.missing_for_next,
    ...(a.advisories.length ? { advisories: a.advisories } : {}),
    note: a.advisories.includes('imports_dark')
      ? `${note}. imports_dark: a ceiling over the spawn, no lights, no openings — add fixtures, open the roof, or export unlit`
      : note,
  };
}
