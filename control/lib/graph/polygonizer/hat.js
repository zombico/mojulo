/**
 * hat — a headwear primitive, the sibling of `wig`. A hat sits ON the head (over a wig or bare),
 * so it reads the skull from the posed body and builds ring-stacks the shared meshers render.
 *
 * A hat is composed from a few parts — a CROWN (dome or cylinder over the top of the head), an
 * optional flat TOP disc (top hats / pillboxes), a flat BRIM (annulus around the crown base), and an
 * optional BILL (a forward tongue — baseball caps). Each is pure data in the HATS catalog.
 *
 * Population note: ~25% of figures wear a hat. Some hats are unisex (caps, beanies, bucket); others
 * are dimorphic (a tall topHat reads masculine; a wide ladyHat / pillbox reads feminine) — tagged
 * with `sex` so a population picker can choose appropriately. `buildHat(body, spec)` returns the
 * ring-stacks; the caller meshes them (closed loops = tubes/discs, the bill = an open sheet).
 */

const TAU = 2 * Math.PI;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function headFrame(body) {
  const head = body.find((s) => s.id === 'headEgg');
  if (!head) throw new Error('hat: figure has no headEgg');
  let hx = 0, hy = 0, n = 0, crownZ = -Infinity, headR = 0, rc = 0;
  for (const r of head.rings) { hx += r.center.x; hy += r.center.y; n++; }
  hx /= n; hy /= n;
  for (const r of head.rings) for (const p of r.polyline) { if (p.z > crownZ) crownZ = p.z; headR += Math.hypot(p.x - r.center.x, p.y - r.center.y); rc++; }
  const prof = head.rings.map((r) => { let s = 0, m = 0; for (const p of r.polyline) { s += Math.hypot(p.x - r.center.x, p.y - r.center.y); m++; } return { z: r.center.z, r: s / m }; }).sort((a, b) => a.z - b.z);
  const radiusAt = (z) => { if (z <= prof[0].z) return prof[0].r; if (z >= prof[prof.length - 1].z) return prof[prof.length - 1].r; for (let i = 0; i < prof.length - 1; i++) if (z >= prof[i].z && z <= prof[i + 1].z) { const t = (z - prof[i].z) / ((prof[i + 1].z - prof[i].z) || 1); return prof[i].r + (prof[i + 1].r - prof[i].r) * t; } return prof[prof.length - 1].r; };
  return { hx, hy, crownZ, headR: headR / rc, radiusAt };
}

const M = 30;
const ring = (hx, hy, z, r) => { const poly = []; for (let k = 0; k <= M; k++) { const a = TAU * k / M; poly.push({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r, z }); } return { center: { x: hx, y: hy, z }, polyline: poly }; };

// MUGEN ENVELOPE — the outer hull (max radius about the head axis, binned by height) of everything
// the hat sits over (head + hair). The hat offsets OUTWARD from this by a standoff so it overlays
// the layers beneath instead of being sucked into them. envR(z) → max radius near height z.
function buildEnvelope(hx, hy, stacks, bin = 0.14) {
  const maxR = new Map();
  for (const st of stacks) for (const r of st.rings) for (const p of r.polyline) {
    const rr = Math.hypot(p.x - hx, p.y - hy), b = Math.round(p.z / bin);
    if (!maxR.has(b) || rr > maxR.get(b)) maxR.set(b, rr);
  }
  return (z) => { const b = Math.round(z / bin); let m = 0; for (let d = -1; d <= 1; d++) { const v = maxR.get(b + d); if (v != null && v > m) m = v; } return m; };
}

// CROWN — a closed dome (rounded) or cylinder (flatTop) from the seat up. Converges to a point at the
// top for domes; for flatTop the caller adds a top disc.
function crown(hx, hy, seatZ, baseR, height, flatTop, envR, mugen, L = 12) {
  const rings = [];
  for (let i = 0; i <= L; i++) {
    const t = i / L, z = seatZ + height * t;
    let r = flatTop ? baseR * (1 - 0.05 * t) : baseR * Math.sqrt(Math.max(0, 1 - (t * 0.96) ** 2));
    if (envR) r = Math.max(r, envR(z) + mugen);                       // MUGEN: grow to clear the hair/head beneath
    rings.push(ring(hx, hy, z, Math.max(0.015, r)));
  }
  return { id: 'hat:crown', rings, hex: null, closed: true };
}
// flat DISC / ANNULUS at z (rInner→rOuter), with the outer edge optionally dropped (a downturned brim).
function disc(hx, hy, z, rInner, rOuter, drop, steps = 5) {
  const rings = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps; rings.push(ring(hx, hy, z - drop * t * t, rInner + (rOuter - rInner) * t)); }
  return rings;
}
// BILL — a forward tongue (baseball cap): an open arc fan sweeping out the front, curving down.
function bill(hx, hy, seatZ, baseR, len, droop, halfWidth) {
  const front = Math.PI / 2, L = 6, rings = [];
  for (let i = 0; i <= L; i++) {
    const t = i / L, reach = baseR * 0.96 + len * t, poly = [];
    for (let k = 0; k <= 14; k++) { const a = front - halfWidth + (2 * halfWidth) * (k / 14); poly.push({ x: hx + Math.cos(a) * reach, y: hy + Math.sin(a) * reach, z: seatZ - droop * t * t }); }
    rings.push({ center: { x: hx, y: hy, z: seatZ }, polyline: poly });
  }
  return { id: 'hat:bill', rings, hex: null, closed: false };
}

