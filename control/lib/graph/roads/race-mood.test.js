// A race's mood: the light a track is raced in. The concepts: under noon the re-light is the identity (a baked face
// lit again by the light it was baked in comes back as it was); night darkens the road, its lamps pool on it and glow;
// a sunset warms it; a wet mood darkens the road and lays the film the page lights; what a car is seen against follows
// the mood; absent, nothing; deterministic. One course (the smallest circuit), chosen from the presets.
import { describe, it, expect } from 'vitest';
import { planTrack, assembleTrackScene } from './track.js';
import { COURSE_PRESETS } from './course.js';
import { LIGHT } from './road-faces.js';
import { MOOD_TIMES, RACE_MOOD_IDS, moodOf, relightFaces, relightAlbedo, streetLights, moodGround } from './race-mood.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const course = Object.keys(COURSE_PRESETS)[0], m = { form: 'circuit', course };
const plan = planTrack(m), road = [...plan.roadFaces];
const luma = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const scenes = Object.fromEntries(['night', 'golden', 'night-rain'].map((id) => [id, assembleTrackScene({ ...m, mood: id })]));
const noon = assembleTrackScene(m);

describe('a race\'s mood', () => {
  it('under noon, the re-light is the identity', () => {
    const N = { ...MOOD_TIMES.noon, toLight: LIGHT.toLight };
    const back = relightFaces(road.slice(0, 40), N);
    back.forEach((f, i) => { const a = [1, 3, 5].map((k) => parseInt(road[i].fill.slice(k, k + 2), 16)), b = [1, 3, 5].map((k) => parseInt(f.fill.slice(k, k + 2), 16)); a.forEach((v, k) => expect(Math.abs(v - b[k])).toBeLessThanOrEqual(1)); });
    expect(() => moodOf('noon')).toThrow(new RegExp(RACE_MOOD_IDS.join(', ')));
  });

  it('night: the road dark, its lamps standing along it, glowing, their pools brighter than the dark between', () => {
    const S = scenes.night, lamps = streetLights(plan.sections, moodOf('night')).lamps;
    expect(lamps.length).toBeGreaterThan(4);
    expect(S.faces.filter((f) => f.glow).length).toBe(lamps.length);
    expect(S.sky.day).toBe(0);
    const lumas = (fs) => fs.filter((f) => f.texture === road[0].texture).flatMap((f) => (f.cornerFills ?? [f.fill]).map(luma));
    expect(mean(lumas(S.faces))).toBeLessThan(mean(lumas(noon.faces)) * 0.35);
    // under a lamp against the dark between: the brightest of the road's corners against its median
    const L = lumas(S.faces).sort((a, b) => a - b);
    expect(L[L.length - 1]).toBeGreaterThan(L[Math.floor(L.length / 2)] * 2);
  });

  it('a sunset warms the road: red over blue up against noon', () => {
    const ratio = (fs) => mean(fs.filter((f) => f.texture === road[0].texture).map((f) => parseInt(f.fill.slice(1, 3), 16) / Math.max(1, parseInt(f.fill.slice(5, 7), 16))));
    expect(ratio(scenes.golden.faces)).toBeGreaterThan(ratio(noon.faces) * 1.3);
    expect(scenes.golden.sky.sun).toEqual(MOOD_TIMES.golden.sun);
  });

  it('wet: the road darker than the dry night, and a film over every road face the page lights', () => {
    const W = scenes['night-rain'];
    expect(W.wetRoad.quads).toHaveLength(road.length);
    expect(W.wetRoad.lamps.length).toBe(W.faces.filter((f) => f.glow).length);
    const roadLuma = (S) => mean(S.faces.filter((f) => f.texture === road[0].texture).map((f) => luma(f.fill)));
    expect(roadLuma(W)).toBeLessThan(roadLuma(scenes.night));
    expect(scenes.night.wetRoad).toBeUndefined();
    const page = emitThreeWorld({ faces: road.slice(0, 2), wetRoad: { ...W.wetRoad, quads: W.wetRoad.quads.slice(0, 2) } });
    expect(page).toMatch(/wet road: the sky and the lamps/);
    expect(page).toMatch(/logdepthbuf_fragment/);
    expect(emitThreeWorld({ faces: road.slice(0, 2) })).not.toMatch(/wet road/);
  });

  it('what a car is seen against follows the mood, and a figure keeps its paint after dark', () => {
    const night = moodOf('night'), g = moodGround(night);
    expect(g.map((x) => x.what)).toEqual(['road', 'road', 'kerb', 'kerb', 'grass', 'sky']);
    expect(luma(g[0].hex)).toBeLessThan(luma(moodGround(moodOf('golden'))[0].hex));
    const up = [0, 0, 1];
    expect(luma(relightAlbedo('#c0392b', up, night, undefined, { figure: true }))).toBeGreaterThan(luma(relightAlbedo('#c0392b', up, night)) * 2);
  });

  it('absent, nothing; the same every time', () => {
    expect(noon.wetRoad).toBeUndefined();
    expect(noon.faces.some((f) => f.glow)).toBe(false);
    expect(JSON.stringify(assembleTrackScene({ ...m, mood: 'night' }))).toBe(JSON.stringify(scenes.night));
  });
});
