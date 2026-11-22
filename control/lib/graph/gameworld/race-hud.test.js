import { describe, expect, it } from 'vitest';
import { raceHud, raceMap, RACE_HUD_STATE, RACE_LOOKS, ROUTE } from './race-hud.js';
import { manaUi, readTheme } from '../../mana-ui/index.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { manaHudScript } from '../scene/channels/mana-hud.js';

// THE RACE'S HUD: a race on a roadway read at a glance, one composition on mana-ui, hosted by the level page.
const LOOP = Array.from({ length: 80 }, (_, i) => { const t = (i / 80) * 2 * Math.PI; return [120 * Math.cos(t), 60 * Math.sin(t)]; });
const draw = (H, state, open, frame) => { const rt = manaUi.runtime(H.spec, { read: (p) => manaUi.readPath(state, p), act() {}, now: () => 1, ...(frame ? { frame } : {}) }); if (open) rt.open(open); return rt.view(); };
const drawn = (H, frame) => [...draw(H, RACE_HUD_STATE, null, frame).matchAll(/class="mana-region" data-at="([a-z-]+)"/g)].map((m) => m[1]).sort();
const TALL = { w: 450, h: 800 }, WIDE = { w: 1120, h: 780 };

describe('the race\'s HUD', () => {
  it('reads as a mana-ui spec and draws the race on its state: the place, the lap of the laps, the times, the speed', () => {
    const H = raceHud({ mech: 2, laps: 3, racers: 6, outline: LOOP });
    const v = draw(H, RACE_HUD_STATE);
    for (const said of ['2nd', '/ 6', '2/3', 'km/h']) expect(v).toContain(said);
    expect(H.feed).toMatchObject({ kind: 'race', mech: 2, laps: 3, racers: 6 });
  });
  it('keeps the bottom third the kart\'s but for the dial in its corner; a tall frame is one plate at the top, no map', () => {
    const H = raceHud({ laps: 3, racers: 4, outline: LOOP });
    expect(drawn(H, WIDE)).toEqual(['bottom-right', 'center', 'right', 'top-left', 'top-right']);
    expect(drawn(H, TALL)).toEqual(['bottom-right', 'center', 'top']);
  });
  it('says only what a race has: no place alone, no lap counter for one lap, no map without a line', () => {
    const solo = raceHud({ laps: 1, racers: 1 });
    expect(drawn(solo, WIDE)).toEqual(['bottom-right', 'center', 'top-right']);
    expect(draw(solo, RACE_HUD_STATE)).not.toContain('2/3');
  });
  it('the lights are a screen over the play, said as marks: the karts held while it stands', () => {
    const H = raceHud({ laps: 3, racers: 2 });
    expect(H.spec.screens.ready.props).toMatchObject({ layer: 'overlay', place: 'center', legend: 'none' });
    expect(draw(H, RACE_HUD_STATE, 'ready')).toContain('● ● ● ○ ○');
    expect(H.feed.lights.count).toBe(5);
  });
  it('the map is the track\'s own line, inside the map\'s square, north up, the same each time', () => {
    const M = raceMap(LOOP);
    expect(M.route.length).toBeLessThanOrEqual(ROUTE.dots);
    for (const q of M.route) { expect(q.x).toBeGreaterThanOrEqual(0); expect(q.x).toBeLessThanOrEqual(1); expect(q.y).toBeGreaterThanOrEqual(0); expect(q.y).toBeLessThanOrEqual(1); }
    // the whole lap, north up: the line's furthest north is the map's top, its furthest east the map's right
    expect(M.route.length).toBe(ROUTE.dots);
    expect(Math.min(...M.route.map((q) => q.y))).toBeCloseTo(raceMap([[0, 60], [120, 0], [0, -60], [-120, 0]]).route[0].y, 2);
    expect(Math.max(...M.route.map((q) => q.x))).toBeGreaterThan(0.85);
    expect(JSON.stringify(raceMap(LOOP))).toBe(JSON.stringify(M));
    expect(raceMap(null)).toBeNull();
  });
  it('wears its track\'s look: candy a toy look, a circuit the timing tower\'s; a game\'s own theme wins', () => {
    expect(RACE_LOOKS.candy).toBe('kart-candy'); expect(RACE_LOOKS.circuit).toBe('pit-wall');
    expect(raceHud({ language: 'candy' }).theme).toEqual(cardTheme('kart-candy'));
    expect(raceHud({ cls: 'circuit' }).theme).toEqual(cardTheme('pit-wall'));
    expect(raceHud({ language: 'candy' }, { theme: 'console' }).theme).toBe('console');
    for (const id of ['kart-candy', 'pit-wall']) expect(() => readTheme(cardTheme(id))).not.toThrow();
  });
});

describe('the page that hosts it', () => {
  it('carries the race\'s feed only on a race: a runner\'s HUD carries none of it', () => {
    const race = manaHudScript(raceHud({ laps: 3, racers: 2, outline: LOOP })), course = manaHudScript({ spec: { hud: { use: 'hud', children: [] } }, feed: { kind: 'course', from: 0, to: 40 } });
    expect(race).toContain('RACE.lights'); expect(race).toContain('__mojFreeze');
    expect(course).not.toContain('RACE');
  });
});
