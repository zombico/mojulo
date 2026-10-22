// animation-games collision preview: walking and running into a wall or another body, in the four flavors, and into
// walls by their property (bouncy, treadmill, sticky).
//   node scripts/spikes/animation-games/collision-preview.mjs /absolute/out/dir [cast=male]
// writes collision.html (a player: the case to show, its four panes side by side on one clock, each drawn twice — a side
// view and a ¾ overhead one (views.mjs) — the camera on the point of contact, rising with a body that goes up the wall;
// a slow-motion switch) and collision-<case>.svg (a strobe a case: from a quarter second before contact, the bodies every
// 5th frame where they are, a row per pane, later frames darker; side views). Sticks from the rig's bones; the depiction
// is the spike's, not a renderer's.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const Cm = await import('./collision.mjs');
const { VIEW_JS } = await import('./views.mjs');

const out = process.argv[2]; if (!out) { console.error('usage: collision-preview.mjs /absolute/out/dir [cast]'); process.exit(2); }
const cast = process.argv[3] ?? 'male';
mkdirSync(out, { recursive: true });
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const floor = Math.min(...Object.values(R.legs).flatMap((L) => [R.joints[L.toeBase][2], R.joints[L.toeTip][2]]));
const BONES = R.bones.filter((b) => !/Fold|Face|pelvis$|lumbar/.test(b.id)).map((b) => [b.head, b.tail]);
const r2 = (x) => Math.round(x * 100) / 100;
const NAMES = Object.keys(Cm.COLLIDE_FLAVORS);
const COL = { realistic: '#3f6fd8', action: '#d6452f', platformer: '#23935c', pinball: '#9545cf' };
const WCOL = { bouncy: '#d6452f', treadmill: '#b8660b', walk: '#23935c', climb: '#3f6fd8' };

// the cases: four by flavor (each flavor's own wall or body), three by the wall's property (the body's flavor named)
const byFlavor = (gait, target, label) => ({ id: `${gait}-${target}`, label, target, panes: NAMES.map((f) => ({ label: f, color: COL[f], opts: { flavor: f, gait, target } })) });
const byWall = (gait, label, bouncy) => ({ id: `walls-${gait}`, label, target: 'wall', panes: [
  { label: `bouncy (${bouncy.flavor}'s, e ${bouncy.e})`, color: WCOL.bouncy, opts: { flavor: bouncy.flavor, gait, target: 'wall', wall: { kind: 'bouncy', e: bouncy.e } } },
  { label: 'treadmill', color: WCOL.treadmill, opts: { flavor: 'action', gait, target: 'wall', wall: { kind: 'treadmill' } } },
  { label: 'sticky: walk up', color: WCOL.walk, opts: { flavor: 'action', gait, target: 'wall', wall: { kind: 'sticky', mode: 'walk' } } },
  { label: 'sticky: climb (0.6 m/s)', color: WCOL.climb, opts: { flavor: 'action', gait, target: 'wall', wall: { kind: 'sticky', mode: 'climb', speed: 0.6 } } },
] });
const CASES = [
  byFlavor('walk', 'wall', 'walk into a wall'), byFlavor('walk', 'unit', 'walk into a body'), byFlavor('run', 'wall', 'run into a wall'), byFlavor('run', 'unit', 'run into a body'),
  byWall('walk', 'walk into a wall, by its property', { flavor: 'pinball', e: 1.3 }), byWall('run', 'run into a wall, by its property', { flavor: 'action', e: 0.4 }),
  { id: 'bouncy-tuned', label: 'run into a bouncy wall, tuned', target: 'wall', panes: [
    { label: 'e 0.3 (action)', color: '#e08a6f', opts: { flavor: 'action', gait: 'run', target: 'wall', wall: { kind: 'bouncy', e: 0.3 } } },
    { label: 'e 1.0 (pinball)', color: '#b57fe0', opts: { flavor: 'pinball', gait: 'run', target: 'wall', wall: { kind: 'bouncy', e: 1.0 } } },
    { label: 'e 1.6 (pinball)', color: '#7b2fb5', opts: { flavor: 'pinball', gait: 'run', target: 'wall', wall: { kind: 'bouncy', e: 1.6 } } },
    { label: 'rebound 5 m/s, hop 1 m (platformer)', color: COL.platformer, opts: { flavor: 'platformer', gait: 'run', target: 'wall', wall: { kind: 'bouncy', rebound: 5, hop: 1 } } },
  ] },
];

