import { describe, it, expect } from 'vitest';
import { readGameworld, basePrint, pinBase, verifyBase, revisionLookup } from './index.js';

const hero = (cast) => ({ kind: 'layered', title: 't', hero: { cast, head: 'anime' } });
const world = (base) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters: { direction: { tradition: 'anime' }, hero: { looks: { base } } } });

describe('the hero\'s base', () => {
  it('the print is the hero\'s spec: a rename moves nothing, an edit to the hero does', () => {
    expect(basePrint({ ...hero('female'), title: 'other' })).toBe(basePrint(hero('female')));
    expect(basePrint(hero('male'))).not.toBe(basePrint(hero('female')));
    expect(basePrint(hero('female'))).toMatch(/^[0-9a-f]{8}$/);
  });

  it('a pin is { ref, rev, print }, and is the shape the character book reads', () => {
    const pin = pinBase({ ref: 'h1', rev: 1, manifest: hero('female') });
    expect(pin).toEqual({ ref: 'h1', rev: 1, print: basePrint(hero('female')) });
    expect(readGameworld(world(pin)).characters.hero.looks.base).toEqual(pin);
  });

  it('says what is wrong with a pin', () => {
    expect(() => pinBase({ rev: 1, manifest: hero('x') })).toThrow(/names the sketch ref/);
    expect(() => pinBase({ ref: 'h', rev: 0, manifest: hero('x') })).toThrow(/a revision, 1 or more/);
    expect(() => pinBase({ ref: 'h', rev: 1 })).toThrow(/manifest of that revision/);
  });

  it('a pinned revision stays pinned across edits; a changed one is drifted; a gone one is missing', () => {
    const base = hero('female'), edited = hero('male');
    const pin = pinBase({ ref: 'h1', rev: 1, manifest: base });
    // after one edit: rev 1 is archived, the row is HEAD at rev 2
    const lookup = revisionLookup({ ref: 'h1', headRev: 2, head: edited, get: (r, rev) => (rev === 1 ? base : null) });
    expect(verifyBase(pin, lookup)).toEqual({ status: 'pinned', print: pin.print });
    // the pin on HEAD itself reads the row
    expect(verifyBase({ ...pin, rev: 2 }, lookup)).toMatchObject({ status: 'drifted', was: pin.print });
    expect(verifyBase({ ...pin, rev: 3 }, lookup)).toMatchObject({ status: 'missing' });
    expect(verifyBase({ ...pin, ref: 'zz' }, lookup)).toMatchObject({ status: 'missing' });
    expect(verifyBase(undefined, lookup)).toMatchObject({ status: 'missing', why: 'no base is pinned' });
    // an archive that no longer reads the pinned manifest has drifted
    expect(verifyBase(pin, revisionLookup({ ref: 'h1', headRev: 2, head: edited, get: () => edited }))).toMatchObject({ status: 'drifted' });
  });
});
