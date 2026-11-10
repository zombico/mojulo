/**
 * HOLDER — who holds a slice of a power system, and what of it can be theirs alone. The third table of the lorecube's
 * JOIN. A lore gives powers to sides ("four factions, each an element"; "the light and the dark"); the runtime has four
 * kinds of thing a slice can be held by (the hero, a party class, a foe, a faction), and each can own some of the ways
 * a slice shows and plays, shares others with the whole game, and cannot have the rest at all. This says which, so a
 * lore that asks two sides to differ by something the game has one of is told before anything is built.
 *
 *   HOLDER_KINDS   the four, each what it is and the key that names one
 *   DIALS          the ways a holder's slice shows or plays: its element, its powers, its kit of moves, its timing, its
 *                  look, its big moments, its interface, its reserve, its weakness, its body, its dress, its mind
 *   HOLDS          { <kind>: { <dial>: { scope, by?, says } } }, scope one of
 *                    own    this holder's alone: two holders of the kind can differ by it
 *                    part   its own in one runtime only (said which): the action game or the party RPG
 *                    world  one a game: every holder gets the same
 *                    none   nothing gives it to this kind of holder
 *                  `by` the key that sets it. A new kind is a row; a dial a holder learns is a word in its row
 *
 * MADE IN PASSES (passes.js), a holder's ladder three rungs:
 *   premise     who: an id and a kind. A raw-new pass's, and where it stops
 *   slice       what it holds: an element of the system's polarity, a reserve by name, or both
 *   expression  what it differs by from the other holders: a list of dials
 *
 *   newHolder({ id, kind, name? })                a RAW-NEW pass: the premise alone
 *   intensifyHolder(H, { slice?, differs? }) → { holder, open }   an INTENSIFICATION, rungs in order
 *   readHolder(v)                                 a stored holder at any depth: read, or throws, teaching
 *   HOLDER                                        the part (passes.js)
 *   holdersReport(holders, { polarity?, reserves? }) → { holders: [{ id, kind, element?, stands?: { <other id>: relation },
 *         differs: [{ dial, scope, says }], reserve?: { name, carried, says? } }], laws: [{ law, ok, value }] }
 *       the holders read together: how each stands to each other in the polarity, whether each difference asked for
 *       can be the holder's own, whether its reserve has a gauge of its scope. Laws: distinct (no two hold one
 *       element), in-polarity, every-difference-own, weakness-lands (a holder with an opposite can take the weakness),
 *       reserve-carried. Advice, as every law here
 *
 * Pure and deterministic. Nothing reads this yet: it lays no byte on any page.
 */
import { definePart } from './passes.js';
import { rootOf, resolvePolarity, relation } from './polarity.js';
import { readReserve, carriersOf, CARRIERS } from './reserve.js';

