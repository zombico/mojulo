/**
 * SCENE SCRIPTS — a scene's beats written as a screenplay (actor/screenplay.js) and directed by the cinematics
 * department: the actor blocks it on the level's own places (actor/scene.js: who faces whom, who crosses where) and the
 * director covers it (actor/coverage.js: a wide to establish, over the shoulder for dialogue, close for a line with a
 * face of its own, the wide again on a cross, every camera on one side of the line). Lowered at build into the beats the
 * scene runner already plays, so skip, choices, flags, the queue and a flow's staging are untouched.
 *
 *   { script: `MAYOR: The road is *shut*.
 *              HERO (worried): Since when?
 *              Mayor crosses to gate.` }          a beat among a scene's beats (scenes.js), a choice may sit between two
 *
 * The names are the page's characters by id, in capitals (MAYOR is 'mayor', HERO the player's 'hero'); the marks are
 * its places (a stage's start, exit, pocket, landmark…, a spot, an anchor) and where each character stands. The scene's
 * cast: everyone the script names, then the player (who is always there). The player's mark, where the scene puts it:
 * HERO_APART from the first other character, toward where the player starts; the scene walks it there first, and turns
 * everyone to face as the blocking opens, so the coverage, framed from the marks, is true on the page.
 *
 * Lowered (a script reads as if its beats were written by hand):
 *   each cut               { shot: { frame, on, side } } (a close at the eyes, CLOSE_LOOK); a cut that lands inside a
 *                          beat before it plays, the ones before it held `for` the time between (the establishing wide)
 *   a line                 { line: { who, say, expression?, take } }: the words in the box, the read's markup taken out,
 *                          the parenthetical's emotion its expression; `take` its span on the scene's clock ({ at, end }:
 *                          its words and the gap after, never into the next line's), which the runner plays the line's
 *                          take over (scene-runner.js: a press shows the words, the take plays on, at its end the cast
 *                          holds until the press; the next line's take starts at its own start)
 *   a cross                { do: { walk: { who, to, then: 'stay', speed: WALK } } } and { until: [{ arrive: who },
 *                          { stuck: who }] } (a walk the level's walls stop still lets the scene go on)
 *   a turn                 { do: { walk: { who, to: where it stands, then: 'stay', face } } } (it turns where it stands)
 *   a wait                 { wait }
 *   the end                { do: [{ stop: who }…] }: each body handed back to its own rule (the player's to the player)
 * `looks at` is no beat: the face's take carries it (its gaze, scene-takes.js, played on the page). Slow motion, real time
 * and freezes are kept by the blocking and lowered to nothing yet: the world clock takes the time.
 *
 *   readScriptText(text, where)                 → the text, or throws, teaching
 *   lowerScript(text, { people, places, player, seed? }) → { beats, cast, cuts, scene }
 *     people  { <id>: { at: [x, y, z?], heading } } (heading radians from +x, as a transform's)
 *     places  { <id>: [x, y, z?] }
 *   scriptsIn(beats)                            → [text]: every script beat, inside choices too
 *   hasScripts(play)                            → whether any scene has one
 *   withScripts(play, { people, places, player }, { onScript? }) → the play with each script beat lowered (the same
 *                                               object when none); each script's line takes name its clip, takeClip
 *                                               (scene:<id>:<k>, its k-th script), and onScript(clip, lowered) hears it
 *   scriptStage(manifest, play, anchors, player) → { people, places, player }: the stage both the beats and the takes
 *                                               are blocked on (scene-takes.js)
 *
 * Pure and deterministic.
 */
import { actScene, WALK, TURN } from '../../actor/scene.js';
import { sceneCuts, CLOSE_LOOK } from '../../actor/coverage.js';
import { parseScreenplay } from '../../actor/screenplay.js';
import { readSpots, withStands } from './cast.js';

/** the player's mark from the first other character it meets (m): a conversation's distance */
export const HERO_APART = 1.8;
/** the longest script a beat holds (characters), and a line in the box */
export const SCRIPT_MAX = 6000, LINE_MAX = 400;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
const deg = (r) => (r * 180) / Math.PI;
const markOf = (w) => `${w}-mark`;

/** A script beat's text, read: a screenplay, a line a beat. */
export function readScriptText(text, where = 'script') {
  if (typeof text !== 'string' || !text.trim()) throw new Error(`${where} is a screenplay: a line a beat (MAYOR: the words. / Mayor crosses to gate. / Hero turns to Mayor.)`);
  if (text.length > SCRIPT_MAX) throw new Error(`${where} is at most ${SCRIPT_MAX} characters: split a long scene with a choice, a wait or a shot between two scripts`);
  return text.trim();
}

// the words the box shows: the read's markup (persona/read.js: *stress*, [pause], (aside)) taken out
const boxWords = (text) => text.replace(/\*([^*]*)\*/g, '$1').replace(/\[pause[^\]]*\]/gi, ' ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();

