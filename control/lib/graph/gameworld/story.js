/**
 * THE STORY — a gameworld's moments, written apart from its levels and bound to them when the world is built. The story
 * names the world (a cast member, a level, a kind of place), never its coordinates, so the world can change under it:
 * each build binds every moment again, and one that can no longer find its place is UNPLACED, reported with what is
 * missing, while the rest of the world builds.
 *
 *   story: [{ id,
 *     who?:   [cast id],                         the cast in the moment (characters.cast); the hero is always there
 *     where:  { level, stage?, place? }          the level, its stage (its first by default), the place it is about
 *     stand?: { <who>: place },                  where each of them stands (else the moment's place, else beside the
 *                                                start), placed in that stage for the level's whole run
 *     when, if?, sets?, once?, beats             a scene's (playscape/ui/scenes.js): what starts it, its conditions,
 *                                                the flags it sets, its beats. `when: { reach: m? }` starts it as the hero
 *                                                comes within m (4) of its place, or of its first person's stand;
 *   }]
 *
 * A place is one of the stage's places by name (start, exit, pocket, pocket-2…, landmark…) or a kind, which takes the
 * first of it (pocket = the first pocket). The cast's names are the box's names.
 *
 * QUESTS (gameworld `quests`) are a level's quests (playscape/ui/quests.js), kept in every level's journal, whose steps
 * may name the moments that belong to them: a moment of step n waits (an `if`) until step n - 1 is done, and one of the
 * first step until the quest begins (its `starts`). The moment's own conditions hold besides.
 *
 *   quests: [{ id, name?, starts?, steps: [{ log?, done: '<flag>', moments?: [moment id] }] }]
 *
 *   readStory(S, where)          → the moments, their shape read (throws, teaching, on a malformed moment)
 *   readGameQuests(Q, story)     → the quests, read; a step's moments must be the story's, each in one step at most
 *   questGates(quests)           → { <moment id>: [condition] } the waits the quests put on their moments
 *   levelQuests(quests)          → the quests as a level reads them (play.quests: no moments)
 *   storyScene(moment, cast)     → the scene a moment plays (scenes.js shape)
 *   bindStory(G, stages, { castRefs, layout }) → { byStage: { '<level>/<node>': { scenes, cast: [{ id, ref, at, heading }] } },
 *                                  bound: [{ id, level, node, place? }], unplaced: [{ id, why }],
 *                                  unset: [{ quest, step, flag }] (a step's flag that no moment or answer sets: a cue may) }
 *                                `layout`: levels.js' { stageEnds, stageSpots, stageLane } (handed in: levels.js reads
 *                                the world, which reads this)
 */
import { readScenes } from '../playscape/ui/scenes.js';
import { readQuests } from '../playscape/ui/quests.js';

const ID = /^[a-z][a-z0-9-]*$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`gameworld: story${m}`);
const MOMENT_KEYS = ['id', 'who', 'where', 'stand', 'when', 'if', 'sets', 'once', 'beats'];
const SCENE_KEYS = ['id', 'when', 'if', 'sets', 'once', 'beats'];

/** A moment's scene: the scene keys, with the cast's names for the box. */
export function storyScene(m, cast = {}) {
  const names = Object.fromEntries((m.who ?? []).filter((w) => cast[w]?.name).map((w) => [w, cast[w].name]));
  return { ...Object.fromEntries(SCENE_KEYS.filter((k) => m[k] !== undefined).map((k) => [k, m[k]])), ...(Object.keys(names).length ? { names } : {}) };
}

