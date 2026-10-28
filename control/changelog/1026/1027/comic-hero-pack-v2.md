### Comic hero pack v2: a tightening pass

Every cast member was minted through the hero door in every costume era on the tiered body, and in two eras on the
realistic body. What the door read back (its warnings, the dress read's verdicts, unworn pieces and clearance) set
these fixes. The eyes gate is the operator's.

- **The cast is mixed at every seed.** The egocube rolls an unnamed pole from the seed alone, so one seed made the whole
  cast one sex: at the default seed every member rolled female, the mastermind included. Each member now names its
  `pole` (`cast.js`). `rollMember` and `memberOrders` take `pole` to name another.
- **The hair's wave only where it takes.** The egocube's hero plan wrote `wave` on every landmark hair, and the door
  warned that it did nothing on a crop, a bun, a bob or the long fall (`egocube/plan.js`). A free fall with a wave in it
  is now the `wavy` fall, and the wave is written only on a style whose controls take it.
- **The rival's guard** sank its rear forearm 9.5 mm into the torso on the heroic build. The rival stands
  `['guard', { elbowR: 130 }]`, which mints clean on the tiered body and the realistic one.
- **The Silver Age cape hangs to the ankle.** At the calf, and at the shin just under it, its hem ended on the calf's
  widest point, which the outline reader flags (`suits.js` CAPE, the era's principle reworded to match).
- **The Movie Hero's pouches ring the waist on the tiered body.** The street and thug fatigues' hip pair sat inside the
  thighs: it did not read (exposed 0.08), and every point sank at stance. They are a four-pouch utility belt at the
  waist, which reads (`costumes.js` UTILITY).
- **A belt the realistic tailor wears is worn in the read.** `dressReadout` listed a belt as `unworn` when the tailor had
  made it as cloth (`<id>_<part>`, `body-relational-wear.js` belts), as on the classic and street suits on the realistic
  body. The read now counts it worn. The armour's replaced pieces stay unworn.
- Found and not fixed, since they are kernel fits rather than the pack's words, each its own step:
  - On the male canonical build, the armored-hero hardsuit's rerebraces sink into the torso at rest (13 %), and its
    gorget sinks into the jaw. `collar: 'none'` clears the jaw; no word clears the rerebraces.
  - The hardsuit's quiet studs never read (share 0), at any `ornament`.
  - The realistic body's stands sink where the tiered body's do not: the hero's hand-on-hip 11 mm, the brute's guard
    6 mm.
  - On a lithe build, the waist belt meets the hanging upper arms at rest.
