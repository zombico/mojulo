import { describe, it, expect } from 'vitest';
import { BASIC_COMBOS, readCombos, lowerCombos, comboList } from './combos.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

// THE COMBO MANIFEST (combos.js) and the runtime's moveset (combat-melee.js stepMoveset): a string of beats, each press a
// move of its own, chained at the cancel, with forgiveness either side.
const copy = (o) => JSON.parse(JSON.stringify(o));
describe('the combo manifest', () => {
  it('lowers its combos to one tree of beats, shared openings one branch', () => {
    const C = copy(BASIC_COMBOS);
    C.combos.push({ id: 'cuts-thrust', beats: ['L', 'L', 'H'], moves: ['cut-1', 'cut-2', 'thrust'] }, { id: 'cut-pause', beats: ['L', '.', 'L'], moves: ['cut-1', 'cleave'] });
    const T = lowerCombos(C).tree;
    expect(T.L.move).toBe('cut-1');
    expect(T.L.next.L.next.L).toMatchObject({ move: 'cleave', ends: ['three-cuts'] });
    expect(T.L.next.L.next.H.move).toBe('thrust');
    expect(T.L.pause.L.move).toBe('cleave');
    expect(T.L.combos).toEqual(['three-cuts', 'cuts-thrust', 'cut-pause']);
    expect(comboList(C)[0]).toMatchObject({ beats: 'L L L', moves: [{ role: 'opener' }, { role: 'filler' }, { role: 'finisher' }] });
  });
  it('refuses what it cannot play, in words', () => {
    const bad = (patch, re) => { const C = copy(BASIC_COMBOS); patch(C); expect(() => readCombos(C)).toThrow(re); };
    bad((C) => { C.combos[0].beats = ['L', 'L+']; C.combos[0].moves = ['cut-1', 'cut-2']; }, /held light.*not played yet/);
    bad((C) => { C.combos.push({ id: 'x', beats: ['L', 'H'], moves: ['cut-2', 'thrust'] }); }, /play 'cut-2' where 'three-cuts' plays 'cut-1'/);
    bad((C) => { C.moves['cut-1'].travel = { kind: 'teleport', m: 1 }; }, /travel is \{ kind: none \| step \| lunge/);
    bad((C) => { C.combos[0].beats = ['.', 'L']; C.combos[0].moves = ['cut-1']; }, /a pause stands between two presses/);
  });
});

// the runtime: a hero with the basic set and a foe that stands, struck on scripted presses at 60 Hz
const room = (moveset) => {
  const w = createWorld({ entities: [
    { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], moveset }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1e6, poise: 1 }, rule: { type: 'static' }, transform: { pos: [1.8, 0, 0], heading: Math.PI } },
  ] });
  const hooks = { ground: () => 0 }, log = [];
  const step = (inp = {}) => { stepWorld(w, inp, 1 / 60, hooks); const P = w.byId.p.mvPress; if (P && (!log.length || log[log.length - 1].seq !== P.seq)) log.push({ ...P }); };
  for (let i = 0; i < 4; i++) step();
  return { w, p: w.byId.p, step, log };
};
describe('the moveset in the runtime', () => {
  it('plays L L L as three different swings, each chained at its cancel, the finisher toppling', () => {
    const R = room(lowerCombos(BASIC_COMBOS)), clips = [];
    let n = 0;
    for (let f = 0; f < 150; f++) {
      // (each press early, in the move's wind-up, the second a frame in and so past the buffer: held to the cancel)
      R.step(f === 0 || f === 2 || f === 17 ? { fire: 1 } : {});
      if ((R.p.swingCount || 0) > n) { n = R.p.swingCount; clips.push([f, R.p.swingClip, R.p.mvRole]); }
    }
    expect(clips.map((c) => c[1])).toEqual(['swing_neutral', 'swing_left', 'swing_back']);
    expect(clips.map((c) => c[2])).toEqual(['opener', 'filler', 'finisher']);
    // (the second starts on the first's cancel, frame 15 of its 24; the third on the second's)
    expect(clips[1][0] - clips[0][0]).toBeGreaterThanOrEqual(14); expect(clips[1][0] - clips[0][0]).toBeLessThanOrEqual(16);
    expect(R.log.map((l) => l.verdict)).toEqual(['taken', 'taken', 'taken']);
    expect(R.log[2].why).toMatch(/cleave \(ends three-cuts\)/);
    expect(R.w.byId.foe.hits).toBe(3);
    // (the two steps carried the hero in; the cleave's lunge, with less room than its 0.5 m before the foe's body, played
    // in place: a move steps in only where all of its travel fits, its feet never skating)
    expect(R.p.transform.pos[0]).toBeCloseTo(0.5, 3);
    expect(R.p.transform.pos[0]).toBeLessThan(R.w.byId.foe.transform.pos[0]);
  });
  it('a press long after a move opens the string again; a heavy is its own opener; a beat with no move says so', () => {
    const R = room(lowerCombos(BASIC_COMBOS));
    R.step({ fire: 1 }); for (let f = 0; f < 80; f++) R.step();
    R.step({ fire: 1 }); for (let f = 0; f < 40; f++) R.step();
    expect(R.p.mvHit).toBe(1);
    R.step({ heavy: 1 }); R.step();
    expect(R.p.swingClip).toBe('swing_forward');
    for (let f = 0; f < 60; f++) R.step();
    R.step({ special: 1 }); R.step();
    expect(R.log[R.log.length - 1]).toMatchObject({ beat: 'S', verdict: 'dropped', why: 'no move on S' });
    // (a heavy pressed in a cut's wind-up, with no L H in the tree: nothing to chain into, so it ages out)
    for (let f = 0; f < 60; f++) R.step();
    R.step({ fire: 1 }); R.step(); R.step({ heavy: 1 }); for (let f = 0; f < 20; f++) R.step();
    expect(R.log[R.log.length - 1]).toMatchObject({ beat: 'H', verdict: 'dropped' });
  });
});

