/**
 * THE CITY TRUCK KIT: what the city's working trucks share (road-city-truck.js), in the hull kit's language
 * (mil-hull.js) and the haul and civic kits' (haul-kit.js, civic-kit.js): the flat-faced Asian cab-over (a standard
 * cab's or a wide one's), the mini goods carrier's snub cab, a cutaway van's nose and cab, and the bodies they carry: a
 * deck with drop sides and its gate guard, a stake bed, a wing body whose sides lift like wings, a dump tub and its
 * hoist, a knuckle-boom crane, a side-bay body and its roll-up shutters. Classes, not replicas: no maker's face or badge.
 *
 *   asianCab(out, { … })             → a cab-over cab: its face nearly upright, its big screen, a low grille band, the
 *                                      lamps in its bumper, its door over the front wheel and the door's low window;
 *                                      its anchors
 *   miniCab(out, { … })              → a mini goods carrier's cab: short, its face rounded, its screen raked
 *   vanCab(out, { … })               → a cutaway van's nose and cab: its short bonnet, its raked screen, its doors
 *   dropDeck(out, { … })             → a deck and its aluminium drop sides, rope hooks and corner posts
 *   gateGuard(out, { … })            → the guard behind the cab: its frame and its mesh
 *   stakeBed(out, { … })             → a deck and its stake racks: stakes in their pockets, boards between them
 *   wingBody(out, { … })             → a box whose sides and half its roof lift about the ridge; its rear doors; its
 *                                      load seen when open
 *   dumpTub(out, { … })              → a tipping tub, its tailgate, its hoist; turned about its tail by `tip` radians
 *   knuckleCrane(out, { … })         → a crane's column behind the cab, its boom folded, its hook; its outriggers
 *   bayBody(out, { … })              → a box of bays down each side, each behind its roll-up shutter; open, its crates
 *   hingeY(faces, { pivot, angle })  → faces turned about an axis along y through [x, z]
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres. Pure and deterministic (a crate's colour by its
 * place, never dice).
 */
import { plate, tube, face, slab } from './mil-hull.js';
import { CC, own, stripes, band, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, C, hinge } from './civic-kit.js';
import { black, chrome, glass, seam, sideFace, outline, rake } from './haul-kit.js';

// the city trucks' own colours, unlit: what a livery leaves alone
export const TC = Object.freeze({
  alu: '#c3c7ca', aluDark: '#9ea3a7', deck: '#4b4d4f', wood: '#8a6a45', steel: '#5d6164', hook: '#3a3c3e', crane: '#e3e1da',
  shutter: '#d7d9db', crate: Object.freeze(['#b8322b', '#2f6db0', '#e1b12c', '#3f8a4f']), tarp: '#2f5a8a', bumper: '#6b6f73',
});

/** Faces turned about an axis along y through `pivot` ([x, z]) by `angle` (radians; positive turns +x up). */
export function hingeY(faces, { pivot: [px, pz], angle }) {
  if (!angle) return faces;
  const c = Math.cos(angle), s = Math.sin(angle);
  const P = ([x, y, z]) => [px + (x - px) * c - (z - pz) * s, y, pz + (x - px) * s + (z - pz) * c];
  const N = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
  return faces.filter(Boolean).map((f) => ({ ...f, corners: f.corners.map(P), outNormal: N(f.outNormal), ...(f.cornerNormals ? { cornerNormals: f.cornerNormals.map(N) } : {}) }));
}

const anchorsOf = (hw, post, mark, h = 0.12) => [-1, 1].flatMap((s) => {
  const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
  return [
    { id: `post.${L}`, kind: 'post', at: [s * hw, post[0], post[1]], out: sd, up: Z },
    { id: `mark.cab.${L}`, kind: 'mark', role: 'number', at: [s * (hw + 0.005), mark[0], mark[1]], out: sd, up: Z, h },
  ];
});

/** A flat-faced cab-over: its face at the bumper `yN`, `depth` deep, `hw` its half width, its floor `z0` over the front
 *  wheel (at `yf`, radius r), its roof `zTop`; its door over the wheel, the door's low window ahead of it; its anchors. */
