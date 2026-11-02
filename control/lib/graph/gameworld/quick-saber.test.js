// THE SABER GAME (quick goal `saber`): a quick world stands a hero with two sabers before lanes of note blocks, in a
// headset, to a club score whose beat the chart is written on; the chart plays on the bus, each note cut its way.
import { describe, it, expect } from 'vitest';
import { runSteps, readGameworld } from './index.js';
import { quickWorld, readQuick, saberPlan, SABER, SABER_MOODS } from './quick.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildBus } from '../worlds/event-bus.js';
import { resolveWorldAudio } from '../beats/beats-world.js';

const W = quickWorld({ id: 'saber', quick: { goal: 'saber' } });
const steps = runSteps(W, { ref: 'gw' });
const level = steps.find((s) => s.key.startsWith('level-'));
const M = level.order.manifest;
const notesOf = (m) => m.game.mechanics.find((x) => x.kind === 'notes');

describe('the saber game', () => {
  it('is played from the eye, in a headset, standing, the hero holding a red saber left and a blue right', () => {
    expect(W).toMatchObject({ camera: 'first-person', xr: { move: 'standing' }, intent: { from: 'saber-rhythm' } });
    expect(() => readGameworld(W)).not.toThrow();
    const hero = steps.find((s) => s.key === 'hero').order.spec;
    expect(hero.gear.right).toEqual({ item: 'sword', style: 'saber' });
    expect(hero.gear.left).toMatchObject({ item: 'sword', style: { id: 'saber-red', roles: { blade: ['neon', SABER.red] } } });
    // every level carries the headset, and its own words win: none, or seated
    expect(M.xr).toEqual({ move: 'standing' });
    expect(quickWorld({ id: 's', quick: { goal: 'saber', xr: false } }).xr).toBeUndefined();
    expect(quickWorld({ id: 's', quick: { goal: 'saber', xr: { move: 'seated' } } }).xr).toEqual({ move: 'seated' });
    // a hero of its own gear keeps it; none punches with the controllers
    expect(quickWorld({ id: 's', quick: { goal: 'saber', hero: { gear: { right: { item: 'dagger' } } } } }).quick.hero.gear.right).toEqual({ item: 'dagger' });
    expect(quickWorld({ id: 's', quick: { goal: 'saber', hero: false } }).quick.hero).toBe(false);
  });

  it('teaches what it takes: a club score with a steady beat, misses, first person, no trail of its own', () => {
    expect(() => readQuick({ goal: 'saber', music: 'rave', misses: 8 })).not.toThrow();
    expect(() => readQuick({ goal: 'saber', music: 'wayfarer' })).toThrow(new RegExp(`club score.*${SABER_MOODS[0]}`));
    expect(() => readQuick({ goal: 'saber', camera: 'third-person' })).toThrow(/first-person/);
    expect(() => readQuick({ goal: 'saber', climb: true })).toThrow(/stands the player before its lanes/);
    expect(() => readQuick({ goal: 'reach', misses: 3 })).toThrow(/rhythm and saber/);
    expect(() => readQuick({ goal: 'reach', xr: 'yes' })).toThrow(/\.xr is true/);
    // any goal is played in a headset when asked
    expect(quickWorld({ id: 'r', quick: { goal: 'reach', xr: true } }).xr).toBe(true);
  });

  it('the chart walks on the music: its beat the level\'s own, whatever the level\'s ref', () => {
    const N = notesOf(M);
    for (const ref of ['gw-level-a', 'another-ref']) {
      const B = resolveWorldAudio(M.audio, { ref }).beat;
      expect(N.every).toBe(B.every);
      expect(N.early).toBe(B.lead);
    }
    expect(M.audio).toMatchObject({ beat: true, soundtrack: { score: { mood: 'drive', style: 'club' } } });
    expect(N.chart).toHaveLength(SABER.notes);
    expect(M.game.mechanics.find((x) => x.kind === 'score')).toMatchObject({ points: [{ on: 'note:hit' }] });
  });

  it('the lanes run in toward the player, to a cutting line ahead of it; the left hand\'s on its left', () => {
    const N = notesOf(M), hero = M.entities.find((e) => e.pilotable) ?? M.entities[0];
    const s = hero.transform.pos, h = hero.transform.heading, f = [Math.cos(h), Math.sin(h)], rt = [Math.sin(h), -Math.cos(h)];
    for (const [id, L] of Object.entries(N.lanes)) {
      const ahead = (p) => (p[0] - s[0]) * f[0] + (p[1] - s[1]) * f[1], right = (p) => (p[0] - s[0]) * rt[0] + (p[1] - s[1]) * rt[1];
      expect(ahead(L.to)).toBeCloseTo(SABER.line, 2);
      expect(ahead(L.from)).toBeCloseTo(SABER.line + SABER.run, 2);
      const hand = N.chart.find((n) => n.lane === id).hand;
      expect(Math.sign(right(L.to))).toBe(hand === 'left' ? -1 : 1);
    }
  });

  it('every lane\'s pool is a sleeping, hittable block wearing its arrow in its hand\'s colour, enough for its notes', () => {
    const N = notesOf(M), pools = Object.values(N.lanes).flatMap((L) => L.pool);
    const blocks = M.entities.filter((e) => pools.includes(e.id));
    expect(blocks).toHaveLength(pools.length);
    for (const [id, L] of Object.entries(N.lanes)) {
      const n = N.chart.find((c) => c.lane === id);
      for (const b of blocks.filter((e) => L.pool.includes(e.id))) {
        expect(b).toMatchObject({ dormant: true, body: { type: 'glyph', form: `note-${n.dir}`, tint: n.hand === 'left' ? SABER.red : SABER.blue, hittable: true } });
        expect(b.body.collide).toBeUndefined();   // solid to nothing: it rides through the player
      }
    }
    // the mechanic takes the chart on these pools (a pool too small would be refused)
    expect(() => composeMechanics(M.game.mechanics, { player: 'hero', spawn: [0, 0, 0] })).not.toThrow();
  });

  it('played on the bus: every note cut its arrow\'s way with its hand is scored, and the level is won', () => {
    const c = composeMechanics(M.game.mechanics, { player: 'hero', spawn: [0, 0, 0] }), B = buildBus();
    const s = B.createBusState(c.events, c.events.entities), ops = [];
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } ops.push(...(s._ctrlOps || [])); s._ctrlOps = []; };
    pump(c.events.initial || []);
    const N = notesOf(M), last = Math.max(...N.chart.map((n) => n.beat));
    // each note's block: its lane's pool in turn (the mechanic's order: by beat, then as charted)
    const turn = {}, blockOf = new Map();
    for (const note of N.chart.map((x, k) => ({ ...x, k })).sort((a, b) => a.beat - b.beat || a.k - b.k)) {
      const P = N.lanes[note.lane].pool, j = (turn[note.lane] = (turn[note.lane] ?? -1) + 1);
      blockOf.set(note.k, P[j % P.length]);
    }
    for (let n = 0; n <= last; n++) {
      pump([{ type: 'beat', n }]);
      // the notes on the line this beat, each cut its way with its hand
      N.chart.forEach((note, k) => {
        if (note.beat !== n) return;
        expect(ops.some((o) => o.op === 'spawn' && o.who === blockOf.get(k))).toBe(true);
        pump([{ type: 'cut', entity: blockOf.get(k), dir: note.dir === 'any' ? 'down' : note.dir, hand: note.hand === 'left' ? 'L' : 'R', kind: 'blade', by: 'hero' }]);
      });
    }
    expect(s.log.filter((r) => r.type === 'note:hit')).toHaveLength(SABER.notes);
    expect(s.log.map((r) => r.type)).toContain('notes:done');
    expect(c.on['notes:done']).toEqual({ end: 'success' });
  });

  it('the plan is the stage\'s own: the same stage, the same chart', () => {
    const ends = { spawn: [3, -2, 1], heading: 0.4 };
    expect(JSON.stringify(saberPlan({ goal: 'saber' }, ends))).toBe(JSON.stringify(saberPlan({ goal: 'saber' }, ends)));
    expect(JSON.stringify(saberPlan({ goal: 'saber' }, ends).chart)).not.toBe(JSON.stringify(saberPlan({ goal: 'saber' }, { ...ends, spawn: [9, 9, 1] }).chart));
  });
});
