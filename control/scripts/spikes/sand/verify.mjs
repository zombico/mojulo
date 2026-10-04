import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildSand } from './kernel.mjs';
import { seedHopper } from './scene.mjs';
const settle=(s,max=3000)=>{let total=0;for(let i=0;i<max;i++){const m=s.step();total+=m.checked;if(!m.active)return {ticks:i+1,total}}throw Error('did not settle')};
const a=buildSand({width:24,height:24,seed:4});
for(let x=3;x<21;x++)for(let y=1;y<9;y++)a.set(x,y,1);
const original=a.stats().grains;settle(a);
assert.equal(a.stats().grains,original);
assert.equal(a.snapshot().cells.filter(x=>x===1).length,original);
const frozen=a.cells.slice();assert.equal(a.step().checked,0);assert.deepEqual(a.cells,frozen);
// A lone grain sleeps on a support; erasing that support must wake it locally.
const support=buildSand({width:12,height:12});
for(let x=0;x<12;x++)support.set(x,7,2);
support.set(5,6,1);settle(support);assert.equal(support.cells[6*12+5],1);
support.set(5,7,0);assert(support.stats().active>0);settle(support);assert.equal(support.cells[6*12+5],0);assert.equal(support.cells[11*12+5],1);
assert.equal(support.stats().grains,1);
assert.equal(support.set(5,11,2),false);assert.equal(support.stats().grains,1);
support.set(5,11,0);assert.equal(support.stats().grains,0);
// Lateral slides produce a pile broader than the emitting column.
const pile=buildSand({width:30,height:30});
for(let i=0;i<80;i++){pile.set(15,1,1);for(let j=0;j<35;j++)pile.step()}
settle(pile);assert(pile.snapshot().cells.some((v,i)=>v===1&&Math.abs(i%30-15)>5));
// Same seed and edits, same result; hopper stays supported until its gate is removed.
function run(){const s=buildSand();const gate=seedHopper(s);const count=s.stats().grains;settle(s);assert.equal(s.stats().grains,count);assert(!s.snapshot().cells.some((v,i)=>v===1&&Math.floor(i/s.width)>74));for(const [x,y]of gate)s.set(x,y,0);settle(s);assert.equal(s.stats().grains,count);assert(s.snapshot().cells.some((v,i)=>v===1&&Math.floor(i/s.width)>80));return s.snapshot()}
assert.deepEqual(run(),run());
// A diagonal must not cut through the corner of a terrain wall.
const corner=buildSand({width:8,height:8});
corner.set(3,3,1);corner.set(3,4,2);corner.set(2,3,2);corner.set(4,3,2);
assert.equal(corner.step().moved,0);
// Free fall is gravity, not one cell per tick: y(t) tracks ½gt² (semi-implicit Euler adds ≤ gt/2), never
// exceeds terminal speed, and a fast grain still stops on the first support instead of skipping it.
const g=0.25,terminal=6,tall=buildSand({width:8,height:400,gravity:g,terminal});tall.set(3,0,1);
const rowOf=s=>{const i=s.cells.indexOf(1);return Math.floor(i/s.width)};
let prevRow=0,maxStep=0,reached=0;
for(let t=1;t<=60;t++){tall.step();const y=rowOf(tall);maxStep=Math.max(maxStep,y-prevRow);prevRow=y;
  if(t*g<terminal)assert(Math.abs(y-0.5*g*t*t)<=g*t/2+1,`free fall at t=${t}: ${y}`);else reached++}
assert(maxStep<=terminal&&reached>0);assert.equal(maxStep,terminal);
settle(tall);assert.equal(tall.cells[399*8+3],1);assert.equal(tall.stats().grains,1);
// Coulomb friction, not the grid, sets the heap: a poured heap's flank sits near atan(μ) (a little under it, since
// arriving grains carry impact energy), at most atan(μs), and steepens monotonically with friction.
const heights=s=>Array.from({length:s.width},(_,x)=>{let c=0;for(let y=s.height-2;y>=0&&s.cells[y*s.width+x]===1;y--)c++;return c});
function measure(s){const h=heights(s),top=Math.max(...h),peak=h.indexOf(top),cross=(f,d)=>{let x=peak;while(h[x]>f*top)x+=d;return x};
  const slope=d=>0.6*top/Math.abs(cross(0.2,d)-cross(0.8,d));return Math.atan((slope(-1)+slope(1))/2)*180/Math.PI}
