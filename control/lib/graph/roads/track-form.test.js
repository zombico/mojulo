import { describe, it, expect } from 'vitest';
import { trackForm, TRACK_FORM_KEEP } from './track-form.js';
import { sunLitFaces, baseOf } from '../form/sun-light.js';
import { CHUNKY_SUN } from './chunky-look.js';
import { readTrackIntent, composeTrack } from './trackscape-compose.js';
import { planTrack, assembleTrackScene } from './track.js';
import { displayToLinear, decodeSrgb } from '../color-theorist/light.js';

const flat = (hex, z = 0) => ({ corners: [[0, 0, z], [1, 0, z], [1, 1, z], [0, 1, z]], fill: hex });

describe('a track in the form render', () => {
  it('the palette is kept on what lies flat: a flat face shows its paint under the day it is baked in', () => {
    const F = trackForm([flat('#7f7aae')], { fit: { at: [0, 0, 0], half: 50 } }).faces[0];
    const base = [1, 3, 5].map((i) => decodeSrgb(parseInt(F.fill.slice(i, i + 2), 16) / 255)), shown = base.map((v, k) => v * F.cornerLight[0][k]), want = displayToLinear('#7f7aae');
    for (let k = 0; k < 3; k++) expect(shown[k]).toBeCloseTo(want[k], 2);
    // a face lying flat takes the sun: its share is what a shadow takes away, so a shadow is the sky's, never black
    expect(F.sunShare[0]).toBeGreaterThan(0.3); expect(F.sunShare[0]).toBeLessThan(0.8);
  });
  it('the page casts the sun live: the static map fitted to the track, what moves each frame, the clouds kept out and unbaked', () => {
    const cloud = { ...flat('#ffffff', 90), group: 'track:cloud' }, T = trackForm([flat('#7f7aae'), cloud], { fit: { at: [1, 2, 0], half: 80 } });
    expect(T.shadows).toEqual({ actors: true, hour: true, fit: { at: [1, 2, 0], half: 80 }, noCastGroups: [...TRACK_FORM_KEEP] });
    expect(T.faces[1]).toBe(cloud);
    expect(T.form.town.lights[0].live).toBe(true);
  });
  it('a smooth face is lit corner by corner; without corner normals, and without a reference, the bake is as it was', () => {
    const L = { sun: [...CHUNKY_SUN.sun], ambient: [...CHUNKY_SUN.ambient], dir: [...CHUNKY_SUN.dir] };
    const f = { ...flat('#ff4f86'), normal: [0, 0, 1] }, round = { ...f, cornerNormals: [[0, 0, 1], [0.7, 0, 0.7], [0, 0.7, 0.7], [-0.7, 0, 0.7]] };
    const [a] = sunLitFaces([f], L).faces, [b] = sunLitFaces([round], L).faces;
    expect(a.cornerLight[0]).toEqual(b.cornerLight[0]);
    expect(a.cornerLight[1]).not.toEqual(b.cornerLight[1]);
    expect(JSON.stringify(sunLitFaces([f], L))).toBe(JSON.stringify(sunLitFaces([f], L, { reference: null })));
    expect(baseOf('#ff4f86', L)).toEqual(baseOf('#ff4f86', L, null));
  });
  it('a kart track from words is the seventh generation\'s; a word bakes it; a circuit is untouched', () => {
    expect(readTrackIntent('a kart track').form).toBe(true);
    expect(readTrackIntent('a baked kart track').form).toBeUndefined();
    expect(readTrackIntent('a voxel kart track').form).toBeUndefined();
    expect(readTrackIntent('a GT circuit').form).toBeUndefined();
    const M = composeTrack('a short kart track', { seed: 2 });
    expect(M.kit.form).toBe(true);
    const small = { form: 'circuit', course: { class: 'kart', length: 260, twist: 0.5, seed: 2 }, language: 'candy', kit: M.kit };
    const S = assembleTrackScene(small, {}, planTrack(small));
    expect(S.form.town).toBeTruthy();
    expect(S.faces.filter((x) => x.sunShare).length).toBeGreaterThan(S.faces.length * 0.8);
    const baked = assembleTrackScene({ ...small, kit: { ...M.kit, form: false } }, {}, planTrack({ ...small, kit: { ...M.kit, form: false } }));
    expect(baked.form).toBeUndefined(); expect(baked.shadows).toBeUndefined();
  });
});
