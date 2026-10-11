// The generated registry is the live read of the source tables, setting for setting, order included, and every
// module a facet names exists. A failure means a source table moved or a facet named a new one: run
// `node scripts/gen-cosmos-registry.mjs`.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FACETS, STATUSES } from './facets/index.js';
import { GENERATED } from './registry.generated.js';
import { readSources } from './read-sources.js';
import { capabilityRegistry } from './registry.js';
import { PACKAGES, EFFORT_WEIGHT } from './packages.js';

const CONTROL = new URL('../../../', import.meta.url);
const exists = (module) => existsSync(fileURLToPath(new URL(module.split('#')[0], CONTROL)));

describe('cosmos registry', () => {
  it('equals the live read of the source tables', async () => {
    expect(JSON.stringify(GENERATED)).toBe(JSON.stringify(await readSources()));
  }, 60_000);

  it('names only modules that exist', () => {
    for (const f of FACETS) {
      for (const [setting, spec] of Object.entries(f.settings)) {
        if (spec.source) expect(exists(spec.source.module), `${f.id}.${setting}`).toBe(true);
        for (const [v, row] of Object.entries(spec.values || {})) if (row.lowers) expect(exists(row.lowers), `${f.id}.${setting}=${v}`).toBe(true);
      }
    }
  });

  it('gives every value a known status, and every local or partial one a note', () => {
    const reg = capabilityRegistry();
    for (const [fid, settings] of Object.entries(reg)) {
      for (const [setting, s] of Object.entries(settings)) {
        expect(Object.keys(s.values).length, `${fid}.${setting}`).toBeGreaterThan(0);
        for (const [v, row] of Object.entries(s.values)) {
          expect(STATUSES, `${fid}.${setting}=${v}`).toContain(row.status);
          if (row.status === 'local' || row.status === 'partial') expect(row.note, `${fid}.${setting}=${v}`).toBeTruthy();
        }
      }
    }
  });

  it('holds the six facets in order, each with a question', () => {
    expect(FACETS.map((f) => f.id)).toEqual(['reality', 'space', 'power', 'soul', 'mind', 'time']);
    for (const f of FACETS) expect(f.asks).toMatch(/\?$/);
  });

  it('prices every gap in the facets this branch owns, and every package it names', () => {
    const reg = capabilityRegistry();
    for (const fid of ['space', 'power', 'soul', 'mind']) {
      for (const [setting, s] of Object.entries(reg[fid])) {
        for (const [v, row] of Object.entries(s.values)) {
          const at = `${fid}.${setting}=${v}`;
          if (row.status === 'built') { expect(row.effort, at).toBeUndefined(); continue; }
          expect(Object.keys(EFFORT_WEIGHT), at).toContain(row.effort);
          if (row.pkg) {
            expect(PACKAGES[row.pkg], at).toBeTruthy();
            expect(row.effort, at).toBe(PACKAGES[row.pkg].effort);
          }
        }
      }
    }
  });
});
