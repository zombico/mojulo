// animation-games weapon preview: strikes with a held weapon in the four registers.
//   node scripts/spikes/animation-games/weapon-preview.mjs /absolute/out/dir [cast=male]
// writes weapon.html (a player: the swing to show, its four registers side by side on one clock, each drawn from the side
// and from a ¾ overhead camera (views.mjs): the body, its blade, the blade's trail where the register leaves one, the
// victim thrown by the blow; a slow-motion switch) and weapon-<verb>-<item>.svg (every 2nd frame at 60 fps, a row per
// register: holds boxed, the blade drawn, its trail shaded; side views). Sticks from the rig's bones; the blade is drawn
// along the forearm (weapon.mjs); the depiction is the spike's, not a renderer's.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const A = await import('./flavor.mjs');
const Wp = await import('./weapon.mjs');
const { VIEW_JS } = await import('./views.mjs');

const out = process.argv[2]; if (!out) { console.error('usage: weapon-preview.mjs /absolute/out/dir [cast]'); process.exit(2); }
const cast = process.argv[3] ?? 'male';
mkdirSync(out, { recursive: true });
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const floor = Math.min(...Object.values(R.legs).flatMap((L) => [R.joints[L.toeBase][2], R.joints[L.toeTip][2]]));
const BONES = R.bones.filter((b) => !/Fold|Face|pelvis$|lumbar/.test(b.id)).map((b) => [b.head, b.tail]);
const cm = (x) => Math.round(x * 100);
const COL = { realistic: '#3f6fd8', action: '#d6452f', platformer: '#23935c', pinball: '#9545cf' };
const SWINGS = [['chop', 'sword'], ['chop', 'dagger'], ['chop', 'greatsword'], ['thrust', 'sword'], ['rising', 'sword'], ['cleave', 'greatsword']];

// a body in 3D, whole centimetres, the floor at 0; a victim turned to face back (x and y flipped) and placed at `at`
const solid = (n, flip = 1, dy = 0, dz = 0) => BONES.filter(([a, b]) => n[a] && n[b]).flatMap(([a, b]) => [n[a], n[b]].flatMap((p) => [cm(flip * p[0]), cm(dy + flip * p[1]), cm(p[2] - floor + dz)]));
const data = { fps: 60, swings: [] };
for (const [word, item] of SWINGS) {
  const entry = { id: `${word}-${item}`, label: `${word} — ${item} (${Wp.ITEMS[item].cls}, ${Wp.ITEMS[item].kg} kg)`, by: {} };
  for (const f of A.FLAVOR_NAMES) {
    const take = Wp.swingTake(word, item, R, f), X = A.exchange(take, 'hitHigh', f, R), sig = A.signature(R, X.attacker, { take });
    const { nodes } = A.nodesOf(R, X.attacker), trail = Wp.trails(take, f, nodes);
    const tipAt = Wp.bladeOf(take, nodes[X.attacker.beats.find((b) => b.id === 'contact').frame])[1];
    const at = tipAt[1] + 0.12;   // the victim's root, so its chest meets the tip
    const vn = A.nodesOf(R, X.victim).nodes, peak = X.victim.beats.find((b) => b.id === 'peak'), free = peak.frame + X.victim.hitstop, kb = X.blow.knockback;
    entry.by[f] = { seconds: Math.max(X.attacker.seconds, X.offset / 60 + X.victim.seconds), offset: X.offset, blow: X.blow, sig, held: X.attacker.frames.map((x) => x.held),
      a: nodes.map((n) => solid(n)), blade: nodes.map((n) => Wp.bladeOf(take, n).flatMap((p, i) => [cm(p[0]), cm(p[1]), cm(p[2] - floor)])), trail,
      v: vn.map((n, j) => { let dy = at, dz = 0; if (j > free) { const t = (j - free) / 60, T = Math.max(0.25, kb.airborne + 0.3), u = Math.min(1, t / T); dy += kb.distance * (1 - (1 - u) ** 2); if (t < kb.airborne) dz = kb.height * 4 * (t / kb.airborne) * (1 - t / kb.airborne); } return solid(n, -1, dy, dz); }) };
  }
  data.swings.push(entry);
}

