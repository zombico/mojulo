/**
 * THE CASTLE'S BOSSES (docs/metroidvania-map.md "Bosses"): each a foe class at the boss's rank on a skin (the foe shelf's
 * own: foes.js standFoe, as the side map stands its roster, side-map/boss-cast.js), its idea in a line, and its TIER (how
 * much taller than the hero it stands). A box's boss is named in its words (a ring's `boss`); the shelf is read by that
 * name (a boss it does not know stands as a warden). Stood in its boss room on the room's own stretch of the lane, facing
 * the way in, it is a body of the world: struck, it staggers and falls as a foe does, and its fall gives what its room
 * gives (held-gates.js, its `entity`): its seal broken, its power. Until its figure is made it stands as a block (STAND_IN).
 *
 *   CASTLE_BOSSES        { <id>: { class, skin, tier, blows, reads } }   a new boss is a row; `blows` its health in the
 *                        hero's blows (foes/vocab.js HERO.blow), rising as the castle goes in
 *   bossRow(name)        → { id, known, ...row }   the row a boss's name reads as (lower-cased, `the` off, hyphened)
 *   BOSS_DEFAULT         the row a boss the shelf does not know stands as
 *   standBosses(G, B, { stature }) → { figures, entities }   each of the box's bosses (scene.js boxOf `bosses`, laid
 *                        `bosses: 'stood'`) stood by the foe shelf where its room says, at its tier's height, its health its
 *                        blows, on its room's own stretch of the lane (it never follows her out of its room), its bar the
 *                        castle's (held-gates-view.js), never one over its head
 *   BOSS_LAWS, bossLaws(B) → [{ id, holds, says }]   known (each boss a row of the shelf, not the default it falls back
 *                        to), room-to-fight (each boss's stretch of the lane at least FIGHT_ROOM metres: room to back off and
 *                        come in), rising (no boss along the walk under EASE of the hardest before it: the castle never
 *                        eases going in)
 *   FIGHT_ROOM, BOSS_EASE
 *
 * Pure.
 */
import { standFoe } from '../foes.js';
import { sideFoe } from '../side-map/cast.js';
import { HERO } from '../../foes/vocab.js';
export const CASTLE_BOSSES = Object.freeze({
  'gate-warden': Object.freeze({ class: 'guard', skin: Object.freeze({ people: 'undead' }), tier: 1.5, blows: 14, reads: 'a dead halberdier in black plate, holding the wall\'s gate: it stands and cuts at what comes in reach' }),
  gatekeeper: Object.freeze({ class: 'guard', skin: Object.freeze({ people: 'infernal' }), tier: 1.6, blows: 24, reads: 'a horned keeper of the keep\'s portcullis, its blade as long as the gate is wide' }),
  'bell-ringer': Object.freeze({ class: 'lobber', skin: Object.freeze({ people: 'undead' }), tier: 1.4, blows: 16, reads: 'the tower\'s dead ringer, hurling the bell-ropes\' weights in arcs' }),
  bellkeeper: Object.freeze({ class: 'lobber', skin: Object.freeze({ people: 'undead' }), tier: 1.5, blows: 18, reads: 'the ward\'s bell-keeper, throwing its cracked bells' }),
  'great-bell': Object.freeze({ class: 'turret', skin: Object.freeze({ people: 'undead' }), tier: 1.8, blows: 22, reads: 'the great bell, swung by its dead and tolling: each toll a round that crosses the spire' }),
  warden: Object.freeze({ class: 'stalker', skin: Object.freeze({ people: 'infernal' }), tier: 1.5, blows: 22, reads: 'the chapel\'s warden, a devil in a monk\'s cowl: quick, and it cuts as it comes' }),
  'crypt-lord': Object.freeze({ class: 'lurker', skin: Object.freeze({ species: 'wolf' }), tier: 1.8, blows: 26, reads: 'a great wolf of the crypt: it waits in the dark and springs' }),
  'lord-of-the-keep': Object.freeze({ class: 'pursuer', skin: Object.freeze({ people: 'infernal' }), tier: 1.6, blows: 34, reads: 'the vampire lord himself: he follows her across his throne room and strikes' }),
});
export const BOSS_DEFAULT = 'gate-warden';

/** The row a boss's name reads as. */
export function bossRow(name) {
  const id = String(name ?? '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { id: CASTLE_BOSSES[id] ? id : BOSS_DEFAULT, known: !!CASTLE_BOSSES[id], ...CASTLE_BOSSES[CASTLE_BOSSES[id] ? id : BOSS_DEFAULT] };
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/** The box's bosses stood in their rooms. */
export function standBosses(G, B, { stature = HERO.height } = {}) {
  const part = { figures: {}, entities: [] };
  for (const b of B.bosses ?? []) {
    const P = b.place, row = bossRow(b.name);
    const e0 = standFoe(G, part, { id: b.id, entry: { class: row.class, rank: 'boss', skin: row.skin }, at: P.at, heading: P.heading });
    part.entities.pop();
    // (its size the tier's: as tall as the hero times its tier, its collider and its hit egg with it; its rounds the side
    // map's, travelling, seen crossing the room and jumped)
    const H = r3(stature * row.tier), R = r3(0.3 * row.tier), e = sideFoe({ ...e0, rule: { ...e0.rule, collideHeight: H, collideRadius: R } }, stature);
    const { scale: _s, fit: _f, ...body } = e.body;
    part.entities.push({
      ...e,
      body: { ...body, hp: row.blows * HERO.blow, hpBar: 'none', radius: R, egg: { a: r3(0.42 * row.tier), c: r3(H / 2), cz: r3(H / 2) } },
      // (on its room's own stretch of the lane, between its walls and short of its doorways)
      rule: { ...e.rule, collideHeight: H, collideRadius: R, rail: { a: [0, P.span[0]], b: [0, P.span[1]], join: P.at, heading: P.heading } },
    });
  }
  return part;
}

export const BOSS_LAWS = Object.freeze(['known', 'room-to-fight', 'rising']);
/** a boss's stretch of the lane at least this long, and none along the walk under this share of the hardest before it */
export const FIGHT_ROOM = 8, BOSS_EASE = 0.8;

/** The bosses' laws, measured on the box's bosses where they stand. */
export function bossLaws(B) {
  const out = [], law = (id, holds, says) => out.push({ id, holds: !!holds, says });
  const walkAt = new Map(B.layout.walk.map((id, k) => [id, k]));
  const Bs = [...(B.bosses ?? [])].sort((a, b) => walkAt.get(a.place.room) - walkAt.get(b.place.room));
  const unknown = Bs.filter((b) => !bossRow(b.name).known).map((b) => b.name);
  law('known', !unknown.length, unknown.length ? `not on the shelf, stood as the ${BOSS_DEFAULT}: ${unknown.join(', ')}` : `every boss a row of the shelf (${Bs.length})`);
  const tight = Bs.filter((b) => b.place.span[1] - b.place.span[0] < FIGHT_ROOM - 1e-9).map((b) => b.name);
  law('room-to-fight', !tight.length, tight.length ? `too little room to fight: ${tight.join(', ')}` : `every boss on ${FIGHT_ROOM} m of lane and more`);
  let most = 0;
  const eases = [];
  for (const b of Bs) { const n = bossRow(b.name).blows; if (n < most * BOSS_EASE - 1e-9) eases.push(b.name); most = Math.max(most, n); }
  law('rising', !eases.length, eases.length ? `the bosses ease going in at ${eases.join(', ')}` : `each boss along the walk as hard as ${BOSS_EASE} of the hardest before it, or harder`);
  return BOSS_LAWS.map((id) => out.find((l) => l.id === id));
}
