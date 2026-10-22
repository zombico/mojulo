// animation-games motion preview: the run-up, the running jump and the run-out in the four flavors.
//   node scripts/spikes/animation-games/motion-preview.mjs /absolute/out/dir [cast=male]
// writes motion.html (a player: the four runners, each with a camera that follows it over a ground ticked every metre,
// a slow-motion switch) and motion-strobe.svg (a chronophotograph: the body every 6th frame at 60 fps where it really
// is, a row per flavor on one scale, so the run-up's spacing and the jump's arc read at once). Side view, sticks from the
// rig's bones; the depiction is the spike's, not a renderer's.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const M = await import('./motion.mjs');
const { VIEW_JS } = await import('./views.mjs');

const out = process.argv[2]; if (!out) { console.error('usage: motion-preview.mjs /absolute/out/dir [cast]'); process.exit(2); }
const cast = process.argv[3] ?? 'male';
mkdirSync(out, { recursive: true });
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const BONES = R.bones.filter((b) => !/Fold|Face|pelvis$|lumbar/.test(b.id)).map((b) => [b.head, b.tail]);
const r3 = (x) => Math.round(x * 1000) / 1000;
const NAMES = Object.keys(M.MOTION_FLAVORS);
const C = { realistic: '#5b8def', action: '#e5533d', platformer: '#2fa66a', pinball: '#b05be0' };

const runs = NAMES.map((f) => {
  const run = M.runJump(R, f), sig = M.motionSignature(R, run);
  const sticks = run.frames.map((fr) => BONES.filter(([a, b]) => fr.nodes[a] && fr.nodes[b]).flatMap(([a, b]) => [fr.nodes[a][1], fr.nodes[a][2], fr.nodes[b][1], fr.nodes[b][2]].map(r3)));
  // the player's: 3D, centimetres, the floor at 0
  const r2 = (x) => Math.round(x * 100) / 100;
  const solid = run.frames.map((fr) => BONES.filter(([a, b]) => fr.nodes[a] && fr.nodes[b]).flatMap(([a, b]) => [fr.nodes[a], fr.nodes[b]].flatMap((q) => [r2(q[0]), r2(q[1]), r2(q[2] - run.floor)])));
  return { f, sig, beats: run.beats, floor: run.floor, frames: run.frames.map((fr, k) => ({ s: sticks[k], s3: solid[k], x: fr.root[1], v: fr.speed, p: fr.part, h: !!fr.held })) };
});

// ── the chronophotograph ──
const EVERY = 6, PX = 34, ROW = 120, PAD = 180, LEFT = 0;
const span = Math.max(...runs.map((r) => r.frames.at(-1).x)) + 2;
const W = PAD + span * PX, H = 40 + runs.length * ROW;
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(W)}" height="${H}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`,
  `<text x="6" y="16" font-size="12">run-up from a jog, running jump, run-out — the body every ${EVERY}th frame at 60 fps (${60 / EVERY} a second) where it is; 1 tick = 1 m; the jump's frames darker</text>`];
runs.forEach((r, i) => {
  const base = 40 + (i + 1) * ROW - 16, X = (m) => r3(PAD + (m - LEFT) * PX), Y = (z) => r3(base - (z - r.floor) * PX);
  svg.push(`<line x1="${PAD}" y1="${base}" x2="${W}" y2="${base}" stroke="#ccc"/>`);
  for (let m = 0; m <= span; m++) svg.push(`<line x1="${X(m)}" y1="${base}" x2="${X(m)}" y2="${base + (m % 5 ? 3 : 7)}" stroke="#bbb"/>`);
  svg.push(`<text x="6" y="${base - 60}" fill="${C[r.f]}" font-weight="bold">${r.f}</text><text x="6" y="${base - 46}" fill="#666">take-off ${r.sig.takeoffSpeed.toFixed(1)} m/s</text><text x="6" y="${base - 32}" fill="#666">jump ${r.sig.length.toFixed(1)} m, ${r.sig.height.toFixed(2)} high</text><text x="6" y="${base - 18}" fill="#666">air ${r.sig.air.toFixed(2)} s</text>`);
  r.frames.forEach((fr, k) => {
    const inJump = fr.p !== 'run';
    if (k % EVERY && !(inJump && k % 3 === 0) && k !== r.beats.takeoff && k !== r.beats.land) return;
    const col = C[r.f], op = inJump ? 0.95 : 0.35;
    for (let j = 0; j < fr.s.length; j += 4) svg.push(`<line x1="${X(fr.s[j])}" y1="${Y(fr.s[j + 1])}" x2="${X(fr.s[j + 2])}" y2="${Y(fr.s[j + 3])}" stroke="${col}" stroke-opacity="${op}" stroke-width="${inJump ? 1.8 : 1.2}" stroke-linecap="round"/>`);
  });
});
svg.push('</svg>');
writeFileSync(join(out, 'motion-strobe.svg'), svg.join('\n'));

