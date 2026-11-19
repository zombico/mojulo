### Realistic trees and the raised ground (era flora)

- **Grass:** a new trail scene's grass is gen-7's raised ground in both eras (`grass: { form: true }`), with dark
  strands in the far grass. Rows minted before it draw as they did.
- **Realistic trees (`crowns: 'realistic'`):** a tree drawn from its structure, for a scene that asks for it. Its limbs
  grow from its crown's masses back to a leader, in proportion to the tree (`form/tree-form.js` EVOKE). Structural
  branches are bare, and its leaf-holding twigs carry clouds of puffs (CLOUD). Far off it is a card baked full in
  pixels. It stays within the plain tree's triangles, and its lowest limb is 3 m up at least.
- **A habit per kind of tree** (`form/flora-read.js` REALISTIC_HABITS, a row a species): a single, Y (forked high)
  or V (forked low) trunk and its girth; its limbs' girth and climb; its twigs rising or drooping; its crown widened,
  narrowed or flattened; its clouds wide or tall, sitting on their twigs or hanging under them. Rows for the library's
  broadleaves, and three new kinds reached by a kind's `species` word (`REALISTIC_KINDS`: birch, poplar, acacia), with
  their scene-solver cards. Each holds to its plain tree's triangles, its smallest puffs given up first.
- **Realistic trees in gen-6 too:** a gen-6 trail's `crowns: 'realistic'` draws the trees the form render keeps
  (`realisticPlan`: the same species, places and heights), each painted from its template's own structure
  (`era/isekai.js` REAL_BANDS): the trees near the trail built whole, the rest stamped from a few turned variants, the far
  casting as their coarse selves. One stand of trees in both eras; a trail without the word draws as it did.
