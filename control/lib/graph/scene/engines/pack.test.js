// THE PACK PIPELINE's pieces (engines/pack.js), held to what every leg relies on. Whole packs are held byte for byte by
// each leg's own tests; here, the concepts: a figure's resting clip, a clean emit that keeps the developer's folder and
// their seed files, the guards and a transformer's starting form.
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { emitFolder, refusePixelizer, packHash, startingForms, figureClip } from './pack.js';

describe('figureClip', () => {
  it('idle when the figure has it, else the first looping clip, else the first; none ⇒ null', () => {
    const K = { pelvis: 5 };
    expect(figureClip({ gesture: [K], idle: [K, {}], walk: [K, {}] })).toBe('idle');
    expect(figureClip({ gesture: [K], wave: [K, {}, K], walk: [K, {}] })).toBe('wave');
    expect(figureClip({ gesture: [K] })).toBe('gesture');
    expect(figureClip({})).toBeNull();
    // the clips the GLB carries choose among the recipe's
    expect(figureClip({ idle: [K, {}], walk: [K, {}] }, ['walk'])).toBe('walk');
  });
});

describe('emitFolder', () => {
  it('clean-emits, keeps the folder the developer owns, and writes a seed file only where missing', async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-pack-'));
    await fs.mkdir(path.join(outDir, 'game'), { recursive: true });
    await fs.writeFile(path.join(outDir, 'game', 'hooks.gd'), 'mine');
    await fs.writeFile(path.join(outDir, 'stale.json'), 'old');
    const { written, writeOut } = await emitFolder({ outDir, keep: 'game', files: [
      { rel: 'score.json', data: '{}' }, { rel: 'game/hooks.gd', data: 'seed', seed: true }, { rel: 'game/new.gd', data: 'seed', seed: true },
    ] });
    await writeOut('portability.json', '[]');
    expect(written.map((w) => w.file)).toEqual(['score.json', 'game/new.gd', 'portability.json']);
    expect(await fs.readFile(path.join(outDir, 'game', 'hooks.gd'), 'utf8')).toBe('mine');
    await expect(fs.stat(path.join(outDir, 'stale.json'))).rejects.toThrow();
    await fs.rm(outDir, { recursive: true, force: true });
  });
});

describe('the guards', () => {
  it('refuses a pixelizer game with the leg\'s reason', () => {
    expect(() => refusePixelizer({ manifest: { engine: 'pixelizer', kind: 'game' } }, 'g', 'a 2D reducer is not a scene')).toThrow(/refused: 'g' is a pixelizer game — a 2D reducer is not a scene/);
    expect(refusePixelizer({ manifest: { kind: 'game' } }, 'g', 'x')).toEqual({ kind: 'game' });
    // the recipe's identity: a stamped quality grade never moves the hash
    expect(packHash({ kind: 'game', quality: 'A' })).toBe(packHash({ kind: 'game' }));
  });
});

// A transformer's hero (worlds/controllable/forms.js) carries `forms` and no rule: the page picks the rule when it
// starts. An engine pack takes the hero as its starting form.
describe('startingForms', () => {
  const hero = { id: 'hero', pilotable: true, forms: { robot: { rule: { type: 'walk', speed: 4 } }, vehicle: { rule: { type: 'drive' } } }, transform: { pos: [0, 0, 0] } };
  const level = (e) => ({ entities: [e, { id: 'crate', rule: { type: 'walk' } }], camera: { rule: 'follow', target: 'hero' } });

  it('gives a body in two forms its starting form\'s rule, the page\'s choice of it', () => {
    expect(startingForms(level(hero)).entities[0]).toMatchObject({ form: 'robot', rule: { type: 'walk', speed: 4 } });
    expect(startingForms(level({ ...hero, form: 'vehicle' })).entities[0]).toMatchObject({ form: 'vehicle', rule: { type: 'drive' } });
    // a form named that is not one of them falls back to the first, as on the page
    expect(startingForms(level({ ...hero, form: 'boat' })).entities[0].form).toBe('robot');
  });

  it('leaves every other payload as it is, the same object', () => {
    for (const p of [level({ ...hero, rule: { type: 'fly' } }), level({ id: 'hero', pilotable: true, rule: { type: 'walk' } }), { faces: [] }, null]) {
      expect(startingForms(p)).toBe(p);
    }
    // one form is no transformer: the page leaves it be, and so does this
    expect(startingForms(level({ ...hero, forms: { robot: hero.forms.robot } })).entities[0].rule).toBeUndefined();
  });
});