/** The moments, their shape read. Binding (does the level, the place, the cast member exist?) is bindStory's, and never throws. */
export function readStory(S) {
  if (S === undefined) return [];
  if (!Array.isArray(S)) throw err(' is a list of moments { id, who?, where, stand?, when, beats, if?, sets? }');
  const seen = new Set();
  return S.map((m, i) => {
    const at = `[${i}]`;
    if (!isObj(m)) throw err(`${at} is a moment { id, who?, where, stand?, when, beats, if?, sets? }`);
    for (const k of Object.keys(m)) if (!MOMENT_KEYS.includes(k)) throw err(`${at}.${k} is not part of a moment (${MOMENT_KEYS.join(', ')})`);
    if (typeof m.id !== 'string' || !ID.test(m.id)) throw err(`${at}.id is a lowercase id ("the-warning")`);
    if (seen.has(m.id)) throw err(`${at}.id '${m.id}' appears twice`);
    seen.add(m.id);
    if (m.who !== undefined && !(Array.isArray(m.who) && m.who.every((w) => typeof w === 'string' && ID.test(w)))) throw err(`${at}.who is a list of cast ids (['mayor'])`);
    if (!isObj(m.where) || typeof m.where.level !== 'string') throw err(`${at}.where is { level, stage?, place? }: the level it happens in`);
    for (const k of Object.keys(m.where)) if (!['level', 'stage', 'place'].includes(k)) throw err(`${at}.where.${k} is not part of where (level, stage, place)`);
    for (const k of ['stage', 'place']) if (m.where[k] !== undefined && !(typeof m.where[k] === 'string' && m.where[k])) throw err(`${at}.where.${k} is a name`);
    if (m.stand !== undefined && !(isObj(m.stand) && Object.values(m.stand).every((p) => typeof p === 'string' && p))) throw err(`${at}.stand is { <who>: '<place>' }`);
    const reach = m.when?.reach;
    if (reach !== undefined && (Object.keys(m.when).length !== 1 || !(reach === true || (Number.isFinite(reach) && reach > 0 && reach <= 30)))) {
      throw err(`${at}.when.reach is true (4 m) or metres up to 30, alone in when: the moment starts as the hero comes to its place`);
    }
    // the scene itself, read as a scene is (its beats, conditions and flags teach as scenes do)
    try { readScenes({ scenes: [storyScene(m)] }); } catch (e) { throw err(`${at}${e.message.replace(/^play\.scenes\[0\]/, '')}`); }
    return { ...m };
  });
}

const qerr = (m) => new Error(`gameworld: quests${m}`);
/** The quests, read as a level's are, and their moments checked against the story. */
export function readGameQuests(Q, story = []) {
  if (Q === undefined) return undefined;
  if (!Array.isArray(Q)) throw qerr(' is a list of { id, name?, starts?, steps: [{ log?, done, moments? }] }');
  const ids = new Set(story.map((m) => m.id)), owner = {};
  Q.forEach((q, i) => (Array.isArray(q?.steps) ? q.steps : []).forEach((s, j) => {
    if (!isObj(s) || s.moments === undefined) return;
    const at = `[${i}].steps[${j}].moments`;
    if (!Array.isArray(s.moments) || !s.moments.every((m) => typeof m === 'string')) throw qerr(`${at} is a list of the story's moment ids`);
    for (const m of s.moments) {
      if (!ids.has(m)) throw qerr(`${at}: '${m}' is not a moment of the story (${[...ids].join(', ') || 'none'})`);
      if (owner[m]) throw qerr(`${at}: '${m}' is already in ${owner[m]}; a moment belongs to one step`);
      owner[m] = `${q.id}, step ${j + 1}`;
    }
  }));
  let read;
  try { read = readQuests({ quests: levelQuests(Q) }); } catch (e) { throw qerr(e.message.replace(/^play\.quests/, '')); }
  return read.map((q, i) => ({ ...q, steps: q.steps.map((s, j) => ({ ...s, ...(Q[i].steps[j].moments?.length ? { moments: [...Q[i].steps[j].moments] } : {}) })) }));
}
export const levelQuests = (Q) => (Q ?? []).map((q) => (isObj(q) && Array.isArray(q.steps) ? { ...q, steps: q.steps.map((s) => { if (!isObj(s)) return s; const { moments: _, ...rest } = s; return rest; }) } : q));
export function questGates(quests) {
  const out = {};
  for (const q of quests ?? []) q.steps.forEach((s, j) => {
    const wait = j ? s && q.steps[j - 1].done : q.starts;
    if (!wait) return;
    for (const m of s.moments ?? []) (out[m] ||= []).push({ flag: wait });
  });
  return out;
}

// a place in a stage by name, or by kind (the first of it)
function placeIn(spots, name) {
  return spots.find((s) => s.id === name) ?? spots.find((s) => s.id.replace(/-\d+$/, '') === name) ?? null;
}

