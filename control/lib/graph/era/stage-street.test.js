/**
 * The street through a stage town (era/stage-street.js): its section on both sides of the trail, its furniture, its
 * door paths, and the town that fronts it. One language per walk form that changes the procedure (a kerbed walk with
 * lamps on brackets, a flush walk with posts), chosen from the authored anchors and the style starters by its form.
 */
import { describe, it, expect } from 'vitest';
import { streetSpan, layStreet } from './stage-street.js';
import { decompileAnchor, ANCHOR_IDS } from './out-anchor-structure.js';
import { readStyle, STYLE_IDS } from './arch-style.js';
import { TOWN_CARD } from './out-town.js';
import { assembleGeocubeScene } from './geocube.js';
import { assembleStageScene } from './stage.js';

const langOf = (form) => {
  const id = ANCHOR_IDS.find((a) => decompileAnchor(a).street.footway.form === form || (form === 'kerbed' && !decompileAnchor(a).street.footway.form));
  if (id) return decompileAnchor(id);
  const S = readStyle(STYLE_IDS.find((s) => decompileAnchor(readStyle(s).language.doc).street.footway.form === form));
  return decompileAnchor(S.language.doc);
};
// a straight trail along y at x = 10, its land level at 0
const site = { D: 40, trailX: () => 10, ground: () => 0 };
const opts = (L, more = {}) => ({ y0: 5, y1: 25, paint: () => '#888888', lit: () => 1, soil: '#806040', grass: '#407030', ...more });

describe('the street', () => {
  it('is the lane\'s section in its language, on both sides of the trail', () => {
    const L = langOf('kerbed'), span = streetSpan(L), { faces } = layStreet(site, L, span, opts(L));
    expect(span.R).toBe(TOWN_CARD.ranks.lane.w / 2);
    expect(span.half).toBeCloseTo(span.R + L.street.footway.w * TOWN_CARD.section.lane.foot, 9);
    const road = faces.filter((f) => f.group === 'street:road' || f.group === 'street:soil');
    const xs = road.flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.min(...xs)).toBeCloseTo(10 - span.R, 6);
    expect(Math.max(...xs)).toBeCloseTo(10 + span.R, 6);
    // a kerb set on end both sides, the walk raised behind it to the back of the footway
    const kerbs = faces.filter((f) => f.group === 'street:kerb' && Math.abs(f.normal[0]) > 0.9);
    expect(new Set(kerbs.map((f) => Math.sign(f.corners[0][0] - 10)))).toEqual(new Set([1, -1]));
    const walk = faces.filter((f) => f.group === 'street:walk');
    expect(Math.max(...walk.flatMap((f) => f.corners.map((c) => Math.abs(c[0] - 10))))).toBeCloseTo(span.half, 6);
    // every face faces up or out, none inside out
    expect(faces.every((f) => f.normal[2] > -0.1)).toBe(true);
  });

  it('stands its lamps at their stride, its posts along a flush walk', () => {
    for (const form of ['kerbed', 'flush']) {
      const L = langOf(form), { faces } = layStreet(site, L, streetSpan(L), opts(L)), S = L.street;
      const lamps = new Set(faces.filter((f) => f.group === 'street:lamp').map((f) => Math.floor((f.corners[0][1] - 5) / S.lamp.stride)));
      expect(lamps.size).toBe(Math.floor((20 - S.lamp.stride / 2) / S.lamp.stride) + 1);
      expect(faces.some((f) => f.group === 'street:stone' && f.corners.every((c) => Math.abs(Math.abs(c[0] - 10) - (2.5 + 0.2)) < 0.3))).toBe(form === 'flush');
    }
  });

  it('lays a path of slabs from the walk to each door, and says what ground it covers', () => {
    const L = langOf('kerbed'), span = streetSpan(L), door = { at: [10 + span.half + 2, 15, 0.3], N: [-1, 0, 0] };
    const { faces, clear } = layStreet(site, L, span, opts(L, { doors: [door] }));
    const slabs = faces.filter((f) => f.corners.every((c) => c[0] > 10 + span.half - 0.1 && Math.abs(c[1] - 15) < 0.7));
    expect(slabs.length).toBeGreaterThan(0);
    expect(clear(10, 15)).toBe(true);
    expect(clear(10 + span.half + 1, 15)).toBe(false);
    expect(clear(10, 40)).toBe(false);
    expect(JSON.stringify(layStreet(site, L, span, opts(L, { doors: [door] })).faces)).toBe(JSON.stringify(faces));
  });
});

describe('the town that fronts it', () => {
  it('a cube\'s town stands its houses behind the footway, facing it, none on another, nothing growing on the street', () => {
    const P = assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'town', seed: 3 }, {}, assembleStageScene);
    const H = P.anchors.filter((a) => a.kind === 'house'), road = P.faces.filter((f) => f.group === 'street:road' || f.group === 'street:soil');
    expect(H.length).toBeGreaterThan(1);
    expect(road.length).toBeGreaterThan(0);
    // each door faces the street and stands behind its footway
    const centre = (y) => { const r = road.filter((f) => Math.abs(f.corners[0][1] - y) < 1.2); const xs = r.flatMap((f) => f.corners.map((c) => c[0])); return (Math.min(...xs) + Math.max(...xs)) / 2; };
    for (const h of H) {
      const c = centre(h.at[1]);
      expect((c - h.at[0]) * h.N[0]).toBeGreaterThan(0);
      expect(Math.abs(h.at[0] - c)).toBeGreaterThan(4);
    }
    for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) { const a = H[i].box, b = H[j].box; expect(a.min[0] < b.max[0] && b.min[0] < a.max[0] && a.min[1] < b.max[1] && b.min[1] < a.max[1], `${H[i].id} on ${H[j].id}`).toBe(false); }
    const onRoad = P.faces.filter((f) => /:(rock|tree|wood|hat)$/.test(f.group || '') && (() => { const n = f.corners.length, x = f.corners.reduce((a, q) => a + q[0], 0) / n, y = f.corners.reduce((a, q) => a + q[1], 0) / n; const r = road.filter((g) => Math.abs(g.corners[0][1] - y) < 1.2); return r.length && Math.abs(x - centre(y)) < 2.5; })());
    expect(onRoad).toEqual([]);
    expect(P.cameras.slice(0, 2).map((c) => c.name)).toEqual(['house', 'street']);
  });

  it('a stage town asks for its street; without it, as it was', () => {
    expect(() => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed: 3, trail: { run: 12 }, town: { houses: 2, street: 'yes' } }, {})).toThrow(/town.street is true/);
    const P = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed: 3, trail: { run: 12 }, town: { houses: 2, enter: 0 } }, {});
    expect(P.faces.some((f) => String(f.group).startsWith('street:'))).toBe(false);
  });
});
