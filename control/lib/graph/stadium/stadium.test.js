// The stadium: its words read over a preset and refused, teaching; the bowl round the field (the ring through the field's
// corners, open sides capped, the crowd a mosaic of the treads); the venue on the World page (the skyline on its ground,
// the camera inside the pitch wall); a game's arena standing in one by its venue word, and none without it.
import { describe, it, expect } from 'vitest';
import { readStadium, assembleStadiumScene, STADIUM_PRESETS, STADIUM_PRESET_IDS, STADIUM_LIVERIES } from './stadium.js';
import { bowlFaces, ringPoint } from './bowl.js';
import { readVenue, venueManifest } from './venue.js';
import { LIGHT } from '../roads/road-faces.js';
import { matchManifest } from '../contest/match-arena.js';
import { teamManifest } from '../contest/team-arena.js';
import { meetManifest } from '../contest/meet-arena.js';
import { turnsManifest } from '../contest/turn-arena.js';
import { holoManifest } from '../tabletop/holo-arena.js';

// the smallest bowl that has every part: two tiers, a roof, a facade, screens
const BOWL = { shape: 3, segs: 24, gap: 3, tiers: [{ rows: 4, tread: 0.82, rise: 0.42 }, { rows: 4, tread: 0.82, rise: 0.54 }], concourse: 3, boxes: 3.2, roof: 'canopy', facade: 'glass', crowd: 0.6, open: [], apron: 'grass', screens: 1, landmark: 'none', seed: 1, colours: { ...STADIUM_LIVERIES.club, crowd: ['#ff0000', '#00ff00'], apron: '#5d8f45' } };
const at = { centre: [0, 20], half: [10, 20], light: LIGHT };

