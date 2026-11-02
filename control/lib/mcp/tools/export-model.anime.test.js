// The anime hero acting, minted at the door and exported (E2E: whole heroes through the real handlers). The concepts: a
// take on the anime head is a face-only STEP clip (face-acting/anime-read.js: a drawing per frame); at `acting: 'full'`
// it plays the 7G drawings' targets and their correctives (anime-face-rig.js sevenG), its recorded line inside the file
// and beside the Godot pack's scene; a hero that draws no 7G plays the same take lowered to its four channels.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { createCharacterHandler } from './create-character.js';
import { exportModelHandler } from './sketch-model-export.js';
import { buildGodotWorldPack } from '../../graph/scene/godot-pack.js';
import { FACE_TARGETS, drawTarget, fixTarget } from '../../graph/polygonizer/anime-face-rig.js';

// (where the line was recorded before the door saved it: any folder)
const OUT = mkdtempSync(path.join(os.tmpdir(), 'mojulo-anime-told-'));
/** a WAV a line was recorded to: a second of a tone after a quarter of silence, 16 kHz, 16-bit */
function toneWav(dir) {
  const rate = 16000, n = Math.round(1.25 * rate), data = Buffer.alloc(n * 2);
  for (let i = Math.round(0.25 * rate); i < n; i++) data.writeInt16LE(Math.round(16000 * Math.sin((2 * Math.PI * 330 * i) / rate)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  const at = path.join(dir, 'anime-told.wav'); writeFileSync(at, Buffer.concat([h, data])); return at;
}
const PERFORM = () => ({
  acted: { seconds: 3, beats: [{ at: 0, face: 'anger', onset: 'posed' }, { at: 1.5, face: 'surprise', onset: 'posed', gaze: 'away' }] },
  told: { beats: [{ at: 0.25, face: 'happiness', say: { text: 'Let us go.', audio: toneWav(OUT) } }] },
});
const read = async (ref) => {
  const out = await exportModelHandler({ ref, format: 'glb', clips: '_all', skinned: true, lit: true });
  expect(out.ok).toBe(true);
  const doc = await new NodeIO().readBinary(new Uint8Array(readFileSync(out.path))), root = doc.getRoot();
  const glb = readFileSync(out.path), json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')), bin = glb.subarray(20 + glb.readUInt32LE(12) + 8);
  const mesh = root.listMeshes().find((m) => m.listPrimitives().some((p) => p.listTargets().length)), names = mesh.getExtras()?.targetNames ?? [];
  return { root, json, bin, names, prim: mesh.listPrimitives().find((p) => p.listTargets().length) };
};

describe('the anime hero acting, minted and exported', () => {
  it('at acting full: the 7G drawings and their correctives as targets, each take a STEP clip, the recorded line inside the file and beside the Godot scene', async () => {
    const minted = await createCharacterHandler({ as: 'hero', spec: { cast: 'male', head: 'anime', acting: 'full', perform: PERFORM() } });
    expect(minted.ok).toBe(true);
    const { root, json, bin, names, prim } = await read(minted.ref);
    expect(prim.listTargets().length).toBe(names.length);
    expect(names.slice(0, FACE_TARGETS.length)).toEqual(FACE_TARGETS);
    expect(names).toEqual(expect.arrayContaining([drawTarget('brows.angry', 'L'), drawTarget('lids.wide', 'R'), drawTarget('mouth.a'), drawTarget('gaze.left'), fixTarget('lids.angry', 'gaze.right', 'L'), fixTarget('brows.raised', 'shut', 'R')]));
    for (const take of ['face:acted', 'face:told']) {
      const A = root.listAnimations().find((a) => a.getName() === take);
      expect(A, take).toBeTruthy();
      expect(A.listSamplers().map((s) => s.getInterpolation())).toEqual(['STEP']);
      expect(A.listSamplers()[0].getOutput().getCount()).toBe(A.listSamplers()[0].getInput().getCount() * names.length);
    }
    // (the acted take draws anger's brows: some key weighs its target fully)
    const acted = root.listAnimations().find((a) => a.getName() === 'face:acted').listSamplers()[0].getOutput().getArray(), j = names.indexOf(drawTarget('brows.angry', 'L'));
    expect(Array.from({ length: acted.length / names.length }, (_, k) => acted[k * names.length + j]).some((x) => x === 1)).toBe(true);
    const told = json.meshes.flatMap((m) => m.extras?.face?.performances ?? []).find((p) => p.clip === 'face:told');
    expect(told).toMatchObject({ interpolation: 'STEP' }); expect(told.audio[0]).toMatchObject({ at: 0.25, mimeType: 'audio/wav' });
    const view = json.bufferViews[told.audio[0].bufferView];
    expect(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + 4).toString('ascii')).toBe('RIFF');
    const godot = await buildGodotWorldPack({ ref: minted.ref, outDir: mkdtempSync(path.join(os.tmpdir(), 'mojulo-godot-anime-voice-')) });
    expect(readFileSync(path.join(godot.dir, 'voice', `${told.audio[0].recording}.wav`)).subarray(0, 4).toString('ascii')).toBe('RIFF');
  });
  it('drawing no 7G (the default target, T2): the same takes lowered to the four channels', async () => {
    const minted = await createCharacterHandler({ as: 'hero', spec: { cast: 'female', head: 'anime', perform: PERFORM() } });
    expect(minted.ok).toBe(true);
    const { root, names } = await read(minted.ref);
    expect(names).toEqual(FACE_TARGETS);
    const A = root.listAnimations().find((a) => a.getName() === 'face:told');
    expect(A.listSamplers().map((s) => s.getInterpolation())).toEqual(['STEP']);
    // (the line opens the mouth's channel at some key)
    const out = A.listSamplers()[0].getOutput().getArray(), j = names.indexOf('mouthOpen');
    expect(Array.from({ length: out.length / names.length }, (_, k) => out[k * names.length + j]).some((x) => x > 0.2)).toBe(true);
  });
}, 600000);
