// Shared Workshop navigation model — the single source of truth for the three
// modes (Studio / Ideate / Operate) and their destinations. Rendered two ways:
// the home directory (WorkshopHome.jsx) and the global slide-out (WorkshopDrawer.jsx).
// Each tile carries an i18n `key` (resolved as home.groups.<key> / home.tiles.<key>),
// an href, and the NAME of its icon in DOOR_ICONS (see that registry for why a
// name and not the component).
//
// STUDIO LEADS. Mojulo is a 3D factory; the making surface is the product, so it is
// listed first, opened by default, and never gated — an empty studio is an
// invitation, not clutter.
//
// The OPERATIONAL destinations are the opposite: a bots tile on a host with no bots
// is noise. Those tiles declare a `presence` key and appear only once that key has
// records (counts from /api/workshop/presence); a group whose every tile is gated
// away disappears with them. Diagrams live in Studio, not Operate, because
// `mint_diagram` is a kernel capability that is always present — it must not vanish
// with the operational group.

// --- Tile icons ---

export function BotIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 4v4" />
      <path d="M15 4v4" />
      <circle cx="9.5" cy="13" r="0.75" fill="currentColor" />
      <circle cx="14.5" cy="13" r="0.75" fill="currentColor" />
      <path d="M9.5 16.5h5" />
    </svg>
  );
}

export function ConnectedServicesIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="4" cy="6" r="1.75" />
      <circle cx="20" cy="6" r="1.75" />
      <circle cx="4" cy="18" r="1.75" />
      <circle cx="20" cy="18" r="1.75" />
      <path d="M10.2 10.4l-4.6-3.2" />
      <path d="M13.8 10.4l4.6-3.2" />
      <path d="M10.2 13.6l-4.6 3.2" />
      <path d="M13.8 13.6l4.6 3.2" />
    </svg>
  );
}

export function AppsGridIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function LibraryIcon({ className = 'h-10 w-10' }) {
  // Asset shelf: a cube and a sphere standing on a rule — models on a shelf,
  // which is what the Library now is (scenes, models, characters, materials,
  // images, diagrams behind one door).
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 19h18" />
      <path d="M7 9 L10.5 7 L14 9 L10.5 11 Z" />
      <path d="M7 9 V14 L10.5 16 V11 Z" />
      <path d="M14 9 V14 L10.5 16 V11 Z" />
      <circle cx="17.5" cy="13.5" r="3" strokeWidth="0.9" />
    </svg>
  );
}

export function MakerIcon({ className = 'h-10 w-10' }) {
  // Illustrations = a framed landscape (low sun + a range of hills).
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" strokeWidth="0.9" />
      <path d="M3.5 16.5 L8 11.5 L11.5 14.5 L15.5 9.5 L20.5 16.5" strokeWidth="0.9" />
    </svg>
  );
}

export function PlanIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14.5h7" />
      <path d="M8.5 18h4" />
    </svg>
  );
}

export function NotebookIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 6c-1.8-1.2-4-1.8-6.5-1.8-.8 0-1.5.6-1.5 1.4v11c0 .8.7 1.3 1.5 1.3 2.5 0 4.7.6 6.5 1.8" />
      <path d="M12 6c1.8-1.2 4-1.8 6.5-1.8.8 0 1.5.6 1.5 1.4v11c0 .8-.7 1.3-1.5 1.3-2.5 0-4.7.6-6.5 1.8" />
      <path d="M12 6v13.7" />
      <path d="M6.5 9h3" />
      <path d="M6.5 12h3" />
      <path d="M14.5 9h3" />
      <path d="M14.5 12h3" />
    </svg>
  );
}

export function StashIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 14h4l1.5 2h5L16 14h4v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M7 10h10" strokeWidth="0.9" />
      <path d="M6 6h12" strokeWidth="0.9" />
    </svg>
  );
}

export function CookIcon({ className = 'h-10 w-10' }) {
  // Outputs = a materialized publication (page with a folded corner).
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M15 3v4h4" strokeWidth="0.9" />
      <path d="M8 12h8" strokeWidth="0.9" />
      <path d="M8 15h8" strokeWidth="0.9" />
      <path d="M8 18h5" strokeWidth="0.9" />
    </svg>
  );
}

