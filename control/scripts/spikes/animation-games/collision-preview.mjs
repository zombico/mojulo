// animation-games collision preview: walking and running into a wall or another body, in the four flavors.
//   node scripts/spikes/animation-games/collision-preview.mjs /absolute/out/dir [cast=male]
// writes collision.html (a player: the case to show, the four flavors side by side on one clock, the camera fixed on the
// point of contact, a slow-motion switch) and collision-<gait>-<target>.svg (a strobe a case: from a quarter second
// before contact, the bodies every 5th frame where they are, a row per flavor, later frames darker). Side view, sticks
// from the rig's bones; the depiction is the spike's, not a renderer's.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const Cm = await import('./collision.mjs');

const out = process.argv[2]; if (!out) { console.error('usage: collision-preview.mjs /absolute/out/dir [cast]'); process.exit(2); }
const cast = process.argv[3] ?? 'male';
mkdirSync(out, { recursive: true });
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const BONES = R.bones.filter((b) => !/Fold|Face|pelvis$|lumbar/.test(b.id)).map((b) => [b.head, b.tail]);
const r2 = (x) => Math.round(x * 100) / 100;
const NAMES = Object.keys(Cm.COLLIDE_FLAVORS);
const CASES = [['walk', 'wall', 'walk into a wall'], ['walk', 'unit', 'walk into a body'], ['run', 'wall', 'run into a wall'], ['run', 'unit', 'run into a body']];
const COL = { realistic: '#3f6fd8', action: '#d6452f', platformer: '#23935c', pinball: '#9545cf' };
const sticks = (n) => (n ? BONES.filter(([a, b]) => n[a] && n[b]).flatMap(([a, b]) => [n[a][1], n[a][2], n[b][1], n[b][2]].map(r2)) : null);

const data = { fps: 60, cases: [] };
for (const [gait, target, label] of CASES) {
  const entry = { id: `${gait}-${target}`, label, target, by: {} };
  for (const f of NAMES) {
    const c = Cm.collide(R, { flavor: f, gait, target }), sig = Cm.collisionSignature(R, c);
    entry.by[f] = { wall: r2(c.wall), contact: c.contact, sig, frames: c.frames.map((fr) => ({ a: sticks(fr.a), b: sticks(fr.b), h: !!fr.held, p: fr.part })) };
  }
  data.cases.push(entry);
}

