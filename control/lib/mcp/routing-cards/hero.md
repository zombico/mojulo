---
{
  "id": "hero",
  "name": "Create a hero (a human character as a rigged mesh: low-poly, boxy or round, with a face and hair)",
  "summary": "A human character as a layered solid on the vajra rest skeleton: rings along the figure's joints in one art-style register, a palette by group, a head whose face and hair are data on the detail core, a rig with idle / walk / wave. Silhouette, colour, face, hair — adornments come later.",
  "when": "\"a hero for my game\", \"a low-poly / pixel / boxy person I can rig\", \"a stylised human character as a mesh, not a picture\", \"a character with a face and a hairstyle I can keep editing\", \"a chibi / heroic / stout version of the same character\", \"a person that plays a walk cycle and exports skinned\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'layered', via: 'plan', spec: { plan } })`; the loop is the `create-hero` catalyst (silhouette → colour → face → hair → lock, one `style` register for every ring). The form is `docs/examples/ring-plans/hero.plan.json` (`heroPlan({ cast, register, head })`: joints from a figure cast word, rings along them, `idle` / `walk` / `wave`); the head is `docs/examples/hero-head/` (`bakeHero({ hair })`, an include with a hinged jaw). Read the manual first via `get_solid_vocab({ id: 'layered' })`. Iterate in place (`update_sketch` patching `/plan/...` or `/dials/<name>`), never re-mint. A person as an SVG turnaround, a walker for pose work, or a garment study is kind `figure` (card `human-figure`); a creature is card `creature`; a real animal is kind `animal`. Full family → `get_creative_toolset({ form: 'object' })`.
