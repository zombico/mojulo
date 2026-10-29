// export-model.realistic.test.js — the realistic hero's whole loop: minted by the character door (`form: 'realistic'`,
// its relational head by default, the fitted shirt and the trousers), exported as the lit skinned GLB an engine takes,
// and read back by glTF-Transform (a malformed file throws there): one skinned mesh on the rig's joints, the clips, the
// correctives as morph targets by name, the head's and the body's normals. (On the E2E list: a hero minted whole.)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-realistic-outcomes-'));

import { createCharacterHandler } from './create-character.js';
import { exportModelHandler } from './sketch-model-export.js';
import { hexLin } from '../../graph/epidermis/dermal-map.js';
import { SketchRepository } from '../../db/repositories/sketches.js';
import { expandLayeredManifest } from './layered.js';
import { buildGodotWorldPack } from '../../graph/scene/godot-pack.js';
import { buildUnrealAssetPack } from '../../graph/scene/unreal-pack.js';

const OUT = process.env.MOJULO_OUTCOMES_DIR;
/** a WAV a line was recorded to: a second of a tone after a quarter of silence, 16 kHz, 16-bit */
function toneWav(dir) {
  const rate = 16000, n = Math.round(1.25 * rate), data = Buffer.alloc(n * 2);
  for (let i = Math.round(0.25 * rate); i < n; i++) data.writeInt16LE(Math.round(16000 * Math.sin((2 * Math.PI * 220 * i) / rate)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  const at = path.join(dir, 'told.wav'); writeFileSync(at, Buffer.concat([h, data])); return at;
}

describe('the realistic hero, minted and exported', () => {
  it('mints at the door and exports a lit skinned GLB an engine reads: the joints, the clips, the correctives, the normals', async () => {
    const minted = await createCharacterHandler({ as: 'hero', spec: { cast: 'female', form: 'realistic', outfit: ['fittedShirt', 'trousers'],
      perform: { hello: { seconds: 2, beats: [{ at: 0, face: 'neutral' }, { at: 0.5, face: 'amused', flash: true, gaze: 'away', say: 'Hi, you.' }] },
        // (a recorded line: the door saves it, aligns its text to it, and the export embeds it)
        told: { beats: [{ at: 0.25, face: 'neutral', say: { text: 'Hi.', audio: toneWav(OUT) } }] } },
      emote: { idle: { emote: 'rest', seconds: 4 } } } });
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
    // (and its face's, the realistic head's own actions: relational-face-rig.js)
    expect(names).toEqual(expect.arrayContaining(['blink', 'blinkLeft', 'smile', 'browRaise']));
    // (the FACS units by side and the gaze's look targets; a performance a face-only LINEAR clip on them: face-acting/)
    expect(names).toEqual(expect.arrayContaining(['frownLeft', 'cheekRaiseRight', 'eyeLookUpLeft', 'eyeLookOutRight']));
    // (and speech's: the lips' shapes and the jaw as ARKit's jawOpen, a line spoken in the take)
    expect(names).toEqual(expect.arrayContaining(['pucker', 'funnel', 'rollLower', 'lipsPart', 'jawOpen']));
    // (the recorded take carries its recording inside the file: its bytes a WAV in the GLB's own buffer)
    const glb = readFileSync(out.path), json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')), bin = glb.subarray(20 + glb.readUInt32LE(12) + 8);
    const told = json.meshes.flatMap((m) => m.extras?.face?.performances ?? []).find((p) => p.clip === 'face:told');
    expect(told.audio).toHaveLength(1); expect(told.audio[0]).toMatchObject({ at: 0.25, mimeType: 'audio/wav' });
    const view = json.bufferViews[told.audio[0].bufferView];
    expect(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + 4).toString('ascii')).toBe('RIFF');
    const take = root.listAnimations().find((a) => a.getName() === 'face:hello');
    expect(take).toBeTruthy();
    expect(take.listSamplers().map((sm) => sm.getInterpolation())).toEqual(['LINEAR']);
    expect(take.listSamplers()[0].getInput().getCount()).toBe(2 * 30 + 1);
    // (an emote a face-only clip that loops: its last key its first; the mouth's ownership said for an engine's lip-sync)
    const emote = root.listAnimations().find((a) => a.getName() === 'emote:idle'), es = emote.listSamplers()[0], ev = es.getOutput().getArray();
    expect(es.getInterpolation()).toBe('LINEAR');
    expect(es.getInput().getCount()).toBe(4 * 30 + 1);
    expect([...ev.slice(ev.length - names.length)]).toEqual([...ev.slice(0, names.length)]);
    const faceX = root.listMeshes().find((m) => m.listPrimitives().includes(prim)).getExtras()?.face;
    expect(faceX.emotes).toEqual([{ clip: 'emote:idle', emote: 'rest', seconds: 4, loop: true }]);
    expect(faceX.mouth.driver).toEqual(expect.arrayContaining(['jawOpen', 'lipsPart']));
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
    // the skin under the shirt and the trousers: no texel (the atlas's white), its colour the skin's base (the palette's
    // Skin: the hero's own, its rolled face's tone, not a preset's)
    const base = hexLin(expandLayeredManifest(SketchRepository.getByRef(minted.ref).manifest).recipe.palette.Skin), C = prim.getAttribute('COLOR_0'), c = [0, 0, 0];
    let under = 0;
    for (let i = 0; i < C.getCount(); i++) { C.getElement(i, c); if (Math.max(...c.map((x, k) => Math.abs(x - base[k]))) < 2e-3) { uv.getElement(i, t); if (t[1] < 0.01) under++; } }
    expect(under).toBeGreaterThan(1000);
    // THE ENGINE PACKS (engine-voice.test.js the emitted importers): the recorded line ships beside the GLB, once, and
    // each importer is told the take it plays with
    const rec = told.audio[0].recording;
    const godot = await buildGodotWorldPack({ ref: minted.ref, outDir: mkdtempSync(path.join(os.tmpdir(), 'mojulo-godot-voice-')) });
    expect(readFileSync(path.join(godot.dir, 'voice', `${rec}.wav`)).subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(godot.figure.voice).toBe(1); expect(godot.ledger.figure_voice.note).toMatch(/^1 recorded line/);
    const unreal = await buildUnrealAssetPack({ ref: minted.ref, outDir: mkdtempSync(path.join(os.tmpdir(), 'mojulo-unreal-voice-')) });
    expect(readFileSync(path.join(unreal.dir, 'Voice', `${rec}.wav`)).subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(readFileSync(path.join(unreal.dir, 'import_mojulo.py'), 'utf8')).toContain(`"clip":"face:told","at":0.25,"file":"Voice/${rec}.wav"`);
  }, 900_000);
});