export function asianCab(out, { yN, hw, z0, zTop, yf, r, depth }) {
  const P = (o) => out.push(...plate(o)), yF = yN - 0.05, yb = yN - depth, zS0 = z0 + 0.38, zS1 = zTop - 0.16;
  out.push(...slab({
    side: [[yb, z0 - 0.06], [yF, z0 - 0.06], [yF, zS0], [yF - 0.1, zS1], [yF - 0.24, zTop], [yb, zTop]],
    front: [[-hw, z0 - 0.06], [hw, z0 - 0.06], [hw, zTop - 0.14], [hw - 0.1, zTop], [-hw + 0.1, zTop], [-hw, zTop - 0.14]],
    plan: [[-hw, yb], [hw, yb], [hw, yF - 0.2], [hw - 0.13, yF], [-hw + 0.13, yF], [-hw, yF - 0.2]],
    chamfer: 0.05, crease: 8, look: () => paint('cab'),
  }));
  // (its lower face ahead of the wheel down to the bumper; behind the wheel its step well and its tread)
  P({ axis: 'x', profile: [[yf + r * 0.65, 0.38], [yN - 0.03, 0.38], [yN - 0.03, z0 - 0.04], [yf + r * 0.4, z0 - 0.04]], from: -hw + 0.02, to: hw - 0.02, r: 0.03, seg: 1, look: paint('cab.lower') });
  for (const s of [-1, 1]) {
    out.push(...guard(yf, r, r + 0.05, 0.25, Math.PI - 0.15, ...xs(s, hw - 0.36, hw - 0.03), black('arch')));
    P({ axis: 'x', profile: rect(Math.max(yb + 0.02, yf - r - 0.38), yf - r - 0.04, 0.4, z0 - 0.04), from: s * (hw - 0.3), to: s * (hw - 0.02), r: 0.02, seg: 1, look: paint('cab.skirt') });
    P({ axis: 'z', profile: rect(...xs(s, hw - 0.3, hw - 0.04), Math.max(yb + 0.04, yf - r - 0.36), yf - r - 0.06), from: 0.42, to: 0.45, r: 0.006, seg: 1, look: alu('step') });
  }
  // (the screen across its face; the low grille band under it; the wipers; the bumper and its lamps)
  rake(out, [yF, zS0], [yF - 0.1, zS1], -hw + 0.1, hw - 0.1, 0.04, 0.95);
  P({ axis: 'y', profile: rect(-hw + 0.4, hw - 0.4, z0 + 0.1, z0 + 0.24), from: yF - 0.01, to: yF + 0.006, r: 0.01, seg: 1, look: black('grille') });
  out.push(...tube([[-0.6 * hw, yF + 0.02, zS0 + 0.04], [-0.05, yF + 0.02, zS0 + 0.06]], 0.007, { sides: 6, look: black('wiper') }), ...tube([[0.05, yF + 0.02, zS0 + 0.06], [0.6 * hw, yF + 0.02, zS0 + 0.04]], 0.007, { sides: 6, look: black('wiper') }));
  P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, 0.36, 0.6), from: yN - 0.12, to: yN + 0.01, r: 0.03, seg: 1, look: M('bumper', 'plate', TC.bumper) });
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.25), yF + 0.002, z0 - 0.12], Y, 0.3, 0.14, 'lamp', 'headlamp'));
    out.push(...lamp([s * (hw - 0.06), yF - 0.06, z0 - 0.12], [s, 0, 0], 0.1, 0.12, 'marker', 'indicator'));
  }
  // (its doors over the front wheel: their glass, the low window ahead of the step, their handles)
  const yd0 = yF - 0.18, yd1 = Math.max(yb + 0.12, yF - 1.15), zw = zS0 + 0.04;
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.004);
    outline(out, s, x, [yd1, yd0], [z0 - 0.04, zTop - 0.1]);
    sideFace(out, s, x + s * 0.001, [yd1 + 0.07, yd0 - 0.08], [zw, zS1 - 0.02], glass);
    sideFace(out, s, x + s * 0.001, [yd0 - 0.34, yd0 - 0.08], [z0 + 0.0, z0 + 0.3], glass);
    out.push(...tube([[x + s * 0.02, yd1 + 0.12, zw - 0.12], [x + s * 0.02, yd1 + 0.28, zw - 0.12]], 0.01, { sides: 6, look: black('door.handle') }));
    out.push(...lamp([s * (hw - 0.1), yb + 0.08, zTop + 0.002], Z, 0.08, 0.05, 'marker', 'roof.marker'));
  }
  return anchorsOf(hw, [yF - 0.12, zS1 - 0.2], [yd1 + 0.3, z0 + 0.12]);
}

