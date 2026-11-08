/**
 * THE FOLK ON A STAGE: a gameworld town's people (folk/) standing in the level its street is laid on, each one the
 * player can walk up to and talk to. A world asks for them with `characters.folk` (folk/folk.js readFolk); a stage
 * whose manifest lays no town has none, and a world that asks for none is untouched.
 *
 *   stageFolk(G, stage)            → { town, kit, setting, folk, bodies, houseOf } or null
 *     the stage's town: the street's own lots (era/stage-buildings.js streetLots), its people grown from them in the
 *     game's setting on the stage's kit (cast-setting.js settingOfGame), their bodies by tier (folk/bodies.js)
 *   folkMintKey(plan, mint)        the run's step key for a body: the town and the mint, so a town met on two stages
 *                                  (the same kit, recipe and seed) is minted once and is the same people; one met in
 *                                  every town (folk.js RECURRING), by their look, so towns that dress them alike share it
 *   placeSidequests(plans)         each of `folk.sidequests` to the first stage whose town holds it (→ the ids none holds)
 *   folkExtra(plan, refOf, { shops? }) → (ends) → a stage extra (stage-figures.js): figures, entities, their talk and the
 *                                  stage's sidequests (folk/sidequests.js: the journal's quests, their menus, the cues);
 *                                  `shops`: { merchant?, inn?: { id, prompt } } the world's shops kept by the town's own
 *                                  (its shopkeeper the merchant; the inn a second shopkeeper, else the first house's head)
 *
 * WHERE THEY STAND. By their house (`town-<use>-<n>`, the stage's `townDoors`): a service's first person inside at
 * its room when the house is walked into (the elder on the dais, the master at the work floor), else beside the door;
 * the rest of the house in a row along the frontage beside it, clear of the way in, facing out. A house the street
 * had no frontage for stands no one. With `folk.day`, the households, the children and the watch keep a day from
 * there on the level's clock (folk/routines.js), which the level then has; everyone else keeps their place.
 *
 * WHAT THEY SAY. A talk menu each (playscape/ui/menus.js), opened by using them (a `use` cue, the interact key): the
 * line book's chitchat and service talk (folk/lines.js), or the operator's `folk.say`. Never the plot.
 *
 * Pure.
 */
import { streetLots } from '../era/stage-buildings.js';
import { withGeocube } from '../era/geocube.js';
import { folkOfTown, lotKey } from '../folk/folk.js';
import { folkBodies } from '../folk/bodies.js';
import { linesFor, speakerOf } from '../folk/lines.js';
import { sidequestsOn, lowerSidequests, dispatchCues, whoOf } from '../folk/sidequests.js';
import { settingOfGame } from './cast-setting.js';
import { libraryFigure, stand, standRule } from './stage-figures.js';
import { folkDay } from '../folk/routines.js';
import { mulberry32 } from '../vegetation/grow.js';
import { fingerprint } from './review.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// beside the door (m): out from the wall, along the frontage, and the step between neighbours
const OUT = 1.4, ASIDE = 1.6, STEP = 1.1;
// how far past its room's middle a person kept inside stands (m): behind a counter at the middle
const BEHIND = 1.1;
// how near the player stands to talk (m)
const REACH = 1.6;
// a walker's pace (m/s): a stroll, the farmhands' own
const STROLL = 1.4;
// POTTERING (a town's people are never statues): each one not looked for steps out from its place to a spot on the
// street before its door and back, lingering at each a while. Out from the wall and along it (m), the pace (m/s), how
// long a turn takes at most and at least (s: the heartbeat that sends them, on each one's own die)
const POTTER = Object.freeze({ out: [1.2, 2.6], along: [0.6, 2], speed: 0.85, every: [7, 14] });

