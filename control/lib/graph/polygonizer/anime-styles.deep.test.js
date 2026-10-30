// The head casts, swept (the deep tier: `npm run test:deep`, and CI): every cast on each base, its default face advised
// nothing by its own bands (a cast is a canon of its own), its face and tune words inside the studio's ranges, its sculpt
// words read as the door reads them (only a hero's own departures from its form and cast: animeSculptBase), and its head
// built closed, which is what holds a cast's sculpt words in place of the comfortable ranges; so a cast added to the
// table is held to all of it the day it lands. anime-styles.test.js keeps the laws on one cast.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';
import { heroFeatureAdvice, animeHeroEffective, animeSculptBase, heroHeadPole } from './anime-looks.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { animeFaceWarnings } from './anime-head.js';
import { animeSculptWarnings } from './anime-sculpt.js';
import { tuneWarnings } from './hero-form.js';
import { ANIME_STYLE_NAMES } from './anime-styles.js';

describe('every head cast, on each base', () => {
  for (const animeStyle of ANIME_STYLE_NAMES) it(animeStyle, () => {
    for (const cast of ['male', 'female']) {
      const hero = heroRecord({ cast, head: 'anime', animeStyle }), inc = heroPlanOf(hero).include[0], f = inc.faceMeasures.features;
      expect(heroFeatureAdvice(hero, f), `${animeStyle} ${cast}`).toEqual([]);
      const E = animeHeroEffective(hero);
      expect([...animeFaceWarnings(E.face, heroHeadPole(hero)), ...tuneWarnings(E.tune), ...animeSculptWarnings(E.sculpt, { base: animeSculptBase(hero) })], `${animeStyle} ${cast}`).toEqual([]);
      const head = compileLayered({ parts: inc.parts, dials: {}, creases: {} });
      expect(Object.entries(auditLayered(head)).filter(([, r]) => !r.pass).map(([n]) => n), `${animeStyle} ${cast} closed`).toEqual([]);
    }
  });
}, 600000);
