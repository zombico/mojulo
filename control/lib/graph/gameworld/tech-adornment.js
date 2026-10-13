/**
 * THE ADORNMENT — the third page of the technology design loop: the 33 hung on the chassis' sockets (tech-chassis.js),
 * as the hero's adornment is hung on the hero. Every piece SERVES something: a function the chassis promised (an
 * armoured walker's plates serve guard), the rank's silhouette floor (an antenna that stands past the outline), or the
 * face a machine is read by (a visor and an eye). The motif (tech-direction.js MOTIFS) shapes each piece and adds its
 * own: rivet strips on riveted plates, spikes on a spiked hull, fins on a smooth one.
 *
 * Pieces are workbench monomers like the chassis' (extrudes, lathes, sweeps), placed in a socket's own frame (its point,
 * its outward normal), each with a piece name, a role (era/blocks.js ROLES), a surface group and a value: the paint
 * (page four) colours values, so a plate sits a band apart from the body it is hung on, and the status light is the one
 * accent.
 *
 *   ADORNMENT_PIECES                                  the kit: what each piece is and what it serves
 *   suggestAdornment(chassis, thing, { motif, rank }) → [{ piece, socket, serves, why }]   (a proposal, with its reasons)
 *   adornManifest(chassis, picks, { motif, fit })    → { monomers by kind, pieces }        (the pieces as monomers)
 *   buildAdorned(thing, { kind, direction, rank, use }) → the chassis with its adornment, read and held to every law
 *
 * Pure; no dice.
 */
