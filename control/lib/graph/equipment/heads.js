// equipment/heads — laws 2's own ends (equipment/compose.js), the staves and the clubs past the staff's heads:
//
//   club      a grown head: the haft swelling to a knotted end (the shaft's wood)
//   spiked    the club, banded and studded with iron spikes in two rings
//   flanged   a flanged mace: a core and its radial flanges, a point on top
//   hammer    a war hammer: an eye round the haft, a square face one side, a spike behind, a spike on top
//   maul      a two-faced block, banded at each face
//   bone      a long bone's end: two knobbed condyles (a bone club; the shaft its shaft)
//   crook     the shaft curled over at its top, a shepherd's staff
//   orb       a polished sphere in a cup
//   cap       an iron shoe (a quarterstaff: shod at both ends)
//   trident   a crossbar and three tines, barbed
//   scythe    a long curved blade at right angles to the haft, its edge on the inside of the curve
//
// Each is built on a shaft of radius R topped at z0, sized by its haft (law 11: a share of `haftL`, never under its own
// floor in shaft radii), and carries no stone. The frame is compose's: the shaft along +z at x = y = 0, a head's side
// toward −x (an axe's), its flat in the xz plane. → { HH (its height over z0), focal ([x, y, z]) }. Pure: seeded dice.
import { r3, P, A, push, mat } from './shapes.js';
import * as dmath from '../../util/dmath.js';

export const LAWS2_HEADS = Object.freeze(['club', 'spiked', 'flanged', 'hammer', 'maul', 'bone', 'crook', 'orb', 'cap', 'trident', 'scythe']);
/** each head's share of its haft and its floor in shaft radii (law 11) */
export const HEAD_SIZE = Object.freeze({ club: [0.32, 14], spiked: [0.32, 14], flanged: [0.22, 9], hammer: [0.18, 8], maul: [0.2, 9], bone: [0.1, 5], crook: [0.12, 11], orb: [0.09, 6], cap: [0, 2], trident: [0.2, 16], scythe: [0.36, 26] });

const lathe = (m, { z0, z1, prof, role, group = 'head', samples, harmonics, x = 0, y = 0 }) => push(m, 'lathes', { group, axisFrom: P(x, y, z0), axisTo: P(x, y, z1), profile: prof.map(([t, r]) => ({ t: r3(t), radius: r3(r) })), ...(samples ? { samples } : {}), ...(harmonics ? { harmonics } : {}), ...mat(role) });
const rod = (m, from, to, r0, r1, role, group = 'head') => push(m, 'lathes', { group, axisFrom: P(...from), axisTo: P(...to), profile: [{ t: 0, radius: r3(r0) }, { t: 1, radius: r3(r1) }], ...mat(role) });
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a; };
const ccw = (pts) => (area(pts) < 0 ? [...pts].reverse() : pts);
/** a flat plate in the xz plane at y = 0, `pts` [x, z], `thick` through y (the axe's own extrude: its profile [−x, z]) */
const plate = (m, pts, thick, role, group = 'head') => push(m, 'extrudes', { group, profile: { points: ccw(pts.map(([x, z]) => [r3(-x), r3(z)])) }, axisFrom: P(0, -thick / 2, 0), axisTo: P(0, thick / 2, 0), ...mat(role) });

