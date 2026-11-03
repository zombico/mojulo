// A SUBWAY LINE (network/subway.js): stations in a row under the street, joined by running tunnels, each station's way
// out climbing to a pavilion on the street. One case a running tunnel the plans meet, chosen in code from the cards (a
// tube to each track of an island, ending at a terminus; one box over both tracks of side-platform stations). Each: the
// tunnels' tracks on the stations' tracks, their walkways under a platform's end where steps are cut down to them, every
// tunnel walked from one platform to the next and every entrance from its doorway to the street, and back, by the page's
// ground probe over the payload's own faces and boxes. And a line that RISES out of the ground: a deep station, one in a
// cut and one elevated, the gaps lengthened to the rail's grade for the climbs between them, its runs open where they
// lie at or over the street.
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

describe('a subway line that rises out of the ground', () => {
  const spec = { stations: [{ id: 'a', plan: box }, { id: 'b', plan: box, elevation: 'cut' }, { id: 'c', plan: box, elevation: 'elevated' }], gap: 100 };
  const P = assembleStageScene({ kind: 'stage', subway: spec }, {}), byId = Object.fromEntries(P.subway.stations.map((s) => [s.id, s]));

  it('stands each open station against the street, lengthens its gaps to the rail\'s grade, and opens its runs where they rise', () => {
    expect(byId.a.elevation).toBeUndefined();
    expect(byId.b).toMatchObject({ elevation: 'cut', street: 0 });
    expect(byId.c).toMatchObject({ elevation: 'elevated', street: 0 });
    expect(P.subway.gaps.every((g) => g >= spec.gap)).toBe(true);
    expect(P.subway.gaps.some((g) => g > spec.gap)).toBe(true);
    for (const r of P.subway.runs) { expect(r.grade).toBeLessThanOrEqual(1 / 30 + 1e-6); expect(r.findings).toBeUndefined(); }
    const [ab, bc] = P.subway.runs;
    // (from the deep station to the cut one under the ground all the way; from the cut up over the street to the el)
    expect(ab.spans.tunnel).toBeCloseTo(ab.length, 5);
    expect(bc.spans.cut).toBeGreaterThan(0);
    expect(bc.spans.viaduct).toBeGreaterThan(0);
    for (const l of P.subway.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
  });

  it('takes the deep station\'s ways out up entrances, the open ones\' to the street of their own, and opens the street over its cuts', () => {
    const entrances = P.anchors.filter((a) => a.kind === 'entrance');
    expect(entrances.length).toBeGreaterThan(0);
    expect(entrances.every((e) => e.station === 'station-a')).toBe(true);
    const B = P.anchors.find((a) => a.id === 'station-b');
    for (const q of B.ports.walks) expect(q).toMatchObject({ street: true, z0: 0 });
    // (no street over the cut station's platforms)
    const lanes = B.routes.platforms.flat(), x0 = Math.min(...lanes.map((p) => p[0])), x1 = Math.max(...lanes.map((p) => p[0])), y0 = Math.min(...lanes.map((p) => p[1])), y1 = Math.max(...lanes.map((p) => p[1]));
    const mid = (f) => [0, 1].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length), hit = (f) => { const [x, y] = mid(f); return x > x0 && x < x1 && y > y0 && y < y1; };
    expect(P.faces.filter((f) => f.group === 'subway:street' && hit(f))).toEqual([]);
    // (nor over the run where it lies open in its cut: the street's faces there are none over its track)
    const bc = P.anchors.find((a) => a.kind === 'tunnel' && a.from === 'station-b'), cutPts = bc.walk.filter((p) => p[2] < -1);
    const over = (f, p) => [0, 1].every((k) => p[k] > Math.min(...f.corners.map((c) => c[k])) + 1e-6 && p[k] < Math.max(...f.corners.map((c) => c[k])) - 1e-6);
    expect(cutPts.length).toBeGreaterThan(0);
    for (const p of cutPts.filter((_, i) => i % 20 === 0)) expect(P.faces.some((f) => f.group === 'subway:street' && over(f, p))).toBe(false);
  });

  it('is walked through each run, down the cut\'s stairs and the el\'s flights, and played as a level to the street', () => {
    const walk = walker(P), runs = P.anchors.filter((a) => a.kind === 'tunnel'), st = P.anchors.filter((a) => a.kind === 'station');
    for (const r of [...runs.map((t) => t.walk), ...st.flatMap((s) => s.routes.up)]) for (const pts of [r, r.slice().reverse()]) {
      const w = walk(pts);
      expect({ steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
    }
    const M = { kind: 'stage', subway: spec, level: {} }, exit = withBuildingLevel(M, 'ref').game.mechanics.at(-1), w = walk(exit.via);
    expect({ steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
    // (won on the street under the el)
    expect(exit.via.at(-1)[2]).toBeCloseTo(0, 5);
    expect(() => readSubway({ stations: [{ id: 'u', elevation: 'sky' }] })).toThrow(/stations\[0\] \(u\).elevation is 'deep' \| 'cut' \| 'elevated'/);
  });
});

describe('a subway line run on past its ends', () => {
  it('opens its end stations\' outer ends and runs its track on, a tunnel into the dark or an el to a buffer wall', () => {
    for (const elevation of ['deep', 'elevated']) {
      const spec = { stations: [{ id: 'a', plan: box, elevation }, { id: 'b', plan: box, elevation }], gap: 60, runOn: 80 };
      const P = assembleStageScene({ kind: 'stage', subway: spec }, {}), A = P.anchors.filter((a) => a.kind === 'station');
      // (a portal at each end of each station now, no buffer stops)
      for (const s of A) expect(s.ports.tracks.length).toBe(2 * STATION_PLANS[box].tracks.length);
      expect(P.faces.some((f) => f.group === 'station:buffer')).toBe(false);
      expect(P.subway.runOn.map((t) => t.length)).toEqual([80, 80]);
      if (elevation === 'elevated') {
        for (const t of P.subway.runOn) expect(t.spans.viaduct).toBeCloseTo(80, 5);
        expect(P.faces.some((f) => f.group === 'subway:tunnel-buffer')).toBe(true);
        expect(P.colliders.filter((c) => /:buffer-b$/.test(c.of))).toHaveLength(2);
      }
      for (const l of P.subway.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    }
    // (none asked: its end stations closed on their buffers, as ever)
    expect(assembleStageScene({ kind: 'stage', subway: CASES.box }, {}).subway.runOn).toBeUndefined();
    expect(() => readSubway({ stations: [{ id: 'u' }], runOn: 900 })).toThrow(/runOn is 0 to 600/);
  });
});
