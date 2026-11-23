import { describe, expect, it } from 'vitest';

import { COCKPITS, cockpitOf, canopyFrame, frameCover, PANEL_HEIGHT, FRAME_COVER_MAX } from './cockpits.js';
import { starfighterPilot, cockpitCamera } from './starfighter.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';

// ── the cockpits (skyscape/cockpits.js): a craft's tuning and the cockpit it is flown from ─────────────────────────────
// Each card a craft of the shelf, its tuning told apart (the speed one fastest and quickest to turn, the firepower one
// the most hull, cannons and warheads); its canopy's frame read off the shelf's own canopy and seen from the seat; its
// panel over the screen's foot.

const map = { craft: { max: 160, cruise: 100 } };
const pilotOf = (a) => starfighterPilot(map, { id: 'player', pilotable: true, rule: {}, body: { type: 'mesh' }, transform: { pos: [0, 0, 0], heading: 0 } }, { airframe: a });

describe('the cockpits', () => {
  it('are craft of the shelf, each tuned as it says: speed the fastest and quickest, firepower the heaviest', () => {
    for (const id of Object.keys(COCKPITS)) expect(CRAFT_ARCHETYPES[id], id).toBeTruthy();
    const by = Object.fromEntries(Object.entries(COCKPITS).map(([id, C]) => [C.tuning === 'general' && id !== 'strikeFoil' ? 'other' : C.tuning, pilotOf(id)]));
    expect(by.speed.rule.speed).toBeGreaterThan(by.general.rule.speed);
    expect(by.speed.rule.rollRate).toBeGreaterThan(by.general.rule.rollRate);
    expect(by.firepower.rule.speed).toBeLessThan(by.general.rule.speed);
    expect(by.firepower.body.hp).toBeGreaterThan(by.general.body.hp);
    expect(by.firepower.weapon.damage).toBeGreaterThan(by.general.weapon.damage);
    expect(by.firepower.body.ship.shields.max).toBeGreaterThan(by.speed.body.ship.shields.max);
    // the other side's craft flies without shields, its cannons linked one or two
    expect(by.other.body.ship.shields).toBeUndefined();
    expect(by.other.body.ship.lasers.links).toEqual([1, 2]);
    // a craft with no card flies the general one's; the camera names the cockpit it is
    expect(cockpitOf('podSpine')).toBe(COCKPITS.strikeFoil);
    expect(cockpitCamera(pilotOf('heavyFighter'), { rule: 'follow' }, 'heavyFighter').cockpit).toBe('heavyFighter');
    expect(cockpitCamera(pilotOf('podSpine'), { rule: 'follow' }, 'podSpine').cockpit).toBe('strikeFoil');
  });

  it('a bubble canopy\'s frame is the shelf\'s own, seen from the seat: its sills, the edges its card frames, its hoops ahead', () => {
    const F = canopyFrame('strikeFoil'), bars = F.bars.filter((b) => !b.sill);
    expect(F.fill).toBe('bubble');
    expect(F.bars.filter((b) => b.sill)).toHaveLength(2);
    // two shoulder posts and the one hoop the card frames, each running ahead of the eye
    expect(bars).toHaveLength(3);
    for (const b of bars) expect(Math.max(...b.pts.map((p) => p[2]))).toBeGreaterThan(0.5);
    // the hoop ahead is overhead: its top above the eye
    expect(Math.max(...bars[2].pts.map((p) => p[1]))).toBeGreaterThan(0);
    // the heavy one framed more, its bars thicker
    const H = canopyFrame('heavyFighter').bars.filter((b) => !b.sill);
    expect(H.length).toBeGreaterThan(bars.length);
    expect(H[0].r).toBeGreaterThan(bars[0].r);
  });

  it('a round window is its rim and its spokes ahead of the eye, the shelf\'s count of them', () => {
    const F = canopyFrame('twinPanel');
    expect(F.fill).toBe('round');
    expect(F.window.z).toBeGreaterThan(0);
    expect(F.bars.length).toBe(2 + 8);
    expect(F.window.hub).toBeLessThan(F.window.r / 3);
  });

  it('no frame hides much of the view it is flown by', () => {
    for (const id of Object.keys(COCKPITS)) {
      const c = frameCover(id);
      expect(c, id).toBeGreaterThan(0.03);                       // a frame there is, all the same
      expect(c, id).toBeLessThan(FRAME_COVER_MAX);
    }
  });

  it('each panel takes the screen\'s foot, its instruments inside it', () => {
    for (const [id, C] of Object.entries(COCKPITS)) {
      expect(C.panel.height, id).toBe(PANEL_HEIGHT);
      const topMost = Math.min(...C.panel.top.map(([, y]) => y));
      expect(1 - topMost, id).toBeGreaterThan(PANEL_HEIGHT - 0.05);
      expect(1 - topMost, id).toBeLessThan(PANEL_HEIGHT + 0.05);
      for (const [k, [x0, y0, x1, y1]] of Object.entries(C.panel.slots)) {
        expect(x0 < x1 && y0 < y1 && x0 >= 0 && x1 <= 1 && y1 <= 1, `${id}.${k}`).toBe(true);
        expect(y0, `${id}.${k} sits in the panel`).toBeGreaterThan(topMost - 0.01);
      }
    }
  });
});