export function stageFolk(G, stage) {
  const ask = G?.characters?.folk, town = stage?.manifest?.town;
  if (!ask || !town) return null;
  // (the kit the street is drawn in: the stage's own, or on a stage a geocube paints the cube's look, as the stage's
  // builder lowers it (era/stage.js assembleStageScene): the same lots, so the folk stand by the houses drawn)
  const kit = stage.manifest.kit ?? (stage.manifest.geocube !== undefined ? withGeocube(stage.manifest).kit : undefined);
  const street = streetLots(town, kit, stage.manifest.seed);
  const lots = street.lots.map(({ l }) => l), houseOf = {};
  street.lots.forEach(({ l }, n) => { houseOf[lotKey(l)] = `town-${l.use}-${n + 1}`; });
  const setting = settingOfGame({ ...G, style: { ...(G.style ?? {}), kit } });
  const folk = folkOfTown({ seed: street.seed, heartbeat: street.town.heartbeat, lots }, { setting, folk: ask, gameSeed: Number.isInteger(G.seed) ? G.seed : 1 });
  const bodies = folkBodies(folk, { kit, setting, pool: ask.pool });
  return { town: fingerprint({ kit, town, seed: stage.manifest.seed ?? null }), kit, setting, folk, bodies, houseOf, ...(ask.say ? { say: ask.say } : {}), ...(ask.sidequests ? { sidequests0: ask.sidequests } : {}), ...(ask.day ? { day: ask.day } : {}), ...(ask.life === false ? { still: true } : {}) };
}

// (one met in every town is keyed by their look: towns that dress them alike mint them once)
export const folkMintKey = (plan, mint) => (mint.recurring ? `folk-${mint.recurring}-${fingerprint({ spec: mint.spec, toon: mint.toon ?? null })}` : `folk-${plan.town}-${mint.key}`);

/** The room of a house walked into where a person is kept: its id, or its id numbered past the first. */
const roomOf = (door, room) => (room && door.rooms ? door.rooms.find((r) => r.id === room || r.id.startsWith(`${room}-`)) ?? null : null);

/** Each sidequest to the first stage whose town holds it (folk/sidequests.js sidequestsOn): its people and its houses
 * there, and what it is after. Sets `plan.sidequests` on each plan (null for none); a sidequest no town holds is
 * nowhere, and the list of those is returned. */
export function placeSidequests(plans) {
  const all = plans.find((P) => P?.sidequests0)?.sidequests0 ?? [];
  let left = all;
  for (const P of plans) {
    if (!P) continue;
    const here = sidequestsOn(left, P.folk, new Set(Object.values(P.houseOf)));
    P.sidequests = here.length ? here : null;
    left = left.filter((q) => !here.includes(q));
  }
  return left.map((q) => q.id);
}

