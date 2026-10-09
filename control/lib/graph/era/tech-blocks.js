/**
 * STARTER BLOCKS — a library a civilization can begin from (era/blocks.js): data only, each a rule over its params.
 * A civilization's own blocks are written the same way, in its recipe; these are where the agent starts when a world
 * names none. Read as a set: parts (a wing, a wheel set, a status light) and the things made of them.
 */
export const STARTER_BLOCKS = Object.freeze({
  // ── parts ──
  'status-light': { id: 'status-light', read: 'the status light: the one accent, on what you use', tier: 'part', mounts: ['wall', 'roof', 'socket'],
    params: { r: [0.1, 0.2] }, parts: [{ id: 'lamp', prim: 'lamp', role: 'status', r: 'r', group: 'str:accent' }], sig: ['lamp'], functions: ['signal'] },
  'solar-wing': { id: 'solar-wing', read: 'a collector wing tilted to the sun on a post, its cells a grid in the tile', tier: 'part', mounts: ['ground', 'roof'], functions: ['power'],
    params: { w: [1.6, 2.6], h: [1, 1.6], tilt: [20, 45] },
    parts: [
      { id: 'post', prim: 'box', role: 'frame', size: [0.2, 0.2, 'h * 0.7 + 0.4'], group: 'tech:frame', value: 0.4 },
      { id: 'wing', prim: 'panel', role: 'source', size: ['w', 'h'], t: 0.08, seams: 0.4, at: [0, 0, 'h * 0.7 + 0.4'], aim: [0, '-sqrt(1 - (tilt / 90) * (tilt / 90))', 'tilt / 90 + 0.3'], group: 'tech:glass', value: 0.18 },
      { id: 'lead-out', prim: 'tube', role: 'carrier', r: 0.04, from: [0, 0.12, 0.2], to: [0, 0.12, 'h * 0.7'], group: 'tech:cable', value: 0.3 },
    ], sig: ['wing'], lead: 'wing' },

  'roof-mast': { id: 'roof-mast', read: 'a short mast on a roof: a dish, whips and a beacon', tier: 'part', functions: ['sense', 'signal'], mounts: ['roof', 'ground'],
    params: { h: [2.6, 4.2] }, sockets: { top: [0, 0, 'h'] },
    parts: [
      { id: 'foot', prim: 'box', role: 'mount', size: [0.7, 0.7, 0.25], group: 'tech:frame', value: 0.5 },
      { id: 'mast', prim: 'tube', role: 'frame', r: 0.17, from: [0, 0, 0.25], to: [0, 0, 'h'], sides: 6, group: 'tech:frame', value: 0.45 },
      { id: 'dish', prim: 'dish', role: 'sensor', r: 0.36, depth: 0.14, at: [0.25, -0.25, 'h * 0.62'], aim: [0.5, -0.65, 0.57], group: 'tech:skin', value: 0.85 },
      { id: 'whips', prim: 'tube', role: 'sensor', r: 0.03, from: [0, 0, 0], to: [0, 0, 1.4], socket: 'top', repeat: { n: 'round(1 + 2 * many)', step: [0.18, 0, 0] }, group: 'tech:frame', value: 0.4 },
      { id: 'beacon', block: 'status-light', role: 'beacon', socket: 'top' },
    ], sig: ['mast', 'dish'], lead: 'mast' },

  // ── things ──
  tank: { id: 'tank', read: 'a vessel on legs: something held, a light on what you use', tier: 'machine', functions: ['store'], mounts: ['ground'],
    params: { r: [0.8, 1.4], legs: [3, 4, 'i'] },
    parts: [
      { id: 'vessel', prim: 'drum', role: 'store', r: 'r', h: 'r * 2.4', at: [0, 0, 0.9], sides: 12, group: 'tech:body', value: 0.7 },
      { id: 'bands', prim: 'ring', role: 'trim', r: 'r + 0.03', tube: 0.06, at: [0, 0, 'r * 0.8 + 0.9'], repeat: { n: 2, step: [0, 0, 'r * 0.8'] }, group: 'tech:trim', value: 0.5, many: 0.25 },
      { id: 'legs', prim: 'box', role: 'frame', size: [0.22, 0.22, 0.9], repeat: { n: 'legs', around: 'r * 0.75' }, group: 'tech:frame', value: 0.4 },
      { id: 'light', block: 'status-light', role: 'status', at: [0, 0, 'r * 2.4 + 0.9'], many: 0.5 },
    ], sig: ['vessel'] },
  'solar-array': { id: 'solar-array', read: 'a row of collector wings and the cabinet their cables run to', tier: 'installation', functions: ['power'], mounts: ['ground'],
    params: { gap: [0.4, 0.9] },
    parts: [
      { id: 'wings', block: 'solar-wing', role: 'source', at: [0, 0, 0], repeat: { n: 'round(3 + 3 * many)', step: ['2.6 + gap', 0, 0] } },
      { id: 'tray', prim: 'box', role: 'carrier', size: ['(2.6 + gap) * round(3 + 3 * many)', 0.35, 0.3], at: ['(2.6 + gap) * (round(3 + 3 * many) - 1) / 2', 1.2, 0], group: 'tech:cable', value: 0.35 },
      { id: 'cabinet', prim: 'box', role: 'store', size: [1.2, 0.9, 1.8], seams: 0.6, at: ['(2.6 + gap) * round(3 + 3 * many) - 0.6 + gap', 1.4, 0], group: 'tech:body', value: 0.7 },
      { id: 'light', block: 'status-light', role: 'status', at: ['(2.6 + gap) * round(3 + 3 * many) - 0.6 + gap', 1.4, 1.8] },
    ], sig: ['wings', 'cabinet'], lead: 'wings' },
  'comms-mast': { id: 'comms-mast', read: 'a lattice mast on a pad, a dish turned to the sky and a beacon at the top', tier: 'installation', functions: ['sense', 'signal'], mounts: ['ground', 'roof'],
    params: { h: [9, 16], dish: [0.8, 1.3] },
    sockets: { top: [0, 0, 'h'] },
    parts: [
      { id: 'pad', prim: 'box', role: 'mount', size: [2, 2, 0.4], group: 'tech:frame', value: 0.55 },
      { id: 'mast', prim: 'truss', role: 'frame', from: [0, 0, 0.4], to: [0, 0, 'h'], w: 1, member: 0.12, group: 'tech:frame', value: 0.45 },
      { id: 'dish', prim: 'dish', role: 'sensor', r: 'dish', depth: 'dish * 0.35', at: [0.5, -0.5, 'h * 0.72'], aim: [0.55, -0.6, 0.58], group: 'tech:skin', value: 0.85 },
      { id: 'whips', prim: 'tube', role: 'sensor', r: 0.05, from: [0, 0, 0], to: [0, 0, 2.2], socket: 'top', repeat: { n: 'round(1 + 2 * many)', step: [0.3, 0, 0] }, group: 'tech:frame', value: 0.4, many: 0.25 },
      { id: 'beacon', block: 'status-light', role: 'beacon', socket: 'top', at: [0, 0, 0] },
    ], sig: ['mast', 'dish'], lead: 'mast' },
  hauler: { id: 'hauler', read: 'a load bed and a cab on wheels: it goes', tier: 'machine', functions: ['move'], mounts: ['ground'],
    params: { len: [3.2, 4.6], axles: [2, 3, 'i'] },
    parts: [
      { id: 'bed', prim: 'box', role: 'body', size: ['len', 2, 1.1], at: [0, 0, 0.75], seams: 0.9, group: 'tech:body', value: 0.72 },
      { id: 'cab', prim: 'box', role: 'body', size: [1.3, 2, 1.4], at: ['len / 2 + 0.7', 0, 0.75], group: 'tech:skin', value: 0.8 },
      { id: 'screen', prim: 'panel', role: 'readout', size: [1.5, 0.6], t: 0.04, at: ['len / 2 + 1.36', 0, 1.75], aim: [1, 0, 0.2], group: 'tech:glass', value: 0.12 },
      { id: 'wheels-l', prim: 'wheel', role: 'running', r: 0.5, w: 0.4, at: ['-len / 2 + 0.6', -1.05, 0], repeat: { n: 'axles', step: ['(len + 0.6) / (axles - 1)', 0, 0] }, group: 'tech:frame', value: 0.25 },
      { id: 'wheels-r', prim: 'wheel', role: 'running', r: 0.5, w: 0.4, at: ['-len / 2 + 0.6', 1.05, 0], repeat: { n: 'axles', step: ['(len + 0.6) / (axles - 1)', 0, 0] }, group: 'tech:frame', value: 0.25 },
      { id: 'rack', prim: 'box', role: 'trim', size: ['len * 0.8', 0.12, 0.5], at: [0, -1.06, 1.85], repeat: { n: 2, step: [0, 2.12, 0] }, group: 'tech:trim', value: 0.5, many: 0.5 },
      { id: 'light', block: 'status-light', role: 'status', at: ['len / 2 + 0.7', 0, 2.15] },
    ], sig: ['bed', 'wheels-l'], lead: 'bed' },
  fabricator: { id: 'fabricator', read: 'a works with a hopper in, a belt out, and an arm that swings between them: an automation', tier: 'automation', functions: ['make'], mounts: ['ground'],
    params: { swing: [0, 120], belt: [3, 6] }, cycle: 'swing',
    parts: [
      { id: 'works', prim: 'box', role: 'body', size: [2.8, 2.2, 2.4], seams: 0.8, group: 'tech:body', value: 0.7 },
      { id: 'hopper', prim: 'cone', role: 'intake', r: 0.5, r2: 0.9, h: 0.9, at: [-0.4, 0, 2.4], sides: 4, group: 'tech:skin', value: 0.8 },
      { id: 'belt', prim: 'track', role: 'outlet', len: 'belt', r: 0.4, w: 0.9, at: ['1.4 + belt / 2', 0, 0.2], group: 'tech:frame', value: 0.3 },
      { id: 'legs', prim: 'box', role: 'frame', size: [0.2, 0.9, 0.2], at: ['1.7 + belt / 2', 0, 0], repeat: { n: 2, step: ['belt / 2 - 0.6', 0, 0] }, group: 'tech:frame', value: 0.35 },
      { id: 'arm', prim: 'arm', role: 'joint', segs: [1.4, 1.1], bend: [20, 60], turn: 'swing - 60', r: 0.4, at: [1.9, -1.4, 0.6], group: 'tech:trim', value: 0.55 },
      { id: 'light', block: 'status-light', role: 'status', at: [0.8, 0, 2.4] },
    ], sig: ['works', 'belt', 'arm'], lead: 'works' },
});
export const STARTER_BLOCK_IDS = Object.freeze(Object.keys(STARTER_BLOCKS));
