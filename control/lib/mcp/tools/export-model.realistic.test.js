// export-model.realistic.test.js — the realistic hero's whole loop: minted by the character door (`form: 'realistic'`,
// its relational head by default, the fitted shirt and the trousers), exported as the lit skinned GLB an engine takes,
// and read back by glTF-Transform (a malformed file throws there): one skinned mesh on the rig's joints, the clips, the
// correctives as morph targets by name, the head's and the body's normals. (On the E2E list: a hero minted whole.)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-realistic-outcomes-'));

import { createCharacterHandler } from './create-character.js';
import { exportModelHandler } from './sketch-model-export.js';
import { readDermis, skinBase, hexLin } from '../../graph/epidermis/dermal-map.js';

describe('the realistic hero, minted and exported', () => {
  it('mints at the door and exports a lit skinned GLB an engine reads: the joints, the clips, the correctives, the normals', async () => {
    const minted = await createCharacterHandler({ as: 'hero', spec: { cast: 'female', form: 'realistic', outfit: ['fittedShirt', 'trousers'] } });
    expect(minted.ok).toBe(true);
    expect(minted.hero.head).toBe('relational');
    const out = await exportModelHandler({ ref: minted.ref, format: 'glb', clips: '_all', skinned: true, lit: true });
    expect(out.ok).toBe(true);
    const doc = await new NodeIO().readBinary(new Uint8Array(readFileSync(out.path)));
    const root = doc.getRoot(), skinned = root.listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getAttribute('JOINTS_0'));
    expect(skinned).toHaveLength(1);
    const prim = skinned[0];
    for (const a of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) expect(prim.getAttribute(a), a).toBeTruthy();
    expect(root.listSkins()[0].listJoints().length).toBeGreaterThan(40);
    expect(root.listAnimations().map((a) => a.getName())).toEqual(expect.arrayContaining(['body:idle', 'body:walk', 'body:wave']));
    // the correctives a raised arm drives, one morph target each, by name
    const names = root.listMeshes().find((m) => m.listPrimitives().includes(prim)).getExtras()?.targetNames ?? [];
    expect(prim.listTargets().length).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(['pauldronBagR', 'shoulderLevelL', 'shoulderOverheadR']));
    // every vertex's weights sum to one
    const W = prim.getAttribute('WEIGHTS_0'), w = [0, 0, 0, 0];
    for (let i = 0; i < W.getCount(); i += 97) { W.getElement(i, w); expect(Math.abs(w[0] + w[1] + w[2] + w[3] - 1)).toBeLessThan(1e-3); }
    // the skin: the dermis's atlas (the body's page over the head's) as the base colour, each skin corner on it
    const uv = prim.getAttribute('TEXCOORD_0'), tex = prim.getMaterial()?.getBaseColorTexture();
    expect(uv).toBeTruthy();
    expect(tex?.getMimeType()).toBe('image/png');
    const [tw, th] = tex.getSize();
    expect(tw).toBeGreaterThanOrEqual(1024);
    expect(th).toBeGreaterThan(1024);
    // the head's page (1024 texels tall) is the atlas's foot, under the body's: some corners (the face's) land there
    const t = [0, 0]; let onHead = 0;
    for (let i = 0; i < uv.getCount(); i += 13) { uv.getElement(i, t); if (t[1] > (th - 1024) / th) onHead++; }
    expect(onHead).toBeGreaterThan(0);
    // the skin under the shirt and the trousers: no texel (the atlas's white), its colour the skin's base (the palette's Skin)
    const base = hexLin(skinBase(readDermis({ from: 'female' }))), C = prim.getAttribute('COLOR_0'), c = [0, 0, 0];
    let under = 0;
    for (let i = 0; i < C.getCount(); i++) { C.getElement(i, c); if (Math.max(...c.map((x, k) => Math.abs(x - base[k]))) < 2e-3) { uv.getElement(i, t); if (t[1] < 0.01) under++; } }
    expect(under).toBeGreaterThan(1000);
  }, 600_000);
});
