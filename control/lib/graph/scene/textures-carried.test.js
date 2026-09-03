/**
 * Phase 3 of skin-over-mesh.plan.md: textures flip from an implicit gap to a
 * CARRIED ledger line. The GLB already embeds them (facesToGlb reads
 * payload.textures); the score now names the keys, and both engine emitters
 * state the carry. Untextured worlds stay byte-identical.
 */
import { describe, expect, it } from 'vitest';

import { extractEngineScore } from './engine-score.js';
import { emitGodotProject } from './godot-project.js';
import { emitUnityProject, unityLevelLedger } from './unity-project.js';

const sketch = { ref: 'sk_tex', manifest: { kind: 'floorplan-world', title: 'tex world' } };
const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('engine score — texture keys ride the score', () => {
  it('names the payload texture keys, sorted', () => {
    const score = extractEngineScore(sketch, { textures: { 'skin-atlas': PNG_URL, 'marble-carrara': PNG_URL } });
    expect(score.textures).toEqual(['marble-carrara', 'skin-atlas']);
  });

  it('untextured payloads carry no key — byte-identical to pre-phase-3', () => {
    expect('textures' in extractEngineScore(sketch, {})).toBe(false);
    expect('textures' in extractEngineScore(sketch, { textures: {} })).toBe(false);
  });
});

describe('engine emitters — the carried line', () => {
  const score = (extra = {}) => ({
    ref: 'sk_tex', title: 'tex', units: 'u', ground: 0, eye: 1.7,
    colliders: [], cameras: [], entities: [], mechanics: [], soundtrack: null, ledger: {},
    ...extra,
  });

  it('godot README names textures as carried, not lost', () => {
    const { files, ledger } = emitGodotProject({
      ref: 'w', score: score({ textures: ['marble-carrara'] }), manifestHash: 'h', kernelVersion: '0.1.1',
    });
    expect(ledger.textures_carried.count).toBe(1);
    const readme = files.find((f) => f.file === 'README.md').text;
    expect(readme).toContain('textures_carried');
    expect(readme).toContain('multiply with the baked vertex colours');
  });

  it('unity ledger names textures as carried via glTFast', () => {
    const ledger = unityLevelLedger(score({ textures: ['skin-atlas'] }));
    expect(ledger.textures_carried.kinds).toEqual(['skin-atlas']);
    const { files } = emitUnityProject({ ref: 'w', score: score({ textures: ['skin-atlas'] }), manifestHash: 'h' });
    expect(files.find((f) => f.file === 'IMPORT-GUIDE.md').text).toContain('textures_carried');
  });

  it('untextured scores emit no carried line', () => {
    expect('textures_carried' in unityLevelLedger(score())).toBe(false);
    const { ledger } = emitGodotProject({ ref: 'w', score: score(), manifestHash: 'h', kernelVersion: '0.1.1' });
    expect('textures_carried' in ledger).toBe(false);
  });
});
