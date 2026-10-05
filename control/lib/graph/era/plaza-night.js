/**
 * The plaza at NIGHT (`time: 'night'` on a stage whose style card carries a `night`): what the square adds when the
 * sun is down and the moon is the key. Placed light makes the picture: lanterns by the doors and hanging in the
 * portico's bays, a glow in the fountain's basin, and some windows lit (a warm pane and a little light spilled on the
 * sill below). Every light here is baked like the nave's torches; the lanterns' panes are self-lit and carry a halo.
 *
 * Reads the style card's `night`: { lantern, portico, fountain, windows }. Dice are hash3; nothing here is random.
 */
import { add, mul, sub, dot, P, hexRgb, box, onWall, wallFrame } from './geom.js';
import { hash3 } from './dirt.js';

const IRON = '#26221e';
const plain = { key: null, scale: 1, tint: [1, 1, 1] };

/** A lantern hanging at `at` (the top of its cap): an iron cap and floor, four glowing panes, a halo on one. */
export function lanternFaces(at, L) {
  const out = [], [x, y, z] = at, w = L.size[0] / 2, h = L.size[1];
  const iron = (mn, mx) => { const raw = []; box(raw, mn, mx, plain, 1); for (const { texture, textureLit, uv, tint, ...f } of raw) out.push({ ...f, fill: IRON, group: 'stage:fixture' }); };
  iron([x - w - 0.03, y - w - 0.03, z - 0.07], [x + w + 0.03, y + w + 0.03, z]);            // the cap
  iron([x - w - 0.02, y - w - 0.02, z - h - 0.05], [x + w + 0.02, y + w + 0.02, z - h]);    // the floor
  const z0 = z - h, z1 = z - 0.07, glass = hexRgb(L.glass);
  const panes = [[[1, 0, 0], [0, 1, 0]], [[-1, 0, 0], [0, -1, 0]], [[0, 1, 0], [-1, 0, 0]], [[0, -1, 0], [1, 0, 0]]];
  panes.forEach(([n, u], i) => {
    const c = [x + n[0] * w, y + n[1] * w], p = (s, zz) => P([c[0] + u[0] * s, c[1] + u[1] * s, zz]);
    out.push({ corners: [p(-w, z0), p(w, z0), p(w, z1), p(-w, z1)], normal: n, outNormal: n, fill: L.glass, group: 'stage:lantern', emissive: glass, emissiveStrength: 3,
      ...(i === 0 ? { glow: `0 0 10px 4px ${L.color}` } : {}) });
  });
  return out;
}

/** An iron bracket from the wall point `wall` out to the lantern's hook at `hook`, and the hanger down to its cap. */
function bracketFaces(wall, hook, capTop) {
  const out = [], raw = [];
  box(raw, [Math.min(wall[0], hook[0]) - 0.02, Math.min(wall[1], hook[1]) - 0.02, hook[2] - 0.02], [Math.max(wall[0], hook[0]) + 0.02, Math.max(wall[1], hook[1]) + 0.02, hook[2] + 0.02], plain, 1);
  box(raw, [hook[0] - 0.012, hook[1] - 0.012, capTop], [hook[0] + 0.012, hook[1] + 0.012, hook[2]], plain, 1);
  for (const { texture, textureLit, uv, tint, ...f } of raw) out.push({ ...f, fill: IRON, group: 'stage:fixture' });
  return out;
}

/**
 * The night's lights (baked, the stage's light shape) and fixtures, and `relight(face)`: a lit window's pane.
 * houses: the shell's house records; portico: plazaPortico's result (or null); site: plazaSite's.
 */
export function plazaNight(plan, houses, portico, site) {
  const N = plan.night, H = plan.kit.house, lights = [], faces = [], r = site.r;
  const porticoO = portico ? wallFrame(r, plan.kit.dress.portico.side).o.join() : null;
  const light = (at, n, L, fixture) => lights.push({ at: P(at), n, color: L.color, intensity: L.intensity, radius: L.radius, fixture });
  // a lantern by each door (not those under the portico, whose bays carry their own), on a side the dice choose
  const La = N.lantern;
  houses.forEach((h, i) => {
    if (h.F.o.join() === porticoO || hash3(i, 7, 6101) > La.share) return;
    const side = hash3(i, 7, 6103) < 0.5 ? -1 : 1, u = h.door.mid + side * (h.door.dw + La.beside), zc = h.door.top + La.z;
    const hook = onWall(h.F, u, La.out, zc), cap = zc - 0.12;
    faces.push(...bracketFaces(onWall(h.F, u, 0, zc), hook, cap), ...lanternFaces([hook[0], hook[1], cap], La));
    light([hook[0], hook[1], cap - La.size[1] / 2], h.F.N, La, 'lantern');
  });
  // lanterns hanging in the portico's bays, every `every`th bay, on a chain from the vault
  if (portico && N.portico) {
    const Lp = { ...La, ...N.portico }, F = portico.F, cols = portico.cols;
    for (let i = 0; i + 1 < cols.length; i += Lp.every) {
      const u = (cols[i] + cols[i + 1]) / 2, top = portico.ceiling, cap = top - Lp.drop;
      const p = onWall(F, u, Lp.out, cap);
      faces.push(...bracketFaces(onWall(F, u, Lp.out, top), onWall(F, u, Lp.out, top), cap), ...lanternFaces(p, Lp));
      light([p[0], p[1], cap - Lp.size[1] / 2], [0, 0, -1], Lp, 'lantern');
    }
  }
  // the fountain's basin glows from under the water: the set piece is still where the eye lands
  if (N.fountain) {
    const c = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    light([c[0], c[1], N.fountain.z], [0, 0, 1], N.fountain, 'basin');
  }
  // some windows lit: a warm pane, and its light spilled on the sill and the wall below
  const W = N.windows, lit = [];
  houses.forEach((h, i) => h.windows.forEach((w, j) => {
    if (hash3(i, j, 6107) >= W.lit) return;
    lit.push({ F: h.F, u0: w.c - w.hw - 0.01, u1: w.c + w.hw + 0.01, z0: w.sill - 0.01, z1: w.sill + H.window.h + 0.01 });
    light(onWall(h.F, w.c, W.out, w.sill + 0.55), h.F.N, W, 'window');
  }));
  const pane = hexRgb(W.glow);
  const relight = (f) => {
    if (f.group !== 'stage:glass') return f;
    const c = mul(f.corners.reduce((s, q) => add(s, q), [0, 0, 0]), 1 / f.corners.length);
    const hit = lit.find((L) => { const d = sub(c, L.F.o), u = dot(d, L.F.U), off = dot(d, L.F.N); return u > L.u0 && u < L.u1 && c[2] > L.z0 && c[2] < L.z1 && off < 0.05 && off > -1; });
    return hit ? { ...f, fill: W.color, emissive: pane, emissiveStrength: 1.4 } : f;
  };
  return { lights, faces, relight };
}
