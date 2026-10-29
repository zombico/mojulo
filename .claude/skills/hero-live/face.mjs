#!/usr/bin/env node
// hero-live face — tune the FACE without a mint: an emote or a performance changes the face's weights alone, never its
// geometry, so its clips are recomputed in seconds over a hero live.mjs already minted, written beside its GLB as
// <id>.face.json (the viewer plays each over the GLB's own clip of its name), read by the numbers on the hero's own mesh
// (face-acting/emote-read.js: how far each side of the face moves when the clip holds its face, and whether its
// asymmetry shows), and shot as a contact sheet (shot.mjs): each clip at a few moments of its loop, the face framed.
//
//   node .claude/skills/hero-live/face.mjs [--out dir] [--variants bare,knight] [--emote '<json>'] [--perform '<json>']
//                                          [--parts brows,lids,cheeks] [--sheet] [--phases 0.02,0.35,0.68,0.98]
//                                          [--view vFace] [--blinks] [--cols n]
//
//   --out       live.mjs's out dir (default <tmp>/hero-live)
//   --variants  the variants to tune (default every <id>.glb in --out)
//   --emote     the door's `emote` (face-acting/emotes.js: a name, a list, or { <clip>: a name | { emote, face?, mirror?,
//               intensity?, seconds?, seed? } }; `all` every emote by name): written as `emote:<clip>` clips
//   --perform   the door's `perform` ({ <take>: a performance }): written as `face:<take>` clips
//               (neither: the clips already written, else the GLB's own emote and face clips, are read and shot)
//   --parts     each clip's parts alone too (face-acting/parts.js: brows, lids, cheeks, mouth, or all): a clip
//               `<clip>·<part>` with every other part at rest (the gaze kept), read, played and shot beside the whole
//   --sheet     shoot each clip at --phases (shots/sheet.png, one row a clip; the first variant unless --variants names
//               more), the face close (brows to chin) unless --view names a preset (vFace, vBust …), each moment moved to
//               the nearest frame off a blink (--blinks keeps them as asked)
//
// The read prints per clip: each side's largest and 95th-percentile move (mm) and the asymmetry's, and `shows` or
// `too faint` (emote-read.js SHOWS); then the asymmetry's largest by region (the brows, the lids, the mouth). The eyes gate stays the operator's.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// (the sheet's close framing: a free camera on the face, brows to chin; viewer.html heroLive.look)
const CLOSE = { az: 0, el: 3, dist: 0.55, at: 0.92, fov: 24 };
const CONTROL = path.resolve(HERE, '../../../control');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const req = createRequire(path.join(CONTROL, 'package.json'));
const { NodeIO } = req('@gltf-transform/core');
const lib = (p) => import(pathToFileURL(path.join(CONTROL, 'lib/graph', p)).href);
const { emoteTake, emoteClips, FACE_EMOTE_NAMES } = await lib('face-acting/emotes.js');
const { perform } = await lib('face-acting/perform.js');
const { faceRead, heldWeights, regionReads, targetPart } = await lib('face-acting/emote-read.js');
const { PART_NAMES } = await lib('face-acting/parts.js');
const { breathBones } = await lib('face-acting/breath.js');
const { performanceTrack, RELATIONAL_FACE_TARGETS } = await lib('polygonizer/relational-face-rig.js');

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (k === 'sheet' || k === 'blinks') opt[k] = true;
  else if (['out', 'variants', 'emote', 'perform', 'parts', 'phases', 'view', 'cols'].includes(k)) { if (argv[i + 1] === undefined) throw new Error(`hero-live face: --${k} takes a value`); opt[k] = argv[++i]; }
  else throw new Error(`hero-live face: unknown option ${argv[i]}`);
}
const out = path.resolve(opt.out ?? path.join(os.tmpdir(), 'hero-live'));
const ids = opt.variants ? opt.variants.split(',').map((s) => s.trim()).filter(Boolean) : readdirSync(out).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4));
if (!ids.length) throw new Error(`hero-live face: no <id>.glb in ${out} (run live.mjs first)`);
const parseJson = (s) => { try { return JSON.parse(s); } catch { return s; } };   // (a bare name is a name)
const emote = opt.emote === 'all' ? [...FACE_EMOTE_NAMES] : opt.emote !== undefined ? parseJson(opt.emote) : undefined;
const performs = opt.perform !== undefined ? JSON.parse(opt.perform) : undefined;
const parts = opt.parts === undefined ? [] : opt.parts === 'all' ? PART_NAMES : opt.parts.split(',').map((s) => s.trim()).filter(Boolean);
for (const p of parts) if (!PART_NAMES.includes(p)) throw new Error(`hero-live face: --parts takes ${PART_NAMES.join(', ')} or all, not '${p}'`);
// (a clip with one part alone moving: every other part's targets at rest, the gaze kept; named `<clip>·<part>`)
const isolate = (C, part) => ({ ...C, name: `${C.name}·${part}`, part, w: C.w.map((row) => row.map((v, j) => ([part, 'gaze'].includes(targetPart(C.names[j])) ? v : 0))) });

