/**
 * SYNTHETIC SAMPLES — what an agent may browse while designing a gameworld, in place of any saved example. Each sample
 * is a FRAGMENT of one page (a direction, a power set, a feel, a gear language), drawn at random from the same tables
 * the reader reads, and shown with what the book DERIVES from it: the palette and clothes a direction gives, the items,
 * the system and the numbers a power set calls for, the stand and the gait a feel moves, the stat each class of a gear
 * language raises. Learning how a choice propagates is the point; no sample is a world, and none is a recommendation.
 *
 * Seeded (`mulberry32`), never stored: the same page, seed and count draw the same samples, so whoever reads a world
 * later can draw again exactly what was shown. Drawn brief-blind and spread across the space (each draw cycles the
 * table it picks from before repeating), since a sample that fits the brief is the one that would be copied.
 *
 *   gameworldSamples(page, { n?, seed? }) → { page, seed, n, note, samples: [{ fragment, derives }] }
 *   SAMPLE_PAGES                         the pages that can be sampled, each with what it shows
 *
 * Pure.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { readGameworld } from './world.js';
import { TRADITIONS } from './characters.js';
import { ELEMENT_WORDS } from './element-words.js';
import { composeHero } from './hero-looks.js';
import { IDIOMS, STAGES, resolveActions } from './actions.js';
import { RAILS, suggestKit } from './adornment-kit.js';
import { VIBES, resolveMotion } from './hero-vibe.js';
import { resolveBook } from './character-review.js';
import { GEAR_STAT } from './mechanics.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';
import { VARIANTS } from '../equipment/styles.js';
import { validateGear } from '../polygonizer/hero-gear.js';
import { CLASS_SLOTS } from './equipment.js';
import { METAL_NAMES, FINISHES, FINISH_NAMES } from '../materials/metal-surface.js';

export const SAMPLE_PAGES = Object.freeze({
  direction: 'a tradition, a leading and a supporting element, a motif → the palette, the clothes\' tones, the head and the proportions',
  actions: 'an idiom and three powers laid out by stage → the system, what the hero carries, how each power is gained and what it spends',
  motion: 'two vibe words → the axes they move, the stand, and the gait dials that changed',
  gear: 'a gear language (an inline style card) → what each class looks like in it and the stat it raises',
});
export const SAMPLE_MAX = 12;

// a motif is free words; these are only what the sampler draws from
const MOTIFS = ['spiral', 'crescent', 'feather', 'chevron', 'wave', 'star', 'scale', 'thorn', 'ring', 'knot', 'flame-tongue', 'lattice'];
const GROUND = { levels: { a: { walk: { nodes: { t: { trail: true } } } } } };
// the platforming every hero has is not a power: the actions page is what the hero does beyond it
const BASELINE = new Set(['walk', 'run', 'step', 'jump', 'sprint']);

/** A deck: draws from `list` without repeating until it is spent, then shuffles again. */
function deck(list, rnd) {
  let pile = [];
  return () => {
    if (!pile.length) { pile = [...list]; for (let i = pile.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [pile[i], pile[j]] = [pile[j], pile[i]]; } }
    return pile.pop();
  };
}

const world = (characters, extra = {}) => readGameworld({ id: 'sample', ...GROUND, characters, ...extra });

/**
 * What the book derives from one page's fragment, by page: the same functions the reader runs, on a world that holds
 * only that fragment. Also what the guide's contrast pairs are shown with (gameworld-cards.js), so a card can never
 * claim a consequence the book does not draw.
 */
export const DERIVE = Object.freeze({
  direction(fragment) {
    const C = composeHero(world({ direction: { from: 'custom', ...fragment }, hero: {} }));
    return { head: C.spec.head, proportions: C.spec.proportions, toon: C.toon, palette: C.spec.palette, clothes: C.underlayer.toneFrom };
  },
  actions(fragment) {
    const R = resolveActions(fragment), kit = suggestKit(R);
    const B = resolveBook(world({ direction: { tradition: 'anime', from: 'custom' }, hero: { actions: fragment, adornment: kit.adornment } }, { mechanics: {} }));
    const S = B.mechanics?.play.stats, ids = (fragment.powers ?? []).map((p) => p.id);
    return {
      system: R.system ? `${R.system.kind}${R.system.resource ? ` (${R.system.resource})` : ''}` : null,
      carries: kit.adornment.items.map((it) => `${it.id}: a ${it.build.item} in the ${it.slot} hand, for ${it.serves.join(', ')}`),
      body: kit.adornment.bodily ?? [],
      gained: B.mechanics ? B.mechanics.reasons.filter((r) => ids.some((id) => r.startsWith(`${id} (`))) : [],
      spends: (B.mechanics?.powers ?? []).filter((p) => p.spends).map((p) => `${p.id} spends ${Object.entries(p.spends).map(([k, v]) => `${v} ${k}`).join(', ')}`),
      stats: S ? S.stats.map((x) => x.id) : [],
      ...(R.open.length ? { open: R.open } : {}),
    };
  },
  motion(fragment) {
    const M = resolveMotion(fragment);
    const moved = Object.fromEntries(Object.entries(M.motion ?? {}).map(([g, d]) => [g, Object.keys(d).filter((k) => k !== 'seconds')]));
    return { axes: M.axes, stand: M.gesture ?? null, why: M.reasons ?? [], moved };
  },
  gear(card) {
    return {
      classes: Object.fromEntries(EQUIPMENT_ITEMS.map((cls) => {
        const errs = validateGear({ [CLASS_SLOTS[cls]]: { item: cls, style: card } });
        return [cls, errs.length ? `does not hold: ${errs[0]}` : `${Object.entries(card.language?.[cls] ?? {}).filter(([k]) => !['focus', 'shaft', 'board'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', ') || `blade ${card.language?.blade}, guard ${card.language?.guard}`}; raises ${GEAR_STAT[cls]}`];
      })),
    };
  },
});

