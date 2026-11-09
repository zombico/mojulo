import { describe, it, expect } from 'vitest';
import { brawlFighter, newReader, readButtons, BRAWL_STYLES, BRAWL_STYLE_IDS, DESPERATION } from './brawl-moves.js';
import { newBrawl, stepBrawl, brawlHash, grantState, BRAWL_RULES } from './brawl-core.js';
import { solveFighter } from '../versus/versus-solver.js';
import { SPECIALS, STATES } from '../versus/versus-library.js';

// THE BRAWLER'S MOVES, pressed as a player presses them (attack, jump, special and the stick, through the reader):
// the chain on a connect, its finisher to the floor, the jump kick and the stomp, the clinch's knees, throws and suplex,
// the desperation's price, a style's own chain and grabs, a power-up's blows.
const recipe = (archetype = 'all-rounder') => ({ ...solveFighter({ id: archetype, archetype }).recipe, archetype });
const P = brawlFighter(recipe());
const ctx = { fighters: [P] };
const body = (side, x, z = 0, o = {}) => ({ fighter: 0, side, x, z, ...o });
// a player's buttons per frame (fn(k) → { x, z, a, j, s }), the crowd left alone; → { s, ev, moves }
function play(s, n, fn, c = ctx) {
  let r = newReader();
  const ev = [], moves = [];
  for (let k = 0; k < n; k++) {
    const [pad, r2] = readButtons(r, fn(k, s) ?? {}, s.bodies[0], c.fighters[s.bodies[0].fi]);
    r = r2;
    s = stepBrawl(s, [pad], c);
    for (const e of s.events) ev.push([k, e]);
    const mv = s.bodies[0].mv;
    if (mv && moves[moves.length - 1] !== mv) moves.push(mv);
  }
  return { s, ev, moves };
}
// (attack pressed every `every` frames: a player keeping at it)
const mash = (every = 6, extra = {}) => (k) => ({ a: k % every === 0, ...extra });
const hitsOn = (ev, d) => ev.filter(([, e]) => e.t === 'hit' && e.d === d);

describe('brawl moves: the styles', () => {
  it('every archetype has a style; its chain ends in a knockdown, its finisher too', () => {
    for (const id of BRAWL_STYLE_IDS) {
      const F = brawlFighter(recipe(id));
      const n = BRAWL_STYLES[id].chain.length;
      expect(F.brawl.chain, id).toBe(n);
      expect(F.moves[`chain.${n}`].knock, id).toBe('down');
      expect(F.moves[`chain.${n}f`].knock, id).toBe('down');
      expect(F.moves[`chain.${n - 1}`].chain, id).toEqual([`chain.${n}`, `chain.${n}f`]);
      expect(F.moves.desperate.price, id).toBe(SPECIALS[DESPERATION].price);
    }
  });
  it('the rushdown\'s chain is longer and quicker to start; the grappler\'s grabs are the strongest', () => {
    const R = brawlFighter(recipe('rushdown')), G = brawlFighter(recipe('grappler'));
    expect(R.brawl.chain).toBeGreaterThan(G.brawl.chain);
    expect(R.moves['chain.1'].startup).toBeLessThan(G.moves['chain.1'].startup);
    for (const k of ['knee', 'suplex', 'throw']) expect(G.brawl[k], k).toBeGreaterThan(R.brawl[k]);
  });
});

describe('brawl moves: the chain', () => {
  it('each press on a connect throws the next; the last knocks down', () => {
    const out = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 700)] }), 120, mash());
    const n = P.brawl.chain;
    expect(out.moves.slice(0, n)).toEqual(Array.from({ length: n }, (_, k) => `chain.${k + 1}`));
    expect(hitsOn(out.ev, 1).length).toBe(n);
    expect(out.ev.some(([, e]) => e.t === 'land' && e.p === 1)).toBe(true);
  });
  it('a whiff ends it: out of reach, it is the first blow over and over', () => {
    const out = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 4000)] }), 120, mash());
    expect([...new Set(out.moves)]).toEqual(['chain.1']);
  });
  it('the stick toward the foe on the last press: the forward finisher', () => {
    const n = P.brawl.chain;
    // (the stick forward only once the chain is under way: from a stand, forward walks)
    const out = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 700)] }), 120, (k, s) => ({ a: k % 6 === 0, x: s.bodies[0].mv === `chain.${n - 1}` ? 1 : 0 }));
    expect(out.moves).toContain(`chain.${n}f`);
    expect(out.moves).not.toContain(`chain.${n}`);
  });
});

