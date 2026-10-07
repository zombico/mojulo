/**
 * door — the first playscape archetype: a thing that closes a doorway and answers when used.
 *
 * One archetype, several FORMS; the world's setting picks the form (an iron-bound plank door in a crypt, a sliding slab
 * in a lab) and the doorway's own width and height size it. Each form is built in values only on the object groups
 * (laws.js), its parts named so the measures can find the 66, the 33 and the fill:
 *
 *   body     the main mass (the 66)                       obj:body
 *   fill     what shades the 66 in: grooves, straps, lines  obj:fill
 *   detail   the primary detail (the 33)                  obj:detail
 *   handle   what you use: the accent                      obj:status
 *
 * States: closed, open (the plank swings 90° on its hinge side toward +N, the slab's halves slide into the wall),
 * locked (closed, the status lit). A form is a function of its numbers; `params(fit)` gives the numbers a doorway
 * implies and eject (index.js) freezes them, so an ejected door is edited by number and no longer follows the world.
 */
import { add, mul, P, r5 } from '../../era/geom.js';
import { obox } from '../../era/props.js';
import { compose, deed } from '../../worlds/game-idioms.js';

const Z = [0, 0, 1];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// one value-only surface: no texture, a grey tint, the group a tone colours
const surf = (group, v) => ({ key: null, scale: 1, tint: [v, v, v], group });

// a box in the door's own frame: u along the width (from the opening's middle), n toward the front, z up from the sill
function part(out, name, group, v, F, [u, n, z], [hu, hn, hz]) {
  const from = out.length;
  obox(out, add(add(add(F.at, mul(F.U, u)), mul(F.N, n)), mul(Z, z)), F.N, F.U, Z, [hn, hu, hz], surf(group, v), F.cell || 8);
  F.pieces = (F.pieces || 0) + 1;   // each box its own piece: a shape style twists pieces one by one
  for (let i = from; i < out.length; i++) Object.assign(out[i], { part: name, piece: F.pieces, value: v });
}

// turn a built leaf's faces about a vertical hinge line (through `pivot`) by `a` radians
function swing(faces, pivot, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const rot = (p) => { const x = p[0] - pivot[0], y = p[1] - pivot[1]; return [pivot[0] + c * x - s * y, pivot[1] + s * x + c * y, p[2]]; };
  const rotN = (n) => [c * n[0] - s * n[1], s * n[0] + c * n[1], n[2]];
  for (const f of faces) { f.corners = f.corners.map((p) => P(rot(p))); f.normal = f.outNormal = rotN(f.normal).map(r5); }
}

