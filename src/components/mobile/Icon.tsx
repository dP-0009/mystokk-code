import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from './theme';

/**
 * The prototype's icon set, transcribed path-for-path from `ic()` in
 * design/mystokk-final.html. Stroke-based, 24x24 viewBox, 2px stroke, round
 * caps/joins — matching the prototype exactly.
 *
 * `share` is the classic share-nodes glyph (three circles + connecting lines),
 * which per CLAUDE.md rule 5 is the ONLY share affordance in the mobile UI.
 * There is no "forward" icon and no "Forward" label anywhere.
 */
export type IconName =
  | 'home' | 'box' | 'inbox' | 'cal' | 'net'
  | 'back' | 'chev' | 'down' | 'up' | 'open'
  | 'search' | 'plus' | 'check' | 'bell' | 'share'
  | 'copy' | 'wa' | 'mail' | 'phone' | 'eye'
  | 'edit' | 'trash' | 'lock' | 'camera' | 'doc'
  | 'user' | 'gear' | 'help' | 'off' | 'clock'
  | 'hand' | 'bulk' | 'loc' | 'shield' | 'import'
  | 'filter' | 'dots';

const PATHS: Record<Exclude<IconName, 'dots'>, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5'],
  box: ['M21 8 12 3 3 8v8l9 5 9-5Z', 'M3 8l9 5 9-5M12 13v8'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z'],
  cal: ['M8 3v4M16 3v4M3 10h18', 'm9.5 15 2 2 3.5-3.5'],
  net: [
    'M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5',
    'M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.7c2.4.6 4 2.3 4 5.3',
  ],
  back: ['M15 5l-7 7 7 7'],
  chev: ['m9 5 7 7-7 7'],
  down: ['m6 9 6 6 6-6'],
  // Not in the prototype's map — `reserve` calls ic('up') and gets nothing.
  // Added as the mirror of `down` so the Sent/Received segment renders.
  up: ['m6 15 6-6 6 6'],
  open: ['M7 17 17 7', 'M9 7h8v8'],
  search: ['m20 20-3.5-3.5'],
  plus: ['M12 5v14M5 12h14'],
  check: ['m4 12.5 5 5L20 7'],
  bell: ['M18 9a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8', 'M10 21h4'],
  share: ['m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3'],
  copy: ['M5 15V5a2 2 0 0 1 2-2h10'],
  wa: ['M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5Z'],
  mail: ['m3 7 9 6 9-6'],
  phone: ['M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z'],
  edit: ['M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17Z', 'm13.5 6.5 3 3'],
  trash: ['M4 7h16M10 11v6M14 11v6', 'M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4h6v3'],
  lock: ['M8 10V7a4 4 0 0 1 8 0v3'],
  camera: ['M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z'],
  doc: ['M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M14 3v6h6'],
  user: ['M4 21c0-4 3.5-6.5 8-6.5S20 17 20 21'],
  // Settings cog (the old path was a brightness/sun glyph). Feather-style, paired
  // with the r=3 centre circle below.
  gear: [
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  help: ['M9.5 9a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1-1.3 1.9'],
  off: ['M8 12h8'],
  clock: ['M12 7v5l3 2'],
  hand: [
    'M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V6a1.5 1.5 0 0 1 3 0v6',
    'M16 12c2 0 3 1 3 3 0 3.5-2.5 6-6.5 6-3 0-4.6-1.3-6-3.5L4.3 14a1.4 1.4 0 0 1 2.3-1.6L8 14V7',
  ],
  bulk: ['M12 3v12', 'm7 8 5-5 5 5', 'M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4'],
  loc: ['M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z'],
  shield: ['M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6Z', 'm9 12 2 2 4-4'],
  import: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'],
  filter: ['M4 5h16l-6.3 7.4v5.4l-3.4-2v-3.4Z'],
};

/** Glyphs whose prototype markup includes circles alongside the paths. */
const CIRCLES: Partial<Record<IconName, Array<{ cx: number; cy: number; r: number; fill?: boolean }>>> = {
  net: [{ cx: 9, cy: 8, r: 3.5 }],
  search: [{ cx: 11, cy: 11, r: 7 }],
  share: [
    { cx: 18, cy: 5, r: 2.6 },
    { cx: 6, cy: 12, r: 2.6 },
    { cx: 18, cy: 19, r: 2.6 },
  ],
  eye: [{ cx: 12, cy: 12, r: 3 }],
  camera: [{ cx: 12, cy: 14, r: 4 }],
  user: [{ cx: 12, cy: 8, r: 4 }],
  gear: [{ cx: 12, cy: 12, r: 3 }],
  help: [{ cx: 12, cy: 12, r: 9 }, { cx: 12, cy: 17, r: 0.5, fill: true }],
  off: [{ cx: 12, cy: 12, r: 9 }],
  clock: [{ cx: 12, cy: 12, r: 9 }],
  loc: [{ cx: 12, cy: 10, r: 2.6 }],
  dots: [
    { cx: 5, cy: 12, r: 1.8, fill: true },
    { cx: 12, cy: 12, r: 1.8, fill: true },
    { cx: 19, cy: 12, r: 1.8, fill: true },
  ],
};

/** Glyphs drawn with a <rect> in the prototype, expressed here as a path. */
const RECTS: Partial<Record<IconName, string>> = {
  cal: 'M5.5 5h13a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5Z',
  copy: 'M11.5 9h7a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 9 18.5v-7A2.5 2.5 0 0 1 11.5 9Z',
  mail: 'M5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5Z',
  lock: 'M6.5 10h11a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-6A2.5 2.5 0 0 1 6.5 10Z',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = colors.navy }: IconProps): React.JSX.Element {
  const paths = name === 'dots' ? [] : PATHS[name];
  const rect = RECTS[name];
  const circles = CIRCLES[name] ?? [];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {rect ? <Path d={rect} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {paths.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {circles.map((c) => (
        <Circle
          key={`${c.cx}-${c.cy}-${c.r}`}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={c.fill ? color : 'none'}
          stroke={c.fill ? 'none' : color}
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
}

/**
 * The official WhatsApp mark, from the prototype's waLogo().
 *
 *   'color' — full-colour (#25D366 bubble + white handset). Use on LIGHT
 *             surfaces, e.g. the contact circle on Received detail.
 *   'glyph' — white stroke outline. Use on the SOLID GREEN button, where the
 *             full-colour bubble would disappear into the background.
 */
export function WhatsAppLogo({
  size = 24,
  variant = 'color',
}: {
  size?: number;
  variant?: 'color' | 'glyph';
}): React.JSX.Element {
  if (variant === 'glyph') {
    return <Icon name="wa" size={size} color="#FFFFFF" />;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        fill="#25D366"
        d="M16 3A13 13 0 0 0 4.8 22.6L3.2 28.8l6.4-1.7A13 13 0 1 0 16 3Z"
      />
      <Path
        fill="#fff"
        d="M22.3 19.4c-.3.9-1.7 1.7-2.4 1.8-.6.1-1.4.1-2.2-.1-.5-.2-1.2-.4-2-.8-3.6-1.6-5.9-5.2-6.1-5.5-.2-.2-1.5-1.9-1.5-3.7 0-1.8.9-2.6 1.3-3 .3-.3.7-.4 1-.4h.7c.2 0 .5-.1.8.6l1.1 2.7c.1.2.2.5 0 .8l-.4.7-.6.6c-.2.2-.4.4-.2.8.2.4 1 1.7 2.2 2.7 1.5 1.3 2.8 1.7 3.2 1.9.4.2.6.2.9-.1l1.3-1.5c.3-.4.6-.3.9-.2l2.6 1.2c.4.2.6.3.7.5.1.2.1.9-.2 1.7Z"
      />
    </Svg>
  );
}
