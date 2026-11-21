import { describe, it, expect } from 'vitest';
import { FRONT_CARDS, FRONT_CARD_IDS, readFrontCard, frontCard, fallbackCard, SUBJECT_ROLES } from './loader.js';
import { RAILS } from '../../../gameworld/rails.js';

// THE FRONT CARDS: a start screen's layout is a card (data), read and checked when the loader loads, so a card that
// loads is one that lays out. One case per rule, on a card built here.
const card = (more = {}) => ({
  id: 'probe', name: 'Probe', about: 'a card for the reader', suits: ['racing'],
  slots: [{ roles: ['hero'], view: 'front', crop: 'full', anchor: 'bottom' }], ground: 'theme',
  frames: {
    wide: { subjects: [[50, 0, 50, 100]], title: { box: [0, 0, 50, 40], align: 'start', size: 'huge' }, menu: { box: [0, 60, 40, 30], align: 'start' } },
    tall: { subjects: [[0, 20, 100, 60]], title: { box: [0, 0, 100, 20], align: 'center', size: 'large' }, menu: { box: [0, 80, 100, 20], align: 'center' } },
  },
  motion: [{ part: 'title', enter: 'letters', at: 0 }, { part: 'menu', enter: 'stagger', at: 400 }],
  ...more,
});

describe('the front cards', () => {
  it('load, and the hero pose is the fallback', () => {
    expect(FRONT_CARD_IDS).toContain('hero-pose');
    expect(fallbackCard()?.id).toBe('hero-pose');
    expect(frontCard('hero-pose')).toBe(FRONT_CARDS['hero-pose']);
    expect(frontCard('nope')).toBeNull();
    expect(Object.isFrozen(FRONT_CARDS['hero-pose'].frames.wide.subjects[0])).toBe(true);
  });

  it('the face-off stands two subjects turned to each other on a split ground', () => {
    const F = FRONT_CARDS['face-off'];
    expect(F.slots.map((s) => s.facing)).toEqual(['right', 'left']);
    expect(F.ground).toBe('split');
    for (const f of ['wide', 'tall']) {
      const [a, b] = F.frames[f].subjects;
      expect(a[0] + a[2] / 2, f).toBeLessThan(b[0] + b[2] / 2);   // the one turned right stands on the left
    }
  });

  it('suit genres a rail names', () => {
    const genres = new Set(Object.values(RAILS).flatMap((r) => r.handles?.genres ?? []));
    for (const id of FRONT_CARD_IDS) for (const g of FRONT_CARDS[id].suits) expect(genres.has(g), `${id} suits ${g}`).toBe(true);
  });

  it('a card built here reads clean', () => {
    expect(() => readFrontCard(card(), 'probe.json')).not.toThrow();
  });

  it('teaches each fault', () => {
    expect(() => readFrontCard(card(), 'other.json')).toThrow(/id is the file's name/);
    expect(() => readFrontCard(card({ slots: [{ roles: ['villain'], view: 'front', crop: 'full', anchor: 'bottom' }] }), 'probe.json')).toThrow(new RegExp(SUBJECT_ROLES.join(', ')));
    const outside = card(); outside.frames.wide.subjects = [[60, 0, 50, 100]];
    expect(() => readFrontCard(outside, 'probe.json')).toThrow(/inside it/);
    const short = card(); short.frames.tall.subjects = [];
    expect(() => readFrontCard(short, 'probe.json')).toThrow(/for each of the 1 slots/);
    expect(() => readFrontCard(card({ frames: { wide: card().frames.wide } }), 'probe.json')).toThrow(/frames is \{ wide, tall \}/);
    expect(() => readFrontCard(card({ motion: [{ part: 'menu', enter: 'letters', at: 0 }, { part: 'title', enter: 'fade', at: 0 }] }), 'probe.json')).toThrow(/only the title enters letter by letter/);
    expect(() => readFrontCard(card({ motion: [{ part: 'title', enter: 'fade', at: 0 }] }), 'probe.json')).toThrow(/gives the menu its entrance/);
    expect(() => readFrontCard(card({ slots: [{ roles: ['hero'], view: 'front', crop: 'full', anchor: 'bottom', facing: 'up' }] }), 'probe.json')).toThrow(/facing is one of: left, right/);
    expect(() => readFrontCard(card({ ground: 'stripes' }), 'probe.json')).toThrow(/ground is one of: theme, plain, split/);
    expect(() => readFrontCard(card({ motion: [{ part: 'title', enter: 'fade', at: 0 }, { part: 'title', enter: 'rise', at: 9 }, { part: 'menu', enter: 'fade', at: 0 }] }), 'probe.json')).toThrow(/enters once/);
  });
});
