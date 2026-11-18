/**
 * THE SEA'S ANIMALS: which of the encyclopedia's animals (fauna/, bugs/) live in a sea, how each lives there, and the laws
 * a cast is called by. Nothing is modelled here: a row names a species the encyclopedia already builds and says where
 * it belongs, so an animal is callable the day its row lands. Never an enemy (a biocube's fauna never is: a hunter that
 * hunts is a gameworld foe); a shark here cruises.
 *
 *   MARINE_HABITS    how an animal lives, each the rule its path is laid by:
 *                      anemone  circling close over an anemone it never leaves
 *                      reef     round a rock, at the rock's height
 *                      bed      on the sand, slowly
 *                      lurk     hanging nearly still by a rock or over the bed
 *                      school   many of one kind on one loop in open water
 *                      cruise   one, a pair or a pod on a long loop over the whole place
 *   MARINE_FAUNA     a row a species: `roster` (which encyclopedia), `gait` (the clip it moves by), `depth` [lo, hi]
 *                    metres it lives under, `lives` (its habit), `group` [lo, hi] (how many go together), `mixes` (the
 *                    compositions of marine/roster.js it belongs in: called there unasked), and where it is not a sea
 *                    animal at all, `fresh` (fresh water) or `ancient` (extinct: only when named)
 *
 *   searchMarine(words, { depth?, what? })   what grows and what lives, by the words people say → ranked rows, each
 *                                            saying whether it fits the depth and why not
 *   castMarine(ask, { mix, depth, has, seed })   THE CALL: who lives here → { cast, left, offered }
 *   placeMarineFauna(cast, at)               each animal's looped path by its habit → { walkers, figures, readout }
 *
 * THE LAWS OF THE CALL (MARINE_CALL), each said in `left` where it leaves an animal out; advice, never a refusal:
 *   depth    an animal lives under its own depth of water
 *   room     the water holds it: at least `room` of its length deep (no whale in a lagoon)
 *   habitat  its habit has its seat: an anemone fish needs anemones, a reef fish a rock
 *   salt     a fresh-water animal is not a sea's; an extinct one comes only when named
 *   pyramid  many small, few large: one kind a habit (two round the rocks), one large cruiser at most, bodies and
 *            kinds under the page's budget, the schools thinned first
 *
 * Pure: a hash, never a clock or a random.
 */
import { SPECIES } from '../fauna/species.js';
import { FAMILY_ABOUT } from '../fauna/families.js';
import { BUG_SPECIES } from '../bugs/species.js';
import { about as BUG_ABOUT } from '../bugs/about.js';
import { MARINE } from './forms.js';
import { MARINE_KINDS, MARINE_MIX_IDS } from './roster.js';

const { hash } = MARINE;
const fz = Object.freeze;
const TAU = Math.PI * 2;
const r3 = (v) => Math.round(v * 1e3) / 1e3;
const lerp = (a, b, t) => a + (b - a) * t;

export const MARINE_HABITS = fz({
  anemone: fz({ reads: 'circling close over an anemone it never leaves', needs: 'anemone', slots: 1, off: fz([0.25, 0.55]), radius: fz([0.3, 0.6]), pace: 1.6 }),
  reef: fz({ reads: 'round a rock, at the rock\'s height', needs: 'rock', slots: 2, off: fz([0.3, 1.4]), radius: fz([1.15, 1.7]), pace: 1.0 }),
  bed: fz({ reads: 'on the sand, slowly', needs: null, slots: 1, off: fz([0.02, 0.08]), radius: fz([1.5, 4]), pace: 0.35 }),
  lurk: fz({ reads: 'hanging nearly still by a rock or over the bed', needs: null, slots: 1, off: fz([0.4, 2]), radius: fz([0.5, 1.2]), pace: 0.25 }),
  school: fz({ reads: 'many of one kind on one loop in open water', needs: null, slots: 1, off: fz([2, 5]), radius: fz([6, 11]), pace: 1.2 }),
  cruise: fz({ reads: 'one, a pair or a pod on a long loop over the whole place', needs: null, slots: 1, off: fz([3, 9]), radius: fz([14, 24]), pace: 0.8 }),
});
export const MARINE_HABIT_IDS = fz(Object.keys(MARINE_HABITS));

