/**
 * Links: scapeshift makes the place and marks where it asks to be joined; playscape answers with a verb and the entry
 * that performs it, in the kit's own style, held to the man-made index's laws and its own.
 */
import { describe, expect, it } from 'vitest';

import { riseLinks, linkStyle, answerAnchor, partSwatches, PART_SWATCH, LINK_VERBS, HOP_MARGIN } from './links.js';
import { resolveObject, ENTRIES } from './objects/index.js';
import { outTrailSite } from '../era/out-trail.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { MADE_KITS } from '../era/out-made.js';

const verbs = (ls) => ls.filter((l) => l.fits).map((l) => `${l.verb}:${l.variant ?? '-'}`);

describe('every way between two levels', () => {
  it('a low lip is hopped; it fits stairs only where the ground gives their run', () => {
    const near = riseLinks([0, 0, 0], [0, 1.5, 1.2]), far = riseLinks([0, 0, 0], [0, 6, 1.2]);
    expect(near.find((l) => l.verb === 'hop').fits).toBe(true);
    expect(verbs(near)).not.toContain('walk:steps');
    expect(verbs(far)).toEqual(expect.arrayContaining(['walk:flight', 'walk:steps', 'walk:ramp']));
  });

  it('a high wall is climbed or ridden, never hopped; down is a drop while it is safe', () => {
    const wall = riseLinks([0, 0, 0], [0, 0.3, 7]);
    expect(verbs(wall)).toEqual(expect.arrayContaining(['climb:rungs', 'climb:rope', 'ride:ride', 'launch:fixed']));
    expect(verbs(wall)).not.toContain('hop:-');
    expect(verbs(wall)).not.toContain('climb:net');   // a net sags past 6 m
    expect(riseLinks([0, 0, 3], [0, 1, 0]).find((l) => l.verb === 'drop')).toMatchObject({ fits: true, oneWay: true });
    expect(riseLinks([0, 0, 6], [0, 1, 0]).find((l) => l.verb === 'drop').fits).toBe(false);
  });

  it('the hop is the walker\'s own jump: a stronger jump hops a higher lip', () => {
    const lip = [0, 1, 1.8];
    expect(riseLinks([0, 0, 0], lip).find((l) => l.verb === 'hop').fits).toBe(false);
    expect(riseLinks([0, 0, 0], lip, { rider: { jumpSpeed: 10 } }).find((l) => l.verb === 'hop').fits).toBe(true);
    expect(HOP_MARGIN).toBeGreaterThan(0);
  });

  it('every verb names its entry, and every entry it names exists', () => {
    for (const l of riseLinks([0, 0, 0], [0, 12, 4])) if (l.entry) expect(ENTRIES[l.entry]).toBeTruthy();
    expect(Object.keys(LINK_VERBS)).toEqual(['walk', 'climb', 'cross', 'ride', 'launch', 'hop', 'drop']);
  });
});

describe('the kit\'s style, read from its made tokens', () => {
  it('every outdoor kit reads as words the entries take', () => {
    for (const kit of MADE_KITS) for (const seed of [1, 2, 3]) {
      const s = linkStyle(kit, seed);
      expect(() => resolveObject({ entry: 'ladder', to: [0, 0, 3], rise: 3, facing: [0, -1], ...s.ladder })).not.toThrow();
      expect(() => resolveObject({ entry: 'stairs', from: [0, 0, 0], rise: 1, ...s.stairs })).not.toThrow();
      expect(Object.keys(s.swatch)).toEqual(expect.arrayContaining(['timber', 'stone', 'rope']));
    }
  });

  it('lashed culm hangs a rope bridge and lashes its ladders; pegged timber decks one', () => {
    expect(linkStyle('isekai-bamboo').bridge.variant).toBe('rope');
    expect(linkStyle('isekai-bamboo').ladder).toEqual({ timber: 'culm', joint: 'lashed' });
    expect(linkStyle('nature-trail', 1, { tokens: { joint: 'pegged' } }).bridge.variant).toBe('deck');
  });

  it('a trail narrowing a token narrows what is built', () => {
    expect(linkStyle('isekai-meadow', 1, { tokens: { edge: 'stone' } }).stairs.edge).toBe('stone');
  });

  it('every part an entry builds has a swatch role for the tone', () => {
    const named = new Set(Object.values(PART_SWATCH).flat());
    const objs = [
      ...['ladder', 'rungs', 'rope', 'net'].map((v) => resolveObject({ entry: 'ladder', variant: v, to: [0, 0, 7], rise: 7, facing: [0, -1], elements: { cage: true } })),
      ...['flight', 'steps', 'ramp'].flatMap((v) => ['timber', 'stone'].map((edge) => resolveObject({ entry: 'stairs', variant: v, from: [0, 0, 0], rise: 3.2, edge, elements: { handrail: true } }))),
      ...['plank', 'deck', 'rope', 'arch'].map((v) => resolveObject({ entry: 'bridge', variant: v, from: [0, 0, 0], to: [10, 0, 0] })),
    ];
    for (const o of objs) for (const p of o.elements) expect(named.has(p) ? p : `${o.entry}.${p} has no swatch role`).toBe(p);
    const sw = partSwatches(objs[0], linkStyle('isekai-sakura'));
    expect(sw.rails).toEqual({ role: 'timber', ramp: 'timber' });
  });
});

