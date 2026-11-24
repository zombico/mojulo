// The backdrop's ambient motion (ambient.js): named render groups sway, twinkle or blink on the page's clock, each vertex
// phased by where it stands. The concepts: absent adds nothing; what a group asks is read and held to the channel's
// measures (a group that asks nothing is dropped); a page that carries it patches only the groups it names.
import { describe, it, expect } from 'vitest';
import { ambientScript, readAmbient, AMBIENT } from './ambient.js';
import { emitThreeWorld } from '../scene-three.js';

const quad = (x, group) => ({ corners: [[x, 0, 0], [x, 1, 0], [x, 1, 1], [x, 0, 1]], normal: [1, 0, 0], fill: '#8899aa', group });
const FACES = [quad(0, 'a'), quad(-2, 'clouds')];

describe('the backdrop\'s ambient motion', () => {
  it('a page without it carries none of it', () => {
    expect(ambientScript(null)).toBe('');
    expect(ambientScript({ groups: {} })).toBe('');
    expect(ambientScript({ groups: { clouds: {} } })).toBe('');
    const bare = emitThreeWorld({ faces: FACES, inline: true }), none = emitThreeWorld({ faces: FACES, inline: true, ambient: null });
    expect(none).toBe(bare);
    expect(bare).not.toContain('mojulo-ambient');
  });

  it('reads a sway, a twinkle and a blink, held to its measures', () => {
    const R = readAmbient({ groups: { sway: { amp: [0, 99, 0.5], period: 0.1, spread: 0.3 }, twinkle: { depth: 2, beat: 3 }, blink: { depth: 0.8, beat: 1.5, duty: 0.4 }, nothing: { amp: [0, 0, 0], period: 9 } } });
    expect(Object.keys(R)).toEqual(['sway', 'twinkle', 'blink']);
    // (no faster than its slowest beat, no further than its reach)
    expect(R.sway.a).toEqual([0, AMBIENT.maxAmp, 0.5, AMBIENT.minPeriod]);
    expect(R.twinkle.b).toEqual([0, 1, 3, 0]);
    expect(R.blink.b).toEqual([0, 0.8, 1.5, 0.4]);
    // (a wheel turns about its pivot, no faster than its measure)
    expect(readAmbient({ groups: { wheel: { spin: { at: [10, 4], rate: -9 } } } }).wheel.s).toEqual([0, 10, 4, -AMBIENT.maxRate]);
  });

  it('patches the groups it names, on the page\'s pinned clock', () => {
    const html = emitThreeWorld({ faces: FACES, inline: true, ambient: { groups: { clouds: { amp: [0, 4, 0], period: 60 } } } });
    expect(html).toContain('mojulo-ambient');
    expect(html).toContain('window.__mojClock');
    // (only the group it names: the other keeps its plain material)
    expect(Object.keys(JSON.parse(html.match(/const AMB = (\{.*?\});/)[1]))).toEqual(['clouds']);
  });
});