const row = (o) => fz({ roster: 'fauna', gait: 'swim', mixes: [], ...o, depth: fz(o.depth), group: fz(o.group ?? [1, 1]), mixes: fz(o.mixes ?? []) });
export const MARINE_FAUNA = fz({
  // round the rocks and in the anemones
  clownfish: row({ depth: [1, 15], lives: 'anemone', group: [2, 4], mixes: ['reef', 'meadow'] }),
  angelfish: row({ depth: [2, 30], lives: 'reef', group: [2, 5], mixes: ['reef', 'wall'] }),
  pufferfish: row({ depth: [1, 30], lives: 'reef', group: [1, 2], mixes: ['reef', 'meadow', 'kelp'] }),
  morayEel: row({ depth: [1, 50], lives: 'lurk', mixes: ['reef', 'wall'] }),
  cuttlefish: row({ depth: [1, 100], lives: 'lurk', group: [1, 2], mixes: ['reef', 'kelp', 'meadow', 'wall'] }),
  // on the bed
  octopus: row({ depth: [1, 100], lives: 'bed', mixes: ['reef', 'kelp', 'wall'] }),
  stingray: row({ depth: [1, 60], lives: 'bed', group: [1, 3], mixes: ['meadow', 'reef'] }),
  walrus: row({ depth: [2, 80], lives: 'bed', group: [1, 2] }),
  lobster: row({ roster: 'bugs', gait: 'walk', depth: [1, 50], lives: 'bed', group: [1, 2], mixes: ['reef', 'kelp', 'wall'] }),
  europeanLobster: row({ roster: 'bugs', gait: 'walk', depth: [1, 60], lives: 'bed', group: [1, 2] }),
  spinyLobster: row({ roster: 'bugs', gait: 'walk', depth: [1, 90], lives: 'bed', group: [1, 3], mixes: ['reef'] }),
  slipperLobster: row({ roster: 'bugs', gait: 'walk', depth: [2, 100], lives: 'bed' }),
  langoustine: row({ roster: 'bugs', gait: 'walk', depth: [20, 800], lives: 'bed', group: [1, 3], mixes: ['deep'] }),
  greenCrab: row({ roster: 'bugs', gait: 'sideways', depth: [0, 60], lives: 'bed', group: [2, 4], mixes: ['meadow', 'kelp', 'reef'] }),
  horseshoeCrab: row({ roster: 'bugs', gait: 'walk', depth: [0, 30], lives: 'bed', group: [1, 2], mixes: ['meadow'] }),
  // in open water, together
  tuna: row({ depth: [0, 250], lives: 'school', group: [6, 12], mixes: ['wall', 'kelp', 'reef'] }),
  salmon: row({ depth: [0, 120], lives: 'school', group: [6, 12], mixes: ['kelp'] }),
  squid: row({ depth: [0, 500], lives: 'school', group: [5, 10], mixes: ['wall', 'deep'] }),
  // over the whole place
  seaTurtle: row({ depth: [0, 40], lives: 'cruise', group: [1, 2], mixes: ['reef', 'meadow', 'kelp'] }),
  mantaRay: row({ gait: 'fly', depth: [0, 120], lives: 'cruise', group: [1, 2], mixes: ['reef', 'wall'] }),
  hammerhead: row({ depth: [1, 80], lives: 'cruise', group: [1, 3], mixes: ['wall', 'reef'] }),
  greatWhiteShark: row({ depth: [0, 250], lives: 'cruise', mixes: ['kelp', 'wall'] }),
  whaleShark: row({ depth: [0, 100], lives: 'cruise', mixes: ['wall'] }),
  swordfish: row({ depth: [0, 550], lives: 'cruise', mixes: ['wall', 'deep'] }),
  bottlenoseDolphin: row({ depth: [0, 50], lives: 'cruise', group: [3, 5], mixes: ['reef', 'kelp', 'meadow'] }),
  orca: row({ depth: [0, 100], lives: 'cruise', group: [2, 3], mixes: ['kelp'] }),
  humpbackWhale: row({ depth: [0, 150], lives: 'cruise', mixes: ['wall'] }),
  belugaWhale: row({ depth: [0, 100], lives: 'cruise', group: [2, 4] }),
  narwhal: row({ depth: [0, 800], lives: 'cruise', group: [2, 4] }),
  harborSeal: row({ depth: [0, 60], lives: 'cruise', group: [1, 3], mixes: ['kelp'] }),
  seaLion: row({ depth: [0, 60], lives: 'cruise', group: [2, 4], mixes: ['kelp'] }),
  // in the dark
  anglerfish: row({ depth: [200, 2000], lives: 'lurk', group: [1, 2], mixes: ['deep', 'vents'] }),
  nautilus: row({ depth: [100, 600], lives: 'lurk', group: [1, 3], mixes: ['deep'] }),
  // not a sea's: said so where they are asked for
  elasmosaurus: row({ depth: [0, 200], lives: 'cruise', ancient: true }),
  goldfish: row({ depth: [0, 5], lives: 'reef', fresh: true }),
  pondTurtle: row({ depth: [0, 5], lives: 'bed', gait: 'swim', fresh: true }),
  crayfish: row({ roster: 'bugs', gait: 'walk', depth: [0, 5], lives: 'bed', fresh: true }),
});
export const MARINE_FAUNA_IDS = fz(Object.keys(MARINE_FAUNA));

