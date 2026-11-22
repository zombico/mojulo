### The open city's street: health, wasted, and passers-by who react

- **The street's health** (`game/vitals-mechanics.js`, the `vitals` mechanic, laid on a played city where something can
  hurt the player: its law, a faction's fight): each blow costs health, a few quiet seconds mend it, and at none the
  player is **wasted**: out of any car, a hospital bill paid when they hold the coin, set down at the start, whole again.
  The law lets a wasted player go; a faction's fight leans on the street's health (`fight.wasted`) and is lost with it.
- **A police car's hold is no wound**: boxed in by one, the player is held (`held:<player>`, counted toward the bust),
  not hurt.
- **Passers-by who react** (the walkers channel's `react`, a played district's people): trouble near (a blow, a fall,
  mayhem, a fight begun, a car bearing down) sends them running away along their own walk; struck by the player or run
  down by a car they fall, lie a while, then get up and run. Downing one is mayhem (`mayhem:assault`,
  `mayhem:runover`): a star from the law.