describe('brawl moves: in the air', () => {
  it('a jump straight up and attack: the stomp; a jump with a direction: the jump kick', () => {
    const up = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 3000)] }), 40, (k) => ({ j: k === 0, a: k === 12 }));
    expect(up.moves).toEqual(['air.M']);
    const on = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 3000)] }), 40, (k) => ({ j: k === 0, x: k < 6 ? 1 : 0, a: k === 12 }));
    expect(on.moves).toEqual(['air.H']);
  });
});

describe('brawl moves: the clinch', () => {
  const grabbed = (thug = body('crowd', 900), rest = []) => play(newBrawl(ctx, { bodies: [body('player', 0), thug, ...rest] }), 40, () => ({ x: 1 }));
  it('walking into a foe takes hold of it', () => {
    const g = grabbed();
    expect(g.ev.some(([, e]) => e.t === 'grab' && e.clinch && e.d === 1)).toBe(true);
    expect([g.s.bodies[0].st, g.s.bodies[1].st]).toEqual(['hold', 'held']);
  });
  it('attack knees it; the last knee knocks it down', () => {
    const g = grabbed();
    const out = play(g.s, 100, mash(8));
    const knees = out.ev.filter(([, e]) => e.t === 'hit' && e.kind === 'knee');
    expect(knees.length).toBe(BRAWL_RULES.knees);
    expect(knees[0][1].dmg).toBe(P.brawl.knee);
    expect(out.ev.some(([, e]) => e.t === 'land' && e.p === 1)).toBe(true);
  });
  it('the stick toward it and attack throws it, into the body behind', () => {
    const g = grabbed(body('crowd', 900), [body('crowd', 1500)]);
    const out = play(g.s, 60, (k) => ({ x: 1, a: k === 1 }));
    expect(out.ev.some(([, e]) => e.t === 'throw' && e.d === 1 && !e.back)).toBe(true);
    expect(out.ev.some(([, e]) => e.t === 'hit' && e.kind === 'flung' && e.d === 2)).toBe(true);
  });
  it('the stick away throws it behind', () => {
    const out = play(grabbed().s, 30, (k) => ({ x: -1, a: k === 1 }));
    expect(out.ev.some(([, e]) => e.t === 'throw' && e.back)).toBe(true);
    expect(out.s.bodies[1].x).toBeLessThan(out.s.bodies[0].x);
  });
  it('taken from behind, a throw is the suplex', () => {
    // (the thug walking into the floor's end, its back to the player, who walks into it)
    let s = newBrawl(ctx, { bodies: [body('player', 4400), body('crowd', 5600)] });
    let r = newReader();
    for (let k = 0; k < 60 && s.bodies[0].st !== 'hold'; k++) { const [pad, r2] = readButtons(r, { x: 1 }, s.bodies[0], P); r = r2; s = stepBrawl(s, [pad, { x: 1 }], ctx); }
    expect(s.bodies[0].st).toBe('hold');
    expect(s.bodies[0].back).toBe(1);
    const out = play(s, 40, (k) => ({ a: k === 1, x: 1 }));
    const sup = out.ev.find(([, e]) => e.t === 'throw' && e.kind === 'suplex');
    expect(sup).toBeTruthy();
    expect(out.s.bodies[1].hp).toBe(P.hp - P.brawl.suplex);
  });
  it('held long enough, the body breaks free', () => {
    const out = play(grabbed().s, BRAWL_RULES.hold + 10, () => ({}));
    expect(out.ev.some(([, e]) => e.t === 'free' && e.p === 1)).toBe(true);
    expect(out.s.bodies[1].st).not.toBe('held');
  });
});

