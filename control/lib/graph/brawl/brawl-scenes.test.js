// A STREET'S SCENES (brawl-scenes.js): a few beats played with the fight held. The concepts: a scene is read against
// its belt, steps by frames, shows one beat at a time, is put on by accept and ended by skip.
import { describe, it, expect } from 'vitest';
import { readScenes, sceneOf, stepScene, sceneShows, sceneFrames, SCENE_LIMITS } from './brawl-scenes.js';
import { readBelt } from './brawl-belt.js';
import { readStreet } from './brawl-street.js';
import { brawlYardData } from './brawl-page.js';

const belt = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], screens: [{ length: 20 }, { length: 20, gate: true }] }, 'belt');
const beats = [{ look: 30 }, { title: 'The Yard', sub: 'held by the punks', secs: 1 }, { pan: [30, 6], secs: 1 }, { say: 'This is our street.', who: 'Boss' }, { wait: 0.5 }];
const run = (pad = () => ({})) => { const seen = []; let s = sceneOf(); for (let f = 0; f < 2000 && !s.done; f++) { s = stepScene(beats, s, pad(f, s)); seen.push({ ...sceneShows(beats, s), at: s.at }); } return seen; };

describe('read', () => {
  it('a street\'s scenes are read against its belt, and each fault is said', () => {
    expect(readScenes({ arrive: beats }, belt).arrive).toHaveLength(beats.length);
    expect(() => readScenes({ arrive: [{ pan: [0, 99] }] }, belt)).toThrow(/along the belt/);
    expect(() => readScenes({ arrive: [{ shout: 'hey' }] }, belt)).toThrow(/is a beat/);
    expect(() => readScenes({ arrive: [{ say: 'hi', pan: [0, 1] }] }, belt)).toThrow(/not a .* beat's word/);
    expect(() => readScenes({ 'Bad Id': beats }, belt)).toThrow(/short lower-case name/);
    expect(() => readScenes({ arrive: [] }, belt)).toThrow(/beats/);
    expect(readStreet({ waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }], scenes: { arrive: beats } }, belt, 'street').scenes.arrive).toHaveLength(beats.length);
  });
  it('a street with none carries none: not a byte on its page', () => {
    const block = { belt, street: { players: [0], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }] } };
    expect(brawlYardData(block).street.scenes).toBeUndefined();
    expect(brawlYardData({ ...block, street: { ...block.street, scenes: { arrive: beats } } }).street.scenes.arrive).toHaveLength(beats.length);
  });
});

describe('played', () => {
  it('a beat at a time, each as long as it says, to its end; the same again', () => {
    const seen = run(), total = beats.reduce((n, b) => n + sceneFrames(b), 0);
    expect(seen).toHaveLength(total);
    expect(seen[seen.length - 1].done).toBe(true);
    expect(seen.filter((s) => s.title === 'The Yard')).toHaveLength(60);
    expect(seen.find((s) => s.say)).toMatchObject({ say: 'This is our street.', who: 'Boss' });
    expect(run()).toEqual(seen);
  });
  it('the camera is cut to a look, travels a pan eased from its start to its end, and stays where it was left', () => {
    // (a frame is said after it is stepped: the first one at the pan is the card's last, the camera not yet moved)
    const seen = run(), pan = seen.filter((s) => s.at === 2).slice(1);
    expect(seen[0].cam).toBe(30);
    expect(pan[0].cam).toBeLessThan(30); expect(pan[0].cam).toBeGreaterThan(29);            // (eased: slow off the mark)
    for (let k = 1; k < pan.length; k++) expect(pan[k].cam).toBeLessThanOrEqual(pan[k - 1].cam);
    expect(seen.filter((s) => s.say)[0].cam).toBeCloseTo(6, 6);
    expect(sceneOf().cam).toBeNull();                                                       // (none said yet: the fight's own)
  });
  it('accept puts a line or a card away once it has been seen; skip ends the scene', () => {
    const quick = run((f, s) => ({ accept: s.at === 3 }));
    expect(quick.filter((s) => s.say).length).toBeLessThan(20);
    expect(quick.length).toBeLessThan(run().length);
    const skipped = run((f) => ({ skip: f === 5 }));
    expect(skipped).toHaveLength(6); expect(skipped[5].done).toBe(true);
    // (a pan is not put away by accept: it is the camera's)
    expect(run((f, s) => ({ accept: s.at === 2 })).filter((s) => s.at === 2).length).toBeGreaterThanOrEqual(59);
  });
  it('a line stands by its length when it says no time, within a breath and a long read', () => {
    const short = sceneFrames({ say: 'No.' }), long = sceneFrames({ say: Array(40).fill('word').join(' ') });
    expect(short).toBeGreaterThanOrEqual(1.8 * SCENE_LIMITS.frames); expect(long).toBeLessThanOrEqual(7 * SCENE_LIMITS.frames); expect(long).toBeGreaterThan(short);
  });
});
