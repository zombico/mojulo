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

export { mulberry32 };
export const r3 = (v) => Math.round(v * 1000) / 1000;
export const P = (x, y, z) => ({ x: r3(x), y: r3(y), z: r3(z) });
export const A = (x, y, z) => [r3(x), r3(y), r3(z)];
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
export const mat = (role) => ({ material: role[0], tint: role[1] });

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
 * Law 3: a stone and its setting on the host at `at`, facing ±`axis`. A boss (a lathe through the host) when the
 * stone is stylized, a bezel lip on each face hugging the girdle, the stone seated a little proud of it.
 */
export function setStone({ at, axis, st, gem, roles, group, both = true, bossDepth }) {
  const out = { lathes: [], fields: [] };
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
      { id: 'bezel', op: 'add', shape: { kind: 'sweep', path: circle(c, st.r * 0.96, 40, plane), radius: r3(st.bezel) } },
      { id: 'stone', op: 'add', shape: { kind: 'crystal', gem: gem.gem, cut: gem.cut || 'cabochon', center: A(...along(c, s * st.size * 0.08)), size: r3(st.size), axis: [ax * s, ay * s, az * s], ...(gem.glow ? { glow: r3(Math.min(1, gem.glow)) } : {}) } },
    ], ...mat(roles.accent) });
  }
  return out;
}
