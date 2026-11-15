/**
 * THE GAME'S COLOUR — the bridge from a game to the colour theorist (lib/graph/color-theorist/), so the question "how
 * should this game be coloured" is asked the same way of every game and answered with the same aid: what the game's
 * colour is NOW, measured, and the few ways it could be oriented, each one a patch.
 *
 * The theorist solves a palette for a WORLD and paints figures clear of a ground (figures.js); a game is the two
 * together. This reads the game into those terms:
 *
 *   figuresOfGame(G)      → { figures, unread }: who stands on the ground, in the theorist's words
 *     figures   [{ id, name, hex | wear, keep, protagonist?, at: [JSON Pointer], says }], the protagonist first
 *     unread    [{ id, why }]: who this cannot read yet (said, never guessed): a new kind of figure is a row in
 *               FIGURE_READERS, as a new kind of car is to the livery solver
 *   colourOfGame(G)       → { ground, figures, laws, sinks, unread } | null: the cast as it is, on the ground it has
 *                           (measured, nothing moved); null for a world with no ground to read (a room kit)
 *   castPatch(G, solved)  → the JSON Pointer ops that write a solved cast into the recipe (design_game { patch })
 *   colourOptions(world)  → { now, options, recommend, why } | null
 *     options   [{ id, name, says, why, patch, figures, laws, palette?: { spec, failing }, zones?: [contract] }]
 *               `cast`: the same land, the cast painted clear of it; then one per colour direction the world can take
 *               (color-theorist/directions.js: its land moved, the cast solved against the land it makes). One that
 *               would change nothing is not offered: a game already coloured has none
 *     recommend the first option under which every figure law holds, the fewest palette laws advising
 *   paintedCast(world)    → { world, painted }: the `cast` option taken on a world just composed (the sentence door's)
 *   GENRE_COLOUR          the direction a genre is laid in from a sentence (world-palette.js)
 *
 * WHO THE FIGURES ARE (FIGURE_READERS): the hero, in its garment (one its pages or its design chose is measured only:
 * hero-design.js puts a designed one in the world's accent; one nobody chose, off the kit's ramp, is put in the accent
 * on its colour page); a kin foe (foes/packs.js), its skin kept in its own hue family and moved in value and
 * chroma, one figure for all that share a coat; a pack's mark, the world's second accent (the hero's complement where
 * the two accents are neighbours: figures.js). A crew in a faction's dress and a beast are said unread.
 *
 * Pure: `world` a gameworld recipe, `G` a read one. Advice and patches; nothing here writes or refuses.
 */
import { readGameworld } from './world.js';
import { composeHero } from './hero-looks.js';
import { heroDesign } from './hero-design.js';
import { groundOf, accentOf, paletteSpecOf, GENRE_COLOUR, genrePaletteWords } from './world-palette.js';
import { bestiaryOf, peopleRollOf, isPeople } from './foes.js';
import { isKin, readPack, readKinBody, PACK_STYLES } from '../foes/packs.js';
import { kinCoat } from '../beast/cards.js';
import { LINEAGES } from '../egocube/ancestry.js';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet } from '../egocube/plan.js';
import { solvePalette, scriptShift } from '../color-theorist/solve.js';
import { solveFigures, measureFigures, seenOn, FIGURE_MIN } from '../color-theorist/figures.js';
import { COLOUR_DIRECTIONS, directSpec } from '../color-theorist/directions.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEXRE = /^#[0-9a-f]{6}$/i;

// a kin foe's coat as the run draws it: its body's own, its pack's shared one, else its sheet's roll
function kinCoatOf(G, id, entry) {
  const S = entry.skin, B = S.body !== undefined ? readKinBody(S.body, S.people) : {};
  if (B.coat !== undefined) return LINEAGES[S.people]?.cover?.[B.coat] ?? B.coat;
  if (S.pack !== undefined) return kinCoat(S.people);
  try { return planFromSheet(rollEgocube(peopleRollOf(G, id, entry))).create?.spec?.palette?.Skin ?? kinCoat(S.people); } catch { return kinCoat(S.people); }
}

