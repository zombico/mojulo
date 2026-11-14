/**
 * THE PRACTICE ROOM — a game's hero and one of its foes on its template's stage, greyboxed, on the runtime the game ships:
 * every swing, string, weapon, guard and parry of its arsenal tried on a foe that falls and comes back. The feel chapter's
 * high-fidelity prototype (the feel book is its wireframe): handed over as soon as a feel is written, before any level is
 * built, and played again as the game's own hero and foes are made.
 *
 *   practiceRoom(G, { refs?, cast?, pack? }) → { manifest, arsenal, kit, from, stage, hero, foe }
 *     refs   { hero?, sheathed?, foes?: { <bestiary id>: ref } } the sketches the run made (the hero, its sheathed twin,
 *            the foes); one absent stands in: the hero on the template's body (`cast`, a blade in its right hand), the
 *            foe a person of its class
 *     pack   how many of the foe (1); sound: the SFX shelf's style (realistic), or 'none'
 *     arsenal an arsenal over the world's (the room's `--combos`); standIn: a hero door spec the stand-in wears (its cast,
 *            head, form…), its blade still the world's
 *   → manifest  a `controllable` World manifest (resolved by world-scene.js, emitted as a level is)
 *     arsenal   what the hero plays: the world's `arsenal` (arsenal.js), else its feel template's kit, else the basic one
 *     kit       the template whose kit it is, or null; from: 'world' | 'feel' | 'basic' | 'given'
 *     stage     the feel template's stage (feel/cards.js STAGES) the floor is laid from, or 'ring'
 *     hero      'own' | 'stand-in'; foe: { eid, class, made: true | false }
 *   roomEligible(G) → null, or why the world has no room (it writes no feel; its feel's template fights on another
 *     runtime, FIGHTS_ELSEWHERE; or it does not fight hand to hand and the world writes no arsenal)
 *   floorOf(S), dummyFigure(cast)   the greybox floor and the stand-in foe the platform room and the mount lane share
 *   ROOM_LEGEND   the keys, said at the foot of the page
 *
 * Pure. The page that plays it (practice-room-page.js) measures the foe's health on the resolved bodies and lays the HUD.
 */
import { POLES, STAGES } from './feel/cards.js';
import { readFeel, feelRule } from './feel/lower.js';
import { arsenalOfGame, armLevel, heroStrikes } from './arsenal.js';
import { variesHits, MOVE_SOUND_WORDS } from './sound-sheet.js';
import { arsenalFor, BASIC_ARSENAL } from './combos.js';
import { standFoe, bestiaryOf } from './foes.js';
import { FIGURE_LIBRARY } from './stage-figures.js';
import { COMBAT, POSE_LAYERS, actionWall } from './levels.js';
import { playerWorld, playerStates } from '../playscape/player.js';
import { sfxSound } from '../sfx-shelf/resolve.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// (the body's own blow, its swing's downstroke: levels.js HELD_CONTACT, where no feel names one)
const HELD_CONTACT = Object.freeze([0.28, 0.62]);
const BLADES = Object.freeze(['dagger', 'sword', 'greatsword', 'knife']);
// (how far from the foe the hero starts, metres)
const START = 2;
const ACTION_ORBIT = Object.freeze({ steer: 'orbit', mouseLook: true, lockTrack: true });
// (a stage's floor in 1 m tiles of two greys, so distances read off it; its blocks and its walls the room's grey)
const GREY = Object.freeze(['#8d8a83', '#97948c']), WALL = '#6d6f74';
// (the ring, where the template has no stage: 24 m, a low wall round it, four pillars and a ledge)
const RING = Object.freeze({ half: 12, blocks: [[-7, -7], [7, -7], [-7, 7], [7, 7]].map(([x, y], k) => ({ id: `pillar-${k + 1}`, x: [x - 0.5, x + 0.5], y: [y - 0.5, y + 0.5], h: 4 })).concat([{ id: 'ledge', x: [-11, -7], y: [4, 9], h: 1.1 }]), hero: [0, -3], dummy: [0, 1] });