/** Build a laws-2 head. */
export function buildHead(m, head, { R, z0, d, law, roles, minF, fg, haftL, rng }) {
  const [share, floor] = HEAD_SIZE[head];
  const HH = Math.max(R * floor * (head === 'cap' ? 1 : fg), share * haftL * fg ** 0.5);
  const wood = roles.shaft, iron = roles.fittings, acc = roles.accent, notch = law.notches;
  let focal = [0, 0, z0 + HH * 0.7];
  if (head === 'club' || head === 'spiked') {
    // the haft swelling to its end, knotted (five lobes, their phase seeded)
    const fat = R * 2.4 * fg ** 0.5, phase = rng() * Math.PI;
    lathe(m, { z0: z0 - R * 2, z1: z0 + HH, prof: [[0, R], [0.25, R * 1.45], [0.6, fat * 0.95], [0.86, fat], [1, R * 1.1]], role: wood, samples: 40, harmonics: [{ n: 5, amplitude: r3(R * 0.18), phase: r3(phase) }] });
    if (head === 'spiked') {
      lathe(m, { z0: z0 + HH * 0.32, z1: z0 + HH * 0.4, prof: [[0, R * 1.62], [1, R * 1.75]], role: iron });
      const n = Math.max(4, Math.round(6 * notch));
      for (const [t, rr, off] of [[0.58, 0.96, 0], [0.82, 1.0, Math.PI / n]]) for (let k = 0; k < n; k++) {
        const a = off + (2 * Math.PI * k) / n, c = dmath.cos(a), s = dmath.sin(a), r0 = fat * rr * 0.92, z = z0 + HH * t;
        rod(m, [r0 * c, r0 * s, z], [(r0 + R * 1.5 * fg) * c, (r0 + R * 1.5 * fg) * s, z + R * 0.2], R * 0.36, 0, iron);
      }
    }
    focal = [0, 0, z0 + HH * 0.8];
  } else if (head === 'flanged') {
    lathe(m, { z0: z0 - R, z1: z0 + HH, prof: [[0, R * 1.1], [0.1, R * 1.35], [0.9, R * 1.35], [1, R * 0.9]], role: iron });
    const n = Math.max(5, Math.round(7 * notch)), w = Math.max(minF, R * 0.42), rx = R * 2.9 * fg ** 0.5;
    for (let k = 0; k < n; k++) {
      // a flange: a plate in the plane through the axis, its outline [r, z], pushed tangentially (law 1: side outlines)
      const a = (2 * Math.PI * k) / n, c = dmath.cos(a), s = dmath.sin(a), t = [-s, c, 0];
      const prof = ccw([[R * 1.15, z0 + HH * 0.06], [rx * 0.9, z0 + HH * 0.22], [rx, z0 + HH * 0.58], [rx * 0.75, z0 + HH * 0.9], [R * 1.15, z0 + HH * 0.98]].map(([r, z]) => [-r, z]));
      push(m, 'extrudes', { group: 'head', profile: { points: prof.map(([u, v]) => [r3(u), r3(v)]) }, axisFrom: P(-t[0] * w / 2, -t[1] * w / 2, 0), axisTo: P(t[0] * w / 2, t[1] * w / 2, 0), ...mat(iron) });
    }
    lathe(m, { z0: z0 + HH, z1: z0 + HH + R * 3 * fg ** 0.5, prof: [[0, R * 0.8], [1, 0]], role: iron });
    focal = [0, 0, z0 + HH * 0.58];
  } else if (head === 'hammer' || head === 'maul') {
    const zc = z0 + HH * (head === 'maul' ? 0.5 : 0.55), Rf = R * (head === 'maul' ? 2.2 : 1.35) * fg ** 0.5;
    lathe(m, { z0: z0 - R * 2, z1: zc + Rf * 1.1, prof: [[0, R * 1.12], [0.7, R * 1.1], [1, R * 0.9]], role: iron });
    if (head === 'maul') {
      const L = R * 9 * fg ** 0.5;
      push(m, 'extrudes', { group: 'head', profile: { rect: { w: r3(Rf * 2), h: r3(Rf * 2), r: r3(Rf * 0.25) } }, axisFrom: P(-L / 2, 0, zc), axisTo: P(L / 2, 0, zc), ...mat(iron) });
      for (const sx of [1, -1]) push(m, 'extrudes', { group: 'head', profile: { rect: { w: r3(Rf * 2.12), h: r3(Rf * 2.12), r: r3(Rf * 0.25) } }, axisFrom: P(sx * (L / 2 - R * 1.6), 0, zc), axisTo: P(sx * (L / 2 - R * 0.9), 0, zc), ...mat(acc) });
      focal = [L / 2, 0, zc];
    } else {
      // the eye, a square face toward +x, a spike toward −x curving down a little, a spike on top
      push(m, 'extrudes', { group: 'head', profile: { rect: { w: r3(R * 3), h: r3(R * 3.6), r: r3(R * 0.4) } }, axisFrom: P(0, -R * 1.3, zc), axisTo: P(0, R * 1.3, zc), ...mat(iron) });
      push(m, 'extrudes', { group: 'head', profile: { rect: { w: r3(Rf * 2), h: r3(Rf * 2), r: r3(Rf * 0.18) } }, axisFrom: P(R * 1.4, 0, zc), axisTo: P(R * 1.4 + R * 3.4 * fg ** 0.5, 0, zc), ...mat(iron) });
      rod(m, [-R * 1.4, 0, zc], [-R * 1.4 - R * 5.5 * fg, 0, zc - R * 1.4], R * 1.15, 0, iron);
      rod(m, [0, 0, zc + R * 1.8], [0, 0, zc + R * 1.8 + R * 3.5 * fg ** 0.5], R * 0.8, 0, iron);
      focal = [R * 4.8, 0, zc];
    }
  } else if (head === 'bone') {
    // a long bone's end: a neck flaring into two condyles side by side
    const k = R * 1.55;
    lathe(m, { z0: z0 - R * 3, z1: z0 + HH * 0.4, prof: [[0, R], [0.6, R * 1.3], [1, k]], role: wood });
    for (const sx of [1, -1]) lathe(m, { x: sx * k * 0.62, z0: z0 + HH * 0.2, z1: z0 + HH, prof: [[0, k * 0.4], [0.3, k * 0.95], [0.75, k * 0.95], [1, k * 0.3]], role: wood, samples: 24 });
    focal = [0, 0, z0 + HH * 0.7];
  } else if (head === 'crook') {
    // the shaft runs on and curls over toward −x and down: a shepherd's crook
    const r = Math.max(R * 4.5, HH * 0.45) * fg ** 0.3, L1 = HH - r, path = [[0, 0, z0 - R]];
    for (let i = 0; i <= 4; i++) path.push([0, 0, z0 + (L1 * i) / 4]);
    for (let i = 1; i <= 18; i++) { const th = (Math.PI * 1.3 * i) / 18; path.push([r3(-r + r * dmath.cos(th)), 0, r3(z0 + L1 + r * dmath.sin(th))]); }
    push(m, 'sweeps', { group: 'head', path: path.map((p) => A(...p)), radius: r3(R * 0.95), sides: 12, ...mat(wood) });
    focal = [-r, 0, z0 + L1 + r];
  } else if (head === 'orb') {
    const r = R * 2.8 * fg ** 0.5, cup = R * 2.2;
    lathe(m, { z0: z0 - R, z1: z0 + cup, prof: [[0, R * 1.1], [0.5, R * 1.4], [1, r * 0.72]], role: iron });
    const prof = Array.from({ length: 13 }, (_, i) => { const a = -Math.PI / 2 + (Math.PI * i) / 12; return [(1 + dmath.sin(a)) / 2, Math.max(0.01, r * dmath.cos(a))]; });
    lathe(m, { z0: z0 + cup - r * 0.35, z1: z0 + cup - r * 0.35 + 2 * r, prof, role: acc, samples: 32 });
    focal = [0, 0, z0 + cup + r * 0.65];
    return { HH: Math.max(HH, cup + r * 1.65), focal };
  } else if (head === 'cap') {
    lathe(m, { z0: z0 - R * 3, z1: z0 + HH, prof: [[0, R * 1.12], [0.7, R * 1.14], [1, R * 0.6]], role: iron });
    focal = [0, 0, z0 + HH];
  } else if (head === 'trident') {
    const span = R * 4.8 * fg ** 0.5, zb = z0 + HH * 0.22, T = Math.max(minF, R * 0.42);
    lathe(m, { z0: z0 - R * 2, z1: zb + R, prof: [[0, R * 1.12], [1, R * 1.05]], role: iron });
    push(m, 'extrudes', { group: 'head', profile: { rect: { w: r3(R * 1.6), h: r3(R * 1.8), r: r3(R * 0.3) } }, axisFrom: P(-span, 0, zb), axisTo: P(span, 0, zb), ...mat(iron) });
    for (const x of [-span, 0, span]) {
      const top = z0 + HH * (x ? 0.86 : 1), base = zb + R * 0.6;
      rod(m, [x, 0, base], [x * 0.92, 0, top], R * 0.62, R * 0.32, iron);
      plate(m, [[x * 0.92 - R * 0.95, top - R * 3.2], [x * 0.92, top + R * 2.4], [x * 0.92 + R * 0.95, top - R * 3.2], [x * 0.92, top - R * 2.2]], T, iron);
    }
    focal = [0, 0, z0 + HH];
  } else if (head === 'scythe') {
    // the blade at right angles to the haft, out toward −x and drooping, its edge the lower (inner) side; a ring holds it
    const bL = HH, W = Math.max(R * 4.5, bL * 0.12), top = R * 3, T = Math.max(minF, R * 0.34);
    lathe(m, { z0: z0 - R * 2, z1: z0 + top + R * 1.5, prof: [[0, R * 1.08], [0.5, R * 1.25], [1, R * 0.95]], role: iron });
    const spine = [], edge = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, x = R * 0.8 + bL * u, zs = z0 + top + bL * 0.1 * dmath.sin(Math.PI * u * 0.9) - bL * 0.3 * u * u;
      spine.push([x, zs]); edge.push([x, zs - W * (1 - u) ** 0.75 - (u < 0.08 ? W * 0.2 * (1 - u / 0.08) : 0)]);
    }
    edge[edge.length - 1] = spine[spine.length - 1];
    // (law 8 of the arms: the edge reads by a brighter bevel: the blade role, its lower third the edge's)
    plate(m, [...spine.map(([x, z]) => [-x, z]), ...edge.slice(0, -1).reverse().map(([x, z]) => [-x, z])], T, roles.blade ?? iron);
    focal = [-(R + bL * 0.45), 0, z0 + top];
    return { HH: top + R * 1.5, focal, reachX: bL };
  }
  return { HH, focal };
}
