// equipment/sword — the sword family (dagger, sword, greatsword): an axial chain pommel → grip → guard → blade,
// seated flush from z = 0 up, every slot tagged `group: <slot>`. Real dimensions (cm) below; the laws move them.
//   blade   a loft along a sampled path: widths per edge, a fuller notch, a spine, barbs, a curve (sabre)
//   guard   bar · crescent · block · spiked · disc (a tsuba with a rim) · winged (three feathers a side)
//   grip    leather (ridged) · banded · wire (a helix) · cord (two crossing helices)
//   pommel  wheel · block · spike · cap · ring · cage (sized by its stone, prongs touching the girdle)
import { proportion, focalStone, recede } from './principles.js';
import { mulberry32, r3, P, A, clamp01, smooth, circle, mat, mergeInto, setStone, feather, girdleOf } from './shapes.js';

export const SWORDS = Object.freeze({
  dagger: { blade: { L: 24, W: 3.4, T: 0.5 }, grip: { L: 10, R: 1.25 }, guard: { span: 9, H: 1.3, D: 1.8 }, pommel: { R: 1.8 } },
  sword: { blade: { L: 78, W: 4.6, T: 0.6 }, grip: { L: 16, R: 1.5 }, guard: { span: 20, H: 1.8, D: 2.4 }, pommel: { R: 2.6 } },
  greatsword: { blade: { L: 112, W: 5.6, T: 0.7 }, grip: { L: 32, R: 1.7 }, guard: { span: 34, H: 2.4, D: 3 }, pommel: { R: 3.3 } },
});

// widths(t) → [right, left] half-widths as fractions of W/2; path(t) → lateral x offset (cm); thick(t) → fraction of T
const BLADES = {
  straight: { w: (t) => { const b = 1 - 0.2 * t; const tip = t > 0.84 ? Math.sqrt(Math.max(0, 1 - ((t - 0.84) / 0.16) ** 2)) : 1; return [b * tip, b * tip]; } },
  broad: { w: (t) => { const tip = t > 0.9 ? Math.max(0, 1 - ((t - 0.9) / 0.1) ** 1.2) : 1; return [tip * (1 - 0.08 * t), tip * (1 - 0.08 * t)]; } },
  leaf: { w: (t) => { const s = t < 0.7 ? 0.78 + 0.42 * Math.sin(Math.PI * (t / 0.7) * 0.85) : 0; const tip = t >= 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) ** 0.8 * (0.78 + 0.42 * Math.sin(Math.PI * 0.85)) : s; return [tip, tip]; } },
  hero: { w: (t) => { const b = 1 - 0.1 * t; const tip = t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.2) : 1; return [b * Math.min(1, tip * 1.4) * (t > 0.8 ? tip : 1), b * (t > 0.8 ? tip ** 0.6 : 1)]; } },
  flamberge: { w: (t) => { const b = (1 - 0.25 * t) * (1 + 0.14 * Math.sin(2 * Math.PI * 7 * t) * smooth(0.08, 0.2, t) * (1 - smooth(0.8, 0.9, t))); const tip = t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1; return [b * tip, b * tip]; } },
  cleaver: { w: (t) => { const g = 1 + 0.75 * smooth(0, 0.85, t); const clip = t > 0.9 ? Math.max(0.05, 1 - (t - 0.9) / 0.1) : 1; return [g * clip, 0.55 * (t > 0.96 ? Math.max(0.05, 1 - (t - 0.96) / 0.04) : 1)]; } },
  sabre: { w: (t) => { const b = 1 - 0.12 * t; const tip = t > 0.88 ? Math.max(0, 1 - ((t - 0.88) / 0.12)) : 1; return [b * tip, 0.42 * b * (t > 0.88 ? Math.max(0.1, tip) : 1)]; }, path: (t, L) => -0.035 * L * t * t },
  tanto: { w: (t) => { const tip = t > 0.86 ? Math.max(0, 1 - (t - 0.86) / 0.14) : 1; return [1 * tip, 0.5 * (t > 0.86 ? Math.max(0.05, (1 - (t - 0.86) / 0.14) ** 0.3) : 1)]; } },
};

