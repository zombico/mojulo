# Plating: segment-paneled armour as an adornment paradigm

`control/lib/graph/plating/` dresses a body in a powered suit's armour: an undersuit, then plates cut from each segment
of the body the way a supercar's body or a jet's skin is cut. It is one of three wearable libraries built the same way,
with `footwear/` (the feet) and `handwear/` (the hands). A suit takes its feet and hands from those two libraries.

## The shape all three share

- **A card** is pure data: a word in the library's catalogue (`styles.js`), or a card of one's own. A card extends its
  kin (`from`) and changes a few keys, wears a colourway (`skin`), and appends to its kin's lists (`adornPlus`,
  `platesPlus`, `shellsPlus`). Every card is annotated with its family.
- **Passes** (`expand.js`) lay the card in a fixed order: the close layer first (the sock, the glove, the undersuit),
  then what stands on it, then the tones.
- **Laws** (`principles.js`) are the rules the passes obey, written once.
- **An adapter** (`adapters/`) is a body as the library reads it. Each library ships a realistic-body adapter. Another
  body (the authored hero, a creature) plugs in with an adapter, not a change to the library.
- **Groups are roles** (Plate, Trim, Alloy, Joint, Light, Suit …), so a colourway recolours any card and the operator's
  own palette stands over all. Every piece takes the weights of the surface it lies on, so it rides the rig.
- Every card, panel and piece is checked by name before it is laid (`validatePlating`, `validateFootwear`,
  `validateHandwear`), and the refusals say what would have been accepted.

## The fitted shell

A segment is first faired into one smooth shell (`shell.js` `fairShell`: its grooves bridged), then cut into panels.
A panel lies in the segment's DESIGN COORDINATES:

- `t` runs 0 … 1 down the segment (the shank from the knee to the ankle, the hand from the wrist to the knuckles, a
  finger from inside the palm to its pad).
- `s` runs round it: 0 its front line (the back of the hand on the hand, the nail's side on a digit), + its lateral
  side (the thumb's side on the hand), ±1 its back. Past ±1 a line carries on through the back to the other side.

So one layout fits both limbs and any body's segment. A panel:

```js
{ id: 'Shin', seg: 'shank', layer: 'over', t: [0.15, 0.86],
  left: stepped(-0.32, [[0.3, 0.36, 0.1]], 0.15, 0.86), right: [[0.15, 0.32], [0.86, 0.18]],
  mirror?, dome?, lift?, role? }
{ id: 'Hub', seg: 'thigh', layer: 'cap', circle: { t: 0.95, s: 0.5, r: 0.03 } }   // a round panel, sized in metres
```

- `seg` names a segment kind. `fingers` lays the panel on each of the four.
- `layer` sets the panel's height off the shell, its depth and its bevel (`layouts.js` `LAYERS`: under, mid, over, cap,
  light, joint), so an overplate's window shows the metal beneath. `lift` overrides the height (a finger's lames are low).
- `left` and `right` are lines `[[t, s], …]`. `stepped(s0, [[tA, tB, ds], …], t0, t1)` draws the suit's signature line:
  straight runs joined by short diagonal jogs, a line that bends yet stays straight. Neighbours share their jogs so the
  panels fit along them.
- `mirror` adds the other side's copy (s negated), tagged Lat and Med. `role` colours a panel other than by its layer.

Where the body's muscles part cleanly, `muscles` cuts the segment along its grooves instead (`muscles.js`: a plate per
muscle group, its edges straightened into stepped lines). Where they interleave too finely (the lower back, the pelvis,
the thigh toward the groin) or the segment is bone (the shin), a designed layout cuts it.

## Composing a suit

```js
{ from: 'markSuit',                                   // its kin
  skin: 'gunmetal',                                   // a colourway
  shellsPlus: [
    { name: 'fins', panels: [ /* panels of its own */ ] },
    { layout: 'greave', drop: ['Vent'], plus: [ /* panels added */ ], on: ['shank'], bulk: 1.3 },
  ],
  hands: { from: 'suitGloves' },                      // a handwear card: the glove under the gauntlet
  feet: { sock: false, sole: { thick: 0.012 } } }     // a footwear card: the sole under the sabaton
```

A shell entry is a layout's name, or `{ layout | panels, drop?, plus?, name?, on?, bulk? }`. A shell of its own panels
needs a `name`, which names its parts (`<id><Name><PanelId><Lat|Med|>_<segment>`). The named layouts are `LAYOUTS` in
`layouts.js`; the seeded suits are `SUITS` in `styles.js`.

## Seeing it

`/body-study` with `--dress` paints the suit's groups by its palette; crop to a joint (`--crop hand`, `knee`, `hip`) and
pose the fingers (`{"pose": {"fingersR": "fist"}}`) to check that the plates ride the rig. A render is the eyes gate's
material, never its verdict.
