// SPIKE flame: a lit match, the hero page. A small standalone scene, not a World page: a match held in a clip over a
// walnut table at night, a box of matches beside it and a spent one, lit by nothing but the flame and a little
// moonlight. What it shows, and where it comes from:
//   · the burn and the flame's shape are the kernel's (kernel.mjs, inlined): strike, head, wood, out; the char front
//     creeping along the stick at the rate its angle allows; the flame a streakline in the room's air;
//   · the air is the production wind field (vegetation/wind.js windField, inlined), read at its reference height so
//     the breeze slider is the air at the flame, plus a breath you can blow (kernel.mjs breathAt);
//   · the flame is drawn as light, not as a surface: a ray marched through a volume around its spine, glowing soot
//     (yellow to orange as it cools toward the tip), a dark core, a blue sheet at the base, its surface wrinkled by
//     eddies rising at the gas's speed; the scene's depth stops the ray, so the stick hides what is behind it;
//   · the flame lights the scene: one point light at its heart, the light of an extended source (no 1/d² blow-up at
//     the stick), throwing the stick's shadow on the table, its strength following the flame;
//   · the stick chars behind the front, shrinks and curls, its cracks glowing near the front; the smoke is drawn as
//     threads through the kernel's strands, lit by the flame and the moon (forward scattering); the hot plume above
//     the flame shimmers; the frame is HDR through bloom and ACES, and the eye adapts when the flame goes out.
//   node scripts/spikes/flame/match.mjs /absolute/out.html [breeze m/s = 0.12] [angle deg = -10]
import { writeFileSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { windField } = await import('../../../lib/graph/vegetation/wind.js');
const { inlineImportmap } = await import('../../../lib/graph/scene/emit-util.js');
const { matchKernel, breathAt } = await import('./kernel.mjs');

const [out = 'scripts/spikes/flame/match.html', breezeArg = '0.12', angleArg = '-10'] = process.argv.slice(2);
const DEG = Math.PI / 180;
const data = {
  seed: 5,
  match: { side: 0.0021, length: 0.047, head: 0.0058, clip: 0.038, hold: [0, 0, 0.12], theta: Number(angleArg) * DEG, psi: 0 },
  // a room's draught: gusts the size of a room, reshaping every couple of seconds
  wind: { speed: Number(breezeArg), dir: 0, gust: 0.6, scale: 0.6, evolve: 2, veer: 25 * DEG, seed: 3, z0: 0.03 },
  moon: [0.35, 0.8, 0.55],
};
const page = readFileSync(new URL('./match.page.js', import.meta.url), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A lit match</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000;font:13px/1.35 system-ui,sans-serif}#ui{position:fixed;left:12px;top:12px;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100% - 24px)}#ui button{border:0;border-radius:6px;padding:6px 10px;background:rgba(255,255,255,.12);color:#f3e6d6;cursor:pointer}#ui button:hover{background:rgba(255,255,255,.22)}#ui label{display:flex;align-items:center;gap:6px;border-radius:6px;padding:4px 10px;background:rgba(255,255,255,.08);color:#f3e6d6}#ui input{accent-color:#e8963c;width:110px}#hud{position:fixed;right:12px;bottom:10px;color:#f3e6d6;opacity:.85;text-shadow:0 1px 2px #000;font-variant-numeric:tabular-nums;text-align:right;white-space:pre}</style>
<script>addEventListener('error', (e) => { const d = document.getElementById('err') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'err' })); d.style.cssText = 'position:fixed;left:12px;bottom:30px;color:#b00;background:#fff;padding:6px;white-space:pre-wrap;max-width:90%'; d.textContent += (e.message || e) + ' @' + e.lineno + '\\n'; });</script>
<script type="importmap">${inlineImportmap()}</script></head><body><div id="ui"></div><div id="hud"></div>
<script type="application/json" id="match-data">${JSON.stringify(data)}</script>
<script type="module">
const windField = ${windField.toString()};
const matchKernel = ${matchKernel.toString()};
const breathAt = ${breathAt.toString()};
${page}
</script></body></html>`;
writeFileSync(out, html);
console.log(`${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB → ${out}`);
