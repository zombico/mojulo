// The battle acts in the renderer (controllable/index.js, `acts`: a page that plays party battles): the figure plays its
// own clip for the act its e.act names, at the act's phase on the world's clock. Emitted only where battles are, so a
// page without them carries none of it.
import { describe, expect, it } from 'vitest';
import { controllableChannelScript } from './index.js';

const ents = [{ id: 'h', pilotable: true, rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'h' }, transform: { pos: [0, 0, 0], heading: 0 } }];
const figure = { rig: true, clips: {} };

describe('a battle\'s acts on the figures', () => {
  it('are emitted with acts, and add nothing without', () => {
    const plain = controllableChannelScript(ents, null, { h: figure }), acted = controllableChannelScript(ents, null, { h: figure }, { acts: true });
    expect(plain).not.toContain('__actClip');
    expect(plain).toBe(controllableChannelScript(ents, null, { h: figure }, { acts: false }));
    expect(acted).toContain('__actClip');
    expect(acted).toMatch(/swing_neutral/);
    // (the act's phase drives the clip mix, in place of the gait's)
    expect(acted).toMatch(/advanceGaitMix\(rig\.mix, mode, phase,/);
    expect(plain).toMatch(/advanceGaitMix\(rig\.mix, mode, e\.gaitPhase,/);
  });
});

// THE VARIED ACTS AND THE STEP: a figure with a party battle's repertoire (fig.battle) plays its own strikes and recoils
// in turn, each figure from a place of its own, so no two blows in a row look alike; a figure without falls back to the
// first clip it has; its step out and up to its target moves it on the way, its run clip under it, and it stands in its
// ready stance while the fight lasts. The functions are the page's own source, run here on stand-ins.
describe('the varied acts and the step', () => {
  const src = controllableChannelScript(ents, null, { h: figure }, { acts: true });
  const block = src.slice(src.indexOf('const __ACT_CLIPS'), src.indexOf('function __actMode'));
  const mode = src.slice(src.indexOf('function __actMode'), src.indexOf('\n}\n', src.indexOf('function __actMode')) + 3);
  const P = (world) => new Function('__world', `${block}${mode}; return { clip: __actClip, mode: __actMode };`)(world);
  const fig = { clips: { cross: 1, hook: 1, uppercut: 1, hitHigh: 1, hitBody: 1, hitLow: 1, guard: 1, sprint: 1, swing_neutral: 1 }, battle: { strike: 'cross', strike2: 'hook', strike3: 'uppercut', hurt: 'hitHigh', hurt2: 'hitBody', hurt3: 'hitLow', ready: 'guard' } };

  it('plays its own strikes and recoils in turn, never one twice running; without its own, the first it has', () => {
    const { clip } = P({});
    const run = [1, 2, 3, 4].map((n) => clip(fig, 'strike', n, 'party-1'));
    expect(new Set(run.slice(0, 3)).size).toBe(3);
    for (let i = 1; i < run.length; i++) expect(run[i]).not.toBe(run[i - 1]);
    expect(new Set([1, 2, 3].map((n) => clip(fig, 'hurt', n, 'hero'))).size).toBe(3);
    // (another figure starts from a place of its own)
    expect([1, 2, 3].map((n) => clip(fig, 'strike', n, 'hero'))).not.toEqual([1, 2, 3].map((n) => clip(fig, 'strike', n, 'party-2')));
    expect(clip({ clips: { swing_neutral: 1 } }, 'strike', 1, 'x')).toBe('swing_neutral');
    expect(clip({ clips: {} }, 'win', 1, 'x')).toBe(null);
  });

  it('a foe roars with its own roar, and a beast varies its strike, snap and maul; one without a roar plays none', () => {
    const { clip } = P({});
    expect(clip({ clips: { recoome: 1 }, battle: { roar: 'recoome' } }, 'roar', 1, 'foe-1')).toBe('recoome');
    expect(clip({ clips: { strike: 1 } }, 'roar', 1, 'foe-1')).toBe(null);
    const wolf = { clips: { strike: 1, snap: 1, maul: 1, roar: 1, stagger: 1 }, battle: { strike: 'strike', strike2: 'snap', strike3: 'maul', roar: 'roar' } };
    expect(new Set([1, 2, 3].map((n) => clip(wolf, 'strike', n, 'foe-2')))).toEqual(new Set(['strike', 'snap', 'maul']));
    expect(clip(wolf, 'hurt', 1, 'foe-2')).toBe('stagger');
  });

  it('steps on its tween, running in; stands ready while the fight lasts', () => {
    const W = { time: 0, byId: {} }, { mode } = P(W), m = () => ({ position: { x: 0, y: 0 } });
    const e = { id: 'hero', transform: { pos: [0, 0, 0] }, fightReady: 0, stepOff: { a: [0, 0], b: [4, 0], t0: 0, for: 0.5, run: true } };
    W.time = 0.25;
    let M = m(), r = mode(fig, e, M);
    expect(r.mode).toBe('sprint');
    expect(M.position.x).toBeGreaterThan(1.5);
    expect(M.position.x).toBeLessThan(2.5);
    W.time = 1;
    M = m(); r = mode(fig, e, M);
    expect(M.position.x).toBe(4);
    expect(r.mode).toBe('guard');
    // (an act at the target plays its clip there, and holds no lean of its own)
    e.act = { is: 'strike', t0: 1, for: 0.5, to: 'foe' };
    W.time = 1.2;
    M = m(); r = mode(fig, e, M);
    expect(['cross', 'hook', 'uppercut']).toContain(r.mode);
    expect(M.position.x).toBe(4);
    // (the fight over: no stance, no step)
    const quiet = { id: 'hero', transform: { pos: [0, 0, 0] } };
    expect(mode(fig, quiet, m())).toBe(null);
  });
});