// ── the strobes ──
const PX = 30, ROW = 110, PAD = 190, BACK = 7.5, AHEAD = 11.5;
for (const C of data.cases) {
  const W = PAD + (BACK + AHEAD) * PX, H = 40 + NAMES.length * ROW;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`,
    `<text x="6" y="16" font-size="12">${C.label} — from ¼ s before contact, the bodies every 5th frame at 60 fps where they are, later frames darker; 1 tick = 1 m</text>`];
  NAMES.forEach((f, i) => {
    const e = C.by[f], base = 40 + (i + 1) * ROW - 14, X = (m) => r2(PAD + (m - (e.wall - BACK)) * PX), Y = (z) => r2(base - z * PX);
    svg.push(`<line x1="${PAD}" y1="${base}" x2="${W}" y2="${base}" stroke="#ccc"/>`);
    for (let m = Math.ceil(e.wall - BACK); m <= e.wall + AHEAD; m++) svg.push(`<line x1="${X(m)}" y1="${base}" x2="${X(m)}" y2="${base + 4}" stroke="#bbb"/>`);
    if (C.target === 'wall') svg.push(`<rect x="${X(e.wall)}" y="${base - 2.6 * PX}" width="${0.3 * PX}" height="${2.6 * PX}" fill="#9aa3b2"/>`);
    const s = e.sig, who = (x) => (x ? `${x.state}${x.lying && !['down', 'launch'].includes(x.state) ? ', down' : ''}${x.state === 'launch' ? ' (lands lying)' : ''}` : '');
    svg.push(`<text x="6" y="${base - 58}" fill="${COL[f]}" font-weight="bold">${f}</text><text x="6" y="${base - 44}" fill="#666">${who(s.a)}${s.b ? ` / ${who(s.b)}` : ''}</text><text x="6" y="${base - 30}" fill="#666">leaves ${s.a.vOut} m/s${s.b ? ` / ${s.b.vOut}` : ''}</text><text x="6" y="${base - 16}" fill="#666">freeze ${s.hitstop} f</text>`);
    const k0 = Math.max(0, e.contact - 15);
    for (let k = k0; k < e.frames.length; k += 5) {
      const fr = e.frames[k], u = (k - k0) / (e.frames.length - k0), op = (0.2 + 0.8 * u).toFixed(2);
      for (const [body, col] of [[fr.a, COL[f]], [fr.b, '#555']]) if (body) for (let j = 0; j < body.length; j += 4) {
        if ([body[j], body[j + 2]].some((v) => v < e.wall - BACK || v > e.wall + AHEAD)) continue;
        svg.push(`<line x1="${X(body[j])}" y1="${Y(body[j + 1])}" x2="${X(body[j + 2])}" y2="${Y(body[j + 3])}" stroke="${col}" stroke-opacity="${op}" stroke-width="1.4" stroke-linecap="round"/>`);
      }
    }
  });
  svg.push('</svg>');
  writeFileSync(join(out, `collision-${C.id}.svg`), svg.join('\n'));
}

// ── the player ──
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collision flavors</title>
<style>
:root{--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--line:#e2e2dc;--wall:#9aa3b2}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ececea;--mut:#9a9a94;--line:#2c2c2a;--wall:#5d6573}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}.mut{color:var(--mut)}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.pane{border:1px solid var(--line);border-radius:8px;padding:8px;min-width:0}
.pane h2{font-size:14px;margin:0}.pane p{margin:2px 0 6px;font-size:12px;color:var(--mut);min-height:34px}
canvas{width:100%;aspect-ratio:2/1;display:block}
</style></head><body>
<h1>Collision flavors</h1><div class="mut">The same approach in each flavor, one clock, the camera fixed on the point of contact (8 m across). What the impact does differs: the speed each body leaves with, how much of the change it shows, the response, the freeze, the squash. Machine gate only: nobody has looked yet.</div>
<div class="bar"><label>case <select id="case"></select></label><label><input type="checkbox" id="slow"> ¼ speed</label><button id="restart">restart</button><span class="mut" id="clock"></span></div>
<div class="grid" id="grid"></div>
<script>
const D=${JSON.stringify(data)};
const COL=${JSON.stringify(COL)};
const sel=document.getElementById('case'),grid=document.getElementById('grid');
D.cases.forEach((c,i)=>sel.add(new Option(c.label,i)));
const panes=Object.keys(COL).map(f=>{const d=document.createElement('div');d.className='pane';d.innerHTML='<h2 style="color:'+COL[f]+'">'+f+'</h2><p></p><canvas width="640" height="320"></canvas>';grid.appendChild(d);return {f,cv:d.querySelector('canvas'),p:d.querySelector('p')};});
const say=(x)=>x?x.state+(x.state==='launch'?' (lands lying)':x.lying&&x.state!=='down'?', down':'')+' · leaves '+x.vOut+' m/s':'';
function label(){const C=D.cases[sel.value];for(const p of panes){const s=C.by[p.f].sig;p.p.textContent=say(s.a)+(s.b?' — the other: '+say(s.b):'')+' · freeze '+s.hitstop+' f';}}
let clockT=0,last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;clockT+=dt*(document.getElementById('slow').checked?0.25:1);
 const C=D.cases[sel.value];const longest=Math.max(...panes.map(p=>C.by[p.f].frames.length/D.fps))+0.5;if(clockT>longest)clockT=0;
 document.getElementById('clock').textContent=clockT.toFixed(2)+' s';
 const cs=getComputedStyle(document.documentElement),fg=getComputedStyle(document.body).color,wallC=cs.getPropertyValue('--wall');
 for(const p of panes){const e=C.by[p.f],ctx=p.cv.getContext('2d'),W=p.cv.width,H=p.cv.height;ctx.clearRect(0,0,W,H);
  const k=Math.max(0,Math.min(e.frames.length-1,Math.floor(clockT*D.fps))),fr=e.frames[k];const sc=W/8,cx=W*0.55,oy=H*0.9,X=(m)=>cx+(m-e.wall)*sc,Y=(z)=>oy-z*sc;
  ctx.strokeStyle=fg;ctx.globalAlpha=.3;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(W,oy);ctx.stroke();
  for(let m=Math.floor(e.wall-5);m<e.wall+5;m++){ctx.beginPath();ctx.moveTo(X(m),oy);ctx.lineTo(X(m),oy+6);ctx.stroke();}ctx.globalAlpha=1;
  if(C.target==='wall'){ctx.fillStyle=wallC;ctx.fillRect(X(e.wall),Y(2.6),0.3*sc,2.6*sc);}
  ctx.lineCap='round';ctx.lineWidth=4;
  for(const [body,col] of [[fr.b,'#888'],[fr.a,COL[p.f]]]){if(!body)continue;ctx.strokeStyle=col;for(let j=0;j<body.length;j+=4){ctx.beginPath();ctx.moveTo(X(body[j]),Y(body[j+1]));ctx.lineTo(X(body[j+2]),Y(body[j+3]));ctx.stroke();}}
  if(fr.h){ctx.fillStyle='#f0a020';ctx.font='bold 18px system-ui';ctx.fillText('HOLD',10,24);}
 }}
sel.onchange=()=>{clockT=0;label();};document.getElementById('restart').onclick=()=>{clockT=0;};
label();requestAnimationFrame(frame);
// inside the review viewer: say how tall the page is, so its frame fits it
const tell=()=>{try{parent!==window&&parent.postMessage({spikeHeight:document.documentElement.scrollHeight},'*');}catch(e){}};addEventListener('load',tell);addEventListener('resize',tell);setTimeout(tell,300);
</script></body></html>`;
writeFileSync(join(out, 'collision.html'), html);
console.log(`wrote ${join(out, 'collision.html')} and ${data.cases.map((c) => `collision-${c.id}.svg`).join(', ')}`);
