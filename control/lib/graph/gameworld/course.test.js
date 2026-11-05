import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';
import { standBlocks, groundOf } from '@/lib/graph/playscape/terrain.js';
import { POLE_IDS, poleCard } from './feel/cards.js';
import { reachOf, reachAt } from './feel/reach.js';
import { coursePlan, courseLaws, lowerCourse, readCourse, advancedMoves, TEACH, VERTICALITY } from './course.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';

// THE COURSE: a platforming segment's floors and gaps, sized by the hero's reach and tagged with the move each teaches;
// lowered into walkway tiles, stairs and catch zones; played on the shipped rule. One template per procedure from the
// catalog: one whose card carries every advanced move (an air jump, a dash jump, a wall), one with no air jump.
const full = POLE_IDS.find((id) => { const C = poleCard(id); return C.air?.jumps > 0 && C.cling && C.dash?.kind === 'dash' && C.dash.jump; });
const noAir = POLE_IDS.find((id) => { const C = poleCard(id); return !(C.air?.jumps > 0) && C.cling && C.dash?.kind === 'dash' && C.dash.jump; });
const RF = reachOf({ pole: full, takes: true }), RN = reachOf({ pole: noAir, takes: true });
const DT = 1 / 60;
// a straight line along +x, flat ground at 0
const LINE = { line: Array.from({ length: 121 }, (_, i) => [i, 0]), ground: () => 0 };

describe('the plan', () => {
  it('every gap is crossed by the move it teaches, on both templates, at every teaching and every verticality', () => {
    for (const R of [RF, RN]) for (const teach of TEACH) for (const verticality of Object.keys(VERTICALITY)) {
      const P = coursePlan(R, { teach, verticality, length: 120 });
      const bad = courseLaws(P, R).filter((l) => !l.holds);
      expect(bad, `${teach} ${verticality}`).toEqual([]);
    }
  });

  it('basic teaches the running jump; advanced each card move past it, the ones the card has, in order', () => {
    const B = coursePlan(RF, { teach: 'basic' });
    expect(B.gaps.length).toBeGreaterThan(2);
    expect(B.gaps.every((g) => g.teaches === 'run' && g.w < RF.moves.run.long)).toBe(true);
    const A = coursePlan(RF, { teach: 'advanced', length: 120 }), taught = [...new Set(A.gaps.filter((g) => g.teaches !== 'run').map((g) => g.teaches))];
    expect(taught).toEqual(advancedMoves(RF));
    expect(advancedMoves(RN)).not.toContain('air');
    // an advanced gap is past the running jump: the move is needed
    for (const g of A.gaps.filter((x) => x.teaches === 'dash')) expect(reachAt(RF.moves.run, g.dz)).toBeLessThan(g.w);
    // a feel with no advanced move says so
    const plain = reachOf(noAir);   // (its takes unwritten: no dash, no wall, and its card has no air jump)
    expect(courseLaws(coursePlan(plain, { teach: 'advanced' }), plain).find((l) => l.id === 'advanced').holds).toBe(false);
  });

  it('verticality: flat floors level, climbing each a step up, rolling up and down; meet and boss one long floor', () => {
    const z = (v) => coursePlan(RF, { teach: 'basic', verticality: v }).floors.map((f) => f.z);
    expect(new Set(z('flat'))).toEqual(new Set([0]));
    expect(z('climbing').every((v, i, a) => !i || v > a[i - 1])).toBe(true);
    const roll = z('rolling');
    expect(roll.some((v, i) => i && v < roll[i - 1])).toBe(true);
    expect(Math.max(...z('towering'))).toBeGreaterThan(Math.max(...z('climbing')));
    expect(coursePlan(RF, { teach: 'meet' }).floors.length).toBe(1);
    expect(() => coursePlan(RF, { teach: 'basic', length: 20 })).toThrow(/holds no basic course/);
  });

  it('reads as a level writes it: one course, or one a trail node; refusing what it is not', () => {
    expect(readCourse({ teach: 'basic' }, 'c')).toEqual({ teach: 'basic' });
    expect(readCourse({ a: { teach: 'meet' }, b: { teach: 'advanced', verticality: 'climbing' } }, 'c').b).toEqual({ teach: 'advanced', verticality: 'climbing' });
    expect(() => readCourse({ teach: 'parkour' }, 'c')).toThrow(/teach is one of/);
    expect(() => readCourse({ teach: 'basic', verticality: 'steep' }, 'c')).toThrow(/verticality is one of/);
  });
});