describe('a scapeshift trail\'s anchors, answered', () => {
  const site = outTrailSite(ISEKAI_STYLES['isekai-meadow'], { heartbeat: 1, bumpiness: 0.5, beats: ['pit', 'reveal', 'crossing', 'pocket'] }, 3);
  const A = site.out.anchors;

  it('every stairs site gets a walk where one fits, else a climb, and holds its laws', () => {
    const sites = A.filter((a) => a.kind === 'site' && a.site === 'stairs');
    expect(sites.length).toBeGreaterThan(1);
    for (const a of sites) {
      const r = answerAnchor(a, { kit: 'isekai-meadow', seed: 3 });
      expect(['walk', 'climb']).toContain(r.verb);
      if (r.others.some((o) => o.verb === 'walk' && o.fits)) expect(r.verb).toBe('walk');
      expect(r.laws.filter((l) => l.ok === false)).toEqual([]);
      // it reaches the level above the site
      const top = r.object.walk?.top ?? r.object.climb?.top;
      expect(top[2]).toBeCloseTo(a.at[2] + Math.abs(a.rise) / 2, 3);
    }
  });

  it('a gentle site gets the trail\'s own outdoor steps', () => {
    const gentle = A.find((a) => a.kind === 'site' && Math.abs(a.rise) < 1.6);
    expect(answerAnchor(gentle, { kit: 'isekai-meadow' })).toMatchObject({ verb: 'walk', variant: 'steps' });
  });

  it('a pit is bridged in the kit\'s joinery, beside the hop it already is', () => {
    const pit = A.find((a) => a.hazard === 'pit');
    const meadow = answerAnchor(pit, { kit: 'isekai-meadow', seed: 3 }), jungle = answerAnchor(pit, { kit: 'jungle-mgs3', seed: 3 });
    expect(meadow).toMatchObject({ verb: 'cross', entry: 'bridge', variant: 'deck' });
    expect(jungle).toMatchObject({ verb: 'cross', entry: 'bridge', variant: 'rope' });
    expect(meadow.others.find((o) => o.verb === 'hop')).toMatchObject({ fits: true });
    expect(answerAnchor(pit, { kit: 'isekai-meadow', prefer: 'hop' })).toMatchObject({ verb: 'hop', entry: null, object: null });   // the pit as it is: nothing to build
  });

  it('a stream is bridged, or forded', () => {
    const water = A.find((a) => a.hazard === 'water'), r = answerAnchor(water, { kit: 'isekai-meadow' });
    expect(r).toMatchObject({ verb: 'cross', entry: 'bridge' });
    expect(r.others.find((o) => o.verb === 'walk')).toMatchObject({ fits: true });
  });

  it('anything with two ends is answered; `prefer` takes a verb or an entry first', () => {
    const ends = { id: 'tower', from: [0, 0, 0], to: [0, 0.4, 6] };
    expect(answerAnchor(ends, { prefer: 'ride' })).toMatchObject({ verb: 'ride', entry: 'lift' });
    expect(answerAnchor(ends, { prefer: 'rope' })).toMatchObject({ verb: 'climb', variant: 'rope' });
    expect(() => answerAnchor({ kind: 'beat', beat: 'rest' })).toThrow(/stairs site, a pit or water hazard/);
  });
});