export const DOOR_FORMS = {
  // iron-bound planks: vertical boards grooved in the fill, two strap hinges whose pintle ends stand past the hinge
  // edge (the silhouette's notches), a tall iron lock plate on the latch side (the 33) and its ring (the handle)
  plank: {
    setting: { era: ['ancient', 'medieval', 'early-modern'], fiction: ['grounded', 'fantasy'] },
    params: ({ width: w, height: h }) => ({
      w: r5(w), h: r5(h), thick: 0.08, boards: Math.max(3, Math.round(w / 0.2)),
      strap: { at: [0.2, 0.8], len: 0.82, past: 0.14, tall: 0.08 },
      plate: { wide: r5(0.3 * w), tall: r5(0.32 * h), at: 0.47, inset: 0.12 },
      ring: { r: r5(Math.min(0.12, 0.08 * w + 0.03)) },
      values: { body: 0.42, groove: 0.28, strap: 0.2, plate: 0.14, ring: 0.62 },
    }),
    build(out, F, p, state) {
      const { w, h, thick: t, values: V } = p, leaf = [];
      part(leaf, 'body', 'obj:body', V.body, F, [0, 0, h / 2], [w / 2, t / 2, h / 2]);
      for (let i = 1; i < p.boards; i++) part(leaf, 'fill', 'obj:fill', V.groove, F, [-w / 2 + (w * i) / p.boards, t / 2 + 0.004, h / 2], [0.012, 0.004, h / 2 - 0.02]);
      for (const zf of p.strap.at) {
        const len = w * p.strap.len + p.strap.past, u0 = -w / 2 - p.strap.past;
        part(leaf, 'fill', 'obj:fill', V.strap, F, [u0 + len / 2, t / 2 + 0.012, zf * h], [len / 2, 0.012, p.strap.tall / 2]);
      }
      const pu = w / 2 - p.plate.inset - p.plate.wide / 2, pz = p.plate.at * h;
      part(leaf, 'detail', 'obj:detail', V.plate, F, [pu, t / 2 + 0.02, pz], [p.plate.wide / 2, 0.02, p.plate.tall / 2]);
      const rz = pz - p.plate.tall / 2 - p.ring.r, rr = p.ring.r, bar = 0.018;
      for (const [du, dz, hu, hz] of [[0, rr, rr, bar], [0, -rr, rr, bar], [-rr, 0, bar, rr], [rr, 0, bar, rr]]) part(leaf, 'handle', 'obj:status', V.ring, F, [pu + du, t / 2 + 0.05, rz + dz], [hu, bar, hz]);
      if (state === 'open') swing(leaf, add(F.at, mul(F.U, -w / 2)), Math.PI / 2);
      out.push(...leaf);
    },
  },
  // a sliding slab: two halves meeting at a seam, side rails, a header wider than the rails (the notches under its
  // ends), panel lines in the fill, a lit control panel on the wall by the latch rail (the 33: it stays when the
  // halves slide away) and a status strip across the header
  slab: {
    setting: { era: ['modern', 'future'], fiction: ['sci-fi'] },
    params: ({ width: w, height: h }) => ({
      w: r5(w), h: r5(h), thick: 0.1, rail: 0.12, header: { tall: 0.28, past: 0.2 },
      lines: [0.25, 0.5, 0.75],
      panel: { wide: r5(Math.max(0.18, 0.2 * w)), tall: r5(0.34 * h), at: 0.5 },
      values: { body: 0.55, rail: 0.48, line: 0.4, panel: 0.86, strip: 0.92 },
    }),
    build(out, F, p, state) {
      const { w, h, thick: t, rail: rw, values: V } = p, hw = w / 2;
      const slide = state === 'open' ? hw : 0;
      for (const s of [-1, 1]) {
        part(out, 'body', 'obj:body', V.body, F, [s * (hw / 2 + slide), 0, h / 2], [hw / 2 - 0.006, t / 2, h / 2]);
        for (const zf of p.lines) part(out, 'fill', 'obj:fill', V.line, F, [s * (hw / 2 + slide), t / 2 + 0.004, zf * h], [hw / 2 - 0.05, 0.004, 0.015]);
        part(out, 'body', 'obj:body', V.rail, F, [s * (hw + rw / 2), 0.02, h / 2], [rw / 2, t / 2 + 0.04, h / 2]);
      }
      const hz = h + p.header.tall / 2;
      part(out, 'body', 'obj:body', V.rail, F, [0, 0.04, hz], [hw + rw + p.header.past, t / 2 + 0.08, p.header.tall / 2]);
      part(out, 'detail', 'obj:detail', V.panel, F, [hw + rw + 0.03 + p.panel.wide / 2, 0.04, p.panel.at * h], [p.panel.wide / 2, 0.03, p.panel.tall / 2]);
      part(out, 'handle', 'obj:status', V.strip, F, [0, t / 2 + 0.13, hz], [hw * 0.6, 0.006, 0.03]);
    },
  },
};

export const DOOR = {
  id: 'door',
  name: 'Door',
  role: 'closes a doorway and opens when used',
  interest: 'interactable',
  states: ['closed', 'open', 'locked'],
  forms: DOOR_FORMS,
  when: 'a door, a gate, a door that opens, a locked door, open the door, a blast door, a dungeon door',
  // the rules it brings, as an event-bus fragment built from the shelf's idioms: using it sets `<id>-open`. Locked
  // (`unlock`: the event that frees it, e.g. a key's pickup), the opening waits for that event, then for a use:
  // a sequence, since a reaction carries no guard.
  rules(id, { unlock } = {}) {
    const use = `use-${id}`, open = { do: 'set', var: `${id}-open`, to: 1 };
    if (!unlock) return compose({ vars: { [`${id}-open`]: 0 } }, deed({ on: 'pick', emit: use, effects: [{ on: use, ...open }] }));
    return compose({ vars: { [`${id}-open`]: 0 } }, deed({ on: 'pick', emit: use }), {
      sequences: [{ id: `unlock-${id}`, scope: id, trigger: { on: unlock }, steps: [{ await: { on: use } }, open] }],
    });
  },
  // where it stands: a doorway anchor's sill, normal and opening
  frame(anchor) {
    const N = unit(anchor.N), U = unit(cross(Z, N));
    return { at: anchor.at, N, U, fit: { width: anchor.width, height: anchor.height } };
  },
};