/** The call's measures: `room`, the water an animal needs against its length (`open` times that for one that lives in
 *  open water: a school, a cruiser); the sizes past which a cruiser is LARGE
 *  (one kind of them a place); and the page's most: kinds, bodies, and bones posed a frame (each body its rig's). */
export const MARINE_CALL = fz({ room: 1.5, open: 2, large: 2.5, most: fz({ kinds: 6, bodies: 44, bones: 1100 }) });

/** What the encyclopedia says of a species: the names people say, its length (m), its family. */
export function marineAbout(id) {
  const R = MARINE_FAUNA[id]; if (!R) return null;
  const bug = R.roster === 'bugs', A = (bug ? BUG_ABOUT[id] : FAMILY_ABOUT[id]) || {}, S = bug ? BUG_SPECIES[id] : SPECIES[id];
  return { id, common: A.common ?? S?.name ?? id, aliases: A.aliases ?? [], family: bug ? 'crustacean' : S?.family ?? null, size: A.size ?? null };
}

const tokens = (s) => String(s).toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^a-z0-9]+/).filter((w) => w.length > 1);
const STOP = new Set(['the', 'and', 'of', 'in', 'on', 'for', 'some', 'with', 'that', 'what', 'lives', 'grows', 'sea', 'ocean', 'marine', 'underwater', 'animals', 'animal', 'things']);
// (a query's word against a row's: the same word, or one the other begins, plurals aside)
const hit = (q, w) => { const a = q.replace(/(es|s)$/, ''), b = w.replace(/(es|s)$/, ''); return a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b)); };

/**
 * What grows and what lives, searched by the words people say: a name ("clownfish", "sea fan"), a family ("shark",
 * "crustacean"), a habit ("school", "on the bed", "reef"), a way of growing ("kelp", "coral"). `what`: 'fauna', 'flora'
 * or both; `depth` (m): each row says whether it fits and why not. No words: every row (what there is to call).
 * → [{ id, what, name, lives | seat, depth, reads, score, fits, why? }], best first.
 */
