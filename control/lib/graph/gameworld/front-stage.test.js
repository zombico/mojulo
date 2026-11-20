import { describe, it, expect } from 'vitest';
import { frontSubjects, fillStage, frontStageSuggestion } from './front-stage.js';
import { FRONT_CARDS, FRONT_CARD_IDS, fallbackCard } from '../playscape/ui/front-cards/loader.js';
import { readFrontStage } from '../game/front-stage.js';
import { RAILS } from './rails.js';

// THE START SCREEN'S SUBJECTS: what a game's runs made, each under its role; a stage suggested only when there is
// something to show, the same world giving the same stage. One case per rule.
const rec = (ref) => ({ ref, order: '00000000', stored: '00000000' });
const W = (more = {}) => ({ id: 'w', levels: {}, ...more });
const fb = fallbackCard();
// a rail whose genres a card suits, and one whose genres none suits (so the fallback is offered)
const railOf = (pred) => Object.keys(RAILS).find((r) => pred(RAILS[r].handles?.genres ?? []));
const suitedRail = railOf((gs) => FRONT_CARD_IDS.some((id) => FRONT_CARDS[id].suits.some((g) => gs.includes(g))));
const unsuitedRail = railOf((gs) => !FRONT_CARD_IDS.some((id) => FRONT_CARDS[id].suits.some((g) => gs.includes(g))));

describe('a game\'s start-screen subjects', () => {
  it('reads each role from what the runs made, in order, the hero once', () => {
    const made = { 'foe-2': rec('f2'), hero: rec('h'), 'hero-equipped': rec('he'), ride: rec('r'), foe: rec('f'), 'cast-mira': rec('c'), 'gear-blade': rec('g'), 'level-a': rec('L'), systems: rec('s') };
    expect(frontSubjects(W({ made }))).toEqual([
      { role: 'hero', ref: 'he', from: 'made.hero-equipped' },
      { role: 'ally', ref: 'c', from: 'made.cast-mira' },
      { role: 'foe', ref: 'f', from: 'made.foe' },
      { role: 'foe', ref: 'f2', from: 'made.foe-2' },
      { role: 'ride', ref: 'r', from: 'made.ride' },
      { role: 'prop', ref: 'g', from: 'made.gear-blade' },
    ]);
  });

  it('takes the adopted hero when no run made one', () => {
    expect(frontSubjects(W({ characters: { hero: { ref: 'mine' } } }))).toEqual([{ role: 'hero', ref: 'mine', from: 'characters.hero.ref' }]);
    expect(frontSubjects(W({ characters: { hero: { ref: 'mine' } }, made: { hero: rec('h') } }))[0].ref).toBe('h');
  });

  it('a game with nothing made has none', () => {
    expect(frontSubjects(W())).toEqual([]);
    expect(frontSubjects(W({ made: { systems: rec('s'), 'level-a': rec('L') } }))).toEqual([]);
  });
});

describe('filling a card', () => {
  const subjects = [{ role: 'hero', ref: 'h' }, { role: 'ally', ref: 'a1' }, { role: 'ally', ref: 'a2' }];
  const two = { slots: [{ roles: ['ally'] }, { roles: ['ally', 'hero'] }] };
  it('each slot takes the first of its roles not yet stood, in the subjects\' order of importance', () => {
    expect(fillStage(two, subjects)).toEqual([{ role: 'ally', ref: 'a1' }, { role: 'hero', ref: 'h' }]);
  });
  it('a wanted role or ref is stood in its slot', () => {
    expect(fillStage(two, subjects, ['ally', 'ally'])).toEqual([{ role: 'ally', ref: 'a1' }, { role: 'ally', ref: 'a2' }]);
    expect(fillStage(two, subjects, ['zz9', 'ally'])).toEqual([{ role: null, ref: 'zz9' }, { role: 'ally', ref: 'a1' }]);
  });
  it('a slot nothing fills leaves no stage', () => {
    expect(fillStage({ slots: [{ roles: ['ride'] }] }, subjects)).toBeNull();
  });
});

describe('the start screen suggested', () => {
  const lead = fb.slots[0].roles[0];
  const made = { [lead === 'hero' ? 'hero' : 'cast-x']: rec('lead') };

  it('a game with something to show is offered a stage that reads, the same each time', () => {
    const S = frontStageSuggestion(W({ made, rail: { from: suitedRail } }));
    expect(S).not.toBeNull();
    expect(FRONT_CARDS[S.composition].suits.some((g) => RAILS[suitedRail].handles.genres.includes(g))).toBe(true);
    expect(readFrontStage(S.patch[0].value.stage)).toEqual([]);
    expect(S.patch).toEqual([{ op: 'set', path: '/front', value: { stage: { composition: S.composition, subjects: S.subjects } } }]);
    expect(frontStageSuggestion(W({ made, rail: { from: suitedRail } }))).toEqual(S);
  });

  it('a genre no card suits is offered the fallback', () => {
    if (!unsuitedRail) return;
    expect(frontStageSuggestion(W({ made, rail: { from: unsuitedRail } }))?.composition).toBe(fb.id);
    expect(frontStageSuggestion(W({ made }))?.composition).toBe(fb.id);
  });

  it('a front of its own is patched beside what it has', () => {
    const S = frontStageSuggestion(W({ made, front: { tagline: 'go' } }));
    expect(S.patch).toEqual([{ op: 'set', path: '/front/stage', value: { composition: S.composition, subjects: S.subjects } }]);
  });

  it('nothing to show, or a stage already, is offered none', () => {
    expect(frontStageSuggestion(W())).toBeNull();
    // a ride alone: offered only by a card every slot of which a ride can stand
    const rideAlone = FRONT_CARD_IDS.some((id) => FRONT_CARDS[id].slots.length === 1 && FRONT_CARDS[id].slots[0].roles.includes('ride'));
    if (!rideAlone) expect(frontStageSuggestion(W({ made: { ride: rec('r') } }))).toBeNull();
    expect(frontStageSuggestion(W({ made, front: { stage: { composition: fb.id } } }))).toBeNull();
  });
});
