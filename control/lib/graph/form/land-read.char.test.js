/**
 * The land read as form, pinned (the engine handoff's ground: an engine export carries `formPayload` as its land's
 * materials, so the payload must be the same bytes every run and on both reference CPUs before anything is handed off
 * from it). A small meru island under island-noon, with its grass map: the payload hashed once with the layers' atlases
 * painted fresh, then again with them memoized (land-read.js paints them once a process), and the two must agree; the
 * hash is held on the reference runtime, so a run, a process or a CPU that paints a different byte fails here.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import { landRead, formPayload } from './land-read.js';
import { readGeocube } from '../era/geocube.js';
import { assembleStageScene } from '../era/stage.js';

const island = () => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }], island: { geology: true, walk: 'none', cover: 'grass' } } }, {});
const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex');

// (an emission change to the land read moves this pin; its step says so)
const PIN = 'd6823bc9e2699706340a525be0345dcc4d61281009afef91cf2c04fa78b94834';

describe('formPayload, pinned', () => {
  it('is the same bytes painted fresh and memoized, and on every reference run', () => {
    const C = readGeocube('island-noon');
    const fresh = hash(formPayload(landRead(island(), C, { grass: 'map' })));
    const memo = hash(formPayload(landRead(island(), C, { grass: 'map' })));
    expect(memo).toBe(fresh);
    expect(fresh).toBe(PIN);
  }, 300_000);
});