function direction(rnd) {
  const tradition = deck(Object.keys(TRADITIONS), rnd), elements = Object.keys(ELEMENT_WORDS).filter((w) => ELEMENT_WORDS[w].gem), tints = Object.keys(ELEMENT_WORDS);
  const lead = deck(elements, rnd), support = deck(tints, rnd), motif = deck(MOTIFS, rnd);
  return () => {
    const primary = lead();
    let secondary = support();
    if (ELEMENT_WORDS[secondary].tint === ELEMENT_WORDS[primary].tint) secondary = support();
    const fragment = { tradition: tradition(), primary, secondary, motif: [motif()] };
    return { fragment, derives: DERIVE.direction(fragment) };
  };
}

function actions(rnd) {
  const idiom = deck(Object.keys(IDIOMS), rnd), bodily = deck(RAILS.filter((r) => r.bodily).flatMap((r) => r.stems).filter((s) => !BASELINE.has(s)), rnd);
  const held = deck(RAILS.filter((r) => r.item).flatMap((r) => r.stems.map((stem) => ({ stem, item: r.item }))), rnd);
  const look = deck(Object.keys(LOOKS), rnd), beam = deck(BEAM_NAMES, rnd);
  return () => {
    const a = bodily(), b = held(), c = rnd() < 0.5 ? bodily() : held().stem;
    const powers = [{ verb: a, look: look() }, { verb: b.stem, attack: beam() }, { verb: c, look: look() }]
      .map((p) => ({ id: `${p.verb}-${p.look ?? p.attack}`, ...p }));
    const fragment = { idiom: idiom(), powers, progression: STAGES.map((stage, i) => ({ stage, gains: [powers[i].id] })) };
    return { fragment, derives: DERIVE.actions(fragment) };
  };
}

function motion(rnd) {
  const vibe = deck(Object.keys(VIBES), rnd);
  return () => {
    const a = vibe();
    let b = vibe();
    if (b === a) b = vibe();
    const fragment = { vibe: [a, b] };
    return { fragment, derives: DERIVE.motion(fragment) };
  };
}

function gear(rnd) {
  const tint = deck(Object.values(ELEMENT_WORDS).map((w) => w.tint).filter((v, i, a) => a.indexOf(v) === i), rnd), metal = deck(METAL_NAMES, rnd);
  const pick = (slot) => VARIANTS[slot][Math.floor(rnd() * VARIANTS[slot].length)];
  const gem = deck([...new Set(Object.values(ELEMENT_WORDS).map((w) => w.gem).filter(Boolean))], rnd);
  // a finish the metal takes (a few belong to one metal only)
  const finishFor = (m) => { const ok = FINISH_NAMES.filter((f) => !FINISHES[f].only || FINISHES[f].only.includes(m)); return ok[Math.floor(rnd() * ok.length)]; };
  return () => {
    const blade = tint(), board = tint(), fittings = metal();
    const fragment = {
      dials: { stylize: Math.round((0.3 + rnd() * 0.65) * 100) / 100, mass: 1, focus: 'guard', ornament: 1 + Math.floor(rnd() * 3) }, lean: {},
      language: {
        blade: pick('blade'), guard: pick('guard'), pommel: pick('pommel'), grip: pick('grip'),
        staff: { head: pick('head'), focus: 'head', shaft: ['satin', board] },
        bow: { limb: pick('limb'), tips: pick('tips'), focus: 'riser', shaft: ['satin', board] },
        shield: { outline: pick('outline'), device: pick('device'), focus: 'boss', board: ['satin', board] },
      },
      edge: { fuller: 0, bevel: 0.5 },
      roles: { blade: ['satin', blade], edge: { metal: 'chrome', finish: 'mirror' }, fittings: { metal: fittings, finish: finishFor(fittings) }, accent: { metal: 'gold', finish: 'mirror' }, wrap: ['matte', tint()] },
      gem: { gem: gem(), glow: Math.round(rnd() * 60) / 100, cut: 'brilliant' },
    };
    return { fragment, derives: DERIVE.gear(fragment) };
  };
}

const DRAW = { direction, actions, motion, gear };

/** `n` samples of one page, drawn from `seed`. */
export function gameworldSamples(page, { n = 6, seed = 1 } = {}) {
  if (!DRAW[page]) throw new Error(`samples: '${page}' is not a page that can be sampled (${Object.keys(SAMPLE_PAGES).join(', ')})`);
  if (!Number.isInteger(n) || n < 1 || n > SAMPLE_MAX) throw new Error(`samples: n is a whole number from 1 to ${SAMPLE_MAX}`);
  if (!Number.isInteger(seed)) throw new Error('samples: seed is a whole number (the same seed draws the same samples)');
  const draw = DRAW[page](mulberry32(seed));
  return {
    page, seed, n,
    note: `Random draws from the space of ${page} choices, made without the brief: how a choice propagates, not what to choose. None is a recommendation, and no world is built from them. Compose your own page from the brief; the readout compares the world against what was shown (it draws these again from the seed).`,
    samples: Array.from({ length: n }, () => draw()),
  };
}
