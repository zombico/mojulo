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
import { withBuildingLevel } from '../structure/level.js';

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
      expect(P.subway.runs.every((t) => !t.findings)).toBe(true);
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

describe('a subway line played as a level', () => {
  it('is walked from its first platform through each tunnel to the street outside its last station, as the audit walks it', () => {
    const M = { kind: 'stage', subway: CASES.tube, level: {} }, P = assembleStageScene(M, {}), L = withBuildingLevel(M, 'ref'), exit = L.game.mechanics.at(-1);
    expect(exit.kind).toBe('reach-exit');
    const w = walker(P)(exit.via);
    expect({ steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
    // (won on the street: the last station's entrance's pavement)
    expect(exit.via.at(-1)[2]).toBe(0);
    expect(L.entities[0].rule.probe).toBeGreaterThan(0);
  });

  it('as a teleport: a stub out of each station, a warp at its end standing the walker on the next platform, its arrival shown', () => {
    const spec = { ...CASES.tube, tunnels: 'teleport' }, M = { kind: 'stage', subway: spec, level: {} }, P = assembleStageScene(M, {}), L = withBuildingLevel(M, 'ref');
    const plan = STATION_PLANS[spec.stations[0].plan], per = plan.tunnel === 'tube' ? plan.tracks.length : 1, pairs = spec.stations.length - 1;
    expect(P.subway.tunnels).toBe('teleport');
    expect(P.subway.runs).toEqual([]);
    const warps = P.anchors.filter((a) => a.kind === 'warp');
    expect(warps).toHaveLength(pairs * per * 2);
    for (const l of P.subway.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    const walk = walker(P);
    for (const x of warps) {
      // (walked from the platform down its steps to the warp's zone, and back; stood on the next platform, clear)
      for (const pts of [x.walk, x.walk.slice().reverse()]) {
        const r = walk(pts);
        expect({ id: x.id, steepest: r.steepest <= 0.36, crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ id: x.id, steepest: true, crossed: [], gaps: [], boxes: [] });
      }
      const on = walk([x.spot, [x.spot[0], x.spot[1] + Math.sin(x.heading) * 3, x.spot[2]]]);
      expect({ crossed: on.crossed, gaps: on.gaps, boxes: on.boxes }).toEqual({ crossed: [], gaps: [], boxes: [] });
    }
    // its level: a warp a stub, each to its next platform at the walker's eye; one arrival scene a station arrived at, a
    // shot over the walker's shoulder down the platform
    const ws = L.game.mechanics.filter((m) => m.kind === 'warp');
    expect(ws).toHaveLength(warps.length);
    for (const m of ws) expect(warps.some((x) => Math.abs(x.spot[2] + 1.7 - m.to[2]) < 1e-6 && x.spot[1] === m.to[1])).toBe(true);
    const arrivals = new Set(ws.map((m) => m.then));
    expect(L.play.scenes).toHaveLength(arrivals.size);
    for (const s of L.play.scenes) { expect(arrivals.has(s.when.on)).toBe(true); expect(s.beats[0].shot).toMatchObject({ frame: 'over', on: [expect.any(String), 'player'] }); }
    // (its route walked a piece at a time: each warp a cut in it)
    const cuts = [], via = L.game.mechanics.at(-1).via;
    let piece = [via[0]];
    // (a warp is where the route leaves a stub's zone: the next point is on the next platform)
    for (let i = 1; i < via.length; i++) { if (ws.some((m) => Math.abs(m.at[0] - via[i - 1][0]) < 1e-6 && Math.abs(m.at[1] - via[i - 1][1]) < 1e-6)) { cuts.push(piece); piece = [via[i]]; } else piece.push(via[i]); }
    cuts.push(piece);
    expect(cuts.length).toBe(pairs + 1);
    for (const c of cuts) { const r = walk(c); expect({ crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ crossed: [], gaps: [], boxes: [] }); }
    expect(() => readSubway({ stations: [{ id: 'u' }], tunnels: 'magic' })).toThrow(/tunnels is 'real'/);
  });
});