export function RenderBayIcon({ className = 'h-10 w-10' }) {
  // Render Bay = a queue moving through a gate: three stacked jobs feeding one
  // output, with the gate drawn as the notch they pass through.
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h7" />
      <path d="M3 12h7" />
      <path d="M3 18h7" />
      <path d="M13 4v16" strokeWidth="0.9" />
      <path d="M10 6h3M10 12h3M10 18h3" strokeWidth="0.9" />
      <path d="M13 12h3" />
      <path d="M16 8h5v8h-5z" />
    </svg>
  );
}

export function MapIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  );
}

export function WorldIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.5 2.6 15 0 18" />
      <path d="M12 3c-2.6 2.5-2.6 15 0 18" />
    </svg>
  );
}

export function ObjectsIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2.5 21 7.5v9l-9 5-9-5v-9l9-5z" />
      <path d="M3 7.5l9 5 9-5" />
      <path d="M12 12.5v9" />
    </svg>
  );
}

export function MotionIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 17c5 0 6-10 11-10 3 0 4 2 7 2" />
      <circle cx="4" cy="17" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BeatsIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 9v6" />
      <path d="M10 6v12" />
      <path d="M14 8v8" />
      <path d="M18 10v4" />
    </svg>
  );
}

export function VoiceIcon({ className = 'h-10 w-10' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function GameDevIcon({ className = 'h-10 w-10' }) {
  // A gamepad under construction: d-pad + buttons over a workbench line.
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="7" width="18" height="10" rx="4" />
      <path d="M8 10v4M6 12h4" />
      <circle cx="16" cy="11" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArcadeIcon({ className = 'h-10 w-10' }) {
  // A cabinet joystick: ball on a stick over the button deck.
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="5" r="2" />
      <path d="M9 7v7" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <circle cx="15" cy="17" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="18" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FloorIcon({ className = 'h-10 w-10' }) {
  // The splayed floor: shelf strips receding on a floor plane — the dashboard's
  // own shape, so the row that opens it is drawn as the thing it opens.
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 5h18" />
      <path d="M4 9.5h16" />
      <path d="M5 14h14" />
      <path d="M6 18.5h12" />
    </svg>
  );
}

// --- Mode (group) icons ---

export function IdeateIcon({ className = 'h-12 w-12' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export function OperateIcon({ className = 'h-12 w-12' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 18l3.5-4.5" />
      <circle cx="12" cy="18" r="1.1" fill="currentColor" />
      <path d="M4 18h1" />
      <path d="M19 18h1" />
      <path d="M6 11l.7.7" />
      <path d="M18 11l-.7.7" />
    </svg>
  );
}

export function StudioIcon({ className = 'h-12 w-12' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.9 1.6-1.7 0-.9-.7-1.4-.7-2.1 0-.7.6-1.2 1.4-1.2H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Brand mark (three-card stack). idPrefix keeps the gradient ids unique when the
// mark is rendered more than once on a page (e.g. launcher + open drawer).
export function BrandMark({ className = 'w-8 h-8', idPrefix = 'wsnav' }) {
  const back = `${idPrefix}-back`;
  const mid = `${idPrefix}-mid`;
  const front = `${idPrefix}-front`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="160 115 70 70" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={back} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d6f68" />
          <stop offset="0.55" stopColor="#134e4a" />
          <stop offset="1" stopColor="#0a2a28" />
        </linearGradient>
        <linearGradient id={mid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7af0dc" />
          <stop offset="0.5" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#138a78" />
        </linearGradient>
        <linearGradient id={front} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9f5e8" />
          <stop offset="0.5" stopColor="#5eead4" />
          <stop offset="1" stopColor="#26b8a0" />
        </linearGradient>
      </defs>
      <rect x="-9.25" y="-19.55" width="11" height="40" rx="7.75" fill={`url(#${back})`} transform="translate(183.8, 150) rotate(17)" />
      <rect x="-6.45" y="-21.55" width="11" height="40" rx="7.75" fill={`url(#${mid})`} transform="translate(191, 150) rotate(340)" />
      <rect x="-6.00" y="-21.55" width="11" height="40" rx="7.75" fill={`url(#${front})`} transform="translate(206.3, 150) rotate(340)" />
    </svg>
  );
}

/**
 * The door icons by name. A tile NAMES its icon rather than holding the
 * component, because a door is drawn two ways: as a dot-relief lattice on the
 * home grid (baked per name by scripts/build-brand-icons.mjs) and as a line
 * icon in dense chrome. A name is the only thing both readings can share — and
 * carrying the name AND the component would be two fields free to drift.
 *
 * Group icons are NOT here: a mode header is drawn one way only, so it holds
 * its component directly.
 */
export const DOOR_ICONS = {
  AppsGridIcon,
  ArcadeIcon,
  BeatsIcon,
  BotIcon,
  ConnectedServicesIcon,
  CookIcon,
  FloorIcon,
  GameDevIcon,
  LibraryIcon,
  MotionIcon,
  NotebookIcon,
  PlanIcon,
  RenderBayIcon,
  StashIcon,
  VoiceIcon,
};

// The three modes. Settings is not here — it lives in the top nav (AuthNav) as
// host chrome. See docs: Studio deep-links to the /maker/* routes (the "Maker"
// wordmark is retired).
// Each mode's signature hue, as CSS var references (defined in globals.css).
// Components spread hueVars(group.hue) into an element's style so the shared
// .ws-* classes resolve --h / --h-strong / --h-idle to the mode color.
export function hueVars(hue) {
  return { '--h': hue.base, '--h-strong': hue.strong, '--h-idle': hue.idle };
}

export const WORKSHOP_GROUPS = [
  {
    key: 'studio',
    Icon: StudioIcon,
    hue: { base: 'var(--mode-studio)', strong: 'var(--mode-studio-strong)', idle: 'var(--mode-studio-idle)' },
    tiles: [
      // One Library door replaces the four bucket rails (Sketches / Illustrations
      // / Worlds / Objects). The vocabulary they carried did not vanish — it is
      // the chip row inside, where it costs no navigation. See
      // components/3d-factory-ui.plan.md §2.
      { key: 'library', href: '/library', icon: 'LibraryIcon' },
      { key: 'motion', href: '/maker/motion', icon: 'MotionIcon' },
      { key: 'beats', href: '/maker/beats', icon: 'BeatsIcon' },
      { key: 'voice', href: '/maker/voice', icon: 'VoiceIcon' },
      { key: 'games', href: '/maker/games', icon: 'GameDevIcon' },
      { key: 'arcade', href: '/arcade', icon: 'ArcadeIcon' },
      // The Render Bay watches production; /outputs stays the publication inbox
      // it has always been (its filters and its archive action are real, and the
      // bay does not mutate). The bay links into it rather than folding it. See
      // components/3d-factory-ui.plan.md §8 phase 5.
      { key: 'renderBay', href: '/render-bay', icon: 'RenderBayIcon' },
      { key: 'outputs', href: '/outputs', icon: 'CookIcon' },
    ],
  },
  {
    key: 'ideate',
    Icon: IdeateIcon,
    hue: { base: 'var(--mode-ideate)', strong: 'var(--mode-ideate-strong)', idle: 'var(--mode-ideate-idle)' },
    tiles: [
      { key: 'research', href: '/research', icon: 'NotebookIcon' },
      { key: 'plan', href: '/plan', icon: 'PlanIcon' },
      { key: 'stash', href: '/stashes', icon: 'StashIcon' },
    ],
  },
  {
    key: 'operate',
    Icon: OperateIcon,
    hue: { base: 'var(--mode-operate)', strong: 'var(--mode-operate-strong)', idle: 'var(--mode-operate-idle)' },
    tiles: [
      { key: 'bots', href: '/bots', icon: 'BotIcon', presence: 'bots' },
      { key: 'mcpSkills', href: '/mcp-skills', icon: 'ConnectedServicesIcon', presence: 'services' },
      { key: 'apps', href: '/apps', icon: 'AppsGridIcon', presence: 'apps' },
    ],
  },
];

/**
 * The nav for a given presence snapshot. A tile with no `presence` key is
 * unconditional; a gated tile needs a positive count. `presence` undefined means
 * "not loaded yet" and hides every gated tile — the bias is deliberate, so a host
 * with no operational records never flashes tiles it will not keep.
 */
export function visibleWorkshopGroups(presence) {
  return WORKSHOP_GROUPS
    .map((group) => ({
      ...group,
      tiles: group.tiles.filter((tile) => !tile.presence || (presence?.[tile.presence] || 0) > 0),
    }))
    .filter((group) => group.tiles.length > 0);
}
