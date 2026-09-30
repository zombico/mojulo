// The metro refacade's contract (refacade.js): stock boxes keep their bytes; a metro box draws
// inside its footprint, under its silhouette, deterministically.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { makeLight } from '../polygonizer/vexar.js';
import { LANDMARK_HEIGHTS } from './index.js';
import { hasRefacade } from './refacade.js';

// footprints as landmarkAnchor lays them on the default frame (short side 18 × frac, along x)
const LM = {
  taj: [0.34, 1.0], 'cn-tower': [0.20, 1.0], skytree: [0.20, 1.0], 'rogers-centre': [0.30, 1.35], colosseum: [0.32, 1.2],
  arena: [0.28, 1.12], 'great-pyramid': [0.34, 1.0], 'louvre-pyramid': [0.30, 1.0], 'mexican-pyramid': [0.34, 1.0],
  'petronas-towers': [0.35, 1.45], 'big-ben': [0.22, 1.0], stonehenge: [0.34, 1.25], 'chinatown-gate': [0.18, 1.35],
  'arc-de-triomphe': [0.24, 1.0], parthenon: [0.34, 2.2], 'griffith-observatory': [0.34, 2.3], 'washington-monument': [0.16, 1.0],
  'parliament-hill': [0.26, 2.6], 'mobile-edm-hall': [0.3, 1.05], 'eiffel-tower': [0.30, 1.0], 'tokyo-tower': [0.26, 1.0],
  'empire-state-building': [0.26, 1.3], 'gateway-arch': [0.36, 2.2], 'cloud-gate': [0.32, 1.55], 'statue-of-liberty': [0.24, 1.0],
  'rizal-monument': [0.28, 1.1], 'tian-tan-buddha': [0.30, 1.0],
};
const SUBJECTS = [];
for (const [shape, [frac, aspect]] of Object.entries(LM)) {
  const d = 18 * frac, w = d * aspect;
  SUBJECTS.push({ id: shape, box: { x: 3, y: 5, w, d, z0: 0, z1: Math.min(w, d) * LANDMARK_HEIGHTS[shape], kind: 'anchor', glass: '#aebfd0', shape, class: 'landmark', structure: shape, landmark: shape } });
}
const cl = 4;
const sacred = (id, w, d, z1, extra) => SUBJECTS.push({ id, box: { x: 3, y: 5, w, d, z0: 0, z1, kind: 'building', ...extra } });
sacred('church-basilica', 4, 7, Math.max(4.2, cl * 1.5) + Math.max(0.34, cl * 0.18) + cl * 0.28, { shape: 'church', class: 'religious', churchVariant: 'basilica' });
sacred('church-orthodox', 4, 7, cl * 1.05 + cl * 0.78 + cl * 1.0 + cl * 0.42, { shape: 'church', class: 'religious', churchVariant: 'orthodox' });
sacred('church-chapel', 4, 7, cl * 0.95 + cl * 0.6 + cl * 0.55 + cl * 0.62 * 1.7, { shape: 'church', class: 'religious', churchVariant: 'chapel' });
sacred('mosque-ottoman', 6, 6, Math.max(4, cl * 1.95) + cl * 0.4 + cl * 0.2, { shape: 'mosque', class: 'religious', mosqueVariant: 'ottoman' });
sacred('mosque-persian', 6, 6, Math.max(4.5, cl * 2.1) + cl * 0.34 + cl * 0.2, { shape: 'mosque', class: 'religious', mosqueVariant: 'persian' });
sacred('mosque-sahelian', 6, 6, Math.max(4, cl * 1.8) + cl * 0.18 + cl * 0.27, { shape: 'mosque', class: 'religious', mosqueVariant: 'sahelian' });
sacred('mosque-nusantara', 6, 6, cl * 0.82 + cl * 1.2 * 1.15 + cl * 0.18 + cl * 0.24, { shape: 'mosque', class: 'religious', mosqueVariant: 'nusantara' });
sacred('temple-pagoda', 5, 5, cl * 0.16 + cl * 1.4 + cl * 0.9 * 0.9, { shape: 'temple', class: 'religious', templeVariant: 'pagoda' });
sacred('temple-stupa', 5, 5, cl * 0.36 + cl * 0.82 + cl * 0.12 + cl * 0.7 + cl * 0.4, { shape: 'temple', class: 'religious', templeVariant: 'stupa' });
sacred('temple-tibetan', 5, 5, Math.max(2.6, cl) + cl * 0.42 + cl * 0.14, { shape: 'temple', class: 'religious', templeVariant: 'tibetan' });
for (const form of ['hemispheric', 'onion', 'bulbous']) {
  const fM = 5, rDrum = fM * 0.4, domeH = form === 'onion' ? rDrum * 1.5 : form === 'bulbous' ? rDrum * 1.2 : rDrum * 0.92;
  sacred(`rotunda-${form}`, 5, 6, fM * 0.1 + fM * 0.85 + domeH + fM * 0.3, { shape: 'rotunda', class: 'civic', domeForm: form });
}

