# Boxless UI (a spike)

In a game's own HUD the words are rarely set on a plate. The decoration is on the letters: a fill that runs top to
bottom, a stroke round each letter, a second ring outside it, a shadow dropped hard under it. The plate was there to
make the words read over a busy picture. A dressed letter reads over that picture on its own, and leaves it uncovered.
This spike takes the race's HUD (`gameworld/race-hud.js`, drawn by the page's own HUD channel) and draws it with every
plate stripped and the decoration moved onto the type.

```bash
node scripts/spikes/boxless-ui/sheet.mjs --still <a race's still .png> [--out <dir>] [--dress candy,chrome] [--theme kart-candy]
```

The sheet lays the HUD over the still, boxed as it ships and boxless in each letter dress (`letter-dress.js`), all at
the same moment of the same race: second of four, a gumball held, the final lap called. It writes one picture a look
and a contact sheet.

## The letter dresses

A dress is the HUD's type at three sizes:

- **big:** the place, the held item's name and the moment's banner. It has a fill (a colour or a gradient), its rings
  inside out, an extrusion, a drop and a lean.
- **mid:** the numbers in a stack (the lap, the times, the speed). It is the big dress with its rings and drop scaled to
  the type.
- **small:** the labels, with a fill and one ring.

The four tried are candy (a lemon-to-orange wrapper, berry stroke, cream ring, hard drop), sticker (berry letters cut
out in a fat white edge), chrome (a sky over a horizon in metal letters, a near-black stroke) and extrude (lemon block
letters on a berry depth, leaning on).

## What it found

- **The picture comes back.** The share of the screen the HUD covers, measured as the pixels that differ from the bare
  still at the busiest moment (the banner up), is 18.1% boxed and 5.2–6.9% boxless. That is about a third. The sky,
  the far trees and the corner the kart is driving into are no longer behind plates.
- **Every dress holds over the scene.** The two rings, a dark one inside a light one or the reverse, part a letter from
  any colour behind it. One ring is enough for a label. The banner works best of all without its parallelogram: the
  words are the moment.
- **Size matters.** A big word's ring on a small number fills its counters in and reads as a dark chip, the box come
  back by another way. The rings and the drop must scale with the type (the dress's `mid`, `scaled`).
- **Rings are a filter, not a shadow.** `text-shadow` paints over a gradient fill clipped to the text, so a ring drawn
  with it covers the gradient. A chain of CSS `drop-shadow`s works, but at eight to a ring and seventeen to a word it
  was too slow to repaint every frame (the first try timed out in software). One SVG filter a size is a single pass:
  each ring is the letters' alpha dilated and flooded, merged under them.
- **What is drawn takes the small ring too.** The pictogram, the map's route and the dial need the same keyline to
  stay readable without a plate.
- **Not yet answered:** the touch pad and the menus (a list is a screen, still on its window), a dark scene (the
  rings were tuned on a day), and the cost on a phone with every number changing every frame.

## What it would take

- **A theme word, `letters`:** `plain` (as now) or a dress by name (`candy`, `sticker`, `chrome`, `extrude`), or a dress
  written out. A theme card says it, as it says `icons`.
- **`hud: 'bare'` read by the mana-ui HUD:** every region bare, as a fight's already are (`data-variant=bare`), not
  only the legacy HUD's sheet (`gameHudCss`).
- **The filters laid once at mount:** mana-ui owns its DOM, so `mount` would place the dress's SVG. `themeCss` stays CSS.
- **A law in `themeAdvice`:** the outer ring must part from the fill and the inner ring from the outer by enough
  contrast to read over any scene (the two-ring rule above).
- **Measured:** the HUD's covered share as a machine law of the race HUD.

The eyes gate is the person's: the sheet is for looking at, and nothing here is shipped.
