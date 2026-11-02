#!/usr/bin/env node
// servo-audit — the manual manipulator's phase 1: every clip the hero's arm already plays, read against the arm's servos
// (lib/graph/polygonizer/hero-servo.js), and the joints' peak speeds measured off the strikes (the starting truth for the
// realistic register's servo speeds, with the swings'). Advisory; nothing changes.
//
//   node scripts/spikes/manipulator/servo-audit.mjs [--cast male|female] [--samples 40] [--json out.json]
//
// The clips: each stance (hero-stance.js, its settle into the hold), each straight strike (hero-strike.js), each sword
// guard (hero-grip.js) and each swing (hero-swing.js at the normal class, its keys played evenly, smoothstep-eased, as
// the rig's clip player spaces them). Per clip and side: the servos that leave their hard range (how far, how many
// frames), the share of frames out of ease, and the peak speeds.
import { register } from 'node:module';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(CONTROL);
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { validateRig } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const { servoReport } = await import('@/lib/graph/polygonizer/hero-servo.js');
const { heroStance, STANCES } = await import('@/lib/graph/polygonizer/hero-stance.js');
const { heroStrike, STRIKES } = await import('@/lib/graph/polygonizer/hero-strike.js');
const { heroGuard, GUARDS } = await import('@/lib/graph/polygonizer/hero-grip.js');
const { swingClipKeys, SWING_WORDS, HELD_STRIKE } = await import('@/lib/graph/polygonizer/hero-swing.js');
const { elbowsDown } = await import('@/lib/graph/polygonizer/hero-elbow.js');

const { values: opt } = parseArgs({ options: { cast: { type: 'string', multiple: true }, samples: { type: 'string', default: '40' }, json: { type: 'string' } } });
const casts = opt.cast?.length ? opt.cast : ['male'];
const samples = Number(opt.samples);
const PATHS = ['girdle', 'shoulder.swing', 'shoulder.twist', 'elbow', 'wrist.flex', 'wrist.deviation', 'wrist.twist'];

/** keys played evenly over the clip and back to the first, smoothstep between (the rig's clip player's spacing), a raised
 * arm bent with its elbow down as the clip player bends it (hero-jump.js keyedClip) */
function evenClip(keys, R) {
  const mix = (a, b, f) => {
    if (typeof a === 'number' || typeof b === 'number') return (a ?? 0) + ((b ?? 0) - (a ?? 0)) * f;
    if (Array.isArray(a) || Array.isArray(b)) { const A = a ?? b, B = b ?? a; return A.map((x, i) => mix(x, B[i], f)); }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, mix(a[k], b[k], f)]));
    if ((a && typeof a === 'object') || (b && typeof b === 'object')) return mix(a ?? {}, b ?? {}, f);
    return f < 0.5 ? a : b;
  };
  const n = keys.length;
  return { fn: (t) => { const x = Math.min(n - 1e-9, Math.max(0, t * n)), i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return elbowsDown(R, mix(keys[i], keys[(i + 1) % n], s)); } };
}

function audit(cast) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic' }) });
  const R = validateRig(m.recipe.rig);
  const clips = [];
  const add = (family, name, make) => { try { const { clip, seconds } = make(); clips.push({ family, name, seconds, report: servoReport(R, clip, { seconds, samples }) }); } catch (e) { clips.push({ family, name, skipped: String(e.message).slice(0, 160) }); } };
  for (const s of Object.keys(STANCES)) add('stance', s, () => ({ clip: heroStance(s, R).clip, seconds: 0.7 }));
  for (const s of Object.keys(STRIKES)) add('strike', s, () => { const K = heroStrike(s, R); return { clip: K.clip, seconds: K.seconds }; });
  for (const g of Object.keys(GUARDS)) add('guard', g, () => ({ clip: heroGuard(g, R).clip, seconds: 0.9 }));
  for (const w of SWING_WORDS) add('swing', w, () => ({ clip: evenClip(swingClipKeys(w, 'normal'), R), seconds: HELD_STRIKE.normal.seconds }));
  // the speeds: the peak per servo over the strikes and over the swings (the shoulder's as its swing: the humerus's own
  // turn), each family apart
  const speeds = {};
  for (const fam of ['strike', 'swing']) {
    const sp = (speeds[fam] = {});
    for (const c of clips.filter((x) => x.family === fam && x.report)) for (const S of Object.keys(c.report.sides)) {
      const s = c.report.sides[S];
      for (const p of PATHS) if (s[p]?.peakSpeed != null) sp[p] = Math.max(sp[p] ?? 0, s[p].peakSpeed);
      sp['shoulder.swing'] = Math.max(sp['shoulder.swing'] ?? 0, s.swingSpeed);
    }
  }
  return { cast, samples, clips, speeds };
}

const out = casts.map(audit);
for (const r of out) {
  console.log(`\n══ ${r.cast} (realistic): the arm's servos over its clips (${r.samples + 1} frames each) ══`);
  const totals = {};
  for (const c of r.clips) {
    if (c.skipped) { console.log(`  ${c.family} ${c.name}: skipped (${c.skipped})`); continue; }
    const notes = [];
    for (const [S, s] of Object.entries(c.report.sides)) for (const p of PATHS) {
      const x = s[p]; if (!x) continue;
      const t = (totals[p] ??= { clips: 0, past: 0, easeOut: 0, read: 0 }); t.read++;
      if (x.outOfRange) { t.past++; notes.push(`${S} ${p} PAST its range ${x.outOfRange}/${x.read} frames (worst ${-x.worstMargin}° past; ${x.min} … ${x.max})`); }
      else if (x.outOfEase >= 0.25) notes.push(`${S} ${p} out of ease ${Math.round(x.outOfEase * 100)}% (${x.min} … ${x.max})`);
      if (x.outOfEase > 0) t.easeOut++;
    }
    console.log(`  ${c.family.padEnd(6)} ${c.name.padEnd(9)} ${notes.length ? notes.join('; ') : 'in range and at ease'}`);
  }
  console.log('  per servo, (side × clip) reads that ever leave the range / ever leave ease:');
  for (const [p, t] of Object.entries(totals)) console.log(`    ${p.padEnd(16)} ${t.past} / ${t.easeOut} of ${t.read}`);
  for (const [fam, sp] of Object.entries(r.speeds)) console.log(`  peak speeds over the ${fam}s (deg/s): ` + Object.entries(sp).map(([p, v]) => `${p} ${Math.round(v)}`).join(', '));
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(out, null, 2));
