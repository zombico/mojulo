// skin-paint.test.js — a creature's hide painted into one atlas (value only: light rims round darker cells), on the
// faces its regions cover, the rest on a white tile; the character light's step falls over it. One scaled roll.
import { describe, expect, it } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet } from '../egocube/plan.js';
import { compileOutfit } from './outfit-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered } from './station-loft.js';
import { drawnPlan } from './creature-drawn.js';
import { skinPaintOf, validateSkin, SKIN_MIN_PX } from './skin-paint.js';

const plan = planFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'draconic' } }), { dress: 'designed' }).create.spec.plan;
const mesh = compileLayered(expandPlan(drawnPlan(compileOutfit(plan))), {});
const partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part;

describe('the skin', () => {
  it('a scaled people\'s roll carries it by region: plates on a reptile\'s head, scales down the limbs, scutes down the front', () => {
    expect(validateSkin(plan.skin)).toEqual([]);
    const by = Object.fromEntries(plan.skin.map((R) => [R.pattern + (R.t ? 'Front' : ''), R]));
    expect(by.plates.parts).toEqual(['cranium', 'jaw']);
    expect(by.scales.parts).toContain('foreArm');
    expect(by.bandsFront.t[1]).toBeLessThan(0.5);
    expect(by.plates.cell).toBeLessThan(by.bandsFront.cell);   // the head's finer than the belly's
  });
  it('paints the covered faces into one atlas, the rest on its white tile; a cap\'s apex and the cloth are not hide', () => {
    const S = skinPaintOf(mesh, plan.skin);
    expect(S.url).toMatch(/^data:image\/png;base64,/); expect(S.atlas.w).toBe(1024);
    let arm = 0, armAll = 0; mesh.faces.forEach((_, fi) => { if (partOf(fi) === 'foreArmR') { armAll++; if (S.painted(fi)) arm++; } });
    expect(arm / armAll).toBeGreaterThan(0.6);
    expect(mesh.faces.some((_, fi) => partOf(fi).startsWith('adorn.') && S.painted(fi))).toBe(false);
    // a painted face's corner lands inside the atlas; the light under it is the fill lifted (the pattern's mean)
    const fi = mesh.faces.findIndex((_, i) => S.painted(i)), uv = S.uvAt({ vi: mesh.faces[fi][0] });
    expect(uv.every((x) => x >= 0 && x <= 1)).toBe(true);
    expect(parseInt(S.light('#404040').slice(1, 3), 16)).toBeGreaterThan(0x40);
  });
  it('the drawn tier drops a region too fine to read; none, or no regions, paints nothing; the same mesh, the same bytes', () => {
    expect(skinPaintOf(mesh, plan.skin, { ppm: (SKIN_MIN_PX - 0.5) / Math.max(...plan.skin.map((R) => R.cell)) })).toBeNull();
    expect(skinPaintOf(mesh, [])).toBeNull(); expect(skinPaintOf(mesh, undefined)).toBeNull();
    expect(skinPaintOf(mesh, plan.skin).key).toBe(skinPaintOf(mesh, plan.skin).key);
  });
  it('says what is wrong with a region', () => {
    expect(validateSkin([{ parts: ['torso'], pattern: 'fur', cell: 0.02 }])[0]).toMatch(/pattern: 'scales' \| 'plates' \| 'bands'/);
    expect(validateSkin([{ parts: ['torso'], pattern: 'scales', cell: 2 }])[0]).toMatch(/cell: metres/);
  });
});
