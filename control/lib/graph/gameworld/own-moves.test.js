import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld, MEADOWMARK_HERO } from './index.js';
import { quickWorld, readQuick } from './quick.js';
import { REACT_MOTION, reactStatesOf } from '../egocube/moves.js';

const REACT = { stagger: 'stagger', topple: 'knockedOutDown', getup: 'knockedOutUp' };
const level = (S) => S.find((s) => s.key.startsWith('level-')).order.manifest;

describe('beast foes: a foe whose look names a species is made through the animal door and walks on its own gaits', () => {
  it('the book\'s battles: one beast for every pack, its gaits and reactions; the people around it still react as people', () => {
    const S = runSteps({ ...MEADOWMARK_HERO, battles: { foe: { species: 'wolf' } }, moves: true }, { ref: 'gw' });
    const foe = S.find((s) => s.key === 'foe');
    expect(foe.order.animal.species).toBe('wolf');
    expect(foe.order.animal.motion).toEqual(expect.arrayContaining(['flinch', 'fall', 'rise']));
    const M = level(S), wolf = M.figures['foe-1'];
    expect(wolf).toMatchObject({ heroRef: 'gw-foe', walker: true, moves: { stagger: 'flinch', topple: 'fall', getup: 'rise' } });
    expect(wolf.library).toBeUndefined();
    expect(M.figures.hero.moves).toEqual(REACT);
  });

  it('a quick battle and a defence take a beast foe; a shooter\'s foes need a person\'s hands; an unknown beast teaches', () => {
    const B = level(runSteps(quickWorld({ id: 'qb', quick: { goal: 'battle', foes: 2, foe: { species: 'wolf' } } }), { ref: 'gw' }));
    expect(B.figures['foe-1']).toMatchObject({ heroRef: 'gw-foe', walker: true });
    const D = level(runSteps(quickWorld({ id: 'qd', quick: { goal: 'defend', waves: 1, foe: { species: 'wolf' } } }), { ref: 'gw' }));
    expect(D.figures['foe-1']).toMatchObject({ walker: true });
    expect(D.figures['tower-1'].library).toBe('quaternius-ual');
    expect(() => readQuick({ goal: 'shoot', foe: { species: 'wolf' } })).toThrow(/carry guns/);
    expect(() => readQuick({ goal: 'battle', foe: { species: 'wolf', cast: 'male' } })).toThrow(/what grows it \(not cast\)/);
    expect(() => readQuick({ goal: 'battle', foe: { species: 'gryphonx' } })).toThrow(/foe\.species/);
    expect(() => readGameworld({ ...MEADOWMARK_HERO, battles: { foe: { species: 'gryphonx' } } })).toThrow(/battles\.foe\.species/);
  });
});

describe('moves: every person the run makes takes a blow on its own rig', () => {
  it('the reaction words and the states they play', () => {
    expect(reactStatesOf(Object.keys(REACT_MOTION))).toEqual(REACT);
    expect(reactStatesOf(['hitHigh'])).toEqual({ stagger: 'hitHigh' });
    expect(reactStatesOf(['walk', 'jog'])).toBeNull();
  });

  it('the book: the hero (through its motion page), the foe and the keeper made with them; each figure plays its own', () => {
    const S = runSteps({ ...MEADOWMARK_HERO, battles: {}, minigames: ['fishing'], moves: true }, { ref: 'gw' });
    for (const key of ['hero', 'hero-equipped', 'foe', 'keeper']) expect(Object.keys(S.find((s) => s.key === key).order.spec.motion), key).toEqual(expect.arrayContaining(Object.keys(REACT_MOTION)));
    const motion = S.find((s) => s.key === 'hero').order.motion?.find((o) => o.path === '/hero/motion');
    if (motion) expect(Object.keys(motion.value)).toEqual(expect.arrayContaining(Object.keys(REACT_MOTION)));
    const L = runSteps({ ...MEADOWMARK_HERO, battles: {}, minigames: ['fishing'], moves: true }, { ref: 'gw' }).filter((s) => s.key.startsWith('level-')).map((s) => s.order.manifest);
    const figs = L.flatMap((m) => Object.values(m.figures ?? {}));
    expect(figs.length).toBeGreaterThan(2);
    for (const f of figs) expect(f.moves, f.heroRef).toEqual(REACT);
  });

  it('a quick game: the lever moves up to the world; every figure made is made with them, a mascot hero its own one-shots', () => {
    const W = quickWorld({ id: 'qs', quick: { goal: 'sneak', guards: 2, moves: true } });
    expect(W.moves).toBe(true);
    expect('moves' in W.quick).toBe(false);
    const M = level(runSteps(W, { ref: 'gw' }));
    expect(M.figures['guard-1'].moves).toEqual(REACT);
    const H = level(runSteps(quickWorld({ id: 'qm', quick: { goal: 'reach', hero: { mascot: true }, moves: true } }), { ref: 'gw' }));
    expect(H.figures.hero.moves).toEqual({ stagger: 'flinch', topple: 'fall', getup: 'rise' });
  });

  it('teaches; and a world without them is the world it was', () => {
    expect(() => readQuick({ goal: 'reach', moves: 'yes' })).toThrow(/moves is true/);
    expect(() => readGameworld({ ...MEADOWMARK_HERO, moves: 1 })).toThrow(/moves is true/);
    const a = runSteps(MEADOWMARK_HERO, { ref: 'gw' }), b = runSteps({ ...MEADOWMARK_HERO, moves: false }, { ref: 'gw' });
    expect(b.map((s) => s.print)).toEqual(a.map((s) => s.print));
    expect(Object.values(level(a).figures).some((f) => f.moves)).toBe(false);
  });
});
