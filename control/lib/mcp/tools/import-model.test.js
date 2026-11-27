process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-import-outcomes-'));
import { describe, it, expect } from 'vitest';
import { mintSolidHandler } from './mint-solid.js';
import { createCharacterHandler } from './create-character.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { latestBoundMesh } from '@/lib/graph/scene/mesh-store.js';
import { WORLD_KINDS } from '@/lib/graph/worlds/world-kinds.js';
import { modelPack } from '@/lib/graph/worlds/controllable/model-figure.js';
import { person, boxGlb } from '@/lib/graph/import/test-figures.js';

// files on this machine, as a person brings them: a crate as an OBJ in centimetres, a person in a T as a GLB
const dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-import-files-'));
const crate = path.join(dir, 'crate.obj');
writeFileSync(crate, ['v 0 0 0', 'v 50 0 0', 'v 50 50 0', 'v 0 50 0', 'v 0 0 50', 'v 50 0 50', 'v 50 50 50', 'v 0 50 50',
  'f 1 2 3 4', 'f 5 8 7 6', 'f 1 5 6 2', 'f 2 6 7 3', 'f 3 7 8 4', 'f 4 8 5 1'].join('\n'));
const man = path.join(dir, 'man.glb');
writeFileSync(man, person());
const block = path.join(dir, 'block.glb');
writeFileSync(block, boxGlb([[0, 0, 0, 1, 1, 1]]));

describe('mint_solid({ kind: \'model\' }): an object made elsewhere', () => {
  it('reads the file, mints a model row of what was decided, and binds the file to it', async () => {
    const out = await mintSolidHandler({ kind: 'model', spec: { from: crate, units: 'cm', licence: 'CC0-1.0' }, ref: 'imp_crate' });
    expect(out.ok).toBe(true);
    const row = SketchRepository.getByRef('imp_crate');
    expect(row.manifest).toMatchObject({ kind: 'model', units: 'm', import: { file: 'crate.obj', format: 'obj', units: 'cm', class: 'prop', rig: 'none', licence: { name: 'CC0-1.0', basis: 'stated' } } });
    expect(row.manifest.import.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(out.import.stands).toBe('0.5 × 0.5 × 0.5 m');
    const slot = latestBoundMesh('imp_crate');
    expect(JSON.parse(readFileSync(slot.sidecarPath, 'utf8'))).toMatchObject({ source: 'import', scale_applied: 0.01, source_units: 'cm' });
    // its World: the studio, the crate in metres
    const scene = await WORLD_KINDS.model.resolve(row.manifest, { ref: 'imp_crate', title: 'crate' });
    const zs = scene.faces.filter((f) => f.group === 'model').flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(0.5, 3);
  });

  it('refuses a URL, naming the step that brings the file here', async () => {
    await expect(mintSolidHandler({ kind: 'model', spec: { from: 'https://example.test/a.glb' } })).rejects.toThrow(/is a URL: mojulo reads a file on this machine/);
  });
});

describe('create_character({ from }): a character made elsewhere', () => {
  it('fits an unrigged person onto the vajra, gates it, and a world plays it by modelRef', async () => {
    const out = await createCharacterHandler({ from: man, ref: 'imp_man' });
    expect(out.ok).toBe(true);
    expect(out.import).toMatchObject({ class: { is: 'body' }, rig: { how: 'auto', bones: 21 }, gate: { verdict: 'pass' } });
    expect(SketchRepository.getByRef('imp_man').manifest.import).toMatchObject({ class: 'body', rig: 'auto' });
    expect(out.next.reason).toMatch(/modelRef: 'imp_man'/);
    expect(out.next.reason).toMatch(/eyes gate is the person's/);
    const pack = await modelPack('hero', 'imp_man');
    expect(pack.bones.map((b) => b.id)).toEqual(expect.arrayContaining(['pelvis', 'handL', 'footR']));
    expect(pack.figH).toBeCloseTo(1.8, 1);
  });

  it('refuses a prop as a character, naming the object door, and a spec beside a file', async () => {
    await expect(createCharacterHandler({ from: block })).rejects.toThrow(/reads as a prop.*mint_solid\(\{ kind: 'model'/);
    await expect(createCharacterHandler({ from: man, spec: { cast: 'male' } })).rejects.toThrow(/takes from, as\?, height\?/);
    await expect(createCharacterHandler({ from: man, as: 'animal' })).rejects.toThrow(/`as: 'hero'`.*`as: 'mascot'`/);
  });
});