const L = makeLight({ direction: [0.35, 0.4, -0.85], ambient: 0.5, diffuse: 0.4 });
const render = (box) => assembleBoxCityScene({ boxes: [box], light: L }).faces;
// the drawn points of a face: a clipped quad (the kit's triangle) draws [c0, c1, apex on c3→c2]
const drawn = (f) => {
  const m = typeof f.clip === 'string' && f.clip.match(/^polygon\(0% 0%, 100% 0%, (-?[\d.]+)% 100%\)$/);
  if (!m) return f.corners;
  const t = Number(m[1]) / 100, [c0, c1, c2, c3] = f.corners;
  return [c0, c1, c3.map((v, k) => v + (c2[k] - v) * t)];
};
const hash = (faces) => createHash('sha256').update(JSON.stringify(faces)).digest('hex').slice(0, 16);

// Stock bytes, pinned before the refacade existed: a box without `metro` must render exactly these.
// Most stock builders are 2.1.0's and keep the engine's Math so a minted box keeps its bytes (util/math-scope.js), and some
// of their bytes already differed by platform in 2.1.0: V8 rounds sin, cos, atan2 and the rest one way on x64 and another
// on arm64, and statue-of-liberty's pow changed between Node 22 and 24. STOCK holds the bytes recorded on macOS arm64
// (Node 24); STOCK_X64 the x64 ones where they differ, and ONE_PLATFORM the platform-keyed ones (where no bytes are
// recorded, the byte check is skipped). tian-tan-buddha is 3.0's, on dmath: the same bytes everywhere.
const STOCK_X64 = {
  taj: '6b1cdc35de2ba211', 'cn-tower': 'bbb0364ba83013dc', skytree: 'c6eafdcabb7a2116', colosseum: 'cccc857fd627d2c5',
  'petronas-towers': '0b39c72dfa4b9e0d', 'mobile-edm-hall': 'db04e6d124e73264', 'cloud-gate': 'a131bb980626b82c',
  'rizal-monument': 'c5713a60f84646ec', 'rotunda-bulbous': 'd393330db061fb76',
};
const ONE_PLATFORM = {
  'statue-of-liberty': { 'linux-x64-22': '5efce7798570895f', 'linux-x64-24': '80c398ed919b6ba5', 'linux-arm64-22': '721d93f86d8f700d', 'linux-arm64-24': 'c662f9ddf146fc72', 'darwin-arm64-24': 'c662f9ddf146fc72' },
};
const PLATFORM = `${process.platform}-${process.arch}-${Number(process.versions.node.split('.')[0]) >= 24 ? 24 : 22}`;
const stockPin = (id) => (ONE_PLATFORM[id] ? ONE_PLATFORM[id][PLATFORM] : process.arch === 'x64' ? STOCK_X64[id] ?? STOCK[id] : process.arch === 'arm64' ? STOCK[id] : null);
const STOCK = {
  'taj': '2c93413c09e97f2f',
  'cn-tower': 'f2fff935b4eefe58',
  'skytree': '3145a1a2275d3293',
  'rogers-centre': 'ccb5b6a7bd64404e',
  'colosseum': 'c82bc9a4ec313b12',
  'arena': '8095221cf708400e',
  'great-pyramid': 'c8752fa184077ad9',
  'louvre-pyramid': 'f0d6f28796b629c3',
  'mexican-pyramid': 'c596839d4f38917b',
  'petronas-towers': 'df7b39e6300bc411',
  'big-ben': 'cb5c74205cf89d41',
  'stonehenge': '528156ce9b8bfda2',
  'chinatown-gate': 'c0273afd40cf861e',
  'arc-de-triomphe': '247d8be18b4a7535',
  'parthenon': '8e78c0544a999e3f',
  'griffith-observatory': 'dd28f4879995d031',
  'washington-monument': '3dbc7abb79d66c08',
  'parliament-hill': 'cdcb58a2178f51c1',
  'mobile-edm-hall': '35ca4dc78332f059',
  'eiffel-tower': 'ae7d1ea9527b087f',
  'tokyo-tower': '78f962a012364821',
  'empire-state-building': '5770c0f4e75a68e8',
  'gateway-arch': '8a6ce6ed93fa60bf',
  'cloud-gate': 'b7463a895eb36c51',
  'statue-of-liberty': 'c662f9ddf146fc72',
  'rizal-monument': '59e216cf2e8deb20',
  'church-basilica': '1a70d6b720bf6a93',
  'church-orthodox': 'd30d6a7f4ba4f23d',
  'church-chapel': 'b13d6a36cad366f6',
  'mosque-ottoman': 'a8b38120f1b63b4d',
  'mosque-persian': '92ee819c4d995fc4',
  'mosque-sahelian': 'ab633f28998b92ea',
  'mosque-nusantara': '16288cb59f4f6e0b',
  'temple-pagoda': '878a76d19882431a',
  'temple-stupa': '6725f93595293147',
  'temple-tibetan': '7db8a95762da33af',
  'rotunda-hemispheric': '6681e517e3b5c073',
  'rotunda-onion': '5faa189a9d631252',
  'rotunda-bulbous': '27145fa19bdb8fd8',
  'tian-tan-buddha': 'b58c7c0c31563e0a',   // added with the shape: one builder for every city
};

