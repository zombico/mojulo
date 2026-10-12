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
import { chassisManifest, lowerChassis, chassisLaws, fitter, buildChassis, stepOf } from './tech-chassis.js';
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
  dish: { read: 'a dish on an arm: it listens', serves: ['sense'], role: 'sensor', stands: true },
  lantern: { read: 'a lantern room under its cap: it lights', serves: ['light'], role: 'lamp' },
  bands: { read: 'bands round a shaft: its height read in steps', serves: [], role: 'trim' },
  crates: { read: 'crates lashed on its back: what it carries', serves: ['store'], role: 'store' },
  status: { read: 'the status light: the one accent, on what you use', serves: [], role: 'status' },
});

// the values a piece takes on its group: a plate a band off the body, glass dark, the status light the accent
const LOOK = { plate: ['tech:trim', 0.5], visor: ['tech:glass', 0.12], eye: ['tech:glass', 0.15], 'eye-ring': ['tech:frame', 0.38], vents: ['tech:frame', 0.3], pipes: ['tech:cable', 0.3], antenna: ['tech:frame', 0.42], tip: ['str:accent', 0.9], spikes: ['tech:trim', 0.62], fins: ['tech:skin', 0.82], rivets: ['tech:frame', 0.35], turret: ['tech:body', 0.66], barrel: ['tech:frame', 0.4], dish: ['tech:skin', 0.86], crates: ['tech:skin', 0.7], lantern: ['tech:light', 0.9], cap: ['tech:skin', 0.82], gallery: ['tech:trim', 0.5], bands: ['tech:trim', 0.5] };
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
export function suggestAdornment(c, t, { motif = 'smooth', rank = 'interactable' } = {}) {
  const picks = [], add1 = (piece, s, why) => { if (s && !picks.some((p) => p.piece === piece && p.socket === s.id)) picks.push({ piece, socket: s.id, serves: ADORNMENT_PIECES[piece].serves, why }); };
  const many = { filler: 0, prop: 1, interactable: 2, focus: 3 }[rank], moves = c.functions.includes('move'), landmark = ['landmark', 'installation'].includes(t.block.tier) && !moves;
  const topmost = [...c.sockets].filter((x) => x.face === 'top').sort((a, b) => b.at[2] - a.at[2])[0];
  for (const f of c.promised) {
    if (f === 'guard') {
      for (const s of onCore(c, 'side')) add1('plate', s, 'guard: promised by its words, on the core\'s flanks');
      if (many >= 2) for (const s of c.sockets.filter((x) => x.face === 'outer')) add1('plate', s, 'guard: promised by its words, on its limbs');
    } else if (f === 'strike') add1('turret', onCore(c, 'top')[0] ?? onCore(c, 'front')[0], 'strike: promised by its words, on the core\'s back');
    else if (f === 'sense') add1(moves ? 'eye' : 'dish', moves ? onCore(c, 'front')[0] : crownMass(c)[0] ?? onCore(c, 'top')[0], 'sense: promised by its words');
    else if (f === 'light') add1('lantern', topmost, 'light: promised by its words, at its crown');
    else if (f === 'signal') add1('antenna', onCore(c, 'top')[0] ?? topmost, 'signal: promised by its words');
    else if (f === 'store') add1('crates', onCore(c, 'top')[0] ?? onCore(c, 'rear')[0], 'store: promised by its words, what it carries shows');
    else if (f === 'power') add1('vents', onCore(c, 'top')[0] ?? onCore(c, 'rear')[0], 'power: promised by its words, it breathes');
  }
  // the face a thing that moves is read by: a visor and an eye on the core's front
  if (moves) { const f = onCore(c, 'front')[0]; add1('visor', f, 'its face: what the eye finds first'); if (!picks.some((p) => p.piece === 'eye')) add1('eye', f, 'its face: what it looks with'); }
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
  return picks;
}
/** The joints at a thing's rear that hang off its core: where hoses run to. */
const rearJoints = (c) => c.joints.filter((j) => j.parent === 'core' && j.pivot[0] < -0.01 && !/^(pitch|crown)/.test(j.id));

