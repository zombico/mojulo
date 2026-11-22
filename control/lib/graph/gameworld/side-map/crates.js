/**
 * THE CRATES (a side map's `crates`, opt-in): breakable crates on the lane, what a run and gun's shots are for between
 * its foes. Each stands across the lane's middle, where the hero runs and its rounds fly, so it is in the way: hopped like
 * a step, or shot apart (a world's breakability, playscape/destruct/breakability.js: a crate breaks under `objects`).
 *
 *   WHERE        on a run's floor, in a bay that rests (a B bay: the A bays carry the icing's doodads, doodads.js), at its
 *                seam; never within a lip's reach of a pit or a step up the path, a door, a ladder's foot, a checkpoint or a
 *                spawner; with a body's headroom over it, so the hero can stand on it; at most PER_ZONE a run
 *   SIZE         CRATE m deep across the lane and CRATE_W along it, as tall as a hand over the muzzle (crateHeight: 0.7 of
 *                the hero, the buster's chest, and 0.15 m: every round it fires meets it, a tap's too), under its jump
 *
 *   CRATE, CRATE_W, crateHeight(stature), cratesOf(layout, dress, { stature }) → [{ id, zone, s0, s1, z0, z1 }]
 *   crateFaults(layout, crates, { stature, jump }) → [{ zone, says }]   the laws' `crates`
 *
 * Pure: no dice. The same map, the same crates.
 */
export const CRATE = 0.9, CRATE_W = 1.2;
const PER_ZONE = 2, CLEAR = 2, HALF = CRATE_W / 2;
/** A crate's height for a hero: a hand over its buster's muzzle (lower.js `chest` 0.7 of its height). */
export const crateHeight = (stature) => Math.round((stature * 0.7 + 0.15) * 1000) / 1000;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The crates on a laid, dressed map. */
export function cratesOf(layout, dress, { stature = 1.67 } = {}) {
  const L = layout, out = [], H = crateHeight(stature);
  const near = (s, list, d = CLEAR) => list.some((x) => Math.abs(x - s) < d);
  const marks = [...L.steps.filter((x) => Math.abs(x.dz) > 0.05).map((x) => x.s), ...L.doors.map((d) => d.at[0]), ...L.ladders.map((l) => l.foot[0]), ...L.spawners.map((sp) => sp.at[0])];
  const checkpoints = L.checkpoints.map((c) => c.at[0]);
  for (const z of dress.zones) {
    const Z = L.zones[z.zone];
    if (!z.bays || !z.seams || Z.run !== 'across') continue;
    let n = 0;
    z.bays.forEach((bay, k) => {
      if (bay !== 'B' || n >= PER_ZONE) return;
      const s = z.seams[k], F = L.solids.find((r) => r.zone === z.zone && r.role === 'floor' && s - HALF - 1.2 >= r.s0 && s + HALF + 1.2 <= r.s1);
      if (!F) return;
      const top = F.z1;
      if (L.gaps.some((g) => s + HALF > g.s0 - CLEAR && s - HALF < g.s1 + CLEAR)) return;
      if (near(s, marks) || near(s, checkpoints, 2.5)) return;
      // (a body's headroom over it, and nothing else standing where it stands)
      const room = L.open.find((o) => s >= o.s0 && s <= o.s1 && top + 0.1 >= o.z0 && top + 0.1 <= o.z1);
      if (!room || room.z1 < top + H + stature + 0.3) return;
      if (L.solids.some((r) => r !== F && s + HALF > r.s0 && s - HALF < r.s1 && top + H > r.z0 && top < r.z1)) return;
      out.push({ id: `crate-${z.zone}-${k}`, zone: z.zone, s0: r3(s - HALF), s1: r3(s + HALF), z0: r3(top), z1: r3(top + H) });
      n++;
    });
  }
  return out;
}

/** Where the crates break their laws (laws.js `crates`). */
export function crateFaults(layout, crates, { stature = 1.67, jump = null } = {}) {
  const L = layout, out = [], r2 = (v) => Math.round(v * 100) / 100;
  for (const c of crates) {
    const at = `zone ${c.zone}'s crate at ${r2((c.s0 + c.s1) / 2)} m`;
    if (jump !== null && c.z1 - c.z0 > jump) out.push({ zone: c.zone, says: `${at} stands ${r2(c.z1 - c.z0)} m, over the hero's jump (${r2(jump)} m)` });
    if (L.gaps.some((g) => c.s1 > g.s0 - 1 && c.s0 < g.s1 + 1)) out.push({ zone: c.zone, says: `${at} stands at a pit's lip` });
    const room = L.open.find((o) => c.s0 >= o.s0 - 1e-3 && c.s1 <= o.s1 + 1e-3 && c.z1 >= o.z0 && c.z1 <= o.z1);
    if (!room || room.z1 < c.z1 + stature) out.push({ zone: c.zone, says: `${at} leaves no room to stand on it` });
    if (!L.solids.some((r) => r.role === 'floor' && r.zone === c.zone && Math.abs(r.z1 - c.z0) < 1e-3 && r.s0 <= c.s0 && r.s1 >= c.s1)) out.push({ zone: c.zone, says: `${at} stands on no floor` });
  }
  return out;
}
