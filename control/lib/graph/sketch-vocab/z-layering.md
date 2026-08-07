---
{ "id": "z-layering", "name": "Z-layering & elevation", "summary": "control paint order so overlapping marks stack correctly, and lift a callout above the surface", "when": "anything overlaps — a callout pinned over a panel, an annotation on a chart, alternating grid overlays; or when an element must read as 'on top'", "marks": ["rect", "text"], "phase": "p1" }
---

Every mark and station carries an optional numeric `z`. Drawables paint in
ascending `z` (ties keep declaration order), so a higher `z` sits on top. This
is how you build overlays — a faint background grid at `z: 0`, panels at `z: 1`,
a pinned callout at `z: 2` — without fighting array order.

## Elevation
Set `elevate: true` on a `rect` to give it a soft drop shadow, so it reads as
hovering above the surface (use sparingly — one or two lifted cards per board).
Pair with a high `z` so it also paints last.

## Rules of thumb
- background substrate (grid rule lines, faint zone fills): `z: 0`
- panels / chart bodies / tiles: `z: 1`
- labels and values that must stay legible over fills: `z: 2`
- pinned callouts / annotations: `z: 3` + `elevate: true`
- give overlapping fills a lower `opacity` (0.1–0.4) so what's beneath still reads

## Example (a callout lifted over a panel)
```json
{ "kind": "rect", "x": 330, "y": 258, "w": 148, "h": 60, "rx": 10, "z": 3, "elevate": true, "fill": "#16202c", "stroke": "#f43f5e" }
{ "kind": "text", "x": 346, "y": 282, "value": "Anomaly +3σ", "size": 12, "weight": 700, "color": "#f43f5e", "z": 3 }
{ "kind": "text", "x": 346, "y": 302, "value": "Fri triage spike", "size": 11, "color": "#93a1b1", "z": 3 }
```
