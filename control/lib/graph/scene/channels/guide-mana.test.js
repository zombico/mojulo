// THE GUIDE ON MANA-UI: a guide that asks for it, on a page with a mana HUD, is drawn by the game UI runtime (a compass,
// the objective, a lesson's keys as caps, what is said as a card, the keys that work now); the guide's own line and the
// level's line of key words stand down. A guide that does not ask, or a page with no mana HUD, is as it was.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { emitThreeWorld } from '../scene-three.js';
import { guideManaSpec, guideManaScript, keyRows } from './guide-mana.js';
import { guideScript } from './guide.js';
import { manaUi } from '../../../mana-ui/kernel.js';

const quad = { corners: [[-9, -9, 0], [9, -9, 0], [9, 9, 0], [-9, 9, 0]], normal: [0, 0, 1], fill: '#777777', group: 'ground' };
const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } };
const events = { hud: [{ text: 'W / S  run · E  car' }, { var: 'coins', label: 'coins', as: 'counter', slot: 'top-right' }], reactions: [{ on: 'x', do: 'inc', var: 'coins', by: 1 }], vars: { coins: 0 } };
const guide = { intro: 'Open city.', lessons: [{ keys: 'W A S D  walk', fact: 'move' }], steps: [{ id: 'car', say: 'Get into a car', kind: 'find', at: [3, 0, 0], radius: 3, cab: true }], done: 'The city is open' };
const manaHud = { rows: 'events', theme: 'console' };
const parses = (html) => { const src = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n'); try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); return null; } catch (e) { return String(e.stderr || e.message).slice(0, 300); } };

describe('the guide on mana-ui', () => {
  it('a key line is rows of key caps and what they do', () => {
    expect(keyRows('W A S D  walk')).toEqual([{ actions: ['W', 'A', 'S', 'D'], label: 'walk' }]);
    expect(keyRows('E  get into a car · E  get out when stopped')).toEqual([{ action: 'E', label: 'get into a car' }, { action: 'E', label: 'get out when stopped' }]);
    expect(keyRows('no keys here')).toEqual([]);
  });
  it('draws the compass, the objective, a lesson\'s keys and the keys that work now, in the theme\'s look', () => {
    const spec = guideManaSpec();
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    const S = { guide: { heading: 90, markers: [{ bearing: 120, kind: 'goal' }], objective: 'Pick up the fee · 320 m', finding: true, teaching: true, lesson: keyRows('W  drive · S  brake'), lessonAt: '3 / 3', cards: [], keys: [{ actions: ['W', 'A', 'S', 'D'], label: 'Move' }, { action: 'M', label: 'Map' }] } };
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(S, p), act() {}, now: () => 0 });
    rt.input('keys');
    const html = rt.view();
    for (const s of ['mana-compass', 'Pick up the fee · 320 m', '3 / 3', '>W<', 'drive', 'Move', '>M<', 'Map']) expect(html).toContain(s);
    // (nothing to find and nothing taught: no compass, no lesson)
    S.guide = { ...S.guide, finding: false, teaching: false, objective: '' };
    rt.tick();
    const quiet = rt.view();
    expect(quiet).not.toContain('mana-compass'); expect(quiet).not.toContain('3 / 3');
  });
  it('the keys step away once said; a car taken is named large, then gone; the objective is an order with its mark', () => {
    const spec = guideManaSpec(), S = { guide: { heading: 0, markers: [], objective: 'Pick up the fee · 320 m', finding: false, teaching: false, lesson: [], lessonAt: '', cards: [], keys: [{ action: 'E', label: 'Get in' }], rest: false, ride: { on: false, name: '', sub: '' } } };
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(S, p), act() {}, now: () => 0 });
    rt.input('keys');
    expect(rt.view()).toContain('Get in');
    expect(rt.view()).toMatch(/◆<\/span><span[^>]*>Pick up the fee · 320 m/);
    S.guide = { ...S.guide, rest: true, ride: { on: true, name: 'Mid SUV', sub: '' } };
    rt.tick();
    const v = rt.view();
    expect(v).not.toContain('Get in');
    expect(v).toMatch(/data-at="bottom-right".*data-role="display"[^>]*>Mid SUV</s);
  });
  it('is on the page only where the guide asks and the HUD is mana\'s; there the guide\'s line and the level\'s key words stand down', () => {
    const asked = emitThreeWorld({ faces: [quad], entities: [hero], events, manaHud, guide: { ...guide, mana: true } });
    for (const s of ['__mojGuideMana', 'window.__mojGuideHost', 'window.__mojMana']) expect(asked).toContain(s);
    expect(asked.split('function buildManaUi').length - 1).toBe(1);
    // (the level's own line of key words is not handed to the HUD: the guide's keys say them)
    expect(asked.split('W / S  run · E  car').length - 1).toBeLessThan(emitThreeWorld({ faces: [quad], entities: [hero], events, manaHud, guide }).split('W / S  run · E  car').length - 1);
    expect(parses(asked)).toBe(null);
    for (const page of [emitThreeWorld({ faces: [quad], entities: [hero], events, manaHud, guide }), emitThreeWorld({ faces: [quad], entities: [hero], events, guide: { ...guide, mana: true } })]) {
      expect(page).not.toContain('__mojGuideMana'); expect(page).not.toContain('__mojGuideHost');
    }
    // (the guide's script, unasked, is as it was)
    expect(guideScript(guide)).toBe(guideScript(guide, {}));
    expect(guideScript(guide)).not.toContain('__mojGuideHost');
    expect(guideManaScript('console')).toContain('function buildManaUi');
    expect(guideManaScript('console', { shared: 'window.__mojMana' })).not.toContain('function buildManaUi');
  });
});