export function searchMarine(words = '', { depth = null, what = null } = {}) {
  const Q = tokens(words).filter((w) => !STOP.has(w)), out = [];
  // (a word that is in a row's own names counts three times one that is only said of it: its family, its habit, its mix)
  const add = (id, kind, name, names, hay, extra) => {
    const N = names.flatMap(tokens), H = hay.flatMap(tokens);
    // (and a row one of whose names the words say whole comes before one they only touch: "sea turtle" before "turtle grass")
    const whole = names.some((n) => { const T = tokens(n).filter((w) => !STOP.has(w)); return T.length > 0 && T.every((w) => Q.some((q) => hit(q, w))); });
    const score = Q.length ? Q.reduce((a, q) => a + (N.some((w) => hit(q, w)) ? 3 : H.some((w) => hit(q, w)) ? 1 : 0), 0) + (whole ? 2 : 0) : 1;
    if (score > 0) out.push({ id, what: kind, name, ...extra, score });
  };
  if (what !== 'flora') for (const id of MARINE_FAUNA_IDS) {
    const R = MARINE_FAUNA[id], A = marineAbout(id), why = R.fresh ? 'lives in fresh water, not the sea' : depth !== null && (depth < R.depth[0] || depth > R.depth[1]) ? `lives under ${R.depth[0]} to ${R.depth[1]} m of water, not ${depth}` : null;
    add(id, 'fauna', A.common, [id, A.common, ...A.aliases], [A.family ?? '', R.lives, MARINE_HABITS[R.lives].reads, ...(A.family === 'chondrichthyan' ? ['shark ray'] : A.family === 'teleost' ? ['fish'] : A.family === 'cetacean' ? ['whale dolphin mammal'] : A.family === 'crustacean' ? ['crustacean shellfish'] : A.family === 'cephalopod' ? ['cephalopod mollusc'] : []), ...R.mixes],
      { lives: R.lives, depth: R.depth, group: R.group, reads: MARINE_HABITS[R.lives].reads, fits: !why, ...(why ? { why } : {}), ...(R.ancient ? { ancient: true } : {}) });
  }
  if (what !== 'fauna') for (const [id, K] of Object.entries(MARINE_KINDS)) {
    const why = depth !== null && (depth < K.depth[0] || depth > K.depth[1]) ? `lives under ${K.depth[0]} to ${K.depth[1]} m of water, not ${depth}` : null;
    add(id, 'flora', K.says[0], [id, ...K.says], [K.grow, K.seat, K.reads, ...(K.grow === 'kelp' || K.grow === 'grass' || K.grow === 'lettuce' ? ['plant weed algae'] : []), ...(/coral/.test(K.says.join(' ')) ? ['coral'] : []), ...(/sponge/.test(K.says.join(' ')) ? ['sponge'] : [])],
      { seat: K.seat, depth: K.depth, reads: K.reads, fits: !why, ...(why ? { why } : {}) });
  }
  return out.sort((a, b) => b.score - a.score || Number(b.fits) - Number(a.fits) || a.id.localeCompare(b.id));
}

/** The animals whose own name the words say (their common name, an alias, or their id), the longest name first: a word
 *  a longer name took names no shorter one. */
export function namedBy(words) {
  const Q = tokens(words), used = new Set(), out = [], C = [];
  for (const id of MARINE_FAUNA_IDS) { const A = marineAbout(id); for (const n of [A.common, ...A.aliases, id]) { const T = tokens(n); if (T.length) C.push({ id, T }); } }
  C.sort((a, b) => b.T.length - a.T.length || a.id.localeCompare(b.id));
  for (const { id, T } of C) {
    const at = T.map((t) => Q.findIndex((q, i) => !used.has(i) && hit(q, t)));
    if (at.some((i) => i < 0) || new Set(at).size !== at.length) continue;
    at.forEach((i) => used.add(i)); if (!out.includes(id)) out.push(id);
  }
  return out;
}

const KEYS = ['cast', 'find', 'density', 'seed'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A biocube's `fauna.sea`, checked: true (who its sea's mix calls), words (as `find`), or { cast?: { <species>: true |
 *  a count | null (never) }, find?: words (searchMarine: the animals they name are asked for), density? (0.3–2), seed? }.
 *  Absent / false / null → null. */
export function checkSeaFauna(v) {
  if (v === undefined || v === null || v === false) return null;
  const say = `fauna.sea is true (who lives in its sea's mix), words to find them by, or { ${KEYS.join(', ')} }: the sea's animals of the encyclopedia, called by depth, room and habitat`;
  const o = v === true ? {} : typeof v === 'string' ? { find: v } : isObj(v) ? v : null;
  if (!o) throw new Error(say);
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) throw new Error(`fauna.sea.${k} is not a setting (${KEYS.join(', ')})`);
  if (o.cast !== undefined) {
    if (!isObj(o.cast)) throw new Error('fauna.sea.cast is { <species>: true | a count | null }');
    for (const [id, n] of Object.entries(o.cast)) {
      if (!MARINE_FAUNA[id]) { const near = searchMarine(id, { what: 'fauna' })[0]; throw new Error(`fauna.sea.cast.${id} is not one of the sea's animals${near ? ` (nearest: ${near.id})` : ''}; searchMarine finds them by the words people say`); }
      if (!(n === true || n === null || (Number.isInteger(n) && n >= 1 && n <= 40))) throw new Error(`fauna.sea.cast.${id} is true, a count (1 to 40) or null (never)`);
    }
  }
  if (o.find !== undefined && !(typeof o.find === 'string' && o.find.trim())) throw new Error('fauna.sea.find is a few words naming who to call ("sharks and rays", "a turtle and some crabs")');
  const density = o.density ?? 1;
  if (!(typeof density === 'number' && density >= 0.3 && density <= 2)) throw new Error('fauna.sea.density is how many of each go together, 0.3 to 2 (× its own group)');
  if (o.seed !== undefined && !Number.isInteger(o.seed)) throw new Error('fauna.sea.seed is a whole number');
  return { cast: { ...(o.cast ?? {}) }, find: o.find ?? null, density, ...(o.seed !== undefined ? { seed: o.seed } : {}) };
}

