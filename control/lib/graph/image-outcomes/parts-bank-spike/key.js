/**
 * Border flood-fill keying — the local worker's acetate keyer
 * (animation-cheats.plan.md P0 rounds 2–9). Chroma green fights the model's
 * prior; a plain uniform background in the model's own register keys just as
 * deterministically because flat-cel outlines seal the figure: a flood from
 * the canvas borders cannot leak inside. A painted floor shadow (soft, or
 * fully detached) is then dropped by keeping only the LARGEST connected
 * foreground component. Raw RGBA in, raw RGBA out.
 */

/**
 * @param rgba full-canvas RGBA buffer (mutated: background pixels → alpha 0)
 * @returns stats { bg, backgroundFrac, componentsDropped }
 */
export function floodKey(rgba, { width: w, height: h }, { tolerance = 26, componentFloor = 0.002 } = {}) {
  const n = w * h;
  // background color: border median-ish (corner + edge-midpoint average)
  const probes = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w >> 1, 2], [w >> 1, h - 3], [2, h >> 1], [w - 3, h >> 1]];
  const bg = [0, 1, 2].map((c) => Math.round(probes.reduce((a, [x, y]) => a + rgba[(y * w + x) * 4 + c], 0) / probes.length));
  const isBgColor = (i) =>
    Math.abs(rgba[i * 4] - bg[0]) < tolerance &&
    Math.abs(rgba[i * 4 + 1] - bg[1]) < tolerance &&
    Math.abs(rgba[i * 4 + 2] - bg[2]) < tolerance;

  // BFS flood from every border pixel that matches the background
  const state = new Uint8Array(n); // 0 unknown, 1 background, 2 queued
  const queue = new Int32Array(n);
  let qh = 0, qt = 0;
  const push = (i) => { if (state[i] === 0 && isBgColor(i)) { state[i] = 2; queue[qt++] = i; } };
  for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) {
    const i = queue[qh++];
    state[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // Enclosed-background drop: a cel-style painted shadow is an OUTLINED
  // ellipse whose fill matches the background — the flood can't reach it
  // (outline-sealed) but color says it's ground, not figure. Any
  // background-colored pixel the flood didn't reach goes transparent, which
  // reduces the shadow to a thin outline ring for the erosion below.
  for (let i = 0; i < n; i += 1) if (state[i] !== 1 && isBgColor(i)) { rgba[i * 4 + 3] = 0; state[i] = 1; }

  // Erode the foreground before labeling: a painted shadow often touches the
  // figure (boot heel on the shadow ring) — erode → label → keep the largest
  // → dilate the kept component back over the margin.
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) fg[i] = state[i] !== 1 && rgba[i * 4 + 3] !== 0 ? 1 : 0;
  const eroded = new Uint8Array(fg);
  for (let pass = 0; pass < 4; pass += 1) {
    const prev = Uint8Array.from(eroded);
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (prev[i] && !(prev[i - 1] && prev[i + 1] && prev[i - w] && prev[i + w])) eroded[i] = 0;
    }
  }

  // connected components over the ERODED foreground; keep the largest
  const comp = new Int32Array(n).fill(-1);
  const sizes = [];
  for (let seed = 0; seed < n; seed += 1) {
    if (!eroded[seed] || comp[seed] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    qh = 0; qt = 0; queue[qt++] = seed; comp[seed] = id;
    while (qh < qt) {
      const i = queue[qh++];
      size += 1;
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && eroded[j] && comp[j] === -1) { comp[j] = id; queue[qt++] = j; }
      }
    }
    sizes.push(size);
  }
  const keep = sizes.indexOf(Math.max(...sizes, 0));

  // dilate the kept component back over the erosion + antialias margin, then
  // drop every foreground pixel outside it
  let keepMask = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) keepMask[i] = comp[i] === keep ? 1 : 0;
  for (let pass = 0; pass < 6; pass += 1) {
    const prev = keepMask;
    keepMask = Uint8Array.from(prev);
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (!prev[i] && fg[i] && (prev[i - 1] || prev[i + 1] || prev[i - w] || prev[i + w])) keepMask[i] = 1;
    }
  }
  let dropped = 0, bgCount = 0;
  for (let i = 0; i < n; i += 1) {
    if (state[i] === 1) { rgba[i * 4 + 3] = 0; bgCount += 1; continue; }
    if (fg[i] && !keepMask[i]) { rgba[i * 4 + 3] = 0; dropped += 1; }
  }
  return { bg, backgroundFrac: Math.round((bgCount / n) * 1000) / 1000, components: sizes.length, componentsDropped: dropped };
}