const ROLL = 90; // the curved-path loft frame puts profile u on y; turn the edge onto x
function bladeLoft({ variant, L, W, T, z0, edge, rng, role }) {
  const v = BLADES[variant] || BLADES.straight;
  const n = 40, path = [], stations = [];
  // barbs (brutal): seeded notches along the spine side
  const barbs = [];
  for (let i = 0; i < (edge.barbs || 0); i++) barbs.push(0.25 + 0.55 * (i + 0.2 + 0.6 * rng()) / (edge.barbs));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let [wr, wl] = v.w(t).map((x) => (Number.isFinite(x) ? x : 0));
    for (const b of barbs) { const d = (t - b) / 0.035; if (d > -1 && d < 1) wl *= 1 + 0.9 * (1 - Math.abs(d)) * (d < 0 ? 1 : 0.2); }
    wr = Math.max(0.03, wr * W / 2); wl = Math.max(0.03, wl * W / 2);
    const th = Math.max(0.03, T / 2 * (1 - 0.55 * t) * (t > 0.96 ? 0.3 : 1));
    const fd = edge.fuller ? edge.fuller * (1 - smooth(0.55, 0.72, t)) : 0;
    const b = edge.bevel;
    const single = edge.single || variant === 'cleaver';
    const back = single ? 0.96 : b; // a spine: the left side stays thick to its edge
    path.push(A(v.path ? v.path(t, L) : 0, 0, z0 + t * L));
    stations.push({ t: r3(t), roll: ROLL, profile: [[wr, 0], [wr * b, th], [0, th * (1 - fd)], [-wl * back, th], [-wl, single ? th * 0.7 : 0], [-wl * back, -th], [0, -th * (1 - fd)], [wr * b, -th]].map(([u, w]) => [r3(u), r3(w)]) });
  }
  return { path, stations, interp: 'linear', ...mat(role) };
}