/** The readers: each takes the game and answers its figures (or why it cannot). The order is the cast's: the
 * protagonist first, so every figure after it is painted clear of it. */
export const FIGURE_READERS = Object.freeze({
  hero: (G) => {
    if (!G.characters) return { figures: [], unread: [] };
    const C = composeHero(G), tones = isObj(C?.spec?.outfit?.style) ? C.spec.outfit.style.tones ?? {} : {};
    const outer = typeof tones.Outer === 'string' ? tones.Outer : null, hex = outer ?? C?.spec?.palette?.Top ?? tones.Top ?? null;
    if (!(typeof hex === 'string' && HEXRE.test(hex))) return { figures: [], unread: [{ id: 'hero', why: 'its garment names no colour of its own (the door\'s stock clothes)' }] };
    // (a garment nobody chose, the kit's ramp its setting dresses it from, is the game's to colour: the world's accent,
    // written on the hero's colour page; one the creator's pages chose, or a designed outfit's, is measured only)
    const accent = accentOf(G), unchosen = !outer && C.underlayer?.toneFrom?.Top === 'the kit\'s ramps' && G.characters.hero?.looks?.colour?.palette?.Top === undefined && accent;
    return { figures: [unchosen
      ? { id: 'hero', name: 'the hero', hex: hex.toLowerCase(), wear: accent, keep: 'hue', protagonist: true, at: ['/characters/hero/looks/colour'], field: 'palette.Top', says: 'its garment: off the kit\'s ramp now, the world\'s accent once painted' }
      : { id: 'hero', name: 'the hero', hex: hex.toLowerCase(), keep: 'colour', protagonist: true, at: [], says: 'its garment (its own pages decide it)' }], unread: [] };
  },
  kin: (G) => {
    const coats = new Map(), marks = new Map(), unread = [];
    // (the bestiary the world WROTE: one that names none is played by the stock stand-ins, which are nobody's design)
    for (const [id, entry] of Object.entries(G.foes ? bestiaryOf(G) ?? {} : {})) {
      const S = entry.skin;
      if (!S || !isPeople(entry) || !isKin(S.people)) { unread.push({ id, why: S?.people ? `a ${S.people} dressed as its crew or its own roll: its clothes are not read yet` : 'a beast: its coat is its species\', taken to the world\'s ramps' }); continue; }
      const coat = String(kinCoatOf(G, id, entry)).toLowerCase(), key = `${S.people}:${coat}`;
      if (!coats.has(key)) coats.set(key, { id: `${S.people}`, people: S.people, hex: coat, ids: [] });
      coats.get(key).ids.push(id);
      if (S.pack !== undefined) {
        const P = readPack(S.pack, S.people), mk = `${P.style}:${P.colourway}:${P.accent ?? ''}`;
        if (!marks.has(mk)) marks.set(mk, { P, ids: [] });
        marks.get(mk).ids.push(id);
      }
    }
    // (two coats of one people are told apart by the first foe that wears each)
    const seen = new Map(), figures = [];
    for (const c of coats.values()) { const n = (seen.get(c.people) ?? 0) + 1; seen.set(c.people, n);
      figures.push({ id: n > 1 ? `${c.people}-${c.ids[0]}` : c.people, name: `the ${c.people} (${c.ids.join(', ')})`, hex: c.hex, keep: 'hue', at: c.ids.map((id) => `/foes/${id}/skin/body`), field: 'coat', says: 'its skin, kept in its own hue family' }); }
    for (const m of marks.values()) { const S = PACK_STYLES[m.P.style];
      figures.push({ id: `mark-${m.P.style}`, name: `the ${S.name.toLowerCase()}' mark (${m.ids.join(', ')})`, ...(m.P.accent ? { hex: m.P.accent } : { hex: S.colourways[m.P.colourway].roles.accent.toLowerCase(), wear: 'accent2' }), keep: 'hue', at: m.ids.map((id) => `/foes/${id}/skin/pack`), field: 'accent', says: m.P.accent ? 'the pack\'s mark, as given' : 'the pack\'s mark: the world\'s second accent, or the hero\'s complement where the two accents are neighbours' }); }
    return { figures, unread };
  },
});

