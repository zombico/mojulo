import { describe, it, expect } from 'vitest';
import { TEMPLATE_ARSENALS, ARTESIA_ARSENAL, FALLEN_ANGEL_ARSENAL, BASIC_ARSENAL, arsenalFor, readArsenal, lowerArsenal } from './combos.js';
import { poleCard } from './feel/cards.js';
import { suggestFeels } from './feel/suggest.js';
import { composeLive } from '../worlds/controllable/compose.js';

// THE TEMPLATES' KITS (combos.js TEMPLATE_ARSENALS, arsenalFor): a game template's starter arsenal, found from a game's
// feel. The stylish game's is the practice room's launcher, juggle and air strings; the action-adventure's is deliberate,
// keeps to the ground, and turns back + heavy into the spin attack.
describe('the kits', () => {
  it('the stylish game keeps the launcher, the juggle and the air strings, swung freestyle', () => {
    const A = readArsenal(FALLEN_ANGEL_ARSENAL), M = lowerArsenal(A)[0].moveset;
    expect(A.art).toBe('freestyle');
    expect(A.juggle).toEqual(BASIC_ARSENAL.juggle);
    expect(M.tree.bH.move).toBe('launcher');
    expect(M.airTree.L.next.L.next.L.move).toBe('air-slam');
  });
  it('the action-adventure keeps to the ground: no juggle, no air string, back + heavy the spin attack; deliberate, swung inspired', () => {
    const A = readArsenal(ARTESIA_ARSENAL), [W] = lowerArsenal(A), M = W.moveset;
    expect(A.art).toBe('inspired');
    expect(A.juggle).toBeUndefined();
    expect(M.airTree).toBeUndefined();
    expect(M.air).toBeUndefined();
    expect(Object.values(M.moves).some((m) => m.launch > 0 || m.air)).toBe(false);
    expect(M.tree.bH.move).toBe('spin');
    expect(M.moves.spin).toMatchObject({ arc: 360, spin: 1 });
    // (deliberate: a press remembered longer, a string that plays further before it chains, a longer rest)
    const S = lowerArsenal(readArsenal(FALLEN_ANGEL_ARSENAL))[0].moveset;
    expect(M.buffer).toBeGreaterThan(S.buffer);
    expect(M.moves['cut-1'].dur * M.moves['cut-1'].cancel).toBeGreaterThan(S.moves['cut-1'].dur * S.moves['cut-1'].cancel);
    expect(M.rest).toBeGreaterThan(S.rest);
  });
  it('a game\'s feel finds its kit: its template, else the nearer of a blend that has one', () => {
    expect(arsenalFor('fallen-angel').arsenal).toBe(FALLEN_ANGEL_ARSENAL);
    expect(arsenalFor({ pole: 'fable-of-artesia' }).template).toBe('fable-of-artesia');
    expect(arsenalFor({ pole: 'fallen-angel', toward: 'fable-of-artesia', t: 0.8 }).template).toBe('fable-of-artesia');
    expect(arsenalFor({ pole: 'ebon-spirits', toward: 'fallen-angel', t: 0.4 }).template).toBe('fallen-angel');
    expect(arsenalFor('ebon-spirits')).toBeNull();
    expect(Object.keys(TEMPLATE_ARSENALS).every((id) => !!poleCard(id))).toBe(true);
  });
  it('a brief for fast slashing with air combos points at the stylish game; its kit is the launcher\'s', () => {
    const top = suggestFeels('fast sword combat with air combos and juggles')[0].pole;
    expect(top).toBe('fallen-angel');
    expect(arsenalFor(top).arsenal.weapons[0].combos.map((c) => c.id)).toContain('launcher');
  });
  it('the action-adventure\'s jump: a metre and a fifth, over the first card\'s 0.9 and under the stylish game\'s', () => {
    expect(poleCard('fable-of-artesia').jump.height).toBe(1.2);
  });
});