function heap(friction,staticFriction){const W=240,H=120,s=buildSand({width:W,height:H,friction,staticFriction});for(let x=0;x<W;x++)s.set(x,H-1,2);
  let poured=0;while(poured<1500){if(s.set(W/2,1,1))poured++;s.step()}settle(s,100000);assert.equal(s.stats().grains,1500);
  return {s,degrees:measure(s)}}
const deg=v=>Math.atan(v)*180/Math.PI,angles=[];
for(const [mu,mus] of [[0.4,0.5],[0.58,0.67],[0.75,0.9]]){const {degrees}=heap(mu,mus);angles.push(+degrees.toFixed(1));
  assert(degrees>deg(mu)-4&&degrees<deg(mus)+1,`μ=${mu}: ${degrees.toFixed(1)}°`);assert(degrees<44)}
assert(angles[0]<angles[1]&&angles[1]<angles[2]);
// Hysteresis: lowering friction under a settled heap re-tests every slope; it slumps to the new band with mass
// conserved. Sleep is sound: waking every grain on the slumped heap moves nothing. A flank dig moves some grains,
// never the whole pile.
const steepHeap=heap(0.75,0.9),steep=steepHeap.s;steep.tune({friction:0.4,staticFriction:0.5});settle(steep,100000);
const slumped=measure(steep);angles.push(+slumped.toFixed(1));
assert.equal(steep.stats().grains,1500);assert(slumped<steepHeap.degrees-4&&slumped>deg(0.4)-4&&slumped<deg(0.5)+1,`slump ${slumped}`);
steep.tune({friction:0.4,staticFriction:0.5});assert.equal(steep.step().moved,0);settle(steep);
const flank=heights(steep).findIndex(v=>v>=5);assert(steep.set(flank,118,0));
let shifted=0;for(let t=0;t<2000;t++){const m=steep.step();shifted+=m.moved;if(!m.active)break}
assert(shifted>0&&shifted<steep.stats().grains/4&&steep.stats().active===0);
assert.throws(()=>steep.tune({friction:0.8,staticFriction:0.5}));
assert.throws(()=>buildSand({width:Infinity}));
// Cost is measured on this host, not claimed as a device-independent frame rate.
const s=buildSand({width:240,height:160});const gate=seedHopper(s);const count=s.stats().grains;
let checked=0,maxActive=0,moved=0;const start=performance.now();
for(let i=0;i<1600;i++){if(i===200)for(const [x,y]of gate)s.set(x,y,0);const m=s.step();checked+=m.checked;moved+=m.moved;maxActive=Math.max(maxActive,m.active)}
const elapsed=performance.now()-start;
assert.equal(s.stats().grains,count);assert.equal(s.stats().active,0);
const idleStart=performance.now();for(let i=0;i<10000;i++)assert.equal(s.step().checked,0);const idleMs=performance.now()-idleStart;
console.log(JSON.stringify({passed:['mass conservation','settled zero checks','local support wake','terrain preserves grains','explicit erase accounting','pile spreading','hopper release','deterministic replay','dimension validation','terrain corner blocking','free fall tracks ½gt² to terminal speed','heap angle set by friction','friction hysteresis slump','sleep soundness under a full wake','local flank avalanche'],heapDegrees:angles,benchmark:{width:240,height:160,grains:count,ticks:1600,totalMs:+elapsed.toFixed(2),meanMsPerTick:+(elapsed/1600).toFixed(4),checked,moved,maxActive,idle10000TicksMs:+idleMs.toFixed(2)},scope:'Node simulation only; excludes canvas/browser rendering'},null,2));
