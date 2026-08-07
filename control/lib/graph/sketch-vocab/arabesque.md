---
{ "id": "arabesque", "name": "arabesque — Islamic geometric star patterns / rosettes / medallions", "summary": "polygons-in-contact (Hankin/Kaplan) generator that lowers a compact spec into polyline/polygon/circle marks: star tessellations, rosettes (shams), concentric medallions, and woven strapwork", "when": "Islamic geometric ornament, star-and-polygon tessellation, girih, khatam, arabesque, rosette / shams, mandala-like radial medallion, tile-panel pattern, interlaced strapwork, star wallpaper", "tier": "render-primitive", "marks": ["arabesque"], "phase": "p1" }
---

`arabesque` deterministically constructs geometric Islamic ornament by the
polygons-in-contact (PIC / Hankin) method — tile the plane, drop contact points
at edge midpoints, and pair rays at a contact angle into star polygons — then
lowers the result into ordinary `polygon` (star/rosette faces + outlines),
`polyline` (strapwork bands), and `circle` (medallion rings) marks. One compact
mark yields a whole panel; the star order follows the tile's symmetry.

Three `mode`s:
- **field** — a periodic star tessellation over a tiling (`hex` → 6-fold,
  `square`, `khatam` → 4.8.8 octagon+square 8-fold). `interlace:true` re-renders
  it as woven over/under strapwork bands. `fill:true` fills the star faces.
- **rosette** — a single *shams*: `n` tall points + `n` petals + a central star.
  `shoulder`/`pointWidth` are the shoulder/flank degrees of freedom; `fill:true`
  colours points/petals/core.
- **medallion** — a radial *shamsa*: central `n`-star + a ring of stars framed by
  concentric circles.

Colours default to a gold ink (`stroke: var(--foreground)`) with an amber/blue/
red fill palette; override per-panel. The pattern is centred in the viewBox and
scaled to `size` (fraction of the shorter side).

## Shape

```
arabesque{
  role,
  mode?: "field"|"rosette"|"medallion",        // default "field"
  pattern?: "hex"|"square"|"khatam",            // field mode; default "hex"
  n?: number,                                    // star / rosette fold; default 12
  contactAngle?: number,                         // star sharpness (deg); ~45 blunt … ~76 spiky
  cols?, rows?,                                  // field extent
  interlace?: boolean,                           // field: woven strapwork bands
  fill?: boolean,                                // fill faces
  shoulder?, pointWidth?,                         // rosette shape DOF
  cx?, cy?, size?,                               // placement (default centred, 0.9)
  stroke?, strokeWidth?, opacity?,
  starFill?, petalFill?, coreFill?,              // fill palette
  bandColor?, casingColor?, bandWidth?, gap?     // strapwork styling
}
```

Notes:
- Star fields and rosettes carry their own polygon faces, so `fill` works with no
  extra pass. Interlace over/under is greedy per-strand (a few crossings may not
  alternate perfectly); prefer non-interlaced fills for pristine tilework.
- Fivefold/tenfold (girih) periodic *fields* are not yet a tiling option; single
  10/5-fold stars and rosettes work via `n`.