/**
 * THE CALL: who lives in this water. `ask` a checked `fauna.sea`; `mix` the flora's composition (marine/roster.js; none:
 * a bare sea, called as the reef's is); `depth` metres; `has` { rock, anemone } how many of each the bed has; `lengthOf(id)`
 * an animal's length in metres (the encyclopedia's measure: worlds/marine-fauna.js gives it).
 * → { cast: [{ species, roster, gait, lives, count, asked }], left: [{ species, why }], offered: [species that live here
 * and were not called] }
 */
export function castMarine(ask, { mix = null, depth = 14, has = {}, lengthOf = () => 1, seed = 1 } = {}) {
  const C = MARINE_CALL, m = MARINE_MIX_IDS.includes(mix) ? mix : 'reef', S = (ask.seed ?? seed) | 0, left = [], fits = [];
  const named = new Set(Object.entries(ask.cast).filter(([, n]) => n !== null).map(([id]) => id)), never = new Set(Object.entries(ask.cast).filter(([, n]) => n === null).map(([id]) => id));
  // (the words find their animals: one whose own name the words say is asked for, the longest name first, so "a whale
  // shark" is not also "a shark"; what the words only describe, a family or a habit, is preferred where it fits)
  const prefer = new Map();
  if (ask.find) {
    for (const id of namedBy(ask.find)) if (!never.has(id)) named.add(id);
    for (const f of searchMarine(ask.find, { what: 'fauna' })) prefer.set(f.id, f.score);
  }
  for (const id of MARINE_FAUNA_IDS) {
    const R = MARINE_FAUNA[id], asked = named.has(id);
    if (never.has(id) || (!asked && !R.mixes.includes(m))) continue;
    const no = (why) => { if (asked) left.push({ species: id, why }); };
    if (R.fresh) { no('lives in fresh water, not the sea'); continue; }
    if (R.ancient && !asked) continue;
    const L = lengthOf(id), H = MARINE_HABITS[R.lives];
    if (depth < R.depth[0] || depth > R.depth[1]) { left.push({ species: id, why: `lives under ${R.depth[0]} to ${R.depth[1]} m of water, not ${depth}` }); continue; }
    const need = L * C.room * (R.lives === 'school' || R.lives === 'cruise' ? C.open : 1);
    if (depth < need) { left.push({ species: id, why: `is ${r3(L)} m long: it needs ${r3(need)} m of water, not ${depth}` }); continue; }
    if (H.needs && !(has[H.needs] > 0)) { left.push({ species: id, why: `lives ${H.reads}: this bed has no ${H.needs}` }); continue; }
    fits.push({ id, R, L, asked, want: prefer.get(id) ?? 0, dice: hash(S * 31 + MARINE_FAUNA_IDS.indexOf(id), 5) });
  }
  // the pyramid: a habit's slots, the asked first, then by the dice; one LARGE cruiser kind at most
  const cast = [], offered = [];
  for (const h of MARINE_HABIT_IDS) {
    const F = fits.filter((f) => f.R.lives === h).sort((a, b) => Number(b.asked) - Number(a.asked) || b.want - a.want || a.dice - b.dice); let large = 0;
    for (const f of F) {
      const big = f.L >= C.large, slots = Math.max(MARINE_HABITS[h].slots, F.filter((x) => x.asked).length);
      if (cast.filter((c) => c.lives === h).length >= slots || (big && large >= 1 && !f.asked)) { offered.push(f.id); continue; }
      if (big) large++;
      const n = ask.cast[f.id], g = f.R.group, count = Number.isInteger(n) ? n : Math.max(1, Math.round(lerp(g[0], g[1], hash(S * 37 + cast.length, 9)) * ask.density));
      cast.push({ species: f.id, roster: f.R.roster, gait: f.R.gait, lives: h, count, asked: f.asked, length: r3(f.L), slot: cast.filter((c) => c.lives === h).length, want: f.want });
    }
  }
  // the budget: kinds (the unasked let go: a habit's second kind first, then the least wanted, the stillest habit first,
  // so a place keeps one of each way of living as long as it can), then bodies (the largest groups thinned first)
  const STILL = ['lurk', 'bed', 'anemone', 'reef', 'school', 'cruise'];
  while (cast.length > C.most.kinds) {
    const D = cast.filter((c) => !c.asked).sort((a, b) => b.slot - a.slot || a.want - b.want || STILL.indexOf(a.lives) - STILL.indexOf(b.lives))[0];
    if (!D) break;
    offered.push(D.species); cast.splice(cast.indexOf(D), 1);
  }
  const bodies = () => cast.reduce((a, c) => a + c.count, 0);
  for (let guard = 0; bodies() > C.most.bodies && guard < 200; guard++) { const c = cast.filter((x) => x.count > 1).sort((a, b) => b.count - a.count)[0]; if (!c) break; c.count--; }
  return { cast: cast.map(({ slot, want, ...c }) => c), left, offered: offered.sort() };
}

