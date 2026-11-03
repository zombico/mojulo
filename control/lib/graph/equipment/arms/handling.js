// equipment/arms/handling — what a hand, a cheek and a shooter's eye need of an arm, read off the arm as the kernel draws
// it (never a proxy box): its STATIONS and its HANDLING. Pure, deterministic, memoised by the build.
//
//   STATIONS (the item's own centimetres: the bore along +z at y = 0, +y up, x across; the same frame as its sockets)
//     strong    the fist on the grip: the grip socket's place and its line (the line through the fist, raked back)
//     trigger   the trigger's face: where the index's pad lands on a press, and the length of pull back from it
//     index     where the index lies straight along the frame above the guard while not firing (trigger discipline)
//     support   where the support hand closes: a vertical foregrip (held as a grip), else the pump, the handguard or the
//               body ahead of the guard (a cylinder along the bore, its radius the part's half girth, the hand free to
//               slide along `slide`); a handgun has none of its own, the support hand wraps the strong one (`wrap`)
//     butt      the stock's pad (the shoulder pocket's), absent on a handgun
//     sight     the sight line: { y (its height over the bore), rear, front (z), kind (irons | reddot | holo | scope |
//               smart), zoom (the magnification it reads at), relief (cm the eye sits behind its rear: a scope's is
//               fixed; an open sight's is where the cheek puts it) }
//     magazine  the magazine's well and its bottom (a reload's hand goes there)
//     muzzle    the tip socket
//   HANDLING (class estimates for a game: realistic magnitudes, never one maker's figures)
//     kg (loaded), class (handgun | long | shotgun), aimTime (s to bring the sights to the eye), swapOut / swapIn (s to
//     stow it and to draw it ready), sway (the held muzzle's wander at the aim, milliradians), recoil (the muzzle's climb
//     per shot, degrees), zoom (the sight's).
//
// Groups are the builders' own (`grip`, `trigger`, `handguard`, `pump`, `foregrip`, `optic`, `sights`, `stock`,
// `buttpad`, `magazine`, `body`): each group's monomers are lowered by the workbench and bounded, so a part's station is
// where its faces are.
import { expandEquipment } from '../expand.js';
import { lowerObjectFaces } from '../../worlds/workbench.js';
import { DEFAULT_LIGHT } from '../../polygonizer/vexar.js';
import { ARM_MODELS, armClass } from './models.js';
import { resolveArm } from './index.js';

const r2 = (v) => Math.round(v * 100) / 100 + 0, r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

/** a sight's magnification by its word (a scope reads at a hunting rifle's low power; a smart sight's display at 1.5) */
export const SIGHT_ZOOM = Object.freeze({ irons: 1, reddot: 1, holo: 1, smart: 1.5, scope: 4, none: 1 });
/** a scope's eye relief (cm): the eye this far behind its rear lens sees the whole picture */
export const SCOPE_RELIEF = 8.5;

/**
 * HANDLING by class and model (estimates of the class, marked so: loaded mass in kg, seconds, milliradians, degrees).
 * A sniper's long scope and its mass make it the slowest to the eye and the steadiest there; a handgun the quickest.
 */
const BY_ITEM = Object.freeze({
  pistol: { class: 'handgun', kg: 0.9, aimTime: 0.16, swapOut: 0.22, swapIn: 0.3, sway: 3.2, recoil: 4.2 },
  carbine: { class: 'long', kg: 3.2, aimTime: 0.26, swapOut: 0.32, swapIn: 0.48, sway: 2.2, recoil: 1.6 },
  rifle: { class: 'long', kg: 3.6, aimTime: 0.3, swapOut: 0.34, swapIn: 0.52, sway: 2, recoil: 1.8 },
  smg: { class: 'long', kg: 2.8, aimTime: 0.22, swapOut: 0.28, swapIn: 0.4, sway: 2.4, recoil: 1.2 },
  shotgun: { class: 'shotgun', kg: 3.6, aimTime: 0.3, swapOut: 0.36, swapIn: 0.55, sway: 2.4, recoil: 6 },
});
const BY_MODEL = Object.freeze({
  'pistol/compact': { kg: 0.75, aimTime: 0.15 }, 'pistol/heavy': { kg: 1.2, recoil: 6 }, 'pistol/revolver': { kg: 1.1, recoil: 6.5 },
  'pistol/smart': { kg: 0.95 },
  'rifle/marksman': { kg: 4.8, aimTime: 0.4, swapIn: 0.6, sway: 1.4, recoil: 2.6 },
  'rifle/sniper': { zoom: 8, kg: 6.4, aimTime: 0.5, swapOut: 0.42, swapIn: 0.7, sway: 1.1, recoil: 5.5 },
  'rifle/caseless': { kg: 3.9 }, 'rifle/coilgun': { kg: 5.2, aimTime: 0.36, recoil: 1.2 }, 'rifle/bullpup': { kg: 3.8, aimTime: 0.27 },
  'smg/pdw': { kg: 2.6 }, 'shotgun/breacher': { kg: 4.2, recoil: 4 }, 'shotgun/tactical': { kg: 3.8 },
});

