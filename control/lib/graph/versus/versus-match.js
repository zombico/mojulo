/**
 * versus match — fights run headless: a replay from a pad log, a CPU against a CPU, a sweep of the roster.
 * The machine gate for a moveset: who wins how often, the longest combo, the most a combo took, and whether a
 * replay comes back to the byte.
 */

import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus, versusHash } from './versus-core.js';
import { cpuPad, newCpuMemory, CPU_LEVELS } from './versus-cpu.js';

const asFighter = (f) => (f && f.moves ? f : compileFighter(f));

/** Run a match to its end (or `maxFrames`). players: [{ cpu: level | null, pads?: [...] }, …] */
export function runVersus({ fighters, players = [{ cpu: 'regular' }, { cpu: 'regular' }], seed = 1, rules, maxFrames = 60 * 60 * 8, log = false } = {}) {
  const ctx = { fighters: fighters.map(asFighter) };
  let s = newVersus(ctx, { schemes: players.map((p) => p.scheme ?? 'modern'), rules });
  const mem = [newCpuMemory(), newCpuMemory()];
  const stats = { hits: [0, 0], blocks: [0, 0], throws: [0, 0], techs: 0, supers: [0, 0], counters: [0, 0], longestCombo: 0, maxComboDamage: 0 };
  const run = [0, 0];
  const pads = log ? [] : null;
  for (let f = 0; f < maxFrames && s.phase !== 'matchEnd'; f++) {
    const frame = [0, 1].map((i) => {
      const pl = players[i];
      if (pl.pads) return pl.pads[f] ?? { x: 0, y: 0, b: 0 };
      if (pl.cpu) {
        const lv = typeof pl.cpu === 'string' ? CPU_LEVELS[pl.cpu] : pl.cpu;
        const r = cpuPad(s, ctx, i, mem[i], { ...lv, seed: seed * 2 + i });
        mem[i] = r.mem;
        return r.pad;
      }
      return { x: 0, y: 0, b: 0 };
    });
    if (pads) pads.push(frame);
    s = stepVersus(s, frame, ctx);
    for (const e of s.events) {
      if (e.t === 'hit' || e.t === 'counter') {
        stats.hits[e.p]++;
        if (e.t === 'counter') stats.counters[e.p]++;
        run[e.p] += e.dmg;
        stats.longestCombo = Math.max(stats.longestCombo, e.combo);
      }
      if (e.t === 'block') stats.blocks[e.p]++;
      if (e.t === 'throw') stats.throws[e.p]++;
      if (e.t === 'tech') stats.techs++;
      if (e.t === 'super') stats.supers[e.p]++;
    }
    for (let i = 0; i < 2; i++) {
      if (s.p[1 - i].combo === 0 && run[i]) { stats.maxComboDamage = Math.max(stats.maxComboDamage, run[i]); run[i] = 0; }
    }
  }
  return { winner: s.winner, wins: s.wins, rounds: s.round, frames: s.f, hash: versusHash(s), stats, state: s, pads };
}

/** Every pair of the roster, `n` seeds each: → { pairs: [{ a, b, wins: [x, y] }], rate: { id: win rate } } */
export function sweepVersus(recipes, { n = 4, level = 'regular', rules } = {}) {
  const compiled = recipes.map(asFighter);
  const pairs = [];
  const won = Object.fromEntries(compiled.map((f) => [f.id, 0]));
  const played = Object.fromEntries(compiled.map((f) => [f.id, 0]));
  for (let a = 0; a < compiled.length; a++) {
    for (let b = a + 1; b < compiled.length; b++) {
      const wins = [0, 0];
      for (let k = 0; k < n; k++) {
        // sides alternate so the left side is no advantage
        const flip = k % 2 === 1;
        const r = runVersus({ fighters: flip ? [compiled[b], compiled[a]] : [compiled[a], compiled[b]], players: [{ cpu: level }, { cpu: level }], seed: 1000 + k * 7 + a * 31 + b, rules });
        if (r.winner >= 0) wins[flip ? 1 - r.winner : r.winner]++;
      }
      pairs.push({ a: compiled[a].id, b: compiled[b].id, wins });
      won[compiled[a].id] += wins[0]; won[compiled[b].id] += wins[1];
      played[compiled[a].id] += n; played[compiled[b].id] += n;
    }
  }
  const rate = Object.fromEntries(Object.keys(won).map((id) => [id, played[id] ? Math.round((won[id] / played[id]) * 100) / 100 : 0]));
  return { pairs, rate };
}
