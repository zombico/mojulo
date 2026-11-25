/**
 * A REALISTIC PERSON KEPT — a street's realistic people (gameworld/people.js, a level's `people: 'realistic'`) cost a
 * realistic bake each (a minute or more) and are drawn at the realistic crowd grade twice (figures/crowd-figure.js
 * realCrowdFigure: a near figure and a far one). Both are kept on disk by what they were made from (the person's words,
 * the realistic laws, the crowd grade's numbers, this shelf's version), so a level's people are made once and every page
 * after reads them back. The disk is `MOJULO_CROWD_DIR`, else `<MOJULO_HOME>/cache/crowd` (~/.mojulo); a write that
 * fails is skipped (the people are made again next time).
 *
 *   realCrowdRead(name, spec)          → { [name]: far, [`${name}:near`]: near } | null (none kept for these words)
 *   realCrowdKept(name, spec, figure)  → the same, made from the baked figure (worlds/world-scene.js heroFigure) and kept
 *
 * What it keeps is what it would make: a kept person is the made one, byte for byte.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { realCrowdFigure, REAL_CROWD } from './crowd-figure.js';
import { REALISTIC_LAWS_VERSION } from '../../mcp/tools/layered.js';

/** this shelf's version: a change to how a crowd figure is made bumps it, so nothing older is read back */
export const CROWD_KEPT_VERSION = 1;
const dir = () => process.env.MOJULO_CROWD_DIR || path.join(process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo'), 'cache', 'crowd');
const keyOf = (spec) => createHash('sha256').update(JSON.stringify([CROWD_KEPT_VERSION, REALISTIC_LAWS_VERSION, REAL_CROWD, spec.hero, spec.grade ?? null])).digest('hex').slice(0, 24);
const named = (name, kept) => ({ [name]: kept.far, [`${name}:near`]: kept.near });

export function realCrowdRead(name, spec) {
  try {
    const file = path.join(dir(), `${keyOf(spec)}.json`);
    return existsSync(file) ? named(name, JSON.parse(readFileSync(file, 'utf8'))) : null;
  } catch { return null; }
}

export async function realCrowdKept(name, spec, figure) {
  const kept = { near: realCrowdFigure(figure, { budget: REAL_CROWD.near }), far: realCrowdFigure(figure, { budget: REAL_CROWD.far }) };
  try { mkdirSync(dir(), { recursive: true }); writeFileSync(path.join(dir(), `${keyOf(spec)}.json`), JSON.stringify(kept)); } catch { /* (kept next time) */ }
  return named(name, kept);
}
