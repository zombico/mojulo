/**
 * WORLD GEAR — the starter items that fill a world, dressed by the technology that makes them. Every functional model
 * in a game is technology: the gear a world equips speaks the language of the civilization that makes it, and a world
 * grows its stock by rule, never by hand.
 *
 *   equipment.populate: true | { mirrors?, contrasts?, augment? }     (equipment.js reads it; absent: nothing here runs)
 *
 * The direction: a civilization's technology direction (tech-direction.js) chooses its gear's style card. Its motif
 * picks the base card (equipment/styles.js), its setting (what it is made of, mech-kit.js) the metals, its primary
 * element the stone, and its team colour marks the grip's wrap and the shield's board.
 *
 * The transforms: each takes an entry and gives an entry, saying what it came from.
 *   MIRROR     a rival's answer: same class, slot and tiers, in the rival civilization's language
 *   CONTRAST   an item's shadow: the opposite motif, the same maker's setting, stone and team
 *   AUGMENT    tiers grown by rule (ornament, stylization, the stone's glow), for gear nothing tiered
 *
 * The starter list is read from what the world says:
 *   - the hero's gear (the equipment table's filled rows);
 *   - each civilization's crafted held weapons the equipment kernel can build;
 *   - mirrors and contrasts as asked;
 *   - the keys its links lock with, as requests for a prop shelf.
 * A held weapon the kernel has no class for is a task.
 *
 *   GEAR_MOTIFS, MADE_ROLES, CONTRAST_OF
 *   gearStyle(G, cid, { motif? })         → { card, from } | null   (a civilization that makes nothing has no gear)
 *   mirrorEntry(entry, G, cid)            → entry      contrastEntry(entry, G, cid) → entry
 *   augmentTiers(build, slot)             → tiers      (each stage judged by the equipment kernel)
 *   populateGear(G)                       → { entries, tasks, requests } | null
 *   gearOrders(G, ready)                  → { waiting, mints, planned }   (the mints wait on the game's stats)
 *   gearFaces(build)                      → faces, shaded smooth, each with the `base` colour of its metal or material
 *                                           (for tech-sheet.js)
 *
 * Pure; no dice.
 */
import { SEEDED_STYLES, validateStyleCard } from '../equipment/styles.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';
import { CRYSTAL_GEMS } from '../polygonizer/crystal-optics.js';
import { validateGear } from '../polygonizer/hero-gear.js';
import { ELEMENT_WORDS } from './element-words.js';
import { resolveTechDirection } from './tech-direction.js';
import { TECH_STYLES } from './tech-eras.js';
import { resolveEquipment, CLASS_SLOTS } from './equipment.js';
import { applyDiff } from './adornment.js';
import { STAGES } from './actions.js';
import { withEquipment } from '../equipment/expand.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { metalRgb } from '../materials/metal-surface.js';
import { smoothCorners } from './tech-shading.js';

