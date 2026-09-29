---
{
  "id": "equipment",
  "name": "Equipment (arms named by intent and direction)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Compose fantasy arms (dagger, sword, greatsword, staff, bow, shield) from an item, a style and a few dials. A handful of laws turn the words into every dimension, so an item nobody has drawn before comes out with the samples' discipline. The recipe stores the words, stamped with the laws, and re-derives the item on every read.",
  "when": "Reach for this on 'a fantasy sword / dagger / greatsword', 'a wizard's staff / a druid staff', 'an elven bow / a longbow', 'a shield with a gem / a heater shield / a round shield', 'fantasy weapons / gear / arms in <style>', 'make the gem bigger / more stylized / more anime', 'a warlock's staff', 'a weapon for my hero', 'a style guide for our weapons'."
}
---

Name the item and its direction; the laws do the rest. An equipment item is a workbench whose monomers are EXPANDED from a short `build` on every read: the stored recipe is about a hundred bytes, and one dial restyles it in place. Everything the workbench gives (the World, the studio shots, the closure audit, `.glb` / `.stl` / `.usdz` / `.scad`, the assembler) sees plain monomers.

## Spec

```
{ item: 'dagger' | 'sword' | 'greatsword' | 'staff' | 'bow' | 'shield',
  style?: 'historical' | 'elven' | 'dwarven' | 'brutal' | 'eastern' | 'anime-hero' | 'druid' | 'celestial' | { …a card },
  dials?: { stylize?: 0–1, mass?: 0.5–2, focus?, ornament?: 0–3 },
  parts?: { <slot>: <variant>, … },
  gem?:   '<gem>' | { gem, cut?: 'natural' | 'brilliant' | 'cabochon', glow?: 0–1 } | null,
  seed?:  <int>,
  units?: 'cm' (the default), title?, lathes? / sweeps? / … (your own parts beside the built item) }
```

Stored as `{ kind: 'workbench', build: { type: 'equipment', …, laws: 1 } }`. Edit it with a patch on `/build/…`:
`set /build/dials/stylize 0.9`, `set /build/style 'celestial'`, `set /build/parts/head 'claw'`, `set /build/gem 'ruby'`.

## The dials

- `stylize` — realism 0 → stylized 1. ONE proportion curve for the whole item, not a filter (below).
- `mass` — heft: 0.8 slender … 1 … 1.35 heavy.
- `focus` — the signature, where a stone goes: `guard` | `pommel` | `blade` (swords), `head` (staff), `riser` | `tips` | `curve` (bow), `boss` (shield), or `none`.
- `ornament` — 0–3, how many secondary accents the item is allowed.

## The laws (what the dials drive)

1. **Hierarchy.** One focal element; everything else is sized against it. **1b.** On a shield the stone is sized against the whole face (6 % of its diameter realistic → 34 % stylized), not a local boss.
2. **Stylization is a proportion law.** As `stylize` rises the focal grows fastest (a stone 0.85× its host → about 3×), the hilt grows for hand-scale readability, a blade widens and shortens, a bow's curve exaggerates, a long item compresses, and detail gets fewer and bigger (wrap turns, barbs, rays, twigs).
3. **The host frames the focal.** The part that carries a stone re-forms as its setting: a flush bezel below 0.25, then a boss, a cage sized to the stone, or a claw of prongs. The setting touches the stone. Wings and quillons root at it.
4. **Readability floor.** No feature thinner than a stylize-dependent fraction of the item's length: thin at 0, bolder at 1.
5. **Contrast spends on the focal.** Fittings recede toward neutral as stylization rises; the stone takes the glow.
6. **The focal sits where the eye already goes:** a staff's head, a bow's riser, a shield's boss. Leading lines (rays, bands, vines, feathers) run from the frame into it.
7. **Organic forms grow.** A branching head shares its shaft's cross-section among its limbs (r² = Σ rᵢ²), so twigs taper by construction; barked parts carry `bark: { species, tile }` with the tile scaled to the stem.

## Items and their slots (`parts`)

- **Swords** — `blade`: straight · broad · leaf · hero · flamberge · cleaver · sabre · tanto. `guard`: bar · crescent · block · spiked · disc · winged. `pommel`: wheel · block · spike · cap · ring · cage. `grip`: leather · banded · wire · cord.
- **Staff** — `head`: plain · branch · claw · crescent · block · mace · ringed. `shaftForm`: turned · gnarled. `bark`: oak · beech · pine · chestnut · spruce · silverfir · pineUpper. Branch heads take `limbs`, `twigs`, `leaves`; a crescent takes `wings: true`.
- **Bow** — `limb`: longbow · recurve · horn · yumi. `tips`: none · leaf · wing · spike · horn.
- **Shield** — `outline`: round · heater · kite. `device`: none · chevron · rays · bands · spikes · mon · wings · vine.

Gems: quartz, amethyst, calcite, diamond, ruby, sapphire, tourmaline, opal. A `natural` cut is the raw crystal (a druid's stone); a face-set stone reads best `cabochon` or `brilliant`.

## Samples, not a catalogue

The eight styles are cards (plain JSON: `dials`, `lean`, `language` per item, `edge`, `roles`, `gem`). A role is a shelf row `['<material>', '#hex']` or a metal surface `{ metal, finish?, film?, pattern? }` (the workbench card's metal-surface line): `{ metal: 'steel', film: { temper: 300 } }` is blued steel, `{ metal: 'bronze', film: { age: 40 } }` verdigris, `{ metal: 'steel', pattern: { kind: 'damascus', type: 'twist' } }` a pattern-welded blade (the eastern sample's). A blade's pattern with no `scale` is sized to the blade by the readability law. Copy one, change it, and pass it as `style` — a new direction is a new card, not code:

```
style: { id: 'frost', dials: { stylize: 0.6, mass: 0.9, focus: 'guard', ornament: 2 },
  language: { blade: 'leaf', guard: 'winged', pommel: 'cap', grip: 'wire',
    staff: { head: 'claw', focus: 'head', shaft: ['satin', '#dfe8ef'] } },
  edge: { fuller: 0.2, bevel: 0.5 },
  roles: { blade: ['silver', '#e6eef4'], fittings: ['silver', '#b8c6d2'], accent: ['silver', '#f2f6fa'], wrap: ['matte', '#2d4a66'] },
  gem: { gem: 'sapphire', cut: 'natural', glow: 0.5 } }
```

Fresh items need no card at all: `{ item: 'staff', style: 'brutal', parts: { head: 'claw', focus: 'head' }, gem: 'ruby', dials: { stylize: 0.75 } }` is a warlock's staff no sample defines.

## The readout

`stats.equipment` names the item, style, laws, resolved dials and variants, the **focal** (where, which stone, its size, its share of its host or face, flush or boss), the **sockets** a figure mounts gear by (`grip` with its axis, `tip`, `focal`, a bow's `nockTop` / `nockBottom`, a shield's back `grip`), the item's length and its readability floor.
