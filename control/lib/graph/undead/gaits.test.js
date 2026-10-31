// The undead's walks (lib/graph/undead/gaits.js) over the walk's own cycle (polygonizer/figure-posing.js undeadGait):
// absent, the walk as it was, byte for byte; a hobble lames one side; a skeleton's walk is unbound (its joints past a
// person's ranges, polygonizer/figure-vajra.js UNBOUND); and the hero door stores the walk a card walks. Cards are
// chosen in code by the procedure they run through.
import { describe, it, expect } from 'vitest';
import { gait, WALK_MINT, UNDEAD_GAIT } from '../polygonizer/figure-posing.js';
import { articulate, LIMITS } from '../polygonizer/figure-vajra.js';
import { validateHeroMotion } from '../polygonizer/hero-motion.js';
import { UNDEAD_CARDS } from './cards.js';
import { UNDEAD_GAITS, gaitOf, walkDials } from './gaits.js';
import { undeadWalk } from './tiered.js';
import { heroRecord } from '../../mcp/tools/layered.js';
import { heroRemakeOps } from '../../mcp/tools/hero-mint.js';

const phases = Array.from({ length: 12 }, (_, i) => i / 12);
const angle = (a, o, b) => { const u = [a.x - o.x, a.y - o.y, a.z - o.z], v = [b.x - o.x, b.y - o.y, b.z - o.z], d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; return (Math.acos(d / Math.hypot(...u) / Math.hypot(...v)) * 180) / Math.PI; };
const hero = (form, build, extra = {}) => ({ form: 'tiered', cast: 'male', palette: { Skin: '#9a9a90' }, undead: { form, build, seed: 3, ...extra } });
const card = (pred) => Object.values(UNDEAD_CARDS).find(pred);

describe('the undead dials over the walk', () => {
  it('absent (or at rest), the walk is the walk as it was, byte for byte', () => {
    const plain = gait(WALK_MINT), rest = gait({ ...WALK_MINT, ...UNDEAD_GAIT });
    for (const ph of phases) expect(JSON.stringify(rest(ph))).toBe(JSON.stringify(plain(ph)));
    // and an articulation without `unbound` (or at 1) is the bounded one
    const dof = { kneeL: -30, hipR: { pitch: 120 }, spine: { sagittal: 2 } };
    expect(JSON.stringify(articulate({ ...dof, unbound: 1 }))).toBe(JSON.stringify(articulate(dof)));
  });
  it('a hobble lames the side it names: its knee barely bends through its swing, the other\'s as before', () => {
    const [word, G] = Object.entries(UNDEAD_GAITS).find(([, g]) => (g.hobble?.stiff ?? 0) >= 0.5);
    const lift = (S, d) => Math.max(...phases.map((ph) => d(ph)[`knee${S}`]));
    const free = gait({ ...WALK_MINT, ...walkDials(word, { stride: WALK_MINT.strideLength }) }), lame = gait({ ...WALK_MINT, ...walkDials(word, { hobbled: true, side: 1, stride: WALK_MINT.strideLength }) });
    expect(lift('R', lame)).toBeLessThan(lift('R', free) - 10 * G.hobble.stiff);
    expect(Math.abs(lift('L', lame) - lift('L', free))).toBeLessThan(1);
  });
  it('a skeleton\'s walk is unbound: its knee snaps back and its hip swings past a person\'s cone', () => {
    const word = gaitOf(card((c) => c.form === 'bone'));
    const d = gait({ ...WALK_MINT, ...walkDials(word, { stride: WALK_MINT.strideLength }) });
    expect(d(0.25).unbound).toBeGreaterThan(1);
    expect(Math.min(...phases.map((ph) => Math.min(d(ph).kneeL, d(ph).kneeR)))).toBeLessThan(0);
    // the posed shin folds forward at the knee (a person's never does) where the dials ask it to
    const ph = phases.find((x) => d(x).kneeL < -5), P = articulate(d(ph)), B = articulate({ ...d(ph), unbound: 1 });
    expect(angle(P.hipL, P.kneeL, P.ankleL)).toBeLessThan(179);
    expect(P.ankleL.y).toBeGreaterThan(B.ankleL.y + 0.01);
    // the hip cone is a person's 62° unbound only
    expect(LIMITS.hip).toBe(62);
    const far = articulate({ hipL: { pitch: 110 }, unbound: 2 }), near = articulate({ hipL: { pitch: 110 } });
    expect(far.kneeL.z).toBeGreaterThan(near.kneeL.z);
  });
  it('the door takes every undead dial on a walk and refuses an unknown one', () => {
    expect(validateHeroMotion({ walk: { ...UNDEAD_GAIT, hobble: 1, flail: 0.5 } })).toEqual([]);
    expect(validateHeroMotion({ walk: { wobble: 1 } }).join()).toMatch(/not a walk dial/);
  });
});

describe('a card walks its walk', () => {
  it('a corpse walks its card\'s walk; the attack skeleton scuttles whatever its card', () => {
    const flesh = Object.entries(UNDEAD_CARDS).find(([, c]) => c.form === 'flesh');
    const H = heroRecord(hero('zombie', flesh[1].build));
    expect(H.motion.walk).toMatchObject({ seconds: UNDEAD_GAITS[flesh[1].gait].seconds });
    const bone = card((c) => c.form === 'bone');
    expect(gaitOf(bone, ['attack'])).not.toBe(bone.gait);
    expect(heroRecord(hero('skeleton', bone.build, { layers: ['attack'] })).motion.walk.seconds).toBe(UNDEAD_GAITS[gaitOf(bone, ['attack'])].seconds);
  });
  it('a hobble is the hero\'s to say, else its walk\'s odds on its dice; the operator\'s own dials stand over the walk', () => {
    const c = card((x) => x.form === 'flesh' && (UNDEAD_GAITS[x.gait].hobble?.odds ?? 0) < 1);
    expect(undeadWalk(hero('zombie', c.build, { hobble: true })).hobble).toBe(1);
    expect(undeadWalk(hero('zombie', c.build, { hobble: false })).hobble).toBeUndefined();
    const seeds = Array.from({ length: 24 }, (_, i) => i + 1).map((seed) => !!undeadWalk({ ...hero('zombie', c.build), undead: { form: 'zombie', build: c.build, seed } }).hobble);
    expect(seeds.some(Boolean) && !seeds.every(Boolean)).toBe(true);
    expect(heroRecord({ ...hero('zombie', c.build), motion: { walk: { seconds: 3 } } }).motion.walk.seconds).toBe(3);
  });
  it('the door stores the undead walk, not the default walk it would otherwise be given', () => {
    const c = card((x) => x.form === 'flesh'), G = UNDEAD_GAITS[c.gait];
    const [op] = heroRemakeOps({ spec: hero('zombie', c.build) });
    expect(op.value.motion.walk).toMatchObject({ seconds: G.seconds, stanceKnee: G.dials.stanceKnee });
  });
});