// the page's bodies in whole centimetres (it divides by 100 on load: a third smaller than metres to two places)
const cm = (x) => Math.round(x * 100);
const solid = (n) => (n ? BONES.filter(([a, b]) => n[a] && n[b]).flatMap(([a, b]) => [n[a], n[b]].flatMap((p) => [cm(p[0]), cm(p[1]), cm(p[2] - floor)])) : null);
const data = { fps: 60, cases: [] };
for (const C of CASES) {
  const entry = { id: C.id, label: C.label, target: C.target, panes: [] };
  for (const P of C.panes) {
    const c = Cm.collide(R, P.opts), sig = Cm.collisionSignature(R, c);
    entry.panes.push({ label: P.label, color: P.color, wall: r2(c.wall), kind: c.wallKind, contact: c.contact, sig,
      frames: c.frames.map((fr) => ({ a: solid(fr.a), b: solid(fr.b), h: !!fr.held, z: r2(fr.a.navel[2] - floor) })) });
  }
  data.cases.push(entry);
}

// ── the strobes (side views) ──
const PX = 30, PAD = 200, BACK = 7.5, AHEAD = 11.5;
const tall = (C) => C.panes.some((p) => ['wallwalk', 'climb'].includes(p.sig.a.state));
for (const C of data.cases) {
  const ROW = tall(C) ? 200 : 110, W = PAD + (BACK + AHEAD) * PX, H = 40 + C.panes.length * ROW;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`,
    `<text x="6" y="16" font-size="12">${C.label} — from ¼ s before contact, the bodies every 5th frame at 60 fps where they are, later frames darker; 1 tick = 1 m</text>`];
  C.panes.forEach((e, i) => {
    const base = 40 + (i + 1) * ROW - 14, top = base - ROW + 18, X = (m) => r2(PAD + (m - (e.wall - BACK)) * PX), Y = (z) => r2(base - z * PX);
    svg.push(`<clipPath id="row${i}"><rect x="${PAD}" y="${top}" width="${W - PAD}" height="${base - top + 6}"/></clipPath>`);
    svg.push(`<line x1="${PAD}" y1="${base}" x2="${W}" y2="${base}" stroke="#ccc"/>`);
    for (let m = Math.ceil(e.wall - BACK); m <= e.wall + AHEAD; m++) svg.push(`<line x1="${X(m)}" y1="${base}" x2="${X(m)}" y2="${base + 4}" stroke="#bbb"/>`);
    if (C.target === 'wall') svg.push(`<rect x="${X(e.wall)}" y="${top}" width="${0.3 * PX}" height="${base - top}" fill="#9aa3b2"/>`);
    const s = e.sig, who = (x) => (x ? `${x.state}${x.state === 'launch' ? ' (lands lying)' : x.lying && x.state !== 'down' ? ', down' : ''}` : '');
    svg.push(`<text x="6" y="${base - 58}" fill="${e.color}" font-weight="bold">${e.label}</text><text x="6" y="${base - 44}" fill="#666">${who(s.a)}${s.b ? ` / ${who(s.b)}` : ''}</text><text x="6" y="${base - 30}" fill="#666">${['wallwalk', 'climb'].includes(s.a.state) ? `rises ${s.riseRate} m/s` : s.a.state === 'treadmill' ? `feet slide ${s.slide} m/s` : `leaves ${s.a.vOut} m/s${s.b ? ` / ${s.b.vOut}` : ''}`}</text><text x="6" y="${base - 16}" fill="#666">freeze ${s.hitstop} f</text>`);
    svg.push(`<g clip-path="url(#row${i})">`);
    const k0 = Math.max(0, e.contact - 15);
    for (let k = k0; k < e.frames.length; k += 5) {
      const fr = e.frames[k], u = (k - k0) / (e.frames.length - k0), op = (0.2 + 0.8 * u).toFixed(2);
      for (const [cmBody, col] of [[fr.a, e.color], [fr.b, '#555']]) if (cmBody) { const body = cmBody.map((v) => v / 100); for (let j = 0; j < body.length; j += 6) {
        if ([body[j + 1], body[j + 4]].some((v) => v < e.wall - BACK || v > e.wall + AHEAD)) continue;
        svg.push(`<line x1="${X(body[j + 1])}" y1="${Y(body[j + 2])}" x2="${X(body[j + 4])}" y2="${Y(body[j + 5])}" stroke="${col}" stroke-opacity="${op}" stroke-width="1.4" stroke-linecap="round"/>`);
      } }
    }
    svg.push('</g>');
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
canvas{width:100%;aspect-ratio:4/3;display:block}
.view{font-size:11px;color:var(--mut);margin:4px 0 0}
</style></head><body>
<h1>Collision flavors</h1><div class="mut">The same approach in each pane, one clock, each drawn from the side and from a ¾ overhead camera fixed on the point of contact (rising with a body that goes up the wall). The first four cases compare the flavors; the next three compare the wall's property. Machine gate only: nobody has looked yet.</div>
<div class="bar"><label>case <select id="case"></select></label><label><input type="checkbox" id="slow"> ¼ speed</label><button id="restart">restart</button><span class="mut" id="clock"></span></div>
<div class="grid" id="grid"></div>
<script>
const D=${JSON.stringify(data)};
for(const C of D.cases)for(const e of C.panes)for(const f of e.frames){f.a=f.a.map(v=>v/100);if(f.b)f.b=f.b.map(v=>v/100);}
${VIEW_JS}
const sel=document.getElementById('case'),grid=document.getElementById('grid');
D.cases.forEach((c,i)=>sel.add(new Option(c.label,i)));
const panes=[0,1,2,3].map(i=>{const d=document.createElement('div');d.className='pane';d.innerHTML='<h2></h2><p></p>'+VIEWS.map(v=>'<div class="view">'+VIEW_NAME[v]+'</div><canvas data-view="'+v+'" width="640" height="480"></canvas>').join('');grid.appendChild(d);return {i,h:d.querySelector('h2'),p:d.querySelector('p'),cvs:[...d.querySelectorAll('canvas')]};});
const say=(x)=>x?x.state+(x.state==='launch'?' (lands lying)':x.lying&&x.state!=='down'?', down':''):'';
const what=(s)=>['wallwalk','climb'].includes(s.a.state)?'rises '+s.riseRate+' m/s':s.a.state==='treadmill'?'walks in place, feet sliding '+s.slide+' m/s':'leaves '+s.a.vOut+' m/s';
function label(){const C=D.cases[sel.value];for(const p of panes){const e=C.panes[p.i];p.h.textContent=e.label;p.h.style.color=e.color;const s=e.sig;p.p.textContent=say(s.a)+' · '+what(s)+(s.b?' — the other: '+say(s.b)+' · leaves '+s.b.vOut+' m/s':'')+' · freeze '+s.hitstop+' f';}}
let clockT=0,last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;clockT+=dt*(document.getElementById('slow').checked?0.25:1);
 const C=D.cases[sel.value];const longest=Math.max(...C.panes.map(e=>e.frames.length/D.fps))+0.5;if(clockT>longest)clockT=0;
 document.getElementById('clock').textContent=clockT.toFixed(2)+' s';
 const cs=getComputedStyle(document.documentElement),fg=getComputedStyle(document.body).color,wallC=cs.getPropertyValue('--wall');
 for(const p of panes)for(const cv of p.cvs){const view=cv.dataset.view,e=C.panes[p.i],ctx=cv.getContext('2d'),W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
  const k=Math.max(0,Math.min(e.frames.length-1,Math.floor(clockT*D.fps))),fr=e.frames[k];
  // the camera on the contact, 8 m across; it rises with a body more than a metre up the wall
  const lift=Math.max(0,fr.z-1.4),sc=W/(view==='side'?8:7),c=proj(view,0,e.wall,lift),ox=W*0.55,oy=H*(view==='side'?0.85:0.7),S=(q)=>[ox+(q[0]-c[0])*sc,oy-(q[1]-c[1])*sc];
  if(view==='side'){const g=S([0,0]);ctx.strokeStyle=fg;ctx.globalAlpha=.3;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,g[1]);ctx.lineTo(W,g[1]);ctx.stroke();
   for(let m=Math.floor(e.wall-6);m<e.wall+6;m++){const a=S([m,0]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(a[0],a[1]+6);ctx.stroke();}ctx.globalAlpha=1;}
  else drawGrid(ctx,view,S,e.wall-7,e.wall+(C.target==='wall'?0:8),-2,2,fg);
  const hw=['wallwalk','climb'].includes(e.sig.a.state)?14:3;
  if(C.target==='wall'){if(view==='side'){const a=S([e.wall,0]),b=S([e.wall+0.3,hw]);ctx.fillStyle=wallC;ctx.fillRect(a[0],b[1],b[0]-a[0],a[1]-b[1]);}
   else{ctx.globalAlpha=.55;drawQuad(ctx,view,S,[[-1.5,e.wall,0],[1.5,e.wall,0],[1.5,e.wall,hw],[-1.5,e.wall,hw]],wallC);ctx.globalAlpha=1;}}
  if(fr.b)drawSticks(ctx,view,S,fr.b,'#888',4);
  drawSticks(ctx,view,S,fr.a,e.color,4);
  if(fr.h){ctx.fillStyle='#f0a020';ctx.font='bold 18px system-ui';ctx.fillText('HOLD',10,24);}
 }}
sel.onchange=()=>{clockT=0;label();};document.getElementById('restart').onclick=()=>{clockT=0;};
label();requestAnimationFrame(frame);
// inside the review viewer: say how tall the content is (the body's, not the document's: inside a frame that is the frame's own height, and would grow it without end), when it changes
let told=0;const tell=()=>{try{const h=Math.ceil(document.body.scrollHeight);if(parent!==window&&Math.abs(h-told)>2){told=h;parent.postMessage({spikeHeight:h},'*');}}catch(e){}};addEventListener('load',tell);addEventListener('resize',tell);setTimeout(tell,300);
</script></body></html>`;
writeFileSync(join(out, 'collision.html'), html);
console.log(`wrote ${join(out, 'collision.html')} and ${data.cases.map((c) => `collision-${c.id}.svg`).join(', ')}`);