export const HATS = {
  // ── unisex ──
  baseballCap: { kind: 'cap', color: '#b23a3a', crownR: 1.16, crownH: 0.6, seat: 0.62, bill: 0.78, droop: 0.18, billHalf: 0.95 },
  beanie:      { kind: 'beanie', color: '#3a5a86', crownR: 1.12, crownH: 0.72, seat: 1.15 },
  bucket:      { kind: 'brim', color: '#6d7a48', crownR: 1.12, crownH: 0.52, seat: 0.5, brim: 0.42, brimDrop: 0.18, flatTop: false },
  // ── dimorphic: masculine ──
  topHat:      { kind: 'brim', color: '#16161c', crownR: 1.02, crownH: 1.6, seat: 0.32, brim: 0.6, brimDrop: 0.02, flatTop: true, sex: 'male' },
  // ── dimorphic: feminine ──
  ladyHat:     { kind: 'brim', color: '#cf7aa0', crownR: 1.06, crownH: 0.46, seat: 0.34, brim: 1.45, brimDrop: 0.28, flatTop: false, sex: 'female' },
  pillbox:     { kind: 'pillbox', color: '#d7b8cb', crownR: 0.98, crownH: 0.55, seat: 0.18, sex: 'female' },
};

/**
 * Build a hat on a posed figure. Returns ring-stacks (closed loops = crown/disc/brim; the bill is an
 * open sheet). `opts.color` overrides the catalog colour.
 */
export function buildHat(body, spec, opts = {}) {
  const s = typeof spec === 'string' ? HATS[spec] : spec;
  if (!s) throw new Error(`hat: unknown style '${spec}'`);
  const { hx, hy, crownZ, headR, radiusAt } = headFrame(body);
  const color = opts.color ?? s.color;
  // MUGEN: the hat offsets outward from the hull of head + whatever it sits over (a wig).
  const over = opts.over || [];
  const mugen = opts.mugen ?? 0.05;
  const head = body.find((b) => b.id === 'headEgg');
  const envR = buildEnvelope(hx, hy, [head, ...over]);
  // sit ON tall hair: if the hair rises above the head crown, lift the whole hat by that much.
  const hairTopZ = over.length ? Math.max(...over.flatMap((st) => st.rings.flatMap((r) => r.polyline.map((p) => p.z)))) : crownZ;
  const lift = Math.max(0, hairTopZ - crownZ);
  const seatZ = crownZ - (s.seat ?? 0.5) + lift;
  const baseR = Math.max((s.crownR ?? 1.1) * headR, radiusAt(crownZ - (s.seat ?? 0.5)) + 0.06, envR(seatZ) + mugen);
  const stacks = [];
  const tag = (st) => { st.hex = color; return st; };

  if (s.kind === 'beanie') {
    stacks.push(tag(crown(hx, hy, seatZ, baseR, s.crownH, false, envR, mugen, 14)));
  } else if (s.kind === 'cap') {
    stacks.push(tag(crown(hx, hy, seatZ, baseR, s.crownH, false, envR, mugen)));
    stacks.push(tag(bill(hx, hy, seatZ + 0.02, baseR, s.bill, s.droop, s.billHalf)));
  } else if (s.kind === 'pillbox') {
    stacks.push(tag(crown(hx, hy, seatZ, baseR, s.crownH, true, envR, mugen)));
    stacks.push(tag({ id: 'hat:top', rings: disc(hx, hy, seatZ + s.crownH, 0.02, baseR * 0.95, 0), closed: true }));
  } else { // 'brim' — crown (+top disc if flat) + a flat brim annulus that clears the hair at the seat
    stacks.push(tag(crown(hx, hy, seatZ, baseR, s.crownH, s.flatTop, envR, mugen)));
    if (s.flatTop) stacks.push(tag({ id: 'hat:top', rings: disc(hx, hy, seatZ + s.crownH, 0.02, baseR * 0.95, 0), closed: true }));
    const rInner = Math.max(baseR * 0.98, envR(seatZ) + mugen);
    stacks.push(tag({ id: 'hat:brim', rings: disc(hx, hy, seatZ + 0.02, rInner, rInner + s.brim, s.brimDrop, 6), closed: true }));
  }
  return stacks;
}
