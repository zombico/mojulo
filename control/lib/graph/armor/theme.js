// armor/theme — carry a THEME (themes/themes.js) down a suit: every motif seated on a ROLE the family names, by laws
// 13–16. The family's grammar is untouched; the theme rewrites signatures at its roles and adds the pieces only a theme
// wants (a crest line, a helm on a family without one, a tabard). Pure and deterministic: no dice, fixed order.
//
// ROLES (plate): focal / partner (the pauldron anchors), chest (the ridge), belt (a belt strap when a tabard hangs, else
// the fauld), knees (the poleyns), field (the breastplate halves), trims (the rolled edges), cuffs (the gauntlet cuffs),
// crest (a line along each pauldron's top), plates (every shell, for a rim), limbs (the vambraces, greaves and
// cuisses, for glyphs). Lamellar and the hard-suit name theirs when a theme first needs them.
import { armorProportion } from './principles.js';
import { r4 } from './plate.js';
import { themeOf } from '../themes/themes.js';

// law 14: the anchors in their fixed order, how many the ornament budget reaches (0 → the focal alone), their sizes
const ORDER = ['focal', 'partner', 'chest', 'belt', 'knees'];
const REACH = [1, 3, 4, 5];
const SIZE = { focal: 1, partner: 0.72, chest: 0.8, belt: 0.55, knees: 0.5 };
const DIR = { focal: [0.8, 0.5, 0.25], partner: [0.8, 0.5, 0.25], belt: [0, 1, -0.1], knees: [0, 1, 0.15] };

/** the family's roles in `kit` → { role: [entry ids] } */
function plateRoles(kit, focalSide) {
  const P = focalSide === 'R' ? 'L' : 'R', has = (id) => kit.some((A) => A.id === id);
  return {
    focal: [`torso-pauldron${focalSide}`].filter(has), partner: [`torso-pauldron${P}`].filter(has), chest: ['torso-ridge'].filter(has),
    belt: ['torso-fauld'].filter(has), knees: [`thigh${focalSide}-poleyn`, `thigh${P}-poleyn`].filter(has),
    field: ['torso-breastR', 'torso-breastL'].filter(has), trims: kit.filter((A) => /-trim(Top)?$/.test(A.id)).map((A) => A.id),
    cuffs: kit.filter((A) => /^foreArm[RL]-cuff$/.test(A.id)).map((A) => A.id),
    plates: kit.filter((A) => A.mode !== 'strap').map((A) => A.id),
    limbs: kit.filter((A) => /^(foreArm[RL]-vambrace|shank[RL]-greave|thigh[RL]-cuisse)$/.test(A.id)).map((A) => A.id),
    cuirass: ['torso-backR', 'torso-backL'].filter(has),
  };
}