const MEMO = new Map();
/** each group's bounds (lo, hi in cm) as the workbench draws it, and the expanded arm */
function groupBounds(build) {
  const key = JSON.stringify(build);
  if (MEMO.has(key)) return MEMO.get(key);
  const e = expandEquipment({ type: 'equipment', ...build });
  const groups = {};
  for (const [k, arr] of Object.entries(e.monomers)) for (const m of arr || []) { const g = m.group || '?'; ((groups[g] ||= {})[k] ||= []).push(m); }
  const bounds = {};
  for (const [g, man] of Object.entries(groups)) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of lowerObjectFaces({ kind: 'workbench', units: 'cm', ...man }, DEFAULT_LIGHT)) for (const c of f.corners || []) { const p = xyz(c); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } }
    if (Number.isFinite(lo[0])) bounds[g] = { lo, hi };
  }
  const out = { e, bounds };
  if (MEMO.size > 32) MEMO.clear();
  MEMO.set(key, out);
  return out;
}

/** the groups a hand, a cheek or a body may meet (the bore's dark, a glow, a seam or a screen draw no volume of their own) */
const SOLID = (g) => !['bore', 'glow', 'seam', 'screen', 'display', 'port', 'serrations', 'vents', 'pins', '?'].includes(g);
/** An arm as boxes, one per part ([lo, hi, colour, part] in its centimetres): what a carried thing's clearance and its
 * proxy drawing read (hero-carry), and a game's viewmodel (gameworld/arms-kit.js); the arm itself is drawn as gear. */
export function armBoxes(build) {
  const { bounds } = groupBounds(build);
  return Object.entries(bounds).filter(([g]) => SOLID(g)).map(([g, b]) => [b.lo.map(r3), b.hi.map(r3), g === 'grip' || g === 'buttpad' || g === 'foregrip' ? '#26282b' : '#3b3f45', g]);
}

/**
 * An arm's stations and handling (see the head). `build` an arm's build words ({ item, model?, line?, parts? }); a knife
 * has no stations here (it is held as a blade: hero-grip).
 */