export const ROOM_LEGEND = 'W A S D  run · mouse  look · click  light · right click  heavy · mouse forward  sidearm (hold) · left Ctrl  specials · mouse back / R  weapon · Shift  guard (hold) · F  sprint · F F  dodge · C  lock on · P  foe AI · K  reset · H  HUD';

/** A person standing in for a foe the run has not made: the other cast from the hero's, on the library's clips. */
export const dummyFigure = (cast = 'male') => ({ hero: { cast: cast === 'male' ? 'female' : 'male' }, library: FIGURE_LIBRARY, clips: { ...playerStates([], FIGURE_LIBRARY), forward: 'Walk_Loop' } });

// THE TEMPLATES THAT FIGHT ELSEWHERE: a template whose game's fights are not the action runtime's has no action room
// (practice.js says which room it has instead)
export const FIGHTS_ELSEWHERE = Object.freeze({
  'mojulo-fighter': 'a fighting game is practised in its own training lab, on the fight\'s page (the versus runtime)',
  'isekai-party': 'its fights are the party\'s battles, played in the battle screen (turn by turn)',
  // (a stealth game: its close quarters are the knife in the free hand, on the firing range; the grab and throw are not
  // built for it, and the action room's launchers and juggles are not its game)
  'steel-serpents': 'a stealth game\'s close quarters are its knife, practised on the firing range beside its pistol',
});

/** Why the world has no practice room, or null. */
export function roomEligible(G) {
  if (G?.feel === undefined || G?.feel === null) return 'this world writes no feel (feel: \'<template>\' | { pole, … }): the room is its feel played';
  const pole = readFeel(G.feel).pole;
  if (FIGHTS_ELSEWHERE[pole]) return FIGHTS_ELSEWHERE[pole];
  if (!POLES[pole].demo.includes('attack') && !arsenalOfGame(G)) return `its feel's template (${POLES[pole].name}) does not fight hand to hand, and the world writes no arsenal`;
  return null;
}

// the stage's floor, its blocks and a low wall round it, as faces and colliders (a block stands, never held: hold false)
export function floorOf(S) {
  const faces = [], colliders = [], H = S.half;
  const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group, doubleSided: true });
  for (let i = -H; i < H; i++) for (let j = -H; j < H; j++) faces.push(quad([i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0], GREY[(i + j + 2 * H) % 2], 'room:floor'));
  const box = ([x0, x1], [y0, y1], h, group, fill = WALL) => {
    faces.push(quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], fill, group),
      quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h], fill, group), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h], fill, group),
      quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h], fill, group), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h], fill, group));
    colliders.push({ min: [x0, y0, 0], max: [x1, y1, h], hold: false });
  };
  const T = 0.5;
  box([-H - T, H + T], [-H - T, -H], 1.2, 'room:wall'); box([-H - T, H + T], [H, H + T], 1.2, 'room:wall');
  box([-H - T, -H], [-H, H], 1.2, 'room:wall'); box([H, H + T], [-H, H], 1.2, 'room:wall');
  for (const b of S.blocks ?? []) box(b.x, b.y, b.h, b.group ?? `room:${b.id}`, b.fill ?? WALL);
  return { faces, colliders };
}

