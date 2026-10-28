// Every module a facet names exists, and the registry reads each sourced setting's values from its table (live, no copy).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FACETS, STATUSES } from './facets/index.js';
import { readSources } from './read-sources.js';
import { capabilityRegistry } from './registry.js';
import { PACKAGES, EFFORT_WEIGHT } from './packages.js';

const CONTROL = new URL('../../../', import.meta.url);
const exists = (module) => existsSync(fileURLToPath(new URL(module.split('#')[0], CONTROL)));

describe('cosmos registry', () => {
  it('names only modules that exist', () => {
    for (const f of FACETS) {
      for (const [setting, spec] of Object.entries(f.settings)) {
        if (spec.source) expect(exists(spec.source.module), `${f.id}.${setting}`).toBe(true);
        for (const [v, row] of Object.entries({ ...spec.values, ...spec.planned })) if (row.lowers) expect(exists(row.lowers), `${f.id}.${setting}=${v}`).toBe(true);
      }
    }
  });

  it('adds a sourced setting\'s planned values beside its table, priced unless something else builds them', () => {
    const reg = capabilityRegistry();
    for (const f of FACETS) {
      for (const [setting, spec] of Object.entries(f.settings)) {
        for (const v of Object.keys(spec.planned || {})) {
          expect(readSources()[`${f.id}.${setting}`].values, `${f.id}.${setting}=${v}`).not.toContain(v);
          const row = reg[f.id][setting].values[v];
          if (row.status === 'built') expect(row.lowers, `${f.id}.${setting}=${v}`).toBeTruthy();
          else expect(EFFORT_WEIGHT[row.effort], `${f.id}.${setting}=${v}`).toBeGreaterThan(0);
        }
      }
    }
    expect(reg.power.systems.values.place.status).toBe('built');
    expect(reg.power.mechanics.values.waves.status).toBe('built');
    expect(reg.power.mechanics.values['reach-exit'].status).toBe('built');
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

  it('a given setting names a setting of its own facet and values that setting holds', () => {
    const reg = capabilityRegistry();
    let n = 0;
    for (const [fid, settings] of Object.entries(reg)) for (const [setting, s] of Object.entries(settings)) for (const [g, vals] of Object.entries(s.given || {})) {
      n++;
      for (const v of vals) expect(reg[fid][g]?.values[v], `${fid}.${setting} given ${g}=${v}`).toBeTruthy();
    }
    expect(n).toBeGreaterThan(0);
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