/** A mini goods carrier's cab: short and narrow over its front wheels, its face rounded, its screen raked, its doors;
 *  its anchors. */
export function miniCab(out, { yN, hw, z0, zTop, yf, r, depth }) {
  const P = (o) => out.push(...plate(o)), yb = yN - depth, zS0 = z0 + 0.3, zS1 = zTop - 0.12;
  out.push(...slab({
    side: [[yb, 0.42], [yN - 0.06, 0.42], [yN, 0.62], [yN - 0.02, zS0], [yN - 0.32, zS1], [yN - 0.42, zTop], [yb, zTop]],
    front: [[-hw, 0.42], [hw, 0.42], [hw, zTop - 0.2], [hw - 0.14, zTop], [-hw + 0.14, zTop], [-hw, zTop - 0.2]],
    plan: [[-hw, yb], [hw, yb], [hw, yN - 0.3], [hw - 0.2, yN], [-hw + 0.2, yN], [-hw, yN - 0.3]],
    chamfer: 0.06, crease: 8, look: () => paint('cab'),
  }));
  rake(out, [yN - 0.02, zS0], [yN - 0.32, zS1], -hw + 0.12, hw - 0.12, 0.06, 0.94);
  P({ axis: 'y', profile: rect(-0.35, 0.35, 0.68, 0.9), from: yN - 0.01, to: yN + 0.006, look: black('grille') });
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.22), yN - 0.004, 0.86], Y, 0.22, 0.12, 'lamp', 'headlamp'));
    out.push(...guard(yf, r, r + 0.05, 0.2, Math.PI - 0.2, ...xs(s, hw - 0.28, hw - 0.02), black('arch')));
    const x = s * (hw + 0.004), yd0 = yN - 0.4, yd1 = yb + 0.08;
    outline(out, s, x, [yd1, yd0], [0.5, zTop - 0.08]);
    sideFace(out, s, x + s * 0.001, [yd1 + 0.06, yd0 - 0.06], [zS0 + 0.02, zS1 - 0.04], glass);
  }
  P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, 0.4, 0.58), from: yN - 0.08, to: yN + 0.01, r: 0.03, seg: 1, look: M('bumper', 'plate', TC.bumper) });
  return anchorsOf(hw, [yN - 0.45, zS1 - 0.15], [yb + 0.45, 0.8], 0.1);
}

/** A cutaway van's nose and cab: its short bonnet, its raked screen, its doors and glass; the cab's back open to the box
 *  behind it. yN the bumper, yb the cab's back, hw its half width, zBelt its belt, zTop its roof. Its anchors. */
