import { describe, expect, it } from 'vitest';

import { buildCapital, buildStation, placeFleet } from './build.js';
import { CAPITAL_CLASSES, STATION_KINDS } from './classes.js';
import { FLEET_LOOKS, ROLES } from './language.js';

// ── the fleet (fleet/): capital ships and stations as pieces each a block of matter, drawn in the fleet's language ────
const overlap = (a, b) => [0, 1, 2].every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 1e-3);
const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (!d) return null; const x = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (x * 60 + 360) % 360, s: M ? d / M : 0 }; };
const all = () => [...Object.keys(CAPITAL_CLASSES).map((c) => placeFleet(buildCapital(c), { id: c })), ...Object.keys(STATION_KINDS).map((k) => placeFleet(buildStation(k), { id: k }))];

describe('the fleet', () => {
  it('builds every class and kind as blocks of matter that never overlap (destructible physics stands them as boxes)', () => {
    for (const P of all()) {
      expect(P.blocks.length, P.id).toBeGreaterThan(10);
      for (const b of P.blocks) { expect(b.joules, b.id).toBeGreaterThan(0); expect(b.mass, b.id).toBeGreaterThan(0); expect(ROLES[b.role], b.id).toBeTruthy(); }
      for (let i = 0; i < P.blocks.length; i++) for (let j = i + 1; j < P.blocks.length; j++) expect(overlap(P.blocks[i], P.blocks[j]), `${P.blocks[i].id} / ${P.blocks[j].id}`).toBe(false);
      // every face in a block's break group, so what breaks takes its faces
      const ids = new Set(P.blocks.map((b) => `break:${b.id}`));
      for (const f of P.faces) expect(ids.has(f.group), f.group).toBe(true);
    }
  });

  it('a ship reads front to back: its drive aft, its reactor armoured at its heart, its armour plates welded on by their side', () => {
    const F = placeFleet(buildCapital('frigate'), { id: 'f' }), by = (r) => F.blocks.filter((b) => b.role === r);
    const xOf = (bs) => bs.reduce((s, b) => s + (b.min[0] + b.max[0]) / 2, 0) / bs.length;
    expect(xOf(by('drive'))).toBeLessThan(xOf(by('core')));
    expect(xOf(by('core'))).toBeLessThan(xOf(by('bow')));
    expect(F.core.length).toBeGreaterThan(0);
    expect(by('core').every((b) => b.matter === 'armour-steel')).toBe(true);
    expect(by('armour').length).toBeGreaterThan(0);
    expect(by('armour').every((b) => b.bond === 'lateral' && b.matter === 'armour-steel')).toBe(true);
    expect(F.hardpoints.length).toBe(CAPITAL_CLASSES.frigate.turrets.length);
  });

  it('the same class and seed, the same ship; a quarter turn turns it, its matter the same', () => {
    expect(JSON.stringify(buildCapital('corvette', { seed: 3 }))).toBe(JSON.stringify(buildCapital('corvette', { seed: 3 })));
    const a = placeFleet(buildCapital('corvette'), { id: 'c' }), b = placeFleet(buildCapital('corvette'), { id: 'c', heading: 90 });
    const span = (P, k) => P.bounds.max[k] - P.bounds.min[k];
    expect(span(b, 1)).toBeCloseTo(span(a, 0), 3);
    expect(b.blocks.reduce((s, x) => s + x.mass, 0)).toBeCloseTo(a.blocks.reduce((s, x) => s + x.mass, 0), 0);
    expect(() => buildCapital('dreadnought')).toThrow(/not a capital ship's class/);
  });

  it('its palette is narrow and never the cockpit\'s target magenta', () => {
    for (const L of Object.values(FLEET_LOOKS)) for (const c of Object.values(L)) if (typeof c === 'string') { const H = hue(c); if (H && H.s > 0.25) expect(H.h > 285 && H.h < 345, c).toBe(false); }
  });
});
