/**
 * MOUNT UNITS — a world's horses (`mounts`: a controllable world's, or a gameworld level's lowered onto it) laid on the
 * world it is resolved into, and the hero who rides them taught to: each horse a body on the `ride` rule with its `mount`
 * (worlds/controllable/mount.js: where its rider stands to get on, its getting-on and -off clips), drawn by its coat's
 * figure (lib/graph/mount/game.js mountRide: one welded skin the page binds to its bones); the pilot's hero given its
 * riding clips, solved on its own rig to this horse's tack, and marked as one that `rides`. The solve is built here, not
 * stored, once per rider and coats, and kept.
 *
 *   readMounts(raw)                   → the key read: [{ at: [x, y, z?], heading?, coat? }] (a bare count lays that many
 *                                       bays beside the spawn), or a thrown error saying what is wrong; absent ⇒ null
 *   mountRider(mounts, { R, dz })     → the riding clips for a hero's rig (its layered pack's `ride` hook), the solve kept
 *   lowerMounts(payload, mounts, sol) → the horses laid after the world's own entities, their figures beside them, the
 *                                       rider marked; `sol` the solve the hero's hook made, or none (no hero rides: the
 *                                       horses stand loose, no one to get on)
 */
import { COATS } from '../mount/coats.js';

const SOLVES = new Map();
const key = (mounts, R, dz) => JSON.stringify([coatsOf(mounts), dz, R ? R.bones?.map((b) => b.id) : null, R ? Object.entries(R.joints || {}).map(([k, v]) => [k, v.map((x) => Math.round(x * 1e4))]) : null]);
const coatsOf = (mounts) => [...new Set(mounts.map((m) => m.coat ?? 'bay'))];

export function readMounts(raw) {
  if (raw == null) return null;
  const bad = (m) => new Error(`mounts: ${m}`);
  if (Number.isInteger(raw)) {
    if (raw < 1 || raw > 8) throw bad('a count is 1 to 8 horses');
    return Array.from({ length: raw }, (_, i) => ({ beside: i }));
  }
  if (!Array.isArray(raw) || !raw.length) throw bad('a list of horses ({ at: [x, y], heading?, coat? }) or a count');
  if (raw.length > 8) throw bad('at most 8 horses');
  return raw.map((m, i) => {
    if (!m || typeof m !== 'object') throw bad(`[${i}] is { at: [x, y], heading?, coat? }`);
    if (m.at !== undefined && !(Array.isArray(m.at) && (m.at.length === 2 || m.at.length === 3) && m.at.every(Number.isFinite))) throw bad(`[${i}].at is [x, y] or [x, y, z] in metres`);
    if (m.heading !== undefined && !Number.isFinite(m.heading)) throw bad(`[${i}].heading is radians (0 faces +x)`);
    if (m.coat !== undefined && !COATS[m.coat]) throw bad(`[${i}].coat is one of ${Object.keys(COATS).join(', ')}`);
    return { ...(m.at ? { at: m.at.slice() } : { beside: i }), ...(m.heading !== undefined ? { heading: m.heading } : {}), ...(m.coat ? { coat: m.coat } : {}) };
  });
}

export async function mountRider(mounts, rider = null) {
  const k = key(mounts, rider?.R ?? null, rider?.dz ?? 0);
  if (!SOLVES.has(k)) {
    const { mountRide } = await import('../mount/game.js');
    SOLVES.set(k, mountRide(rider, { coats: coatsOf(mounts) }));
  }
  return SOLVES.get(k);
}

/** the same solve, synchronously, for the layered packer's hook (it is called inside a resolve that cannot wait) */
export function mountRiderSync(mounts, rider, mountRide) {
  const k = key(mounts, rider?.R ?? null, rider?.dz ?? 0);
  if (!SOLVES.has(k)) SOLVES.set(k, mountRide(rider, { coats: coatsOf(mounts) }));
  return SOLVES.get(k);
}

export async function lowerMounts(payload, mounts, sol = null, { riderId = null } = {}) {
  if (!payload || !mounts?.length) return payload;
  const S = sol ?? await mountRider(mounts, null);
  const ents = payload.entities || [];
  const spawn = (riderId && ents.find((e) => e && e.id === riderId)) || ents.find((e) => e && e.pilotable) || null;
  const s0 = spawn?.transform?.pos ?? [0, 0, 0], h0 = spawn?.transform?.heading ?? 0;
  const horses = mounts.map((m, i) => {
    // (a horse laid beside the spawn: three metres to its right and a little ahead, each further one two metres on)
    const at = m.at ?? (() => { const r = [Math.cos(h0 - Math.PI / 2), Math.sin(h0 - Math.PI / 2)], f = [Math.cos(h0), Math.sin(h0)], d = 3 + 2 * (m.beside ?? i); return [s0[0] + r[0] * d + f[0] * 1.5, s0[1] + r[1] * d + f[1] * 1.5, s0[2] ?? 0]; })();
    return {
      // (no one to ride them: they stand loose, never offered, reach 0)
      id: `mount-${i + 1}`, mount: S.mount ?? { reach: 0 }, rule: S.rule,
      body: { type: 'figure-rig', figure: `mount:${m.coat ?? 'bay'}` },
      transform: { pos: [at[0], at[1], at[2] ?? 0], heading: m.heading ?? h0 },
    };
  });
  payload.entities = [...ents, ...horses];
  payload.figures = { ...(payload.figures || {}), ...Object.fromEntries(Object.entries(S.figures).map(([c, f]) => [`mount:${c}`, f])) };
  if (sol && riderId) { const r = payload.entities.find((e) => e && e.id === riderId); if (r) r.rides = true; }
  payload.nonBakeable = true;
  return payload;
}