export function vanCab(out, { yN, yb, hw, zBelt, zTop, yf, r }) {
  const P = (o) => out.push(...plate(o)), yC = yN - 0.95, yS = yC - 0.75;
  P({ axis: 'x', profile: [[yb, 0.5], [yN - 0.06, 0.5], [yN - 0.06, 0.98], [yN - 0.35, zBelt - 0.04], [yC, zBelt + 0.04], [yb, zBelt + 0.04]], from: -hw, to: hw, r: 0.08, seg: 2, look: paint('body') });
  P({ axis: 'x', profile: [[yb, zBelt], [yC, zBelt], [yS, zTop - 0.04], [yb, zTop]], from: -hw + 0.03, to: hw - 0.03, r: 0.08, seg: 2, look: paint('cab') });
  for (const s of [-1, 1]) rake(out, [yC, zBelt], [yS, zTop - 0.04], ...xs(s, 0.03, hw - 0.12), 0.08, 0.9);
  P({ axis: 'y', profile: rect(-0.5, 0.5, 0.72, 0.95), from: yN - 0.08, to: yN - 0.05, look: black('grille') });
  P({ axis: 'x', profile: rect(yN - 0.16, yN, 0.42, 0.66), from: -hw, to: hw, r: 0.04, seg: 2, look: black('bumper') });
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.24), yN - 0.12, 0.98], Y, 0.3, 0.15, 'lamp', 'headlamp'));
    out.push(...guard(yf, r, r + 0.06, 0.1, Math.PI - 0.1, ...xs(s, hw - 0.3, hw - 0.02), dark('arch')));
    // (the door from the cab's back to under the screen's head: its front edge under the rake)
    const x = s * (hw + 0.003), yd0 = yS + 0.08, yd1 = yb + 0.08;
    outline(out, s, x, [yd1, yd0], [0.52, zTop - 0.08]);
    sideFace(out, s, x - s * 0.031, [yd1 + 0.08, yS + 0.16], [zBelt + 0.05, zTop - 0.16], glass);
  }
  return anchorsOf(hw, [yC - 0.08, zBelt + 0.22], [yb + 0.6, 0.8]);
}

/** A deck from `y0` back to `y1` at `zD` and its aluminium drop sides `h` high on three sides, their hinges, latches and
 *  rope hooks; its corner posts. */
export function dropDeck(out, { y0, y1, hw, zD, h = 0.4, frame = true }) {
  const P = (o) => out.push(...plate(o));
  if (frame) P({ axis: 'z', profile: rect(-hw + 0.03, hw - 0.03, y1, y0), from: zD - 0.12, to: zD, r: 0.01, seg: 1, look: M('deck', 'plate', TC.deck) });
  for (const s of [-1, 1]) {
    P({ axis: 'x', profile: rect(y1 + 0.02, y0 - 0.02, zD, zD + h), from: s * (hw - 0.03), to: s * hw, r: 0.01, seg: 1, look: own('dropside', TC.alu, 'steel') });
    for (let z = zD + 0.1; z < zD + h - 0.05; z += 0.1) out.push(face([[s * (hw + 0.002), y1 + 0.05, z], [s * (hw + 0.002), y0 - 0.05, z], [s * (hw + 0.002), y0 - 0.05, z + 0.012], [s * (hw + 0.002), y1 + 0.05, z + 0.012]], M('dropside.rib', 'seal', TC.aluDark), [s, 0, 0]));
    for (let y = y1 + 0.35; y < y0 - 0.2; y += 0.55) out.push(...tube([[s * (hw + 0.005), y, zD - 0.06], [s * (hw + 0.03), y, zD - 0.1]], 0.012, { sides: 5, look: M('ropehook', 'steel', TC.hook) }));
    for (const y of [y0 - 0.02, y1 + 0.02]) P({ axis: 'z', profile: rect(...xs(s, hw - 0.05, hw + 0.004), y - 0.04, y), from: zD, to: zD + h + 0.02, r: 0.008, seg: 1, look: own('dropside.post', TC.aluDark, 'steel') });
  }
  P({ axis: 'y', profile: rect(-hw + 0.03, hw - 0.03, zD, zD + h), from: y1, to: y1 + 0.03, r: 0.01, seg: 1, look: own('dropside', TC.alu, 'steel') });
  for (let z = zD + 0.1; z < zD + h - 0.05; z += 0.1) out.push(face([[-hw + 0.05, y1 - 0.003, z], [hw - 0.05, y1 - 0.003, z], [hw - 0.05, y1 - 0.003, z + 0.012], [-hw + 0.05, y1 - 0.003, z + 0.012]], M('dropside.rib', 'seal', TC.aluDark), neg(Y)));
}

