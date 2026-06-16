---
{ "id": "compositional-balance", "name": "Compositional balance (rotational measurement)", "summary": "the universal balance check for a mark or logo — measure visual mass around its rotational center, then read the 2×2 of (mass balanced?) × (rotational moment zero?) to know whether the silhouette reads static, kinetic, lopsided, or tipping", "when": "any time you're composing a mark, logo, monogram, icon, or seal — score every candidate before rendering; also retrieve when a draft 'doesn't feel right' and you need to name what's off; this is the deeper measurement that other mark axes (stroke, counter-form, register) stack on top of", "tier": "mark", "marks": ["circle", "wedge", "polygon", "polyline", "blob", "rect"], "phase": "p1" }
---

This card is a **measurement instrument**, not a stance menu. Rotational
analysis is how you test whether ANY mark composition holds together — a
tomoe, a heraldic shield, a typographic monogram, a deliberately off-axis
startup mark. Each has a rotational signature. The card teaches you how to
read it.

The tomoe form was constructed around the highest-payoff cell of the
measurement (balanced mass + non-zero rotational moment → "balanced AND in
motion"). That's why it's the historical reference point. But the measurement
is the principle; the tomoe is just one configuration that scores well on it.

## The three quantities

For a candidate mark's `marks[]` array:

1. **Centroid (C)** — the visual center of mass. Sum of `(position × visualMass)` over all marks, divided by total visualMass. `visualMass` ≈ filled area × fill opacity (treat `stroke: "none"` outlines as zero mass; treat `fill: "none"` outlines as `strokeWidth × perimeter / 4`). For a well-composed mark, C should sit on or near the intended geometric center of the canvas.

2. **Angular distribution (D)** — how evenly mass spreads around C. Divide the plane around C into 6 sectors (60° each). Compute mass-per-sector. Take the coefficient of variation σ/μ. Low CV (< 0.3) = balanced; high CV (> 0.7) = lopsided.

3. **Rotational moment (M)** — does the mark imply rotation? For each mark with a directional signature (wedge with `start`/`end`, blob with `rotation`, polyline/polygon with an obvious tangent), contribute its position-cross-direction. Static marks (circle, rect, symmetric polygon) contribute zero. Sum the contributions as a signed scalar (CCW positive). |M| near zero = no implied rotation; |M| large = strong rotational sweep.

## Reading the 2×2

| | M ≈ 0 (no implied rotation) | \|M\| significant (implied rotation) |
|---|---|---|
| **D balanced** | **static** — frontal, institutional, permanent. Civic seals, archival, infrastructure. | **kinetic equilibrium** — the prize. Reads balanced AND alive. Tomoe lives here. Sport, motion-tech, fluid systems. |
| **D unbalanced** | **lopsided** — usually accidental; the silhouette feels wrong. Fix by redistributing mass or accepting it as intentional with a counter-element. | **tipping / falling** — only intentional. Reads forward-momentum, mid-action. Needs a counter-element pulling back or the mark feels like it's falling over. |

Memorize the diagonal: **static ↔ tipping** is the institutional-to-kinetic
axis. The off-diagonal cells **kinetic equilibrium** and **lopsided** are the
extremes — one is the highest-payoff design, the other is the most common
failure mode.

## Configurations that score well

Named reference points the model can target. These aren't required stances —
they're known-good cells in the measurement space.

- **4-fold mirror** (cross, plus, quad-wedge) → balanced, M=0 → static. Two mirror axes guarantee balanced D and cancel any rotational moment.
- **2-fold mirror** (paired forms across a vertical axis) → balanced, M=0 → static. One axis is enough for D-balance; symmetric pairing cancels M.
- **3-fold tomoe** (three identical arms at 120°, all sweeping the same direction) → balanced, M ≠ 0 → kinetic equilibrium. The canonical example: D-balance comes from the 120° spacing, M comes from all three arms sweeping the same way. (See worked example.)
- **N-fold radial** (5+ identical elements at 360/N°) → balanced, M=0 (or M≠0 if all elements sweep) → static or kinetic. Risk: at N>6 the silhouette becomes a disk at small sizes.
- **Asymmetric-rotating** (one dominant sweep + small counter-element) → balanced (because of counter), M ≠ 0 → kinetic. Without the counter-element it falls into **tipping**.

When a user prompts vibe-only ("make it feel alive", "dynamic but stable"),
default to the **kinetic equilibrium** cell — that's the highest-payoff target
and the reason this measurement exists.

## Worked example: 3-fold tomoe scores high

```json
{ "kind": "circle", "cx": 200, "cy": 200, "r": 102, "fill": "none", "stroke": "#1f2933", "strokeWidth": 2 }

{ "kind": "wedge",  "cx": 200, "cy": 200, "r": 92, "rInner": 18, "start": 0.000, "end": 0.250, "fill": "#1f2933" }
{ "kind": "circle", "cx": 274, "cy": 200, "r": 22, "fill": "#1f2933" }

{ "kind": "wedge",  "cx": 200, "cy": 200, "r": 92, "rInner": 18, "start": 0.333, "end": 0.583, "fill": "#1f2933" }
{ "kind": "circle", "cx": 163, "cy": 264, "r": 22, "fill": "#1f2933" }

{ "kind": "wedge",  "cx": 200, "cy": 200, "r": 92, "rInner": 18, "start": 0.667, "end": 0.917, "fill": "#1f2933" }
{ "kind": "circle", "cx": 163, "cy": 136, "r": 22, "fill": "#1f2933" }

{ "kind": "circle", "cx": 200, "cy": 200, "r": 14, "fill": "#1f2933" }
```

- **C** = (200, 200) — exactly on the geometric center. The three arms are 120° apart, head-circles at matching radius, central eye at C.
- **D** = ~0 CV across 6 sectors. Each 60° sector gets one half of one arm's mass; perfectly even.
- **M** ≠ 0 — all three wedges sweep CCW (start < end with positive arc) and their head-circles ride the leading edge. The three contributions add (not cancel) because they're rotationally identical, not mirrored.

Reading: **balanced + non-zero moment → kinetic equilibrium.** The defining
case of the prize cell.

## Worked example: diagnosing a draft that "doesn't feel right"

```json
{ "kind": "wedge",  "cx": 200, "cy": 200, "r": 100, "start": 0.05, "end": 0.55, "fill": "#1f2933" }
{ "kind": "circle", "cx": 240, "cy": 160, "r": 14,  "fill": "#1f2933" }
```

- **C** ≈ (235, 190) — pulled up-and-right of the canvas center by the wedge and small circle.
- **D**: 4 of 6 sectors are nearly empty; mass concentrated in NE and E. High CV (~1.2).
- **M**: large, CCW.

Reading: **unbalanced + non-zero moment → tipping.** The mark feels like it's
falling over. Two fixes: (1) add a counter-element in SW to restore D-balance
while keeping M (now it reads **asymmetric-rotating** in the kinetic cell), or
(2) mirror the wedge to cancel M (now it reads **2-fold mirror** in the static
cell). Which fix to pick depends on intent — but the measurement names what
was wrong without needing to "feel" it.

## Workflow

Retrieve this card:

- **Before rendering a candidate** — compute C / D / M, locate in the 2×2, check it matches intent.
- **When choosing between candidates** — score each, prefer the one closest to the intended cell.
- **When a draft feels wrong** — run the measurement to name the problem (almost always one of: C off-center, D high CV, or M non-zero when zero was intended).
- **Before composing with [[stroke-contract]], [[counter-form]], or [[impact-register]]** — those axes assume the underlying composition already scores. Get balance right first, then layer stroke / counter / register on top.

This is the foundation card. Every other mark axis stacks on this measurement.
