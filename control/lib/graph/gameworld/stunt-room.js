/**
 * THE STUNT ROOM, AND A LEVEL THAT IS A SET PIECE — a cinematic action game's set piece laid from its kind
 * (set-piece-kinds.js): the kind's site (greybox blocks, some that break) and its set piece (set-piece.js), the star on
 * it. The practice door's stunt room is a rooftop run, played before there are levels; a designed level's `stunt` is
 * any kind, the level won as its line ends.
 *
 *   stuntLevel(G, { ref?, heroRef?, spec, title?, cast?, game? }) → { manifest, setPiece, laws, blocks, jumps, hero: 'own' | 'star' | 'stand-in' }
 *               (a moving kind's vehicles stand in the level as its bodies, its road under them)
 *     spec      { kind, …its words } (set-piece-kinds.js)
 *     heroRef   the world's own hero, made; else the template's star, Tariq (lost-nomad.js); `cast: 'stand-in'` a plain
 *               stand-in (a quick page: the star's body slows a headless one to a few frames)
 *     game      a level's manifest carries its `game` (true): won as the line ends (win-when on the bus's `pieceDone`), a
 *               fall off the site put back at its start
 *   stuntRoom(G, { refs?, cast? }) → { manifest, setPiece, laws, roofs, hero }   the practice door's: a rooftop run, no game
 *   STUNT_LEGEND   the keys
 *
 * Pure.
 */
import { feelRule } from './feel/lower.js';
import { playerWorld, STUNT_CLIPS, stuntStates } from '../playscape/player.js';
import { lowerSetPiece, setPieceLaws } from './set-piece.js';
import { layKind, siteOf, SET_PIECE_KINDS } from './set-piece-kinds.js';
import { TARIQ } from './lost-nomad.js';

export const STUNT_LEGEND = 'W A S D  run (down the way, whichever way the camera looks) · Space  jump · F  sprint · E  the prompt\'s button · K  reset';
/** the bus's var a set piece's end sets, which wins its level */
export const PIECE_DONE = 'pieceDone';

/** A set piece laid from its kind, the star on it (see the header). */
export function stuntLevel(G, { ref = null, heroRef = null, spec, title = null, cast = null, game = true } = {}) {
  const { kind, ...words } = spec ?? {};
  const K = layKind(kind, words), sp = K.setPiece, L = lowerSetPiece(sp);
  const own = typeof heroRef === 'string';
  // (the hands take a lip in reach: a short jump caught on the far roof's edge, a face climbed by its holds)
  const rule = { ...(G.feel != null ? feelRule(G.feel) : {}), move: 'camera', ledge: true, ...(K.rule ?? {}) };
  const P = playerWorld({ heroRef: own ? heroRef : 'stand-in', id: 'hero', title: title ?? 'stunt', controls: STUNT_LEGEND, rule });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const standIn = cast === 'stand-in';
  // (hung from a lip, shimmying along it and pulled up over it in the ledge's own poses; a stored hero, which cannot take
  // clips here, plays them on its jump)
  const body = standIn ? { cast: 'male' } : TARIQ;
  const figures = { hero: own ? { ...lib, heroRef, clips: stuntStates(lib.clips, false) } : { ...lib, hero: { ...body, clips: { ...(body.clips ?? {}), ...STUNT_CLIPS } }, clips: stuntStates(lib.clips) } };
  const e0 = P.entities[0];
  const hero = { ...e0, body: { ...e0.body, hittable: true, hp: 100 }, transform: { pos: K.start.slice(), heading: K.heading } };
  // (a moving kind lays its own road, and its vehicles are bodies of the level: carriers the hero stands on)
  const site = siteOf(K.blocks, { street: !K.entities });
  const cues = [...L.cues, ...(game ? [{ id: `${sp.id}-done`, when: { on: `chase:${sp.id}:end` }, then: { set: PIECE_DONE, to: 1 } }] : [])];
  const manifest = {
    kind: 'controllable', title: title ?? `${SET_PIECE_KINDS[kind].name} · ${G.name ?? G.id ?? 'game'}`, bg: '#1c1a18',
    faces: K.faces ? [...site.faces, ...K.faces] : site.faces, colliders: site.colliders, ...(site.breakables.length ? { breakables: site.breakables } : {}),
    figures: { ...figures, ...(L.figures ?? {}) }, entities: [hero, ...(K.entities ?? []), ...(L.entities ?? [])],
    camera: { ...P.camera, steer: 'orbit', mouseLook: true }, events: { ...(P.events ?? {}) },
    chase: L.chase, prompts: L.prompts, ...(K.slides ? { slides: K.slides } : {}), ...(L.tempo ? { tempo: L.tempo } : {}), play: { cues },
    ...(game ? { game: { ...(ref ? { levelRef: ref } : {}), fall: { mode: 'respawn' }, mechanics: [{ kind: 'win-when', when: { var: PIECE_DONE, gte: 1 } }] } } : {}),
  };
  return { manifest, setPiece: sp, laws: setPieceLaws(sp), blocks: K.blocks, jumps: K.jumps, hero: own ? 'own' : standIn ? 'stand-in' : 'star' };
}

/** The practice door's stunt room: a rooftop run on the template's roofs (see the header). */
export function stuntRoom(G, { refs = {}, cast = null } = {}) {
  const S = stuntLevel(G, { heroRef: refs.hero ?? null, spec: { kind: 'rooftop-run', id: 'rooftops' }, title: `Stunt room · ${G.name ?? G.id ?? 'game'}`, cast, game: false });
  return { ...S, roofs: S.blocks.map((b) => [b.id, [b.x[0], b.y[0], b.x[1], b.y[1], b.z[1]]]) };
}