/** The guard behind a cab: a frame from the deck to `zTop` at `y` and its mesh. */
export function gateGuard(out, { y, hw, zD, zTop }) {
  const P = (o) => out.push(...plate(o));
  for (const s of [-1, 1]) P({ axis: 'z', profile: rect(...xs(s, hw - 0.08, hw - 0.02), y - 0.06, y), from: zD, to: zTop, r: 0.01, seg: 1, look: own('guard.post', TC.alu, 'steel') });
  P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, zTop - 0.06, zTop), from: y - 0.06, to: y, r: 0.01, seg: 1, look: own('guard.rail', TC.alu, 'steel') });
  for (let x = -hw + 0.15; x < hw - 0.1; x += 0.12) out.push(...tube([[x, y - 0.03, zD + 0.02], [x, y - 0.03, zTop - 0.06]], 0.008, { sides: 4, look: own('guard.mesh', TC.aluDark, 'steel') }));
}

/** A deck and its stake racks: stakes in their pockets along each side and across the front, boards between them, the
 *  rear's gate of boards. */
export function stakeBed(out, { y0, y1, hw, zD, h = 1.1 }) {
  const P = (o) => out.push(...plate(o)), wood = (part) => M(part, 'canvas', TC.wood);
  P({ axis: 'z', profile: rect(-hw + 0.02, hw - 0.02, y1, y0), from: zD - 0.12, to: zD, r: 0.01, seg: 1, look: wood('deck') });
  const boards = [0.12, 0.42, 0.72, h - 0.14];
  for (const s of [-1, 1]) {
    for (let y = y1 + 0.05; y <= y0 - 0.04; y += Math.min(0.9, (y0 - y1 - 0.1) / Math.max(1, Math.round((y0 - y1 - 0.1) / 0.9)))) P({ axis: 'z', profile: rect(...xs(s, hw - 0.06, hw - 0.005), y - 0.04, y + 0.04), from: zD - 0.14, to: zD + h, r: 0.006, seg: 1, look: dark('stake') });
    for (const z of boards) P({ axis: 'y', profile: rect(...xs(s, hw - 0.1, hw - 0.06), zD + z, zD + z + 0.12), from: y1 + 0.02, to: y0 - 0.02, r: 0.008, seg: 1, look: wood('stake.board') });
  }
  for (const [y, n] of [[y0, Y], [y1, neg(Y)]]) {
    for (const z of boards) P({ axis: 'x', profile: rect(y - (n === Y ? 0.06 : -0.02), y - (n === Y ? 0.02 : -0.06), zD + z, zD + z + 0.12), from: -hw + 0.08, to: hw - 0.08, r: 0.008, seg: 1, look: wood('stake.board') });
  }
}

/** A wing body: a box from `y0` back to `y1`, `hw` its half width, from its floor `zF` to its ridge `H`; its sides and
 *  each half of its roof lift together about the ridge by `open` (0 shut, 1 at 70°), its low drop side (its `aori`)
 *  staying; its rear doors; its pallets seen inside when open. */
