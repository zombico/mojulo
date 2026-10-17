/**
 * THE ROBLOX MACHINE GATE over an emitted pack (roblox-pack.js): Rojo builds the place, and Lune opens it
 * (scripts/roblox/place-check.luau) to check its tree, compile its scripts and play every level FROM THE PLACE (its
 * kernel loaded from the ModuleScripts' own source, the level's bus.json and contract.json from its data module) over
 * the track the web runtime recorded for that level (level-conformance.js levelTrack: the win script, its bodies each
 * frame). The web plays the same track over the payload's own events and contract; the two are compared frame by frame.
 * A level whose bus.json carries a cast (its characters, fight and minds) is played whole instead (level-conformance.js
 * castTrack): the place's kernel is fed the pilot's pose each frame and runs the rest, and the bus's hash and every
 * other ruled body's pose are compared (the levelcast corpus's frame).
 * And the kernel the place carries is the kernel the conformance corpora hold equal, byte for byte.
 *
 * Advisory, like every engine gate: a missing Rojo or Lune is reported, never installed. Eyes: none (a Roblox level is
 * looked at in Studio by the operator).
 *
 *   robloxGate({ dir, ref, payloads, rojo?, lune?, seconds? }) → { ran, place?, problems, kernel, levels, skipped? }
 *     levels: [{ ref, frames, equal, outcome, cast, first? }]   outcome: the web's ('success' | 'fail' | null); cast: played whole
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findRojo, findLune } from '../../workers/find.js';
import { levelTrack, runLevel, castTrack } from './level-conformance.js';
import { extractBus } from './engine-score.js';
import { firstDifference } from './engines/conformance.js';
import { KERNEL_MODULES } from './roblox-pack.js';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CHECK = path.join(CONTROL, 'scripts', 'roblox', 'place-check.luau');
const KERNEL = path.join(CONTROL, 'lib', 'graph', 'scene', 'roblox-kernel');

const outcomeOf = (line) => { try { return JSON.parse(line.split('|').slice(2).join('|')).envelope?.result ?? null; } catch { return null; } };

export function robloxGate({ dir, ref, payloads, rojo = findRojo(), lune = findLune(), seconds = 120 }) {
  if (!rojo || !lune) return { ran: false, skipped: `${[!rojo && 'rojo', !lune && 'lune'].filter(Boolean).join(' and ')} not found (lib/workers/find.js: MOJULO_ROJO, MOJULO_LUNE)`, problems: [], kernel: null, levels: [] };
  const place = path.join(dir, `${ref}.rbxl`);
  const built = spawnSync(rojo, ['build', path.join(dir, 'default.project.json'), '-o', place], { encoding: 'utf8', timeout: 300000 });
  if (built.status !== 0 || !existsSync(place)) return { ran: true, problems: [`rojo build failed: ${(built.stderr || built.stdout || '').split('\n')[0]}`], kernel: null, levels: [] };
  const tracks = {}, web = {}, outcomes = {};
  for (const [lref, payload] of Object.entries(payloads)) {
    const bus = extractBus(payload);
    if (bus && Array.isArray(bus.cast) && bus.cast.length) {
      const t = castTrack(payload, { id: lref, seconds });
      const { frames, params, ids, feet, ground } = t.scenario;
      tracks[lref] = { cast: true, frames, params, ids, feet, ground };
      web[lref] = t.keys;
      outcomes[lref] = t.outcome;
      continue;
    }
    const sc = levelTrack(payload, { id: lref, seconds });
    tracks[lref] = { frames: sc.frames, params: sc.params };
    web[lref] = runLevel(sc);
  }
  const tmp = mkdtempSync(path.join(tmpdir(), 'mojulo-roblox-gate-'));
  try {
    const inFile = path.join(tmp, 'tracks.json'), outFile = path.join(tmp, 'out.json');
    writeFileSync(inFile, JSON.stringify(tracks));
    const run = spawnSync(lune, ['run', CHECK, place, inFile, outFile], { encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 28 });
    let out = null;
    try { out = JSON.parse(readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
    if (!out) return { ran: true, place, problems: [`the place check wrote nothing: ${(run.stderr || run.stdout || '').trim().split('\n').slice(-3).join(' / ')}`], kernel: null, levels: [] };
    const differs = KERNEL_MODULES.filter((m) => out.kernel?.[m] !== readFileSync(path.join(KERNEL, `${m}.luau`), 'utf8'));
    const levels = Object.entries(web).map(([lref, lines]) => {
      const got = out.levels?.[lref] || [];
      let first = null;
      for (let f = 0; f < lines.length; f++) if (lines[f] !== got[f]) { first = { frame: f, ...firstDifference(lines[f], got[f] || '') }; break; }
      const cast = lref in outcomes;
      return { ref: lref, frames: lines.length, equal: !first && got.length === lines.length, outcome: cast ? outcomes[lref] : lines.length ? outcomeOf(lines[lines.length - 1]) : null, cast, ...(first ? { first } : {}) };
    });
    return { ran: true, place, problems: out.problems || [], kernel: { equal: differs.length === 0, differs }, levels };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
