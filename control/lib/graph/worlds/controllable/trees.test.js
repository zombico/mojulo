import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE HERO'S TREES (trees.js): one purse of points earned by what is held, a node bought once what it requires is
// learned and the purse holds its cost, a found node given as its power is held; a move's patch laid on the rule by its
// paths, a tech's string opened in the moveset (a shut string's beats cut from what the hero plays); a page without trees
// carries none of it.

const E = composeLive();
const MOVESET = {
  moves: { a: { swing: 'neutral' }, thrust: { swing: 'forward' }, cleave: { swing: 'back' } },
  tree: { L: { move: 'a', combos: ['own', 'tech:cleave'], next: { H: { move: 'cleave', combos: ['tech:cleave'] } } }, H: { move: 'thrust', combos: ['tech:thrust'] } },
  specials: {}, gated: { 'tech:thrust': true, 'tech:cleave': true },
};
const SPEC = {
  target: 'hero', points: { boss: 1, prize: 1 }, trees: [{ id: 'movement', name: 'Skills' }, { id: 'techs', name: 'Techs' }],
  nodes: [
    { id: 'double-jump', tree: 'movement', name: 'Second leap', requires: [], cost: 0, found: 'gate:double-jump', patch: { airJumps: 1 } },
    { id: 'triple-jump', tree: 'movement', name: 'Third leap', requires: ['double-jump'], cost: 2, patch: { airJumps: 2 } },
    { id: 'air-dash', tree: 'movement', name: 'Wing dash', requires: [], cost: 1, patch: { 'dash.air.count': 2 } },
    { id: 'thrust', tree: 'techs', name: 'Thrust', requires: [], cost: 1, combos: ['tech:thrust'] },
    { id: 'cleave', tree: 'techs', name: 'Cleave', requires: ['thrust'], cost: 1, combos: ['tech:cleave'] },
  ],
};
const world = (held = {}) => {
  const w = E.createWorld({ heldGates: { target: 'hero' }, trees: SPEC,
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7, dash: { speed: 10, air: { count: 1, speed: 10 } }, moveset: MOVESET }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
  Object.assign(w.heldGates.held, held);
  return w;
};
const step = (w, n = 1) => { for (let k = 0; k < n; k++) E.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); return w; };

describe('the hero\'s trees', () => {
  it('earn one purse from what is held, and buy a node once what it requires is learned and the purse holds it', () => {
    const w = world();
    expect(w.trees.points()).toBe(0);
    expect(w.trees.learn('thrust')).toEqual({ ok: false, why: 'costs 1 of 0' });
    Object.assign(w.heldGates.held, { 'boss:a': 1, 'prize:x:0': 2 });
    expect(w.trees.points()).toBe(2);
    expect(w.trees.learn('cleave').why).toBe('needs thrust');
    expect(w.trees.learn('thrust')).toEqual({ ok: true });
    expect(w.trees.learn('thrust').why).toBe('learned already');
    expect(w.trees.points()).toBe(1);
    expect(w.trees.states().find((n) => n.id === 'cleave').state).toBe('available');
  });

  it('give a found node as its power is held, never for points, and lay a move\'s patch on the rule by its paths', () => {
    const w = world({ 'boss:a': 1, 'boss:b': 1, 'boss:c': 1 }), H = w.byId.hero;
    expect(w.trees.learn('double-jump').why).toBe('given by a power found');
    expect(w.trees.learn('triple-jump').why).toBe('needs double-jump');
    w.heldGates.held['gate:double-jump'] = 0;
    step(w);
    expect(w.trees.learned['double-jump']).toBeDefined();
    expect(H.rule.airJumps).toBe(1);
    expect(w.trees.learn('triple-jump').ok).toBe(true);
    expect(H.rule.airJumps).toBe(2);
    // (a path in the rule: the air dash's count turned, the dash's other numbers kept)
    expect(w.trees.learn('air-dash').ok).toBe(true);
    expect(H.rule.dash).toEqual({ speed: 10, air: { count: 2, speed: 10 } });
  });

  it('cut a shut string\'s beats from what the hero plays, a beat its own string shares kept, and open each as it is learned', () => {
    const w = world({ 'boss:a': 1, 'boss:b': 1 }), M = () => w.byId.hero.rule.moveset;
    expect(Object.keys(M().tree)).toEqual(['L']);
    expect(M().tree.L.next).toEqual({});
    w.trees.learn('thrust');
    expect(Object.keys(M().tree)).toEqual(['L', 'H']);
    w.trees.learn('cleave');
    expect(Object.keys(M().tree.L.next)).toEqual(['H']);
  });

  it('is in a page only when its world has trees', () => {
    expect(emissionSource({ trees: true })).toContain('createWithTrees');
    expect(emissionSource({})).not.toContain('createWithTrees');
  });
});
