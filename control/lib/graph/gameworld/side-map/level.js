/**
 * A SIDE MAP LEVEL (a world's `levels.<id>.sidemap`, laid by levels.js `gameStages` as one stage, section `sidemap`):
 * the map built on the level's geocube (scene.js, the geocube's `show: 'sidemap'`) and played by the world's hero,
 * laid for the hero's own height and reach, so the map, its laws and its play agree.
 *
 *   the HERO     the world's hero on the platform rule its feel lowers (feel/lower.js), running the lane the map is laid
 *                along (+y at x 0), standing at the first zone's checkpoint, in its rail's body light (game-bodies.js
 *                BODY_LIGHTS: the side scroller's `cel`)
 *   the CAMERA   the side map's (worlds/controllable/sidemap.js): its zones, their checkpoints, their rising frames
 *   the LEVEL    the layout's blocks its colliders, its ladders climbables (play.js)
 *   a FALL       out of the frame's bottom: counted in the catch zone in limbo (`side-fall`), a life where the world's
 *                mechanics keep lives (`mechanics.lives`: their `falls`), and back at the zone's checkpoint. The game's
 *                own fall policy is off: a chute goes far below where its catch box stands
 *   ENERGY       where the world keeps lives, a hit takes ticks of the hero's energy (SIDE_ENERGY) and a life goes only
 *                when it runs out, the hero dropped to fall out of the frame as a fall does (`energy.down`: SIDE_DOWN)
 *   the GOAL     the last zone's far side reached; where its room holds a boss (the chain's `boss`, stood by the stage's
 *                extra: boss-cast.js), the boss's fall
 *
 *   the FOES     the level's `foes` on the map's spawners (cast.js), stood by the stage's extra (the runner's foe cast) on
 *                the lane's rail, in the hero's body light
 *
 *   sideMapLevelOrder(G, stage, { ref, heroRef, heroGaits?, heroStature?, pilot?, title?, mechanics?, extra?, foeFrom? })
 *     → { tool: 'create_sketch', args: { title, manifest }, laws }   laws: the map's own (laws.js), each `sidemap:<id>`
 *
 * Pure.
 */
import { playerWorld } from '../../playscape/player.js';
import { feelRule } from '../feel/lower.js';
import { sideMapOf, SIDE_MAP_STATURE } from './scene.js';
import { sideMapPlay, SIDE_FALL, SIDE_DOWN } from './play.js';
import { sideMapLamps } from './light.js';
import { bodyLightOf, CEL_INK } from '../game-bodies.js';
import { sideMapEnds, grownFoe } from './cast.js';
import { sideMapHud, BOSS_TICKS, MENU_KEY } from './hud.js';
import { BOSSES } from '../bosses.js';
import { interfaceLook } from '../../playscape/ui/interface-look.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// (the foes' cues beside the systems' play: its lists joined, the rest the systems')
const mergePlay = (base, more) => {
  if (!base || !more) return base ?? more;
  const out = { ...more, ...base };
  for (const k of Object.keys(more)) if (Array.isArray(base[k]) && Array.isArray(more[k])) out[k] = [...base[k], ...more[k]];
  return out;
};

/** A side map level's order: the stage's map laid for the world's hero and played by it. */
// the boss stood in the last room (boss-cast.js): its body, its name and its health, off its defeat-all's bar
/** The hero's ENERGY on a side map: the genre's 28 ticks, a hit taking 4 (seven hits to fall), a life spent when it runs
 * out and the hero back at the zone's checkpoint (the lives mechanic's `energy`). */
export const SIDE_ENERGY = Object.freeze({ max: BOSS_TICKS, hit: 4 });
// a world's intro card: its boss's words in the roster (its name in its hue, its tell, what it gives), where its last
// room holds one
const introOf = (stage) => { const id = stage.manifest.sidemap?.boss, R = id && BOSSES[id]; return R ? { world: `The ${R.theme}`, name: R.name, line: `Watch for it: ${R.tell}.`, gives: R.weapon, hue: R.hue } : null; };
const bossOf = (X) => { const m = (X?.mechanics ?? []).find((x) => x && x.kind === 'defeat-all' && x.bar); return m ? { id: m.bar.of, name: m.bar.label ?? m.label ?? '', hp: m.bar.hp } : null; };