function guard(variant, { span, H, D, z0, roles, minF }) {
  const fit = mat(roles.fittings), acc = mat(roles.accent);
  const out = { lathes: [], extrudes: [], sweeps: [], lofts: [], fields: [] };
  const zc = z0 + H / 2, h = span / 2;
  if (variant === 'bar') {
    out.extrudes.push({ group: 'guard', profile: { rect: { w: D, h: H, r: H * 0.3 } }, axisFrom: P(-h, 0, zc), axisTo: P(h, 0, zc), ...fit });
    for (const s of [-1, 1]) out.lathes.push({ group: 'guard', axisFrom: P(s * h, 0, zc), axisTo: P(s * (h + H * 1.1), 0, zc), profile: [{ t: 0, radius: H * 0.35 }, { t: 0.5, radius: H * 0.62 }, { t: 1, radius: 0 }], ...fit });
  } else if (variant === 'crescent') {
    const arc = []; for (let i = 0; i <= 20; i++) { const a = -1 + 2 * i / 20; arc.push(A(a * h, 0, zc + h * 0.45 * a * a)); }
    out.sweeps.push({ group: 'guard', path: arc, radius: Math.max(H * 0.42, minF), sides: 12, ...fit });
    out.lathes.push({ group: 'guard', axisFrom: P(0, 0, z0), axisTo: P(0, 0, z0 + H * 1.4), profile: [{ t: 0, radius: D * 0.5 }, { t: 1, radius: D * 0.25 }], ...fit });
    for (const s of [-1, 1]) out.lathes.push({ group: 'guard', axisFrom: P(s * h, 0, zc + h * 0.45), axisTo: P(s * h * 1.02, 0, zc + h * 0.45 + H * 2.2), profile: [{ t: 0, radius: H * 0.42 }, { t: 1, radius: 0 }], ...acc });
  } else if (variant === 'block') {
    const pts = [[h, -H * 0.5], [h * 0.8, H * 0.7], [-h * 0.8, H * 0.7], [-h, -H * 0.5]];
    out.extrudes.push({ group: 'guard', profile: { points: pts.map(([u, v]) => [r3(u), r3(v)]) }, axisFrom: P(0, -D * 0.75, zc), axisTo: P(0, D * 0.75, zc), ...fit });
  } else if (variant === 'spiked') {
    out.extrudes.push({ group: 'guard', profile: { rect: { w: D, h: H, r: 0 } }, axisFrom: P(-h, 0, zc), axisTo: P(h, 0, zc), ...fit });
    for (const s of [-1, 1]) {
      out.lathes.push({ group: 'guard', axisFrom: P(s * h, 0, zc), axisTo: P(s * h * 1.18, 0, zc + h * 0.7), profile: [{ t: 0, radius: H * 0.55 }, { t: 1, radius: 0 }], ...fit });
      out.lathes.push({ group: 'guard', axisFrom: P(s * h * 0.55, 0, zc), axisTo: P(s * h * 0.62, 0, zc - h * 0.4), profile: [{ t: 0, radius: H * 0.4 }, { t: 1, radius: 0 }], ...fit });
    }
  } else if (variant === 'disc') {
    out.lathes.push({ group: 'guard', axisFrom: P(0, 0, z0), axisTo: P(0, 0, z0 + H * 0.55), profile: [{ t: 0, radius: h }, { t: 1, radius: h }], harmonics: [{ n: 4, amplitude: h * 0.12 }], crossSections: 3, samples: 72, ...fit });
    const ring = []; for (let i = 0; i <= 48; i++) { const a = 2 * Math.PI * i / 48, rr = h * (1 + 0.12 * Math.cos(4 * a)); ring.push(A(rr * Math.cos(a), rr * Math.sin(a), z0 + H * 0.28)); }
    out.sweeps.push({ group: 'guard', path: ring, radius: H * 0.3, sides: 8, ...acc });
    out.lathes.push({ group: 'guard', axisFrom: P(0, 0, z0 + H * 0.55), axisTo: P(0, 0, z0 + H * 1.5), profile: [{ t: 0, radius: D * 0.42 }, { t: 1, radius: D * 0.34 }], ...acc });
  } else if (variant === 'winged') {
    // three feathers a side sweeping up and out, rooted at the centre so they point back at the focal
    for (const s of [1, -1]) {
      out.lofts.push(feather({ s, root: [s * H * 0.3, 0, zc], len: h, rise: 0.55, width: H * 0.62, thick: D * 0.18, role: roles.fittings, minF }));
      out.lofts.push(feather({ s, root: [s * H * 0.3, 0, zc - H * 0.25], len: h * 0.78, rise: 0.22, width: H * 0.5, thick: D * 0.16, role: roles.fittings, minF }));
      out.lofts.push(feather({ s, root: [s * H * 0.3, 0, zc - H * 0.45], len: h * 0.55, rise: -0.05, width: H * 0.4, thick: D * 0.14, role: roles.fittings, minF }));
    }
    out.lathes.push({ group: 'guard', axisFrom: P(0, 0, z0 - H * 0.4), axisTo: P(0, 0, z0 + H * 1.2), profile: [{ t: 0, radius: D * 0.5 }, { t: 0.5, radius: D * 0.7 }, { t: 1, radius: D * 0.45 }], harmonics: [{ n: 8, amplitude: D * 0.05 }], ...acc });
  }
  return out;
}