export function wingBody(out, { y0, y1, hw, zF, H, open = 0 }) {
  const P = (o) => out.push(...plate(o)), aori = 0.42, skin = own('wing', TC.alu, 'steel');
  P({ axis: 'z', profile: rect(-hw + 0.02, hw - 0.02, y1, y0), from: zF - 0.12, to: zF, r: 0.01, seg: 1, look: M('deck', 'plate', TC.deck) });
  // (its front wall and its rear frame, its ridge beam; its doors at the rear)
  P({ axis: 'y', profile: rect(-hw, hw, zF, H), from: y0 - 0.06, to: y0, r: 0.02, seg: 1, look: skin });
  for (const s of [-1, 1]) P({ axis: 'z', profile: rect(...xs(s, hw - 0.08, hw), y1, y1 + 0.08), from: zF, to: H, r: 0.01, seg: 1, look: own('wing.post', TC.aluDark, 'steel') });
  P({ axis: 'y', profile: rect(-0.08, 0.08, H - 0.1, H), from: y1, to: y0, r: 0.01, seg: 1, look: own('wing.ridge', TC.aluDark, 'steel') });
  out.push(face([[-hw + 0.08, y1 - 0.004, zF], [hw - 0.08, y1 - 0.004, zF], [hw - 0.08, y1 - 0.004, H - 0.04], [-hw + 0.08, y1 - 0.004, H - 0.04]], own('door.rear', TC.alu, 'steel'), neg(Y)));
  out.push(face([[-0.006, y1 - 0.008, zF + 0.05], [0.006, y1 - 0.008, zF + 0.05], [0.006, y1 - 0.008, H - 0.08], [-0.006, y1 - 0.008, H - 0.08]], seam, neg(Y)));
  for (const x of [-0.5, -0.2, 0.2, 0.5].map((k) => k * hw * 2)) out.push(...tube([[x, y1 - 0.03, zF + 0.1], [x, y1 - 0.03, H - 0.12]], 0.016, { sides: 6, look: chrome('door.bar') }));
  for (const s of [-1, 1]) {
    // (the drop side under each wing)
    P({ axis: 'x', profile: rect(y1 + 0.08, y0 - 0.06, zF, zF + aori), from: s * (hw - 0.03), to: s * hw, r: 0.01, seg: 1, look: own('dropside', TC.alu, 'steel') });
    // (the wing: its side from over the drop side to the eave, its half of the roof to the ridge, its ribs; lifted about
    // the ridge)
    const w = [];
    w.push(...plate({ axis: 'x', profile: rect(y1 + 0.08, y0 - 0.06, zF + aori + 0.01, H - 0.12), from: s * (hw - 0.025), to: s * hw, r: 0.008, seg: 1, look: skin }));
    w.push(...plate({ axis: 'z', profile: rect(...xs(s, 0.08, hw), y1 + 0.08, y0 - 0.06), from: H - 0.12, to: H - 0.09, r: 0.006, seg: 1, look: skin }));
    for (let y = y1 + 0.5; y < y0 - 0.2; y += 0.55) w.push(face([[s * (hw + 0.002), y - 0.01, zF + aori + 0.05], [s * (hw + 0.002), y + 0.01, zF + aori + 0.05], [s * (hw + 0.002), y + 0.01, H - 0.16], [s * (hw + 0.002), y - 0.01, H - 0.16]], M('wing.rib', 'seal', TC.aluDark), [s, 0, 0]));
    out.push(...hingeY(w, { pivot: [s * 0.08, H - 0.1], angle: s * open * (70 * Math.PI) / 180 }));
  }
  // (its load when open: pallets of cartons down its length)
  if (open > 0) {
    for (let y = y0 - 0.2; y - 1.1 > y1 + 0.1; y -= 1.2) for (const s of [-1, 1]) {
      P({ axis: 'z', profile: rect(...xs(s, 0.05, hw - 0.1), y - 1.1, y), from: zF, to: zF + 0.14, r: 0.01, seg: 1, look: M('pallet', 'canvas', TC.wood) });
      P({ axis: 'z', profile: rect(...xs(s, 0.08, hw - 0.13), y - 1.07, y - 0.03), from: zF + 0.14, to: zF + 1.2, r: 0.02, seg: 1, look: M('cartons', 'canvas', '#b48a5a') });
    }
  }
}

/** A dump tub from `y0` back to `y1`, `hw` its half width, its floor `zF`, its sides `h` high; its tailgate; tipped about
 *  its tail's hinge by `tip` radians; its hoist ram from the frame to its belly. */