/** A motif's base style card: the shape language of its blades, guards, heads and boards. */
export const GEAR_MOTIFS = Object.freeze({ smooth: 'anime-hero', faceted: 'eastern', riveted: 'dwarven', spiked: 'brutal', organic: 'druid', ornate: 'elven' });
/** What a setting makes its gear of: the blade, the fittings, the accent and the wrap under the team colour. */
export const MADE_ROLES = Object.freeze({
  'timber-and-rope': { blade: { metal: 'bronze', finish: 'planished' }, fittings: ['wood', '#6b4a2e'], accent: { metal: 'bronze', finish: 'polished' } },
  'iron-and-rivet': { blade: { metal: 'steel', finish: 'mill' }, fittings: { metal: 'steel', finish: 'blasted' }, accent: { metal: 'brass', finish: 'polished' } },
  'steel-and-rubber': { blade: { metal: 'steel', finish: 'brushed' }, fittings: ['gunmetal', '#5c636e'], accent: { metal: 'chrome', finish: 'polished' } },
  'alloy-and-glass': { blade: { metal: 'titanium', finish: 'brushed' }, fittings: { metal: 'aluminium', finish: 'brushed' }, accent: ['glass', '#9fd8ff'] },
  'stone-and-rune': { blade: { metal: 'bronze', finish: 'polished' }, fittings: ['stone', '#8a8478'], accent: { metal: 'gold', finish: 'polished' } },
  'chitin-and-sinew': { blade: ['plastic', '#d8cfb0'], fittings: ['matte', '#5b4a3a'], accent: ['satin', '#7a5a8a'] },
});
/** The one-sided blade each motif's vocabulary leans to (equipment/styles.js VARIANTS): all single-edged. */
export const ONE_SIDED = Object.freeze({ spiked: 'cleaver', riveted: 'cleaver', faceted: 'tanto', smooth: 'sabre', organic: 'sabre', ornate: 'sabre' });
/** The opposite of a motif: what an item's shadow is shaped in. */
export const CONTRAST_OF = Object.freeze({ smooth: 'spiked', spiked: 'smooth', faceted: 'organic', organic: 'faceted', riveted: 'ornate', ornate: 'riveted' });
const MOTIF_OF_CARD = Object.freeze({ ...Object.fromEntries(Object.entries(GEAR_MOTIFS).map(([m, c]) => [c, m])), historical: 'riveted', celestial: 'ornate' });

const clone = (v) => JSON.parse(JSON.stringify(v));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A civilization's gear card, from its technology direction; `motif` overrides the direction's (a contrast). */
export function gearStyle(G, cid, { motif } = {}) {
  const D = resolveTechDirection(G, cid);
  if (!D) return null;
  const m = motif ?? D.motif, base = GEAR_MOTIFS[m], card = clone(SEEDED_STYLES[base]);
  card.id = `${cid}-${m}`;
  card.roles = { ...card.roles, ...(MADE_ROLES[D.setting.made] ?? {}), wrap: ['matte', D.team] };
  card.language = { ...card.language, shield: { ...(card.language.shield ?? {}), board: ['matte', D.team] } };
  // exaggerated as its style draws held things (wc3: a hand weapon reads a third larger): wider, chunkier, stubbier,
  // heavier, more stylized; every number inside the card's own bounds
  const e = TECH_STYLES[D.style]?.exaggeration?.held ?? 1, lean = card.lean ?? {}, dials = card.dials ?? {}, clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100;
  if (e !== 1) {
    card.lean = { ...lean, W: clamp((lean.W ?? 1) * e, 0.25, 4), T: clamp((lean.T ?? 1) * (1 + (e - 1) / 2), 0.25, 4), pommel: clamp((lean.pommel ?? 1) * e, 0.25, 4), span: clamp((lean.span ?? 1) * (1 + (e - 1) * 0.6), 0.25, 4), L: clamp((lean.L ?? 1) / (1 + (e - 1) * 0.3), 0.25, 4) };
    card.dials = { ...dials, mass: clamp((dials.mass ?? 1) * e, 0.5, 2), stylize: clamp(Math.max(dials.stylize ?? 0, 0.6), 0, 1) };
  }
  // a lopsided civilization's blades take the one-sided shapes its vocabulary has, a spine on the back; barbed down
  // one edge as far as it leans, when its motif bites
  if (D.asymmetry >= 0.35) {
    card.language = { ...card.language, blade: ONE_SIDED[m], ...(m === 'faceted' ? { dagger: { ...(card.language.dagger ?? {}), blade: 'tanto' } } : {}) };
    card.edge = { ...(card.edge ?? {}), single: true, ...(['spiked', 'riveted'].includes(m) ? { barbs: Math.min(12, Math.round(D.asymmetry * 6)) } : {}) };
  }
  const stone = ELEMENT_WORDS[D.elements.primary]?.gem;
  if (stone && CRYSTAL_GEMS.includes(stone)) card.gem = { gem: stone, cut: card.gem?.cut ?? 'brilliant', glow: Math.max(card.gem?.glow ?? 0, 0.35) };
  const errs = validateStyleCard(card, card.id);
  if (errs.length) throw new Error(`world gear: ${cid}'s card breaks the equipment kernel: ${errs.join('; ')}`);
  return { card, from: { base: `${base} (its motif, ${m}${motif ? ', turned' : ''})`, roles: `its setting (${D.setting.made})`, gem: stone ? `its element (${D.elements.primary})` : 'none', team: `its team colour (${D.team})`, edge: D.asymmetry >= 0.35 ? `one-sided (${ONE_SIDED[m]}): its asymmetry (${D.asymmetry})` : 'its card\'s', proportion: e !== 1 ? `exaggerated ×${e}: its style (${D.style}) draws held things so` : 'true' } };
}

