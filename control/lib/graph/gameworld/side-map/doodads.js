/**
 * THE ICING'S DOODADS (the cake, cake.js: icing can be layered on): what stands on a slice's icing and blocks nothing,
 * never a collider, at three DEPTHS so the side map's camera parallaxes them against the lane:
 *
 *   back        on the top's rear, behind where the hero walks (the hero passes in front): pipes along a bay, a vent
 *               stack, a crate, an urn, a broken column, a boulder, a snow lump, a lamp on its post
 *   lip         on the front edge of the icing, low enough never to hide the hero's feet: pebbles, tufts, a cable's
 *               loop, and under the icing's lip the icicles that hang from it (snow)
 *   foreground  in front of the lane, darker, its top never over the top it stands before (under the hero's feet line,
 *               the side strip's law): girders, rock hummocks, a block of fallen stone, a snowdrift
 *
 * A material's own set (DOODADS, a row a material), on the cap's module grid in the bays' rhythm: an A bay carries its
 * set, a B bay rests; never within a lip's reach of a pit. Data the build draws as boxes (scene.js) and lights as the
 * lane (light.js); nothing here is a collider.
 *
 *   DOODADS, DOODAD_DEPTHS, LIP_MAX
 *   doodadsOf(layout, dress) → [{ zone, kind, depth, s, z, top, w, fill, x0, x1, on }]   (x0..x1 its depth across the
 *                         lane; z..top its height; on the top it stands on or before)
 *   the foreground a dark silhouette (its tone mostly its own, the light leaves it: light.js keeps it), a hummock, a drift
 *   or a fallen block stepped up to its top, a girder a frame of two posts and a beam
 *
 *   doodadFaults(layout, doodads) → [{ zone, says }]   the laws' `doodads`: none sunk in a closed part, none by a pit,
 *                         every lip thing under LIP_MAX of the hero, every foreground thing's top under the top it stands
 *                         before (the hero's feet line)
 *
 * Pure: no dice. The same map, the same doodads.
 */
