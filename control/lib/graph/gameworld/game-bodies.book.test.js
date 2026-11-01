// the body rails on the book hero (hero-looks.js bodyOfGame): `characters.direction.body` names the body the game puts in
// it. The concepts: absent, the hero is composed as it was; 'game' reads the rail off the game's kind (none when its kind
// names none); the style follows the tradition and the world's look; the muscle shirt only when asked; the body page's own
// words win and are ledgered; the composed hero mints through the door; a body that is not a rail is refused.
import { describe, it, expect } from 'vitest';
import { MEADOWMARK_HERO } from './examples.js';
import { readGameworld } from './world.js';
import { composeHero, heroOrders, bodyOfGame } from './hero-looks.js';
import { heroRecord } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';

const world = (direction = {}, more = {}, body) => {
  const C = MEADOWMARK_HERO.characters;
  // (a western hero leaves the example's anime face and hair words: the head is not the body's)
  const looks = { ...C.hero.looks, ...(body !== undefined ? { body } : {}), ...(direction.tradition === 'western' ? { head: {}, hair: 'ponytail' } : {}) };
  const hero = { ...C.hero, looks };
  return readGameworld({ ...MEADOWMARK_HERO, ...more, characters: { ...C, hero, direction: { ...C.direction, ...direction } } });
};

describe('the body rails on the book hero', () => {
  it('composes the hero as it was when the direction names no body', () => {
    const C = composeHero(world());
    expect(C.body).toBeUndefined();
    expect(C.spec.animeBody).toBeUndefined();
    expect(C.spec.muscleShirt).toBeUndefined();
    expect(bodyOfGame(world())).toBeNull();
  });
  it('reads the rail off the game\'s kind, and none from a kind that names none', () => {
    const C = composeHero(world({ body: 'game' }, { intent: { from: 'versus-fighter' } }));
    expect(C.body).toMatchObject({ rail: 'muscular', style: 'anime', from: 'genre' });
    // (the body page's cast word names the pole: her base's codename, its tune under the page's own)
    expect(C.spec.animeBody).toBe('mizuki');
    expect(C.spec.tune).toEqual({ legs: 1.06, shoulders: 1.03 });
    expect(C.spec.muscleShirt).toBeUndefined();
    expect(C.elements.body.reads.body).toBe('muscular · anime');
    expect(bodyOfGame(world({ body: 'game' }, { intent: { from: 'farming' } }))).toBeNull();
  });
  it('styles the rail by the tradition and the look, and puts the shirt on only when asked', () => {
    expect(composeHero(world({ body: { rail: 'muscular', muscle: true } })).spec.muscleShirt).toEqual({ definition: 1 });
    const ink = composeHero(world({ tradition: 'western', body: 'comic' }));
    expect(ink.spec.cast).toEqual({ pole: 'female', build: 'heroic' });
    const material = composeHero(world({ tradition: 'western', body: 'comic' }, { juice: { look: 'material' } }));
    expect(material.spec).toMatchObject({ form: 'realistic', physique: 'jacked' });
    expect(composeHero(world({ body: { rail: 'realistic' } })).spec.animeBody).toBe('shonen-high');
  });
  it('keeps the body page\'s own words over the rail\'s, each departure ledgered', () => {
    const C = composeHero(world({ body: 'muscular' }, {}, { cast: 'female', animeBody: 'maki' }));
    expect(C.spec.animeBody).toBe('maki');
    expect(C.ledger).toContainEqual(expect.objectContaining({ scope: 'rail', key: 'animeBody', world: 'mizuki', local: 'maki' }));
  });
  it('mints the composed hero through the door, in each tradition', () => {
    for (const [direction, more] of [[{ body: { rail: 'muscular', muscle: true } }, {}], [{ tradition: 'western', body: 'comic' }, { juice: { look: 'material' } }], [{ tradition: 'western', body: 'mascot' }, {}]]) {
      const O = heroOrders(world(direction, more));
      expect(() => heroRecord(withDefaultForm(O.mint.args.spec)), JSON.stringify(direction)).not.toThrow();
    }
  }, 120000);
  it('refuses a body that is not a rail', () => {
    expect(() => world({ body: 'hulk' })).toThrow(/direction\.body/);
  });
});
