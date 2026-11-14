/**
 * THE SOUND SHEET: a game's sounds, solved from what the game already is (its arsenal, its foes, its world), every one a
 * row on the SFX shelf (sfx-shelf/, docs/sfx-shelf.md) by its word, never written twice. The sound chapter's page
 * (chapters.js `sound`). Pure.
 *
 *   soundSheet(G, { manifest? })  → { style, slots: { step, jump, land, dodge, swing, strike }, on: { <palette cue id>:
 *                       <shelf word> }, foes: { <id>: <shelf word> }, why: { <slot | cue | foe>: reason }, owed: [reason] }
 *                       (a level's `manifest` sets its ground: a stage grown on a nature or jungle kit is grass underfoot)
 *   sheetAudio(G, { manifest? })  → the level's `audio.sfx` word for the sheet: { sheet: { style, slots, on, moves? } }
 *                       (beats-world.js voices it)
 *
 * THE WHOLE ARSENAL: a game with an arsenal (arsenal.js: its own, or its feel's kit) is given `moves`, the moveset's
 * events (beats-world.js `audio.moves`) by shelf word: every weapon's swing and blow by the move's weight (light, heavy,
 * finisher), the guard's block, parry and break, the bow, the weapon cycle, a foe's swing and fall, a blow taken. They
 * are the practice room's words (MOVE_SOUND_WORDS below, the room reads the same table), with a weapon read by its
 * words where the shelf has its own (a staff, nunchaku, a katana). A game overrides a weapon with `sound.weapons:
 * { <weapon id>: { swing?, heavy?, hit?, finisher? } }` and an event with `sound.moves: { block?, parry?, … }`. A game
 * with no arsenal keeps the two slots (`swing`, `strike`) it had.
 *
 * NEW VOICES FIRST (the operator's rule, 2026-11-10): the sheet's style is `mouth` unless the game writes another
 * (`sound.style`), so every event the mouth voices (mouth foley: the swings, the strikes, the staff, the steps on grass,
 * the latch, the creatures) plays that voice, and the rest are realistic as the overlay falls back (styles.js); and
 * where two rows could answer an event, the sheet names the one the mouth voices.
 *
 * The level's mechanics decide which events sound (beats-world reads them as the palette's `auto` does): the sheet only
 * says what each palette cue id is played by. A game overrides any of it by writing it: `sound: { style?, slots?: {…},
 * on?: {…} }`, each a shelf word (sfx-shelf/roster.js). A sheet is suggested where a game has none, never laid behind
 * its back: a level hears it when its game has a `sound` of its own (even an empty one: every level the game builds,
 * levelSheet below) or its quick game says `sfx: 'sheet'`.
 *
 *   levelSheet(G, { manifest?, quick? })  → the audio a level of this game is built with ({ sfx: { sheet }, bed? } over
 *                       the stage's own `audio`), or null: a game on no sheet, whose levels are built as they were
 */
