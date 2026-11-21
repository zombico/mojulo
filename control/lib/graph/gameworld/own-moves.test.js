import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld, MEADOWMARK_HERO } from './index.js';
import { quickWorld, readQuick } from './quick.js';
import { REACT_MOTION, reactStatesOf, battleMovesOf, foeBattleMovesOf, beastMovesOf } from '../egocube/moves.js';
import { FOE_ARMS, foeGearOf, FOE_LOOKS } from './battles.js';

const REACT = { stagger: 'stagger', topple: 'knockedOutDown', getup: 'knockedOutUp' };
const level = (S) => S.find((s) => s.key.startsWith('level-')).order.manifest;

describe('beast foes: a foe whose look names a species is made through the animal door and walks on its own gaits', () => {
  it('the book\'s battles: one beast for every pack, its gaits and reactions; the people around it still react as people', () => {
    const S = runSteps({ ...MEADOWMARK_HERO, battles: { foe: { species: 'wolf' } }, moves: true }, { ref: 'gw' });
    const foe = S.find((s) => s.key === 'foe');
    expect(foe.order.animal.species).toBe('wolf');
    // (a party battle's beast: its strike and its other ways at a foe beside its reactions, egocube/moves.js beastMovesOf)
    expect(foe.order.animal.motion).toMatchObject({ reactions: ['flinch', 'fall', 'rise'], strike: true, strikes: { snap: true, maul: true, roar: true } });
    const M = level(S), wolf = M.figures['foe-1'];
    expect(wolf).toMatchObject({ heroRef: 'gw-foe', walker: true, moves: { stagger: 'flinch', topple: 'fall', getup: 'rise', strike: 'strike', strike2: 'snap', strike3: 'maul', roar: 'roar' } });
    expect(wolf.library).toBeUndefined();
    // (and, a world of battles, its battle moves beside: egocube/moves.js battleMovesOf)
    expect(M.figures.hero.moves).toEqual({ ...REACT, ...battleMovesOf('frontline').states });
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

describe('a battle foe\'s arms (battles.js FOE_ARMS)', () => {
  it('a people foe holds its kind\'s arms as the armory builds them; a look\'s own gear wins; one for every foe holds only its own', () => {
    expect(foeGearOf(FOE_LOOKS.skeleton, 'skeleton')).toMatchObject({ right: { item: 'sword', armory: 'rusted-sword', laws: 2 }, left: { item: 'shield', armory: 'cracked-round' } });
    expect(foeGearOf(FOE_LOOKS.zombie, 'zombie')).toBeNull();
    const own = { people: 'orcish', gear: { right: { item: 'dagger' } } };
    expect(foeGearOf(own, 'goblin')).toEqual({ right: { item: 'dagger' } });
    expect(foeGearOf({ people: 'orcish' }, 'foe')).toBeNull();
    // (a beast holds nothing)
    expect(foeGearOf(FOE_LOOKS.wolf, 'wolf')).toBeNull();
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
    // (each foe of the packs is its own step since per-foe figures: the person among them, the bandit, is made through the
    // hero door as the one foe was; the beasts' and the peoples' moves are read off the level figures below)
    for (const key of ['hero', 'hero-equipped', 'foe-bandit', 'keeper']) expect(Object.keys(S.find((s) => s.key === key).order.spec.motion), key).toEqual(expect.arrayContaining(Object.keys(REACT_MOTION)));
    const motion = S.find((s) => s.key === 'hero').order.motion?.find((o) => o.path === '/hero/motion');
    if (motion) expect(Object.keys(motion.value)).toEqual(expect.arrayContaining(Object.keys(REACT_MOTION)));
    const L = runSteps({ ...MEADOWMARK_HERO, battles: {}, minigames: ['fishing'], moves: true }, { ref: 'gw' }).filter((s) => s.key.startsWith('level-')).map((s) => s.order.manifest);
    const figs = L.flatMap((m) => Object.values(m.figures ?? {}));
    expect(figs.length).toBeGreaterThan(2);
    // (since per-foe figures: a person plays the hero door's reactions; a people foe the same, and its swings; a foe on a
    // beast's body its own gaits' (a flinch, a fall, a rise), and none where its gaits hold none: a bat has no fall)
    const people = figs.filter((f) => f.moves?.stagger === 'stagger'), beasts = figs.filter((f) => f.moves && f.moves.stagger !== 'stagger');
    // (the hero, a world of battles, with its battle moves beside: egocube/moves.js battleMovesOf)
    // (and a party battle's foe its own: a person's a member's strikes, recoils and stance and a roar, foeBattleMovesOf)
    for (const f of figs.filter((x) => !/-foe-/.test(x.heroRef) || /-foe-bandit$/.test(x.heroRef))) expect(f.moves, f.heroRef).toEqual(/-hero(-equipped)?$/.test(f.heroRef) ? { ...REACT, ...battleMovesOf('frontline').states } : /-foe-bandit$/.test(f.heroRef) ? { ...REACT, ...foeBattleMovesOf('frontline', { armed: true }).states } : REACT);
    for (const f of people) expect(f.moves, f.heroRef).toMatchObject(REACT);
    // (a beast its flinch, fall and rise, and its strike and its other ways at a foe where its body strikes: a bat none)
    for (const f of beasts) expect(f.moves, f.heroRef).toMatchObject({ stagger: 'flinch', topple: 'fall', getup: 'rise' });
    expect(beasts.some((f) => f.moves.strike3 === 'maul' && f.moves.roar === 'roar')).toBe(true);
    // (a people foe, its sheet made to play a party battle's foe: its repertoire and its roar on its figure)
    const sheets = S.filter((s) => /^foe-.+-sheet$/.test(s.key));
    expect(sheets.length).toBeGreaterThan(0);
    for (const x of sheets) expect(x.order.manifest.moves, x.key).toBe('battle');
    const peoples = people.filter((f) => /-foe-/.test(f.heroRef) && !/-foe-bandit$/.test(f.heroRef));
    expect(peoples.length).toBeGreaterThan(0);
    for (const f of peoples) expect(f.moves, f.heroRef).toMatchObject({ roar: 'recoome', strike: expect.any(String), strike2: expect.any(String) });
    // (ARMED BY ITS KIND, battles.js FOE_ARMS: a goblin's cudgel, a skeleton's sword and shield, made in its hand and swung)
    for (const x of S.filter((s) => /^foe-[a-z]+$/.test(s.key) && s.order.egocube)) {
      const kind = x.key.slice(4), row = FOE_ARMS[kind];
      if (!row) { expect(x.order.spec, x.key).toBeUndefined(); continue; }
      expect(Object.fromEntries(Object.entries(x.order.spec.gear).map(([k, g]) => [k, g.armory])), x.key).toEqual(row);
      const fig = figs.find((f) => f.heroRef === x.ref);
      if (fig) expect(fig.moves, x.key).toMatchObject({ strike: 'swing_neutral', strike2: 'swing_forward', strike3: 'swing_back' });
    }
    expect(S.some((s) => /^foe-[a-z]+$/.test(s.key) && s.order.spec?.gear)).toBe(true);
    expect(people.length && beasts.length).toBeTruthy();
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