/** The pieces as monomers, each in its socket's frame. */
export function adornManifest(c, picks, { motif = 'smooth', fit = () => 8 } = {}) {
  const extrudes = [], lathes = [], sweeps = [], pieces = {}, n = { };
  const mono = (arr, spec, piece, role, look) => { const [group, value] = LOOK[look]; arr.push({ ...spec, group, tint: GREY(value) }); pieces[spec.id] = { piece, role, value }; };
  const S = Object.fromEntries(c.sockets.map((s) => [s.id, s])), scale = c.scale ?? 1;
  for (const p of picks) {
    const s = S[p.socket], F = frame(s.normal), at = s.at;
    let k = { small: 0.55, medium: 1, large: 1.3 }[s.size] * scale;
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
  const pxm = pxPerMetre(meetDistance(camera, t.block.tier, use)), limit = TECH_STYLES[style].facetPx;
  const base = buildChassis(t, { kind, direction, rank, use });
  let res = base.res, thick = { ...base.thick }, tuck = 1, extra = [], out;
  const log = [];
  for (let p = 0; p < passes; p++) {
    const c = chassisManifest(t, { kind, motif, style, camera, use, res, thick, tuck }), { fit } = fitter(pxm, limit[1], res, TECH_STYLES[style].outlinePx);
    const read = (picks) => {
      const A = adornManifest(c, picks, { motif, fit });
      const manifest = { ...c.manifest, extrudes: [...(c.manifest.extrudes ?? []), ...A.extrudes], lathes: [...(c.manifest.lathes ?? []), ...A.lathes], sweeps: [...(c.manifest.sweeps ?? []), ...A.sweeps] };
      const pieces = { ...c.pieces, ...A.pieces }, faces = lowerChassis(manifest, pieces);
      return { manifest, pieces, faces, readout: techReadout(faces, { tier: t.block.tier, rank, use, camera, style }) };
    };
    let picks = given ?? [...suggestAdornment(c, t, { motif, rank }), ...extra.filter((e) => c.sockets.some((x) => x.id === e.socket))], r = read(picks);
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
    out = { ...c, ...r, picks, added: extra.map((e) => `${e.piece}@${e.socket}`), functions, laws, res, thick, tuck, held: laws.every((l) => l.ok) };
    const failed = laws.filter((l) => !l.ok), entry = { pass: p + 1, res, tuck, triangles: readout.triangles, facetPx: readout.facetLaw.value, segments: readout.segments, failed: failed.map((l) => l.law) };
    log.push(entry);
    if (!failed.length || p === passes - 1) break;
    const changed = [], F = readout.facetPx, FL = readout.facetLaw;
    const bothWays = failed.some((l) => l.law === 'facets') && FL.value > FL.limit && failed.some((l) => l.law === 'budget');
    if (bothWays) { out.conflict = { laws: ['facets', 'budget'], why: `a ${rank} of this size, met at ${readout.distance} m, cannot hold its rounds within ${FL.limit} px (${FL.measure}) and spend under ${readout.ceiling} triangles (a ${use} ${rank})`, proposal: `a louder rank (${rank === 'prop' ? 'interactable' : 'focus'}), a nearer use, fewer rounds in its body plan, or a further camera` }; entry.changed = ['conflict named']; break; }
    if (failed.some((l) => l.law === 'facets') && FL.value > FL.limit && res < 4) { res = Math.round(Math.min(4, res * Math.max(1.05, stepOf(FL))) * 1000) / 1000; changed.push(`res ${res} (${FL.measure} ${FL.value} px)`); }
    else if ((failed.some((l) => l.law === 'facets') && F.median < limit[0] && F.wasted > 0.25) || failed.some((l) => l.law === 'budget')) { if (res > 0.4) { res = Math.round(Math.max(0.4, res * 0.8) * 1000) / 1000; changed.push(`res ${res} (${F.median < limit[0] ? 'facets wasted' : 'over budget'})`); } }
    if (failed.some((l) => l.law === 'one-leads')) { thick = { ...thick, [c.lead]: Math.round((thick[c.lead] ?? 1) * 1.12 * 1000) / 1000 }; changed.push(`${c.lead} × ${thick[c.lead]} (one leads)`); }
    if (readout.segments > readout.segmentBand[1]) {
      if (extra.length) { extra = extra.slice(0, -1); changed.push('one stander fewer (too many segments)'); }
      else if (tuck > 0.5) { tuck = Math.round(Math.max(0.5, tuck * 0.8) * 1000) / 1000; changed.push(`limbs drawn in, × ${tuck} (too many segments)`); }
    }
    entry.changed = changed;
    // two laws that pull the resolution against each other (facets up, the hero's lead down) cannot both hold for this
    // brief: the solver names it, and what would settle it, rather than swing between them
    const swing = log.length >= 3 && log.slice(-3).every((e) => e.failed.includes('facets') || e.failed.includes('budget')) && log.at(-1).failed.includes('budget') !== log.at(-2).failed.includes('budget');
    if (swing) { out.conflict = { laws: ['facets', 'budget'], why: `a ${rank} of this size, met at ${readout.distance} m, cannot hold its rounds within ${FL.limit} px (${FL.measure}) and spend under ${readout.ceiling} triangles (a ${use} ${rank})`, proposal: `a louder rank (${rank === 'prop' ? 'interactable' : 'focus'}), a nearer use, fewer rounds in its body plan, or a further camera` }; break; }
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
