import { describe, it, expect } from 'vitest';
import { readFrontStage, STAGE_TREATMENTS } from './front-stage.js';
import { readFront, frontConfig } from './play-front.js';
import { FRONT_CARD_IDS, FRONT_CARDS } from '../playscape/ui/front-cards/loader.js';

// THE START SCREEN'S STAGE: the front's `stage`, read for its shape and its card; a role or a ref resolves later. A
// front without a stage is the front it was.
const id = FRONT_CARD_IDS[0], card = FRONT_CARDS[id];
const role = card.slots[0].roles[0];

describe('reading a front stage', () => {
  it('a stage of a card, a role, a mode and a treatment reads clean', () => {
    expect(readFrontStage({ composition: id })).toEqual([]);
    expect(readFrontStage({ composition: id, subjects: [role], mode: '3d', treatment: STAGE_TREATMENTS[0] })).toEqual([]);
    expect(readFrontStage({ composition: id, subjects: ['aB3-sketch_ref'] })).toEqual([]);
  });

  it('teaches each fault', () => {
    expect(readFrontStage('hero-pose')[0]).toMatch(/is \{ composition/);
    expect(readFrontStage({ composition: 'nope' })[0]).toMatch(new RegExp(id));
    expect(readFrontStage({ composition: id, look: 1 })[0]).toMatch(/look: not part of a stage/);
    expect(readFrontStage({ composition: id, subjects: Array(card.slots.length + 1).fill(role) })[0]).toMatch(/stands \d subject/);
    const wrong = ['hero', 'ally', 'foe', 'ride', 'prop'].find((r) => !card.slots[0].roles.includes(r));
    expect(readFrontStage({ composition: id, subjects: [wrong] })[0]).toMatch(/slot 1 stands/);
    expect(readFrontStage({ composition: id, mode: 'video' })[0]).toMatch(/mode is one of/);
    expect(readFrontStage({ composition: id, treatment: 'sepia' })[0]).toMatch(/treatment is one of/);
  });

  it('is read as part of the front, and the page is as it was', () => {
    expect(readFront({ stage: { composition: id } })).toEqual([]);
    expect(readFront({ stage: { composition: 'nope' } })[0]).toMatch(/^front\.stage\.composition/);
    const front = { tagline: 'go', press: true };
    expect(frontConfig({ ...front, stage: { composition: id } }, null)).toEqual(frontConfig(front, null));
  });
});