// ---------------------------------------------------------------- grips
function grip(variant, { L, R, z0, roles, pitch, minF }) {
  const w = mat(roles.wrap), fit = mat(roles.fittings), acc = mat(roles.accent);
  const out = { lathes: [], sweeps: [] };
  const core = (bands = 0) => { const prof = []; const n = bands ? bands * 2 + 1 : 3;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); prof.push({ t: r3(t), radius: r3(R * (0.92 + 0.12 * Math.sin(Math.PI * t)) * (bands && i % 2 ? 1.07 : 1)) }); } return prof; };
  if (variant === 'leather') out.lathes.push({ group: 'grip', axisFrom: P(0, 0, z0), axisTo: P(0, 0, z0 + L), profile: core(Math.max(3, Math.round(7 / pitch))), crossSections: 30, ...w });
  if (variant === 'banded') {
    out.lathes.push({ group: 'grip', axisFrom: P(0, 0, z0), axisTo: P(0, 0, z0 + L), profile: core(0), ...w });
    for (const f of [0.15, 0.5, 0.85]) out.lathes.push({ group: 'grip', axisFrom: P(0, 0, z0 + L * f - 0.5 * pitch), axisTo: P(0, 0, z0 + L * f + 0.5 * pitch), profile: [{ t: 0, radius: R * 1.12 }, { t: 1, radius: R * 1.12 }], ...acc });
  }
  if (variant === 'wire' || variant === 'cord') {
    out.lathes.push({ group: 'grip', axisFrom: P(0, 0, z0), axisTo: P(0, 0, z0 + L), profile: core(0), ...(variant === 'cord' ? fit : w) });
    const turns = variant === 'wire' ? L / (0.9 * pitch) : L / (2.2 * pitch), rr = Math.max(minF / 2, (variant === 'wire' ? R * 0.09 : R * 0.2) * Math.sqrt(pitch));
    for (const phase of variant === 'cord' ? [0, Math.PI] : [0]) {
      const path = []; const n = Math.ceil(turns * 18);
      for (let i = 0; i <= n; i++) { const t = i / n, a = phase + 2 * Math.PI * turns * t * (variant === 'cord' && phase ? -1 : 1); path.push(A(R * Math.cos(a), R * Math.sin(a), z0 + 0.3 + t * (L - 0.6))); }
      out.sweeps.push({ group: 'grip', path, radius: r3(rr), sides: 6, ...(variant === 'wire' ? acc : w) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- pommels (built downward from z = top)
function pommel(variant, { R, top, roles, stone, gem, gripR }) {
  const fit = mat(roles.fittings), acc = mat(roles.accent);
  const out = { lathes: [], extrudes: [], sweeps: [], fields: [] };
  let H = R * 1.2;
  const lathe = (prof, extra = {}) => out.lathes.push({ group: 'pommel', axisFrom: P(0, 0, top - H), axisTo: P(0, 0, top), profile: prof.map(([t, r]) => ({ t: r3(t), radius: r3(r) })), ...fit, ...extra });
  if (variant === 'cage' && stone) {
    // law 3: the cage is sized BY the stone — it spans the stone's own extent, and four prongs bow out to exactly the
    // girdle (crystal-optics crystalGirdle), crossing it at its height and overlapping its edge, so the setting holds
    const g = girdleOf(gem, stone.size), pr = Math.max(stone.bezel, g.radius * 0.12);
    const above = g.top - g.z + pr * 1.5, below = g.z - g.bottom + pr * 1.5;
    const zTop = top - pr * 2, zG = zTop - above, zBot = zG - below;
    H = top - zBot + pr;
    const rg = g.radius + pr * 0.5, rTop = Math.max(pr * 1.4, g.radius * 0.6), rBot = pr * 1.2;
    out.lathes.push({ group: 'pommel', axisFrom: P(0, 0, top - pr * 2.2), axisTo: P(0, 0, top + 0.4), profile: [{ t: 0, radius: r3(rTop * 1.1) }, { t: 1, radius: r3(gripR * 1.05) }], ...fit }); // overlaps the grip: touching is not joined
    out.lathes.push({ group: 'pommel', axisFrom: P(0, 0, top - H), axisTo: P(0, 0, zBot + pr), profile: [{ t: 0, radius: 0 }, { t: 0.5, radius: r3(pr * 1.8) }, { t: 1, radius: r3(rBot * 1.2) }], ...fit });
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, path = [];
      for (let i = 0; i <= 16; i++) { const z = zTop - (i / 16) * (zTop - zBot);
        const rad = z >= zG ? rTop + (rg - rTop) * Math.sin((Math.PI / 2) * (zTop - z) / above) : rBot + (rg - rBot) * Math.sin((Math.PI / 2) * (z - zBot) / below);
        path.push(A(rad * Math.cos(a), rad * Math.sin(a), z)); }
      out.sweeps.push({ group: 'pommel', path, radius: r3(pr), sides: 8, ...acc }); }
    out.fields.push({ group: 'pommel', cells: 40, terms: [{ id: 'stone', op: 'add', shape: { kind: 'crystal', gem: gem.gem, cut: gem.cut || 'brilliant', center: A(0, 0, zG - g.z), size: r3(stone.size), axis: [0, 0, 1], ...(gem.glow ? { glow: r3(Math.min(1, gem.glow)) } : {}) } }], ...acc });
    return { out, H };
  }
  if (variant === 'wheel' || variant === 'cage') { H = R * 1.0; lathe([[0, R * 0.55], [0.12, R * 0.9], [0.5, R], [0.88, R * 0.9], [1, R * 0.45]], { samples: 40, ...acc }); }
  else if (variant === 'block') { H = R * 1.1; out.extrudes.push({ group: 'pommel', profile: { points: [0, 1, 2, 3, 4, 5].map((k) => [r3(R * Math.cos(k * Math.PI / 3)), r3(R * Math.sin(k * Math.PI / 3))]) }, axisFrom: P(0, 0, top - H), axisTo: P(0, 0, top), ...fit });
    out.lathes.push({ group: 'pommel', axisFrom: P(0, 0, top - H - R * 0.25), axisTo: P(0, 0, top - H), profile: [{ t: 0, radius: R * 0.35 }, { t: 1, radius: R * 0.75 }], ...acc }); H += R * 0.25; }
  else if (variant === 'spike') { H = R * 2.2; lathe([[0, 0], [0.55, R * 0.6], [0.8, R * 0.7], [1, R * 0.45]]); }
  else if (variant === 'cap') { H = R * 0.6; lathe([[0, R * 0.2], [0.35, R * 0.8], [1, R * 0.95]], acc); }
  else if (variant === 'ring') { const rr = R * 0.95, tube = R * 0.26; H = 2 * rr + tube; const cz = top - rr + tube * 0.4; // the ring's crown runs into the grip
    out.sweeps.push({ group: 'pommel', path: circle([0, 0, cz], rr, 40, 'xz'), radius: r3(tube), sides: 10, ...acc });
    out.lathes.push({ group: 'pommel', axisFrom: P(0, 0, cz + rr - tube), axisTo: P(0, 0, top + 0.2), profile: [{ t: 0, radius: r3(tube * 1.4) }, { t: 1, radius: r3(gripR * 1.08) }], ...acc }); }
  return { out, H };
}


/**
 * Build a sword-family item. `ctx` is resolved by expand.js: { item, card, d (dials), law, lean, roles, gem, parts,
 * seed }. → { monomers, sockets, trace }.
 */
export function buildSword({ item, card, d, law, lean, roles, gem: g, parts, seed }) {
  const arch = SWORDS[item];
  const rng = mulberry32(seed * 7919 + item.length * 131 + (card.id || '').length);
  const pick = (slot) => parts[slot] || card.language[item]?.[slot] || card.language[slot];
  const gem = g && d.focus !== 'none' && d.focus !== 'blade' ? g : null;
  // law 5: fittings recede toward neutral when a stone carries the contrast
  if (gem) roles = { ...roles, fittings: [roles.fittings[0], recede(roles.fittings[1], d.stylize)] };
  const m = {};
  const trace = { variants: {} };

  const gH = arch.guard.H * law.hilt * Math.sqrt(lean.T), gD = arch.guard.D * law.hilt * lean.T, span = arch.guard.span * law.hilt * lean.span;
  const pomR = arch.pommel.R * law.hilt * lean.pommel, gR = arch.grip.R * law.hilt ** 0.5 * lean.T ** 0.3;
  // law 1: the focal stone is sized from its host, then the host re-forms around it
  const stone = gem ? focalStone({ stylize: d.stylize, host: d.focus === 'pommel' ? pomR * 1.1 : gH }) : null;
  const gemLit = gem ? { ...gem, glow: (gem.glow || 0) + (stone?.glowBoost || 0) } : null;
  if (stone) trace.focal = { at: d.focus, gem: gem.gem, size: r3(stone.size), setting: stone.setting, share: r3(stone.size / (d.focus === 'pommel' ? pomR * 2 : gH)) };

  const minF = law.minFeature * (arch.blade.L + arch.grip.L);
  const pv = pick('pommel');
  const pStone = d.focus === 'pommel' ? stone : null;
  const pomH = pommel(pv, { R: pomR, top: 0, roles, stone: pStone, gem: gemLit, gripR: gR }).H;
  mergeInto(m, pommel(pv, { R: pomR, top: pomH, roles, stone: pStone, gem: gemLit, gripR: gR }).out); trace.variants.pommel = pv;
  let z = pomH;
  const gL = arch.grip.L * law.gripL * lean.grip;
  const gv = pick('grip'); mergeInto(m, grip(gv, { L: gL, R: gR, z0: z, roles, pitch: law.pitch, minF })); trace.variants.grip = gv;
  const gripMid = z + gL / 2; z += gL;
  const guv = pick('guard');
  mergeInto(m, guard(guv, { span, H: gH, D: gD, z0: z, roles, minF })); trace.variants.guard = guv;
  const focalZ = d.focus === 'pommel' ? pomH / 2 : z + gH / 2;
  if (d.focus === 'guard' && stone) mergeInto(m, setStone({ at: [0, 0, z + gH / 2], axis: [0, 1, 0], st: stone, gem: gemLit, roles, group: 'guard', bossDepth: Math.max(gD * 0.5, stone.r * 0.5) }));
  z += gH * (guv === 'disc' ? 0.55 : 1);
  const bL = arch.blade.L * law.bladeL * lean.L, bW = arch.blade.W * law.bladeW * lean.W, bT = arch.blade.T * law.bladeT * lean.T;
  const bv = pick('blade'); trace.variants.blade = bv;
  const cardEdge = card.edge || {};
  const edge = { ...cardEdge, barbs: cardEdge.barbs ? Math.max(1, Math.round(cardEdge.barbs * law.notches)) : 0 };
  if (cardEdge.twoTone) {
    m.lofts = m.lofts || [];
    m.lofts.push({ group: 'blade', ...bladeLoft({ variant: bv, L: bL, W: bW, T: bT * 0.62, z0: z, edge: { ...edge, fuller: 0 }, rng: mulberry32(seed), role: roles.edge || roles.blade }) });
    m.lofts.push({ group: 'blade-core', ...bladeLoft({ variant: bv, L: bL * 0.93, W: bW * 0.66, T: bT, z0: z, edge: { ...edge, bevel: 0.7 }, rng: mulberry32(seed), role: roles.blade }) });
  } else {
    (m.lofts ||= []).push({ group: 'blade', ...bladeLoft({ variant: bv, L: bL, W: bW, T: bT, z0: z, edge, rng, role: roles.blade }) });
  }
  const tipX = BLADES[bv]?.path ? BLADES[bv].path(1, bL) : 0;
  const sockets = {
    grip: { origin: A(0, 0, gripMid), axis: [0, 0, 1], edge: [1, 0, 0], length: r3(gL) },
    guard: { origin: A(0, 0, z) },
    tip: { origin: A(tipX, 0, z + bL) },
    ...(stone ? { focal: { origin: A(0, 0, focalZ) } } : {}),
  };
  return { monomers: m, sockets, trace: { ...trace, length: r3(z + bL), minFeature: r3(minF) } };
}