// THE SOUNDS: the SFX shelf's by the words people say (sfx-shelf/resolve.js), each a cue, the moveset's events wired to
// them (audio.moves, beats-world.js): a blade's cuts and its blow, the fist's, the finisher's knockout, the guard's block,
// parry and break, the sidearm, the weapon cycle, the foe's swing and its fall, a blow taken; steps, the dodge, the jump
const SOUND_WORDS = MOVE_SOUND_WORDS;
// (a blade's swing is a swish; the slash itself sounds only when it connects, from its cut on, laid over the blow's hit)
const SLASHES = Object.freeze({ 'blade-hit': 'katana-swing', 'finisher-hit': 'katana-heavy-swing' });
export function roomAudio(arsenal, style = 'realistic', { vary = false } = {}) {
  if (style === 'none') return null;
  const soundOf = (word) => { const v = sfxSound(word, { style }); return v && v.gestures ? v.gestures : null; };
  const fromCut = (g) => { const kept = g.filter((x) => (x.at ?? 0) >= 0.05); if (!kept.length) return g; const t0 = Math.min(...kept.map((x) => x.at)); return kept.map((x) => ({ ...x, at: Math.round((x.at - t0) * 1e4) / 1e4 })); };
  const cueOf = (id, word) => { const g = soundOf(word); if (!g) return null; const sl = SLASHES[id] && style === 'realistic' ? soundOf(SLASHES[id]) : null; return sl ? [...fromCut(sl), ...g] : g; };
  const cues = Object.fromEntries(Object.entries(SOUND_WORDS).map(([id, w]) => [id, cueOf(id, w)]).filter(([, g]) => g));
  const has = (id) => (cues[id] ? id : undefined), clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const blade = (W) => (W.figure ?? 'drawn') === 'drawn';
  const swing = Object.fromEntries(arsenal.weapons.map((W) => [W.id, blade(W) ? clean({ light: has('blade-light'), heavy: has('blade-heavy'), finisher: has('blade-heavy') }) : clean({ light: has('fist-swing') })]));
  const hit = Object.fromEntries(arsenal.weapons.map((W) => [W.id, blade(W) ? clean({ light: has('blade-hit'), heavy: has('blade-hit'), finisher: has('finisher-hit') }) : clean({ light: has('punch'), heavy: has('uppercut'), finisher: has('finisher-hit') })]));
  const step = soundOf('step-concrete'), jump = soundOf('jump'), land = soundOf('land'), dodge = soundOf('dodge');
  return { sfx: { cues, ...(vary ? { vary: true } : {}), ...(style === 'realistic' ? { mix: { space: 'interior' } } : {}) },
    ...(step ? { footsteps: clean({ step, jump: jump ?? undefined, land: land ?? undefined }) } : {}), ...(dodge ? { dodge } : {}),
    moves: clean({ swing, hit, block: has('block'), parry: has('parry'), break: has('guard-break'), draw: has('bow-draw'), loose: has('bow-shot'), arrow: has('arrow-hit'),
      felled: has('felled'), cycle: has('cycle'), foeSwing: has('foe-swing'), hurt: has('hurt') }) };
}

/** The arsenal the room plays: the world's, its feel template's kit, or the basic one. */
export function roomArsenal(G) {
  const W = arsenalOfGame(G);
  if (W) return { arsenal: W.arsenal, kit: W.template ?? null, from: 'world' };
  const K = G?.feel != null ? arsenalFor(G.feel) : null;
  return K ? { arsenal: structuredClone(K.arsenal), kit: K.template, from: 'feel' } : { arsenal: structuredClone(BASIC_ARSENAL), kit: null, from: 'basic' };
}