/** One script lowered on the page's people and places (see the header). */
export function lowerScript(text, { people = {}, places = {}, player = null, seed = 1, clip = null } = {}) {
  const script = readScriptText(text);
  const ids = Object.keys(people);
  if (!ids.length) throw new Error('script: no one on the page to play it (its names are the characters\' ids, in capitals)');
  // who the script names, in the order it names them (parsed once over everyone, so a name the page lacks is refused by name)
  const placeMarks = Object.fromEntries(Object.entries(places).filter(([, p]) => Array.isArray(p)).map(([k, p]) => [k, [p[0], p[1]]]));
  const all = parseScreenplay(script, { cast: Object.fromEntries(ids.map((w) => [w, {}])), marks: placeMarks });
  const named = [];
  const name = (w) => { if (w && !named.includes(w)) named.push(w); };
  for (const b of all) { name(b.who); if (b.to?.actor) name(b.to.actor); }
  if (player && people[player] && !named.includes(player)) named.push(player);
  if (!named.length) throw new Error('script: it names no one (a line is NAME: the words)');

  // each one's mark: where it stands; the player's beside whom it meets
  const at = Object.fromEntries(named.map((w) => [w, [people[w].at[0], people[w].at[1]]]));
  const other = named.find((w) => w !== player);
  if (player && named.includes(player) && other) {
    const o = at[other], p = at[player], d = Math.hypot(p[0] - o[0], p[1] - o[1]), h = people[other].heading ?? 0;
    const dir = d > 1e-3 ? [(p[0] - o[0]) / d, (p[1] - o[1]) / d] : [Math.cos(h), Math.sin(h)];
    at[player] = [r3(o[0] + dir[0] * HERO_APART), r3(o[1] + dir[1] * HERO_APART)];
  }
  const marks = { ...placeMarks, ...Object.fromEntries(named.map((w) => [markOf(w), at[w]])) };
  const scene = actScene({ cast: Object.fromEntries(named.map((w) => [w, { mark: markOf(w) }])), marks, script, seed });
  const cuts = sceneCuts(scene);

  // when each beat starts on the scene's clock (a line's words, a cross's turn before its walk; the rest untimed)
  const pos = Object.fromEntries(named.map((w) => [w, [...at[w]]])), walked = Object.fromEntries(named.map((w) => [w, 0]));
  let line = 0;
  const timed = scene.beats.map((b) => {
    if (b.kind === 'line') return scene.turns[line++].at;
    if (b.kind !== 'cross') return null;
    const to = marks[b.to.mark], d = Math.hypot(to[0] - pos[b.who][0], to[1] - pos[b.who][1]);
    pos[b.who] = [...to];
    return d > 1e-3 ? r3(scene.actors[b.who].walks[walked[b.who]++].start - TURN) : null;
  });
  // each cut before the beat it lands in (the setup's, before the first); one at a line's end, after that line
  const ends = scene.beats.map((b, i) => (b.kind === 'line' ? scene.turns[scene.beats.slice(0, i).filter((x) => x.kind === 'line').length].end : null));
  const into = cuts.map((c) => {
    let k = -1;
    timed.forEach((t, i) => { if (t !== null && t <= c.t + 1e-3) k = i; });
    return k >= 0 && ends[k] !== null && c.t >= ends[k] - 1e-3 ? k + 1 : k;
  });
  const shotOf = (c, hold) => ({ shot: { frame: c.frame, on: [...c.on], side: c.side, ...(c.frame === 'close' ? { lookH: CLOSE_LOOK } : {}) }, ...(hold > 0.05 ? { for: r3(hold) } : {}) });
  const shotsAt = (k) => cuts.map((c, i) => [c, i]).filter(([, i]) => into[i] === k).map(([c, i], j, list) => shotOf(c, j < list.length - 1 ? list[j + 1][0].t - c.t : 0));

  const beats = [], faceTo = (from, to) => r3(deg(Math.atan2(to[1] - from[1], to[0] - from[0])));
  const spot = (w) => [r3(pos[w][0]), r3(pos[w][1])];
  // the setup: the opening shot, the player to its mark, everyone turned as the blocking opens
  beats.push(...shotsAt(-1));
  for (const w of named) pos[w] = [...at[w]];
  const open = (w) => r3(90 - scene.actors[w].root[0].yaw);
  if (player && named.includes(player)) beats.push({ do: { walk: { who: player, to: spot(player), then: 'stay', face: open(player) } } }, { until: [{ arrive: player }, { stuck: player }] });
  const others = named.filter((w) => w !== player);
  if (others.length) beats.push({ do: others.map((w) => ({ walk: { who: w, to: spot(w), then: 'stay', face: open(w) } })) });

  // each line's take: its span on the scene's clock, from its words' start through the gap after (never into the next
  // line's), the segment the actor's take for it plays over while the box waits for the press
  // (with the clip the cast's takes for this script are packed under, and the scene's length it is sampled over)
  const takes = scene.turns.map((T, k) => ({ at: T.at, end: r3(Math.min(T.at + T.hold, scene.turns[k + 1]?.at ?? scene.seconds, scene.seconds)), ...(clip ? { clip, of: scene.seconds } : {}) }));
  let said = 0;
  scene.beats.forEach((b, i) => {
    beats.push(...shotsAt(i));
    if (b.kind === 'line') {
      const say = boxWords(b.text);
      if (say.length > LINE_MAX) throw new Error(`script: ${b.who.toUpperCase()}'s line is ${say.length} characters; the box holds ${LINE_MAX}: break it into two lines`);
      const take = takes[said++];
      beats.push({ line: { who: b.who, ...(say ? { say } : {}), ...(b.face ? { expression: b.face } : {}), ...(take.end > take.at ? { take } : {}) } });
    } else if (b.kind === 'cross') {
      const to = marks[b.to.mark];
      if (Math.hypot(to[0] - pos[b.who][0], to[1] - pos[b.who][1]) <= 1e-3) return;
      pos[b.who] = [...to];
      // (a place by its name, so the walk's arrive says it; someone's own mark as a point)
      beats.push({ do: { walk: { who: b.who, to: Object.hasOwn(placeMarks, b.to.mark) ? b.to.mark : spot(b.who), then: 'stay', speed: WALK } } }, { until: [{ arrive: b.who }, { stuck: b.who }] });
    } else if (b.kind === 'turn') {
      const target = b.to.actor ? pos[b.to.actor] : marks[b.to.mark];
      beats.push({ do: { walk: { who: b.who, to: spot(b.who), then: 'stay', face: faceTo(pos[b.who], target) } } });
    } else if (b.kind === 'wait') beats.push({ wait: Math.min(120, b.seconds) });
  });
  // every body handed back to its own rule
  beats.push({ do: named.map((w) => ({ stop: w })) });
  return { beats, cast: named, cuts, scene };
}

