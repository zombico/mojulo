// The head casts, swept (the deep tier: `npm run test:deep`, and CI): every cast on each base, its default face advised
// nothing by its own bands (a cast is a canon of its own) and every word it sets inside the studio's ranges, so a cast
// added to the table is held to both the day it lands. anime-styles.test.js keeps the laws on one cast.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';
import { heroFeatureAdvice, animeHeroEffective, heroHeadPole } from './anime-looks.js';
import { animeFaceWarnings } from './anime-head.js';
import { animeSculptWarnings } from './anime-sculpt.js';
import { tuneWarnings } from './hero-form.js';
import { ANIME_STYLE_NAMES } from './anime-styles.js';

describe('every head cast, on each base', () => {
  for (const animeStyle of ANIME_STYLE_NAMES) it(animeStyle, () => {
    for (const cast of ['male', 'female']) {
      const hero = heroRecord({ cast, head: 'anime', animeStyle }), f = heroPlanOf(hero).include[0].faceMeasures.features;
      expect(heroFeatureAdvice(hero, f), `${animeStyle} ${cast}`).toEqual([]);
      const E = animeHeroEffective(hero);
      expect([...animeFaceWarnings(E.face, heroHeadPole(hero)), ...tuneWarnings(E.tune), ...animeSculptWarnings(E.sculpt)], `${animeStyle} ${cast}`).toEqual([]);
    }
  });
}, 600000);