export function dumpTub(out, { y0, y1, hw, zF, h = 0.6, tip = 0, zFrame }) {
  const tub = [], P = (o) => tub.push(...plate(o)), steel = paint('tub');
  P({ axis: 'z', profile: rect(-hw, hw, y1, y0), from: zF, to: zF + 0.06, r: 0.01, seg: 1, look: steel });
  for (const s of [-1, 1]) {
    P({ axis: 'x', profile: rect(y1, y0, zF, zF + h), from: s * (hw - 0.04), to: s * hw, r: 0.01, seg: 1, look: steel });
    for (let y = y1 + 0.4; y < y0 - 0.1; y += 0.5) P({ axis: 'x', profile: rect(y - 0.03, y + 0.03, zF + 0.06, zF + h), from: s * hw, to: s * (hw + 0.03), look: steel });
    P({ axis: 'y', profile: rect(...xs(s, hw - 0.06, hw + 0.04), zF + h - 0.06, zF + h), from: y1, to: y0, r: 0.01, seg: 1, look: steel });
  }
  P({ axis: 'y', profile: rect(-hw, hw, zF, zF + h + 0.25), from: y0 - 0.05, to: y0, r: 0.01, seg: 1, look: steel });
  P({ axis: 'y', profile: rect(-hw + 0.04, hw - 0.04, zF + 0.06, zF + h), from: y1, to: y1 + 0.05, r: 0.01, seg: 1, look: paint('tub.tailgate') });
  const pivot = [y1 + 0.05, zF];
  out.push(...hinge(tub, { pivot, angle: tip }));
  // (the hoist: from the frame under the tub's front to its belly, turned with it)
  const belly = [y0 - 0.6, zF];
  const by = pivot[0] + (belly[0] - pivot[0]) * Math.cos(tip), bz = pivot[1] + (belly[0] - pivot[0]) * Math.sin(tip);
  out.push(...tube([[0, belly[0] + 0.05, zFrame], [0, by, bz]], 0.07, { sides: 10, look: M('hoist', 'alloy', '#c9ccce') }));
}

/** A knuckle-boom crane behind the cab at `y`: its base on the frame, its column, its boom folded back over the deck, its
 *  hook; two outrigger beams and their jacks. Its column's height `zTop`. */
export function knuckleCrane(out, { y, hw, zFrame, zTop }) {
  const P = (o) => out.push(...plate(o)), look = own('crane', TC.crane, 'plate');
  P({ axis: 'z', profile: rect(-0.45, 0.45, y - 0.35, y + 0.05), from: zFrame, to: zFrame + 0.25, r: 0.02, seg: 1, look: dark('crane.base') });
  out.push(...tube([[0, y - 0.15, zFrame + 0.25], [0, y - 0.15, zTop]], 0.17, { sides: 14, look }));
  P({ axis: 'x', profile: [[y - 0.25, zTop - 0.05], [y - 2.8, zTop - 0.05], [y - 2.8, zTop + 0.18], [y - 0.05, zTop + 0.28]], from: -0.13, to: 0.13, r: 0.02, seg: 1, look });
  P({ axis: 'x', profile: rect(y - 3.2, y - 2.7, zTop - 0.02, zTop + 0.14), from: -0.1, to: 0.1, r: 0.02, seg: 1, look: own('crane.tip', TC.crane, 'plate') });
  out.push(...tube([[0, y - 0.15, zTop - 0.4], [0, y - 1.1, zTop - 0.02]], 0.05, { sides: 8, look: M('crane.ram', 'alloy', '#c9ccce') }));
  out.push(...tube([[0, y - 3.1, zTop - 0.02], [0, y - 3.1, zTop - 0.32]], 0.008, { sides: 4, look: black('crane.rope') }));
  P({ axis: 'z', profile: rect(-0.08, 0.08, y - 3.18, y - 3.02), from: zTop - 0.5, to: zTop - 0.32, r: 0.02, seg: 1, look: M('crane.hook', 'plate', CC.yellow) });
  for (const s of [-1, 1]) {
    P({ axis: 'x', profile: rect(y - 0.3, y - 0.1, zFrame - 0.2, zFrame + 0.02), from: s * 0.3, to: s * (hw - 0.05), r: 0.01, seg: 1, look: dark('outrigger') });
    out.push(...tube([[s * (hw - 0.12), y - 0.2, zFrame], [s * (hw - 0.12), y - 0.2, zFrame - 0.45]], 0.05, { sides: 8, look: dark('outrigger.jack') }));
  }
}

