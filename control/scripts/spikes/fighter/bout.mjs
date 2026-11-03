#!/usr/bin/env node
// bout — two heroes sparring, as an engine gets them: each fighter's skinned GLB (hero-live's `<id>.glb`, minted from a
// spec in this folder) squared up on one page. Each exchange is one of the attacker's punches into one of the defender's
// reactions: the defender stepped in until the glove, at its contact frame (the clip's `moj:move` contact), meets the
// first of his skin on its line (raycast on the skinned mesh as posed: his guard included), held in his stand until
// then and reacting from that frame. The read says what each punch lands on, at what range, how far off his head's
// height and how fast; the eyes gate is the operator's.
//
//   node control/scripts/spikes/fighter/bout.mjs --a <dir>/bare.glb --b <dir>/bare.glb [--a-name Toji] [--b-name Satoru]
//        [--out dir] [--serve [port]]
// Shots: control/scripts/spikes/fighter/bout-shot.mjs.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { a: { type: 'string' }, b: { type: 'string' }, 'a-name': { type: 'string', default: 'Toji' }, 'b-name': { type: 'string', default: 'Satoru' }, out: { type: 'string' }, serve: { type: 'string' } } });
if (!opt.a || !opt.b) throw new Error('bout: --a and --b name the two fighters\' GLBs');
const out = path.resolve(opt.out ?? path.join(os.tmpdir(), 'bout'));
mkdirSync(out, { recursive: true });
copyFileSync(opt.a, path.join(out, 'a.glb')); copyFileSync(opt.b, path.join(out, 'b.glb'));
const V = path.join(CONTROL, 'public/vendor/three');
for (const f of ['three.core.min.js', 'three.module.min.js', 'addons/loaders/GLTFLoader.js', 'addons/controls/OrbitControls.js', 'addons/utils/BufferGeometryUtils.js', 'addons/utils/SkeletonUtils.js']) {
  mkdirSync(path.dirname(path.join(out, 'vendor/three', f)), { recursive: true }); copyFileSync(path.join(V, f), path.join(out, 'vendor/three', f));
}
// the exchanges: a punch the attacker has, into the reaction the defender has for where it is aimed (taken in his guard
// when he has those, else the plain one)
const EXCHANGES = [
  { label: 'jab', attack: 'jab', react: ['guardHitHigh', 'hitHigh'], aim: 'head' },
  { label: 'cross', attack: 'cross', react: ['guardHitHigh', 'hitHigh'], aim: 'head' },
  { label: 'lead hook', attack: 'hook', react: ['guardHitHigh', 'hitHigh'], aim: 'head' },
  { label: 'rear uppercut', attack: 'uppercut', react: ['guardHitHigh', 'hitHigh'], aim: 'head' },
  { label: 'body hook', attack: 'bodyHook', react: ['guardHitBody', 'hitBody'], aim: 'body' },
];
const manifest = { fighters: [{ name: opt['a-name'], file: 'a.glb' }, { name: opt['b-name'], file: 'b.glb' }], exchanges: EXCHANGES };
const importmap = { imports: { three: './vendor/three/three.module.min.js', 'three/addons/': './vendor/three/addons/' } };
writeFileSync(path.join(out, 'index.html'), readFileSync(path.join(HERE, 'bout.html'), 'utf8').replace('@IMPORTMAP@', JSON.stringify(importmap)).replace('@MANIFEST@', JSON.stringify(manifest).replace(/</g, '\\u003c')));
console.log(path.join(out, 'index.html'));
if (opt.serve !== undefined) {
  const port = Number(opt.serve) || 8766, TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json' };
  createServer((req, res) => { const f = path.join(out, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!f.startsWith(out) || !existsSync(f)) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' }); createReadStream(f).pipe(res); })
    .listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
}
