// The beast's style: its cover's qualities (beast/cover.js COVER_STYLE) and the animal door's oozes lowered onto its
// anatomy (beast/ooze.js, beast/style.js). One case per procedure, the oozes and the kin chosen in code by what their rows
// and cards carry: a crest that glows, a composition that grows the masses, a recoloured head group; the hero's own
// word standing over an ooze's; what the tiered body does not carry, named.
import { describe, it, expect } from 'vitest';
import { BEAST_KINS } from './cards.js';
import { beastWords, beastCard } from './tiered.js';
import { coverTile, coverErrors, COVER_STYLE } from './cover.js';
import { beastOozeOf, UPRIGHT_MASS } from './ooze.js';
import { OOZES } from '../mutagen/oozes/index.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, auditRig } from '../polygonizer/station-loft-rig.js';

const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const ids = Object.keys(OOZES), row = (pred) => ids.find((id) => pred(OOZES[id]));
// (by what the rows carry: a crest that glows and a cover quality; growth by form; a recoloured group)
const GLOWING = row((o) => o.push?.hackles?.glow && o.push?.cover && o.push?.eyes?.glow), GROWN = row((o) => o.form?.bulk > 1 && o.push?.wedge), RECOLOURED = row((o) => o.push?.groups);
const FURRED = Object.keys(BEAST_KINS).find((k) => BEAST_KINS[k].cover === 'fur' && !BEAST_KINS[k].ridge && !BEAST_KINS[k].legs);

describe('the cover\'s qualities', () => {
  it('the default is the tile as it was; each word moves its tile; metal fills the metal channel', () => {
    expect(coverTile('fur', {})).toBe(coverTile('fur'));
    const base = (s) => coverTile('fur', s).maps.base;
    expect(base({ length: 'shaggy' })).not.toBe(base({})); expect(base({ tipped: 0.6 })).not.toBe(base({}));
    expect(coverTile('scales', { size: 'large' }).maps.size).toBeGreaterThan(coverTile('scales').maps.size);
    expect(coverTile('scales', { shape: 'keeled' }).maps.height).not.toBe(coverTile('scales').maps.height);
    const metal = coverTile('chitin', { sheen: 'metal' }).orm;
    expect(metal[(10 * 128 + 10) * 3 + 2]).toBe(255); expect(coverTile('chitin').orm[(10 * 128 + 10) * 3 + 2]).toBe(0);
  });
  it('refuses a quality its kind does not take, by name', () => {
    expect(coverErrors({ kind: 'scales', length: 'shaggy' }).join()).toMatch(/cover\.length: scales takes/);
    expect(coverErrors({ kind: 'fur', sheen: 'oily' }).join()).toMatch(/cover\.sheen: matte/);
    expect(coverErrors({ kind: 'fur', tipped: 2 }).join()).toMatch(/tipped/);
    for (const kind of ['fur', 'scales']) for (const w of Object.keys(COVER_STYLE)) {
      const T = w === 'sheen' ? COVER_STYLE.sheen : COVER_STYLE[w][kind]; if (T) expect(coverErrors({ kind, [w]: Object.keys(T)[0] })).toEqual([]);
    }
    expect(validateHeroSpec({ cast: 'male', beast: { kin: FURRED, cover: { kind: 'fur', length: 'short', sheen: 'glossy' } } })).toEqual([]);
  });
});

describe('oozes on the beast-kin', () => {
  it(`an ooze (${GLOWING}) tones the coat, raises a crest in its own glowing group, lights the eyes and styles the cover`, () => {
    const plain = heroPlanOf(mint({ cast: 'male', beast: { kin: FURRED } })), H = mint({ cast: 'male', beast: { kin: FURRED, ooze: GLOWING, seed: 3 } }), P = heroPlanOf(H);
    expect(P.palette.Skin).not.toBe(plain.palette.Skin);
    expect(P.segments.some((s) => /^spine/.test(s.name) && s.group === 'Spines')).toBe(true);
    expect(P.emissive).toEqual(expect.arrayContaining(['Spines', 'Iris']));
    expect(P.heads[0].plan.palette.Iris).toBe(OOZES[GLOWING].push.eyes.color);
    const C = beastCard(H); for (const [w, v] of Object.entries(OOZES[GLOWING].push.cover)) if (w === 'tipped' || COVER_STYLE[w]?.fur || w === 'sheen') expect(C.coverStyle[w]).toBe(v);
    // (deterministic; the hero's own word stands over the ooze's)
    expect(JSON.stringify(heroPlanOf(mint({ cast: 'male', beast: { kin: FURRED, ooze: GLOWING, seed: 3 } })))).toBe(JSON.stringify(P));
    expect(beastCard(mint({ cast: 'male', beast: { kin: FURRED, ooze: GLOWING, ridge: 'none' } })).ridge).toBe('none');
  }, 60_000);

  it(`a composition ([${GROWN}, half of ${GLOWING}]) grows the masses, read at half on an upright body; what it cannot carry is named`, () => {
    const kin = beastCard(mint({ cast: 'male', beast: { kin: FURRED } })), C = beastCard(mint({ cast: 'male', beast: { kin: FURRED, ooze: [GROWN, { id: GLOWING, strength: 0.5 }] } }));
    expect(C.mass.trunk).toBeGreaterThan(kin.mass.trunk);
    const F = OOZES[GROWN], whole = (F.form.bulk ?? 1) * (F.push.wedge?.fore ?? 1);
    expect(C.mass.trunk).toBeCloseTo(Math.min(2, kin.mass.trunk * whole ** UPRIGHT_MASS), 2);
    const L = beastOozeOf({ kin: FURRED, ooze: [GROWN, { id: GLOWING, strength: 0.5 }] });
    if (F.form.scale) expect(L.pending.join()).toMatch(/scale/);
    expect(L.pending.join()).toMatch(/marks/);
  });

  it(`a recoloured group (${RECOLOURED}) lands where the body or its head has it: its colour and its material`, () => {
    const P = heroPlanOf(mint({ cast: 'male', beast: { kin: FURRED, ooze: RECOLOURED } })), G = OOZES[RECOLOURED].push.groups;
    const onHead = Object.keys(G).filter((g) => P.heads[0].plan.palette[g]);
    expect(onHead.length).toBeGreaterThan(0);
    // (a colour word, the coat's own colour: mutagen/push.js colorWords)
    for (const g of onHead) { expect(P.heads[0].plan.palette[g]).toMatch(/^#[0-9a-f]{6}$/i); if (/^#/.test(G[g].color)) expect(P.heads[0].plan.palette[g]).toBe(G[g].color); if (G[g].material) expect(P.surfaces[g]).toBe(G[g].material); }
  });

  it('the door refuses an ooze it does not know and a seed that is not one; an oozed beast binds and rigs whole', () => {
    expect(validateHeroSpec({ cast: 'male', beast: { kin: FURRED, ooze: 'lava' } }).join()).toMatch(/beast\.ooze: unknown ooze/);
    expect(validateHeroSpec({ cast: 'male', beast: { kin: FURRED, ooze: GLOWING, seed: -1 } }).join()).toMatch(/beast\.seed/);
    const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero: mint({ cast: 'male', beast: { kin: FURRED, ooze: [GROWN, GLOWING] } }) }), R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials);
    const A = auditRig(mesh, bindLayered(mesh, recipe, R), R);
    expect(A.badWeights).toBe(0); expect(recipe.emissive).toContain('Spines');
  }, 60_000);
});
