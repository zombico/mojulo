#!/usr/bin/env node
// feature-roster — the feature style's QA over the whole fauna roster (docs/feature-style.md): one species per family
// (chosen in code: a city animal or a familiar one where the family has it, else the roster's first), each minted through
// the real door in the feature style (create_character { as: 'mascot', spec: { facets: { style: 'feature', animal } } })
// and exported as the skinned GLB by the hero-live studio, then shot front and side into contact sheets for the eyes gate.
//
//   node scripts/spikes/feature-roster.mjs --out <dir> [--families canine,avian] [--extra rat,mouse] [--jobs 3] [--reuse]
//   node scripts/spikes/feature-roster.mjs --out <dir> --cast raccoon,gorilla,pigeon   (a cast of species, in order)
//   … --takes idle,fours   (a sheet per take: <take>-front.png, <take>-side.png; idle's are front.png, side.png)
//
// Writes <dir>/index.html (the live studio, every species a variant), <dir>/shots/front.png and side.png.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIES } from '../../lib/graph/fauna/species.js';
import { FAMILY_MASCOT } from '../../lib/graph/egocube/mascot-animals.js';
import { PLAN_OF } from '../../lib/graph/egocube/feature-grammar.js';
import { silhouetteOf } from '../../lib/graph/egocube/feature-silhouettes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..'), LIVE = path.join(ROOT, '.claude/skills/hero-live');
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (k === 'reuse') opt.reuse = true; else opt[k] = argv[++i]; }
const out = path.resolve(opt.out ?? '/tmp/feature-roster');
// the species shown for a family: the city animals first, then familiar ones
const PICK = { procyonid: 'raccoon', rodent: 'squirrel', avian: 'pigeon', canine: 'fox', feline: 'houseCat', ursine: 'brownBear', primate: 'chimpanzee', equine: 'horse', cervid: 'deer', bovid: 'bull', pachyderm: 'elephant', anuran: 'frog', cetacean: 'bottlenoseDolphin', teleost: 'goldfish', squamate: 'gecko' };
const byFamily = {}; for (const [id, s] of Object.entries(SPECIES)) (byFamily[s.family] ??= []).push(id);
const families = opt.families ? opt.families.split(',') : Object.keys(FAMILY_MASCOT);
const ids = opt.cast ? opt.cast.split(',') : [...families.map((f) => (byFamily[f]?.includes(PICK[f]) ? PICK[f] : byFamily[f]?.[0])).filter(Boolean), ...(opt.extra ? opt.extra.split(',') : [])];
const variants = ids.slice(1).map((id) => ({ id, label: `${id} (${silhouetteOf(id, SPECIES[id].family, PLAN_OF[SPECIES[id].family])})`, as: 'mascot', spec: { facets: { style: 'feature', animal: id } } }));
mkdirSync(out, { recursive: true });
const run = (args) => { const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT, env: process.env }); if (r.status) process.exit(r.status); };
run([path.join(LIVE, 'live.mjs'), '--as', 'mascot', '--hero', JSON.stringify({ facets: { style: 'feature', animal: ids[0] } }), '--variants', JSON.stringify(variants), '--clips', 'none', '--jobs', opt.jobs ?? '3', '--out', out, ...(opt.reuse ? ['--reuse'] : [])]);
const vid = (id, i) => (i === 0 ? 'bare' : id.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
for (const take of (opt.takes ?? 'idle').split(',')) for (const [name, az] of [['front', 18], ['side', 90]]) {
  const shots = ids.map((id, i) => ({ variant: vid(id, i), label: `${id} · ${silhouetteOf(id, SPECIES[id].family, PLAN_OF[SPECIES[id].family])}`, take, phase: take === 'idle' ? 0 : 0.55, look: { az, el: 3, dist: 3.2, at: 0.5, fov: 30 } }));
  run([path.join(LIVE, 'shot.mjs'), '--out', out, '--shots', JSON.stringify(shots)]);
  copyFileSync(path.join(out, 'shots/sheet.png'), path.join(out, `shots/${take === 'idle' ? '' : `${take}-`}${name}.png`));
}
console.log(`${ids.length} species: ${path.join(out, 'shots/front.png')}, side.png`);
