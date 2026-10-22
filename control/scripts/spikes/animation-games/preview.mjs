// animation-games preview: the same takes in the four flavors, side by side on one clock.
//   node scripts/spikes/animation-games/preview.mjs /absolute/out/dir [cast=male]
// writes animation-games.html (a player: the four panes in real time, a slow-motion switch, the take, the body's speed
// for pinball) and filmstrip-<take>.svg (every second frame at 60 fps, a row per flavor: holds boxed, smears drawn; a jump lifted on earth's gravity over
// its flavor's air time, since the clip itself is in place).
// The player draws each pane twice, a side view and a ¾ overhead one (views.mjs); the filmstrips are side views. Sticks
// from the rig's bones; the depiction is the spike's, not a renderer's.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const A = await import('./flavor.mjs');
const { VIEW_JS } = await import('./views.mjs');

const out = process.argv[2]; if (!out) { console.error('usage: preview.mjs /absolute/out/dir [cast]'); process.exit(2); }
const cast = process.argv[3] ?? 'male';
mkdirSync(out, { recursive: true });
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const BONES = R.bones.filter((b) => !/Fold|Face|pelvis$|lumbar/.test(b.id)).map((b) => [b.head, b.tail]);
const r3 = (x) => Math.round(x * 1000) / 1000;
const side = (n, flip = 1, dx = 0, dz = 0) => Object.fromEntries(Object.entries(n).map(([k, p]) => [k, [r3(dx + flip * p[1]), r3(p[2] + dz)]]));
// the same body in 3D (a victim turned about the vertical: x and y flipped), centimetres, for the player
const r2 = (x) => Math.round(x * 100) / 100;
const solid = (n, flip = 1, dx = 0, dz = 0) => BONES.filter(([a, b]) => n[a] && n[b]).flatMap(([a, b]) => [n[a], n[b]].flatMap((p) => [r2(flip * p[0]), r2(dx + flip * p[1]), r2(p[2] + dz)]));

// a body's frames as side-view sticks; a victim faces back and stands where the blow lands, thrown after its freeze
// a jump's clip is in place (the engine flies the body): the preview lifts it on earth's gravity over the flavor's own air
function strip(rendered, { flip = 1, at = 0, knock = null } = {}) {
  const { nodes, smears } = A.nodesOf(R, rendered);
  const off = rendered.beats.find((b) => b.id === 'takeoff'), on = rendered.beats.find((b) => b.id === 'land');
  const lift = (k) => { if (!off || k <= off.frame || k >= on.frame) return 0; const t = (k - off.frame) / rendered.fps, Ta = (on.frame - off.frame) / rendered.fps; return (9.81 / 2) * t * (Ta - t); };
  const peak = rendered.beats.find((b) => b.id === 'peak');
  const free = peak ? peak.frame + rendered.hitstop : 0;
  return {
    frames: nodes.map((n, k) => {
      let dx = at, dz = lift(k);
      if (knock && k > free) { const t = (k - free) / rendered.fps, T = Math.max(0.25, knock.airborne + 0.3); const u = Math.min(1, t / T); dx += knock.distance * (1 - (1 - u) ** 2) * -flip; if (t < knock.airborne) dz = knock.height * 4 * (t / knock.airborne) * (1 - t / knock.airborne); }
      return { held: rendered.frames[k].held, s3: solid(n, flip, dx, dz), sticks: BONES.filter(([a, b]) => n[a] && n[b]).map(([a, b]) => [...side({ a: n[a] }, flip, dx, dz).a, ...side({ b: n[b] }, flip, dx, dz).b]) };
    }),
    smears: smears.map((s) => ({ frame: s.frame, line: [at + flip * s.from[1], s.from[2], at + flip * s.to[1], s.to[2]].map(r3), line3: [flip * s.from[0], at + flip * s.from[1], s.from[2], flip * s.to[0], at + flip * s.to[1], s.to[2]].map(r2) })),
  };
}

