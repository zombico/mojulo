#!/usr/bin/env node
/**
 * Seed the canonical Brickster example — the reference PIXELIZER arcade game,
 * so a fresh workshop ships with the pattern already on the floor for agents to
 * inspect and copy. Two artifacts, idempotent:
 *
 *   1. the game — a `kind:'game'`/`engine:'pixelizer'` sketch (sk_brickster)
 *      whose manifest is a RECIPE; lands in the `game` bucket → the Arcade
 *      (/arcade) + Maker gallery, playable at /api/sketches/<ref>/game.
 *   2. the project — a `Brickster` game project with the sketch bound as its
 *      `rules` member, so the game ALSO surfaces on /maker/games (the Game
 *      Developer projects gallery) and its arcade cabinet carries a project chip.
 *
 * This mirrors what an agent would do through MCP (create_pixelizer_game +
 * create_game_project + bind_to_game_project) — it's the reproducible bootstrap
 * for the canonical refs. Re-running updates in place.
 *
 *   node scripts/seed-brickster-game.js
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { GameProjectRepository, GameProjectMemberRepository } from '../lib/db/repositories/game-projects.js';
import { closeDb } from '../lib/db/index.js';
import { buildPixelizerGameManifest } from '../lib/graph/pixelizer/pixelizer-games.js';

const REF = 'sk_brickster';
const TITLE = 'Brickster';

// The charter doubles as pattern documentation — the /games studio renders it,
// and (when embeddable) semantic_search recalls the project by intent.
const CHARTER = `# Brickster

The reference **pixelizer arcade game** — a self-contained 2D reducer game folded into the Mojulo Arcade.

**The pattern (for fresh agents):** a pixelizer game is a pure \`step(state, action)\` reducer + a skin, minted with \`create_pixelizer_game({ reducer: 'brickster' })\` as a \`kind:'game'\` / \`engine:'pixelizer'\` sketch. That one row lands it on the Arcade (\`/arcade\`) and plays at \`/api/sketches/<ref>/game\` — with **no** world/store/completability gate (that gate belongs to \`create_game\`'s world/level register). Wrapping the game in this project is optional; it surfaces the game on \`/maker/games\` and puts a project chip on its cabinet.

**Register:** 8-bit raster world + real-text overlay (raster = world, overlay = communication). The soundtrack tempo scales with the level.`;

// 1) the game sketch
const manifest = buildPixelizerGameManifest({ reducer: 'brickster', title: TITLE });
const gameExisted = Boolean(SketchRepository.getByRef(REF));
if (gameExisted) SketchRepository.update({ ref: REF, title: TITLE, manifest });
else SketchRepository.create({ title: TITLE, manifest, ref: REF });

// 2) the game project — idempotent via the reverse member lookup (reuse the
// project that already claims sk_brickster as rules; else mint one).
const priorRules = GameProjectMemberRepository.listByMember({ memberRef: REF }).find((m) => m.role === 'rules');
let projectRef = priorRules?.projectRef;
let projectExisted = Boolean(projectRef);
if (!projectRef) {
  let project;
  try {
    // embed the charter so semantic_search recalls the pattern; soft-fail to plain create.
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
console.log(`  play:    /api/sketches/${row.ref}/game`);

closeDb();