const fail = (m) => new Error(`lorecube: holder${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const HOLDER_KINDS = Object.freeze({
  hero: { reads: 'the one the player plays', key: 'characters.hero' },
  class: { reads: 'a party class: each member of it', key: 'play.rpg classes' },
  foe: { reads: 'a foe of the bestiary, or a role of the cast', key: 'foes.<id>' },
  faction: { reads: 'a civilization of the world', key: 'civilizations.<id>' },
});
export const HOLDER_KIND_IDS = Object.freeze(Object.keys(HOLDER_KINDS));

export const DIALS = Object.freeze({
  element: 'the element it is of',
  powers: 'the set of powers it has',
  kit: 'its kit of moves: strings, launchers, weapons',
  timing: 'how its motion and its blows are timed',
  look: 'how its effects are drawn',
  moments: 'its big moments: the slow, the freeze, the camera taken',
  ui: 'the look of its menus and its HUD',
  reserve: 'the reserve its powers draw on',
  weakness: 'what it is weak to and resists',
  body: 'the kind of body it has',
  dress: 'what it wears and how its things are made',
  mind: 'how it decides',
});
export const DIAL_IDS = Object.freeze(Object.keys(DIALS));
export const SCOPES = Object.freeze(['own', 'part', 'world', 'none']);

const own = (by, says) => ({ scope: 'own', by, says });
const part = (by, says) => ({ scope: 'part', by, says });
const world = (by, says) => ({ scope: 'world', by, says });
const none = (says) => ({ scope: 'none', says });
const NO_LINK = 'nothing joins a civilization to it: a faction is how its things look, never how it plays';

/** What each kind of holder can own of each dial, as the runtime stands. */
export const HOLDS = Object.freeze({
  hero: {
    element: own('characters.hero.actions.powers[].element', 'each of its powers names one; it shapes that power\'s vayo move'),
    powers: own('characters.hero.actions', 'the actions page: nine at most, the only holder the mechanics number'),
    kit: world('arsenal', 'one arsenal a game, laid on every body the player plays'),
    timing: world('feel', 'one feel card a game'),
    look: world('juice', 'one register a game; only the swing\'s trail takes the first power\'s element'),
    moments: world('tempo', 'one set of moments a game'),
    ui: world('ui', 'one look a game'),
    reserve: own('characters.hero.actions.system, feel', 'the hero\'s own gauges (the vayo meter, its stamina, its resource); the arsenal\'s MP is the game\'s'),
    weakness: none('the action runtime has no element meeting an element: a blow is a blow'),
    body: own('characters.direction.body', 'the body rail\'s hero'),
    dress: own('characters.hero', 'the hero door'),
    mind: none('the player decides'),
  },
  class: {
    element: own('play.rpg skills.<id>.element', 'each of its skills names one'),
    powers: own('play.rpg classes.<id>.skills', 'its skills, by rank and bought on its tree'),
    kit: none('a party fights in turns: skills, no moveset'),
    timing: none('a turn has no timing of its own'),
    look: own('play.rpg skills.<id>.juice', 'a skill\'s own juice, over the fight\'s bindings'),
    moments: none('the world clock is the action runtime\'s'),
    ui: world('ui', 'the party\'s screens wear the game\'s one look'),
    reserve: own('play.rpg classes.<id> mp', 'each member its own MP, by its class'),
    weakness: none('weak and resist are a foe\'s words; a party member has none'),
    body: own('the party\'s cast', 'its member\'s figure'),
    dress: own('the party\'s cast, play.rpg gear', 'its member\'s figure and gear'),
    mind: none('the player decides'),
  },
  foe: {
    element: part('play.rpg skills.<id>.element; foes.<id>.states', 'in a party RPG, its skills\' elements; in an action game only a state it is in (flaming)'),
    powers: own('foes.<id>.class', 'its class\'s attack; in a party RPG its skills too'),
    kit: world('arsenal', 'only the arsenal\'s juggle rules reach a foe'),
    timing: own('foes.<id>.class', 'its class\'s attack: its pattern and its timing'),
    look: own('foes.<id>.skin', 'its skin, and the ooze it is grown by'),
    moments: world('tempo', 'one set of moments a game'),
    ui: none('a foe has no screens'),
    reserve: part('play.rpg foes.<id>.mp', 'in a party RPG its own MP; an action foe has none'),
    weakness: part('play.rpg foes.<id> weak, resist, absorb, immune', 'in a party RPG its own lists; an action foe has none'),
    body: own('foes.<id>.class', 'the body its class fits, the body rail\'s henchman'),
    dress: own('foes.<id>.skin', 'its skin and its dress'),
    mind: own('foes.<id> class, rank, skill', 'its class\'s mind, at its rank and skill'),
  },
  faction: {
    element: own('civilizations.<id>.technology', 'its technology\'s direction names its elements: a look, not a power'),
    powers: none(NO_LINK), kit: none(NO_LINK), timing: none(NO_LINK), look: none(NO_LINK), moments: none(NO_LINK), ui: none(NO_LINK),
    reserve: none(NO_LINK), weakness: none(NO_LINK), body: none(NO_LINK),
    dress: own('civilizations.<id>.technology', 'its finish, its motif, its team colour: what it builds and fields'),
    mind: none(NO_LINK),
  },
});

/** The gauge scopes that are a kind of holder's own (reserve.js CARRIERS `scope`). */
const GAUGE_SCOPES = Object.freeze({ hero: ['hero', 'world'], class: ['member'], foe: [], faction: [] });

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const KEYS = ['id', 'kind', 'name', 'slice', 'differs'];

/** A stored holder at any depth. */
export function readHolder(v) {
  if (!isObj(v)) throw fail(' is { id, kind, name?, slice?, differs? }');
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a holder (${KEYS.join(', ')})`);
  if (typeof v.id !== 'string' || !ID.test(v.id)) throw fail('.id is a short lower-case word (letters, digits, hyphens)');
  if (!HOLDER_KINDS[v.kind]) throw fail(`.kind is who can hold a slice: ${HOLDER_KIND_IDS.join(', ')}`);
  const out = { id: v.id, kind: v.kind };
  if (v.name !== undefined) { if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 60) throw fail('.name is what the lore calls it'); out.name = v.name.trim(); }
  if (v.slice !== undefined) {
    const S = v.slice;
    if (!isObj(S) || !Object.keys(S).length) throw fail('.slice is what it holds: { element?, reserve? }, one at least');
    for (const k of Object.keys(S)) if (!['element', 'reserve'].includes(k)) throw fail(`.slice.${k} is not part of a slice (element, reserve)`);
    out.slice = {};
    if (S.element !== undefined) {
      const root = rootOf(S.element);
      if (!root) throw fail(`.slice.element '${S.element}' is no element the character book knows`);
      out.slice.element = root;
    }
    if (S.reserve !== undefined) { if (typeof S.reserve !== 'string' || !S.reserve.trim()) throw fail('.slice.reserve is a reserve\'s name'); out.slice.reserve = S.reserve.trim(); }
  }
  if (v.differs !== undefined) {
    if (!Array.isArray(v.differs) || !v.differs.length) throw fail(`.differs is the dials it differs by: ${DIAL_IDS.join(', ')}`);
    for (const d of v.differs) if (!DIALS[d]) throw fail(`.differs '${d}' is not a dial (${DIAL_IDS.join(', ')})`);
    if (new Set(v.differs).size !== v.differs.length) throw fail('.differs says one twice');
    out.differs = [...v.differs];
  }
  return out;
}

