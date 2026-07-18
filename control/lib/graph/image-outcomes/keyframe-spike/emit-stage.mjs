/**
 * Stage-guide emit + audit (scene-staging.plan.md, S0). The Codex-rung front door
 * for a real plate: emit a declared-ground-plane guide + JOB-STAGE.md, ingest the
 * painted plate, run the machine audit, and emit the eyes-gate overlay.
 *
 *   cd control && node lib/graph/image-outcomes/keyframe-spike/emit-stage.mjs <dir>
 *   cd control && node lib/graph/image-outcomes/keyframe-spike/emit-stage.mjs audit <dir>
 *
 * emit  → <dir>/guide.png, <dir>/guide.json, <dir>/JOB-STAGE.md
 * audit → reads <dir>/plate.png → <dir>/stage-status.json, <dir>/stage-overlay.png
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { buildStageGuide, stageGuideSvg, stageOverlaySvg, auditStagePlate } from './stage-guide.js';
import { eyeLevelUnit } from './stage.js';

// unit is FIT to an eye-level camera so the guide's tick figures are correctly
// scaled — else the reference figures are giants and the worker (rightly) ignores
// them, and the painted scale is luck, not contract. Guide + composite MUST share
// this unit.
const STAGE = {
  unit: eyeLevelUnit(1037, 500), dRef: 1, horizonY: 500, groundYRef: 1037,
  plate: { width: 3072, height: 1216, depth: 4 },
};
const FRAME = { width: 832, height: 1216 };
const DEPTH_TICKS = [1, 1.6, 2.4, 3.5];

const rasterize = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

async function emit(dir) {
  await fs.mkdir(dir, { recursive: true });
  const guide = buildStageGuide(STAGE, { frame: FRAME, depthTicks: DEPTH_TICKS });
  await fs.writeFile(path.join(dir, 'guide.png'), await rasterize(stageGuideSvg(guide)));
  await fs.writeFile(path.join(dir, 'guide.json'), JSON.stringify({ stage: STAGE, frame: FRAME, guide }, null, 2));
  await fs.writeFile(path.join(dir, 'JOB-STAGE.md'), jobStage(guide));
  console.log(`stage guide → ${path.join(dir, 'guide.png')} (${guide.width}×${guide.height}, ${guide.ticks.length} depth ticks)`);
  console.log(`  horizon y=${guide.horizonY}, ground d=1 y=${guide.groundYRef}; edit it into a plate, remove magenta, run: emit-stage.mjs audit ${dir}`);
}

async function audit(dir) {
  const platePath = path.join(dir, 'plate.png');
  const guideJson = JSON.parse(await fs.readFile(path.join(dir, 'guide.json'), 'utf8'));
  const { guide } = guideJson;
  const img = sharp(platePath).ensureAlpha();
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();
  const result = auditStagePlate(raw, width, height, guide);
  await fs.writeFile(path.join(dir, 'stage-status.json'), JSON.stringify(result, null, 2));
  // eyes-gate overlay: the declared plane over the painted plate
  const overlay = await rasterize(stageOverlaySvg(guide));
  await fs.writeFile(
    path.join(dir, 'stage-overlay.png'),
    await sharp(platePath).composite([{ input: overlay, left: 0, top: 0 }]).png().toBuffer(),
  );
  console.log(`audit ${dir}: ${result.pass ? 'PASS' : 'FAIL'} — dims ${result.dims}, linesRemoved ${result.linesRemoved} (leak ${result.leakFrac}), groundDistinct ${result.groundDistinct} (Δ${result.groundDelta})`);
  console.log(`  LOOK at stage-overlay.png: do the tick figures stand on painted ground at the declared heights? (register gate = your eyes)`);
  if (!result.pass) process.exitCode = 2;
}

function jobStage(guide) {
  return [
    '# JOB-STAGE — paint a plate over the stage guide (scene-staging.plan.md S0)',
    '',
    'You are the image worker. `guide.png` DECLARES a ground plane: a horizon line,',
    'a reference sole line (d=1), and schematic figures at several depths (d=1 … d=3.5)',
    'showing exactly how tall a person stands and where their feet land at each depth.',
    'All guide marks are MAGENTA (#ff2bd6).',
    '',
    '## The contract',
    '',
    `Produce ONE plate, EXACTLY ${guide.width}×${guide.height}, as a full-frame EDIT of`,
    'guide.png — a finished painted BACKGROUND (no characters) whose ground plane agrees',
    'with the guide:',
    `- the horizon sits at y=${guide.horizonY}: ground below, sky/backdrop above;`,
    '- the ground recedes so that a person standing at each magenta figure would have',
    '  their feet ON the painted ground at that height (near = low + large, far = high',
    '  + small toward the horizon);',
    '- REMOVE every magenta mark, line, label, and figure — none may survive (the audit',
    '  rejects any magenta leak). Paint ground/scenery where they were.',
    '- The dashed box is the default on-screen framing; the plate extends wider on both',
    '  sides for camera pan headroom — paint the full width, it all gets used.',
    '',
    '## The two gates',
    '',
    '1. MACHINE (`emit-stage.mjs audit <dir>` on your `plate.png`): exact dimensions;',
    '   no magenta leak; sky≠ground (not a flat wash). Writes `stage-status.json`.',
    '2. EYES (`stage-overlay.png`): the declared horizon + tick figures drawn back over',
    '   your plate — the figures must look like they STAND on your painted ground at the',
    '   right heights. If a figure floats in sky or sinks below the ground, the plane',
    '   disagrees with the kernel; repaint the recession.',
    '',
    'Actors composite later by the same declared plane — a plate that passes both gates',
    'stages any meru clip at any depth with zero placement calibration.',
    '',
  ].join('\n');
}

const cmd = process.argv[2];
if (cmd === 'audit') await audit(path.resolve(process.argv[3] || '.'));
else await emit(path.resolve(cmd || '.'));
