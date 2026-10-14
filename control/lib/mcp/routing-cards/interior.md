---
{
  "id": "interior",
  "name": "Decorate, furnish or restyle a room of a house",
  "summary": "The interior designer: one room of a house fitted out as its own design. The room's jobs solved into furniture at true size, a named decorator's style, clearances kept, walls and floor dressed; the house is read, never written; pieces revised by id.",
  "when": "\"make my living room Japandi\", \"furnish the bedroom in this house\", \"where should the sofa go\", \"a reading corner by the window\", \"try it in mid-century and in coastal\", \"a 14 by 18 lounge with a window on the south, decorated\", \"swap the coffee table for a bigger one\", \"put a fireplace on the north wall\"",
  "entry": "design_interior",
  "form": "building"
}
---
→ `design_interior({ title, house: 'sk_…', room: 'lounge', style: 'japandi' })` fits out a room of a house row (`mint_building` makes the house; the room is its tag, name or glyph). A room from scratch is still floor plan first: `section: { room: 'living', size: ['14ft', '18ft'], windows: ['S'], doors: [{ wall: 'W', to: 'hall' }] }` drafts and mints its house, then decorates it. The reply names every piece by id (`conversation.sofa`), what was refused and why, and the review. Revise in place: `design_interior({ ref, style | brief | surface | pieces: [{ id, size, at, like, omit }] })`. Manual: `get_sketch_vocab({ id: 'interior' })`; floors, papers and doors: `({ id: 'house-finishes' })`. (Contrast: a whole house, its plan, frame or drawings → `mint_building`; one loose piece of furniture as an object → `mint_solid` kind `furniture`.) Full family → `get_creative_toolset({ form: 'building' })`.
