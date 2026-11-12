// The snow's drifts (skandart-snow.js): what the wind piles in the lee of what stands in its way. Held on a flat land with
// a straight walk (the shape and its laws), then on one snowy stage (the land dresses them as its snow, asked or not).
import { describe, expect, it } from 'vitest';
import { snowDrifts, SNOW_SKANDART } from './skandart-snow.js';
import { readSnow } from './snow.js';
import { MATTER } from '../rupa/matter.js';
import { assembleStageScene } from './stage.js';

// a flat land 60 m across, its walk the line x = 0 a metre either side; snow everywhere east of x = `edge`
const SITE = { ground: () => 0, trailDist: (x) => Math.abs(x), halfWAt: () => 1 };
const field = (edge = -Infinity) => (x) => (x > edge ? 1 : -1);
const SNOW = readSnow('deep'), ROCK = { of: 'rock', x: 8, y: 10, r: 1, h: 2 };
const lay = (over = {}) => snowDrifts(SITE, { field: field(), snow: SNOW, amount: 1, wind: 0, obstacles: [ROCK], ...over });
const middle = (d) => { const cs = d.faces.flatMap((f) => f.corners); return [0, 1].map((k) => cs.reduce((a, c) => a + c[k], 0) / cs.length); };

describe('a snow drift', () => {
  it('lies in the lee of what stands in the wind, its tail downwind, whichever way the wind blows', () => {
    const east = lay().drifts[0], north = lay({ wind: 90 }).drifts[0];
    expect(middle(east)[0]).toBeGreaterThan(ROCK.x + ROCK.r);
    expect(Math.abs(middle(east)[1] - ROCK.y)).toBeLessThan(0.5);
    expect(middle(north)[1]).toBeGreaterThan(ROCK.y + ROCK.r);
    // (highest at the obstacle, its tail thinning downwind)
    const zAt = (d, x0, x1) => Math.max(0, ...d.faces.flatMap((f) => f.corners).filter((c) => c[0] >= x0 && c[0] < x1).map((c) => c[2]));
    expect(zAt(east, ROCK.x, ROCK.x + 2)).toBeGreaterThan(zAt(east, ROCK.x + east.L * 0.6, ROCK.x + east.L));
  });

  it('stands no steeper than snow does, lies only in the snow, keeps off the walk, and is read where it is seen', () => {
    const L = lay();
    expect(L.laws.filter((r) => !r.ok)).toEqual([]);
    const steep = Math.max(...L.drifts[0].faces.map((f) => (Math.acos(f.normal[2]) * 180) / Math.PI));
    expect(steep).toBeLessThanOrEqual(MATTER.snow.phi + 2);
    // (its tail cut where the snow ends)
    const cut = lay({ field: (x) => (x < ROCK.x + 4 ? 1 : -1) }).drifts[0];
    expect(cut.L).toBeLessThan(lay().drifts[0].L);
    expect(Math.max(...cut.faces.flatMap((f) => f.corners).map((c) => c[0]))).toBeLessThan(ROCK.x + 4.5);
    // (and short of the walk: a rock west of it, the wind blowing over the walk)
    const west = lay({ obstacles: [{ ...ROCK, x: -5 }] }).drifts[0];
    expect(Math.max(...west.faces.flatMap((f) => f.corners).map((c) => c[0]))).toBeLessThan(-1);
    // (no snow, no drift)
    expect(lay({ field: field(100) }).drifts).toEqual([]);
  });

  it('rises with the amount and the snow\'s depth, never past what it leans on; too low to be read, it is not made', () => {
    const H = (over) => lay(over).drifts[0]?.H ?? 0;
    expect(H({ amount: 0.3 })).toBeLessThan(H({ amount: 1 }));
    expect(H({ snow: readSnow('cover') })).toBeLessThan(H({}));
    expect(H({ obstacles: [{ ...ROCK, h: 0.8 }] })).toBeLessThanOrEqual(0.8 * SNOW_SKANDART.under + 1e-9);
    expect(lay({ amount: 0, snow: readSnow('dusting'), read: { least: 0.3 } }).drifts).toEqual([]);
    expect(lay({ obstacles: [{ ...ROCK, h: SNOW_SKANDART.least / 2 }] }).drifts).toEqual([]);
  });

  it('is one drift where a smaller obstacle stands in a bigger one\'s; the same every time', () => {
    const two = lay({ obstacles: [{ ...ROCK, of: 'trunk', x: ROCK.x + 3, r: 0.2, h: 4 }, ROCK] });
    expect(two.drifts.map((d) => d.of)).toEqual(['rock']);
    expect(JSON.stringify(lay())).toBe(JSON.stringify(lay()));
  });
});

describe('the drifts on a snowy stage', () => {
  const M = { kind: 'stage', trail: {}, seed: 3, geocube: { from: 'island-noon', snow: 'deep', wind: { dir: 0 } } };
  it('are laid when asked, as the land\'s snow (its own colour painted, the ground the snow lies on in the form render), walked over; on bare ground, none', () => {
    const P = assembleStageScene({ ...M, skandart: 1 }, {}), F = assembleStageScene({ ...M, skandart: 1 }, { form: true });
    expect(P.skandart.drifts.length).toBeGreaterThan(0);
    expect(P.skandart.laws).toEqual([]);
    expect(F.skandart.drifts).toEqual(P.skandart.drifts);
    const plain = assembleStageScene(M, {});
    expect(plain.skandart).toBeUndefined();
    const count = (Q, g) => Q.faces.filter((f) => f.group === g).length;
    expect(count(P, 'isekai:snow')).toBeGreaterThan(count(plain, 'isekai:snow'));
    // (no collider stands where a drift does: it is walked over)
    const cols = (Q) => (Q.colliders ?? []).length;
    expect(cols(P)).toBe(cols(plain));
    // (on bare ground the same word lays the trail's rockfall, era/skandart-land.js: no drifts)
    expect(assembleStageScene({ kind: 'stage', trail: {}, seed: 3, geocube: { from: 'island-noon' }, skandart: 1 }, {}).skandart.drifts).toBeUndefined();
  }, 120_000);
});