/** The room (see the header). */
export function practiceRoom(G, { refs = {}, cast = 'male', pack = 1, sound = 'realistic', arsenal: given = null, standIn: body = null } = {}) {
  const why = roomEligible(G);
  if (why) throw new Error(`practice room: ${why}`);
  const F = readFeel(G.feel), P0 = POLES[F.pole];
  const S = STAGES[P0.stage] && Array.isArray(STAGES[P0.stage].blocks) ? STAGES[P0.stage] : RING, stage = S === RING ? 'ring' : P0.stage;
  const { arsenal, kit, from } = given ? { arsenal: given, kit: null, from: 'given' } : roomArsenal(G);

  // THE HERO: the game's own (its sketch, and the sheathed twin the run makes an action hero), or a stand-in on the
  // template's body with the world's blade (a sword where it names none) in its right hand and on its back out of a fight
  const held = (G.characters?.hero?.adornment?.items ?? []).find((it) => it.slot === 'right' && (it.serves ?? []).includes('strike'))?.build?.item;
  const blade = BLADES.includes(held) ? held : 'sword';
  const own = typeof refs.hero === 'string' && heroStrikes(G);
  const standIn = { cast, ...(body ?? {}), gear: { right: { item: blade } } };
  const rule0 = { ...feelRule(G.feel), move: 'camera' };
  const rule = Array.isArray(rule0.strikeContact) ? rule0 : { ...rule0, strikeContact: [...HELD_CONTACT] };
  // (the hero's figure as a level's: on the library's clips; a stand-in the hero door's spec in the stored hero's place, as
  // the hero door draws one, its blade in hand, and on its back for the sheathed twin)
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'practice room', controls: ROOM_LEGEND, rule });
  const fig = 'hero', { heroRef: _r, ...lib } = P.figures[fig], clipped = { ...lib, clips: { ...lib.clips, guard: 'walk' } };
  const drawnFig = own ? { ...clipped, heroRef: refs.hero } : { ...clipped, hero: standIn };
  const sheathFig = own ? (typeof refs.sheathed === 'string' ? { ...clipped, heroRef: refs.sheathed } : null) : { ...clipped, hero: { cast, ...(body ?? {}), gear: { back: { item: blade } } } };
  const figures = { [fig]: drawnFig, ...(sheathFig ? { [`${fig}-sheathed`]: sheathFig } : {}) };
  // (the hero starts a step out of reach of the foe, on the line from the stage's own start to its dummy: a lunge or two in)
  const [sx, sy] = S.hero, [dx, dy] = S.dummy, heading = Math.atan2(dy - sy, dx - sx);
  const hx = r3(dx - START * Math.cos(heading)), hy = r3(dy - START * Math.sin(heading));
  const e0 = P.entities[0];
  const heroE = { ...e0, body: { ...e0.body, ...(sheathFig ? { figure: `${fig}-sheathed` } : {}), layers: POSE_LAYERS },
    rule: { ...e0.rule, ...actionWall(e0.rule), combat: { ...COMBAT, ...(sheathFig ? { drawn: fig, sheathed: `${fig}-sheathed` } : {}) } },
    transform: { pos: [hx, hy, 0], heading: r3(heading) } };

  // THE FOE: the bestiary's first (the world's own, else the stand-in bestiary's), its made sketch, or a person of its
  // class standing in; `pack` of them round where the template's dummy stands, facing the hero
  const B = bestiaryOf(G), eid = Object.keys(B)[0], entry = B[eid], made = typeof refs.foes?.[eid] === 'string';
  const part = { figures, entities: [heroE] };
  const dummy = dummyFigure(cast);
  for (let k = 0; k < Math.max(1, pack); k++) {
    const a = pack === 1 ? 0 : (k / pack) * 2 * Math.PI;
    const at = pack === 1 ? [dx, dy, 0] : [r3(dx + 3 * Math.sin(a)), r3(dy + 3 * Math.cos(a)), 0];
    standFoe(G.foes ? G : null, part, { id: `foe-${k + 1}`, eid: made ? eid : undefined, entry, at, heading: r3(heading + Math.PI) }, made ? { ref: refs.foes[eid] } : { figure: dummy });
  }

  const { faces, colliders } = floorOf(S);
  const audio = roomAudio(arsenal, sound, { vary: variesHits(G) });
  const camera = { ...P.camera, ...ACTION_ORBIT };
  const manifest = armLevel({ arsenal }, {
    kind: 'controllable', title: `Practice room · ${G.name ?? G.id ?? 'game'}`, bg: '#1b1d22', faces, colliders, figures: part.figures, entities: part.entities, camera, lock: true,
    ...(audio ? { audio } : {}), events: { ...(P.events ?? {}) },
  });
  return { manifest, arsenal, kit, from, stage, hero: own ? 'own' : 'stand-in', foe: { eid, class: entry.class, made } };
}