export function sideMapLevelOrder(G, stage, { ref, heroRef, heroGaits = null, heroStature = null, pilot = null, title, mechanics = null, extra = null, foeFrom = [] } = {}) {
  if (!heroRef) throw new Error('levels: a side map is played by a hero seen from the side; give the world a hero (its characters)');
  const name = title ?? `${G.name ?? G.id} · ${stage.label ?? stage.level}`, stature = heroStature ?? SIDE_MAP_STATURE;
  const manifest0 = { ...stage.manifest, ...(G.feel ? { feel: G.feel } : {}), stature };
  const M = sideMapOf(manifest0), L = M.layout, P = sideMapPlay(L, { stature, target: 'hero' });
  const s0 = Math.min(...L.swept.map((r) => r.s0)), s1 = Math.max(...L.swept.map((r) => r.s1));
  // the hero: the feel's rule on the lane, as tall as it stands
  const written = G.feel ? feelRule(G.feel) : null;
  const rule = { ...(written ?? {}), move: 'lane', lane: [[0, r3(s0 - 20)], [0, r3(s1 + 20)]], collideHeight: stature };
  const controls = `A / D  run · Space  jump${written?.dash ? ' · F  dash' : ''}${written?.buster ? ' · J  fire (hold: charge)' : ''}${L.ladders.length ? ' · W / S  climb' : ''}${mechanics?.legend ? ` · ${mechanics.legend}` : ''}`;
  const W0 = playerWorld({ heroRef, ...(heroGaits ? { gaits: heroGaits } : {}), ...(pilot ? { pilot } : {}), walk: false, id: 'hero', title: name, controls, rule });
  const hero0 = { ...W0.entities[0], transform: { pos: P.spawn, heading: Math.PI / 2 } };
  // its FOES (cast.js): the level's bestiary stood on the map's spawners, on the lane's rail, by the stage's extra (the
  // runner's foe cast, foes.js hostileCast); what it gives the hero (its stomp, its hit egg) laid over the hero's own
  // (`foeFrom`: the level's `from`, its bestiary's ids read by levels.js)
  const X = extra ? extra(sideMapEnds(L, foeFrom, { spawn: P.spawn, boss: stage.manifest.sidemap?.boss ?? null })) : null;
  const hero = X?.pilot ? { ...hero0, ...X.pilot, rule: { ...hero0.rule, ...(X.pilot.rule ?? {}), ...(written ?? {}) }, body: { ...hero0.body, ...(X.pilot.body ?? {}) } } : hero0;
  // its bodies in their rail's light (game-bodies.js BODY_LIGHTS: the side scroller's cel); a rail with none, as they were
  const light = bodyLightOf({ feel: G.feel?.pole ?? (typeof G.feel === 'string' ? G.feel : null) });
  // (a cel body's key a zone: its lamps where it is lit by lamps, on the camera's zones the page reads; index.js
  // __toonKeyOf; the land's key where it has none)
  const lampsAt = light === 'cel' ? sideMapLamps(L, M.dress) : [];
  const lamped = lampsAt.length ? { ...P.camera, zones: P.camera.zones.map((z, i) => { const ls = lampsAt.filter((l) => l.zone === i).map((l) => l.at); return ls.length ? { ...z, lamps: ls } : z; }) } : P.camera;
  // (the foes' figures in the same light as the hero's: one register over every body on the map)
  const figures0 = { ...(W0.figures ?? {}), ...(X?.figures ?? {}) };
  const figures = light ? Object.fromEntries(Object.entries(figures0).map(([k, f]) => [k, { ...f, light }])) : figures0;
  // the goal: the last zone's far side; the falls: the catch zone in limbo, a life each where the world keeps lives
  const last = L.zones.at(-1), reach = { kind: 'reach-exit', at: [0, r3(last.rect[1] - 2.5), r3(last.exit[1] + 1)], radius: 2.5, planar: false };
  // (a boss's fall in its place, where the cast stands one: boss-cast.js)
  const goals = X?.mechanics?.some((m) => m.kind === 'defeat-all') ? X.mechanics : [reach, ...(X?.mechanics ?? [])];
  // (a continue at none left where the game draws its screens: its GAME OVER is the HUD's, hud.js)
  const lives = G.mechanics?.lives ? [{ kind: 'lives', start: G.mechanics.lives, falls: [SIDE_FALL], energy: { ...SIDE_ENERGY, down: SIDE_DOWN.slice() }, ...(G.ui !== undefined ? { continues: true } : {}) }] : [];
  const ev = W0.events ?? {};
  const events = { ...ev, sources: [...(ev.sources ?? []), P.catch] };
  const manifest = {
    ...manifest0, title: name,
    figures, entities: [hero, ...P.ladders, ...(X?.entities ?? []).map((e) => (e.team === 'foes' ? grownFoe(e, stature) : e))], camera: lamped, events, colliders: P.colliders,
    ...(mechanics?.play || X?.play ? { play: mergePlay(mechanics?.play ?? null, X?.play ?? null) } : {}),
    // (a cel body's line round each of its parts, the bodies' alone, CEL_INK px wide on the side map's screen: 720 rows)
    ...(light === 'cel' && !manifest0.toon ? { toon: { ink: { only: 'bodies', color: CEL_INK.color, widthAbs: r3((CEL_INK.px * L.screen.height) / 720), lines: false } } } : {}),
    // (its crates break: the game's own degree where it says one, else `objects`, the action game's, crates.js)
    ...(L.crates?.length && !manifest0.destruction ? { destruction: mechanics?.destruction ?? 'objects' } : {}),
    game: { levelRef: ref, mechanics: [...goals, ...lives], fall: 'none' },
    // ITS HUD (hud.js), where the game's screens are the game UI runtime's (its `ui`): the 8-bit action platformer's
    // columns of ticks, the lives and the boss's energy, READY, the keys at first; in the game's look
    ...(G.ui !== undefined ? { manaHud: sideMapHud({ theme: interfaceLook(G).theme, lives: G.mechanics?.lives ?? 3, energy: G.mechanics?.lives ? SIDE_ENERGY.max : 0, boss: bossOf(X), intro: introOf(stage), keys: `${controls} · ${MENU_KEY}  menu`, continues: !!G.mechanics?.lives }) } : {}),
  };
  return { tool: 'create_sketch', args: { title: name, manifest }, laws: M.laws.map((l) => ({ ...l, id: `sidemap:${l.id}` })) };
}