const motifOfBuild = (b) => (typeof b.style === 'string' ? MOTIF_OF_CARD[b.style] : MOTIF_OF_CARD[b.style?.id?.split('-').pop()] ?? b.style?.id?.split('-').pop()) ?? 'riveted';
const judged = (slot, build, tiers) => {
  const errs = validateGear({ [slot]: build });
  let b = build;
  for (const s of STAGES) if (tiers?.[s]) { b = applyDiff(b, tiers[s]); errs.push(...validateGear({ [slot]: b }).map((e) => `${s}: ${e}`)); }
  return errs;
};

/** Tiers grown by rule over a build: each stage more ornament and stylization, the stone's glow last. */
export function augmentTiers(build, slot) {
  const card = typeof build.style === 'string' ? SEEDED_STYLES[build.style] : build.style ?? SEEDED_STYLES.historical, d = { ...(card?.dials ?? {}), ...(build.dials ?? {}) };
  const o = d.ornament ?? 0, st = d.stylize ?? 0, gem = isObj(build.gem) ? build.gem : card?.gem;
  const tiers = {
    mid: { dials: { ornament: Math.min(3, o + 1), stylize: Math.round(Math.min(1, st + 0.15) * 100) / 100 } },
    late: { dials: { ornament: Math.min(3, o + 2), stylize: Math.round(Math.min(1, st + 0.3) * 100) / 100 }, ...(gem?.gem ? { gem: { ...gem, glow: Math.round(Math.min(1, (gem.glow ?? 0.3) + 0.3) * 100) / 100 } } : {}) },
  };
  return judged(slot, build, tiers).length ? undefined : tiers;
}

/** A rival's answer to an entry: the same class, slot and tiers, in the rival's language. */
export function mirrorEntry(e, G, cid) {
  const S = gearStyle(G, cid);
  if (!S) return null;
  const build = { ...e.build, style: S.card };
  return { id: `mirror-${cid}-${e.class}`, source: 'mirror', of: e.id, civilization: cid, class: e.class, slot: e.slot, build, ...(e.tiers ? { tiers: e.tiers } : {}), why: `${cid}'s answer to ${e.id}: the same ${e.class}, in its language (${S.from.base})`, style: S.from };
}

/** An entry's shadow: the opposite motif, made by the same civilization (its setting, stone and team). */
export function contrastEntry(e, G, cid) {
  const m = CONTRAST_OF[motifOfBuild(e.build)], S = gearStyle(G, cid, { motif: m });
  if (!S) return null;
  return { id: `contrast-${e.id}`, source: 'contrast', of: e.id, civilization: cid, class: e.class, slot: e.slot, build: { ...e.build, style: S.card }, ...(e.tiers ? { tiers: e.tiers } : {}), why: `the shadow of ${e.id}: the same ${e.class}, turned ${m}`, style: S.from };
}

const optsOf = (P) => ({ mirrors: true, contrasts: true, augment: true, ...(P === true ? {} : P) });