const premiseOf = (v) => (isObj(v) ? { id: v.id, kind: v.kind, ...(v.name !== undefined ? { name: v.name } : {}) } : null);
const reads = (v) => { try { return readHolder(v); } catch { return null; } };

export const HOLDER = definePart({
  id: 'holder',
  rungs: [
    { id: 'premise', rawNew: true, holds: (v) => !!premiseOf(v) && !!reads(premiseOf(v)), view: premiseOf },
    { id: 'slice', holds: (v) => isObj(v.slice) && !!reads(v), open: () => ['slice'], view: (v) => v.slice },
    { id: 'expression', holds: (v) => Array.isArray(v.differs) && !!reads(v), open: () => ['differs'], view: (v) => v.differs },
  ],
});

/** A raw-new pass: who, and nothing of what they hold. */
export function newHolder(v) {
  if (!isObj(v)) throw fail(' is made from { id, kind, name? }');
  const more = Object.keys(v).filter((k) => ['slice', 'differs'].includes(k));
  if (more.length) throw fail(`.${more[0]} is not a raw-new pass's: it says who holds (id, kind) and stops; ${more.join(', ')} ${more.length === 1 ? 'is' : 'are'} the next passes' (intensifyHolder)`);
  return readHolder(v);
}

/** An intensification: what it holds, then what it differs by; what was there is never touched. */
export function intensifyHolder(H, add = {}) {
  const base = readHolder(H);
  if (!isObj(add)) throw fail(' is intensified with { slice?, differs? }');
  for (const k of Object.keys(add)) {
    if (['id', 'kind', 'name'].includes(k)) throw fail(`.${k} is its premise: an intensification adds under it and never changes it`);
    if (!KEYS.includes(k)) throw fail(`.${k} is not part of a holder (${KEYS.join(', ')})`);
    if (base[k] !== undefined) throw fail(`.${k} is already said: an intensification adds the rungs that are missing and changes none`);
  }
  const holder = readHolder({ ...base, ...add });
  if (holder.differs && !holder.slice) throw fail(': its expression is said before its slice: what it holds comes before how it differs');
  return { holder, open: !holder.slice ? ['slice'] : !holder.differs ? ['differs'] : [] };
}