import { chassisManifest, lowerChassis, chassisLaws, fitter, buildChassis, stepOf, LEAD_GROW, leadOf } from './tech-chassis.js';
import { techReadout } from './tech-readout.js';
import { TECH_STYLES, pxPerMetre, meetDistance } from './tech-eras.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const P = (p) => ({ x: r3(p[0]), y: r3(p[1]), z: r3(p[2]) });
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
/** A socket's frame: its normal n, an across u and an up v in the plane it faces. */
function frame(n) {
  const N = unit(n), up = Math.abs(N[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], U = unit(cross(up, N));
  return { n: N, u: U, v: cross(N, U) };
}
const toProfile = (pts) => pts.map(([a, b]) => [r3(a), r3(b)]);
/** A rounded rectangle's outline, each corner in `n` steps. */
function roundRect(w, h, r, n) {
  const pts = [], C = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
  for (const [cx, cy, a0] of C) for (let i = 0; i <= n; i++) { const a = ((a0 + (90 * i) / n) * Math.PI) / 180; pts.push([r3(cx + r * Math.cos(a)), r3(cy + r * Math.sin(a))]); }
  return pts;
}

/** The kit. `serves` is what a piece shows; `stands` whether it reaches past the outline (a silhouette segment). */
export const ADORNMENT_PIECES = Object.freeze({
  plate: { read: 'an armour plate on a mass: a band apart from it, chamfered or rounded by the motif', serves: ['guard'], role: 'armour' },
  panel: { read: 'a dressed panel on a mass: the plate\'s shape, serving nothing but the eye', serves: [], role: 'trim' },
  visor: { read: 'the face a machine is read by: a dark band across its front', serves: ['signal'], role: 'readout' },
  eye: { read: 'a lens in a housing: what it looks with', serves: ['sense'], role: 'sensor' },
  vents: { read: 'slats on its back: it breathes', serves: [], role: 'trim' },
  pipes: { read: 'hoses from its back to its joints', serves: ['power'], role: 'carrier' },
  antenna: { read: 'a whip with a light at its tip, past the outline', serves: ['signal'], role: 'beacon', stands: true },
  spikes: { read: 'spikes past the outline (spiked)', serves: ['guard'], role: 'armour', stands: true },
  fins: { read: 'swept fins on its back (smooth)', serves: [], role: 'trim', stands: true },
  rivets: { read: 'a strip of rivets along a plate (riveted)', serves: [], role: 'trim' },
  turret: { read: 'a gun on a ring: it fights', serves: ['strike'], role: 'weapon', stands: true },
  rack: { read: 'weapons stood in a rack on its flank: it fights, with no deck for a gun', serves: ['strike'], role: 'weapon', stands: true },
  livery: { read: 'its team colour painted into its surface: a sash wrapped over its back and down its open flank, the one its armour leaves (a band all round when it is even), or a panel on that face', serves: [], role: 'trim' },
  dish: { read: 'a dish on an arm: it listens', serves: ['sense'], role: 'sensor', stands: true },
  lantern: { read: 'a lantern room under its cap: it lights', serves: ['light'], role: 'lamp' },
  bands: { read: 'bands round a shaft: its height read in steps', serves: [], role: 'trim' },
  crates: { read: 'crates lashed on its back: what it carries', serves: ['store'], role: 'store' },
  status: { read: 'the status light: the one accent, on what you use', serves: [], role: 'status' },
});

// the values a piece takes on its group: a plate a band off the body, glass dark, the status light the accent
const LOOK = { livery: ['tech:team', 0.6], plate: ['tech:trim', 0.5], visor: ['tech:glass', 0.12], eye: ['tech:glass', 0.15], 'eye-ring': ['tech:frame', 0.38], vents: ['tech:frame', 0.3], pipes: ['tech:cable', 0.3], antenna: ['tech:frame', 0.42], tip: ['str:accent', 0.9], spikes: ['tech:trim', 0.62], fins: ['tech:skin', 0.82], rivets: ['tech:frame', 0.35], turret: ['tech:body', 0.66], barrel: ['tech:frame', 0.4], dish: ['tech:skin', 0.86], crates: ['tech:skin', 0.7], lantern: ['tech:light', 0.9], cap: ['tech:skin', 0.82], gallery: ['tech:trim', 0.5], bands: ['tech:trim', 0.5] };
const GREY = (v) => { const g = Math.round(v * 255).toString(16).padStart(2, '0'); return `#${g}${g}${g}`; };

// sockets by what they are, never by name: the face they are on and the mass they are on
const onCore = (c, face) => c.sockets.filter((x) => x.mass === 'core' && x.face === face).sort((a, b) => SIZE[b.size] - SIZE[a.size]);
const SIZE = { small: 0, medium: 1, large: 2 };
/** The highest mass that offers sides and is not a light (a tower's deck): where a landmark hangs what it listens with. */
function crownMass(c) {
  const side = c.sockets.filter((x) => x.face === 'side' && !['beacon', 'lamp'].includes(x.role));
  const top = Math.max(...side.map((x) => x.at[2]));
  return side.filter((x) => x.at[2] >= top - 0.01);
}
/**
 * A proposal, with its reasons: what the chassis promised first, then the face a thing that moves is read by, then its
 * back, then a landmark's dressing, then the motif's own. Rules read sockets by their face and their mass, functions,
 * the rank and the motif: no form is named.
 */
const pulledOf = (c) => (c.mechanisms ?? []).length > 0 && c.mechanisms.every((m) => m.driven === 'muscle');
export function suggestAdornment(c, t, { motif = 'smooth', rank = 'interactable', asymmetry = 0, lead = 1 } = {}) {
  const picks = [], add1 = (piece, s, why) => { if (s && !picks.some((p) => p.piece === piece && p.socket === s.id)) picks.push({ piece, socket: s.id, serves: ADORNMENT_PIECES[piece].serves, why }); };
  // a thing pulled or pedalled (every mechanism it runs on driven by muscle) is no machine: it has no face, and it does
  // not breathe
  const pulled = pulledOf(c);
  const many = { filler: 0, prop: 1, interactable: 2, focus: 3 }[rank], moves = c.functions.includes('move') && !pulled, landmark = ['landmark', 'installation'].includes(t.block.tier) && !moves;
  const topmost = [...c.sockets].filter((x) => x.face === 'top').sort((a, b) => b.at[2] - a.at[2])[0];
  for (const f of c.promised) {
    if (f === 'guard') {
      // lopsided past half: one flank's armour, the lead's; the promise is kept by it alone
      const flanks = onCore(c, 'side'), near = flanks.filter((s) => Math.sign(s.normal[1]) === lead);
      for (const s of asymmetry >= 0.5 && near.length ? near : flanks) add1('plate', s, asymmetry >= 0.5 && near.length ? 'guard: promised by its words, on its lead flank (lopsided)' : 'guard: promised by its words, on the core\'s flanks');
      if (many >= 2) for (const s of c.sockets.filter((x) => x.face === 'outer')) add1('plate', s, 'guard: promised by its words, on its limbs');
    } else if (f === 'strike') {
      // a gun on a ring needs a deck to turn on; a thing with none carries its weapons racked on its flank
      const deck = onCore(c, 'top').find((x) => { const M = c.masses.find((m) => m.id === x.on); return x.size === 'large' && M?.box && M.box.hi[2] - M.box.lo[2] >= 0.5; });
      if (deck) add1('turret', deck, 'strike: promised by its words, on the core\'s back');
      else add1('rack', onCore(c, 'side')[0] ?? onCore(c, 'top')[0], 'strike: promised by its words; no deck for a turret, its weapons racked');
    }
    else if (f === 'sense') add1(moves ? 'eye' : 'dish', moves ? onCore(c, 'front')[0] : crownMass(c)[0] ?? onCore(c, 'top')[0], 'sense: promised by its words');
    else if (f === 'light') add1('lantern', topmost, 'light: promised by its words, at its crown');
    else if (f === 'signal') add1('antenna', onCore(c, 'top')[0] ?? topmost, 'signal: promised by its words');
    else if (f === 'store') add1('crates', onCore(c, 'top')[0] ?? onCore(c, 'rear')[0], 'store: promised by its words, what it carries shows');
    else if (f === 'power') add1('vents', onCore(c, 'top')[0] ?? onCore(c, 'rear')[0], 'power: promised by its words, it breathes');
  }
  // the face a thing that moves is read by: a visor and an eye on the core's front
  // (a thing with windows or lamps already has its face)
  const faced = Object.values(c.pieces).some((x) => x.role === 'lamp') || ['lofts', 'lathes', 'extrudes', 'sweeps'].some((key) => (c.manifest[key] ?? []).some((m) => m.group === 'tech:glass'));
  if (moves && !faced) { const f = onCore(c, 'front')[0]; add1('visor', f, 'its face: what the eye finds first'); if (!picks.some((p) => p.piece === 'eye')) add1('eye', f, 'its face: what it looks with'); }
  // its back breathes; a busier rank carries hoses to the joints at its rear
  if (moves && many >= 1 && !picks.some((p) => p.piece === 'turret' || p.piece === 'crates')) add1('vents', onCore(c, 'top')[0], 'its back: it breathes');
  if (moves && many >= 2 && rearJoints(c).length) add1('pipes', onCore(c, 'rear')[0], 'hoses to its rear joints: what powers them shows');
  // a landmark is dressed at its foot, hangs what it listens and tells with from its crown, and reads its height in bands
  if (landmark) {
    if (many >= 1) for (const s of c.sockets.filter((x) => x.role === 'mount' && x.face !== 'top')) add1('panel', s, 'its foot: dressed panels a band off its base');
    if (many >= 2) for (const s of crownMass(c).filter((x) => x.mass !== 'core').slice(0, 2)) add1('antenna', s, 'its crown: whips past the outline');
    if (many >= 1 && c.dims?.w0 !== undefined && !c.dims.lattice) add1('bands', topmost, 'its shaft: bands that read its height in steps');
  }
  if (motif === 'riveted') for (const p of picks.filter((x) => x.piece === 'plate' && /side/.test(x.socket))) picks.push({ piece: 'rivets', socket: p.socket, serves: [], why: 'riveted: its plates are bolted on' });
  // whose it is, painted into it: the team colour on a large zone that reads from above, lopsided when it leans
  if (many >= 1 && !pulledOf(c)) add1('livery', onCore(c, 'top')[0] ?? topmost, asymmetry >= 0.3 ? `its team colour: a sash over its back and down its open flank, balancing its armour (asymmetry ${asymmetry})` : 'its team colour: a band all round');
  return picks;
}
/** The joints at a thing's rear that hang off its core: where hoses run to. */
// the joints a hose would power: behind the middle, on the core, with a limited range (a hose cannot feed what spins free)
// the next rank up, which a conflict proposes
const LOUDER = Object.freeze({ filler: 'prop', prop: 'interactable', interactable: 'focus' });
const rearJoints = (c) => c.joints.filter((j) => j.parent === 'core' && j.pivot[0] < -0.01 && !/^(pitch|crown)/.test(j.id) && j.range[1] - j.range[0] < 360);

/**
 * The side a thing leans to (y's sign: −1 left, +1 right). A weapon hung on a flank is the counterweight, so the thing
 * leans away from it; else the side its words fall to (a stable choice, the same thing always the same way).
 */
export function leadSide(c, picks, words = '') {
  const S = Object.fromEntries(c.sockets.map((s) => [s.id, s]));
  const armed = picks.find((p) => ADORNMENT_PIECES[p.piece]?.role === 'weapon' && Math.abs(S[p.socket]?.normal?.[1] ?? 0) > 0.5);
  if (armed) return { lead: -Math.sign(S[armed.socket].normal[1]), why: 'away from its weapon: the weapon is the counterweight' };
  let h = 0;
  for (const ch of String(words)) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
  return { lead: h % 2 ? 1 : -1, why: 'the side its words fall to' };
}

/** The pieces as monomers, each in its socket's frame. With `asymmetry` (0–1), the flank toward `lead` carries more
 * (its pieces grown, the other flank's shrunk) and what stands on top steps toward it; a weapon steps the other way,
 * to balance it. */
export function adornManifest(c, picks, { motif = 'smooth', fit = () => 8, asymmetry = 0, lead = 1 } = {}) {
  const extrudes = [], lathes = [], sweeps = [], pieces = {}, n = { };
  const mono = (arr, spec, piece, role, look) => { const [group, value] = LOOK[look]; arr.push({ ...spec, group, tint: GREY(value) }); pieces[spec.id] = { piece, role, value }; };
  const S = Object.fromEntries(c.sockets.map((s) => [s.id, s])), scale = c.scale ?? 1;
  for (const p of picks) {
    const s = S[p.socket], F = frame(s.normal), weapon = ADORNMENT_PIECES[p.piece]?.role === 'weapon', side = Math.abs(s.normal[1]) > 0.5 ? Math.sign(s.normal[1]) : 0;
    // the lean: a flank grown or shrunk, a top piece stepped toward the lead (a weapon away from it)
    const at = s.face === 'top' && asymmetry ? add(s.at, [0, (weapon ? -lead : lead) * asymmetry * (s.extent?.[0] ?? 1) * 0.35, 0]) : s.at;
    let k = { small: 0.55, medium: 1, large: 1.3 }[s.size] * scale * (side && !weapon && asymmetry ? (side === lead ? 1 + 0.5 * asymmetry : 1 - 0.45 * asymmetry) : 1);
    const id = (x) => { n[x] = (n[x] ?? 0) + 1; return `${x}-${p.socket}${n[x] > 1 ? `-${n[x]}` : ''}`; };
    const onPlane = (pt, out = 0) => add(add(add(at, F.u, pt[0]), F.v, pt[1]), F.n, out);
    if (p.piece === 'plate' || p.piece === 'panel') {
      // sized to the face it hangs on; its corners chamfered, or rounded in as many steps as where it is met asks
      const ext = s.extent ?? [3, 3], w = Math.min(1.5 * k, ext[0] * 0.85), h = Math.min(0.9 * k, ext[1] * 0.8), round = motif === 'smooth' || motif === 'organic', cut = Math.min(w, h) * (round ? 0.3 : 0.22);
      const profile = { points: round ? roundRect(w, h, cut, Math.max(1, Math.round(fit(cut) / 4))) : toProfile([[-w / 2 + cut, -h / 2], [w / 2 - cut, -h / 2], [w / 2, -h / 2 + cut], [w / 2, h / 2 - cut], [w / 2 - cut, h / 2], [-w / 2 + cut, h / 2], [-w / 2, h / 2 - cut], [-w / 2, -h / 2 + cut]]) };
      mono(extrudes, { id: id(p.piece), profile, axisFrom: P(onPlane([0, 0], 0.02 * k)), axisTo: P(onPlane([0, 0], 0.16 * k)) }, `${p.piece}-${p.socket}`, ADORNMENT_PIECES[p.piece].role, 'plate');
    } else if (p.piece === 'visor') {
      mono(extrudes, { id: id('visor'), profile: { points: toProfile([[-0.55 * k, -0.12 * k], [0.55 * k, -0.12 * k], [0.45 * k, 0.16 * k], [-0.45 * k, 0.16 * k]]) }, axisFrom: P(onPlane([0, 0.42 * k], -0.12 * k)), axisTo: P(onPlane([0, 0.42 * k], 0.12 * k)) }, 'visor', 'readout', 'visor');
    } else if (p.piece === 'eye') {
      const base = onPlane([0, -0.05 * k], 0.25 * k);
      mono(lathes, { id: id('eye-ring'), axisFrom: P(onPlane([0, -0.05 * k], 0)), axisTo: P(base), profile: [{ t: 0, radius: r3(0.3 * k) }, { t: 1, radius: r3(0.26 * k) }], samples: fit(0.3 * k), crossSections: 2 }, 'eye', 'frame', 'eye-ring');
      mono(lathes, { id: id('eye'), axisFrom: P(base), axisTo: P(add(base, F.n, 0.1 * k)), profile: [{ t: 0, radius: r3(0.22 * k) }, { t: 0.6, radius: r3(0.18 * k) }, { t: 1, radius: r3(0.05 * k) }], samples: fit(0.22 * k), crossSections: 3 }, 'eye', 'sensor', 'eye');
    } else if (p.piece === 'vents') {
      for (let i = 0; i < 4; i++) mono(extrudes, { id: id('vents'), profile: { rect: { w: r3(0.9 * k), h: r3(0.1 * k), r: 0 } }, axisFrom: P(onPlane([0, (-0.45 + i * 0.3) * k], -0.02)), axisTo: P(onPlane([0, (-0.45 + i * 0.3) * k], 0.12 * k)) }, 'vents', 'trim', 'vents');
    } else if (p.piece === 'pipes') {
      for (const j of rearJoints(c)) mono(sweeps, { id: id('pipes'), path: [onPlane([0, 0], 0.05), add(onPlane([0, 0], 0.4 * k), [0, 0, 0.3 * k]), add(j.pivot, [0, 0, 0.35 * k])].map((q) => q.map(r3)), radius: r3(0.08 * k), sides: Math.max(5, fit(0.08 * k)) }, 'pipes', 'carrier', 'pipes');
    } else if (p.piece === 'antenna') {
      const foot = onPlane([0.3 * k, 0.5 * k], 0), tip = add(add(foot, [0, 0, 1], 2.2 * k), F.n, 0.5 * k);
      mono(sweeps, { id: id('antenna'), path: [foot, add(foot, [0, 0, 1], 1.1 * k), tip].map((q) => q.map(r3)), radius: r3(0.04 * k), sides: 5 }, 'antenna', 'frame', 'antenna');
      mono(lathes, { id: id('tip'), axisFrom: P(tip), axisTo: P(add(tip, [0, 0, 1], 0.2 * k)), profile: [{ t: 0, radius: r3(0.06 * k) }, { t: 0.5, radius: r3(0.11 * k) }, { t: 1, radius: r3(0.04 * k) }], samples: 6, crossSections: 2 }, 'antenna', 'status', 'tip');
    } else if (p.piece === 'spikes') {
      for (const [x, y] of [[-0.6, 0], [0, 0], [0.6, 0]]) { const b = onPlane([x * k, y], 0); mono(lathes, { id: id('spikes'), axisFrom: P(b), axisTo: P(add(add(b, F.n, 0.9 * k), F.u, -0.35 * k)), profile: [{ t: 0, radius: r3(0.2 * k) }, { t: 1, radius: 0.01 }], samples: 5, crossSections: 2 }, 'spikes', 'armour', 'spikes'); }
    } else if (p.piece === 'fins') {
      // two swept fins, short and raked back, a hand apart across its back
      for (const sy of [-1, 1]) { const b = onPlane([-0.45 * k, sy * 0.35 * k], 0); mono(extrudes, { id: id('fins'), profile: { points: toProfile([[-0.45 * k, 0], [0.25 * k, 0], [-0.4 * k, 0.5 * k]]) }, axisFrom: P(add(b, [0, 1, 0], -0.04 * k)), axisTo: P(add(b, [0, 1, 0], 0.04 * k)) }, 'fins', 'trim', 'fins'); }
    } else if (p.piece === 'rivets') {
      for (let i = 0; i < 5; i++) mono(lathes, { id: id('rivets'), axisFrom: P(onPlane([(-0.6 + i * 0.3) * k, 0.33 * k], 0.16 * k)), axisTo: P(onPlane([(-0.6 + i * 0.3) * k, 0.33 * k], 0.21 * k)), profile: [{ t: 0, radius: r3(0.05 * k) }, { t: 1, radius: r3(0.03 * k) }], samples: 6, crossSections: 2 }, `plate-${p.socket}`, 'trim', 'rivets');
    } else if (p.piece === 'turret') {
      const b = onPlane([0, 0], 0);
      mono(lathes, { id: id('turret'), axisFrom: P(b), axisTo: P(add(b, F.n, 0.55 * k)), profile: [{ t: 0, radius: r3(0.75 * k) }, { t: 1, radius: r3(0.6 * k) }], samples: fit(0.75 * k), crossSections: 2 }, 'turret', 'mount', 'turret');
      mono(lathes, { id: id('barrel'), axisFrom: P(add(b, F.n, 0.3 * k)), axisTo: P(add(add(b, F.n, 0.35 * k), [1, 0, 0], 2 * k)), profile: [{ t: 0, radius: r3(0.14 * k) }, { t: 0.9, radius: r3(0.12 * k) }, { t: 1, radius: r3(0.17 * k) }], samples: fit(0.14 * k), crossSections: 3 }, 'turret', 'weapon', 'barrel');
    } else if (p.piece === 'livery') {
      // a decal wrapped round the core's own section, standing a hair off it: over the back and down the lead flank
      // (`lead`), or all round when even; a panel on the lead face when the core is no loft along x
      const core = c.manifest.lofts?.find((l) => l.id === 'core'), ax = core && [core.axisFrom, core.axisTo].map((q) => [q.x, q.y, q.z]);
      if (core && Math.abs(ax[1][0] - ax[0][0]) > Math.abs(ax[1][2] - ax[0][2])) {
        const mid = core.stations.reduce((a, b) => (Math.abs(b.t - 0.5) < Math.abs(a.t - 0.5) ? b : a)).profile.points, W = Math.max(...mid.map((q) => Math.abs(q[0])));
        const L = ax[1][0] - ax[0][0], x0 = ax[0][0] + L * 0.28, x1 = x0 + L * 0.2;
        // the run of the section the decal covers, contiguous round the outline
        // the armour leans to the lead flank; the colour goes to the open one, so each balances the other
        const on = mid.map(([u]) => asymmetry < 0.3 || u * -lead >= -0.12 * W);
        let start = on.findIndex((v, i) => v && !on[(i - 1 + on.length) % on.length]);
        const run = [];
        if (start < 0) for (const q of mid) run.push(q);
        else for (let i = 0; i < mid.length && on[(start + i) % mid.length]; i++) run.push(mid[(start + i) % mid.length]);
        const grow = (q, f) => [r3(q[0] * f), r3(q[1] * f)];
        // a sash is a thin crescent of the outline; a band all round, the outline itself grown a hair (its inside is the core's)
        const ring = start < 0 ? run.map((q) => grow(q, 1.025)) : [...run.map((q) => grow(q, 1.025)), ...[...run].reverse().map((q) => grow(q, 1.004))];
        mono(extrudes, { id: id('livery'), profile: { points: ring }, axisFrom: P([x0, ax[0][1], ax[0][2]]), axisTo: P([x1, ax[0][1], ax[0][2]]) }, 'livery', 'trim', 'livery');
      } else {
        const face = c.sockets.find((x) => x.face === 'side' && Math.sign(x.normal[1]) === -lead) ?? s, G2 = frame(face.normal), [ew, eh] = face.extent ?? [1, 1];
        const pts = [[-ew * 0.25, -eh * 0.175], [ew * 0.25, -eh * 0.175], [ew * 0.25, eh * 0.175], [-ew * 0.25, eh * 0.175]], on2 = (pt, out) => add(add(add(face.at, G2.u, pt[0]), G2.v, pt[1]), G2.n, out);
        mono(extrudes, { id: id('livery'), profile: { points: toProfile(pts) }, axisFrom: P(on2([0, 0], 0)), axisTo: P(on2([0, 0], 0.012)) }, 'livery', 'trim', 'livery');
      }
    } else if (p.piece === 'rack') {
      // three hafts leaning back from a bracket on the flank, their heads past the outline
      mono(extrudes, { id: id('rack'), profile: { points: toProfile([[-0.35 * k, -0.06 * k], [0.35 * k, -0.06 * k], [0.35 * k, 0.06 * k], [-0.35 * k, 0.06 * k]]) }, axisFrom: P(onPlane([0, 0.1 * k], 0)), axisTo: P(onPlane([0, 0.1 * k], 0.1 * k)) }, 'rack', 'mount', 'plate');
      for (const j of [-1, 0, 1]) mono(sweeps, { id: id('rack'), path: [onPlane([j * 0.25 * k, -0.2 * k], 0.08 * k), add(onPlane([j * 0.25 * k - 0.35 * k, 0.2 * k], 0.12 * k), [0, 0, 1], 1.1 * k)].map((q) => q.map(r3)), radius: r3(0.035 * k), sides: 5 }, 'rack', 'weapon', 'barrel');
    } else if (p.piece === 'dish') {
      // a dish no wider than the face it is hung from
      k = Math.min(k, Math.max(...(s.extent ?? [2, 2])) * 0.45);
      const b = add(onPlane([0, 0], 0.6 * k), [0, 0, 1], 0.3 * k);
      mono(sweeps, { id: id('dish-arm'), path: [onPlane([0, 0], 0), b].map((q) => q.map(r3)), radius: r3(0.08 * k), sides: 5 }, 'dish', 'frame', 'antenna');
      mono(lathes, { id: id('dish'), axisFrom: P(add(b, F.n, -0.25 * k)), axisTo: P(add(b, F.n, 0.1 * k)), profile: [{ t: 0, radius: r3(0.08 * k) }, { t: 0.6, radius: r3(0.75 * k) }, { t: 1, radius: r3(0.95 * k) }], samples: fit(0.95 * k), crossSections: 3 }, 'dish', 'sensor', 'dish');
    } else if (p.piece === 'status') {
      const b = onPlane([0.3 * k, 0.2 * k], 0);
      mono(lathes, { id: id('status'), axisFrom: P(b), axisTo: P(add(b, F.n, 0.22 * k)), profile: [{ t: 0, radius: r3(0.08 * k) }, { t: 0.5, radius: r3(0.13 * k) }, { t: 1, radius: r3(0.05 * k) }], samples: 6, crossSections: 2 }, 'status', 'status', 'tip');
    } else if (p.piece === 'crates') {
      for (const [i, [x, y]] of [[0, [-0.45, -0.3]], [1, [0.45, -0.3]], [2, [0, 0.35]]]) mono(extrudes, { id: id('crates'), profile: { rect: { w: r3(0.75 * k), h: r3(0.6 * k), r: 0 } }, axisFrom: P(onPlane([x * k, y * k], 0)), axisTo: P(onPlane([x * k, y * k], (0.55 + 0.1 * i) * k)) }, 'crates', 'store', 'crates');
    } else if (p.piece === 'bands') {
      const D = c.dims;
      for (const f of [0.33, 0.66]) { const z = D.lift + (D.top - D.lift) * f, w = D.w0 + (D.w1 - D.w0) * f; mono(lathes, { id: id('bands'), axisFrom: P([0, 0, z]), axisTo: P([0, 0, z + 0.3 * k]), profile: [{ t: 0, radius: r3(w * 1.05) }, { t: 0.5, radius: r3(w * 1.08) }, { t: 1, radius: r3(w * 1.05) }], samples: fit(w * 1.08), crossSections: 2 }, 'bands', 'trim', 'bands'); }
    } else if (p.piece === 'lantern') {
      const b = onPlane([0, 0], 0);
      // a gallery ring, the glass room, and its cap: the lighthouse's crown
      mono(lathes, { id: id('gallery'), axisFrom: P(b), axisTo: P(add(b, [0, 0, 1], 0.35 * k)), profile: [{ t: 0, radius: r3(1.5 * k) }, { t: 1, radius: r3(1.5 * k) }], samples: fit(1.5 * k), crossSections: 2 }, 'lantern', 'trim', 'gallery');
      mono(lathes, { id: id('lantern'), axisFrom: P(add(b, [0, 0, 1], 0.35 * k)), axisTo: P(add(b, [0, 0, 1], 2.1 * k)), profile: [{ t: 0, radius: r3(1.05 * k) }, { t: 1, radius: r3(1.05 * k) }], samples: Math.max(8, fit(1.05 * k)), crossSections: 2 }, 'lantern', 'lamp', 'lantern');
      mono(lathes, { id: id('cap'), axisFrom: P(add(b, [0, 0, 1], 2.1 * k)), axisTo: P(add(b, [0, 0, 1], 3.4 * k)), profile: [{ t: 0, radius: r3(1.35 * k) }, { t: 0.15, radius: r3(1.25 * k) }, { t: 1, radius: r3(0.08 * k) }], samples: fit(1.35 * k), crossSections: 4 }, 'lantern', 'trim', 'cap');
    }
  }
  return { extrudes, lathes, sweeps, pieces };
}

/**
 * A thing's chassis with its adornment, solved: proposed, hung, read, and moved until every law holds, a bounded number
 * of passes, every pass logged. The moves are the solver's, never a form's: more points round when facets read too wide,
 * fewer when too narrow or when the hero must lead; the lead grown when another piece takes the picture; limbs drawn in
 * when a quieter rank shows too many silhouette segments; what stands past the outline added, by motif, when a louder
 * rank shows too few.
 */
export function buildAdorned(t, { kind, direction = {}, rank = 'interactable', use = 'watched', picks: given, passes = 8 } = {}) {
  const motif = direction.motif ?? 'smooth', style = direction.style ?? 'wc3', camera = direction.camera ?? 'third-person';
  const pxm = pxPerMetre(meetDistance(camera, t.block.tier, use)), limit = TECH_STYLES[style].facetPx, asymmetry = direction.asymmetry ?? TECH_STYLES[style].asymmetry ?? 0;
  const base = buildChassis(t, { kind, direction, rank, use });
  let res = base.res, thick = { ...base.thick }, tuck = 1, extra = [], trim = 0, drop = [], lean = null, out;
  const log = [];
  for (let p = 0; p < passes; p++) {
    const c = chassisManifest(t, { kind, motif, style, camera, use, setting: direction.setting, res, thick, tuck, drop }), { fit } = fitter(pxm, limit[1], res, TECH_STYLES[style].outlinePx);
    const read = (picks) => {
      const A = adornManifest(c, picks, { motif, fit, asymmetry, lead: L0.lead });
      lean = { amount: asymmetry, lead: L0.lead < 0 ? 'left' : 'right', why: L0.why };
      const manifest = { ...c.manifest, extrudes: [...(c.manifest.extrudes ?? []), ...A.extrudes], lathes: [...(c.manifest.lathes ?? []), ...A.lathes], sweeps: [...(c.manifest.sweeps ?? []), ...A.sweeps] };
      const pieces = { ...c.pieces, ...A.pieces }, faces = lowerChassis(manifest, pieces);
      return { manifest, pieces, faces, readout: techReadout(faces, { tier: t.block.tier, rank, use, camera, style }) };
    };
    // the proposal, less the `trim` it was asked to drop: the last suggested first, never what a promise asked for
    const L0 = leadSide(c, suggestAdornment(c, t, { motif, rank }), t.intent ?? t.variant), suggested = given ? null : suggestAdornment(c, t, { motif, rank, asymmetry, lead: L0.lead }), keep = (list) => { let n = trim; return [...list].reverse().filter((x) => (n > 0 && !x.serves.some((f) => c.promised.includes(f)) ? (n--, false) : true)).reverse(); };
    let picks = given ?? [...keep(suggested), ...extra.filter((e) => c.sockets.some((x) => x.id === e.socket))], r = read(picks);
    // under its rank's silhouette floor: what stands past the outline, by motif, until the floor is met
    const topmost = [...c.sockets].filter((x) => x.face === 'top').sort((a, b) => b.at[2] - a.at[2])[0];
    if (!given) for (const [piece, face] of STANDERS[motif] ?? STANDERS.smooth) {
      if (r.readout.segments >= r.readout.segmentBand[0]) break;
      const socket = (onCore(c, face)[0] ?? (face === 'top' ? topmost : null))?.id;
      if (!socket || picks.some((x) => x.piece === piece && x.socket === socket)) continue;
      const pick = { piece, socket, serves: ADORNMENT_PIECES[piece].serves, why: `its silhouette: ${r.readout.segments} segments, a ${rank} shows ${r.readout.segmentBand[0]}` };
      picks = [...picks, pick]; extra = [...extra, pick];
      r = read(picks);
    }
    // every thing carries its one status light: an antenna's tip, or a lamp on its top
    if (!given && !picks.some((x) => x.piece === 'antenna')) { const at = onCore(c, 'top')[0] ?? topmost; if (at) { picks = [...picks, { piece: 'status', socket: at.id, serves: [], why: 'the one accent: the status light, on what you use' }]; r = read(picks); } }
    const { readout } = r, shown = new Set(picks.flatMap((x) => x.serves)), functions = [...new Set([...c.functions, ...t.block.functions.filter((f) => shown.has(f))])];
    const laws = chassisLaws(r.faces, { ...c, functions }, readout).map((l) => (l.law === 'inverse-interest' ? { ...l, ok: readout.segments >= readout.segmentBand[0] && readout.segments <= readout.segmentBand[1], value: `${readout.segments} segments (${readout.segmentBand.join('–')})` } : l));
    const unshown = t.block.functions.filter((f) => !functions.includes(f));
    laws.push(unshown.length ? { law: 'promises-kept', ok: false, value: `promised and not shown: ${unshown.join(', ')}` } : { law: 'promises-kept', ok: true, value: c.promised.length ? `kept: ${c.promised.join(', ')}` : 'nothing promised' });
    out = { ...c, ...r, picks, added: extra.map((e) => `${e.piece}@${e.socket}`), functions, laws, res, thick, tuck, asymmetry: lean, held: laws.every((l) => l.ok) };
    const failed = laws.filter((l) => !l.ok), entry = { pass: p + 1, res, tuck, triangles: readout.triangles, facetPx: readout.facetLaw.value, segments: readout.segments, failed: failed.map((l) => l.law) };
    log.push(entry);
    if (!failed.length || p === passes - 1) break;
    const changed = [], F = readout.facetPx, FL = readout.facetLaw;
    const bothWays = failed.some((l) => l.law === 'facets') && FL.value > FL.limit && failed.some((l) => l.law === 'budget');
    if (bothWays) { out.conflict = { laws: ['facets', 'budget'], why: `a ${rank} of this size, met at ${readout.distance} m, cannot hold its rounds within ${FL.limit} px (${FL.measure}) and spend under ${readout.ceiling} triangles (a ${use} ${rank})`, proposal: `a louder rank (${LOUDER[rank] ?? rank}), a nearer use, fewer rounds in its body plan, or a further camera` }; entry.changed = ['conflict named']; break; }
    if (failed.some((l) => l.law === 'facets') && FL.value > FL.limit && res < 4) { res = Math.round(Math.min(4, res * Math.max(1.05, stepOf(FL))) * 1000) / 1000; changed.push(`res ${res} (${FL.measure} ${FL.value} px)`); }
    else if ((failed.some((l) => l.law === 'facets') && F.median < limit[0] && F.wasted > 0.25) || failed.some((l) => l.law === 'budget')) { if (res > 0.4) { res = Math.round(Math.max(0.4, res * 0.8) * 1000) / 1000; changed.push(`res ${res} (${F.median < limit[0] ? 'facets wasted' : 'over budget'})`); } }
    if (failed.some((l) => l.law === 'one-leads') && (thick[leadOf(c)] ?? 1) < LEAD_GROW) { const p0 = leadOf(c); thick = { ...thick, [p0]: Math.round(Math.min(LEAD_GROW, (thick[p0] ?? 1) * 1.12) * 1000) / 1000 }; changed.push(`${p0} × ${thick[p0]} (one leads)`); }
    if (readout.segments > readout.segmentBand[1]) {
      if (extra.length) { extra = extra.slice(0, -1); changed.push('one stander fewer (too many segments)'); }
      else if (tuck > 0.5 && c.masses.some((x) => x.seg && x.role === 'running')) { tuck = Math.round(Math.max(0.5, tuck * 0.8) * 1000) / 1000; changed.push(`limbs drawn in, × ${tuck} (too many segments)`); }
      else if (!given && trim < suggested.filter((x) => !x.serves.some((f) => c.promised.includes(f))).length) { trim++; changed.push(`one adornment fewer (too many segments)`); }
      else if (drop.length < c.optional.length) { drop = c.optional.slice(c.optional.length - drop.length - 1); changed.push(`its ${drop[0]} dropped (too many segments)`); }
    }
    entry.changed = changed;
    // two laws that pull the resolution against each other (facets up, the hero's lead down) cannot both hold for this
    // brief: the solver names it, and what would settle it, rather than swing between them
    const swing = log.length >= 3 && log.slice(-3).every((e) => e.failed.includes('facets') || e.failed.includes('budget')) && log.at(-1).failed.includes('budget') !== log.at(-2).failed.includes('budget');
    if (swing) { out.conflict = { laws: ['facets', 'budget'], why: `a ${rank} of this size, met at ${readout.distance} m, cannot hold its rounds within ${FL.limit} px (${FL.measure}) and spend under ${readout.ceiling} triangles (a ${use} ${rank})`, proposal: `a louder rank (${LOUDER[rank] ?? rank}), a nearer use, fewer rounds in its body plan, or a further camera` }; break; }
    if (!changed.length) break;
  }
  return { ...out, passes: log };
}

/** What stands past the outline when a rank asks for more segments, by motif, in the order it is reached for: a piece
 * and the face of the core it goes on. */
const STANDERS = Object.freeze({
  smooth: [['fins', 'top'], ['antenna', 'top'], ['antenna', 'front'], ['antenna', 'rear']],
  organic: [['fins', 'top'], ['spikes', 'top'], ['antenna', 'top'], ['spikes', 'side'], ['antenna', 'rear']],
  faceted: [['antenna', 'top'], ['fins', 'top'], ['antenna', 'front'], ['antenna', 'rear']],
  riveted: [['antenna', 'top'], ['vents', 'rear'], ['antenna', 'front'], ['antenna', 'rear']],
  spiked: [['spikes', 'top'], ['spikes', 'side'], ['antenna', 'top'], ['spikes', 'front'], ['antenna', 'rear']],
  ornate: [['antenna', 'top'], ['fins', 'top'], ['antenna', 'front'], ['antenna', 'rear']],
});