/** The world's starter gear, read from what it says. Null when the world does not ask. */
export function populateGear(G) {
  const P = G.equipment?.populate;
  if (!P) return null;
  const O = optsOf(P), entries = [], tasks = [], requests = [];
  const add = (e) => { if (!e) return; const errs = judged(e.slot, e.build, e.tiers); entries.push(errs.length ? { ...e, errors: errs } : e); };
  // the hero's gear: the equipment table's filled rows
  const hero = resolveEquipment(G).rows.filter((r) => r.build).map((r) => ({ id: `hero-${r.class}`, source: 'hero', class: r.class, slot: r.slot ?? CLASS_SLOTS[r.class], build: r.build, ...(r.tiers ? { tiers: r.tiers } : {}), why: r.from ? `the hero's ${r.class} (${r.from})` : `the world's own ${r.class}` }));
  hero.forEach(add);
  // each civilization's held weapons the kernel can build; the rest are tasks
  const makers = (G.civIds ?? Object.keys(G.civilizations ?? {})).filter((cid) => resolveTechDirection(G, cid));
  const civ = [];
  for (const cid of makers) {
    const S = gearStyle(G, cid);
    for (const [wid, w] of Object.entries(G.civilizations[cid].technology?.weapons ?? {})) {
      if (w.block?.tier !== 'held') continue;
      if (!w.carries || !EQUIPMENT_ITEMS.includes(w.carries)) { tasks.push({ civilization: cid, id: wid, intent: w.intent, why: `the equipment kernel builds no ${w.variant}: a new class is design-tech-family's code rung` }); continue; }
      const slot = CLASS_SLOTS[w.carries], build = { item: w.carries, style: S.card };
      const e = { id: `${cid}-${wid}`, source: 'civilization', civilization: cid, class: w.carries, slot, build, why: `${cid}'s ${w.intent}, in its language (${S.from.base})`, style: S.from };
      const tiers = O.augment ? augmentTiers(build, slot) : undefined;
      civ.push(tiers ? { ...e, tiers, augmented: true } : e);
    }
  }
  civ.forEach(add);
  if (O.mirrors) for (const h of hero) for (const cid of makers) add(mirrorEntry(h, G, cid));
  if (O.contrasts) for (const c of civ) add(contrastEntry(c, G, c.civilization));
  // the keys its links lock with: requests for a prop shelf
  for (const l of G.links ?? []) if (l.key) requests.push({ kind: 'key', id: `key-${l.key}`, opens: `${l.from} → ${l.to}`, ...(l.keyAt ? { at: l.keyAt } : {}), why: 'a link locked with it' });
  return { entries, tasks, requests };
}

/** The mints the starter gear makes, once the equipment step is ready; until then what it will make. */
export function gearOrders(G, ready) {
  const S = populateGear(G);
  if (!S) return { waiting: [], mints: [], planned: [] };
  const planned = S.entries.filter((e) => !e.errors).map((e) => ({ tool: 'mint_solid', part: 'stock', id: e.id, args: { kind: 'equipment', title: `${G.name} · ${e.id}`, spec: e.build } }));
  if (!ready?.ready) return { waiting: ready?.waiting ?? [], mints: [], planned };
  return { waiting: [], mints: planned };
}

const hex = (rgb) => '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, '0')).join('');
/** A build lowered to faces monomer by monomer, its rounds shaded smooth, each face's base colour its metal's (measured)
 * or its material's: what the sheet draws. */
export function gearFaces(build) {
  const m = withEquipment({ kind: 'workbench', build: { type: 'equipment', ...build } }), faces = [];
  for (const key of ['lathes', 'extrudes', 'sweeps', 'lofts', 'fields']) (m[key] ?? []).forEach((spec, i) => {
    for (const f of lowerObjectFaces({ kind: 'workbench', [key]: [spec] })) {
      let metal = null;
      try { metal = f.metal?.s ? JSON.parse(f.metal.s).metal : null; } catch { metal = null; }
      faces.push({ ...f, monomer: `${key}-${i}`, base: metal ? hex(metalRgb(metal).map((c) => c * 0.85)) : f.fill });
    }
  });
  return smoothCorners(faces);
}