describe('metro refacade', () => {
  it.for(SUBJECTS.map((s) => [s.id, s]))('%s: a stock box keeps its bytes', ([id, s], { skip }) => {
    const want = stockPin(id);
    if (!want) skip();
    expect(hash(render(s.box))).toBe(want);
  });

  const metro = SUBJECTS.filter((s) => hasRefacade(s.box.shape) || s.id === 'tian-tan-buddha');   // one builder for every city
  it.each(metro.map((s) => [s.id, s]))('%s: the metro build stays in its footprint and under its silhouette', (id, s) => {
    const b = { ...s.box, metro: true };
    const faces = render(b);
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.length).toBeLessThanOrEqual(8000);   // the face budget: every face is a DOM plane on the CSS-3D page
    const tol = Math.min(b.w, b.d) * 0.02;
    let top = -Infinity;
    for (const f of faces) for (const c of drawn(f)) {
      expect(c.every(Number.isFinite)).toBe(true);
      expect(c[0]).toBeGreaterThanOrEqual(b.x - tol); expect(c[0]).toBeLessThanOrEqual(b.x + b.w + tol);
      expect(c[1]).toBeGreaterThanOrEqual(b.y - tol); expect(c[1]).toBeLessThanOrEqual(b.y + b.d + tol);
      expect(c[2]).toBeGreaterThanOrEqual(b.z0 - tol);
      top = Math.max(top, c[2]);
    }
    expect(top).toBeLessThanOrEqual(b.z1 * 1.02 + tol);
    expect(hash(render({ ...b }))).toBe(hash(faces));   // deterministic
  });
});
