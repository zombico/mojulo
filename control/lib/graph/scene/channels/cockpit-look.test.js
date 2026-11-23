import { describe, expect, it } from 'vitest';

import { COCKPIT_COLOURS, COCKPIT_THEME, COCKPIT_ALERTS, PLACARDS, cockpitAlerts, keyOnPanel, panelPaint } from './cockpit-look.js';
import { cockpitHudScript, CHASE_SLOTS } from './cockpit-hud.js';
import { COCKPITS } from '../../skyscape/cockpits.js';
import { readTheme } from '../../../mana-ui/theme.js';

// ── the cockpit's look (cockpit-look.js): a dark cockpit, one code, luminance in steps, a panel that is a thing ───────
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = rgb(h).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const hue = (h) => { const [r, g, b] = rgb(h), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (!d) return null; const x = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
const apart = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

describe('the cockpit\'s look', () => {
  it('one code: each meaning its own hue, the target\'s far from every other and from the space it is seen in', () => {
    const C = COCKPIT_COLOURS, meanings = ['normal', 'friend', 'target', 'caution', 'warning', 'shields'];
    for (let i = 0; i < meanings.length; i++) for (let j = i + 1; j < meanings.length; j++) expect(apart(hue(C[meanings[i]]), hue(C[meanings[j]])), `${meanings[i]} / ${meanings[j]}`).toBeGreaterThan(20);
    // (magenta: no star, bolt or fire is; the bolts red and green, the fire orange)
    for (const other of ['#ff3b2e', '#5cff6a', '#ffa03c']) expect(apart(hue(C.target), hue(other))).toBeGreaterThan(45);
    // a hostile is a warning's red: both are danger
    expect(apart(hue(C.hostile), hue(C.warning))).toBeLessThan(15);
  });

  it('luminance in steps: the glass dark, a label under its figure, every reading clear of the glass', () => {
    const C = COCKPIT_COLOURS, glass = lum(C.glass), ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    expect(lum(C.label)).toBeLessThan(lum(C.normal));
    expect(lum(C.normal)).toBeLessThan(lum(C.figure));
    expect(lum(C.label) / lum(C.figure)).toBeLessThan(0.5);
    // (a label still reads on the glass, a figure reads at a glance: WCAG's 4.5 and 7)
    expect(ratio(lum(C.label), glass)).toBeGreaterThan(4.5);
    expect(ratio(lum(C.figure), glass)).toBeGreaterThan(7);
  });

  it('the instruments\' theme is the terminal\'s, its tokens the code\'s, its bars solid', () => {
    const T = readTheme(COCKPIT_THEME);
    expect(T.tokens.accent2).toBe(COCKPIT_COLOURS.target);
    expect(T.tokens.harm).toBe(COCKPIT_COLOURS.warning);
    expect(T.tokens.shield).toBe(COCKPIT_COLOURS.shields);
    expect(T.fills).toBe('solid');
  });

  it('the alerts: nothing when all is well; a pool low a caution; a shield down or the hull at a quarter a warning', () => {
    const L = COCKPIT_ALERTS;
    expect(cockpitAlerts({ hull: 1, shields: [1, 1], lasers: 1 }, L)).toEqual({ caution: [], warning: [] });
    expect(cockpitAlerts({ hull: 0.4, shields: [0.2, 1], lasers: 0.1 }, L)).toEqual({ caution: ['hull', 'shields', 'lasers'], warning: [] });
    expect(cockpitAlerts({ hull: 0.2, shields: [0, 1], lasers: 1 }, L)).toEqual({ caution: [], warning: ['hull', 'shields'] });
    // a craft without shields or cannons' charge: only its hull
    expect(cockpitAlerts({ hull: 0.9, shields: null, lasers: null }, L)).toEqual({ caution: [], warning: [] });
  });

  it('the star lights the panel from above: full overhead, none from under the craft, a roll turns it away', () => {
    const f = [1, 0, 0], u = [0, 0, 1];
    expect(keyOnPanel([0, 0, 1], f, u)).toBeGreaterThan(0.9);
    expect(keyOnPanel([0, 0, -1], f, u)).toBe(0);
    expect(keyOnPanel([0, 0, 1], f, [0, 1, 0])).toBe(0);                      // rolled on its side
    expect(keyOnPanel(null, f, u)).toBe(0);
  });

  it('each cockpit\'s panel its own paint, its metal read off it; each screen its placard', () => {
    const paints = new Set(Object.values(COCKPITS).map((c) => c.panel.paint));
    expect(paints.size).toBe(Object.keys(COCKPITS).length);
    const P = panelPaint(COCKPITS.strikeFoil), D = panelPaint(COCKPITS.twinPanel);
    expect(lum(P.lit)).toBeGreaterThan(lum(P.paint));
    expect(lum(P.shade)).toBeLessThan(lum(P.paint));
    expect(lum(D.paint)).toBeLessThan(lum(P.paint));                       // the other side's near black
    expect(Object.keys(PLACARDS).sort()).toEqual(Object.keys(CHASE_SLOTS).sort());
  });

  it('the page carries the code, the lamps and the placards; the alerts and the star\'s light run on it', () => {
    const s = cockpitHudScript({ cockpit: 'heavyFighter' });
    for (const w of ['MASTER CAUTION', 'MASTER WARNING', '--ck-target:' + COCKPIT_COLOURS.target, '__ckAlerts', '__ckKey', 'ckKey', PLACARDS.computer, COCKPITS.heavyFighter.panel.paint]) expect(s, w).toContain(w);
  });
});