describe('brawl moves: the desperation', () => {
  const D = P.moves.desperate;
  it('attack and jump together: it strikes the bodies either side, and costs its price once', () => {
    const out = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 650), body('crowd', -650)] }), 40, (k) => ({ a: k === 0, j: k === 0 }));
    expect(out.moves[0]).toBe('desperate');
    expect(hitsOn(out.ev, 1).length).toBe(1);
    expect(hitsOn(out.ev, 2).length).toBe(1);
    expect(out.s.bodies[0].hp).toBe(P.hp - D.price);
    expect(out.ev.some(([, e]) => e.t === 'land' && e.p === 1) && out.ev.some(([, e]) => e.t === 'land' && e.p === 2)).toBe(true);
  });
  it('a jump a frame before the attack is still the desperation, and no jump', () => {
    const out = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 4000)] }), 30, (k) => ({ j: k === 0, a: k === 1 }));
    expect(out.moves).toEqual(['desperate']);
    expect(out.s.bodies[0].hp).toBe(P.hp);   // (whiffed: nothing paid)
  });
  it('held, it breaks the hold', () => {
    // (the crowd's thug holds the player: the player walks nowhere, the thug into it)
    let s = newBrawl(ctx, { bodies: [body('player', 0, 0, { grabs: false }), body('crowd', 900)] });
    for (let k = 0; k < 40 && s.bodies[0].st !== 'held'; k++) s = stepBrawl(s, [{}, { x: -1 }], ctx);
    expect(s.bodies[0].st).toBe('held');
    const out = play(s, 30, (k) => ({ a: k === 0, j: k === 0 }));
    expect(out.moves[0]).toBe('desperate');
    expect(out.ev.some(([, e]) => e.t === 'hit' && e.p === 0 && e.d === 1)).toBe(true);
  });
});

describe('brawl moves: a power-up', () => {
  it('under power, the chain\'s first blow deals its state\'s share more; it runs out', () => {
    const first = (ist) => { const s = newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 700)] }); if (ist) grantState(s, 0, ist); return hitsOn(play(s, 20, (k) => ({ a: k === 0 })).ev, 1)[0][1].dmg; };
    expect(first('power')).toBe(Math.floor((first(null) * STATES.power.damage) / 100));
    const s = grantState(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 4000)] }), 0, 'power');
    expect(play(s, STATES.power.frames + 2, () => ({})).s.bodies[0].ist).toBeUndefined();
  });
});

describe('brawl moves: determinism', () => {
  it('the same buttons are the same brawl', () => {
    const run = () => brawlHash(play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 900), body('crowd', 1800, 300), body('crowd', -700)] }), 300, (k) => ({ x: k % 90 < 50 ? 1 : -1, z: k % 70 < 10 ? 1 : 0, a: k % 7 === 0, j: k % 97 === 40, s: k % 113 === 60 })).s);
    expect(run()).toBe(run());
  });
});

describe('brawl moves: a press kept', () => {
  it('a knee pressed just before the last ends is thrown as the body is free, once; pressed long before, it is not kept', () => {
    const s0 = play(newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 900)] }), 40, () => ({ x: 1 })).s;
    // (two presses two frames apart: the second while the first knee's hitstop holds)
    const out = play(s0, 40, (k) => ({ a: k === 0 || k === 3 }));
    expect(out.ev.filter(([, e]) => e.kind === 'knee').length).toBe(1);
    const late = play(s0, 40, (k) => ({ a: k === 0 || k === BRAWL_RULES.kneeStop + BRAWL_RULES.kneeFrames - 2 }));
    expect(late.ev.filter(([, e]) => e.kind === 'knee').length).toBe(2);
  });
});

describe('brawl moves: a press through the hitstop', () => {
  it('attack pressed once while the blow before holds its hitstop is kept, and the chain follows on', () => {
    const s = newBrawl(ctx, { bodies: [body('player', 0), body('crowd', 700)] });
    // (the first blow lands on frame 3; one press in the middle of its freeze, none after)
    const out = play(s, 60, (k) => ({ a: k === 0 || k === 6 }));
    expect(out.moves.slice(0, 2)).toEqual(['chain.1', 'chain.2']);
  });
});
