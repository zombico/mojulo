// equipment/shapes — the few shapes every item is made of, as workbench monomer specs.
//
//   ribbon    a tapered loft along any path, flat (a feather, a leaf, a crescent, a bow limb) or round (a branch, a
//             claw prong): the line primitive with a changing section that no single monomer gives
//   feather   one wing feather, rooted where it should point back at the focal
//   setStone  law 3: a stone and its setting (a boss through the host, a bezel lip touching the girdle, the stone
//             seated a little proud), on one face or both
//
// Loft frames: on a path of more than two points the loft puts profile u across the path's rotation-minimizing
// normal. For a path running up z that is y, so a flat section that should lie in the xz plane takes `roll: 90`.
import { mulberry32 } from '../vegetation/grow.js';
import { crystalGirdle } from '../polygonizer/crystal-optics.js';

export { mulberry32 };
export const r3 = (v) => Math.round(v * 1000) / 1000;
export const P = (x, y, z) => ({ x: r3(x), y: r3(y), z: r3(z) });
export const A = (x, y, z) => [r3(x), r3(y), r3(z)];
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
// a role is a shelf row ['<material>', '#hex'] or a metal surface { metal, finish?, along?, film? } (materials/metal-surface.js),
// which carries its own colour from measured optics
export const mat = (role) => (Array.isArray(role) ? { material: role[0], tint: role[1] } : { material: role });

/** A closed circle of n segments in the xz, xy or yz plane (first point repeated last). */
export function circle(c, r, n, plane = 'xz') {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n, u = r * Math.cos(a), v = r * Math.sin(a);
    out.push(plane === 'xz' ? A(c[0] + u, c[1], c[2] + v) : plane === 'xy' ? A(c[0] + u, c[1] + v, c[2]) : A(c[0], c[1] + u, c[2] + v));
  }
  return out;
}

/** Append each non-empty monomer array of `part` onto `m`. */
export function mergeInto(m, part) { for (const [k, v] of Object.entries(part)) if (Array.isArray(v) && v.length) (m[k] ||= []).push(...v); }
export const push = (m, k, v) => (m[k] ||= []).push(v);

/** A tapered loft along `path`; `w(t)` / `h(t)` are the half-width and half-thickness, floored at minF / 2 (law 4). */
export function ribbon({ path, w, h, roll = 90, role, group, minF, round = false }) {
  const n = path.length, stations = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), ww = Math.max(minF / 2, w(t)), hh = Math.max(minF / 2, h(t));
    const prof = round ? Array.from({ length: 8 }, (_, k) => [ww * Math.cos((k * Math.PI) / 4), ww * Math.sin((k * Math.PI) / 4)])
      : [[ww, 0], [ww * 0.5, hh], [-ww * 0.5, hh], [-ww, 0], [-ww * 0.5, -hh], [ww * 0.5, -hh]];
    stations.push({ t: r3(t), roll, profile: prof.map(([u, v]) => [r3(u), r3(v)]) });
  }
  return { group, path: path.map((p) => A(...p)), stations, ...mat(role) };
}

/** One wing feather: a flat loft along an up-curving arc, broad at the root, pointed at the tip. `s` is ±1 (side). */
export function feather({ s, root, len, rise, width, thick, role, minF, group = 'guard' }) {
  const n = 10, path = [], stations = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    path.push(A(root[0] + s * len * t, root[1], root[2] + rise * len * (t * t * 0.9 + 0.1 * t)));
    const w = Math.max(minF, width * (1 - 0.85 * t ** 1.4) * (t < 0.1 ? 0.75 + 2.5 * t : 1)), h = Math.max(minF / 2, thick * (1 - 0.6 * t));
    stations.push({ t: r3(t), roll: 90, profile: [[w, 0], [0, h], [-w, 0], [0, -h]].map(([u, v]) => [r3(u), r3(v)]) });
  }
  return { group, path, stations, ...mat(role) };
}

/**
 * Where a setting grips `gem` of `size`: the stone's girdle (polygonizer/crystal-optics.js crystalGirdle), in its own
 * frame. A setting places the stone so its girdle lands on the grip, never by a guessed radius: a raw prism is long and
 * thin, a brilliant's girdle sits above its centre, a cabochon's is its base.
 */
export function girdleOf(gem, size) { return crystalGirdle(gem.gem, { size, cut: gem.cut || 'brilliant' }); }

/** Law 3, the cut follows the setting: a face setting (a bezel) takes a cut stone — a raw crystal reads as a speck
 *  set face-on, so `natural` becomes a cabochon there. Cradles (a cage, a claw, branches) take any cut. */
export const faceCut = (gem) => (gem.cut === 'natural' ? { ...gem, cut: 'cabochon' } : gem);

/**
 * Law 3: a stone and its setting on the host at `at`, facing ±`axis`. A boss (a lathe through the host) when the
 * stone is stylized, and on each face a bezel lip in the face plane wrapping the girdle, the stone seated so its
 * girdle lies in that plane and its crown stands proud.
 */
export function setStone({ at, axis, st, gem, roles, group, both = true, bossDepth }) {
  const out = { lathes: [], fields: [] };
  gem = faceCut(gem);
  const g = girdleOf(gem, st.size);
  const [ax, ay, az] = axis; const faces = both ? [1, -1] : [1];
  const along = (c, d) => [c[0] + ax * d, c[1] + ay * d, c[2] + az * d];
  if (st.setting === 'boss') {
    const a0 = along(at, -bossDepth), a1 = along(at, bossDepth);
    out.lathes.push({ group, axisFrom: P(...a0), axisTo: P(...a1), profile: [{ t: 0, radius: r3(st.bossR * 0.86) }, { t: 0.18, radius: r3(st.bossR) }, { t: 0.82, radius: r3(st.bossR) }, { t: 1, radius: r3(st.bossR * 0.86) }], samples: 48, ...mat(roles.fittings) });
  }
  const face = st.setting === 'boss' ? bossDepth : bossDepth * 0.6;
  for (const s of faces) {
    const c = along(at, s * face);
    const plane = Math.abs(ay) > 0.9 ? 'xz' : Math.abs(az) > 0.9 ? 'xy' : 'yz';
    out.fields.push({ group, cells: 40, terms: [
      { id: 'bezel', op: 'add', shape: { kind: 'sweep', path: circle(c, g.radius + st.bezel * 0.35, 40, plane), radius: r3(st.bezel) } },
      { id: 'stone', op: 'add', shape: { kind: 'crystal', gem: gem.gem, cut: gem.cut, center: A(...along(c, -s * g.z)), size: r3(st.size), axis: [ax * s, ay * s, az * s], ...(gem.glow ? { glow: r3(Math.min(1, gem.glow)) } : {}) } },
    ], ...mat(roles.accent) });
  }
  return out;
}
