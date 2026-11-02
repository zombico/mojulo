### Anime head casts: Shonen High the default, Z-Fighter and School-Kid Hero beside it

The anime head is sculpted as an action figure is: the relations between the face's structures tuned in clay, the head
first and the body after it. A style pole is a HEAD CAST, named for its figure's scale and theme, never for a kind of
game: every cast is lit the same way, so any game can field any of them. The eyes gate is the operator's.

- **Shonen High is the default head**: a minted adult on the anime head that wears its form (hero laws 19) and names no
  cast wears `shonen-high`, now described as high-school-sized and action-themed, stored as its word beside its stamp
  as any named cast is (no laws bump: the default is stored, never read at plan time, so rows minted before it keep no
  cast). `animeStyle: null` is the form's bare head; a child, a chibi and the studio's face (`sculpt: false`) wear none.
  A remade hero (a game's book hero, its cast) keeps the cast it was stored with unless its order names one, and one
  stored without a cast stays without.
- **Z-Fighter** (`z-fighter`, grown-hero-sized and martial-arts-themed, after a Goku maquette): a broad head square at
  the jaw, its corner level with the mouth, running in to a narrow chin set forward; flat cheeks under the cheekbones; a
  heavy brow ridge; wide, low eyes under a heavy straight lid angled to the nose, small irises; thick brows set low and
  angled hard to the bridge; a wide mouth; on a heavy frame, the neck short and thick. Her head is the male's, as Shonen
  High's female's is (after an Android 18 maquette): almond eyes under a level lid, thin straight brows, her face one
  convex arc from under the ear to a narrow chin, a small mouth, on an athletic frame.
- **School-Kid Hero** (`school-kid-hero`, schoolkid-sized and action-themed, after a Kishimoto-baseline genin figure): a
  big round head and a moon face, round from its outline (the head wider, the jaw broad, its corner high) to a short
  lower face and a small pointed chin, with no pouch on the lower cheek (the first cut's chipmunking; the lower cheek a little slimmer than the base's) and less bevel than
  its siblings (no squared jaw line, the jaw not curved in, shallower socket planes); large, tall eyes
  under a crisp lid lifted to its tail, large irises; thin brows; a small nose; on a short, slight frame. Its bands put
  the eye level, the nose tip and the lip line lower on the head, as a child's are. Her head is the male's, as Shonen
  High's female's is, her brow broader, her eyes and irises a little larger, her jaw and chin smaller.
- **Every cast held the day it lands** (`anime-styles.deep.test.js`): each cast's default advised nothing on either base
  by its own bands, and every word it sets inside the studio's ranges; the brow-over-the-eye sweep already reads every
  cast.
- **Clay** on hero-live: a viewer toggle (and a shot's `clay: true`) that shows the form alone in one warm grey under the
  same light, as a maquette is read before it is painted; it casts no shadow on itself there (the key's shadow map laid
  a straight edge across every face that read as a crease). The two new casts were tuned over three rounds in clay; the
  eyes gate is the operator's.
- **No chipmunking on any cast** (after Shonen High's female, whose fuller lower cheeks read as chipmunk cheeks at
  three-quarter and were taken back in): a round cheek comes from the face's outline, never from a pouch beside the
  mouth: the jaw fuller along its edge and narrowing into a narrow chin, the lower cheek at or below its base's, the
  cheekbone near its base's. Z-Fighter's female, whose base's full lower cheek bulged beside her mouth, and School-Kid
  Hero's pair take it.
- **School-Kid Hero, a soft ellipse**: the face a little narrower and longer than the moon of the round before, leaning
  toward Shonen High's but not as angular (the jaw's line two thirds squared, its corner less high), and the mouth
  smaller; then rounded back out a little (halfway to the moon) and the nose made less pointed (lower in projection,
  its tip less far out).
- **The jaw closed up into the skull** on every cast but Shonen High's female, who already had it: in profile the
  underside rises from the chin to the jaw's corner and then turns up behind the ear into the skull, with no jaw hanging
  under the skull's back and no groove where the two meet (measured as the head's underside, chin to the back of the
  skull: the turn up at the corner within a share of hers). School-Kid Hero takes Shonen High's words for it (`jawLine`,
  `napeLift`); Z-Fighter's female moves onto the male's head, since her own base's back stopped short of it whatever
  its words. Shonen High's and Z-Fighter's males already closed by that measure and are left as they were.
- **Z-Fighter's female set apart from Shonen High's** (on the same male head, she read as Shonen High's female's
  cousin): shorter and wider where hers is long, a broader, rounded chin where hers is a sharp V, larger eyes set wider
  on the true almond shape (not the male head's flat top), long thin brows a little arched, a tiny nose and a small
  mouth; one soft oval from under the ear to the chin, the jaw's corner low. The cheek stays one arc and the jaw stays
  closed into the skull.
- **A cast's core in its own canon** (`coreBands` on a cast's pole, `hero-core-measures.js` `coreAdvice(m, body,
  bands)`): the body's core advice reads a cast's own bands in place of the body's, as its feature advice does.
  Shonen High's figures (merged from the expressiveness branch: an athletic male, a long-legged female) carry waists
  narrower for the hips than the realistic bands, and as the default anime head every minted anime hero was advised
  against them; their own bands admit them.
- **The anime form's body** (`anime-looks.js` `ANIME_FORM_BODY`, hero laws 20): the body work first done on Shonen High's
  pair (merged from the expressiveness branch) is every anime adult's now, as the head wears its form: the body rounded
  (its skin split once on the curved patch, `body-smooth.js`) and, as the rounded body asks, the rib cage narrower under
  the shoulders (its sides falling nearly straight from the armpit) and the male's pectoral layer gone (rounded, it read
  as an imprint). A cast's own `smooth` and `chest` go over it (Shonen High's female keeps her smaller bust on it), and
  its proportions stay its own; a child or a chibi keeps its build's body, and a row stamped before laws 20 the body it
  had. Z-Fighter's and School-Kid Hero's pairs wear it with no words of their own: Z-Fighter's male reads a V under his
  broad shoulders with the pectoral imprint gone.
  What rides with it: the lowpoly register keeps its flat facets (no rounding); a garment over the rounded body eases out
  by the rounding (`outfit-plan.js` `ROUND_EASE`), so a cloak no longer grazes the fuller flank; the hero's mesh budget
  (`hero-budget.test.js`) grows to the rounded body's 34k triangles and 17.5k vertices; a hand in its pocket rests its
  wrist and forearm against the hip it hangs by (`hero-aura.js` `POCKET`), so Jotaro's pocketed hand is read against the
  fuller flank as a hand at rest, not one inside the body.
