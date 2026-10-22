// animation-games combo preview: 3- and 5-hit strings and hitstun in the four registers.
//   node scripts/spikes/animation-games/combo-preview.mjs /absolute/out/dir [cast=male]
// writes combo.html (a player: the string to show, its four registers side by side on one clock, each drawn from the
// side and from a ¾ overhead camera (views.mjs), and under each a TIMELINE: every hit a tick coloured by its verdict,
// the stun it left a bar after it (mercy invincibility a bar too), the playhead moving across — a hit whose tick falls
// inside the bar before it links; a slow-motion switch) and combo-<string>.svg (the same timelines for the four
// registers, a frame-data chart: the stun bars, the verdicts, the frames of advantage). Sticks from the rig's bones, a
// sword drawn along the forearm; the depiction is the spike's, not a renderer's.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const K = await import('./combo.mjs');
const Wp = await import('./weapon.mjs');
const { VIEW_JS } = await import('./views.mjs');

const out = process.argv[2]; if (!out) { console.error('usage: combo-preview.mjs /absolute/out/dir [cast]'); process.exit(2); }
const cast = process.argv[3] ?? 'male';
mkdirSync(out, { recursive: true });
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const floor = Math.min(...Object.values(R.legs).flatMap((L) => [R.joints[L.toeBase][2], R.joints[L.toeTip][2]]));
const BONES = R.bones.filter((b) => !/Fold|Face|pelvis$|lumbar/.test(b.id)).map((b) => [b.head, b.tail]);
const cm = (x) => Math.round(x * 100);
const REG = Object.keys(K.COMBO_REGISTERS);
const COL = { realistic: '#3f6fd8', action: '#d6452f', platformer: '#23935c', pinball: '#9545cf' };
const VCOL = { hit: '#1f9d55', blocked: '#c27c0e', immune: '#3f6fd8', whiff: '#8a8f98' };
const solid = (n) => BONES.filter(([a, b]) => n[a] && n[b]).flatMap(([a, b]) => [n[a], n[b]].flatMap((p) => [cm(p[0]), cm(p[1]), cm(p[2] - floor)]));
const SWORD = { hand: 'R', blade: Wp.ITEMS.sword.blade };

const data = { fps: 60, strings: [] };
for (const [id, S] of Object.entries(K.STRINGS)) {
  const entry = { id, label: S.label, by: {} };
  for (const r of REG) {
    const c = K.comboRun(R, { string: id, register: r }), sig = K.comboSignature(c);
    entry.by[r] = { sig, frames: c.frames.length, attacker: c.attackerFrames, held: c.frames.map((f) => (f.held ? 1 : 0)),
      a: c.frames.map((f) => solid(f.a)), v: c.frames.map((f) => solid(f.v)),
      blade: S.weapon ? c.frames.map((f) => Wp.bladeOf(SWORD, f.a).flatMap((p) => [cm(p[0]), cm(p[1]), cm(p[2] - floor)])) : null,
      hits: c.hits.map((h) => ({ move: h.move, frame: h.frame, verdict: h.verdict, stunEnd: h.stunEnd ?? null, hitstop: h.hitstop, advantage: h.advantage ?? null })),
      invuln: K.COMBO_REGISTERS[r].invuln ? Math.round(K.COMBO_REGISTERS[r].invuln * 60) : 0 };
  }
  data.strings.push(entry);
}

