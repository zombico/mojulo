// export-model.persona.test.js — a persona exported: played as its hero, its reads the realistic face's `face:<read>`
// clips in the GLB, each read's captions and cue sheet written beside it. (On the E2E list: a hero minted whole.)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-persona-outcomes-'));

import { createCharacterHandler } from './create-character.js';
import { exportModelHandler } from './sketch-model-export.js';
import { readScript } from '../../graph/persona/read.js';

const NEWS = 'Good evening. The storm left 4,000 homes without power.\n\nIn sport, the Harbor Kings won 3-2.';

describe('a persona exported', () => {
  it('is its hero with its reads as face clips, and its captions and cue sheets beside the model', async () => {
    const hero = await createCharacterHandler({ as: 'hero', spec: { cast: 'female', form: 'realistic' } });
    const persona = await createCharacterHandler({ as: 'persona', spec: { hero: hero.ref, reads: { lead: { script: NEWS } } } });
    const out = await exportModelHandler({ ref: persona.ref, format: 'glb', clips: '_all', skinned: true });
    expect(out.ok).toBe(true);
    expect(out.persona.face).toEqual(['face:lead']);
    expect(out.persona.files).toEqual(['captions/lead.srt', 'captions/lead.vtt', 'cues/lead.json']);
    const doc = await new NodeIO().readBinary(new Uint8Array(readFileSync(out.path)));
    const take = doc.getRoot().listAnimations().find((a) => a.getName() === 'face:lead');
    expect(take).toBeTruthy();
    // (the clip is as long as the read, the captions and the cue sheet on its clock)
    const seconds = readScript({ script: NEWS }).seconds, input = take.listSamplers()[0].getInput().getArray();
    expect(input.at(-1)).toBeCloseTo(seconds, 1);
    const cues = JSON.parse(readFileSync(path.join(out.dir, 'cues/lead.json'), 'utf8'));
    expect(cues).toMatchObject({ id: 'lead', seconds, clips: { face: 'face:lead' } });
    expect(readFileSync(path.join(out.dir, 'captions/lead.srt'), 'utf8')).toMatch(/^1\n00:00:00,/);
    expect(readFileSync(path.join(out.dir, 'captions/lead.vtt'), 'utf8')).toMatch(/^WEBVTT/);
  }, 600_000);
});
