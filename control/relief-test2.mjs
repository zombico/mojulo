import { register } from 'node:module';
register('/Users/fombico/Documents/mojulo/control/scripts/mcp-stdio-loader.mjs', import.meta.url);
const { reliefToFaces } = await import('@/lib/graph/polygonizer/relief-faces');
const newell = (c) => { let n = [0,0,0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i+1)%c.length]; n[0] += (a[1]-b[1])*(a[2]+b[2]); n[1] += (a[2]-b[2])*(a[0]+b[0]); n[2] += (a[0]-b[0])*(a[1]+b[1]); } return n; };
for (const material of ['satin', 'matte', 'cel', 'plastic', 'neon']) {
  for (const [name, normal] of [['into +x', [1,0,0]], ['out -x', [-1,0,0]], ['into -y', [0,-1,0]], ['out +y', [0,1,0]]]) {
    const faces = reliefToFaces({ shape: { path: 'M0 0 L10 5 L0 10 Z' }, size: 4, anchor: [0,0,0], normal, up: [0,0,1], style: { depth: 0.08, bevel: 0.02 }, tint: '#c9ccd0' }, { material, tint: '#c9ccd0' });
    const caps = faces.filter((f) => f.corners.length === 3).map((f) => { const n = newell(f.corners); const ax = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))); return `${'xyz'[ax]}${n[ax] > 0 ? '+' : '-'}:${f.fill}`; });
    console.log(material.padEnd(8), name.padEnd(8), [...new Set(caps)].join('  '));
  }
}
process.exit(0);