// ── the frame-data charts ──
for (const S of data.strings) {
  const maxF = Math.max(...REG.map((r) => S.by[r].attacker)) + 30, PX = 3, ROW = 90, PAD = 150, W = PAD + maxF * PX + 30, H = 70 + REG.length * ROW;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`,
    `<text x="6" y="16" font-size="12">${S.label} — hitstun: each hit a tick (green hit, amber blocked, blue immune, grey whiff), its stun the bar after it; a tick inside the bar before it links. Numbers: frames of advantage</text>`];
  for (let f = 0; f <= maxF; f += 30) svg.push(`<line x1="${PAD + f * PX}" y1="34" x2="${PAD + f * PX}" y2="${H - 10}" stroke="#eee"/><text x="${PAD + f * PX - 8}" y="30" fill="#999">${(f / 60).toFixed(1)}s</text>`);
  REG.forEach((r, i) => {
    const e = S.by[r], y = 50 + i * ROW, X = (f) => PAD + f * PX;
    svg.push(`<text x="6" y="${y + 24}" fill="${COL[r]}" font-weight="bold">${r}</text><text x="6" y="${y + 38}" fill="#666">true combo ${e.sig.trueCombo}/${e.sig.of}</text><text x="6" y="${y + 52}" fill="#666">${e.sig.seconds} s</text>`);
    svg.push(`<line x1="${X(0)}" y1="${y + 30}" x2="${X(e.attacker)}" y2="${y + 30}" stroke="#ccc" stroke-width="2"/>`);
    for (const h of e.hits) {
      if (h.stunEnd != null && h.stunEnd > h.frame) svg.push(`<rect x="${X(h.frame)}" y="${y + 22}" width="${(h.stunEnd - h.frame) * PX}" height="16" fill="${VCOL.hit}" fill-opacity="0.18" stroke="${VCOL.hit}" stroke-opacity="0.5"/>`);
      if (h.hitstop) svg.push(`<rect x="${X(h.frame)}" y="${y + 22}" width="${h.hitstop * PX}" height="16" fill="#f0a020" fill-opacity="0.45"/>`);
      if (e.invuln && h.verdict === 'hit') svg.push(`<rect x="${X(h.frame)}" y="${y + 42}" width="${e.invuln * PX}" height="8" fill="${VCOL.immune}" fill-opacity="0.25"/><text x="${X(h.frame) + 4}" y="${y + 60}" fill="${VCOL.immune}">mercy invincibility</text>`);
      svg.push(`<line x1="${X(h.frame)}" y1="${y + 14}" x2="${X(h.frame)}" y2="${y + 46}" stroke="${VCOL[h.verdict]}" stroke-width="3"/><text x="${X(h.frame) - 10}" y="${y + 10}" fill="${VCOL[h.verdict]}">${h.move}</text>`);
      if (h.advantage != null) svg.push(`<text x="${X(h.frame) + 4}" y="${y + 34}" fill="#333" font-weight="bold">${h.advantage >= 0 ? '+' : ''}${h.advantage}</text>`);
    }
  });
  svg.push('</svg>');
  writeFileSync(join(out, `combo-${S.id}.svg`), svg.join('\n'));
}

// ── the player ──
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Combo registers</title>
<style>
:root{--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--line:#e2e2dc;--steel:#2b2f36}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ececea;--mut:#9a9a94;--line:#2c2c2a;--steel:#d5dbe3}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}.mut{color:var(--mut)}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.pane{border:1px solid var(--line);border-radius:8px;padding:8px;min-width:0}
.pane h2{font-size:14px;margin:0}.pane p{margin:2px 0 6px;font-size:12px;color:var(--mut);min-height:34px}
canvas{width:100%;aspect-ratio:4/3;display:block}canvas.tl{aspect-ratio:6/1}
.view{font-size:11px;color:var(--mut);margin:4px 0 0}
.key{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--mut)}.key i{display:inline-block;width:10px;height:10px;margin-right:4px;vertical-align:-1px}
</style></head><body>
<h1>Combo registers</h1><div class="mut">The same string in each register, one clock, each drawn from the side and from a ¾ overhead camera. Under each, the hits on a timeline: a hit leaves a stun (the bar after its tick); the next hit links when its tick falls inside that bar, and once it has run out the victim blocks. Machine gate only: nobody has looked yet.</div>
<div class="bar"><label>string <select id="str"></select></label><label><input type="checkbox" id="slow"> ¼ speed</label><button id="restart">restart</button><span class="mut" id="clock"></span>
<span class="key"><span><i style="background:${VCOL.hit}"></i>hit</span><span><i style="background:${VCOL.blocked}"></i>blocked</span><span><i style="background:${VCOL.immune}"></i>immune</span><span><i style="background:${VCOL.whiff}"></i>whiff</span><span><i style="background:#f0a020"></i>hitstop</span></span></div>
<div class="grid" id="grid"></div>
<script>
const D=${JSON.stringify(data)};
for(const S of D.strings)for(const e of Object.values(S.by)){e.a=e.a.map(s=>s.map(v=>v/100));e.v=e.v.map(s=>s.map(v=>v/100));if(e.blade)e.blade=e.blade.map(s=>s.map(v=>v/100));}
${VIEW_JS}
const COL=${JSON.stringify(COL)},VCOL=${JSON.stringify(VCOL)};
const sel=document.getElementById('str'),grid=document.getElementById('grid');
D.strings.forEach((s,i)=>sel.add(new Option(s.label,i)));
const panes=Object.keys(COL).map(f=>{const d=document.createElement('div');d.className='pane';d.innerHTML='<h2 style="color:'+COL[f]+'">'+f+'</h2><p></p>'+VIEWS.map(v=>'<div class="view">'+VIEW_NAME[v]+'</div><canvas data-view="'+v+'" width="640" height="480"></canvas>').join('')+'<div class="view">timeline</div><canvas class="tl" width="640" height="107"></canvas>';grid.appendChild(d);return {f,p:d.querySelector('p'),cvs:[...d.querySelectorAll('canvas[data-view]')],tl:d.querySelector('canvas.tl')};});
function label(){const S=D.strings[sel.value];for(const p of panes){const g=S.by[p.f].sig;p.p.textContent='true combo '+g.trueCombo+'/'+g.of+' · '+g.verdicts.join(' · ')+' · '+g.seconds+' s'+(g.lying?' · the victim launched':'');}}
let clockT=0,last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;clockT+=dt*(document.getElementById('slow').checked?0.25:1);
 const S=D.strings[sel.value];const longest=Math.max(...Object.values(S.by).map(e=>e.frames))/D.fps+0.3;if(clockT>longest)clockT=0;
 document.getElementById('clock').textContent=clockT.toFixed(2)+' s';
 const fg=getComputedStyle(document.body).color,steel=getComputedStyle(document.documentElement).getPropertyValue('--steel');
 for(const p of panes){const e=S.by[p.f],k=Math.max(0,Math.min(e.frames-1,Math.floor(clockT*D.fps)));
  for(const cv of p.cvs){const view=cv.dataset.view,ctx=cv.getContext('2d'),W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
   const sc=W/(view==='side'?4.6:4.2),c=proj(view,0,1,0.4),ox=W*0.42,oy=H*(view==='side'?0.62:0.55),Sx=(q)=>[ox+(q[0]-c[0])*sc,oy-(q[1]-c[1])*sc];
   if(view==='side'){const g=Sx([0,0]);ctx.strokeStyle=fg;ctx.globalAlpha=.3;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,g[1]);ctx.lineTo(W,g[1]);ctx.stroke();ctx.globalAlpha=1;}
   else drawGrid(ctx,view,Sx,-2,6,-2,2,fg);
   drawSticks(ctx,view,Sx,e.v[k],'#888',4);drawSticks(ctx,view,Sx,e.a[k],COL[p.f],4);if(e.blade)drawSticks(ctx,view,Sx,e.blade[k],steel,5);
   if(e.held[k]){ctx.fillStyle='#f0a020';ctx.font='bold 18px system-ui';ctx.fillText('HOLD',10,24);}
   const h=e.hits.filter(h=>h.frame<=k).at(-1);if(h&&k-h.frame<30){ctx.fillStyle=VCOL[h.verdict];ctx.font='bold 18px system-ui';ctx.fillText(h.verdict.toUpperCase(),W-130,24);}}
  // the timeline: the stun bars, the hitstop, mercy invincibility, the ticks, the playhead
  const t=p.tl.getContext('2d'),W=p.tl.width,H=p.tl.height,X=(f)=>8+(f/Math.max(...Object.values(S.by).map(x=>x.frames)))*(W-16);t.clearRect(0,0,W,H);
  t.strokeStyle=fg;t.globalAlpha=.3;t.beginPath();t.moveTo(X(0),H/2);t.lineTo(X(e.attacker),H/2);t.stroke();t.globalAlpha=1;
  for(const h of e.hits){if(h.stunEnd!=null&&h.stunEnd>h.frame){t.fillStyle=VCOL.hit;t.globalAlpha=.2;t.fillRect(X(h.frame),H/2-14,X(h.stunEnd)-X(h.frame),28);t.globalAlpha=1;}
   if(h.hitstop){t.fillStyle='#f0a020';t.globalAlpha=.5;t.fillRect(X(h.frame),H/2-14,X(h.frame+h.hitstop)-X(h.frame),28);t.globalAlpha=1;}
   if(e.invuln&&h.verdict==='hit'){t.fillStyle=VCOL.immune;t.globalAlpha=.25;t.fillRect(X(h.frame),H/2+16,X(h.frame+e.invuln)-X(h.frame),8);t.globalAlpha=1;}
   t.strokeStyle=VCOL[h.verdict];t.lineWidth=4;t.beginPath();t.moveTo(X(h.frame),H/2-22);t.lineTo(X(h.frame),H/2+22);t.stroke();
   if(h.advantage!=null){t.fillStyle=fg;t.font='bold 13px system-ui';t.fillText((h.advantage>=0?'+':'')+h.advantage,X(h.frame)+5,H/2-18);}}
  t.strokeStyle=fg;t.lineWidth=2;t.beginPath();t.moveTo(X(k),4);t.lineTo(X(k),H-4);t.stroke();
 }}
sel.onchange=()=>{clockT=0;label();};document.getElementById('restart').onclick=()=>{clockT=0;};
label();requestAnimationFrame(frame);
// inside the review viewer: say how tall the content is (the body's, not the document's: inside a frame that is the frame's own height, and would grow it without end), when it changes
let told=0;const tell=()=>{try{const h=Math.ceil(document.body.scrollHeight);if(parent!==window&&Math.abs(h-told)>2){told=h;parent.postMessage({spikeHeight:h},'*');}}catch(e){}};addEventListener('load',tell);addEventListener('resize',tell);setTimeout(tell,300);
</script></body></html>`;
writeFileSync(join(out, 'combo.html'), html);
console.log(`wrote ${join(out, 'combo.html')} and ${data.strings.map((s) => `combo-${s.id}.svg`).join(', ')}`);
