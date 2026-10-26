/**
 * seats-kernel — who is playing: each SEAT a player position bound to ONE controller (docs/local-multiplayer-principles.md).
 *
 * SINGLE SOURCE OF TRUTH, the controls kernel's discipline (controls-kernel.js): everything lives inside
 * `buildSeatsKernel()`, a closure that references nothing outside itself, so a page runs the same code by emitting
 * `buildSeatsKernel.toString()`. Node imports the live instance for tests. The kernel never touches a device: the page's
 * driver hands it, each frame, what every controller it can see did.
 *
 * A CONTROLLER is named by a string: 'keyboard' (the keyboard with its mouse; a browser cannot tell two keyboards apart,
 * so it is one controller however many are plugged in), 'pad:<Gamepad.index>' (a pad, by the index the browser keeps for
 * it while it stays plugged in), 'touch' (the screen's virtual pad). No seat is a share of a controller.
 *
 *   newSeats({ max?, join? })  → S  { max (1–4, default 2), join: 'drop-in' | 'lobby', open, seats: [] }
 *   step(S, frame)             → S' (S untouched). frame = { [controller]: { connected?, join?, leave? } }: each
 *                                controller the page sees this frame; `join` / `leave` the press that asks for a seat or
 *                                gives one up, `connected` false for a pad the browser has lost. A controller seats once,
 *                                in the lowest free seat, while a seat is free (and, joining by `lobby`, while S.open). A
 *                                seated pad that is lost keeps its seat, away, until the same pad is back; a leave frees
 *                                the seat, and its number goes to whoever joins next. Seat numbers never move.
 *   seatOf(S, controller)      → its seat, or null
 *   seat(S, n)                 → seat n (1-based), or null
 *   present(S)                 → the seats whose controller is here, in seat order
 *   joined(S, S0)              → the seats S has that S0 did not (this frame's joins)
 *   setOpen(S, open)           → S' (a lobby closes when the game starts and opens at its end)
 *   SEAT_COLORS, SEAT_LABELS   → the four-port convention: P1 red, P2 blue, P3 yellow, P4 green
 *
 *   a seat: { n, label, color, controller, away }
 */

export function buildSeatsKernel() {
  const SEAT_COLORS = ['#e5483b', '#3b7be5', '#f2c230', '#36b04c'];
  const SEAT_LABELS = ['P1', 'P2', 'P3', 'P4'];
  const JOINS = ['drop-in', 'lobby'];

  function newSeats(opts) {
    const o = opts || {};
    const max = o.max === undefined ? 2 : o.max;
    if (!(Number.isInteger(max) && max >= 1 && max <= 4)) throw new Error('seats: max is 1 to 4 seats');
    const join = o.join || 'drop-in';
    if (JOINS.indexOf(join) < 0) throw new Error('seats: join is ' + JOINS.join(' or '));
    return { max, join, open: true, seats: [] };
  }

  const copy = (S) => ({ max: S.max, join: S.join, open: S.open, seats: S.seats.map((x) => ({ n: x.n, label: x.label, color: x.color, controller: x.controller, away: x.away })) });
  const seatOf = (S, c) => { for (let i = 0; i < S.seats.length; i++) if (S.seats[i].controller === c) return S.seats[i]; return null; };
  const seat = (S, n) => { for (let i = 0; i < S.seats.length; i++) if (S.seats[i].n === n) return S.seats[i]; return null; };
  const freeSeat = (S) => { for (let n = 1; n <= S.max; n++) if (!seat(S, n)) return n; return 0; };

  function step(S, frame) {
    const out = copy(S), f = frame || {};
    // the seated first: a leave frees the seat; a lost pad is away until it is back
    for (const x of out.seats.slice()) {
      const c = f[x.controller];
      if (c && c.leave) { out.seats = out.seats.filter((y) => y !== x); continue; }
      x.away = !!c && c.connected === false ? true : (c ? false : x.away);
    }
    // then the joins, in the frame's own order (the page lists controllers as it sees them)
    for (const id of Object.keys(f)) {
      const c = f[id];
      if (!c.join || c.connected === false || seatOf(out, id)) continue;
      if (out.join === 'lobby' && !out.open) continue;
      const n = freeSeat(out);
      if (!n) continue;
      out.seats.push({ n, label: SEAT_LABELS[n - 1], color: SEAT_COLORS[n - 1], controller: id, away: false });
    }
    out.seats.sort((a, b) => a.n - b.n);
    return out;
  }

  const present = (S) => S.seats.filter((x) => !x.away);
  const joined = (S, S0) => S.seats.filter((x) => !seatOf(S0, x.controller));
  const setOpen = (S, open) => { const out = copy(S); out.open = !!open; return out; };

  return { newSeats, step, seatOf, seat, present, joined, setOpen, SEAT_COLORS, SEAT_LABELS };
}

export const SEATS = buildSeatsKernel();