const TAKES = [
  { id: 'jab', label: 'jab → hit high', strike: A.strikeTake('jab', R), react: 'hitHigh' },
  { id: 'cross', label: 'cross → hit body', strike: A.strikeTake('cross', R), react: 'hitBody' },
  { id: 'jump', label: 'standing jump', take: A.jumpTake('jump', R) },
  { id: 'jumpForward', label: 'forward jump', take: A.jumpTake('jumpForward', R) },
];
const SPEEDS = [4, 10, 20];
const data = { fps: 60, flavors: A.FLAVOR_NAMES.map((f) => ({ id: f, says: A.FLAVORS[f].says })), takes: [] };
for (const T of TAKES) {
  const entry = { id: T.id, label: T.label, by: {} };
  for (const f of A.FLAVOR_NAMES) for (const speed of f === 'pinball' ? SPEEDS : [null]) {
    const key = speed ? `${f}@${speed}` : f;
    if (T.strike) {
      const X = A.exchange(T.strike, T.react, f, R, { speed });
      const at = T.strike.contactAt[1] + 0.12;
      entry.by[key] = { seconds: Math.max(X.attacker.seconds, X.offset / 60 + X.victim.seconds), blow: X.blow, offset: X.offset,
        a: { ...strip(X.attacker), wide: true }, v: { ...strip(X.victim, { flip: -1, at, knock: X.blow.knockback }), wide: true }, sig: A.signature(R, X.attacker, { take: T.strike }) };
    } else {
      const r = A.render(T.take, f, R, { speed });
      entry.by[key] = { seconds: r.seconds, a: strip(r), sig: A.signature(R, r, { take: T.take }), beats: r.beats };
    }
  }
  data.takes.push(entry);
}

