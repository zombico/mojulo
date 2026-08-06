#!/usr/bin/env node
/**
 * Seed the Philosopher's Stone match-3 — a pixelizer reducer game folded into
 * the Mojulo Arcade + a game-developer project. Idempotent; two artifacts:
 *
 *   1. the game — a `kind:'game'`/`engine:'pixelizer'` sketch (sk_philosophers_stone)
 *      whose manifest is a RECIPE; lands in the `game` bucket → the Arcade
 *      (/arcade) + Maker gallery, playable at /api/sketches/<ref>/game.
 *   2. the project — a `Philosopher's Stone` game project with the sketch bound
 *      as its `rules` member, so it also surfaces on /maker/games (the Game
 *      Developer projects gallery) and its cabinet carries a project chip.
 *
 * Mirrors what an agent would do through MCP (create_pixelizer_game +
 * create_game_project + bind_to_game_project) with fresh repo code — so it
 * works even when the running control plane predates the reducer. NOTE: the
 * control plane must be restarted to SERVE the shell (its emitPixelizerGame map
 * is snapshotted at startup); this script only writes the rows.
 *
 *   node scripts/seed-philosophers-stone-game.js
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { GameProjectRepository, GameProjectMemberRepository } from '../lib/db/repositories/game-projects.js';
import { closeDb } from '../lib/db/index.js';
import { buildPixelizerGameManifest } from '../lib/graph/pixelizer/pixelizer-games.js';

const REF = 'sk_philosophers_stone';
const TITLE = "Philosopher's Stone";

const CHARTER = `# Philosopher's Stone

A cute-alchemy **match-3** in the pixelizer 32-bit register — the Bejeweled/Candy-Crush move (swap two adjacent reagents to line up three or more) with an alchemy promotion system on top.

**The loop:** matches *dissolve* for score and the column drops + refills from the top, cascading when the refill lines up more. A bigger match **transmutes** the swapped tile into a higher product with an effect — a straight 4 distils an **Aqua Vitae** (clears its row/column), an L/T of 5 fires up an **Athanor** (3×3 burst), a straight 5 brews the **Philosopher's Stone** itself (swap it onto any reagent to transmute that whole colour off the board).

**Modes:** *Free Play* (endless score-attack) and *Alchemist's Trial* (timed level progression — each level demands a higher score in a shorter window; run the clock out and you lose).

**Register:** a pure \`step(state, action)\` reducer (seeded dice carried in state, byte-replayable — no world/store/completability gate); a 32-bit beveled-gem skin (raster = world, overlay = communication); animated cascades (gems slide-swap, pop, and drop); beats audio (a bubbling "Laboratory" theme + foley cues). Design + build log: \`lib/graph/pixelizer/philosophers-stone.plan.md\`.`;

// 1) the game sketch
const manifest = buildPixelizerGameManifest({ reducer: 'philosophers-stone', title: TITLE });
const gameExisted = Boolean(SketchRepository.getByRef(REF));
if (gameExisted) SketchRepository.update({ ref: REF, title: TITLE, manifest });
else SketchRepository.create({ title: TITLE, manifest, ref: REF });

// 2) the game project — idempotent via the reverse member lookup.
const priorRules = GameProjectMemberRepository.listByMember({ memberRef: REF }).find((m) => m.role === 'rules');
let projectRef = priorRules?.projectRef;
const projectExisted = Boolean(projectRef);
if (!projectRef) {
  let project;
  try {
    project = await GameProjectRepository.createWithEmbedding({ title: TITLE, charter: CHARTER });
  } catch {
    project = GameProjectRepository.create({ title: TITLE, charter: CHARTER });
  }
  projectRef = project.ref;
} else {
  GameProjectRepository.update({ ref: projectRef, title: TITLE, charter: CHARTER });
}
GameProjectMemberRepository.bind({ projectRef, memberRef: REF, role: 'rules' });

const row = SketchRepository.getByRef(REF);
console.log(`${gameExisted ? 'updated' : 'created'} game ${row.ref}  (bucket: ${row.bucket})`);
console.log(`${projectExisted ? 'reused ' : 'created'} project ${projectRef}  (rules: ${REF})`);
console.log(`  inspect: /sketches/${row.ref}`);
console.log(`  arcade:  /arcade/${row.ref}`);
console.log(`  project: /games/${projectRef}   (listed on /maker/games)`);
console.log(`  play:    /api/sketches/${row.ref}/game   (needs a control-plane restart to serve)`);

closeDb();
