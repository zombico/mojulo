import { describe, it, expect } from 'vitest';
import { yardSpec, yardOf, yardHud, inputRun, YARD_SETTINGS } from './brawl-yard.js';
import { practiceOf, stepYard, yardRead } from './brawl-practice.js';
import { brawlPreset } from './brawl-levels.js';
import { solveFighter } from '../versus/versus-solver.js';
import { manaUi } from '../../mana-ui/kernel.js';
import { withIdioms } from '../../mana-ui/idioms.js';

// THE YARD'S SCREEN: mana-ui over the practice room in the brawler's look; the room's readouts turned into what it reads.
const { belt } = brawlPreset('yard');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const project = (x, z, y) => [x / 24000, 0.5 + z / 10000 - y / 4000];
const near = () => { const r = practiceOf({ belt, players: [{ recipe }], dummies: [{ mode: 'stand' }, { mode: 'stand', n: 2 }] }); r.s.bodies[1].x = r.s.bodies[0].x + 700; r.s.bodies[1].z = r.s.bodies[0].z; r.yard.homes[1] = [r.s.bodies[1].x, r.s.bodies[1].z]; return r; };
const run = (r, n, fn) => { for (let k = 0; k < n; k++) r = stepYard(r, [fn(k, r)]); return r; };

describe('brawl yard: its screen', () => {
  it('the brawler\'s own shelf and look, never the fight\'s training', () => {
    const Y = yardOf();
    expect(Y.theme).toBe('brawl-yard');
    expect(Object.keys(Y.spec.defs)).toEqual(expect.arrayContaining(['line-marks', 'chain-beats', 'press-log', 'clinch-meter', 'token-marks']));
    expect(Object.keys(Y.spec.defs)).not.toContain('frame-meter');
    expect(YARD_SETTINGS.every((f) => f.var.startsWith('brawl.practice.set.'))).toBe(true);
  });
  it('draws the room as it stands: a mark at each dummy\'s feet, the chain\'s blows, the presses', () => {
    let r = near();
    r = run(r, 30, (k) => ({ a: k === 0 || k === 6 }));
    const F = r.ctx.fighters[0], hud = yardHud(yardRead(r), F, project);
    expect(hud.marks.map((m) => m.kind)).toEqual(['heal', 'miss']);
    expect(hud.marks[1].text).toMatch(/CM/);
    expect(hud.beats.length).toBe(F.brawl.chain);
    expect(hud.beats.filter((x) => x.variant === 'strong').length).toBeGreaterThan(0);
    expect(hud.presses[0]).toMatchObject({ press: 'A', kind: 'heal' });
    const state = { brawl: { practice: { ...hud, set: { marks: true, log: true }, moves: [], settings: YARD_SETTINGS } } };
    const rt = manaUi.runtime(withIdioms(yardSpec()), { read: (p) => manaUi.readPath(state, p) });
    const html = rt.view();
    expect(html).toContain('LINED');
    expect(html).toContain('mana-anchors');
  });
  it('the input strip: a run grows while held, a new one starts on a change, ten at most', () => {
    let runs = [];
    for (let k = 0; k < 5; k++) runs = inputRun(runs, { x: 1 });
    runs = inputRun(runs, { x: 1, a: true });
    expect(runs.map((x) => x.text)).toEqual(['→ (5f)', '→ + A']);
    for (let k = 0; k < 30; k++) runs = inputRun(runs, { a: k % 2 === 0 });
    expect(runs.length).toBe(10);
  });
});