/** A side-bay body from `y0` back to `y1`: its floor, its roof, its posts, `n` bays down each side, each behind its
 *  roll-up shutter; open, the shutters up in their housings and its crates stacked inside. */
export function bayBody(out, { y0, y1, hw, zF, H, n = 4, open = false }) {
  const P = (o) => out.push(...plate(o)), wb = (y0 - y1) / n;
  P({ axis: 'z', profile: rect(-hw + 0.02, hw - 0.02, y1, y0), from: zF - 0.12, to: zF, r: 0.01, seg: 1, look: M('deck', 'plate', TC.deck) });
  P({ axis: 'z', profile: rect(-hw, hw, y1, y0), from: H - 0.08, to: H, r: 0.02, seg: 1, look: paint('bay.roof') });
  P({ axis: 'y', profile: rect(-hw, hw, zF, H - 0.06), from: y0 - 0.06, to: y0, r: 0.02, seg: 1, look: paint('bay.front') });
  P({ axis: 'y', profile: rect(-hw, hw, zF, H - 0.06), from: y1, to: y1 + 0.06, r: 0.02, seg: 1, look: paint('bay.rear') });
  P({ axis: 'y', profile: rect(-0.05, 0.05, zF, H - 0.06), from: y1, to: y0, look: paint('bay.spine') });
  for (const s of [-1, 1]) {
    for (let i = 0; i <= n; i++) P({ axis: 'z', profile: rect(...xs(s, hw - 0.07, hw), y1 + i * wb - 0.035, y1 + i * wb + 0.035), from: zF, to: H - 0.06, r: 0.008, seg: 1, look: paint('bay.post') });
    for (let i = 0; i < n; i++) {
      const a = y1 + i * wb + 0.04, b = a + wb - 0.08, zs = open ? H - 0.32 : zF + 0.02;
      // (the shutter's housing at the top; its slats down to its foot, rolled up when open; the bay dark and stocked)
      P({ axis: 'x', profile: rect(a, b, H - 0.3, H - 0.08), from: s * (hw - 0.1), to: s * (hw - 0.02), r: 0.02, seg: 1, look: paint('bay.housing') });
      if (!open) {
        P({ axis: 'x', profile: rect(a, b, zs, H - 0.3), from: s * (hw - 0.04), to: s * (hw - 0.03), look: own('shutter', TC.shutter, 'steel') });
        for (let z = zs + 0.08; z < H - 0.32; z += 0.08) out.push(face([[s * (hw - 0.028), a + 0.01, z], [s * (hw - 0.028), b - 0.01, z], [s * (hw - 0.028), b - 0.01, z + 0.008], [s * (hw - 0.028), a + 0.01, z + 0.008]], M('shutter.slat', 'seal', TC.aluDark), [s, 0, 0]));
      } else {
        out.push(face([[s * 0.06, a, zF + 0.01], [s * 0.06, b, zF + 0.01], [s * 0.06, b, H - 0.3], [s * 0.06, a, H - 0.3]], M('bay.inside', 'seal', '#1a1b1c'), [s, 0, 0]));
        const rows = Math.floor((H - zF - 0.4) / 0.3);
        for (let k = 0; k < rows; k++) for (let j = 0; j < 2; j++) {
          const z = zF + k * 0.3, ya = a + 0.04 + j * (wb - 0.16) / 2;
          P({ axis: 'z', profile: rect(...xs(s, 0.12, hw - 0.12), ya, ya + (wb - 0.2) / 2), from: z + 0.01, to: z + 0.28, r: 0.015, seg: 1, look: M('crate', 'plate', TC.crate[(i + k + j) % TC.crate.length]) });
        }
      }
    }
  }
}

export { CC, own, stripes, band, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, C, hinge, black, chrome, glass, seam, sideFace, outline, rake };
