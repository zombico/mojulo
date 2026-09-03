/**
 * The greybox seam at the emitter layer (skin-over-mesh.plan.md phase 0):
 * a stamped pack's README/IMPORT-GUIDE carries the one-sentence handoff
 * contract; an unstamped pack emits byte-identical text to pre-seam output.
 */
import { describe, expect, it } from 'vitest';

import { GREYBOX_HANDOFF_SENTENCE } from './engine-score.js';
import { emitGodotProject, emitGodotGame } from './godot-project.js';
import { emitUnityProject, emitUnityGame } from './unity-project.js';

const score = (extra = {}) => ({
  ref: 'sk_pack_fixture',
  title: 'fixture',
  units: '1 mojulo unit = 1 meter',
  ground: 0,
  eye: 1.7,
  colliders: [],
  cameras: [],
  entities: [],
  mechanics: [],
  soundtrack: null,
  ledger: {},
  ...extra,
});

const fileText = (files, name) => files.find((f) => f.file === name)?.text ?? '';

describe('godot emitter — greybox handoff sentence', () => {
  it('world README carries the sentence only when the score is stamped', () => {
    const plain = emitGodotProject({ ref: 'w', score: score(), manifestHash: 'h', kernelVersion: '0.1.0' });
    const stamped = emitGodotProject({ ref: 'w', score: score({ posture: 'greybox' }), manifestHash: 'h', kernelVersion: '0.1.0' });
    expect(fileText(plain.files, 'README.md')).not.toContain('Greybox handoff');
    expect(fileText(stamped.files, 'README.md')).toContain('## Greybox handoff');
    expect(fileText(stamped.files, 'README.md')).toContain(GREYBOX_HANDOFF_SENTENCE);
  });

  it("'final' is a declaration, not a blockout — no sentence", () => {
    const final = emitGodotProject({ ref: 'w', score: score({ posture: 'final' }), manifestHash: 'h', kernelVersion: '0.1.0' });
    expect(fileText(final.files, 'README.md')).not.toContain('Greybox handoff');
  });

  it('game README carries the sentence when any level score is stamped', () => {
    const mk = (posture) => emitGodotGame({
      ref: 'g', title: 'G', manifestHash: 'h', kernelVersion: '0.1.0',
      levels: [{ ref: 'lv1', title: 'One', gate: null, score: score(posture ? { posture } : {}) }],
    });
    expect(fileText(mk(null).files, 'README.md')).not.toContain('Greybox handoff');
    expect(fileText(mk('greybox').files, 'README.md')).toContain(GREYBOX_HANDOFF_SENTENCE);
  });

  it('unstamped emission is byte-identical whether the seam exists or not (no stray whitespace)', () => {
    const plain = emitGodotProject({ ref: 'w', score: score(), manifestHash: 'h', kernelVersion: '0.1.0' });
    const readme = fileText(plain.files, 'README.md');
    // the section splice point: provenance flows straight into "## Open and play"
    expect(readme).toContain("(from mojulo's `control/`)\n\n## Open and play");
  });
});

describe('unity emitter — greybox handoff sentence', () => {
  it('world README + IMPORT-GUIDE carry the sentence only when stamped', () => {
    const plain = emitUnityProject({ ref: 'w', score: score(), manifestHash: 'h' });
    const stamped = emitUnityProject({ ref: 'w', score: score({ posture: 'greybox' }), manifestHash: 'h' });
    for (const file of ['README.md', 'IMPORT-GUIDE.md']) {
      expect(fileText(plain.files, file)).not.toContain('Greybox handoff');
      expect(fileText(stamped.files, file)).toContain(GREYBOX_HANDOFF_SENTENCE);
    }
  });

  it('game README + IMPORT-GUIDE carry the sentence when any level score is stamped', () => {
    const mk = (posture) => emitUnityGame({
      ref: 'g', title: 'G', manifestHash: 'h',
      levels: [{ ref: 'lv1', title: 'One', gate: null, score: score(posture ? { posture } : {}) }],
    });
    for (const file of ['README.md', 'IMPORT-GUIDE.md']) {
      expect(fileText(mk(null).files, file)).not.toContain('Greybox handoff');
      expect(fileText(mk('greybox').files, file)).toContain(GREYBOX_HANDOFF_SENTENCE);
    }
  });
});
