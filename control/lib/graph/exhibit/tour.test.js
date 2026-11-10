// The tour's reader: a tour is checked against the world it rides, and what is wrong says what it takes.
import { describe, it, expect } from 'vitest';
import { readTour, tourGroups, TOUR_SHAPES, TOUR_GRADES, TOUR_LIMITS } from './tour.js';

const payload = {
  cameras: [{ name: 'wide', pos: [0, -20, 8], target: [0, 0, 0], vfov: 45 }, { name: 'close', pos: [3, -4, 2], target: [0, 0, 1], vfov: 35 }],
  faces: [{ group: 'dam' }, { group: 'turbine' }, { group: 'body:hair' }, {}, { group: 'pool', water: true }],
  repeats: [{ name: 'trees' }],
};
const world = { cameras: payload.cameras, groups: tourGroups(payload) };

describe('the groups a highlight may name', () => {
  it('are the faces\' groups (no group is static), the repeats\', never water or a decal', () => {
    expect(tourGroups(payload).sort()).toEqual(['body:hair', 'dam', 'static', 'trees', 'turbine']);
  });
});

describe('readTour', () => {
  it('normalizes a tour: ids, cameras by name, index, placed or framed, a group naming its sub-groups', () => {
    const t = readTour({
      title: 'Water into power',
      start: 'turbine',
      stops: [
        { caption: 'The reservoir holds the water high.', camera: 'wide', shape: 'process', grade: 'simulated' },
        { id: 'turbine', title: 'The turbine', caption: 'Falling water turns it.', camera: { frame: 'turbine', from: 'side' }, highlight: ['turbine', 'dam', 'turbine'] },
        { caption: 'Hair is a sub-group.', camera: 1, highlight: 'body', cite: 'Smith 2001' },
        { caption: 'Placed.', camera: { pos: [1, 2, 3], target: [0, 0, 0], vfov: 30 } },
      ],
    }, world);
    expect(t.title).toBe('Water into power');
    expect(t.start).toBe(1);
    expect(t.stops.map((s) => s.id)).toEqual(['s1', 'turbine', 's3', 's4']);
    expect(t.stops[0].camera).toEqual({ cam: 0 });
    expect(t.stops[1].camera).toEqual({ frame: ['turbine'], from: 'side' });
    expect(t.stops[1].highlight).toEqual(['turbine', 'dam']);
    expect(t.stops[2]).toMatchObject({ camera: { cam: 1 }, highlight: ['body'], cite: ['Smith 2001'] });
    expect(t.stops[3].camera).toEqual({ pos: [1, 2, 3], target: [0, 0, 0], vfov: 30 });
    // what is absent stays absent: no empty keys on the page
    expect(Object.keys(t.stops[3]).sort()).toEqual(['camera', 'caption', 'id']);
  });

  it('is deterministic: the same tour reads the same', () => {
    const spec = { stops: [{ caption: 'a', camera: 'wide', highlight: 'dam' }] };
    expect(JSON.stringify(readTour(spec, world))).toBe(JSON.stringify(readTour(structuredClone(spec), world)));
  });

  it('says what is wrong and what it takes', () => {
    const at = (stop, extra = {}) => () => readTour({ stops: [{ caption: 'x', camera: 'wide', ...stop }], ...extra }, world);
    expect(at({ camera: 'nope' })).toThrow(/stops\[0\]\.camera names no camera 'nope' \(this world's: wide, close\)/);
    expect(at({ camera: 7 })).toThrow(/is camera 7; this world has 2/);
    expect(at({ camera: { pos: [0, 0], target: [0, 0, 0] } })).toThrow(/camera\.pos is \[x, y, z\]/);
    expect(at({ camera: { frame: 'nowhere' } })).toThrow(/frame\[0\] names no group 'nowhere' of this world \(its groups: body:hair, dam/);
    expect(at({ camera: { frame: 'dam', from: 'below' } })).toThrow(/from is one of threeQuarter, front, side, top/);
    expect(at({ highlight: ['dam', 'roof'] })).toThrow(/highlight\[1\] names no group 'roof'/);
    expect(at({ shape: 'story' })).toThrow(new RegExp(`shape is one of ${TOUR_SHAPES.join(', ')}`));
    expect(at({ grade: 'certain' })).toThrow(new RegExp(`grade is one of ${Object.keys(TOUR_GRADES).join(', ')}`));
    expect(at({ caption: '  ' })).toThrow(/caption is a non-empty string/);
    expect(at({ caption: 'x'.repeat(TOUR_LIMITS.caption + 1) })).toThrow(/at most 700/);
    expect(at({ cite: [] })).toThrow(/cite names one source/);
    expect(at({ id: 'Bad Id' })).toThrow(/id is lowercase letters/);
    expect(at({ note: 'x' })).toThrow(/has 'note' \(a stop takes id, title, caption/);
    expect(at({}, { start: 4 })).toThrow(/start is a stop's index \(0 to 0\) or its id/);
    expect(at({}, { auto: 3 })).toThrow(/'auto' is not a tour key/);
    expect(() => readTour({ stops: [{ caption: 'a', camera: 'wide' }, { id: 's1', caption: 'b', camera: 'wide' }] }, world)).toThrow(/repeats 's1'/);
    expect(() => readTour({ stops: [] }, world)).toThrow(/stops is a list of one stop or more/);
    expect(() => readTour({ stops: [{ camera: 'wide' }] }, world)).toThrow(/caption is required/);
  });

  it('a stop states the brief\'s claims (their grade and sources when it says none) and says its caption for other audiences', () => {
    const claims = [{ id: 'old', text: 'x', cite: ['Strabo'], grade: 'attested' }, { id: 'guess', text: 'y', grade: 'conjectural' }];
    const t = readTour({ stops: [
      { caption: 'a', camera: 'wide', claims: ['old', 'guess'], captions: { child: 'A!' } },
      { caption: 'b', camera: 'wide', claims: 'old', grade: 'reconstructed', cite: 'Mine' },
    ] }, { ...world, claims });
    expect(t.stops[0]).toMatchObject({ grade: 'conjectural', cite: ['Strabo'], claims: ['old', 'guess'], captions: { child: 'A!' } });
    expect(t.stops[1]).toMatchObject({ grade: 'reconstructed', cite: ['Mine'] });
    expect(t.audiences).toEqual(['general', 'child']);
    expect(readTour({ stops: [{ caption: 'a', camera: 'wide' }] }, world).audiences).toBeUndefined();
    expect(() => readTour({ stops: [{ caption: 'a', camera: 'wide', claims: ['old'] }] }, world)).toThrow(/names claims, and the recipe states none/);
    expect(() => readTour({ stops: [{ caption: 'a', camera: 'wide', claims: ['nope'] }] }, { ...world, claims })).toThrow(/names no claim 'nope' \(the brief's: old, guess\)/);
    expect(() => readTour({ stops: [{ caption: 'a', camera: 'wide', captions: { general: 'x' } }] }, world)).toThrow(/has 'general' \(it takes child and specialist/);
  });

  it('a world that draws no group can still be toured by camera, never highlighted', () => {
    const bare = { cameras: payload.cameras, groups: [] };
    expect(readTour({ stops: [{ caption: 'a', camera: 'wide' }] }, bare).stops).toHaveLength(1);
    expect(() => readTour({ stops: [{ caption: 'a', camera: 'wide', highlight: 'dam' }] }, bare)).toThrow(/it draws none a highlight can name/);
  });
});
