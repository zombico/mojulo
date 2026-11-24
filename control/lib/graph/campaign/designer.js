/**
 * THE MISSION DESIGNER — a game's missions designed whole (mission.js; an arcade stage's, one that names its `route`:
 * stage.js, approved from its briefing, its table following from its route), kept on its world as `missions`, drafted by the
 * agent, edited and approved by the person on the holo table, and built once approved:
 *
 *   world.missions: { <level id>: <a mission's design> }
 *
 *   draft      written by the agent (design_game, a patch to /missions/<id>), read and held to its laws, shown to the
 *              person as the holo briefing (the game's books: `?book=briefing&mission=<id>`), where they move what is in it,
 *              change what it says and does, and save it or approve it (the dashboard's missions route)
 *   approved   the person approved it on the table (the eyes gate, theirs): its level IS the design compiled
 *              (compileMission: the sortie, the fleet, the moon, the briefing over its level), over any level written by
 *              that id
 *
 *   readMissions(v, { levels? })     → { <id>: mission read }   every fault said, naming the mission
 *   withMissions(world)              → the world with each approved mission's level laid from its design (a world with
 *                                      none comes back as it was)
 *   designKind(design)               → 'mission' | 'stage'
 *   missionsReadout(world, { ref? }) → [{ mission, kind, name, place, status, laws: [failing…], briefing?, editor? }]   what
 *                                      design_game says of each
 *   applyMissionEdit(manifest, { mission, design, approve? }) → { manifest, status, laws }   the person's save from the
 *                                      table: the design read and compiled (a fault throws, saying it), approved or a
 *                                      draft again (an edit to an approved mission makes it a draft until approved again)
 *
 * Pure.
 */
import { readMission, missionLaws, compileMission } from './mission.js';
import { readStage, stageLaws, compileStage, stagePlace } from './stage.js';
import { placeLine } from './theatre.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]*$/;
const clone = (v) => JSON.parse(JSON.stringify(v));
// (two kinds of design: a cockpit mission's (mission.js) and an arcade stage's, one that names its route (stage.js); each
// read, held to its laws and compiled by its own, drafted and approved the same way)
const KINDS = Object.freeze({
  mission: Object.freeze({ read: readMission, laws: missionLaws, compile: compileMission, place: (m) => placeLine(m.place), table: true }),
  stage: Object.freeze({ read: readStage, laws: stageLaws, compile: compileStage, place: stagePlace, table: false }),
});
/** A design's kind: a stage's names its route; else a mission's. */
export const designKind = (D) => (isObj(D) && D.route !== undefined ? 'stage' : 'mission');
const kindOf = (D) => KINDS[designKind(D)];

/** A world's missions read: each a design whose id is its key. */
export function readMissions(v) {
  if (v === undefined || v === null) return {};
  if (!isObj(v)) throw new Error('gameworld: missions is { <level id>: <a mission\'s design> } (campaign/designer.js)');
  const out = {};
  for (const [id, D] of Object.entries(v)) {
    if (!ID.test(id)) throw new Error(`gameworld: missions.${id}: a mission's id is a level's (lower case, digits, hyphens)`);
    if (!isObj(D)) throw new Error(`gameworld: missions.${id} is a mission's design (campaign/mission.js)`);
    if (D.id !== undefined && D.id !== id) throw new Error(`gameworld: missions.${id}.id is '${D.id}': a mission's id is its key`);
    try { out[id] = kindOf(D).read({ ...D, id }); } catch (e) { throw new Error(`gameworld: missions.${id}: ${e.message.replace(/^campaign: (mission|stage)/, '').replace(/^\./, '')}`); }
  }
  return out;
}

/** The world with each approved mission's level laid from its design (its level's name kept where the level has one). */
export function withMissions(world) {
  if (!isObj(world) || world.missions === undefined || world.missions === null) return world;
  const M = readMissions(world.missions), levels = { ...(world.levels ?? {}) };
  let changed = false;
  for (const [id, m] of Object.entries(M)) {
    if (m.status !== 'approved') continue;
    const L = kindOf(world.missions[id]).compile(m, { design: clone({ ...world.missions[id], id }) }).level;
    // (what the level says beyond its flight, a palette, a style, a seed, stays; its airspace and its goal are the design's)
    const { airspace: _a, goal: _g, ...rest } = isObj(levels[id]) ? levels[id] : {};
    levels[id] = { ...rest, name: rest.name ?? L.name, airspace: L.airspace, goal: L.goal };
    changed = true;
  }
  return changed ? { ...world, levels } : world;
}

/** What design_game says of each mission: its state, the laws it fails, where the person sees it and edits it. */
export function missionsReadout(world, { ref = null } = {}) {
  if (!isObj(world) || !isObj(world.missions)) return [];
  const M = readMissions(world.missions), at = (id, edit) => (ref ? `/api/sketches/${encodeURIComponent(ref)}/bible?book=briefing&mission=${encodeURIComponent(id)}${edit ? '&edit=1' : ''}` : null);
  return Object.entries(M).map(([id, m]) => {
    const K = kindOf(world.missions[id]);
    return {
      mission: id, kind: designKind(world.missions[id]), name: m.name, place: K.place(m), status: m.status,
      laws: K.laws(m).filter((L) => !L.ok).map((L) => `${L.law}: ${L.says}`),
      // (a stage's table follows from its route and its waves: approved from its briefing, not moved about on the table)
      ...(ref ? { briefing: at(id, false), ...(K.table ? { editor: at(id, true) } : {}) } : {}),
    };
  });
}

/** The person's save from the table: the design read and compiled, approved or a draft again. */
export function applyMissionEdit(manifest, { mission, design, approve = false } = {}) {
  if (!isObj(manifest)) throw new Error('missions: a game\'s manifest is an object');
  if (typeof mission !== 'string' || !ID.test(mission)) throw new Error('missions: mission is the id of the mission being saved');
  if (!isObj(design)) throw new Error('missions: design is the mission\'s design as edited');
  const next = { ...clone(design), id: mission, status: approve ? 'approved' : 'draft' };
  const K = kindOf(next), m = K.read(next);
  // (a design the level cannot fly is said here, as the build would say it)
  K.compile(m);
  const missions = { ...(isObj(manifest.missions) ? manifest.missions : {}), [mission]: next };
  return { manifest: { ...manifest, missions }, status: next.status, laws: K.laws(m) };
}