// ── the filmstrips (side views) ──
for (const S of data.swings) {
  const rows = A.FLAVOR_NAMES.map((f) => [f, S.by[f]]);
  const n = Math.max(...rows.map(([, e]) => Math.max(e.a.length, e.offset + e.v.length)));
  const cols = Math.min(70, Math.ceil(n / 2)), W = 96, H = 130, PAD = 110, sc = 34;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${PAD + cols * W}" height="${rows.length * H + 30}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`,
    `<text x="6" y="16" font-size="12">${S.label} — every 2nd frame at 60 fps (1 column = 1/30 s); boxed = held (charge / hitstop), the blade dark, its trail shaded</text>`];
  rows.forEach(([f, e], ri) => {
    const y0 = 30 + ri * H, base = y0 + H - 12;
    svg.push(`<text x="6" y="${y0 + 46}" fill="${COL[f]}" font-weight="bold">${f}</text><text x="6" y="${y0 + 60}" fill="#666">${e.a.length - 1} f</text><text x="6" y="${y0 + 74}" fill="#666">freeze ${e.blow.hitstop} f</text><text x="6" y="${y0 + 88}" fill="#666">Δv ${e.blow.dv} m/s</text>`);
    for (let c = 0; c < cols; c++) {
      const k = c * 2, x0 = PAD + c * W, P = (y, z) => `${(x0 + 26 + (y / 100) * sc).toFixed(1)},${(base - (z / 100) * sc).toFixed(1)}`;
      const line = (s, j, col, w, op = 1) => { const [a1, b1] = P(s[j + 1], s[j + 2]).split(','), [a2, b2] = P(s[j + 4], s[j + 5]).split(','); return `<line x1="${a1}" y1="${b1}" x2="${a2}" y2="${b2}" stroke="${col}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round"/>`; };
      svg.push(`<clipPath id="w${ri}_${c}"><rect x="${x0}" y="${y0}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#w${ri}_${c})">`);
      const ka = Math.min(k, e.a.length - 1), kv = Math.max(0, Math.min(k - e.offset, e.v.length - 1));
      if (e.held[ka] && k < e.a.length) svg.push(`<rect x="${x0 + 1}" y="${y0 + 2}" width="${W - 2}" height="${H - 6}" fill="none" stroke="#f0a020" stroke-width="2"/>`);
      if (k < e.a.length) for (let j = Math.max(1, ka - 5); j <= ka; j++) if (e.trail[j]) { const p = e.blade[j - 1], q = e.blade[j]; svg.push(`<polygon points="${[P(p[1], p[2]), P(p[4], p[5]), P(q[4], q[5]), P(q[1], q[2])].join(' ')}" fill="${COL[f]}" fill-opacity="${(0.08 + 0.04 * (j - ka + 5)).toFixed(2)}"/>`); }
      for (let j = 0; j < e.v[kv].length; j += 6) svg.push(line(e.v[kv], j, '#555', 2));   // the victim stands there from the start
      for (let j = 0; j < e.a[ka].length; j += 6) svg.push(line(e.a[ka], j, COL[f], 2));
      svg.push(line(e.blade[ka], 0, '#2b2f36', 3));
      svg.push('</g>', `<line x1="${x0}" y1="${base}" x2="${x0 + W}" y2="${base}" stroke="#ddd"/>`);
    }
  });
  svg.push('</svg>');
  writeFileSync(join(out, `weapon-${S.id}.svg`), svg.join('\n'));
}

// ── the player ──
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weapon registers</title>
<style>
:root{--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--line:#e2e2dc;--steel:#2b2f36}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ececea;--mut:#9a9a94;--line:#2c2c2a;--steel:#d5dbe3}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}.mut{color:var(--mut)}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.pane{border:1px solid var(--line);border-radius:8px;padding:8px;min-width:0}
.pane h2{font-size:14px;margin:0}.pane p{margin:2px 0 6px;font-size:12px;color:var(--mut);min-height:34px}
canvas{width:100%;aspect-ratio:4/3;display:block}
.view{font-size:11px;color:var(--mut);margin:4px 0 0}
</style></head><body>
<h1>Weapon registers</h1><div class="mut">The same swing in each register, one clock, each drawn from the side and from a ¾ overhead camera. At contact the blade's tip is in the same place in all four; what differs is how long the weight takes, a charge, the trail, the freeze and what the blow hands on. Machine gate only: nobody has looked yet.</div>
<div class="bar"><label>swing <select id="swing"></select></label><label><input type="checkbox" id="slow"> ¼ speed</label><button id="restart">restart</button><span class="mut" id="clock"></span></div>
<div class="grid" id="grid"></div>
<script>
const D=${JSON.stringify(data)};
for(const S of D.swings)for(const e of Object.values(S.by)){for(const k of ['a','v','blade'])e[k]=e[k].map(s=>s.map(v=>v/100));}
${VIEW_JS}
const COL=${JSON.stringify(COL)};
const sel=document.getElementById('swing'),grid=document.getElementById('grid');
D.swings.forEach((s,i)=>sel.add(new Option(s.label,i)));
const panes=Object.keys(COL).map(f=>{const d=document.createElement('div');d.className='pane';d.innerHTML='<h2 style="color:'+COL[f]+'">'+f+'</h2><p></p>'+VIEWS.map(v=>'<div class="view">'+VIEW_NAME[v]+'</div><canvas data-view="'+v+'" width="640" height="480"></canvas>').join('');grid.appendChild(d);return {f,p:d.querySelector('p'),cvs:[...d.querySelectorAll('canvas')]};});
function label(){const S=D.swings[sel.value];for(const p of panes){const e=S.by[p.f],b=e.blow;p.p.textContent=e.seconds.toFixed(2)+' s · tip '+b.handSpeed+' m/s · victim Δv '+b.dv+' m/s (×'+b.powerscale+') · freeze '+b.hitstop+' f · thrown '+b.knockback.distance+' m';}}
let clockT=0,last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;clockT+=dt*(document.getElementById('slow').checked?0.25:1);
 const S=D.swings[sel.value];const longest=Math.max(...Object.values(S.by).map(e=>e.seconds))+0.6;if(clockT>longest)clockT=0;
 document.getElementById('clock').textContent=clockT.toFixed(2)+' s';
 const fg=getComputedStyle(document.body).color,steel=getComputedStyle(document.documentElement).getPropertyValue('--steel');
 for(const p of panes)for(const cv of p.cvs){const view=cv.dataset.view,e=S.by[p.f],ctx=cv.getContext('2d'),W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
  const sc=W/(view==='side'?4.6:4.2),c=proj(view,0,0.9,0.4),ox=W*0.42,oy=H*(view==='side'?0.62:0.55),Sx=(q)=>[ox+(q[0]-c[0])*sc,oy-(q[1]-c[1])*sc];
  if(view==='side'){const g=Sx([0,0]);ctx.strokeStyle=fg;ctx.globalAlpha=.3;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,g[1]);ctx.lineTo(W,g[1]);ctx.stroke();ctx.globalAlpha=1;}
  else drawGrid(ctx,view,Sx,-2,5,-2,2,fg);
  const k=Math.floor(clockT*D.fps),ka=Math.max(0,Math.min(e.a.length-1,k)),kv=Math.max(0,Math.min(e.v.length-1,k-e.offset));
  // the trail: the blade's last few positions, shaded between, fading
  if(k<e.a.length)for(let j=Math.max(1,ka-6);j<=ka;j++)if(e.trail[j]){const a=e.blade[j-1],b=e.blade[j];ctx.globalAlpha=0.06+0.05*(j-ka+6);ctx.fillStyle=COL[p.f];ctx.beginPath();[[a[0],a[1],a[2]],[a[3],a[4],a[5]],[b[3],b[4],b[5]],[b[0],b[1],b[2]]].forEach((q,i)=>{const s=Sx(proj(view,q[0],q[1],q[2]));i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1]);});ctx.closePath();ctx.fill();}
  ctx.globalAlpha=1;
  drawSticks(ctx,view,Sx,e.v[kv],'#888',4);
  drawSticks(ctx,view,Sx,e.a[ka],COL[p.f],4);
  drawSticks(ctx,view,Sx,e.blade[ka],steel,5);
  if(e.held[ka]&&k<e.a.length){ctx.fillStyle='#f0a020';ctx.font='bold 18px system-ui';ctx.fillText('HOLD',10,24);}
 }}
sel.onchange=()=>{clockT=0;label();};document.getElementById('restart').onclick=()=>{clockT=0;};
label();requestAnimationFrame(frame);
// inside the review viewer: say how tall the page is, so its frame fits it
const tell=()=>{try{parent!==window&&parent.postMessage({spikeHeight:document.documentElement.scrollHeight},'*');}catch(e){}};addEventListener('load',tell);addEventListener('resize',tell);setTimeout(tell,300);
</script></body></html>`;
writeFileSync(join(out, 'weapon.html'), html);
console.log(`wrote ${join(out, 'weapon.html')} and ${data.swings.map((s) => `weapon-${s.id}.svg`).join(', ')}`);