/** The holders read together, against the system's polarity and reserves. */
export function holdersReport(list, { polarity, reserves } = {}) {
  if (!Array.isArray(list) || !list.length) throw fail('s are a list of holders');
  const Hs = list.map(readHolder);
  const ids = Hs.map((h) => h.id);
  if (new Set(ids).size !== ids.length) throw fail(`s: two share an id (${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')})`);
  const P = polarity ? (polarity.elements && polarity.beats ? polarity : resolvePolarity(polarity)) : null;
  const Rs = Object.fromEntries((reserves ?? []).map((r) => { const R = readReserve(r); return [R.name, R]; }));

  const holders = Hs.map((h) => {
    const el = h.slice?.element;
    const stands = P && el && P.elements.includes(el)
      ? Object.fromEntries(Hs.filter((o) => o.id !== h.id && o.slice?.element && P.elements.includes(o.slice.element)).map((o) => [o.id, relation(P, el, o.slice.element)]))
      : null;
    const differs = (h.differs ?? []).map((dial) => ({ dial, scope: HOLDS[h.kind][dial].scope, says: HOLDS[h.kind][dial].says }));
    let reserve = null;
    if (h.slice?.reserve) {
      const R = Rs[h.slice.reserve];
      if (!R) reserve = { name: h.slice.reserve, carried: false, says: 'no reserve of that name was given' };
      else {
        const mine = carriersOf(R).carriers.filter((c) => GAUGE_SCOPES[h.kind].includes(CARRIERS[c.id].scope));
        reserve = mine.length ? { name: R.name, carried: true, gauges: mine.map((c) => c.id) } : { name: R.name, carried: false, says: `no gauge that carries it is a ${h.kind}'s own` };
      }
    }
    return { id: h.id, kind: h.kind, ...(h.name ? { name: h.name } : {}), ...(el ? { element: el } : {}), ...(stands ? { stands } : {}), differs, ...(reserve ? { reserve } : {}) };
  });

  const held = Hs.filter((h) => h.slice?.element).map((h) => h.slice.element);
  const twice = [...new Set(held.filter((e, i) => held.indexOf(e) !== i))];
  const outside = P ? Hs.filter((h) => h.slice?.element && !P.elements.includes(h.slice.element)).map((h) => `${h.id} (${h.slice.element})`) : [];
  const shared = holders.flatMap((h) => h.differs.filter((d) => d.scope === 'world' || d.scope === 'none').map((d) => `${h.id}.${d.dial}`));
  // a holder that stands against another needs somewhere for the weakness to land
  const against = holders.filter((h) => h.stands && Object.values(h.stands).some((r) => r === 'yields' || r === 'opposes'));
  const nowhere = against.filter((h) => HOLDS[h.kind].weakness.scope === 'none').map((h) => h.id);
  const uncarried = holders.filter((h) => h.reserve && !h.reserve.carried).map((h) => h.id);
  const laws = [
    { law: 'distinct', ok: twice.length === 0, value: twice.join(', ') || 'each its own' },
    ...(P ? [{ law: 'in-polarity', ok: outside.length === 0, value: outside.join(', ') || 'all' }] : []),
    { law: 'every-difference-own', ok: shared.length === 0, value: shared.join(', ') || 'all' },
    ...(P ? [{ law: 'weakness-lands', ok: nowhere.length === 0, value: nowhere.join(', ') || (against.length ? 'all' : 'none stands against another') }] : []),
    ...(holders.some((h) => h.reserve) ? [{ law: 'reserve-carried', ok: uncarried.length === 0, value: uncarried.join(', ') || 'all' }] : []),
  ];
  return { holders, laws };
}