// ─── the clips: an emote's loop or a take, as the rig's weights track (the export's own derivation) ─────────────
const clipOf = (name, take) => { const K = performanceTrack(take); return { name, seconds: K.seconds, ...(take.loop ? { loop: true } : {}), t: K.t, names: [...RELATIONAL_FACE_TARGETS], w: K.w, ...(K.breath ? { breath: K.breath } : {}) }; };
const written = [
  ...(emote !== undefined ? Object.entries(emoteClips(emote)).map(([clip, E]) => clipOf(`emote:${clip}`, emoteTake(E))) : []),
  ...(performs ? Object.entries(performs).map(([take, P]) => clipOf(`face:${take}`, perform(P))) : []),
];

const io = new NodeIO();
const shots = [];
for (const id of ids) {
  const file = path.join(out, `${id}.glb`), sideFile = path.join(out, `${id}.face.json`);
  if (!existsSync(file)) { console.error(`${id}: no ${file}`); continue; }
  const doc = await io.read(file), root = doc.getRoot();
  // (the face's mesh: the one whose extras name its morph targets and say its sides)
  const mesh = root.listMeshes().find((m) => m.getExtras()?.face && m.getExtras()?.targetNames);
  if (!mesh) { console.error(`${id}: no face rig in the GLB (a realistic hero's relational head has one)`); continue; }
  const X = mesh.getExtras(), names = X.targetNames, prim = mesh.listPrimitives().find((p) => p.listTargets().length === names.length);
  const positions = prim.getAttribute('POSITION').getArray(), deltas = Object.fromEntries(names.map((n, k) => [n, prim.listTargets()[k].getAttribute('POSITION').getArray()]));
  const left = /Left is mesh \+x/.test(X.face.sides ?? '') ? 1 : -1;
  // (the clips to read: those written now, else those written before, else the GLB's own emote and face clips)
  let clips = written;
  if (!clips.length && existsSync(sideFile)) clips = JSON.parse(readFileSync(sideFile, 'utf8')).clips;
  if (!clips.length) clips = root.listAnimations().filter((a) => /^(emote|face):/.test(a.getName()) && a.getName() !== 'face:ambientBlink').map((a) => {
    const s = a.listChannels().find((c) => c.getTargetPath() === 'weights').getSampler(), T = [...s.getInput().getArray()], O = s.getOutput().getArray(), m = O.length / T.length;
    return { name: a.getName(), seconds: T.at(-1), t: T, names: names.slice(0, m), w: T.map((_, k) => [...O.slice(k * m, k * m + m)]) };
  });
  // (and each clip's parts alone, where --parts asks: the clip, then one row a part)
  if (parts.length) clips = clips.filter((C) => !C.part).flatMap((C) => [C, ...parts.map((p) => isolate(C, p))]);
  const writes = written.length > 0 || parts.length > 0, read = {};
  console.log(`\n${id}: ${clips.length} face clip${clips.length === 1 ? '' : 's'}${writes ? ` written to ${sideFile}` : ''}`);
  for (const C of clips) {
    const W = heldWeights(C.names, C.w), R = faceRead({ positions, deltas, left }, W), G = regionReads({ positions, deltas, left }, W);
    read[C.name] = { ...R, regions: Object.fromEntries(Object.entries(G).map(([r, g]) => [r, g.asymmetry])) };
    console.log(`  ${C.name.padEnd(22)} L ${R.L.max.toFixed(2)} / ${R.L.p95.toFixed(2)}   R ${R.R.max.toFixed(2)} / ${R.R.p95.toFixed(2)}   asymmetry ${R.asymmetry.max.toFixed(2)} / ${R.asymmetry.p95.toFixed(2)} mm   ${R.shows ? 'shows' : 'too faint'}`);
    console.log(`  ${''.padEnd(22)} asymmetry by region: ${Object.entries(G).map(([r, g]) => `${r} ${g.asymmetry.max.toFixed(2)}${g.shows ? '' : ' (faint)'}`).join(' · ')}`);
  }
  // (each clip's breath on this hero's body: its joints' rest heads from the GLB, the flat skeleton's; breath.js)
  const joints = root.listSkins()[0]?.listJoints() ?? [], prefix = (n) => n.slice(0, n.indexOf(':') + 1);
  const heads = Object.fromEntries(joints.map((j) => [j.getName().slice(prefix(j.getName()).length), j.getTranslation()]));
  const breaths = clips.filter((C) => C.breath && !C.part).map((C) => {
    const B = breathBones(heads, C.breath), node = (id) => `${prefix(joints[0].getName())}${id}`;
    return { of: C.name, t: C.t, joints: Object.entries(B).map(([id, M]) => ({ node: node(id), ...(M.r ? { r: M.r } : {}), ...(M.d ? { p: M.d.map((x, i) => x + heads[id][i % 3]) } : {}) })) };
  }).filter((B) => B.joints.length);
  if (writes) writeFileSync(sideFile, JSON.stringify({ clips, breaths, read, spec: { ...(emote !== undefined ? { emote } : {}), ...(performs ? { perform: performs } : {}) } }));
  if (opt.sheet && (opt.variants || !shots.length)) {
    const phases = (opt.phases ?? '0.02,0.35,0.68,0.98').split(',').map(Number);
    // (the face close by default, brows to chin, where a millimetre's unevenness can be seen; --view a preset instead)
    const frame = opt.view ? { view: opt.view } : { look: CLOSE };
    for (const C of clips) {
      // (each moment off the blinks: the nearest key whose lids are within a hair of the clip's held lids, so a frame shows
      // the face the clip holds, not a blink through it; --blinks keeps the moments as asked)
      const lid = C.names.map((n, j) => [n, j]).filter(([n]) => /^blink(Left|Right)?$/.test(n)).map(([, j]) => j), H = heldWeights(C.names, C.w);
      const open = (k) => lid.every((j) => C.w[k][j] <= H[C.names[j]] + 0.05);
      const near = (k) => { for (let d = 0; d < C.t.length; d++) for (const x of [k + d, k - d]) if (x >= 0 && x < C.t.length && open(x)) return x; return k; };
      for (const phase of phases) {
        const k = opt.blinks ? null : near(Math.round(phase * (C.t.length - 1)));
        shots.push({ variant: id, take: C.name, ...frame, phase: k === null ? phase : +(C.t[k] / C.seconds).toFixed(4), label: C.name });
      }
    }
  }
}
console.log('\n(max / 95th percentile; the clip held at its median key, the look targets left out)');
if (opt.sheet && shots.length) {
  const cols = opt.cols ?? String((opt.phases ?? '0.02,0.35,0.68,0.98').split(',').length);
  const r = spawnSync(process.execPath, [path.join(HERE, 'shot.mjs'), '--out', out, '--cols', cols, '--shots', JSON.stringify(shots)], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
