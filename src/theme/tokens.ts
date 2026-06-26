/**
 * MyStokk design tokens — the complete design system.
 *
 * This is the React Native equivalent of the spec's `tokens.css`. RN's
 * StyleSheet cannot read CSS custom properties, so the canonical source of
 * truth lives here as typed constants. Every component MUST import from this
 * file — never hardcode a color, radius, shadow, or font value anywhere else.
 *
 * Values mirror the `:root` custom properties in mystokk-ui-mirror.html
 * exactly. Declared `as const` so each value is a readonly string/number
 * literal type, giving full autocomplete and compile-time safety with no `any`.
 */

import { Platform } from 'react-native';

/* ------------------------------------------------------------------ *
 * COLORS
 * Canonical, semantic token names. These map 1:1 to the CSS variables
 * in the UI mirror (e.g. `--color-accent` -> `colors.accent`).
 * ------------------------------------------------------------------ */
const canonicalColors = {
  // Brand / surfaces
  primary: '#0F172A', // near-black navy — sidebar bg
  primaryMid: '#1E293B', // sidebar item hover
  accent: '#2563EB', // blue — active nav, buttons
  accentLight: '#EFF6FF', // blue tint backgrounds
  accentMid: '#DBEAFE', // blue chip hover

  // Status
  green: '#16A34A', // available qty, confirmed badge
  greenLight: '#DCFCE7', // confirmed badge background
  orange: '#F97316', // pending, reserved badge
  orangeLight: '#FFF7ED', // pending background
  red: '#DC2626', // rejected, delete, required star
  redLight: '#FEF2F2', // rejected background
  purple: '#7C3AED', // conversations / threads accent
  purpleLight: '#EDE9FE', // conversations icon background
  yellowLight: '#FFFBEB', // warning box bg
  yellowBorder: '#FDE68A', // warning box border

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Borders
  border: '#E2E8F0',
  borderDark: '#CBD5E1',

  // Backgrounds
  bgPage: '#F8FAFC', // main content background
  bgWhite: '#FFFFFF',
  bgChip: '#F1F5F9', // input backgrounds, chips
} as const;

/* ------------------------------------------------------------------ *
 * DEPRECATED legacy color aliases.
 * Pre-redesign screens import these names (`colors.navy`, `colors.emerald`,
 * …). They are merged into the exported `colors` object below so the app
 * keeps compiling while components migrate to the canonical tokens above.
 * Do NOT use these in new code — they will be removed once every screen
 * references the semantic tokens.
 * @deprecated use the semantic tokens in `canonicalColors` instead.
 * ------------------------------------------------------------------ */
const legacyColors = {
  navy: '#0F172A',
  navyLight: '#1E293B',
  navyDeep: '#16213E',
  emerald: '#059669',
  emeraldLight: '#10B981',
  amber: '#D97706',
  blue: '#2563EB',
  emeraldBg: '#ECFDF5',
  amberBg: '#FFFBEB',
  redBg: '#FEF2F2',
  blueBg: '#EFF6FF',
  slate900: '#0F172A',
  slate700: '#334155',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
} as const;

/**
 * Exported color map = canonical semantic tokens + deprecated legacy
 * aliases. New code should reference the canonical names; the legacy keys
 * exist only to keep unmigrated screens compiling.
 */
export const colors = {
  ...canonicalColors,
  ...legacyColors,
} as const;

/* ------------------------------------------------------------------ *
 * SPACING
 * ------------------------------------------------------------------ */
export const spacing = {
  sidebarWidth: 240,
} as const;

/* ------------------------------------------------------------------ *
 * BORDER RADIUS
 * ------------------------------------------------------------------ */
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
} as const;

/* ------------------------------------------------------------------ *
 * SHADOWS
 * RN shadow objects. react-native-web converts these `shadow*` props to
 * the equivalent CSS box-shadow, so the web build matches the mirror:
 *   sm: 0 1px 3px  rgba(0,0,0,0.08)
 *   md: 0 4px 12px rgba(0,0,0,0.10)
 *   lg: 0 8px 32px rgba(0,0,0,0.14)
 *   dropdown: 0 8px 24px rgba(0,0,0,0.15) — floating dropdown/select panels
 * ------------------------------------------------------------------ */
export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 12,
  },
  // Floating dropdown / select popup panels — 0 8px 24px rgba(0,0,0,0.15).
  dropdown: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/* ------------------------------------------------------------------ *
 * TYPOGRAPHY
 * The mirror uses the system font stack at a 14px base. On web the full
 * comma stack resolves natively; on iOS/Android we fall back to the OS
 * system font (RN ignores unknown family names in a stack).
 * ------------------------------------------------------------------ */
export const typography = {
  fontFamily: Platform.select({
    web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    default: 'System',
  }) as string,
  baseFontSize: 14,
} as const;

/* ------------------------------------------------------------------ *
 * Aggregate token object.
 * ------------------------------------------------------------------ */
export const tokens = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
} as const;

/** Union of canonical token color names, e.g. 'accent' | 'green' | … */
export type ColorToken = keyof typeof canonicalColors;

/** Union of canonical hex color values produced by the token set. */
export type ColorValue = (typeof canonicalColors)[ColorToken];

export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadows;

export type Tokens = typeof tokens;

export default tokens;
