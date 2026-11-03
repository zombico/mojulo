#!/usr/bin/env node
// frames — a fighter's moves as the fight sees them (versus-compile.js): per move, the stick figure on the fighter's own
// body at its key frames (the first, the last of the startup, the first active, the middle of the recovery, the last),
// its hurtboxes (blue), its hit box on the active frames (red) and its push box (dashed), with its frame data. A
// character's own strikes (versus-hero.js, `moves: 'hero'`) beside the tradition's keyed families on the same body.
//
//   node control/scripts/spikes/fighter/frames.mjs [--spec <hero spec json file>] [--tradition boxing] [--out sheet.png]
//
// The hero spec is minted as a hero record in memory (no store): the default male hero when none is given.
import { register, createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const sharp = createRequire(path.join(CONTROL, 'package.json'))('sharp');
const { heroRecord } = await import('@/lib/mcp/tools/layered.js');
const { withDefaultForm } = await import('@/lib/graph/polygonizer/motion-stamp.js');
const { resolveCharacters } = await import('@/lib/graph/versus/versus-character.js');
const { rosterEntry } = await import('@/lib/graph/versus/versus-page.js');
const { compileFighter } = await import('@/lib/graph/versus/versus-compile.js');
const { rigJoints, RIG_BONES } = await import('@/lib/graph/versus/versus-rig.js');
const { HERO_MOVE_SLOTS } = await import('@/lib/graph/versus/versus-hero.js');

const { values: opt } = parseArgs({ options: { spec: { type: 'string' }, tradition: { type: 'string', default: 'boxing' }, out: { type: 'string', default: '/tmp/fighter-frames.png' } } });
const spec = opt.spec ? JSON.parse(readFileSync(opt.spec, 'utf8')) : { cast: 'male' };
for (const k of ['motion', 'gesture']) delete spec[k];
const ROWS = { me: { kind: 'layered', hero: heroRecord(withDefaultForm(spec)) } };
const [fam, own] = await resolveCharacters([{ id: 'family', tradition: opt.tradition, hero: { ref: 'me' } }, { id: 'own', tradition: opt.tradition, hero: { ref: 'me' }, moves: 'hero' }], (r) => ROWS[r]);
const [A, B] = [fam, own].map((e, k) => compileFighter(rosterEntry(e, k).recipe));

const S = 0.11, W = 230, H = 270, base = H - 18;   // px per mm, a cell
const px = (p, ox) => [ox + p[0] * S, base - p[1] * S];
function cell(F, m, f, ox, oy, label) {
  const fr = m.frames[f], J = rigJoints(F.body, fr.pose), out = [];
  const box = (b, style) => { const [x0, y0] = px([b[0], b[3]], ox), [x1, y1] = px([b[2], b[1]], ox); out.push(`<rect x="${x0.toFixed(1)}" y="${(y0 + oy).toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}" ${style}/>`); };
  out.push(`<line x1="${ox}" y1="${base + oy}" x2="${ox + W - 40}" y2="${base + oy}" stroke="#bbb"/>`);
  for (const b of fr.hurt) box(b, 'fill="#3a7bd5" fill-opacity="0.18" stroke="#3a7bd5" stroke-width="1"');
  const push = F.idle.stand.push; box(push, 'fill="none" stroke="#777" stroke-dasharray="3 3"');
  if (fr.hit) box(fr.hit, 'fill="#e0503a" fill-opacity="0.35" stroke="#e0503a" stroke-width="1.5"');
  for (const [a, b] of RIG_BONES) { if (!J[a] || !J[b]) continue; const [x1, y1] = px(J[a], ox), [x2, y2] = px(J[b], ox); out.push(`<line x1="${x1.toFixed(1)}" y1="${(y1 + oy).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y2 + oy).toFixed(1)}" stroke="${/F$/.test(a + b) && /F/.test(b) ? '#111' : '#666'}" stroke-width="3" stroke-linecap="round"/>`); }
  out.push(`<text x="${ox + 4}" y="${oy + 14}" font-family="monospace" font-size="11" fill="#222">${label}</text>`);
  return out.join('');
}
const rows = [];
for (const slot of Object.keys(HERO_MOVE_SLOTS)) for (const [F, who] of [[A, 'keyed'], [B, 'hero']]) {
  const m = F.moves[slot], la = m.startup + m.active - 1;
  const picks = [[1, 'f1'], [m.startup - 1, `f${m.startup - 1} startup`], [m.startup, `f${m.startup} active`], [Math.round((la + m.total) / 2), `f${Math.round((la + m.total) / 2)} recovery`], [m.total, `f${m.total} end`]];
  rows.push({ title: `${slot} · ${who}: ${m.id} · ${m.startup}/${m.active}/${m.recovery} · reach ${m.reach} mm · on hit ${m.adv.hit >= 0 ? '+' : ''}${m.adv.hit}, on block ${m.adv.block >= 0 ? '+' : ''}${m.adv.block}`, F, m, picks });
}
const TW = W * 5, TH = rows.length * (H + 22);
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}" viewBox="0 0 ${TW} ${TH}"><rect width="100%" height="100%" fill="#f6f5f1"/>`];
rows.forEach((r, i) => {
  const oy = i * (H + 22);
  svg.push(`<text x="6" y="${oy + 16}" font-family="monospace" font-size="13" font-weight="bold" fill="#111">${r.title}</text>`);
  r.picks.forEach(([f, label], j) => svg.push(cell(r.F, r.m, f, j * W + 60, oy + 22, label)));
});
svg.push('</svg>');
await sharp(Buffer.from(svg.join(''))).png().toFile(opt.out);
writeFileSync(opt.out.replace(/\.png$/, '.svg'), svg.join(''));
console.log(opt.out);
