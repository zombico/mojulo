import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { bakeElasticaTable } from './table.mjs';
import { buildWind } from './kernel.mjs';
import { buildScene, PHI } from './scene.mjs';

const table = bakeElasticaTable();
const scene = buildScene();
const round = (_, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e5) / 1e5 : v);
const output = resolve(process.argv[2] || 'scripts/spikes/wind/preview.html');

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wind and flaccidity</title>
<style>
:root{--bg:#0d1419;--panel:#141e25;--line:#2b3a45;--text:#dfe8ee;--muted:#93a6b3;--accent:#8fd3b6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:20px 16px}h1{font-size:24px;margin:0 0 4px}p{color:var(--muted);margin:6px 0;max-width:820px}
.wrap{position:relative}canvas{display:block;width:100%;aspect-ratio:16/8.5;background:#1a2833;border:1px solid var(--line);border-radius:10px;touch-action:none;cursor:grab}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px 18px;margin:14px 0;padding:14px;background:var(--panel);border:1px solid var(--line);border-radius:10px}
.grid h2{grid-column:1/-1;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:4px 0 -4px}
label{display:grid;grid-template-columns:96px 1fr 44px;align-items:center;gap:8px;font-size:13px}label output{font-variant-numeric:tabular-nums;color:var(--accent);text-align:right}
input[type=range]{width:100%;accent-color:var(--accent)}button{background:#22323d;color:var(--text);border:1px solid #3d5361;border-radius:7px;padding:7px 12px;font:inherit;cursor:pointer}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}.bar label{grid-template-columns:40px minmax(160px,1fr) 52px;flex:1}
#stats{font:12px ui-monospace,monospace;color:var(--muted)}.chk{display:flex;gap:6px;align-items:center;font-size:13px}
</style>
<main>
<h1>Wind and flaccidity</h1>
<p>A single wind field, with gusts carried downwind, a log profile near the ground and a slow veer, acts on everything here. Each element has a <b>flaccidity</b> φ ∈ [0, 1]: the share of the air's push it takes. φ = 0 is how everything worked before this spike; it holds exactly still. Grass, branches, leaves, the ribbon and loose debris are what make it work.</p>
<div class="bar"><button id="play">Pause</button><button id="reset">Reset time</button>
<label>Time <input id="seek" type="range" min="0" max="60" step="0.01" value="0"><output id="tout">0.0 s</output></label>
<span class="chk"><input id="heat" type="checkbox" checked><span>Show gusts on the ground</span></span></div>
<div class="wrap"><canvas id="view"></canvas></div>
<div class="grid">
<h2>Wind</h2>
<label>Speed (2 m) <input id="speed" type="range" min="0" max="14" step="0.1" value="6"><output></output></label>
<label>Direction ° <input id="dir" type="range" min="0" max="360" step="1" value="20"><output></output></label>
<label>Gustiness <input id="gust" type="range" min="0" max="1" step="0.01" value="0.6"><output></output></label>
<label>Gust size m <input id="scale" type="range" min="2" max="16" step="0.5" value="6"><output></output></label>
<h2>Flaccidity φ by category</h2>
${Object.entries(PHI).map(([c, v]) => `<label>${c} <input data-phi="${c}" type="range" min="0" max="1" step="0.01" value="${v}"><output></output></label>`).join('')}
</div>
<p id="stats"></p>
<p>Drag to orbit; scroll to zoom. Plants are stateless in time, so any moment can be sampled directly. Debris is stepped at 60 Hz from checkpoints; changing a setting carries on from the current state, and seeking back replays from t = 0 with the current settings. Rigid starts at 0: raise it and the fence posts take the wind too, but their stiffness means they barely move.</p>
</main>
<script>
const K=(${buildWind.toString()})(${JSON.stringify(table)});
const SCENE=${JSON.stringify(scene, round)};
const $=id=>document.getElementById(id), cv=$('view'), ctx=cv.getContext('2d');
const phi=${JSON.stringify(PHI)};
let wind, P, timeline, pstate, time=0, playing=true, last=null, yaw=-2.3, pitch=0.34, dist=13, drag=null, frameMs=0;
const D=SCENE.domain;
function readWind(){wind=K.makeWind({speed:+$('speed').value,dir:(+$('dir').value)*Math.PI/180,gust:+$('gust').value,scale:+$('scale').value,seed:3});}
function rebuildPlants(){P=K.prepareScene({stations:SCENE.stations,elements:SCENE.elements.map(e=>({...e,phi:phi[e.cat]}))});}
function particlesAt0(){return K.makeParticles(SCENE.particles.map(p=>({...p,phi:phi.debris})),D);}
function rebuildTimeline(){timeline=K.makeTimeline(particlesAt0(),wind);pstate=null;}
function advanceParticles(t){const target=Math.round(t/(1/60));
  if(!pstate||target<pstate.tick){pstate=timeline.at(t);return;}
  let n=0;while(pstate.tick<target&&n++<240)K.stepParticles(pstate,wind,1/60);
  if(pstate.tick<target)pstate.tick=target;}
function onWind(){readWind();timeline=K.makeTimeline(particlesAt0(),wind);sync();}
function sync(){document.querySelectorAll('.grid input').forEach(i=>i.nextElementSibling.value=(+i.value).toFixed(i.step<1?2:0));}
document.querySelectorAll('#speed,#dir,#gust,#scale').forEach(i=>i.addEventListener('input',onWind));
document.querySelectorAll('[data-phi]').forEach(i=>i.addEventListener('input',()=>{phi[i.dataset.phi]=+i.value;rebuildPlants();
  if(i.dataset.phi==='debris'&&pstate){for(let j=0;j<pstate.n;j++)pstate.phi[j]=phi.debris;timeline=K.makeTimeline(particlesAt0(),wind);}sync();}));
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};
$('reset').onclick=()=>{time=0;pstate=null;};
$('seek').oninput=()=>{time=+$('seek').value;};
cv.onpointerdown=e=>{drag=[e.clientX,e.clientY,yaw,pitch];cv.setPointerCapture(e.pointerId);};
cv.onpointermove=e=>{if(!drag)return;yaw=drag[2]-(e.clientX-drag[0])*0.006;pitch=Math.min(1.45,Math.max(0.08,drag[3]+(e.clientY-drag[1])*0.004));};
cv.onpointerup=()=>drag=null;
cv.onwheel=e=>{e.preventDefault();dist=Math.min(40,Math.max(5,dist*Math.exp(e.deltaY*0.001)));};

// camera
let cam,R,U,F,f,cx,cy,W,H;
function setCamera(){const r=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);W=Math.round(r.width*dpr);H=Math.round(r.height*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const tg=[0,0,0.4];cam=[tg[0]+dist*Math.cos(pitch)*Math.cos(yaw),tg[1]+dist*Math.cos(pitch)*Math.sin(yaw),tg[2]+dist*Math.sin(pitch)];
  F=norm(sub(tg,cam));R=norm(cross(F,[0,0,1]));U=cross(R,F);f=W*0.9;cx=W/2;cy=H*0.5;}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n)};