// ── the filmstrips ──
const C = { realistic: '#5b8def', action: '#e5533d', platformer: '#2fa66a', pinball: '#b05be0' };
for (const T of data.takes) {
  const rows = A.FLAVOR_NAMES.map((f) => [f, T.by[f === 'pinball' ? `pinball@${A.FLAVORS.pinball.rate.speed}` : f]]);
  const n = Math.max(...rows.map(([, e]) => Math.max(e.a.frames.length, e.v ? e.offset + e.v.frames.length : 0)));
  const cols = Math.ceil(n / 2), W = 74, H = 120, PAD = 90, sc = 46;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${PAD + cols * W}" height="${rows.length * H + 30}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`];
  svg.push(`<text x="6" y="16" font-size="12">${T.label} — every 2nd frame at 60 fps (1 column = 1/30 s); boxed = held (hitstop/wind hold), thin lines = smears</text>`);
  rows.forEach(([f, e], ri) => {
    const y0 = 30 + ri * H;
    svg.push(`<text x="6" y="${y0 + 50}" fill="${C[f]}" font-weight="bold">${f}</text><text x="6" y="${y0 + 64}" fill="#666">${e.a.frames.length - 1} f</text>`);
    if (e.blow) svg.push(`<text x="6" y="${y0 + 78}" fill="#666">thrown ${e.blow.knockback.distance.toFixed(2)} m</text><text x="6" y="${y0 + 92}" fill="#666">×${e.blow.powerscale.toFixed(1)} force</text>`);
    for (let c = 0; c < cols; c++) {
      const k = c * 2, x0 = PAD + c * W, base = y0 + H - 14;
      const ox = x0 + 18;
      const P = (u, v) => `${r3(ox + u * sc)},${r3(base - v * sc)}`;
      const bodies = [[e.a, k], ...(e.v ? [[e.v, k - e.offset]] : [])];
      const clip = `c${ri}_${c}`; svg.push(`<clipPath id="${clip}"><rect x="${x0}" y="${y0}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#${clip})">`);
      let any = false;
      for (const [b, kk] of bodies) {
        const fr = b.frames[Math.max(0, Math.min(b.frames.length - 1, kk))]; if (kk >= b.frames.length && b === e.a && !e.v) continue; any = true;
        if (fr.held && kk >= 0 && kk < b.frames.length) svg.push(`<rect x="${x0 + 1}" y="${y0 + 2}" width="${W - 2}" height="${H - 6}" fill="none" stroke="#f0a020" stroke-width="2"/>`);
        for (const s of fr.sticks) svg.push(`<line x1="${P(s[0], s[1]).split(',')[0]}" y1="${P(s[0], s[1]).split(',')[1]}" x2="${P(s[2], s[3]).split(',')[0]}" y2="${P(s[2], s[3]).split(',')[1]}" stroke="${b === e.a ? C[f] : '#555'}" stroke-width="2" stroke-linecap="round"/>`);
        for (const sm of b.smears.filter((s) => s.frame === kk)) { const [a1, b1] = P(sm.line[0], sm.line[1]).split(','), [a2, b2] = P(sm.line[2], sm.line[3]).split(','); svg.push(`<line x1="${a1}" y1="${b1}" x2="${a2}" y2="${b2}" stroke="${C[f]}" stroke-opacity="0.45" stroke-width="7" stroke-linecap="round"/>`); }
      }
      svg.push('</g>');
      if (!any) svg.push(`<text x="${x0 + 20}" y="${y0 + 60}" fill="#ccc">—</text>`);
      svg.push(`<line x1="${x0}" y1="${base}" x2="${x0 + W}" y2="${base}" stroke="#ddd"/>`);
    }
  });
  svg.push('</svg>');
  writeFileSync(join(out, `filmstrip-${T.id}.svg`), svg.join('\n'));
}

// ── the player ──
const page = (b) => (b ? { wide: !!b.wide, frames: b.frames.map((f) => ({ h: !!f.held, s: f.s3 })), smears: b.smears.map((m) => ({ frame: m.frame, l: m.line3 })) } : null);
const pageData = { fps: data.fps, flavors: data.flavors, takes: data.takes.map((T) => ({ id: T.id, label: T.label, by: Object.fromEntries(Object.entries(T.by).map(([k, e]) => [k, { ...e, a: page(e.a), v: page(e.v) }])) })) };
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Animation flavors</title>
<style>
:root{--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--line:#e2e2dc}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ececea;--mut:#9a9a94;--line:#2c2c2a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
h1{font-size:18px;margin:0 0 4px}.mut{color:var(--mut)}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.pane{border:1px solid var(--line);border-radius:8px;padding:8px}
.pane h2{font-size:14px;margin:0}.pane p{margin:2px 0 6px;font-size:12px;color:var(--mut);min-height:32px}
canvas{width:100%;aspect-ratio:3/2;display:block}
.view{font-size:11px;color:var(--mut);margin:4px 0 0}
table{font-size:11px;border-collapse:collapse;width:100%}td{padding:1px 4px;border-top:1px solid var(--line)}td:last-child{text-align:right}
</style></head><body>
<h1>Animation flavors</h1><div class="mut">The same take in each flavor, one clock. The contact pose is the same pose in all four; what differs is time, the wind-up, holds, squash, smears and the force handed on. Machine gate only: nobody has looked yet.</div>
<div class="bar"><label>take <select id="take"></select></label><label><input type="checkbox" id="slow"> ¼ speed</label><label>pinball speed <select id="spd"><option>4</option><option selected>10</option><option>20</option></select> m/s</label><button id="restart">restart</button><span class="mut" id="clock"></span></div>
<div class="grid" id="grid"></div>
<script>
const D=${JSON.stringify(pageData)};
${VIEW_JS}
const COL={realistic:'#5b8def',action:'#e5533d',platformer:'#2fa66a',pinball:'#b05be0'};
const sel=document.getElementById('take'),grid=document.getElementById('grid');
D.takes.forEach((t,i)=>sel.add(new Option(t.label,i)));
const panes=D.flavors.map(f=>{const d=document.createElement('div');d.className='pane';d.innerHTML='<h2 style="color:'+COL[f.id]+'">'+f.id+'</h2><p>'+f.says+'</p>'+VIEWS.map(v=>'<div class="view">'+VIEW_NAME[v]+'</div><canvas data-view="'+v+'" width="600" height="400"></canvas>').join('')+'<table></table>';grid.appendChild(d);return {f:f.id,cvs:[...d.querySelectorAll('canvas')],tb:d.querySelector('table')};});
let t0=performance.now(),clockT=0,last=performance.now();
const entry=(p)=>{const T=D.takes[sel.value];const k=p.f==='pinball'?'pinball@'+document.getElementById('spd').value:p.f;return T.by[k];};
function table(){for(const p of panes){const e=entry(p),s=e.sig,b=e.blow;const rows=[['length',e.seconds.toFixed(3)+' s'],['frames held',s.held],['wind-up depth',s.windDepth+' m'],['peak end speed',s.peakSpeed+' m/s'],['squash',s.squash],['smears',s.smears]];if(b)rows.push(['victim Δv',b.dv+' m/s'],['powerscale','×'+b.powerscale],['hitstop',b.hitstop+' f'],['thrown',b.knockback.distance+' m']);p.tb.innerHTML=rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');}}
// the camera: centred a little ahead of the body (between the two of a blow), the floor low in the frame
function screen(view,e,W,H){const sc=H/(e.a.wide?4.2:2.6),c=proj(view,0,e.a.wide?0.9:0.35,0),ox=W*0.5,oy=H*(view==='side'?0.9:0.62);return (q)=>[ox+(q[0]-c[0])*sc,oy-(q[1]-c[1])*sc];}
function draw(ctx,view,S,body,k,col){const fr=body.frames[Math.max(0,Math.min(body.frames.length-1,k))];
 for(const m of body.smears.filter(m=>m.frame===k)){ctx.globalAlpha=.35;drawSticks(ctx,view,S,m.l,col,14);ctx.globalAlpha=1;}
 drawSticks(ctx,view,S,fr.s,col,5);
 return fr.h;}
function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;clockT+=dt*(document.getElementById('slow').checked?0.25:1);
 const longest=Math.max(...panes.map(p=>entry(p).seconds))+0.6;if(clockT>longest)clockT=0;
 document.getElementById('clock').textContent=clockT.toFixed(2)+' s';
 const fg=getComputedStyle(document.body).color;
 for(const p of panes)for(const cv of p.cvs){const view=cv.dataset.view,e=entry(p),ctx=cv.getContext('2d'),W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);const S=screen(view,e,W,H);
  if(view==='side'){ctx.strokeStyle=fg;ctx.globalAlpha=.25;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H*0.9);ctx.lineTo(W,H*0.9);ctx.stroke();ctx.globalAlpha=1;}
  else drawGrid(ctx,view,S,-3,e.a.wide?6:4,-2,2,fg);
  const k=Math.floor(clockT*D.fps);let held=draw(ctx,view,S,e.a,k,COL[p.f]);
  if(e.v){held=draw(ctx,view,S,e.v,k-e.offset,'#888')||held;}
  if(held&&k<e.a.frames.length+(e.v?e.offset+e.v.frames.length:0)){ctx.fillStyle='#f0a020';ctx.font='bold 20px system-ui';ctx.fillText('HOLD',12,28);}
  if(clockT>e.seconds){ctx.fillStyle=getComputedStyle(document.body).color;ctx.globalAlpha=.4;ctx.font='14px system-ui';ctx.fillText('done',W-50,24);ctx.globalAlpha=1;}}
 }
sel.onchange=()=>{clockT=0;table();};document.getElementById('spd').onchange=()=>{clockT=0;table();};document.getElementById('restart').onclick=()=>{clockT=0;};
table();requestAnimationFrame(frame);
// inside the review viewer: say how tall the content is (the body's, not the document's: inside a frame that is the frame's own height, and would grow it without end), when it changes
let told=0;const tell=()=>{try{const h=Math.ceil(document.body.scrollHeight);if(parent!==window&&Math.abs(h-told)>2){told=h;parent.postMessage({spikeHeight:h},'*');}}catch(e){}};addEventListener('load',tell);addEventListener('resize',tell);setTimeout(tell,300);
</script></body></html>`;
writeFileSync(join(out, 'animation-games.html'), html);
console.log(`wrote ${join(out, 'animation-games.html')} and ${data.takes.map((t) => `filmstrip-${t.id}.svg`).join(', ')}`);