import { SOUNDS, resolveSoundId } from '../sfx-shelf/roster.js';
import { STYLES } from '../sfx-shelf/styles.js';
import { suggestSounds } from '../sfx-shelf/find.js';
import { arsenalOfGame } from './arsenal.js';
import { BASIC_ARSENAL } from './combos.js';
import { stageKit } from '../era/stage.js';
import { resolveBed, BEDS } from '../sfx-shelf/beds.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// THE MOVESET'S WORDS: what each of a moveset's sounds is on the shelf. The practice room's table (practice-room.js
// roomAudio reads it), so what is heard in the room is what a level plays.
export const MOVE_SOUND_WORDS = Object.freeze({ 'blade-light': 'blade-swing', 'blade-heavy': 'blunt-swing', 'fist-swing': 'swing', 'blade-hit': 'blade-hit', 'finisher-hit': 'knockout-blow',
  punch: 'punch', uppercut: 'uppercut', block: 'block', parry: 'blade-clash', 'guard-break': 'wood-break', 'bow-draw': 'bow-draw', 'bow-shot': 'bow-shot',
  'arrow-hit': 'arrow-target', felled: 'down', cycle: 'weapon-switch', 'foe-swing': 'blade-swing', hurt: 'flesh-impact' });
// a moveset's one-cue events (beats-world.js MOVE_SOUNDS.one) → the table's row
const MOVE_EVENTS = Object.freeze({ block: 'block', parry: 'parry', break: 'guard-break', draw: 'bow-draw', loose: 'bow-shot', arrow: 'arrow-hit', felled: 'felled', cycle: 'cycle', foeSwing: 'foe-swing', hurt: 'hurt' });
const WEAPON_KEYS = Object.freeze(['swing', 'heavy', 'hit', 'finisher']);
const fail = (m) => new Error(`gameworld: sound${m}`);

// the palette cue ids a mechanic plays (sfx-palettes.js MECHANIC_SFX) that the shelf's newest voices answer better
const ON_FRESH = Object.freeze({ door: 'latch' });

// a weapon by its words: what its swing and its blow are on the shelf
const WEAPONS = [
  { test: /\b(staff|bo|quarterstaff|pole|spear|naginata)\b/, swing: 'staff-swing', strike: 'blunt-hit', why: 'a staff' },
  { test: /\b(nunchaku|nunchuck|nunchuk|chain sticks)s?\b/, swing: 'nunchaku', strike: 'blunt-hit', why: 'nunchaku' },
  { test: /\b(katana|tachi|wakizashi|odachi)\b/, swing: 'katana-swing', heavy: 'katana-heavy-swing', strike: 'blade-hit', why: 'a katana' },
];
// a beast by its species: its voice
const BEASTS = [
  { test: /\b(dog|hound|puppy|pup)s?\b/, voice: 'dog-bark' },
  { test: /\b(house ?cat|kitten|cat)s?\b/, voice: 'cat-hiss' },
  { test: /\b(horse|pony|stallion|mare)s?\b/, voice: 'horse-neigh' },
  { test: /\b(crow)s?\b/, voice: 'crow' },
  { test: /\b(raven)s?\b/, voice: 'raven' },
  { test: /\b(eagle|hawk|falcon|raptor)s?\b/, voice: 'eagle' },
  { test: /\b(goose|geese)\b/, voice: 'goose' },
  { test: /\b(duck)s?\b/, voice: 'duck' },
  { test: /\b(rooster|cockerel)s?\b/, voice: 'rooster' },
  { test: /\b(chicken|hen)s?\b/, voice: 'chicken' },
  { test: /\b(snake|rattlesnake|serpent|viper)s?\b/, voice: 'rattle' },
  { test: /\b(bat)s?\b/, voice: 'bat-chatter' },
  { test: /\b(lion|tiger|panther|leopard|jaguar)s?\b/, voice: 'roar-lion' },
  { test: /\b(bear)s?\b/, voice: 'roar-bear' },
  { test: /\b(dragon|kaiju|monster|dinosaur|rex|titan|giant)s?\b/, voice: 'roar-monster' },
  { test: /\b(wolf|wolves|boar|beast|jackal|hyena)s?\b/, voice: 'snarl' },
];

const wordsOf = (W) => `${W.id ?? ''} ${W.name ?? ''} ${W.item ?? ''}`.toLowerCase();

/** The hero's swing and blow, from the first weapon it fights with (the world's arsenal, its feel's kit, or the basic). */
function strikeOf(G) {
  const A = arsenalOfGame(G)?.arsenal ?? BASIC_ARSENAL;
  const W = (A.weapons ?? [])[0];
  if (!W) return { swing: 'swing', strike: 'punch', why: 'no weapon: a fist' };
  const k = WEAPONS.find((x) => x.test.test(wordsOf(W)));
  if (k) return { swing: k.swing, strike: k.strike, why: `${k.why} (${W.name ?? W.id})` };
  if ((W.figure ?? 'drawn') === 'drawn') return { swing: 'blade-swing', strike: 'blade-hit', why: `a blade (${W.name ?? W.id})` };
  return { swing: 'swing', strike: 'punch', why: `a fist (${W.name ?? W.id})` };
}

/**
 * The moveset's sounds for a game with an arsenal, each a shelf word: { swing: { <weapon>: { light, heavy?, finisher? } },
 * hit: { <weapon>: { … } }, block, parry, … }, and why each weapon sounds as it does. Null with no arsenal.
 */
function movesOf(G, own) {
  const A = arsenalOfGame(G)?.arsenal;
  if (!A || !(A.weapons ?? []).length) return null;
  const T = MOVE_SOUND_WORDS, swing = {}, hit = {}, why = {};
  for (const W of A.weapons) {
    const k = WEAPONS.find((x) => x.test.test(wordsOf(W))), blade = (W.figure ?? 'drawn') === 'drawn', o = own.weapons?.[W.id] ?? {};
    const sw = k ? { light: k.swing, heavy: k.heavy ?? k.swing } : blade ? { light: T['blade-light'], heavy: T['blade-heavy'] } : { light: T['fist-swing'] };
    const ht = k ? { light: k.strike, heavy: k.strike } : blade ? { light: T['blade-hit'], heavy: T['blade-hit'] } : { light: T.punch, heavy: T.uppercut };
    // (the game's two slots, where it wrote them, are every weapon's light swing and blow; a weapon's own word over them)
    const light = o.swing ?? own.slots?.swing ?? sw.light, heavy = o.heavy ?? (o.swing || own.slots?.swing ? light : sw.heavy);
    const blow = o.hit ?? own.slots?.strike ?? ht.light;
    swing[W.id] = { light, ...(heavy ? { heavy, finisher: heavy } : {}) };
    hit[W.id] = { light: blow, heavy: o.hit ?? own.slots?.strike ?? ht.heavy, finisher: o.finisher ?? T['finisher-hit'] };
    why[`weapon:${W.id}`] = Object.keys(o).length ? 'the game says so' : k ? `${k.why} (${W.name ?? W.id})` : blade ? `a blade (${W.name ?? W.id})` : `a fist (${W.name ?? W.id})`;
  }
  const one = Object.fromEntries(Object.entries(MOVE_EVENTS).map(([ev, row]) => [ev, own.moves?.[ev] ?? T[row]]));
  return { moves: { swing, hit, ...one }, why };
}

// a stage kit's own words for its ground, before its shell: snow, sand, mud, dry leaves, gravel
const GROUNDS = [
  { test: /snow|ice|winter|tundra|frost/, step: 'step-snow' }, { test: /desert|sand|dune|beach/, step: 'step-sand' },
  { test: /swamp|bog|marsh|mire/, step: 'step-mud' }, { test: /autumn|fall-forest/, step: 'step-leaves' }, { test: /quarry|gravel|scree/, step: 'step-gravel' },
];
/** The ground the hero walks: what the stage kit's name says (snow, sand, mud, leaves, gravel), else grass on a stage
 *  grown on a nature or jungle kit, stone where it is built. */
function stepOf(manifest) {
  const named = manifest?.kit ? GROUNDS.find((x) => x.test.test(String(manifest.kit))) : null;
  if (named) return { step: named.step, why: `a ${manifest.kit} stage: ${SOUNDS[named.step].label}` };
  const shell = manifest?.kit ? stageKit(manifest.kit)?.shell : null;
  if (shell === 'nature' || shell === 'jungle') return { step: 'step-grass', why: `a ${shell} stage: grass underfoot` };
  return { step: 'step-concrete', why: manifest?.kit ? `a ${shell ?? manifest.kit} stage: stone underfoot` : 'stone underfoot' };
}

/** Each fielded beast's voice, by its skin's species. */
function foeVoices(G) {
  const out = {}, why = {};
  for (const [id, e] of Object.entries(isObj(G?.foes) ? G.foes : {})) {
    const sp = String(e?.skin?.species ?? e?.class ?? id).toLowerCase();
    const b = BEASTS.find((x) => x.test.test(sp));
    if (b) { out[id] = b.voice; why[`foe:${id}`] = `a ${sp}: ${SOUNDS[b.voice].label}`; }
  }
  return { foes: out, why };
}

/** A game's own `sound` (its style, its slots and cues by shelf word), checked; throws `gameworld: sound…`. */
export function readSound(S) {
  if (S === undefined) return {};
  if (!isObj(S)) throw fail(` is { style?, slots?, on?, weapons?, moves?, bed?, vary? } (got ${JSON.stringify(S)})`);
  if (S.bed !== undefined && S.bed !== false && !resolveBed(S.bed)) throw fail(`.bed '${S.bed}' is a bed (${Object.keys(BEDS).join(', ')}) or false`);
  if (S.vary !== undefined && typeof S.vary !== 'boolean') throw fail(`.vary is true or false (every hit a variant: a combo, a burst of fire, never one sound said twice)`);
  if (S.style !== undefined && !(S.style in STYLES)) throw fail(`.style '${S.style}' is one of ${Object.keys(STYLES).join(', ')}`);
  const word = (at, w) => { if (!resolveSoundId(w)) throw fail(`${at}: '${w}' is not a sound on the shelf; ${suggestSounds(w)}`); };
  for (const k of ['slots', 'on']) for (const [slot, w] of Object.entries(S[k] ?? {})) word(`.${k}.${slot}`, w);
  if (S.moves !== undefined) {
    if (!isObj(S.moves)) throw fail(`.moves is { ${Object.keys(MOVE_EVENTS).join('?, ')}? }, each a shelf word`);
    for (const [ev, w] of Object.entries(S.moves)) { if (!(ev in MOVE_EVENTS)) throw fail(`.moves.${ev} is not a moveset's event (${Object.keys(MOVE_EVENTS).join(', ')})`); word(`.moves.${ev}`, w); }
  }
  if (S.weapons !== undefined) {
    if (!isObj(S.weapons)) throw fail(`.weapons is { <weapon id>: { ${WEAPON_KEYS.join('?, ')}? } }, each a shelf word`);
    for (const [id, o] of Object.entries(S.weapons)) {
      if (!isObj(o)) throw fail(`.weapons.${id} is { ${WEAPON_KEYS.join('?, ')}? }, each a shelf word`);
      for (const [k, w] of Object.entries(o)) { if (!WEAPON_KEYS.includes(k)) throw fail(`.weapons.${id}.${k}: a weapon's sounds are ${WEAPON_KEYS.join(', ')}`); word(`.weapons.${id}.${k}`, w); }
    }
  }
  return S;
}

/** The game's sheet (see the header). */
export function soundSheet(G, { manifest = null } = {}) {
  const own = readSound(G?.sound);
  const style = own.style ?? 'mouth';
  const st = strikeOf(G), sp = stepOf(manifest), fv = foeVoices(G);
  const mv = movesOf(G, own);
  const slots = { step: sp.step, jump: 'jump', land: 'land', dodge: 'dodge', swing: st.swing, strike: st.strike, ...(own.slots ?? {}) };
  const on = { ...ON_FRESH, ...(Object.values(fv.foes).length ? { alarm: Object.values(fv.foes)[0] } : {}), ...(own.on ?? {}) };
  const why = { step: sp.why, swing: st.why, strike: st.why, door: 'a door opening: the latch (a new voice)', ...fv.why, ...(mv?.why ?? {}),
    ...(on.alarm && !own.on?.alarm ? { alarm: `spotted: the ${Object.keys(fv.foes)[0]}'s voice` } : {}) };
  for (const k of Object.keys(own.slots ?? {})) why[k] = 'the game says so';
  for (const k of Object.keys(own.on ?? {})) why[k] = 'the game says so';
  const id = (w) => resolveSoundId(w);
  const fresh = (w) => !!SOUNDS[id(w)]?.voices?.mouth;
  const owed = [];
  if (style === 'mouth') for (const [k, w] of Object.entries(slots)) if (!fresh(w)) owed.push(`${k}: '${id(w)}' has no new voice yet (it plays realistic)`);
  if (Object.keys(fv.foes).length) owed.push(`the foes' voices (${Object.entries(fv.foes).map(([f, w]) => `${f}: ${w}`).join(', ')}) play only when a foe is spotted: no event voices a foe's attack yet`);
  return { style, slots, on, ...(mv ? { moves: mv.moves } : {}), foes: fv.foes, why, owed };
}

// a stage's environment by its kit's words, its weather and its hour: the bed it lays under the score
const ENVIRONMENTS = [
  { test: /rain|storm|monsoon/, bed: 'rain' }, { test: /cave|cavern|crypt|dungeon|mine|grotto/, bed: 'cave' },
  { test: /swamp|bog|marsh|mire|bayou/, bed: 'swamp' }, { test: /farm|barn|ranch|pasture|meadow/, bed: 'farm' },
  { test: /night|moon|midnight/, bed: 'night' }, { test: /forest|wood|grove|jungle|glade/, bed: 'forest' },
];
/**
 * A level's bed (sfx-shelf/beds.js), or null: the game's own (`sound.bed`, a bed or false), else what its stage says
 * (its kit's name, its weather, its hour: rain over a forest, night over a meadow), else a nature or jungle stage's
 * forest. A built stage lays none.
 */
export function sheetBed(G, { manifest = null } = {}) {
  const own = G?.sound?.bed;
  if (own === false) return null;
  if (own !== undefined) return resolveBed(own);
  const words = [manifest?.weather, manifest?.time, manifest?.kit].filter(Boolean).map(String).join(' ');
  const hit = words ? ENVIRONMENTS.find((x) => x.test.test(words)) : null;
  if (hit) return hit.bed;
  const shell = manifest?.kit ? stageKit(manifest.kit)?.shell : null;
  return shell === 'nature' || shell === 'jungle' ? 'forest' : null;
}

/**
 * Whether a game's hits vary (each a seeded variant: a sword combo, a burst of gunfire, a beam's shots never one sound
 * said twice): what its `sound.vary` says, else on for a game on the sound sheet (`sfx: 'sheet'`, or a `sound` of its
 * own), off for a game made before it, so that one sounds as it did. The rooms and the firing range read it.
 */
export function variesHits(G) {
  if (G?.sound?.vary !== undefined) return G.sound.vary;
  return G?.sound !== undefined || G?.quick?.sfx === 'sheet';
}

/** The level's audio word for the sheet (beats-world.js resolves `sfx: { sheet }`): what the shelf plays each slot and cue by. */
export function sheetAudio(G, opts = {}) {
  const S = soundSheet(G, opts);
  return { sheet: { style: S.style, slots: S.slots, on: S.on, ...(S.moves ? { moves: S.moves } : {}) } };
}

/**
 * Whether a game is on the sheet: it writes a `sound` of its own, or its quick game asks (`sfx: 'sheet'`). A quick
 * game that names another `sfx` (a palette, 'auto') keeps that: what it says of its levels wins over the default.
 */
export function onSheet(G, quick = G?.quick) {
  if (quick?.sfx !== undefined) return quick.sfx === 'sheet';
  return G?.sound !== undefined;
}

/**
 * The audio a level of the game is built with (levels.js levelOrder's `audio`), or null where the game is on no sheet
 * (the level then carries what it carried). The stage's own audio is kept under it: the sheet adds the sounds and the
 * bed, and replaces neither a soundtrack nor an `sfx` the stage wrote itself.
 */
export function levelSheet(G, { manifest = null, quick = G?.quick } = {}) {
  if (!onSheet(G, quick)) return null;
  const own = isObj(manifest?.audio) ? manifest.audio : {};
  const bed = own.bed === undefined ? sheetBed(G, { manifest }) : null;
  return { ...own, ...(own.sfx === undefined ? { sfx: sheetAudio(G, { manifest }) } : {}), ...(bed ? { bed } : {}) };
}
