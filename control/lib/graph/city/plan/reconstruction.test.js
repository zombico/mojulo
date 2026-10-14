// THE RECONSTRUCTION GATE (machine): the city grammars are read from the legacy metro city, so the new city laid on
// rails must land where the legacy one does, on the legacy city's own census (fractal-city.js cityScaleCensus): block
// pitch, how much of the ground is walk, crossings, the height distribution, the skin mix, lot frontage. Not bytes:
// a different street layout cut by different rules, held to the same city. Real scale, the default downtown frame.
import { describe, it, expect } from 'vitest';
import { planFractalCity, cityScaleCensus, CITY_METERS_PER_UNIT } from '../fractal-city.js';
import { designCity } from './design.js';
import { inferCity } from './card.js';
import { skinLot } from './facades.js';
import { GRAMMAR_IDS } from './grammar.js';
import { CITY_FLAVORS } from '../city-flavors.js';

const REGION = { x: 2, y: 2, w: 220, d: 140 };
const SEEDS = [1, 7];
// how near is near: the legacy city's own seed-to-seed spread is about this wide on each measure. Pitch is the loosest:
// the board's fixed lines quantise it (the default downtown's 250 m gaps cut into two blocks), so every grammar lands
// near 120 m where the legacy recursion runs 100–119 m by flavour and seed; tokyo sits furthest, about 16 % over.
const TOL = { pitch: 0.18, walk: 0.03, crossings: 0.3, p50: 0.2, p90: 0.2, front: 0.15, skin: 0.12 };

function legacy(flavor, seed) {
  const p = planFractalCity({ profile: 'metro', flavor, seed, region: REGION, depth: 4, density: 0.6, elements: { frontage: true } });
  const c = cityScaleCensus(p, REGION), skin = {};
  let n = 0;
  for (const b of p.boxes) if (b.skin?.material) { skin[b.skin.material] = (skin[b.skin.material] || 0) + 1; n++; }
  const fronts = p.boxes.filter((b) => b.kind === 'building' && !b.tower).map((b) => Math.min(b.w, b.d) * CITY_METERS_PER_UNIT).sort((a, b) => a - b);
  return { pitch: c.pitch, walk: c.streetShare, crossings: c.crossingsPerKm2, p50: c.height.p50, p90: c.height.p90, front: fronts[fronts.length >> 1], skin: Object.fromEntries(Object.entries(skin).map(([k, v]) => [k, v / n])) };
}
function rails(grammar, seed) {
  const s = designCity(inferCity({ seed, grammar, play: 'real' }).recipe).stats;
  return { pitch: s.pitch, walk: s.streetShare, crossings: s.crossingsPerKm2, p50: s.height.p50, p90: s.height.p90, front: s.lotFront.p50, skin: s.skin };
}
// Every grammar is read from its flavour by one procedure (grammar.js grammarFromFlavor): hold it on the bare metro (no
// dial of its own) and on the flavour that turns the most dials (its skin, heights, towers, affectations), picked from
// the catalog. A new flavour is covered by the reading it runs through.
const dials = (g) => Object.keys(CITY_FLAVORS[g]).filter((k) => !['label', 'locale'].includes(k)).length + Object.keys(CITY_FLAVORS[g].facade || {}).length;
const BARE = GRAMMAR_IDS.find((g) => !dials(g)), RICHEST = [...GRAMMAR_IDS].sort((a, b) => dials(b) - dials(a))[0];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avg = (rows, k) => mean(rows.map((r) => r[k]));
const avgSkin = (rows, m) => mean(rows.map((r) => r.skin[m] || 0));

describe('the grammars reconstruct the legacy metro city (machine gate)', () => {
  it.each([BARE, RICHEST])('%s', (g) => {
    const L = SEEDS.map((s) => legacy(g, s)), R = SEEDS.map((s) => rails(g, s));
    const rel = (k) => Math.abs(avg(R, k) - avg(L, k)) / avg(L, k);
    expect(rel('pitch'), 'block pitch').toBeLessThan(TOL.pitch);
    expect(Math.abs(avg(R, 'walk') - avg(L, 'walk')), 'walk share').toBeLessThan(TOL.walk);
    expect(rel('crossings'), 'crossings per km²').toBeLessThan(TOL.crossings);
    expect(rel('p50'), 'median height').toBeLessThan(TOL.p50);
    expect(rel('p90'), 'p90 height').toBeLessThan(TOL.p90);
    expect(rel('front'), 'lot frontage').toBeLessThan(TOL.front);
    for (const m of ['glass', 'stone', 'brick']) expect(Math.abs(avgSkin(R, m) - avgSkin(L, m)), `${m} share`).toBeLessThan(TOL.skin);
  });
});

// THE FACADES, too: each grammar's affectations land at the legacy flavour's own rates (a roof cap, balconies, a fire
// escape on brick, rooftop kit, awnings, blade signs), laid by the same flavorFacade on the same dice shape.
const RATES = (skins) => {
  const brick = skins.filter((s) => s.material === 'brick');
  const r = (f, xs = skins) => xs.filter(f).length / (xs.length || 1);
  return { roofCap: r((s) => !!s.roofCap), balcony: r((s) => !!s.balcony), fireEscape: r((s) => !!s.fireEscape, brick), kit: r((s) => !!(s.kit && s.kit.length)), awning: r((s) => !!s.awning), blades: r((s) => !!s.blades) };
};
describe('the grammars wear the legacy flavours\' facades (machine gate)', () => {
  it.each([RICHEST])('%s', (g) => {
    const p = planFractalCity({ profile: 'metro', flavor: g, seed: 1, region: REGION, depth: 4, density: 0.6, elements: { frontage: true } });
    const L = RATES(p.boxes.filter((b) => b.skin && b.metro && !b.tower && b.kind === 'building').map((b) => b.skin));
    const d = designCity(inferCity({ seed: 1, grammar: g, play: 'real' }).recipe);
    const R = RATES(d.lots.filter((l) => l.use !== 'parking' && !l.tower).map((l) => skinLot(l, d.grammar, d.plan.seed).skin));
    for (const k of Object.keys(L)) expect(Math.abs(R[k] - L[k]), `${k}: ${R[k].toFixed(2)} against ${L[k].toFixed(2)}`).toBeLessThan(0.1);
  });
});
