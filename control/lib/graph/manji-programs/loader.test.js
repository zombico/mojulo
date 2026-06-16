import { describe, it, expect } from 'vitest';

import {
  getManjiProgramCatalog,
  getManjiProgramShelfCard,
  listManjiProgramShelfIds,
  _parseShelfFileForTests as parseShelfFile,
} from './loader.js';
import {
  resolveManjiProgramRef,
} from '../polygonizer/mandala-patterns.js';

describe('manji-program shelf loader', () => {
  it('loads the cathedral card from the markdown shelf', () => {
    const card = getManjiProgramShelfCard('cathedral-nave-deep-perspective');
    expect(card).toBeTruthy();
    expect(card.id).toBe('cathedral-nave-deep-perspective');
    expect(card.label).toBe('Cathedral nave deep perspective');
    expect(card.family).toBe('civic-interior-shot-glyph');
    expect(Array.isArray(card.aliases)).toBe(true);
    expect(card.aliases).toContain('cathedral nave');
    expect(card.boundaryContract.slots).toContain('altar-anchor');
    // manjiProgram round-trips intact from frontmatter
    expect(card.manjiProgram.spine.bar3.axis).toBe('Zenith-Nadir');
    expect(card.manjiProgram.slots.length).toBe(8);
    // Body carries the prose
    expect(typeof card.body).toBe('string');
    expect(card.body).toContain('## Use when');
    expect(card.body).toContain('## Slot semantics');
    expect(card.body).toContain('## Composition examples');
  });

  it('lists the shelf ids', () => {
    const ids = listManjiProgramShelfIds();
    expect(ids).toContain('cathedral-nave-deep-perspective');
  });

  it('returns null for an unknown id', () => {
    expect(getManjiProgramShelfCard('not-a-real-card')).toBe(null);
  });
});

describe('resolveManjiProgramRef falls through from in-code to shelf', () => {
  it('still resolves in-code mandala-pattern cards (snowflake-sixfold)', () => {
    const preset = resolveManjiProgramRef('snowflake-sixfold');
    expect(preset).toBeTruthy();
    expect(preset.slotPattern.id).toBe('ring-N');
  });

  it('still resolves in-code shot-glyph cards (school-of-athens-central-hall)', () => {
    const preset = resolveManjiProgramRef('school-of-athens-central-hall');
    expect(preset).toBeTruthy();
    expect(Array.isArray(preset.slots)).toBe(true);
    expect(preset.slots.find((s) => s.id === 'axis-mundi-hub')).toBeTruthy();
  });

  it('resolves cathedral-nave-deep-perspective from the shelf (now that the in-code copy is gone)', () => {
    const preset = resolveManjiProgramRef('cathedral-nave-deep-perspective');
    expect(preset).toBeTruthy();
    expect(preset.spine.bar3.axis).toBe('Zenith-Nadir');
    expect(preset.slots.find((s) => s.id === 'altar-anchor')).toBeTruthy();
  });
});

describe('parseShelfFile catches malformed cards', () => {
  it('throws on missing frontmatter', () => {
    expect(() => parseShelfFile('test.md', '# No frontmatter')).toThrow(/missing JSON frontmatter/);
  });

  it('throws on invalid JSON frontmatter', () => {
    expect(() =>
      parseShelfFile('test.md', '---\n{ not valid json }\n---\nbody'),
    ).toThrow(/invalid JSON frontmatter/);
  });

  it('throws on missing required field', () => {
    expect(() =>
      parseShelfFile('test.md', '---\n{ "id": "x" }\n---\nbody'),
    ).toThrow(/missing required field 'label'/);
  });

  it('throws on no primitive declared (no manjiProgram / waveField / connections)', () => {
    expect(() =>
      parseShelfFile('test.md', '---\n{ "id": "x", "label": "X", "family": "f" }\n---\nbody'),
    ).toThrow(/at least one primitive/);
  });

  it('accepts a waveField-only card (surface preset)', () => {
    const card = parseShelfFile(
      'surface.md',
      '---\n{ "id": "calm-water", "label": "Calm water", "family": "surface-water", "waveField": { "waves": [], "style": { "stroke": "#5a8ab8" } } }\n---\n# body\n\nuse for water',
    );
    expect(card.id).toBe('calm-water');
    expect(card.waveField).toBeTruthy();
    expect(card.manjiProgram).toBe(null);
  });

  it('accepts a connections-only card (decoration preset)', () => {
    const card = parseShelfFile(
      'decoration.md',
      '---\n{ "id": "garland", "label": "Garland", "family": "decoration-connector", "connections": [{ "sag": 0.4 }] }\n---\n# body\n\nuse for hanging decorations',
    );
    expect(card.id).toBe('garland');
    expect(card.connections).toBeTruthy();
    expect(card.manjiProgram).toBe(null);
  });

  it('throws on empty body', () => {
    expect(() =>
      parseShelfFile(
        'test.md',
        '---\n{ "id": "x", "label": "X", "family": "f", "manjiProgram": {} }\n---\n',
      ),
    ).toThrow(/empty body/);
  });

  it('parses a well-formed file', () => {
    const card = parseShelfFile(
      'test.md',
      '---\n{ "id": "x", "label": "X", "family": "f", "manjiProgram": { "spine": {} } }\n---\n# body\n\nuse when prose',
    );
    expect(card.id).toBe('x');
    expect(card.label).toBe('X');
    expect(card.manjiProgram.spine).toEqual({});
    expect(card.body).toContain('use when prose');
  });
});