export function armHandling(build) {
  if (!ARM_MODELS[build?.item]) throw new Error(`arms handling: '${build?.item}' is not an arm (${Object.keys(ARM_MODELS).join(', ')})`);
  if (armClass(build.item) === 'blade') throw new Error('arms handling: a knife is held as a blade (hero-grip), not shouldered or sighted');
  const { model, parts } = resolveArm(build);
  const { e, bounds: B } = groupBounds(build);
  const S = e.sockets, grip = S.grip;
  const mid = (b, i) => (b.lo[i] + b.hi[i]) / 2;
  // the trigger: its face's lowest forward point, where the index's pad presses; its pull back along the bore
  const tr = B.trigger;
  const trigger = tr ? { at: [0, r3(tr.lo[1] + 0.65 * (tr.hi[1] - tr.lo[1])), r3(tr.hi[2] - 0.15)], pull: 0.6 } : null;
  // the index along the frame above the guard, straight (out of the trigger), a finger's width over the trigger's top
  const guard = B.guard;
  const index = tr && guard ? { at: [r3(B.grip ? B.grip.hi[0] + 0.3 : 1.6), r3(guard.hi[1] + 0.8), r3(tr.hi[2] + 2.5)], a: [0, 0, 1] } : null;
  // the support hand: a vertical foregrip, the pump, the handguard, the body forward of the guard
  let support = null;
  const fg = parts.underbarrel === 'grip' && B.foregrip;
  // (a vertical grip is held as a magazine is: the line through the fist up it, the hand's axis along the bore, free to roll)
  if (fg) support = { kind: 'foregrip', at: [0, r3(mid(fg, 1)), r3(mid(fg, 2))], c: [0, 1, 0], a: [0, 0, 1], r: r3((fg.hi[2] - fg.lo[2]) / 2), roll: [-180, 150] };
  else {
    const part = B.pump ?? B.handguard ?? (B.body && guard ? { lo: [B.body.lo[0], B.body.lo[1], guard.hi[2] + 1], hi: [B.body.hi[0], Math.min(B.body.hi[1], 2.5), B.body.hi[2]] } : null);
    if (!(part && part.hi[2] - part.lo[2] > 4) && guard && tr && guard.hi[2] - tr.hi[2] > 4) {
      // a guard run forward into a loop (a bullpup PDW's): the support hand closes on its front as on a foregrip
      support = { kind: 'loop', at: [0, r3(mid(guard, 1)), r3(guard.hi[2] - 1.2)], c: [0, 1, 0], a: [0, 0, 1], r: r3((guard.hi[0] - guard.lo[0]) / 2), roll: [-180, 150] };
    } else if (part && part.hi[2] - part.lo[2] > 4) {
      const y = mid(part, 1), r = Math.max(part.hi[0] - part.lo[0], part.hi[1] - part.lo[1]) / 2;
      // the hand ranges from a palm past the part's rear to a palm short of its front (a pump is held round its middle)
      const z0 = part.lo[2] + 4, z1 = Math.max(z0, part.hi[2] - 4);
      // (the hand's axis a third of the way along the bore; a far handguard is reached with the forearm near its line, the
      // hand's axis along it: the fallback a hand takes when the first will not close)
      const at = [0, r3(y), r3((z0 + z1) / 2)];
      support = { kind: B.pump ? 'pump' : B.handguard ? 'handguard' : 'body', at, c: [0, 0, 1], a: [-0.7, 0.25, 0.55], r: r3(r), roll: [-180, 150], ...(B.pump ? {} : { slide: [r3(z0), r3(z1)] }),
        alt: { at: [0, r3(y), r3(z0)], c: [0, 0, 1], a: [-0.42, 0.14, 0.9], roll: [-180, 150] } };
    }
  }
  const handgun = BY_ITEM[build.item].class === 'handgun';
  if (handgun) support = { kind: 'wrap', at: [3.3, r3(grip.origin[1] - 0.9), r3(grip.origin[2] + 1.4)], c: [0, 0.98, 0.2], a: [0, -0.2, 0.98] };
  // the sight line: an optic's window (a scope's axis), else the irons' tops
  const kind = parts.optic && parts.optic !== 'none' ? parts.optic : 'irons';
  let sight;
  if (kind !== 'irons' && B.optic) {
    const o = B.optic, y = kind === 'scope' ? mid(o, 1) : o.lo[1] + 0.62 * (o.hi[1] - o.lo[1]);
    sight = { y: r3(y), rear: r3(o.lo[2]), front: r3(o.hi[2]), kind, zoom: (kind === 'scope' && BY_MODEL[`${build.item}/${model}`]?.zoom) || (SIGHT_ZOOM[kind] ?? 1), relief: kind === 'scope' ? SCOPE_RELIEF : null };
  } else {
    // (a bead alone, a shotgun's: the eye runs along the receiver's top to it)
    const s = B.sights ?? B.rail ?? B.upper ?? B.body ?? B.frame, top = B.slide ?? B.upper ?? B.receiver ?? B.body ?? B.frame;
    const bead = B.sights && B.sights.hi[2] - B.sights.lo[2] < 5;
    const y = s ? s.hi[1] : 3, rear = bead && top ? top.lo[2] : s ? s.lo[2] : -5, front = B.sights ? B.sights.hi[2] : S.tip.origin[2] - 2;
    sight = { y: r3(y), rear: r3(rear), front: r3(front), kind: 'irons', zoom: 1, relief: null };
  }
  const mag = B.magazine ? { at: [0, r3(B.magazine.hi[1] - 1), r3(mid(B.magazine, 2))], bottom: [0, r3(B.magazine.lo[1]), r3(mid(B.magazine, 2))] } : null;
  const { zoom: _z, ...own } = BY_MODEL[`${build.item}/${model}`] ?? {};
  const base = { ...BY_ITEM[build.item], ...own };
  // a magnified sight is slower to the eye and steadier on the mark (the eye finds the picture)
  const z = sight.zoom;
  const handling = { ...base, kg: r2(base.kg * (build.dials?.mass ?? 1)), aimTime: r2(base.aimTime + 0.05 * Math.max(0, z - 1)), sway: r2(base.sway / (1 + 0.15 * Math.max(0, z - 1))), zoom: z, estimate: true };
  return {
    item: build.item, model, class: base.class,
    stations: {
      // (the grip's girth: its width and the 3.9 cm the builders draw it front to back, as a round haft the fist closes on)
      // (a fist that will not close square on it rolls round the grip's line, the web of the hand off the back strap)
      strong: { at: grip.origin, c: grip.axis, a: [0, 0, 1], r: r3(B.grip ? ((B.grip.hi[0] - B.grip.lo[0]) / 2 + 1.95) / 2 : 1.7), alt: { at: grip.origin, c: grip.axis, a: [0, 0, 1], roll: [-30, 30] } },
      ...(trigger ? { trigger } : {}), ...(index ? { index } : {}), ...(support ? { support } : {}),
      ...(S.stock && !handgun ? { butt: { at: S.stock.origin } } : {}),
      sight, ...(mag ? { magazine: mag } : {}), muzzle: { at: S.tip.origin },
    },
    handling,
    length: e.trace.length,
  };
}