// the runtime: the spin attack all round, and a press kept through the hitstop
const CW = composeLive();
const room = (foes, { hitstop = null } = {}) => {
  const [W] = lowerArsenal(readArsenal(ARTESIA_ARSENAL));
  const w = CW.createWorld({ entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', eye: 0, speed: 5, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], weapons: [W], moveset: W.moveset, ...(hitstop ? { hitstop } : {}) },
      body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100, poise: 10, radius: 0.35 }, transform: { pos: [0, 0, 0], heading: 0 } },
    ...foes.map((at, i) => ({ id: `f${i}`, team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1000, poise: 50, radius: 0.35 }, rule: { type: 'static' }, transform: { pos: at, heading: Math.PI } })),
  ] });
  const p = w.byId.p, log = [], hooks = { ground: () => 0 };
  let seq = 0;
  const run = (script, n) => { for (let i = 0; i < n; i++) { CW.stepWorld(w, script(i) || {}, 1 / 60, hooks); const P = p.mvPress; if (P && P.seq !== seq) { seq = P.seq; log.push(`${P.beat} ${P.verdict}: ${P.why}`); } } };
  run(() => ({}), 3);
  return { w, p, log, run };
};
describe('the spin attack', () => {
  it('back + heavy sweeps all round: foes ahead, behind and beside struck once each, none thrown up, the hero turned once through it and back', () => {
    const A = room([[1.2, 0, 0], [-1.2, 0, 0], [0, 1.2, 0]]);
    let turned = 0;
    A.run((i) => { turned = Math.max(turned, Math.abs(Math.sin(A.p.transform.heading))); return i < 3 ? { heavy: 1, forward: -1 } : {}; }, 60);
    expect(A.log[0]).toMatch(/bH taken: an opener: spin/);
    for (const id of ['f0', 'f1', 'f2']) { expect(A.w.byId[id].hits, id).toBe(1); expect(A.w.byId[id].juggle ?? null).toBeNull(); }
    expect(turned).toBeGreaterThan(0.9);
    expect(Math.cos(A.p.transform.heading)).toBeGreaterThan(0.99);
  });
});
describe('a press through the hitstop', () => {
  it('a tap that lands while the hero is frozen on its blow is kept and taken once it moves again', () => {
    const A = room([[1.3, 0, 0]], { hitstop: { base: 8, perMs: 0, max: 8 } });
    // (the first cut pressed; then, once its blow freezes the hero, one tap inside the freeze and nothing after)
    let tapped = false;
    A.run((i) => { if (i === 0) return { fire: 1 }; if (!tapped && A.p.hitstopT > 0) { tapped = true; return { fire: 1 }; } return {}; }, 60);
    expect(tapped).toBe(true);
    A.run(() => ({}), 40);
    expect(A.log.some((x) => /L taken: .*cut-2/.test(x))).toBe(true);
  });
});

// THE STYLISH GAME'S AIR (feel/cards.js fallen-angel, lowered by feel/lower.js; rules-platform.js): the double jump, the
// air dash alone on F (the ground's F the sprint and the dodge), and the glide held once the air jumps are spent.
import { feelRule, feelReport } from './feel/lower.js';
describe('the stylish game\'s air', () => {
  const R = feelRule('fallen-angel');
  const air = () => {
    const w = CW.createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', eye: 0, ...R }, body: { type: 'box', size: [0.6, 0.6, 1.8], radius: 0.35 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const p = w.byId.p, hooks = { ground: () => 0 }, step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) CW.stepWorld(w, inp, 1 / 60, hooks); };
    step({}, 3);
    return { p, step };
  };
  it('lowers a double jump, an air dash alone and a glide after the air jumps, the ground\'s F left to the sprint', () => {
    expect(R.airJumps).toBe(1);
    expect(R.dash).toMatchObject({ ground: false, air: { count: 1 } });
    expect(R).toMatchObject({ glideFall: 2, glideSpent: true, stamina: true, dodge: true });
    const rep = feelReport('fallen-angel');
    expect(rep.partly.map((x) => x.field)).toEqual(expect.arrayContaining(['dash', 'glide']));
    expect(rep.lost.map((x) => x.field)).not.toContain('dash');
  });
  it('F on the ground sprints and never dashes; F in the air dashes, once an airtime', () => {
    const A = air();
    A.step({ forward: 1, boost: 1 }, 30);
    expect(A.p.dashT > 0).toBe(false);
    expect(A.p.boosting).toBe(true);
    // (half a second at the sprint's pace: further than the run's would carry it)
    const x0 = A.p.transform.pos[0]; A.step({ forward: 1, boost: 1 }, 30);
    expect(A.p.transform.pos[0] - x0).toBeGreaterThan(R.speed * 0.5 + 0.5);
    const B = air();
    B.step({ jump: 1, jumpHeld: 1 }, 1); B.step({ jumpHeld: 1 }, 10);
    expect(B.p.grounded).toBe(false);
    B.step({ boost: 1 }, 1);
    expect(B.p.dashT > 0 && B.p.dashAir).toBe(true);
    B.step({}, 30); B.step({ boost: 1 }, 1);
    expect(B.p.dashT > 0 && !B.p.grounded).toBe(false);
  });
  it('the glide: a first jump held falls freely; jump, jump, hold falls no faster than the glide', () => {
    const A = air(), fallOf = (A) => -A.p.vel[2];
    A.step({ jump: 1, jumpHeld: 1 }, 1);
    let fast = 0; for (let i = 0; i < 50; i++) { A.step({ jumpHeld: 1 }); fast = Math.max(fast, fallOf(A)); }
    expect(fast).toBeGreaterThan(R.glideFall + 1);
    const B = air();
    B.step({ jump: 1, jumpHeld: 1 }, 1); B.step({ jumpHeld: 1 }, 18);
    B.step({}, 1); B.step({ jump: 1, jumpHeld: 1 }, 1);
    expect(B.p.airJumpsUsed).toBe(1);
    let most = 0; for (let i = 0; i < 90 && !(B.p.grounded && i > 5); i++) { B.step({ jumpHeld: 1 }); most = Math.max(most, fallOf(B)); }
    expect(most).toBeLessThanOrEqual(R.glideFall + 1e-6);
  });
});