/** Theme a family's suit. `out`: { kit, trace } from the family; returns { kit, tones, emissive, trace }. */
export function themeArmor(out, theme, { family, dials, ctx, lang = {} }) {
  const T = themeOf(theme); if (!T) return { ...out, tones: {}, emissive: [] };
  if (family !== 'plate') return { ...out, tones: { ...(T.tones || {}) }, emissive: [...(T.emissive || [])], trace: { ...out.trace, theme: { id: T.id || 'inline', seated: [] } } };
  const { k = 1, height = 1.75, Ht } = ctx, law = armorProportion(dials), minF = law.minFeature * height, orn = dials.ornament ?? 1;
  const focalSide = lang.focalSide ?? 'R';
  const kit = out.kit.map((A) => ({ ...A, signature: { ...A.signature } })), byId = Object.fromEntries(kit.map((A) => [A.id, A]));
  const roles = plateRoles(kit, focalSide), seated = [];
  const seat = (id, sig, role) => { byId[id].signature = sig; seated.push(`${role}:${id}`); };
  const add = [];   // entries the theme adds, worn after the suit (outermost), in this order
  const P = T.primary, focalR = r4(0.048 * k * law.focal ** 0.6);
  // a belt strap to carry the belt motif over a tabard's top (law 14's belt anchor, when the fauld would be hidden)
  const tabard = T.cloth?.tabard;
  if (tabard && roles.belt.length) {
    const w = r4((tabard.w ?? 0.11) * Ht);
    // the tabard hangs over the suit and stacks nothing over its board (the belt lies across its top)
    add.push({ id: 'torso-tabard', mode: 'strap', stack: false, part: 'torso', path: [[0.86, w, 'L'], [0.86, 0, 'R'], [0.86, w, 'R']], width: r4(0.03 * k), thick: r4(Math.max(minF, 0.004 * k)), mugen: 0.001, rad: r4(0.04 * k), group: tabard.group,
      signature: { kind: 'tabard', len: r4((tabard.len ?? 0.5) * k), thick: r4(Math.max(minF, 0.006 * k)), tilt: r4(0.05 * k), stand: 0.004, taper: 0.8, group: tabard.group, ...(tabard.hemGroup ? { hemGroup: tabard.hemGroup, hem: r4(Math.max(minF, 0.006 * k)) } : {}) } });
    add.push({ id: 'torso-belt', mode: 'strap', part: 'torso', path: [[1.0, r4(0.3 * Ht), 'L'], [1.0, r4(0.15 * Ht), 'L'], [1.0, 0, 'R'], [1.0, r4(0.15 * Ht), 'R'], [1.0, r4(0.3 * Ht), 'R']], width: r4(0.04 * k), thick: r4(Math.max(minF, 0.005 * k)), mugen: 0.001, rad: r4(0.05 * k), group: 'Leather',
      signature: { kind: 'studs', count: 1, r: r4(minF), h: r4(minF * 0.5), group: 'Rivet' } });
    roles.belt = ['torso-belt'];
  }
  // law 14: the primary motif at its anchors, full size at the focal and smaller down the order, as far as the budget reaches
  if (P) for (const role of ORDER.slice(0, REACH[orn])) for (const id of roles[role] || []) {
    const r = r4(focalR * SIZE[role] * (P.size ?? 1)), glow = (P.glow || []).includes(role) ? 'Glow' : P.socket ?? P.group;
    const where = byId[id]?.mode === 'strap' || id === 'torso-belt' ? { at: role === 'chest' ? 0.78 : 0.5 } : { dir: DIR[role] };
    const sig = P.motif === 'skull' ? { kind: 'skull', ...where, r, proud: 0.3, horns: P.horns?.[role] ?? 0, group: P.group, socketGroup: glow, hornGroup: P.group }
      : { kind: 'facing', dir: where.dir ?? [0, 1, 0.1], r: r4(r * 0.8), h: r4(Math.max(minF, r * 0.35)), m: 16, rim: 0.5, group: (P.glow || []).includes(role) ? 'Glow' : P.group };
    if (id === 'torso-belt') add.find((A) => A.id === id).signature = sig, seated.push(`${role}:${id}`); else seat(id, sig, role);
  }
  // law 15: the secondary motif as the field's one structural line
  if (T.secondary) for (const id of roles.field) seat(id, { kind: 'ribs', count: T.secondary.count ?? 4, r: r4(Math.max(minF * 1.2, 0.009 * k)), from: 0.2, to: 0.62, droop: 0.5, lift: 0.002, taper: 0.45, group: T.secondary.group }, 'field');
  // law 16: each edge verb along the edges it names. A RIM paints every plate's own edge, as far as the budget reaches
  // (0: the focal; 1: the pauldrons and the cuirass; 2+: every plate), and retires the family's rolled-edge straps
  let retired = new Set();
  for (const E of [T.edge || []].flat()) for (const e of E.on || ['trims']) {
    if (E.motif === 'rim') { if (e !== 'plates') continue; const reach = orn >= 2 ? roles.plates : orn === 1 ? roles.plates.filter((id) => /pauldron|breast|back/.test(id)) : roles.focal;
      for (const id of reach) { byId[id].rim = { group: E.group, at: 'both', w: r4(0.07 * law.rivet), wt: 0.07 }; seated.push(`plates:${id}`); }
      retired = new Set(roles.trims); continue; }
    for (const id of roles[e] || []) {
      const sig = E.motif === 'fur' ? { kind: 'fur', r: r4(0.014 * k * law.rivet), tufts: 12, j: -1, group: E.group }
        : E.motif === 'spikes' ? { kind: 'spikes', count: 5, len: r4(0.03 * k * law.focal), r: r4(Math.max(minF, 0.006 * k)), rise: 0.3, j: -1, group: E.group }
          : { kind: 'studs', count: 7, j: -1, r: r4(Math.max(minF * 0.6, 0.005 * k)), h: r4(Math.max(minF * 0.4, 0.003 * k)), m: 8, group: E.group };
      seat(id, sig, e); } }
  // glyphs on the plain fields the card names (the budget: 3 reaches every limb, 2 the vambraces)
  if (T.glyphs && orn >= 2) for (const e of T.glyphs.on || ['limbs']) for (const id of (roles[e] || []).filter((x) => orn >= 3 || /vambrace/.test(x)))
    seat(id, { kind: 'runes', count: 4, h: r4(0.058 * k), w: r4(Math.max(minF * 0.5, 0.003 * k)), lift: 0.0015, group: T.glyphs.group }, e);
  // law 16: the crest verb only on the crest line — a band along each pauldron's top, the focal's grander (law 9)
  if (T.crest) for (const [role, rank] of [['focal', 1], ['partner', 0.6]]) for (const id of roles[role] || []) {
    if (role === 'partner' && orn < 1) continue;
    const A = byId[id], sT = r4(A.s[0] + (A.s[1] - A.s[0]) * 0.62), w = A.t[1] - A.t[0];
    const sig = T.crest.motif === 'plume'
      ? { kind: 'plume', k: 'mid', j: 1, spine: [[0, 0, 0], [0.03, -0.04, 0.12], [0.06, -0.09, 0.24], [0.08, -0.15, 0.34]].map((p) => p.map((v) => r4(v * k * law.focal ** 0.5 * rank))), spread: [-1.6, -0.8, 0, 0.8, 1.6].slice(0, T.crest.count ?? 5), r: [0.024, 0.02, 0.012].map((v) => r4(v * k * rank ** 0.5)), squash: [1, 0.22], group: T.crest.group }
      : { kind: 'spikes', count: (T.crest.count ?? 4) + (role === 'focal' ? 1 : 0), len: r4(0.085 * k * law.focal ** 0.8 * rank), r: r4(0.013 * k * rank ** 0.5), rise: 5, profile: T.crest.profile ?? 'crown', j: 1, group: T.crest.group };
    add.push({ id: `${id}-crest`, mode: 'shell', part: 'torso', side: A.side, s: [r4(sT - 0.12), r4(sT + 0.12)], t: [r4(A.t[0] + w * 0.12), r4(A.t[1] - w * 0.12)], nt: 8, ns: 2,
      mugen: 0.001, thick: r4(Math.max(minF, 0.004 * k)), rad: r4(0.03 * k), group: T.crest.group, rigid: true, signature: sig });
    seated.push(`crest:${id}`);
  }
  // the helm: a plate suit has none (law 6); a theme that speaks through the head brings its own
  if (T.helm) { const H = T.helm;
    add.push({ id: 'cranium-helm', mode: 'shell', part: 'cranium', s: [6.6, 8], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: r4(minF), rad: r4(0.01 * k), group: H.group ?? 'Plate', rigid: true, stack: false,
      signature: { kind: 'helm', ...H, group: H.group ?? 'Plate', pad: r4(H.pad * k * Math.sqrt(dials.mass ?? 1)), muzzle: r4((H.muzzle ?? 0) * k), flare: r4((H.flare ?? 0) * law.flare / 1.5),
        ...(H.coronet ? { coronet: { ...H.coronet, len: r4(H.coronet.len * k * law.focal ** 0.6), r: r4(H.coronet.r * k), ...(H.coronet.band ? { band: r4(H.coronet.band * k) } : {}) } } : {}) } });
    seated.push('helm:cranium-helm');
  }
  return { kit: [...kit.filter((A) => !retired.has(A.id)), ...add], tones: { ...(T.tones || {}) }, emissive: [...(T.emissive || [])], trace: { ...out.trace, theme: { id: T.id || 'inline', seated } } };
}