export function figuresOfGame(G) {
  const figures = [], unread = [];
  for (const read of Object.values(FIGURE_READERS)) { const R = read(G); figures.push(...R.figures); unread.push(...R.unread); }
  return { figures, unread };
}

// the theorist's order for a game's figures on a ground (a figure that wears a role needs the palette: on a kit's own
// ramps it is left out, and said)
function orderOf(figures, ground) {
  const order = figures.map(({ id, hex, wear, keep, protagonist }) => ({ id, ...(hex ? { hex } : {}), ...(wear && (ground.palette || HEXRE.test(wear) || !hex) ? { wear } : {}), keep, ...(protagonist ? { protagonist: true } : {}) })).filter((f) => f.hex || ground.palette);
  return order.length ? { against: ground.against, ...(ground.palette ? { palette: ground.palette } : {}), figures: order } : null;
}
const named = (R, figures) => R.figures.map((f) => { const F = figures.find((x) => x.id === f.id); return { ...f, name: F.name, says: F.says }; });
const sinksOf = (R) => R.figures.filter((f) => f.clear < FIGURE_MIN).map((f) => ({ id: f.id, clear: f.clear, from: f.nearest }));

export function colourOfGame(G) {
  const ground = groundOf(G);
  if (!ground) return null;
  const { figures, unread } = figuresOfGame(G), order = orderOf(figures, ground);
  if (!order) return { ground, figures: [], laws: [], sinks: [], unread };
  const R = measureFigures(order);
  return { ground, figures: named(R, figures), laws: R.laws, sinks: sinksOf(R), unread };
}

/** The ops that write a solved cast into the recipe: each moved figure's colour at its own pointers (a kin's
 * `body.coat`, a pack's `accent`), the object there kept and the one field set. */
export function castPatch(G, solved, figures = figuresOfGame(G).figures) {
  const at = (q) => q.slice(1).split('/').reduce((v, k) => (isObj(v) ? v[k] : undefined), { foes: bestiaryOf(G) ?? {}, characters: G.characters ?? {} });
  // (a field a level deep, `palette.Top`: the object above it kept too)
  const put = (o, [k, ...rest], v) => ({ ...(o ?? {}), [k]: rest.length ? put(o?.[k], rest, v) : v });
  const ops = [];
  for (const f of solved.figures) {
    const F = figures.find((x) => x.id === f.id);
    if (!F?.field || !f.was) continue;
    for (const q of F.at) ops.push({ op: 'set', path: q, value: put(at(q), F.field.split('.'), f.hex) });
  }
  return ops;
}

