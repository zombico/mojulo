import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';
import { POLES, POLE_IDS, variantsOf, poleCard, FPS } from './cards.js';
import { readFeel, feelCard, lowerFeel, feelReport } from './lower.js';

// A GAMEWORLD'S FEEL: a template's card lowered into the platform rule the runtime plays. One template per procedure
// (a plain one, one with variants, a blend, one with its own fields), chosen from the catalog; the concept asserted
// in the runtime itself: the apex, the take-off, the shortest hop, the run, the air jump, the windows.

const DT = 1 / FPS;
const FLAT = { ground: () => 0 };
const plain = POLE_IDS.find((id) => !variantsOf(id).length && poleCard(id).air?.jumps > 0 && poleCard(id).jump.commit === 0 && poleCard(id).jump.cut < 1);
const varied = POLE_IDS.find((id) => variantsOf(id).length > 1);
const other = POLE_IDS.find((id) => id !== plain && POLES[id].base !== POLES[plain].base);
const world = (rule) => createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: 1.7, ...rule }, transform: { pos: [0, 0, 0], heading: 0 } }] });
const play = (rule, inputs, n) => { const w = world(rule), e = w.byId.p, zs = []; for (let i = 0; i < n; i++) { stepWorld(w, inputs(i) ?? {}, DT, FLAT); zs.push(e.transform.pos[2]); } return { e, zs }; };

describe('reading a feel', () => {
  it('takes a template by name or with its variant, a blend or its own fields, and teaches what it takes', () => {
    expect(readFeel(plain)).toEqual({ pole: plain });
    expect(readFeel({ pole: varied, variant: variantsOf(varied)[1] }).variant).toBe(variantsOf(varied)[1]);
    expect(readFeel({ pole: plain, toward: other })).toEqual({ pole: plain, toward: other, t: 0.5 });
    expect(() => readFeel('nope')).toThrow(new RegExp(`pole is one of .*${plain}`));
    expect(() => readFeel({ pole: plain, variant: 'x' })).toThrow(/has no variants/);
    expect(() => readFeel({ pole: plain, t: 0.3 })).toThrow(/name it first/);
    expect(() => readFeel({ pole: plain, hue: 1 })).toThrow(/not part of a feel/);
  });

  it('makes the template\'s card: its variant, a blend between two, its own fields over it', () => {
    const v = variantsOf(varied)[1];
    expect(feelCard({ pole: varied, variant: v })).toEqual(poleCard(varied, v));
    const half = feelCard({ pole: plain, toward: other, t: 0.5 }), A = poleCard(plain), B = poleCard(other);
    expect(half.ground.run).toBeCloseTo((A.ground.run + B.ground.run) / 2, 3);
    expect(feelCard({ pole: plain, set: { jump: { height: 2.5 } } }).jump).toEqual({ ...A.jump, height: 2.5 });
    // a count blended is a whole count once lowered
    const jumper = POLE_IDS.find((id) => poleCard(id).air?.jumps > 0), grounded = POLE_IDS.find((id) => !(poleCard(id).air?.jumps > 0));
    for (const t of [0.3, 0.7]) expect(Number.isInteger(lowerFeel(feelCard({ pole: jumper, toward: grounded, t })).rule.airJumps ?? 0)).toBe(true);
  });
});

describe('the lowered rule in the runtime', () => {
  const card = poleCard(plain), L = lowerFeel(card), R = L.rule;

  it('jumps the card\'s height on its gravities, the jump held', () => {
    const { zs } = play(R, (i) => (i < 60 ? { jump: i === 0 ? 1 : 0, jumpHeld: 1 } : {}), 90);
    expect(Math.abs(Math.max(...zs) - card.jump.height)).toBeLessThan(0.005);   // to the half centimetre, as the runtime steps it
  });

  it('leaves the floor on the press\'s frame when the card has no gather, and a frame per gathered frame when it does', () => {
    const off = (rule) => play(rule, (i) => (i < 30 ? { jump: i === 0 ? 1 : 0, jumpHeld: 1 } : {}), 30).zs.findIndex((z) => z > 0);
    expect(off(R)).toBe(0);
    const gathered = POLE_IDS.map((id) => poleCard(id)).find((c) => c.jump.commit > 1);
    expect(off(lowerFeel(gathered).rule)).toBe(gathered.jump.commit);
  });

  it('a tap is a short hop: the rise cut on the release to the card\'s share of the launch', () => {
    const { zs } = play(R, (i) => (i === 0 ? { jump: 1, jumpHeld: 1 } : {}), 60), full = play(R, (i) => (i < 60 ? { jump: i === 0 ? 1 : 0, jumpHeld: 1 } : {}), 90).zs;
    expect(R.jumpCut).toBeCloseTo(R.jumpSpeed * card.jump.cut, 3);
    expect(Math.max(...zs)).toBeLessThan(Math.max(...full) * 0.6);
  });

  it('runs at the card\'s run, built up on its acceleration', () => {
    const { e } = play(R, () => ({ forward: 1 }), 60);
    expect(Math.hypot(e.drive[0], e.drive[1])).toBeCloseTo(card.ground.run, 6);
  });

  it('an air jump climbs its share of the jump again', () => {
    const { zs } = play(R, (i) => (i === 30 ? { jump: 1, jumpHeld: 1 } : i < 90 ? { jump: i === 0 ? 1 : 0, jumpHeld: 1 } : {}), 120);
    const at = zs[29], after = Math.max(...zs.slice(30));
    expect(Math.abs(after - at - card.jump.height * card.air.mult)).toBeLessThan(0.02);
  });

  it('carries the windows in seconds: coyote and the buffer are the card\'s frames', () => {
    expect([R.coyote * FPS, R.buffer * FPS].map(Math.round)).toEqual([card.jump.coyote, card.jump.buffer]);
  });
});

describe('the report', () => {
  it('says the template, its viewer, and every card field as carried, partly carried or not carried, never silent', () => {
    const r = feelReport(plain);
    expect([r.pole, r.name, r.view]).toEqual([plain, POLES[plain].name, POLES[plain].view.camera]);
    expect(r.carried).toEqual(expect.arrayContaining(['ground.run', 'jump.height', 'jump.gRise', 'jump.gFall']));
    expect(r.lost.length).toBeGreaterThan(0);
    for (const x of [...r.partly, ...r.lost]) expect(x.why.length).toBeGreaterThan(10);
  });

  it('names the worn gear only for a template that wears it, and a variant\'s default', () => {
    const geared = POLE_IDS.find((id) => POLES[id].gear), bare = POLE_IDS.find((id) => !POLES[id].gear && id !== geared);
    expect(feelReport(geared).lost.map((x) => x.field)).toContain(POLES[geared].gear);
    expect(feelReport(bare).lost.map((x) => x.field)).not.toContain('glide');
    expect(feelReport(varied).variant).toBe(variantsOf(varied)[0]);
  });
});