/**
 * Each called animal's looped path, by its habit. `at`: { z(x, y) the bed's height or null, rocks: [{ x, y, z, R, H }],
 * anemones: [[x, y, z]], trail: [[x, y, z]] (the walk's cells), surface (z of the water's top), seed, bonesOf(species) }.
 * Each body is its own closed path (the walkers channel starts every body at its path's first point: a group's members
 * are the leader's loop turned to their own start and set a little off it), kept over the bed and under the surface.
 * Each asks for the walkers' `blend`: one skin, so a body that bends along its length shows no joint.
 * → { walkers: [{ figure, path, speed, stride, style, blend }], figures: { <figure>: { species, roster, gait } }, readout }
 */
export function placeMarineFauna(cast, { z, rocks = [], anemones = [], trail = [], surface = Infinity, seed = 1, bonesOf = () => 20 } = {}) {
  const S = seed | 0, walkers = [], figures = {}, counts = {}; let bones = 0;
  const c0 = trail.length ? trail.reduce((a, t) => [a[0] + t[0] / trail.length, a[1] + t[1] / trail.length, a[2] + t[2] / trail.length], [0, 0, 0]) : [0, 0, 0];
  const ext = trail.length ? Math.max(8, ...trail.map((t) => Math.hypot(t[0] - c0[0], t[1] - c0[1]))) : 14;
  const bedAt = (x, y) => z(x, y) ?? c0[2];
  // (nearest the walk first: what is called is met)
  const byWalk = (L, at) => [...L].sort((a, b) => Math.hypot(at(a)[0] - c0[0], at(a)[1] - c0[1]) - Math.hypot(at(b)[0] - c0[0], at(b)[1] - c0[1]));
  const R2 = byWalk(rocks, (r) => [r.x, r.y]), A2 = byWalk(anemones, (a) => a);
  cast.forEach((c, ci) => {
    const H = MARINE_HABITS[c.lives], d = (a, b = 0) => hash(S * 131 + ci * 17 + a, b), fig = `sea:${c.species}`, len = c.length;
    figures[fig] = { species: c.species, roster: c.roster, gait: c.gait };
    // where its loop is centred, how wide, how high over the bed
    let centre, rad, off, wob = 0.18, n = 18;
    if (c.lives === 'anemone') { const a = A2[Math.floor(d(1) * Math.min(A2.length, 6))]; centre = [a[0], a[1]]; rad = lerp(H.radius[0], H.radius[1], d(2)); off = (a[2] - bedAt(a[0], a[1])) + lerp(H.off[0], H.off[1], d(3)); n = 12; }
    else if (c.lives === 'reef') { const r = R2[Math.floor(d(1) * Math.min(R2.length, 5))]; centre = [r.x, r.y]; rad = r.R * lerp(H.radius[0], H.radius[1], d(2)); off = lerp(H.off[0], H.off[1], d(3)) * Math.max(0.6, r.H); }
    else if (c.lives === 'lurk') { const r = R2.length ? R2[Math.floor(d(1) * Math.min(R2.length, 5))] : null, a = TAU * d(4), R = r ? r.R * 1.25 : 4 + 6 * d(5); centre = r ? [r.x + Math.cos(a) * R, r.y + Math.sin(a) * R] : [c0[0] + Math.cos(a) * R, c0[1] + Math.sin(a) * R]; rad = lerp(H.radius[0], H.radius[1], d(2)); off = lerp(H.off[0], H.off[1], d(3)); n = 10; }
    else if (c.lives === 'bed') { const a = TAU * d(4), R = 3 + ext * 0.5 * d(5); centre = [c0[0] + Math.cos(a) * R, c0[1] + Math.sin(a) * R]; rad = lerp(H.radius[0], H.radius[1], d(2)); off = lerp(H.off[0], H.off[1], d(3)); wob = 0.3; }
    else if (c.lives === 'school') { const a = TAU * d(4), R = ext * 0.35 * d(5); centre = [c0[0] + Math.cos(a) * R, c0[1] + Math.sin(a) * R]; rad = lerp(H.radius[0], H.radius[1], d(2)); off = lerp(H.off[0], H.off[1], d(3)); n = 24; }
    else { centre = [c0[0], c0[1]]; rad = Math.max(lerp(H.radius[0], H.radius[1], d(2)), ext * 0.8); off = lerp(H.off[0], H.off[1], d(3)) + len; n = 32; }
    const turn = d(6) < 0.5 ? 1 : -1, ph = [TAU * d(7), TAU * d(8)], squash = 0.7 + 0.3 * d(9), spin = TAU * d(10);
    // (the leader's loop: a wobbling ellipse, turned; each point over the bed at its height, rising and falling a little)
    const loop = (k, shift, dz) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = ((i + k) % n) / n, a = turn * TAU * u, r = rad * (1 + wob * Math.sin(2 * a + ph[0]) + 0.5 * wob * Math.sin(3 * a + ph[1]));
        const ex = Math.cos(a) * r, ey = Math.sin(a) * r * squash, x = centre[0] + ex * Math.cos(spin) - ey * Math.sin(spin) + shift[0], y = centre[1] + ex * Math.sin(spin) + ey * Math.cos(spin) + shift[1];
        const bed = bedAt(x, y), rise = c.lives === 'bed' ? 0 : off * 0.18 * Math.sin(a * 2 + ph[1]);
        pts.push([r3(x), r3(y), r3(Math.min(surface - Math.max(0.4, len * 0.4), Math.max(bed + (c.lives === 'bed' ? off : Math.max(off * 0.4, len * 0.3)), bed + off + rise + dz)))]);
      }
      return pts;
    };
    const per = bonesOf(c.species), speed = Math.max(0.04, len * H.pace * (0.85 + 0.3 * d(11)));
    for (let j = 0; j < c.count; j++) {
      if (bones + per > MARINE_CALL.most.bones) break;
      // (a member: the same loop from its own start, a body's length or two off the leader's line)
      const spread = c.lives === 'school' ? len * 1.6 + 0.3 : c.lives === 'cruise' ? len * 1.3 : c.lives === 'anemone' ? 0.12 : len * 0.8 + 0.2;
      const k = c.lives === 'school' ? Math.floor(d(20 + j) * 3) : Math.floor((j / c.count) * n + d(20 + j) * 2), shift = j ? [(d(30 + j) - 0.5) * 2 * spread, (d(40 + j) - 0.5) * 2 * spread] : [0, 0];
      walkers.push({ figure: fig, path: loop(k, shift, j ? (d(50 + j) - 0.5) * spread : 0), speed: r3(speed), stride: r3(Math.max(0.05, len * 0.9)), style: `sea:${c.lives}`, blend: true });
      bones += per; counts[c.species] = (counts[c.species] || 0) + 1;
    }
  });
  for (const f of Object.keys(figures)) if (!walkers.some((w) => w.figure === f)) delete figures[f];
  return { walkers, figures, readout: { bodies: walkers.length, bones, kinds: counts } };
}