export const DOODAD_DEPTHS = Object.freeze({ back: [-1.45, -0.55], lip: [1.15, 1.45], foreground: [3.2, 4.6] });
// (a lip thing hung under the icing hangs on the slice's face, a hair proud of it: the lane is ±1.5 across)
const FACE_X = 1.5, HUNG = [FACE_X + 0.02, FACE_X + 0.14];
/** How low a lip thing stays (a share of the hero's height): it never hides the feet it stands beside. */
export const LIP_MAX = 0.12;
// a material's set: each a kind, its depth, its size (w along, h up, d across), its tone (a mix of the zone's key toward a
// colour), and how far into a bay it stands (a share of the bay's width): one entry a place in an A bay
const T = (kind, depth, w, h, d, tone, at) => Object.freeze({ kind, depth, w, h, d, tone, at });
export const DOODADS = Object.freeze({
  kibble: [T('pipe-run', 'back', 6, 0.3, 0.3, ['#b8c4d0', 0.5], 0.3), T('vent-stack', 'back', 0.6, 1.3, 0.6, ['#202830', 0.35], 0.62), T('crate', 'back', 0.9, 0.9, 0.9, ['#8a6a3a', 0.45], 0.78), T('cable-loop', 'lip', 1.2, 0.12, 0.2, ['#101418', 0.6], 0.5), T('girder', 'foreground', 3.2, -0.8, 0.4, ['#0c0e12', 0.15], 0.45)],
  plate: [T('crate', 'back', 1.1, 1.1, 1.1, ['#4a5560', 0.5], 0.35), T('beacon-post', 'back', 0.15, 1.6, 0.15, ['#e0e6ec', 0.4], 0.7), T('bolt-row', 'lip', 1.6, 0.08, 0.2, ['#1a1e24', 0.6], 0.5), T('girder', 'foreground', 3.2, -0.8, 0.4, ['#0c0e12', 0.15], 0.5)],
  masonry: [T('urn', 'back', 0.6, 0.8, 0.6, ['#a8744a', 0.45], 0.3), T('column-stub', 'back', 0.8, 1.2, 0.8, ['#e8dcc4', 0.35], 0.68), T('rubble', 'lip', 0.5, 0.2, 0.3, ['#6a6058', 0.5], 0.5), T('fallen-block', 'foreground', 2.2, -0.6, 1, ['#141210', 0.15], 0.4)],
  padded: [T('crate', 'back', 0.9, 0.9, 0.9, ['#d0c0a0', 0.35], 0.4), T('cushion-stack', 'back', 1.2, 0.5, 0.9, ['#e8e0f0', 0.3], 0.7)],
  rock: [T('boulder', 'back', 1.1, 0.8, 0.9, ['#5a5048', 0.45], 0.3), T('tuft', 'lip', 0.5, 0.18, 0.15, ['#4a7a3a', 0.55], 0.55), T('pebbles', 'lip', 0.6, 0.12, 0.25, ['#7a7068', 0.5], 0.8), T('hummock', 'foreground', 3.6, -0.5, 1.2, ['#141a10', 0.15], 0.5)],
  snow: [T('snow-lump', 'back', 1.2, 0.5, 0.9, ['#f4f8ff', 0.2], 0.35), T('icicles', 'lip', 1.5, -0.45, 0.1, ['#d8f0ff', 0.25], 0.6), T('drift', 'foreground', 4, -0.4, 1.2, ['#5a6478', 0.25], 0.5)],
});
const r3 = (v) => Math.round(v * 1000) / 1000;
const mix = (hex, to, k) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** The doodads on a laid, dressed map's icing. */
export function doodadsOf(layout, dress) {
  const L = layout, out = [], pits = L.gaps.filter((g) => g.kind !== 'wall');
  const nearPit = (s, w) => pits.some((g) => s + w / 2 > g.s0 - 0.6 && s - w / 2 < g.s1 + 0.6);
  // the top a doodad stands on at s in a zone: the highest exposed floor top there
  // (and open over it: a top under a wall or a ceiling carries nothing)
  const openOver = (s, z) => L.open.some((o) => s >= o.s0 && s <= o.s1 && z + 0.5 >= o.z0 && z + 0.5 <= o.z1);
  const topAt = (zone, s) => {
    const r = L.solids.filter((q) => q.zone === zone && q.role !== 'ceiling' && q.s0 <= s && q.s1 >= s).reduce((m, q) => (m === null || q.z1 > m.z1 ? q : m), null);
    return r && openOver(s, r.z1) ? r : null;
  };
  for (const z of dress.zones) {
    const set = DOODADS[z.material];
    if (!set || !z.bays || !z.seams) continue;
    const Z = L.zones[z.zone], bw = z.seams.length > 1 ? z.seams[1] - z.seams[0] : Z.rect[1] - Z.rect[0];
    z.bays.forEach((bay, k) => {
      if (bay !== 'A') return;
      const b0 = z.seams[k] - bw / 2;
      for (const D of set) {
        const s = b0 + D.at * bw, w = Math.min(D.w, bw * 0.4), top = topAt(z.zone, s);
        if (!top || nearPit(s, w) || s - w / 2 < top.s0 || s + w / 2 > top.s1) continue;
        const fill = mix(z.key, D.tone[0], 1 - D.tone[1]), hung = D.depth === 'lip' && D.h < 0;
        // (centred in its depth, never past it: a back thing stays on the top)
        const [x0, x1] = hung ? HUNG : ((a, b) => { const d = Math.min(D.d, b - a); return [(a + b) / 2 - d / 2, (a + b) / 2 + d / 2]; })(...DOODAD_DEPTHS[D.depth]);
        // (h < 0: hung under the icing's lip, or a foreground thing rising from below the frame to under the top it stands
        // before, its top a depth under the hero's feet line)
        const zb = hung ? top.z1 + D.h : D.depth === 'foreground' ? top.z0 : top.z1, zt = hung ? top.z1 - 0.34 : D.depth === 'foreground' ? top.z1 + D.h : top.z1 + D.h;
        out.push({ zone: z.zone, kind: D.kind, depth: D.depth, s: r3(s), z: r3(hung ? zb - 0.34 : zb), top: r3(zt), w: r3(w), fill, x0: r3(x0), x1: r3(x1), on: r3(top.z1) });
      }
    });
  }
  return out;
}

/** Where the doodads break their laws (laws.js `doodads`). */
export function doodadFaults(layout, doodads) {
  const L = layout, out = [], pits = L.gaps.filter((g) => g.kind !== 'wall'), r2 = (v) => Math.round(v * 100) / 100;
  for (const d of doodads) {
    const a = d.s - d.w / 2, b = d.s + d.w / 2, at = `zone ${d.zone}'s ${d.kind} at ${r2(d.s)} m`;
    if (d.depth === 'back' && L.solids.some((r) => Math.min(b, r.s1) - Math.max(a, r.s0) > 1e-3 && Math.min(d.top, r.z1) - Math.max(d.z, r.z0) > 1e-3)) out.push({ zone: d.zone, says: `${at} is sunk in a closed part` });
    if (pits.some((g) => b > g.s0 - 0.5 && a < g.s1 + 0.5)) out.push({ zone: d.zone, says: `${at} stands at a pit's lip` });
    if (d.depth === 'lip' && d.z >= d.on - 1e-3 && d.top - d.on > LIP_MAX * L.stature + 1e-3) out.push({ zone: d.zone, says: `${at} stands ${r2(d.top - d.on)} m over the lip, over the hero's feet` });
    if (d.depth === 'foreground' && d.top > d.on + 1e-3) out.push({ zone: d.zone, says: `${at} in the foreground rises over the top it stands before (the feet line)` });
  }
  return out;
}