// ── the player ──
const data = { fps: 60, runs: runs.map((r) => ({ f: r.f, beats: r.beats, sig: r.sig, frames: r.frames.map((fr) => ({ s: fr.s3, x: fr.x, v: fr.v, p: fr.p, h: fr.h })) })) };
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion flavors</title>
<style>
:root{--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--line:#e2e2dc}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ececea;--mut:#9a9a94;--line:#2c2c2a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}.mut{color:var(--mut)}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:12px 0}
.pane{border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:10px}
.pane h2{font-size:14px;margin:0;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.pane h2 span{font-weight:400;font-size:12px;color:var(--mut)}
canvas{width:100%;aspect-ratio:4/1;display:block}
canvas[data-view="three"]{aspect-ratio:3/1}
.view{font-size:11px;color:var(--mut);margin:4px 0 0}
</style></head><body>
<h1>Motion flavors</h1><div class="mut">A run-up from a jog, the running jump, the landing, a run-out. Each camera follows its runner; the ticks are one metre apart, so their speed past you is the runner's. Machine gate only: nobody has looked yet.</div>
<div class="bar"><label><input type="checkbox" id="slow"> ¼ speed</label><button id="restart">restart</button><span class="mut" id="clock"></span></div>
<div id="panes"></div>
<script>
const D=${JSON.stringify(data)};
${VIEW_JS}
const COL={realistic:'#5b8def',action:'#e5533d',platformer:'#2fa66a',pinball:'#b05be0'};
const host=document.getElementById('panes');
const panes=D.runs.map(r=>{const d=document.createElement('div');d.className='pane';const s=r.sig;d.innerHTML='<h2 style="color:'+COL[r.f]+'">'+r.f+'<span>top '+(s.toTop90==null?'not reached':'90% in '+s.toTop90+' s')+' · take-off '+s.takeoffSpeed.toFixed(1)+' m/s · '+s.framesPerStride.toFixed(1)+' frames a stride · jump '+s.length.toFixed(1)+' m long, '+s.height.toFixed(2)+' m high, '+s.air.toFixed(2)+' s air</span></h2>'+VIEWS.map(v=>'<div class="view">'+VIEW_NAME[v]+'</div><canvas data-view="'+v+'" width="1200" height="'+(v==='side'?300:400)+'"></canvas>').join('');host.appendChild(d);return {r,cvs:[...d.querySelectorAll('canvas')]};});
let clockT=0,last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;clockT+=dt*(document.getElementById('slow').checked?0.25:1);
 const longest=Math.max(...D.runs.map(r=>r.frames.length/D.fps))+0.5;if(clockT>longest)clockT=0;
 document.getElementById('clock').textContent=clockT.toFixed(2)+' s';
 const fg=getComputedStyle(document.body).color;
 for(const p of panes)for(const cv of p.cvs){const view=cv.dataset.view,ctx=cv.getContext('2d'),W=cv.width,H=cv.height,r=p.r;ctx.clearRect(0,0,W,H);
  const k=Math.max(0,Math.min(r.frames.length-1,Math.floor(clockT*D.fps))),fr=r.frames[k],cam=fr.x;
  // the camera follows the runner: the side view's 3.2 m tall, the ¾ view's a little wider
  const sc=view==='side'?H/3.2:H/2.7,c=proj(view,0,cam,0),cx=W*0.35,oy=H*(view==='side'?0.88:0.78),S=(q)=>[cx+(q[0]-c[0])*sc,oy-(q[1]-c[1])*sc];
  if(view==='side'){ctx.strokeStyle=fg;ctx.globalAlpha=.3;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(W,oy);ctx.stroke();
   for(let m=Math.floor(cam-cx/sc)-1;m<cam+(W-cx)/sc+1;m++){const x=cx+(m-cam)*sc;ctx.beginPath();ctx.moveTo(x,oy);ctx.lineTo(x,oy+(m%5?6:14));ctx.stroke();}ctx.globalAlpha=1;}
  else drawGrid(ctx,view,S,cam-8,cam+14,-2,2,fg);
  // the take-off and the landing marked on the floor
  const tk=r.frames[r.beats.takeoff].x,ld=r.frames[r.beats.land].x;ctx.globalAlpha=.6;
  for(const m of [tk,ld]){const a=S(proj(view,-0.4,m,0)),b=S(proj(view,0.4,m,0));if(view==='side'){ctx.fillStyle=COL[r.f];ctx.fillRect(a[0]-2,oy-2,4,10);}else{ctx.strokeStyle=COL[r.f];ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}ctx.globalAlpha=1;
  drawSticks(ctx,view,S,fr.s,COL[r.f],4);
  ctx.fillStyle=fg;ctx.font='14px system-ui';ctx.fillText(fr.v.toFixed(1)+' m/s · '+fr.p+(fr.h?' · HOLD':''),12,22);
 }}
document.getElementById('restart').onclick=()=>{clockT=0;};requestAnimationFrame(frame);
// inside the review viewer: say how tall the content is (the body's, not the document's: inside a frame that is the frame's own height, and would grow it without end), when it changes
let told=0;const tell=()=>{try{const h=Math.ceil(document.body.scrollHeight);if(parent!==window&&Math.abs(h-told)>2){told=h;parent.postMessage({spikeHeight:h},'*');}}catch(e){}};addEventListener('load',tell);addEventListener('resize',tell);setTimeout(tell,300);
</script></body></html>`;
writeFileSync(join(out, 'motion.html'), html);
console.log(`wrote ${join(out, 'motion.html')} and motion-strobe.svg`);