describe('the stadium\'s words', () => {
  it('reads a preset\'s words under the given ones, and a word over a preset moves that part alone', () => {
    const S = readStadium({ field: { w: 20, d: 40 } });
    expect(S).toMatchObject({ preset: 'olympic', look: STADIUM_PRESETS.olympic.look, field: { x: -10, y: 0, w: 20, d: 40, surface: 'grass' } });
    const id = STADIUM_PRESET_IDS.find((k) => STADIUM_PRESETS[k].bowl.roof !== 'dome');
    const D = readStadium({ preset: id, bowl: { roof: 'dome' } });
    expect(D.bowl).toMatchObject({ ...STADIUM_PRESETS[id].bowl, roof: 'dome' });
    expect(D.field.w).toBe(STADIUM_PRESETS[id].field.w);   // the preset's own field when none is given
    expect(readStadium({ field: { w: 20, d: 40 }, colours: { seat: '#123456' } }).colours.seat).toBe('#123456');
  });

  it('refuses what is not a stadium\'s, teaching', () => {
    const F = { field: { w: 20, d: 40 } };
    expect(() => readStadium({ ...F, stands: {} })).toThrow(/no 'stands'/);
    expect(() => readStadium({ ...F, preset: 'wembley' })).toThrow(/preset 'wembley' is one of/);
    expect(() => readStadium({ field: { w: 2, d: 40 } })).toThrow(/field is \{ w, d \} in metres/);
    expect(() => readStadium({ ...F, bowl: { roof: 'tent' } })).toThrow(/bowl.roof is one of none, canopy, ring, dome/);
    expect(() => readStadium({ ...F, bowl: { rows: [3] } })).toThrow(/4 to 30 rows a tier/);
    expect(() => readStadium({ ...F, bowl: { open: ['n', 'e', 's', 'w'] } })).toThrow(/not all four/);
    expect(() => readStadium({ ...F, bowl: { apron: 'track', gap: 3 } })).toThrow(/needs a gap of 6 m/);
    expect(() => readStadium({ ...F, colours: { seat: 'red' } })).toThrow(/colours.seat is a #rrggbb/);
    expect(() => readStadium({ ...F, colours: { paint: '#ffffff' } })).toThrow(/colours has no 'paint'/);
  });
});

describe('the bowl', () => {
  it('is a ring through the field\'s corners at any shape', () => {
    for (const shape of [2, 5]) {
      const corner = ringPoint([0, 0], [10 * 2 ** (1 / shape), 20 * 2 ** (1 / shape)], shape, 0, Math.PI / 4);
      expect(corner[0]).toBeCloseTo(10, 2); expect(corner[1]).toBeCloseTo(20, 2);
    }
  });

  it('is the same bowl for the same words; its treads carry the crowd\'s colours, none when the house is empty', () => {
    const a = bowlFaces(BOWL, at), b = bowlFaces(BOWL, at);
    expect(a).toEqual(b);
    const fills = (r) => new Set(r.faces.map((f) => f.fill)).size;
    expect(a.faces.length).toBeGreaterThan(500);
    const empty = bowlFaces({ ...BOWL, crowd: 0 }, at);
    expect(empty.faces.length).toBe(a.faces.length);   // the mosaic is paint on the same treads
    expect(fills(empty)).toBeLessThan(fills(a));
    // two tiers stand higher than one, and the roof over both
    expect(a.top).toBeGreaterThan(bowlFaces({ ...BOWL, tiers: [BOWL.tiers[0]] }, at).top);
    expect(a.roofZ).toBeGreaterThan(a.top);
  });

  it('leaves an open side out and caps the ring where it stops', () => {
    const shut = bowlFaces(BOWL, at), open = bowlFaces({ ...BOWL, open: ['s'] }, at);
    expect(open.faces.length).toBeLessThan(shut.faces.length);
    // nothing of the stands stands on the open side past the field's end
    const south = (r) => r.faces.filter((f) => f.corners.every((p) => p[1] < -14 && p[2] > 2)).length;
    expect(south(shut)).toBeGreaterThan(0); expect(south(open)).toBe(0);
  });
});

describe('the venue on the World page', () => {
  it('stands its skyline on its ground, sees from inside the bowl, and carries the sky at its hour', () => {
    const P = assembleStadiumScene({ preset: 'arcade', field: { w: 20, d: 30 }, skyline: { n: 3, height: [20, 30] }, time: 'dusk' });
    const ground = P.faces[0].corners, far = Math.max(...ground.map((p) => Math.abs(p[0])));
    for (const f of P.faces) for (const p of f.corners) expect(Math.abs(p[0])).toBeLessThanOrEqual(far);
    expect(P.sky).toMatchObject({ preset: 'dusk' }); expect(P.repeats).toBeUndefined();
    const [, cy] = P.cameras[0].worldFraming.cameraPosition;
    expect(cy).toBeLessThan(0);   // behind the field's near end, in the near stand
    expect(assembleStadiumScene({ preset: 'arcade', field: { w: 20, d: 30 }, skyline: { n: 3, height: [20, 30] }, time: 'dusk' })).toEqual(P);
  });
});

describe('a game\'s venue', () => {
  it('reads a preset or a stadium\'s words without a field; refuses, teaching', () => {
    const fail = (m) => { throw new Error(m); };
    expect(readVenue('colosseum', fail)).toBe('colosseum');
    expect(() => readVenue('wembley', fail)).toThrow(/venue 'wembley' is one of/);
    expect(() => readVenue({ field: { w: 10, d: 10 } }, fail)).toThrow(/venue has no 'field'/);
    expect(() => readVenue({ bowl: { roof: 'tent' } }, fail)).toThrow(/venue: bowl.roof is one of/);
  });

  it('sets the camera\'s side back until the arena\'s camera stands inside the pitch wall', () => {
    const camera = { name: 'c', worldFraming: { cameraPosition: [0, -30, 8], lookAt: [0, 20, 0] } };
    const m = venueManifest('football', { room: { x: -10, y: 0, w: 20, d: 40 }, surface: 'grass', camera, title: 't', channel: { pitch: {} } });
    expect(m).toMatchObject({ kind: 'stadium', preset: 'football', field: { x: -10, y: 0, w: 20, d: 40, surface: 'grass' }, camera, pitch: {} });
    expect(m.bowl.clear).toBeGreaterThan(0);
    const near = venueManifest('football', { room: { x: -10, y: 0, w: 20, d: 40 }, surface: 'grass', camera: { ...camera, worldFraming: { ...camera.worldFraming, cameraPosition: [0, 10, 8] } }, title: 't', channel: {} });
    expect(near.bowl).toBeUndefined();
  });

  it('stands each arena in its stadium by its venue word, its channel and camera its own; none without the word', () => {
    const arenas = [[matchManifest, { sport: 'tennis' }, 'court'], [teamManifest, { sport: 'hockey' }, 'pitch'], [meetManifest, { event: 'sprint' }, 'meet'], [turnsManifest, { sport: 'bowling' }, 'turns'], [holoManifest, { game: 'checkers' }, 'holo']];
    for (const [make, spec, key] of arenas) {
      const stage = make(spec), lifted = make({ ...spec, venue: 'municipal' });
      expect(stage.kind).toBe('stage'); expect(stage[key].venue).toBeUndefined();
      expect(lifted).toMatchObject({ kind: 'stadium', preset: 'municipal', camera: stage.camera, title: stage.title, [key]: { venue: 'municipal' } });
      expect(lifted.field.w).toBe(stage.rooms[0].w); expect(lifted.field.d).toBe(stage.rooms[0].d);
    }
    expect(() => matchManifest({ sport: 'tennis', venue: 'wembley' })).toThrow(/court: venue 'wembley' is one of/);
  });
});
