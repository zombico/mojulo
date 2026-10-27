/**
 * THE FOLK ON A STAGE: a gameworld town's people (folk/) standing in the level its street is laid on, each one the
 * player can walk up to and talk to. A world asks for them with `characters.folk` (folk/folk.js readFolk); a stage
 * whose manifest lays no town has none, and a world that asks for none is untouched.
 *
 *   stageFolk(G, stage)            → { town, kit, setting, folk, bodies, houseOf } or null
 *     the stage's town: the street's own lots (era/stage-buildings.js streetLots), its people grown from them in the
 *     game's setting on the stage's kit (cast-setting.js settingOfGame), their bodies by tier (folk/bodies.js)
 *   folkMintKey(plan, mint)        the run's step key for a body: the town and the mint, so a town met on two stages
 *                                  (the same kit, recipe and seed) is minted once and is the same people
 *   placeSidequests(plans)         each of `folk.sidequests` to the first stage whose town holds it (→ the ids none holds)
 *   folkExtra(plan, refOf)         → (ends) → a stage extra (stage-figures.js): figures, entities, their talk and the
 *                                  stage's sidequests (folk/sidequests.js: the journal's quests, their menus, the cues)
 *
 * WHERE THEY STAND. By their house (`town-<use>-<n>`, the stage's `townDoors`): a service's first person inside at
 * its room when the house is walked into (the elder on the dais, the master at the work floor), else beside the door;
 * the rest of the house in a row along the frontage beside it, clear of the way in, facing out. A house the street
 * had no frontage for stands no one. They stand: a routine to walk is a later step.
 *
 * WHAT THEY SAY. A talk menu each (playscape/ui/menus.js), opened by using them (a `use` cue, the interact key): the
 * line book's chitchat and service talk (folk/lines.js), or the operator's `folk.say`. Never the plot.
 *
 * Pure.
 */
import { streetLots } from '../era/stage-buildings.js';
import { folkOfTown, lotKey } from '../folk/folk.js';
import { folkBodies } from '../folk/bodies.js';
import { linesFor, speakerOf } from '../folk/lines.js';
import { sidequestsOn, lowerSidequests, dispatchCues, whoOf } from '../folk/sidequests.js';
import { settingOfGame } from './cast-setting.js';
import { libraryFigure, stand } from './stage-figures.js';
import { fingerprint } from './review.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// beside the door (m): out from the wall, along the frontage, and the step between neighbours
const OUT = 1.4, ASIDE = 1.6, STEP = 1.1;
// how near the player stands to talk (m)
const REACH = 1.6;

export function stageFolk(G, stage) {
  const ask = G?.characters?.folk, town = stage?.manifest?.town;
  if (!ask || !town) return null;
  const kit = stage.manifest.kit;
  const street = streetLots(town, kit, stage.manifest.seed);
  const lots = street.lots.map(({ l }) => l), houseOf = {};
  street.lots.forEach(({ l }, n) => { houseOf[lotKey(l)] = `town-${l.use}-${n + 1}`; });
  const setting = settingOfGame({ ...G, style: { ...(G.style ?? {}), kit } });
  const folk = folkOfTown({ seed: street.seed, heartbeat: street.town.heartbeat, lots }, { setting, folk: ask });
  const bodies = folkBodies(folk, { kit, setting, pool: ask.pool });
  return { town: fingerprint({ kit, town, seed: stage.manifest.seed ?? null }), kit, setting, folk, bodies, houseOf, ...(ask.say ? { say: ask.say } : {}), ...(ask.sidequests ? { sidequests0: ask.sidequests } : {}) };
}

export const folkMintKey = (plan, mint) => `folk-${plan.town}-${mint.key}`;

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

export function folkExtra(plan, refOf) {
  return (ends) => {
    const doors = new Map((ends.townDoors ?? []).map((d) => [d.id, d]));
    const part = { figures: {}, entities: [] }, menus = [], cues = [];
    const z = (x, y, z0) => { const g = ends.ground?.(x, y); return r3(Number.isFinite(g) ? g : z0); };
    const bodyOf = new Map(plan.bodies.people.map((p) => [p.path, p.body]));
    // each house's people in turn along its frontage
    const placed = new Map(), stood = new Map();
    for (const p of plan.folk.people) {
      const door = doors.get(plan.houseOf[p.lot]);
      if (!door) continue;
      const id = `folk-${fingerprint(p.path)}`, [nx, ny] = door.N, tx = -ny, ty = nx;
      const room = !p.parent && p.service ? roomOf(door, p.room) : null;
      let at, heading;
      if (room) {
        // inside at its room: the middle of its floor, facing the way in
        const cx = (room.box.min[0] + room.box.max[0]) / 2, cy = (room.box.min[1] + room.box.max[1]) / 2;
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
      stand(part, id, libraryFigure(refOf(bodyOf.get(p.path))), at, heading);
      stood.set(p.path, { id, at });
    }
    if (!part.entities.length) return null;
    // the sidequests this stage holds whose people all stand (a house the street had no frontage for stands no one)
    const quests = (plan.sidequests ?? []).filter((q) => [q.giver, ...q.steps.filter((s) => s.talk).map((s) => s.talk)].every((w) => stood.has(whoOf(plan.folk, w)?.path)) && q.steps.every((s) => !s.reach || doors.has(s.reach)));
    const SQ = quests.length ? lowerSidequests(quests, plan.folk, { idOf: (path) => stood.get(path).id, houseAt: (h) => doors.get(h).at.slice(0, 2), speakerOf }) : null;
    // each one's talk: their chitchat, opened by using them; one in a sidequest's chain dispatches first to its menus
    for (const p of plan.folk.people) {
      const S = stood.get(p.path);
      if (!S) continue;
      const { id, at } = S, chat = `talk-${id}`, { speaker, lines } = linesFor(p, plan.folk, { say: plan.say });
      menus.push({ id: chat, kind: 'talk', who: speaker, lines });
      const own = SQ?.talks[id];
      if (!own) { cues.push({ id: `${id}-talk`, when: { use: { at: [at[0], at[1]], r: REACH }, prompt: 'Talk' }, then: { open: chat } }); continue; }
      // (its use cue opens nothing itself: its `cue:<id>` event is the press the dispatch reads)
      cues.push({ id: `${id}-talk`, when: { use: { at: [at[0], at[1]], r: REACH }, prompt: 'Talk' }, then: { emit: `folk-talk:${id}` } }, ...dispatchCues(id, own, chat, `${id}-talk`).cues);
    }
    return { ...part, play: { menus: [...menus, ...(SQ?.menus ?? [])], cues: [...cues, ...(SQ?.cues ?? [])], ...(SQ ? { quests: SQ.quests } : {}) } };
  };
}