// THE ARSENAL (combos.js): the weapons a hero steps through, each its own moves and strings; the fist's moves the body's
// strikes (the figure's `moves`)
import { BASIC_ARSENAL, readArsenal, lowerArsenal, strikesOf } from './combos.js';
describe('the arsenal', () => {
  it('lowers each weapon to its own moveset, the fist on the sheathed figure playing the body\'s strikes', () => {
    const W = lowerArsenal(BASIC_ARSENAL);
    expect(W.map((w) => [w.id, w.figure])).toEqual([['sword', 'drawn'], ['fist', 'sheathed']]);
    expect(W[1].moveset.tree.L.next.L.next.L).toMatchObject({ move: 'hook', ends: ['one-two-hook'] });
    expect(W[1].moveset.moves.jab).toMatchObject({ strike: 'jab', contact: [0.4, 0.5], clip: 'mv_fist_jab' });
    expect(strikesOf(BASIC_ARSENAL)).toEqual(['jab', 'cross', 'hook', 'uppercut']);
  });
  it('refuses a weapon that is not whole, in words', () => {
    const A = JSON.parse(JSON.stringify(BASIC_ARSENAL));
    A.weapons[1].moves.jab.swing = 'neutral';
    expect(() => readArsenal(A)).toThrow(/weapons\[1\] \(fist\): .*a swing .* or a strike .*, one/);
  });
});

// THE WEAPON CYCLE (combat-melee.js r.weapons): the cycle steps to the next weapon between moves, its own string, reach
// and damage; the fist shows the sheathed hero, in combat too (rules-platform.js combat)
describe('stepping through the weapons', () => {
  const armed = () => {
    const W = lowerArsenal(BASIC_ARSENAL);
    const w = createWorld({ entities: [
      { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], weapons: W, moveset: W[0].moveset, moveClips: true, combat: { near: 10, far: 15, linger: 3, speed: 2.4, stride: 1.6, drawn: 'hero', sheathed: 'hero-sheathed' } }, body: { type: 'figure-rig', figure: 'hero-sheathed' }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1e6, poise: 1 }, rule: { type: 'static' }, transform: { pos: [1.4, 0, 0], heading: Math.PI } },
    ] });
    const hooks = { ground: () => 0 }, clips = [], log = [], p = w.byId.p;
    const step = (inp = {}) => { stepWorld(w, inp, 1 / 60, hooks); if (p.swingClip && p.swingT != null && clips[clips.length - 1] !== p.swingClip) clips.push(p.swingClip); const P = p.mvPress; if (P && (!log.length || log[log.length - 1].seq !== P.seq)) log.push({ ...P }); };
    for (let i = 0; i < 4; i++) step();
    return { p, step, clips, log };
  };
  it('the cycle takes the fist; its L L L is the jab, the cross and the hook, on the sheathed hero', () => {
    const A = armed();
    expect(A.p.body.figure).toBe('hero');   // (a foe near: in combat, the blade drawn)
    A.step({ cycle: 1 }); A.step();
    expect(A.p.mvWeapon).toBe('fist');
    expect(A.p.body.figure).toBe('hero-sheathed');
    for (let f = 0; f < 120; f++) A.step(f === 0 || f === 2 || f === 16 ? { fire: 1 } : {});
    expect(A.clips.filter((c) => c.startsWith('mv_fist_')).map((c) => c.replace(/_still$/, ''))).toEqual(['mv_fist_jab', 'mv_fist_cross', 'mv_fist_hook']);
    expect(A.p.body.figure).toBe('hero-sheathed');
    expect(A.p.idleClip).toBe('mv_fist_ready');
    // (and round again: the sword)
    A.step({ cycle: 1 }); A.step();
    expect(A.p.mvWeapon).toBe('sword');
    expect(A.p.body.figure).toBe('hero');
  });
  it('a cycle mid-swing is refused with its reason', () => {
    const A = armed();
    A.step({ fire: 1 }); A.step(); A.step({ cycle: 1 });
    expect(A.p.mvWeapon).toBe('sword');
    expect(A.log[A.log.length - 1]).toMatchObject({ beat: 'cycle', verdict: 'dropped' });
  });
});