/** Bind the moments to the stages as laid. `castRefs`: { <cast id>: the ref of its made figure }. */
export function bindStory(G, stages, { castRefs = {}, layout } = {}) {
  const { stageEnds, stageSpots, stageLane } = layout;
  const moments = G.story ?? [], cast = G.characters?.cast ?? {}, gates = questGates(G.quests);
  const byStage = {}, bound = [], unplaced = [];
  for (const m of moments) {
    const lv = stages.filter((s) => s.level === m.where.level);
    if (!lv.length) { unplaced.push({ id: m.id, why: `no level '${m.where.level}' (levels: ${[...new Set(stages.map((s) => s.level))].join(', ')})` }); continue; }
    const stage = m.where.stage ? lv.find((s) => s.node === m.where.stage) : lv[0];
    if (!stage) { unplaced.push({ id: m.id, why: `the level '${m.where.level}' has no stage '${m.where.stage}' (stages: ${lv.map((s) => s.node).join(', ')})` }); continue; }
    // a building level (or a building's inside) lays its rooms from a program at read: no places to bind to yet
    if (stage.section === 'building' || stage.section === 'interior') { unplaced.push({ id: m.id, why: `the stage ${stage.level}/${stage.node} is a building: a moment binds to a walk's stages for now` }); continue; }
    if (stage.section === 'city') { unplaced.push({ id: m.id, why: `the stage ${stage.level}/${stage.node} is a city's segment: a moment binds to a walk's stages for now` }); continue; }
    const missing = (m.who ?? []).filter((w) => !cast[w]);
    if (missing.length) { unplaced.push({ id: m.id, why: `${missing.map((w) => `'${w}'`).join(', ')} not in the cast (cast: ${Object.keys(cast).join(', ') || 'none'})` }); continue; }
    const cam = G.camera === 'side' && stage.manifest.trail !== undefined ? stageLane(stage) : null;
    const ends = stageEnds(stage.manifest), spots = stageSpots(ends, cam);
    const names = spots.map((s) => s.id).join(', ');
    const place = m.where.place ? placeIn(spots, m.where.place) : null;
    if (m.where.place && !place) { unplaced.push({ id: m.id, why: `the stage ${stage.level}/${stage.node} has no place '${m.where.place}' (places: ${names})` }); continue; }
    // where each of the moment's people stands: its own place, the moment's, or beside the start (spread aside)
    const stands = [];
    let lost = null;
    (m.who ?? []).forEach((w, i) => {
      const name = m.stand?.[w];
      const p = name ? placeIn(spots, name) : place;
      if (name && !p) { lost = `the stage ${stage.level}/${stage.node} has no place '${name}' for ${w} (places: ${names})`; return; }
      const base = p ? p.at : ends.spawn, h = ends.heading, ahead = p ? 1.6 : 3.2, aside = (i - ((m.who.length - 1) / 2)) * 1.4;
      const at = [r3(base[0] + Math.cos(h) * ahead - Math.sin(h) * aside), r3(base[1] + Math.sin(h) * ahead + Math.cos(h) * aside), base[2]];
      stands.push({ id: w, at, heading: r3(h + Math.PI) });
    });
    if (lost) { unplaced.push({ id: m.id, why: lost }); continue; }
    const key = `${stage.level}/${stage.node}`, slot = (byStage[key] ||= { scenes: [], cast: [] });
    // reach: the moment starts as the hero comes to it (its place, or where its first person stands)
    let scene = storyScene(m, cast);
    // the quests' waits: a moment of a later step waits for the one before (its own conditions hold besides)
    if (gates[m.id]) scene = { ...scene, if: [...[].concat(scene.if ?? []), ...gates[m.id]] };
    if (m.when && m.when.reach !== undefined) {
      const spot = place ? place.at : stands[0] ? stands[0].at : null;
      if (!spot) { unplaced.push({ id: m.id, why: `when: { reach } needs a place, or someone standing, to reach` }); continue; }
      const r = m.when.reach === true ? 4 : m.when.reach;
      scene = { ...scene, when: { enter: { at: [spot[0], spot[1]], r } } };
    }
    slot.scenes.push(scene);
    for (const s of stands) if (!slot.cast.some((c) => c.id === s.id)) slot.cast.push({ ...s, ref: castRefs[s.id] ?? null });
    bound.push({ id: m.id, level: stage.level, node: stage.node, ...(place ? { place: place.id } : {}) });
  }
  // a step's flag that nothing in the story sets (a moment's sets, an answer's): a cue may set it; said, not refused
  const sets = new Set(readScenes({ scenes: moments.map((m) => storyScene(m)) }).flatMap((sc) => [...sc.sets, ...answers(sc.beats)]));
  const unset = [];
  for (const q of G.quests ?? []) q.steps.forEach((s, j) => { if (!sets.has(s.done)) unset.push({ quest: q.id, step: j + 1, flag: s.done }); });
  return { byStage, bound, unplaced, ...(G.quests ? { unset } : {}) };
}
const answers = (beats) => beats.flatMap((b) => (b.kind === 'choose' ? b.choose.options.flatMap((o) => [...o.sets, ...answers(o.beats)]) : []));

const r3 = (v) => Math.round(v * 1000) / 1000;
