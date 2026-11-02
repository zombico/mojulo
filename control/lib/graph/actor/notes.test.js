// the director's notes: each note fires on the scene it is about, says why and what to try, and the department's page
// names every one
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { directorsNotes, NOTE_IDS, LONG_TAKE, STATIC, FAR } from './notes.js';
import { actScene } from './scene.js';
import { coverScene } from './coverage.js';
import { BASELINE } from './baseline.js';
import { STYLES, STYLE_NAMES } from './style.js';

const notesOf = (sc) => { const S = actScene(sc); return directorsNotes(S, coverScene(S)); };
const ids = (sc) => notesOf(sc).map((n) => n.id);

describe('the director\'s notes', () => {
  it('the baseline blocked scene draws none; every note says why and what to try', () => {
    expect(notesOf(BASELINE.blocked)).toEqual([]);
    const all = notesOf({ marks: { a: [-3, 0], b: [3, 0] }, cast: { mara: { mark: 'a' }, jon: { mark: 'b' } }, script: `MARA: ${'A very long line that goes on and on with no pause in it at all. '.repeat(4)}\nJON: Yes.\nMARA: No.\nJON: Yes.\nMARA: No.` });
    for (const n of all) { expect(NOTE_IDS).toContain(n.id); expect(n.why.length).toBeGreaterThan(20); expect(n.try.length).toBeGreaterThan(10); }
  });

  it('a long take, a still scene and a conversation across a room', () => {
    const long = 'A very long line that goes on and on with no pause in it at all. '.repeat(Math.ceil(LONG_TAKE / 2));
    const got = ids({ marks: { a: [-FAR, 0], b: [FAR, 0] }, cast: { mara: { mark: 'a' }, jon: { mark: 'b' } }, script: `MARA: ${long}\nJON: ${long}` });
    expect(got).toContain('long-take');
    expect(got).toContain('distance');
    expect(actScene({ marks: { a: [-FAR, 0], b: [FAR, 0] }, cast: { mara: { mark: 'a' }, jon: { mark: 'b' } }, script: `MARA: ${long}\nJON: ${long}` }).seconds).toBeGreaterThan(STATIC);
    expect(got).toContain('static');
  });

  it('a cross behind the partner flips the line and leaves the next speaker facing away', () => {
    const got = ids({ marks: { door: [-1, 0], window: [1, 0], behind: [2.2, 0.1] }, cast: { mara: { mark: 'door' }, jon: { mark: 'window' } }, script: 'MARA: Hello.\nMara crosses to the behind.\nJON: Hi.' });
    expect(got).toContain('line-flips');
    expect(got).toContain('back-turned');
  });

  it('many lines with no close; a speaking part played as background', () => {
    const plain = { ...BASELINE.blocked, script: BASELINE.blocked.script.replace(/ \((worried|determined)\)/g, '') };
    expect(ids(plain)).toContain('no-close');
    const background = STYLE_NAMES.find((n) => STYLES[n].gaze.line && STYLES[n].gaze.line !== 'lens');
    expect(ids({ ...BASELINE.blocked, cast: { ...BASELINE.blocked.cast, mara: { ...BASELINE.blocked.cast.mara, style: background } } })).toContain('extra-speaks');
  });

  it('the department\'s page names every note', () => {
    const page = readFileSync(new URL('../../../../docs/cinematics.md', import.meta.url), 'utf8'), section = page.slice(page.indexOf('## The director\'s notes'), page.indexOf('## The look'));
    for (const id of NOTE_IDS) expect(section, id).toContain(`**${id}**`);
  });
});