export function folkExtra(plan, refOf, { shops = null } = {}) {
  // (the town's keepers a world's shops are kept by, battles.js hubCast: its shopkeeper the merchant, the inn a second
  // shop's keeper, else the head of the first house, letting a bed)
  const heads = plan.folk.people.filter((p) => !p.parent), useOf = (p) => /^town-([a-z]+)-/.exec(plan.houseOf[p.lot] ?? '')?.[1];
  const sellers = heads.filter((p) => p.service === 'merchant');
  const keeps = !shops ? new Map() : new Map([
    ...(shops.merchant && sellers[0] ? [[sellers[0].path, shops.merchant]] : []),
    ...(shops.inn ? (() => { const w = sellers[1] ?? heads.find((p) => useOf(p) === 'dwelling'); return w ? [[w.path, shops.inn]] : []; })() : []),
  ]);
  return (ends) => {
    const doors = new Map((ends.townDoors ?? []).map((d) => [d.id, d]));
    const part = { figures: {}, entities: [] }, menus = [], cues = [];
    const z = (x, y, z0) => { const g = ends.ground?.(x, y); return r3(Number.isFinite(g) ? g : z0); };
    const bodyOf = new Map(plan.bodies.people.map((p) => [p.path, p.body])), idleOf = new Map(plan.bodies.people.map((p) => [p.path, p.idle]));
    // each house's people in turn along its frontage
    const placed = new Map(), stood = new Map();
    for (const p of plan.folk.people) {
      const door = doors.get(plan.houseOf[p.lot]);
      if (!door) continue;
      const id = `folk-${fingerprint(p.path)}`, [nx, ny] = door.N, tx = -ny, ty = nx;
      const room = !p.parent && p.service ? roomOf(door, p.room) : null;
      let at, heading;
      if (room) {
        // inside at its room: past the middle of its floor away from the way in (behind its counter, where the room has
        // one at its middle: the town's stock, era/stocking.js), facing the way in
        const mx = (room.box.min[0] + room.box.max[0]) / 2, my = (room.box.min[1] + room.box.max[1]) / 2, dx = mx - door.at[0], dy = my - door.at[1], dl = Math.hypot(dx, dy) || 1;
        const back = Math.min(BEHIND, Math.max(0, Math.min(room.box.max[0] - room.box.min[0], room.box.max[1] - room.box.min[1]) / 2 - 0.6));
        const cx = mx + (dx / dl) * back, cy = my + (dy / dl) * back;
        at = [r3(cx), r3(cy), r3(room.box.min[2])];
        heading = r3(Math.atan2(door.at[1] - cy, door.at[0] - cx));
      } else {
        // beside the door, then each next one a step further along the frontage, alternating sides
        const k = placed.get(door.id) ?? 0;
        placed.set(door.id, k + 1);
        const side = k % 2 ? -1 : 1, along = side * (ASIDE + STEP * Math.floor(k / 2));
        const x = door.at[0] + nx * OUT + tx * along, y = door.at[1] + ny * OUT + ty * along;
        at = [r3(x), r3(y), z(x, y, door.at[2])];
        heading = r3(Math.atan2(ny, nx));
      }
      // (as they stand: their own stand held, the shared idle, or crouched at their work; folk/garb.js)
      const idle = idleOf.get(p.path), fig = libraryFigure(refOf(bodyOf.get(p.path)), { moves: idle === 'own' ? { idle: 'gesture' } : null });
      if (idle === 'crouch') fig.clips = { ...fig.clips, idle: 'Crouch_Idle_Loop' };
      stand(part, id, fig, at, heading);
      stood.set(p.path, { id, at, heading, house: door.id });
    }
    if (!part.entities.length) return null;
    // the sidequests this stage holds whose people all stand (a house the street had no frontage for stands no one)
    const quests = (plan.sidequests ?? []).filter((q) => [q.giver, ...q.steps.filter((s) => s.talk).map((s) => s.talk)].every((w) => stood.has(whoOf(plan.folk, w)?.path)) && q.steps.every((s) => !s.reach || doors.has(s.reach)));
    const SQ = quests.length ? lowerSidequests(quests, plan.folk, { idOf: (path) => stood.get(path).id, houseAt: (h) => doors.get(h).at.slice(0, 2), speakerOf }) : null;
    // THE DAY (folk.day): who keeps one walks it on the level's clock; the people the player comes looking for keep
    // their place (a service's first, one met in every town, anyone in a sidequest)
    const inQuest = new Set(Object.keys(SQ?.talks ?? {}));
    const D = plan.day ? folkDay(plan.folk, { stood, doors, keep: new Set(plan.folk.people.filter((p) => (!p.parent && (p.service || p.recurring)) || inQuest.has(stood.get(p.path)?.id)).map((p) => p.path)) }) : null;
    // POTTERING: everyone neither keeping a day nor looked for (the keeper of a shop, a service's first, one met in every
    // town, anyone in a sidequest, one crouched at its work) steps out to its own spot before its door and back, at its
    // own heartbeat; talked to where it stands, as a day's walker is (`folk-at-<id>`, its place's talk on while there)
    const looked = (p) => (!p.parent && (p.service || p.recurring)) || inQuest.has(stood.get(p.path)?.id) || keeps.has(p.path) || idleOf.get(p.path) === 'crouch';
    const potter = {}, potterSpots = [];
    if (!plan.still) for (const p of plan.folk.people) {
      const S = stood.get(p.path);
      if (!S || D?.posts[S.id] || looked(p)) continue;
      const door = doors.get(S.house);
      if (!door) continue;
      const die = mulberry32(parseInt(fingerprint(`${p.path}::potter`), 16) || 1), pick = (r) => r[0] + die() * (r[1] - r[0]);
      const [nx, ny] = door.N, out = pick(POTTER.out), along = (die() < 0.5 ? -1 : 1) * pick(POTTER.along);
      const x = S.at[0] + nx * out - ny * along, y = S.at[1] + ny * out + nx * along;
      const home = `${S.id}-home`, away = `${S.id}-out`, face = (h) => r3((h * 180) / Math.PI);
      potterSpots.push({ id: home, at: [S.at[0], S.at[1]], face: face(S.heading) }, { id: away, at: [r3(x), r3(y)], face: face(Math.atan2(y - S.at[1], x - S.at[0]) + (die() - 0.5) * 2) });
      potter[S.id] = { posts: [home, away], every: Math.round(pick(POTTER.every)) };
    }
    const spotOf = new Map([...(D?.spots ?? []), ...potterSpots].map((x) => [x.id, x.at]));
    // each one's talk: their chitchat, opened by using them; one in a sidequest's chain dispatches first to its menus;
    // one who keeps a day is talked to where they stand, each place's talk on while they are there (`folk-at-<id>`)
    for (const p of plan.folk.people) {
      const S = stood.get(p.path);
      if (!S) continue;
      const { id, at } = S, chat = `talk-${id}`, { speaker, lines } = linesFor(p, plan.folk, { say: plan.say });
      menus.push({ id: chat, kind: 'talk', who: speaker, lines });
      const P = potter[id];
      if (P) {
        const e = part.entities.find((x) => x.id === id), here = `folk-at-${id}`;
        e.rule = standRule({ speed: POTTER.speed });
        cues.push({ id: `${id}-home-first`, when: { start: true }, then: { set: here, to: 0 } });
        // (the heartbeat sends them to the other place: away from home, home from away; on the way, nowhere)
        P.posts.forEach((spot, k) => {
          const [x, y] = spotOf.get(spot), next = P.posts[(k + 1) % P.posts.length];
          cues.push({ id: `${id}-go-${k}`, when: { every: P.every }, if: { var: here, eq: k }, then: [{ set: here, to: -1 }, { walk: { who: id, to: next, then: 'stay' } }] });
          cues.push({ id: `${id}-on-${k}`, when: { arrive: { who: id, at: spot } }, then: { set: here, to: k } });
          cues.push({ id: k ? `${id}-talk-${k}` : `${id}-talk`, when: { use: { at: [x, y], r: REACH }, prompt: 'Talk' }, if: { var: here, eq: k }, then: { open: chat } });
        });
        continue;
      }
      const posts = D?.posts[id];
      if (posts) {
        const e = part.entities.find((x) => x.id === id), here = `folk-at-${id}`, R = D.routines.find((r) => r.who === id);
        e.rule = standRule({ speed: STROLL });
        cues.push({ id: `${id}-away`, when: { start: true }, then: { set: here, to: -1 } });
        for (const h of R.plan.map((x) => x.hour)) cues.push({ id: `${id}-off-${h}`, when: { var: 'hour', eq: h }, then: { set: here, to: -1 } });
        posts.forEach((spot, k) => {
          const [x, y] = spotOf.get(spot);
          cues.push({ id: `${id}-on-${k}`, when: { arrive: { who: id, at: spot } }, then: { set: here, to: k } });
          cues.push({ id: k ? `${id}-talk-${k}` : `${id}-talk`, when: { use: { at: [x, y], r: REACH }, prompt: 'Talk' }, if: { var: here, eq: k }, then: { open: chat } });
        });
        continue;
      }
      const own = SQ?.talks[id];
      // (a keeper of the world's shops: using them opens the shop, or the inn)
      const sh = keeps.get(p.path);
      if (sh && !own) { cues.push({ id: `${id}-talk`, when: { use: { at: [at[0], at[1]], r: REACH }, prompt: sh.prompt }, then: { emit: `rpg-shop:${sh.id}` } }); continue; }
      if (!own) { cues.push({ id: `${id}-talk`, when: { use: { at: [at[0], at[1]], r: REACH }, prompt: 'Talk' }, then: { open: chat } }); continue; }
      // (its use cue opens nothing itself: its `cue:<id>` event is the press the dispatch reads)
      cues.push({ id: `${id}-talk`, when: { use: { at: [at[0], at[1]], r: REACH }, prompt: 'Talk' }, then: { emit: `folk-talk:${id}` } }, ...dispatchCues(id, own, chat, `${id}-talk`).cues);
    }
    return { ...part, play: { menus: [...menus, ...(SQ?.menus ?? [])], cues: [...cues, ...(SQ?.cues ?? [])], ...(SQ ? { quests: SQ.quests } : {}), ...(D?.walkers.length || potterSpots.length ? { spots: [...(D?.walkers.length ? D.spots : []), ...potterSpots] } : {}), ...(D?.walkers.length ? { routines: D.routines } : {}) },
      ...(D?.walkers.length ? { mechanics: [{ kind: 'clock', start: plan.day.start, rate: plan.day.rate }] } : {}) };
  };
}
