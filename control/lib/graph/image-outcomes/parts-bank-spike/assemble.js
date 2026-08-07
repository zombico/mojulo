/**
 * Assemble — place harvested parts into a TARGET pose by declared-coordinate
 * similarity transforms (animation-cheats.plan.md, principle 1). For each
 * part, the transform maps its bank-pose pivot segment onto the target
 * pose's: rotation + uniform scale + translation, computed from the SAME
 * armature nodes the skeletons were drawn from. Inverse-mapped bilinear
 * sampling — pure pixel math, deterministic.
 *
 * Z-order (this costume): far duplicates behind, then torso (skirt/coat hem
 * covers the leg and far-arm cut seams), then near leg, then near arm.
 */

// similarity transform mapping segment (p→q) onto (P→Q)
export function segmentTransform([px, py], [qx, qy], [Px, Py], [Qx, Qy]) {
  const a1 = Math.atan2(qy - py, qx - px);
  const a2 = Math.atan2(Qy - Py, Qx - Px);
  const s = Math.hypot(Qx - Px, Qy - Py) / (Math.hypot(qx - px, qy - py) || 1e-9);
  return { theta: a2 - a1, s, from: [px, py], to: [Px, Py] };
}

/** Apply a similarity transform to a full-canvas RGBA part buffer. */
export function transformPart(raw, { width: w, height: h }, t, { darken = 1, flip = false } = {}) {
  const out = Buffer.alloc(w * h * 4);
  const cos = Math.cos(t.theta), sin = Math.sin(t.theta);
  const inv = 1 / t.s;
  // forward: out = R(theta)*s*(p - from) + to  (with optional x-mirror about `from` first)
  // inverse: p = Rinv*(out - to)*inv (+ mirror) + from
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - t.to[0], dy = y - t.to[1];
      let sx = (cos * dx + sin * dy) * inv;
      const sy = (-sin * dx + cos * dy) * inv;
      if (flip) sx = -sx;
      const fx = sx + t.from[0], fy = sy + t.from[1];
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
      const u = fx - x0, v = fy - y0;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const i00 = (y0 * w + x0) * 4 + c, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
        let val = raw[i00] * (1 - u) * (1 - v) + raw[i10] * u * (1 - v) + raw[i01] * (1 - u) * v + raw[i11] * u * v;
        if (c < 3 && darken !== 1) val *= darken;
        out[o + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
  return out;
}

/**
 * Fill enclosed transparent holes in a part (the crater a harvested limb
 * leaves in the torso) with smeared surrounding color — iterative dilate-
 * average. The compile pass heals SEAMS but preserves HOLES (it reads a
 * background-colored crater as an object and rationalizes it — P0 compile
 * round 1 painted the arm crater as a scarf), so craters must be filled
 * with plausible local color BEFORE compile. Border-connected transparency
 * (the real background) is left alone.
 */
export function fillEnclosedHoles(raw, { width: w, height: h }, { passes = 220 } = {}) {
  const n = w * h;
  // mark transparency connected to the border (true background)
  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0, qt = 0;
  const push = (i) => { if (!outside[i] && raw[i * 4 + 3] === 0) { outside[i] = 1; queue[qt++] = i; } };
  for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  // iterative fill: each hole pixel takes the average of filled 4-neighbors
  for (let pass = 0; pass < passes; pass += 1) {
    let changed = 0;
    for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (raw[i * 4 + 3] !== 0 || outside[i]) continue;
      let r = 0, g = 0, b = 0, c = 0;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (raw[j * 4 + 3] > 0) { r += raw[j * 4]; g += raw[j * 4 + 1]; b += raw[j * 4 + 2]; c += 1; }
      }
      if (!c) continue;
      raw[i * 4] = Math.round(r / c); raw[i * 4 + 1] = Math.round(g / c); raw[i * 4 + 2] = Math.round(b / c);
      raw[i * 4 + 3] = 255;
      changed += 1;
    }
    if (!changed) break;
  }
  return raw;
}

/** src-OVER composite b onto a (both raw RGBA, premultiply-free straight alpha). */
export function over(a, b, { width: w, height: h }) {
  for (let i = 0; i < w * h * 4; i += 4) {
    const ba = b[i + 3] / 255;
    if (ba === 0) continue;
    const aa = a[i + 3] / 255;
    const oa = ba + aa * (1 - ba);
    for (let c = 0; c < 3; c += 1) a[i + c] = Math.round((b[i + c] * ba + a[i + c] * aa * (1 - ba)) / (oa || 1));
    a[i + 3] = Math.round(oa * 255);
  }
  return a;
}

/**
 * The whole assembly: bank parts + MEASURED bank nodes + DECLARED target
 * nodes → a raw RGBA canvas of the never-rendered pose, plus the per-part
 * transforms (recorded as evidence). `side` is the harvested near side.
 * Both lower legs are real harvested parts; the far ARM is the near arm's
 * pixels placed on the far target segments, darkened (puppet convention).
 * Z-order: far arm dup behind, then both legs (skirt/coat hem covers the
 * cut seams), then torso, then the near arm on top.
 */
export function assemblePose({ parts, torso }, bankNodes, targetNodes, size, side, { farDarken = 0.82 } = {}) {
  const far = side === 'L' ? 'R' : 'L';
  const transforms = {};
  // part pixels come from the bank chain srcA→srcB; placement segment is the
  // target's dstA→dstB (dst side may differ from src side: the far-arm dup)
  const place = (partId, srcA, srcB, dstA, dstB, opts = {}) => {
    const part = parts[partId];
    const t = segmentTransform(bankNodes[srcA], bankNodes[srcB], targetNodes[dstA], targetNodes[dstB]);
    transforms[`${partId}→${dstA}`] = t;
    return transformPart(part.raw, size, t, opts);
  };
  const tTorso = segmentTransform(bankNodes.pelvisHub, bankNodes.neckHub, targetNodes.pelvisHub, targetNodes.neckHub);
  transforms.torso = tTorso;
  fillEnclosedHoles(torso.raw, size);

  const canvas = Buffer.alloc(size.width * size.height * 4);
  over(canvas, place('upperArm', 'shoulder' + side, 'elbow' + side, 'shoulder' + far, 'elbow' + far, { darken: farDarken }), size);
  over(canvas, place('forearm', 'elbow' + side, 'wrist' + side, 'elbow' + far, 'wrist' + far, { darken: farDarken }), size);
  over(canvas, place('lowerLeg' + far, 'knee' + far, 'ankle' + far, 'knee' + far, 'ankle' + far), size);
  over(canvas, place('lowerLeg' + side, 'knee' + side, 'ankle' + side, 'knee' + side, 'ankle' + side), size);
  over(canvas, transformPart(torso.raw, size, tTorso), size);
  over(canvas, place('upperArm', 'shoulder' + side, 'elbow' + side, 'shoulder' + side, 'elbow' + side), size);
  over(canvas, place('forearm', 'elbow' + side, 'wrist' + side, 'elbow' + side, 'wrist' + side), size);
  return { canvas, transforms };
}