function proj(p){const d=sub(p,cam),z=dot(d,F);if(z<0.1)return null;return [cx+f*dot(d,R)/z,cy-f*dot(d,U)/z,z];}
const rgb=(c,k=1)=>\`rgb(\${c[0]*k|0},\${c[1]*k|0},\${c[2]*k|0})\`;
const mixc=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

function drawGround(t){const nx=48,ny=32,cw=D.W/nx,ch=D.H/ny,quads=[],heat=$('heat').checked;
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const x=D.x0+i*cw,y=D.y0+j*ch,c=[[x,y,0],[x+cw,y,0],[x+cw,y+ch,0],[x,y+ch,0]].map(proj);if(c.some(q=>!q))continue;
    let col=(i+j)%2?[58,74,48]:[62,79,51];
    if(heat&&wind.speed>0){const u=K.windAt(wind,x+cw/2,y+ch/2,2,t,false),g=Math.hypot(u[0],u[1])/wind.speed;col=g>1?mixc(col,[176,190,118],Math.min(1,(g-1)*1.6)):mixc(col,[28,40,36],Math.min(1,(1-g)*1.8));}
    quads.push([c,(c[0][2]+c[2][2])/2,col]);}
  quads.sort((a,b)=>b[1]-a[1]);for(const [c,,col] of quads){ctx.fillStyle=rgb(col);ctx.beginPath();ctx.moveTo(c[0][0],c[0][1]);for(let k=1;k<4;k++)ctx.lineTo(c[k][0],c[k][1]);ctx.closePath();ctx.fill();ctx.strokeStyle=rgb(col);ctx.lineWidth=1;ctx.stroke();}}

function strokePts(pp,from,to,col,w){ctx.strokeStyle=col;ctx.lineWidth=Math.max(0.6,w);ctx.beginPath();let s=false;for(let k=from;k<=to;k++){const q=pp[k];if(!q){s=false;continue;}s?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);s=true;}ctx.stroke();}
const LIGHT=norm([0.4,-0.3,0.85]);
function drawFrame(){const t0=performance.now();setCamera();const t=time;
  const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#5d7f9c');sky.addColorStop(1,'#b9c9cf');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  drawGround(t);
  const {pts,roll}=K.sampleScene(P,wind,t),items=[];
  SCENE.elements.forEach((e,i)=>{const b=proj(pts[i][0]);if(b)items.push([b[2]-(e.part==='leaf'?0.05:0),i]);});
  advanceParticles(t);
  for(let i=0;i<pstate.n;i++){const b=proj([pstate.x[i],pstate.y[i],pstate.z[i]]);if(b)items.push([b[2],-1-i,b]);}
  items.sort((a,b)=>b[0]-a[0]);
  for(const it of items){const i=it[1];
    if(i<0){drawParticle(-1-i,it[2],t);continue;}
    const e=SCENE.elements[i],P3=pts[i],pp=P3.map(proj),z=pp[0][2],sc=f/z;
    if(e.part==='blade'){const c=e.colors,w=Math.max(0.7,e.width*sc*1.4);strokePts(pp,0,4,rgb(c.base),w);strokePts(pp,4,8,rgb(c.tip),w*0.7);}
    else if(e.part==='culm'){strokePts(pp,0,8,rgb(e.colors.tip,0.9),Math.max(0.6,e.width*sc));const hk=Math.max(5,8-Math.round(8*e.headLen/e.L));strokePts(pp,hk,8,rgb(e.colors.head),Math.max(1.2,(e.head==='plume'?2.2:1)*e.width*sc*3));}
    else if(e.part==='trunk'||e.part==='branch'){strokePts(pp,0,8,e.part==='trunk'?'#5a4532':'#6b5440',Math.max(1,e.width*sc));}
    else if(e.part==='post'){strokePts(pp,0,8,'#8a8478',Math.max(2,e.width*sc));}
    else if(e.part==='ribbon'){strokePts(pp,0,8,'#d2453c',Math.max(1.5,e.width*sc));}
    else if(e.part==='leaf'){drawLeaf(e,P3,roll[i],sc);}}
  frameMs=frameMs*0.9+(performance.now()-t0)*0.1;}
function drawLeaf(e,P3,r,sc){const tip=P3[8],ax=norm(sub(P3[8],P3[6]));let wv=norm(cross(ax,[0,0,1]));if(!isFinite(wv[0]))wv=[1,0,0];
  const n0=cross(wv,ax),c=Math.cos(r*1.6),s=Math.sin(r*1.6),w2=[wv[0]*c+n0[0]*s,wv[1]*c+n0[1]*s,wv[2]*c+n0[2]*s],nrm=cross(w2,ax);
  const L=e.leafLen,mid=[0,1,2].map(k=>tip[k]+ax[k]*L*0.5),q=[tip,[0,1,2].map(k=>mid[k]+w2[k]*L*0.28),[0,1,2].map(k=>tip[k]+ax[k]*L),[0,1,2].map(k=>mid[k]-w2[k]*L*0.28)].map(proj);
  if(q.some(v=>!v))return;const lit=dot(nrm,LIGHT),under=nrm[2]<0;
  const col=under?mixc([150,170,140],[205,215,190],Math.abs(lit)):mixc([36,78,36],[92,150,64],Math.abs(lit));
  ctx.fillStyle=rgb(col);ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);for(let k=1;k<4;k++)ctx.lineTo(q[k][0],q[k][1]);ctx.closePath();ctx.fill();}
function drawParticle(i,b,t){const kind=pstate.kind[i],sc=f/b[2];
  if(kind===0){ctx.fillStyle=pstate.z[i]>0?'rgba(214,196,150,0.85)':'rgba(150,135,100,0.6)';const s=Math.max(1,0.025*sc);ctx.fillRect(b[0]-s/2,b[1]-s/2,s,s);}
  else if(kind===1){const a=(pstate.z[i]>0?t*7:0)+i*1.7,s=Math.max(1.5,0.06*sc),c=Math.cos(a)*s,d=Math.sin(a)*s*0.5;ctx.fillStyle=['#c58a2e','#a8572a','#d6b04a'][i%3];
    ctx.beginPath();ctx.moveTo(b[0]-c,b[1]-d);ctx.lineTo(b[0]+d,b[1]-c*0.4);ctx.lineTo(b[0]+c,b[1]+d);ctx.lineTo(b[0]-d,b[1]+c*0.4);ctx.closePath();ctx.fill();}
  else{const a=i*2.3+(pstate.z[i]>0?t*3:0),s=0.18*sc;ctx.strokeStyle='#5b4330';ctx.lineWidth=Math.max(1,0.012*sc);ctx.beginPath();ctx.moveTo(b[0]-Math.cos(a)*s,b[1]-Math.sin(a)*s*0.4);ctx.lineTo(b[0]+Math.cos(a)*s,b[1]+Math.sin(a)*s*0.4);ctx.stroke();}}
function drawCompass(){const x=W-70,y=70,a=wind.dir,d=[Math.cos(a),Math.sin(a),0],o=proj([0,0,0]),p=proj(d);if(!o||!p)return;
  const v=norm([p[0]-o[0],p[1]-o[1],0]);ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-v[0]*28,y-v[1]*28);ctx.lineTo(x+v[0]*28,y+v[1]*28);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+v[0]*36,y+v[1]*36);ctx.lineTo(x+v[0]*20-v[1]*10,y+v[1]*20+v[0]*10);ctx.lineTo(x+v[0]*20+v[1]*10,y+v[1]*20-v[0]*10);ctx.fill();
  ctx.font=\`\${Math.round(W/70)}px system-ui\`;ctx.fillText(wind.speed.toFixed(1)+' m/s',x-30,y+56);}
function loop(now){if(last!=null&&playing){time=Math.min(60,time+Math.min(0.1,(now-last)/1000));if(time>=60)time=0;}last=now;
  drawFrame();drawCompass();$('seek').value=time;$('tout').value=time.toFixed(1)+' s';
  let air=0;for(let i=0;i<pstate.n;i++)if(pstate.z[i]>0)air++;
  $('stats').textContent=\`\${SCENE.elements.length} anchored elements on \${SCENE.stations.length} stations · \${pstate.n} debris (\${air} airborne) · \${frameMs.toFixed(1)} ms/frame\`;
  requestAnimationFrame(loop);}
readWind();rebuildPlants();rebuildTimeline();sync();requestAnimationFrame(loop);
</script></html>`;

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`wrote ${output} (${(html.length / 1024).toFixed(0)} KB)`);
