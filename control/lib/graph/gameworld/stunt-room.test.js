// The stunt room and a level that is a set piece: a kind laid on its own site, the star on it; offered to Lost Nomad's feel
import { describe, it, expect } from 'vitest';
import { practiceFor } from './practice.js';
import { stuntRoom, stuntLevel, PIECE_DONE } from './stunt-room.js';
import { SET_PIECE_KIND_IDS } from './set-piece-kinds.js';
import { TARIQ } from './lost-nomad.js';
import { STUNT_CLIPS } from '../playscape/player.js';
import { readCues } from '../playscape/ui/cues.js';

describe('the stunt room', () => {
  it('is offered to a world on the cinematic action feel, and to no other', () => {
    expect(practiceFor({ id: 'g', feel: 'lost-nomad' }).rooms).toContain('stunt');
    expect(practiceFor({ id: 'g', feel: 'steel-serpents' }).rooms).not.toContain('stunt');
  });

  it('lays a rooftop run on its roofs, the star on it, held to the set piece\'s laws, and wins nothing', () => {
    const R = stuntRoom({ id: 'g', name: 'Lost Nomad', feel: 'lost-nomad' });
    expect(R.laws.filter((l) => !l.ok)).toEqual([]);
    expect(R.manifest.chase.lines[0]).toMatchObject({ id: 'rooftops', cams: expect.any(Array), marks: expect.any(Array) });
    expect(R.manifest.prompts.map((p) => p.id)).toEqual(['rooftops-grab', 'rooftops-climb']);
    expect(() => readCues(R.manifest.play)).not.toThrow();
    expect(R.manifest.tempo.moments.map((m) => m.on)).toEqual(['prompt:rooftops-grab']);
    expect(R.manifest.entities[0].rule.move).toBe('camera');
    // (the star as the template casts him, carrying the ledge's poses, and its states played by them)
    const { clips: own, ...star } = R.manifest.figures.hero.hero;
    expect(star).toEqual(TARIQ);
    expect(Object.keys(own)).toEqual(Object.keys(STUNT_CLIPS));
    expect(R.manifest.figures.hero.clips).toMatchObject({ hang: 'hang', shimmy: 'shimmy', mantle: 'pullUp', slide: 'slide' });
    // (a slide's level carries its slope to the world; a still kind none)
    const Sl = stuntLevel({ id: 'g', feel: 'lost-nomad' }, { spec: { kind: 'slide' } }).manifest;
    expect(Sl.slides).toEqual([expect.objectContaining({ id: 'slide-slope', half: 3 })]);
    expect(R.manifest).not.toHaveProperty('slides');
    expect(R.manifest).not.toHaveProperty('game');
  });
});

describe('a level that is a set piece', () => {
  it('lays each kind on its site, won as its line ends', () => {
    for (const kind of SET_PIECE_KIND_IDS) {
      const S = stuntLevel({ id: 'g', feel: 'lost-nomad' }, { ref: 'lv', spec: { kind } });
      expect(S.laws.filter((l) => !l.ok), kind).toEqual([]);
      expect(S.manifest.game.mechanics).toEqual([{ kind: 'win-when', when: { var: PIECE_DONE, gte: 1 } }]);
      expect(S.manifest.play.cues.at(-1)).toMatchObject({ when: { on: `chase:${kind}:end` }, then: { set: PIECE_DONE, to: 1 } });
      expect(() => readCues(S.manifest.play), kind).not.toThrow();
    }
  });
  it('the hero takes lips by hand, a climb\'s face laid as holds; a collapse carries its tower as breakable blocks', () => {
    const K = stuntLevel({ id: 'g', feel: 'lost-nomad' }, { spec: { kind: 'climb' } }).manifest;
    expect(K.entities[0].rule.ledge).toBe(true);
    expect(K.entities[0].rule.wall).toBeUndefined();
    // (a stone each 1.6 m up the face, the lip a reach above the last)
    const stones = K.colliders.filter((c) => c.min[0] === 19.7).map((c) => c.max[2]);
    expect(stones).toEqual([6.6, 8.2, 9.8]);
    const C = stuntLevel({ id: 'g', feel: 'lost-nomad' }, { spec: { kind: 'collapse', courses: 4 } }).manifest;
    expect(C.breakables.map((b) => b.id)).toEqual(['tower:1', 'tower:2', 'tower:3', 'tower:4']);
    expect(C.faces.filter((f) => f.group === 'break:tower:1').every((f) => f.node === 'tower:1')).toBe(true);
    expect(C.colliders.some((c) => c.min[2] >= 6 && c.min[0] === 18)).toBe(false);   // (the tower's courses are not colliders)
  });
  it('stands the world\'s own hero where it is made, a plain stand-in when asked', () => {
    const O = stuntLevel({ id: 'g' }, { heroRef: 'hero-1', spec: { kind: 'climb' } });
    expect(O.hero).toBe('own');
    // (a stored hero cannot take clips here: it hangs and shimmies on its jump's flight, pulls up on its wind-up)
    const st = O.manifest.figures.hero.clips;
    expect([st.hang, st.shimmy, st.mantle]).toEqual([st.leap, st.leap, st.squat]);
    expect(stuntLevel({ id: 'g' }, { spec: { kind: 'climb' }, cast: 'stand-in' }).hero).toBe('stand-in');
  });
});

describe('a designed game whose levels are set pieces', () => {
  it('reads, stages and orders each as its set piece, its line named for the level', async () => {
    const { readGameworld } = await import('./index.js');
    const { gameStages, stageLevelOrder } = await import('./levels.js');
    const W = { id: 'reel', name: 'Reel', feel: 'lost-nomad', start: 'roofs', levels: { roofs: { name: 'The roofs', stunt: { kind: 'rooftop-run' } }, fall: { name: 'The fall', stunt: { kind: 'collapse', courses: 4 } } } };
    const G = readGameworld(W), stages = gameStages(W);
    expect(stages.map((s) => [s.level, s.section])).toEqual([['roofs', 'stunt'], ['fall', 'stunt']]);
    const M = stageLevelOrder(G, stages[1], { ref: 'lv_1', heroRef: 'gw-hero' }).args.manifest;
    expect(M.chase.lines[0].id).toBe('fall');
    expect(M.figures.hero.heroRef).toBe('gw-hero');
    expect(M.breakables.length).toBe(4);
    expect(() => readGameworld({ ...W, levels: { ...W.levels, fall: { stunt: { kind: 'heist' } } } })).toThrow(/levels\.fall\.stunt: set piece kind is/);
    expect(() => readGameworld({ ...W, levels: { ...W.levels, fall: { stunt: { kind: 'climb' }, walk: {} } } })).toThrow(/set-piece level is its set piece alone/);
  });
});
