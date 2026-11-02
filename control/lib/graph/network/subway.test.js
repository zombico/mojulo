// A SUBWAY LINE (network/subway.js): stations in a row under the street, joined by running tunnels, each station's way
// out climbing to a pavilion on the street. One case a running tunnel the plans meet, chosen in code from the cards (a
// tube to each track of an island, ending at a terminus; one box over both tracks of side-platform stations). Each: the
// tunnels' tracks on the stations' tracks, their walkways under a platform's end where steps are cut down to them, every
// tunnel walked from one platform to the next and every entrance from its doorway to the street, and back, by the page's
// ground probe over the payload's own faces and boxes.
import { describe, it, expect } from 'vitest';
import { assembleStageScene } from '../era/stage.js';
import { readSubway } from './subway.js';
import { STATION_PLANS, STATION_PLAN_IDS } from './station-plans.js';
import { walker } from './walk-gate.js';

const tubeThrough = STATION_PLAN_IDS.find((id) => STATION_PLANS[id].tunnel === 'tube' && STATION_PLANS[id].ends.length === 2);
const tubeEnd = STATION_PLAN_IDS.find((id) => STATION_PLANS[id].tunnel === 'tube' && STATION_PLANS[id].ends.length === 1);
const box = STATION_PLAN_IDS.find((id) => STATION_PLANS[id].tunnel === 'rail');
const CASES = {
  tube: { stations: [{ id: 'bay', plan: tubeThrough }, { id: 'king', plan: tubeThrough, line: 'red' }, { id: 'union', plan: tubeEnd }], gap: 60 },
  box: { stations: [{ id: 'a', plan: box }, { id: 'b', plan: box }], gap: 50, line: 'green' },
};

for (const [name, spec] of Object.entries(CASES)) {
  describe(`a subway line of ${name}s`, () => {
    const P = assembleStageScene({ kind: 'stage', subway: spec }, {}), plan = STATION_PLANS[spec.stations[0].plan];
    const tunnels = P.anchors.filter((a) => a.kind === 'tunnel'), entrances = P.anchors.filter((a) => a.kind === 'entrance');

    it('joins each station to the next by its running tunnels, the tracks running on through them, every law holding', () => {
      const per = plan.tunnel === 'tube' ? plan.tracks.length : 1;
      expect(tunnels.length).toBe((spec.stations.length - 1) * per);
      expect(P.subway.section).toBe(plan.tunnel);
      for (const l of P.subway.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
      // (a running rail's head in a tunnel stands on a station's track: each tunnel's heads at a track's two rails)
      const heads = new Set(P.faces.filter((f) => f.group === 'subway:tunnel-rail' && f.normal[2] > 0.9).map((f) => Math.round(((Math.min(...f.corners.map((c) => c[0])) + Math.max(...f.corners.map((c) => c[0]))) / 2) * 100) / 100));
      const want = new Set(plan.tracks.flatMap((t) => [-0.7175, 0.7175].map((g) => Math.round((t.x + g) * 100) / 100)));
      expect([...heads].sort()).toEqual([...want].sort());
      expect(P.subway.tunnels.every((t) => !t.findings)).toBe(true);
    });

    it('is walked from one platform down the steps at its end, along each tunnel\'s walkway, and up onto the next platform, and back', () => {
      const walk = walker(P);
      for (const t of tunnels) for (const pts of [t.walk, t.walk.slice().reverse()]) {
        const w = walk(pts);
        expect({ id: t.id, steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ id: t.id, steepest: true, crossed: [], gaps: [], boxes: [] });
        expect(w.end).toBeCloseTo(pts.at(-1)[2], 1);
      }
      // (its first and last points on the platforms, the steps' feet on the track bed between)
      for (const t of tunnels) { expect(t.walk[0][2] - t.walk[1][2]).toBeCloseTo(1.05, 5); expect(t.walk.at(-1)[2] - t.walk.at(-2)[2]).toBeCloseTo(1.05, 5); }
    });

    it('takes each way out up an inclined stair to a pavilion on the street, walked from the doorway to the pavement and back', () => {
      const ways = P.anchors.filter((a) => a.kind === 'station').reduce((n, s) => n + s.ports.walks.length, 0);
      expect(entrances.length).toBe(ways);
      const walk = walker(P);
      for (const e of entrances) for (const pts of [e.walk, e.walk.slice().reverse()]) {
        const w = walk(pts);
        expect({ id: e.id, steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ id: e.id, steepest: true, crossed: [], gaps: [], boxes: [] });
      }
      for (const e of entrances) expect(e.walk.at(-1)[2]).toBe(0);
      for (const g of ['subway:street', 'subway:entrance-glass', 'subway:entrance-stair', 'subway:entrance-roof']) expect(P.faces.some((f) => f.group === g), g).toBe(true);
    });
  });
}

describe('a subway line composed', () => {
  it('is laid without its entrances when asked, and refuses what it cannot build, by name', () => {
    const P = assembleStageScene({ kind: 'stage', subway: { ...CASES.box, entrances: false } }, {});
    expect(P.anchors.some((a) => a.kind === 'entrance')).toBe(false);
    expect(() => readSubway({ stations: [{ id: 'u', plan: tubeEnd }, { id: 'v', plan: tubeThrough }] })).toThrow(/its tracks end there, so it is the line's last station/);
    expect(() => readSubway({ stations: [{ id: 'u', plan: tubeThrough }, { id: 'v', plan: box }] })).toThrow(/a line is all tubes or all boxes/);
    expect(() => readSubway({ stations: [{ id: 'u' }], gap: 5 })).toThrow(/gap is 30 to 600/);
    expect(() => readSubway({ stations: [{ id: 'u' }], depth: 2 })).toThrow(/depth is 8 to 40/);
    expect(() => readSubway({ stations: [{ id: 'u' }, { id: 'u' }] })).toThrow(/an id of its own/);
    expect(() => readSubway({ stations: [{ id: 'u', name: 'X' }] })).toThrow(/stations\[0\].name is not a setting/);
  });
});