export function colourOptions(world) {
  const { kind: _k, ...W } = world, G = readGameworld(W), now = colourOfGame(G);
  if (!now) return null;
  const { figures } = figuresOfGame(G), spec = isObj(G.style?.palette) ? G.style.palette : null, levels = G.ids?.length ?? Object.keys(G.levels ?? {}).length;
  // a bare hero the door can design (hero-design.js) is designed with the cast: its pages, each its own op
  const design = heroDesign(G), heroOps = design ? Object.entries(design.looks).map(([k, v]) => ({ op: 'set', path: `/characters/hero/looks/${k}`, value: v })) : [];
  const withHero = design?.garment ? [{ id: 'hero', name: 'the hero', hex: design.garment, keep: 'colour', protagonist: true, at: [], says: 'designed: its garment the world\'s accent' }, ...figures.filter((f) => f.id !== 'hero')] : figures;
  const option = (id, name, says, why, contracts, paletteOps, moved) => {
    const ground = { against: contracts ? contracts.flatMap((K) => seenOn(K)) : now.ground.against, ...(contracts ? { palette: contracts[0] } : now.ground.palette ? { palette: now.ground.palette } : {}) };
    const order = orderOf(withHero, ground);
    if (!order) return null;
    const R = solveFigures(order), failing = contracts ? contracts[0].checks.filter((c) => !c.ok).map((c) => c.law) : null;
    return { id, name, says, why, patch: [...paletteOps, ...heroOps, ...castPatch(G, R, withHero)], figures: named(R, withHero), laws: R.laws,
      ...(moved ? { palette: { spec: moved, failing } } : {}), ...(contracts ? { zones: contracts } : {}) };
  };
  const options = [option('cast', 'The same land, the cast painted clear of it', 'nothing moves in the land; every figure is moved, inside its own hue family, until it parts from the ground and from the others',
    'the smallest change: the world keeps its look and the cast stops sinking into it', spec ? [solvePalette(spec)] : null, [], spec)];
  if (spec) for (const [id, D] of Object.entries(COLOUR_DIRECTIONS)) {
    if ((D.levels ?? 1) > levels) continue;
    const moved = directSpec(spec, id);
    if (JSON.stringify(moved) === JSON.stringify(spec)) continue;
    // (a script travels: the cast is solved against every level's land at once, so it parts from each)
    const { script, ...base } = moved, n = script ? levels : 1;
    const contracts = Array.from({ length: n }, (_, i) => { const shift = script ? scriptShift(script, i, n) : null; return solvePalette(shift ? { ...base, shift } : base); });
    options.push(option(id, D.name, D.says, D.why, contracts, [{ op: 'set', path: '/style/palette', value: moved }], moved));
  }
  // (an option that changes nothing is no option: a cast already painted is not offered its own colours)
  const kept = options.filter((o) => o && o.patch.length), holds = (o) => o.laws.every((l) => l.ok), fails = (o) => o.palette?.failing?.length ?? 0;
  const best = [...kept].sort((a, b) => Number(holds(b)) - Number(holds(a)) || fails(a) - fails(b))[0];
  return { now, options: kept, recommend: best?.id ?? null,
    why: best ? `${holds(best) ? 'every figure law holds' : 'the figure laws it leaves advising are the fewest'}${best.palette ? fails(best) ? `, ${fails(best)} palette law${fails(best) > 1 ? 's' : ''} advising` : ', and every palette law' : ''}` : null };
}

/**
 * A world's cast PAINTED: the `cast` option taken, each figure's colour solved against the ground the world has and
 * written where it is kept (a kin's coat, a pack's mark, an unchosen garment on the hero's colour page; a designed
 * hero's pages are its own: hero-design.js). The sentence door's (design_game compose), once the world's palette is
 * stamped. → { world, painted: [{ id, hex, was }] }; the world as it was where it has no ground, no figure to move, or
 * none moved.
 */
export function paintedCast(world) {
  const { kind: _k, ...W } = world, G = readGameworld(W), ground = groundOf(G);
  const { figures } = ground ? figuresOfGame(G) : { figures: [] }, order = ground ? orderOf(figures, ground) : null;
  if (!order) return { world, painted: [] };
  const R = solveFigures(order), ops = castPatch(G, R, figures);
  if (!ops.length) return { world, painted: [] };
  const next = structuredClone(world);
  for (const o of ops) { const ks = o.path.slice(1).split('/'); let at = next; for (const k of ks.slice(0, -1)) { if (!isObj(at[k])) at[k] = {}; at = at[k]; } at[ks.at(-1)] = o.value; }
  return { world: next, painted: R.figures.filter((f) => f.was && figures.find((x) => x.id === f.id)?.field).map(({ id, hex, was }) => ({ id, hex, was })) };
}

export { paletteSpecOf, GENRE_COLOUR, genrePaletteWords };