describe('the lowering, played', () => {
  const lowered = (P) => { const L = lowerCourse(P, LINE), S = standBlocks(L.blocks); return { L, S, ground: groundOf(S.colliders, 0) }; };

  it('the floors\' edges sit on the planned stations, the stairs climb to the course, each gap has its catch zone', () => {
    const P = coursePlan(RF, { teach: 'basic', length: 120 }), { L, S } = lowered(P);
    const tops = S.colliders.filter((c) => Math.abs(c.max[2] - L.base) < 1e-6);
    for (const g of P.gaps.filter((x) => x.dz === 0)) {
      const before = Math.max(...tops.filter((c) => c.max[0] <= g.s0 + 1e-6).map((c) => c.max[0]));
      const after = Math.min(...tops.filter((c) => c.min[0] >= g.s1 - 1e-6).map((c) => c.min[0]));
      expect(before).toBeCloseTo(g.s0, 6); expect(after).toBeCloseTo(g.s1, 6);
    }
    expect(L.base).toBeCloseTo(P.lift, 9);
    expect(L.events.sources.length).toBe(P.gaps.filter((g) => g.w > 0).length);
    expect(Math.min(...S.colliders.map((c) => c.max[2]))).toBeLessThan(0.3);   // the first stair is a step off the ground
  });

  it('the hero on the shipped rule crosses a basic gap with a running jump, and falls into it without one', () => {
    const P = coursePlan(RF, { teach: 'basic', verticality: 'flat', length: 120 }), { L, S, ground } = lowered(P), g = P.gaps[1];
    const play = (jumpAt) => {
      const w = createWorld({ colliders: S.colliders, entities: [{ id: 'hero', rule: { ...RF.rule, eye: 0 }, transform: { pos: [P.floors[1].s0 + 0.5, 0, L.base], heading: 0 } }] }), e = w.byId.hero;
      let jumped = false;
      for (let f = 0; f < 240; f++) { const x = e.transform.pos[0], press = jumpAt !== null && !jumped && x >= jumpAt; if (press) jumped = true; stepWorld(w, { forward: 1, jump: press, jumpHeld: press || (jumped && e.vel[2] > 0) }, DT, { ground }); if (e.grounded && x > g.s1 + 1) break; }
      return e.transform.pos;
    };
    const made = play(g.s0 - 0.4);
    expect(made[0]).toBeGreaterThan(g.s1); expect(made[2]).toBeCloseTo(L.base, 3);
    const missed = play(null);
    expect(missed[2]).toBeLessThan(L.base - 1);   // down in the gap (the page's catch zone puts it back)
  });
});

describe('in a gameworld', () => {
  const lv = Object.keys(MEADOWMARK_HERO.levels)[0];
  const W = { ...MEADOWMARK_HERO, feel: { pole: full, takes: true }, levels: { ...MEADOWMARK_HERO.levels, [lv]: { ...MEADOWMARK_HERO.levels[lv], course: { teach: 'basic', verticality: 'rolling' }, foes: { density: 'even' } } } };
  it('lays the course over the trail: its blocks, its catch zones, its laws, and the foes on its floors', () => {
    const G = readGameworld(W), st = gameStages(W).find((s) => s.level === lv && s.manifest.trail !== undefined);
    const O = stageLevelOrder(G, st, { ref: 'lv_0', heroRef: 'gw-hero' }), M = O.args.manifest;
    expect(O.course.teach).toBe('basic');
    expect(O.laws.filter((l) => l.id.startsWith('course:')).every((l) => l.holds)).toBe(true);
    expect(M.blocks.some((b) => b.blocks?.length > 10)).toBe(true);
    expect(M.events.sources.filter((s) => s.zone?.startsWith('__course-')).length).toBe(O.course.gaps.filter((g) => g.w > 0).length);
    // the stage's beats are the course's floors: its foes stand on them, up on the course
    expect(O.ends.beats.filter((b) => b.beat.startsWith('floor-')).length).toBe(O.course.floors.length);
    expect(() => readGameworld({ ...W, levels: { ...W.levels, [lv]: { ...W.levels[lv], course: { teach: 'parkour' } } } })).toThrow(/teach is one of/);
  });
});