/** Every script beat's text, inside choices too. */
export function scriptsIn(beats) {
  const out = [];
  for (const b of beats ?? []) {
    if (isObj(b) && b.script !== undefined) out.push(b.script);
    if (isObj(b) && isObj(b.choose) && Array.isArray(b.choose.options)) for (const o of b.choose.options) out.push(...scriptsIn(o?.beats));
  }
  return out;
}

/** Whether a play's scenes have a script beat. */
export const hasScripts = (play) => isObj(play) && Array.isArray(play.scenes) && play.scenes.some((s) => scriptsIn(s?.beats).length > 0);

/** The play with each scene's script beats lowered on the page (see the header); the same object when it has none. */
export function withScripts(play, { people = {}, places = {}, player = null } = {}, { onScript = null } = {}) {
  if (!hasScripts(play)) return play;
  const lower = (scene) => {
    let k = 0;
    const lay = (beats, where) => beats.flatMap((b, j) => {
      const at = `${where}[${j}]`;
      if (isObj(b) && b.script !== undefined) {
        // (each script's takes go by the clip its scene and its place in it name: scene:<id>:<k>)
        const clip = takeClip(scene.id, k++);
        try {
          const L = lowerScript(b.script, { people, places, player, clip });
          if (onScript) onScript(clip, L);
          return L.beats;
        } catch (e) { throw new Error(`play.scenes${at}.script: ${e.message.replace(/^(script|screenplay|scene): /, '')}`); }
      }
      if (isObj(b) && isObj(b.choose) && Array.isArray(b.choose.options)) return [{ ...b, choose: { ...b.choose, options: b.choose.options.map((o, n) => (isObj(o) && Array.isArray(o.beats) ? { ...o, beats: lay(o.beats, `${at}.choose.options[${n}].beats`) } : o)) } }];
      return [b];
    });
    return lay;
  };
  return { ...play, scenes: play.scenes.map((s, i) => (isObj(s) && Array.isArray(s.beats) && scriptsIn(s.beats).length ? { ...s, beats: lower(s)(s.beats, `[${i}].beats`) } : s)) };
}

/** The clip a script's takes are packed under: its scene, and which of the scene's scripts it is (from 0). */
export const takeClip = (scene, k) => `scene:${scene}:${k}`;

/** The stage a page's scripts are blocked on: its characters (every body, and the player) where they stand, and its
 * places (the play's spots, the map's anchors and their stand points). The lowering and the takes read the same one. */
export function scriptStage(manifest, play, anchors, player) {
  const people = {}, places = {};
  for (const e of Array.isArray(manifest?.entities) ? manifest.entities : []) {
    if (!isObj(e) || typeof e.id !== 'string' || !isObj(e.transform) || !Array.isArray(e.transform.pos)) continue;
    if (e.id === player || (isObj(e.body) && !e.isCamera)) people[e.id] = { at: e.transform.pos, heading: Number.isFinite(e.transform.heading) ? e.transform.heading : 0 };
  }
  for (const p of [...readSpots(play), ...withStands(anchors || [])]) if (p && typeof p.id === 'string' && Array.isArray(p.at)) places[p.id] ??= p.at;
  return { people, places, player };
}
