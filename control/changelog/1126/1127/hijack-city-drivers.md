### Hijack City drivers: a taken car's driver gets out, hands up or fists up

- **A taken car's driver gets out.** Stop a car in Hijack City's traffic and take it, and whoever was driving it climbs
  out of the open door. With your gun out they come out with their hands up and their head down, stand a moment, and
  run off while you get in. With no gun out they come out fighting: you don't get in until they're down (or you leave
  them behind), and then the car is yours. A parked car has nobody in it.
- **The police only see what happens near them.** Two patrol cars now cruise the district's streets in the traffic,
  light bars and all. A carjack within about 40 m of one, or of an officer or a patrol car already out, raises the
  wanted level as before; anywhere else you get away with it.
- Under the hood: `worlds/controllable/drivers.js` (an opt-in runtime piece, after the mount), the law's `drivers`
  (a pool of people of the city, asleep until a car is taken), a `surrender` pose layer, a geocity's `beat` (patrols
  among the traffic) and the cab pool's witness (`carjackSeen`).
