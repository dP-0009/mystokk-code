/**
 * MyStokk mobile design tokens — native only.
 *
 * Transcribed from design/mystokk-final.html (the design source of truth, per
 * CLAUDE.md rule 3). Values mirror the prototype's `:root` CSS variables and
 * the iOS26 glass panel recipe further down that file.
 *
 * This module is imported ONLY by files under src/components/mobile/ and by
 * *.native.tsx screen forks. Nothing the web bundle renders imports it.
 */

/** Brand + semantic colors (CLAUDE.md rule 4, extended with the prototype's support colors). */
export const colors = {
  navy: '#0F2B54',
  blue: '#2E7CF6',
  blueDark: '#1E5FD0',
  sky: '#56C8FF',
  ice: '#E3EEFF',
  muted: '#67768F',
  text: '#17233A',

  green: '#149A54',
  amber: '#B26205',
  red: '#D93030',
  violet: '#6D5BE8',

  // Badge / soft backgrounds (prototype --*-bg)
  greenBg: '#E7F6EE',
  amberBg: '#FDF1E0',
  redBg: '#FCEBEB',
  violetBg: '#EFEDFC',
  grayBg: '#EEF1F7',

  // Surfaces
  bg: '#FFFFFF',
  line: '#E8EDF5',
  chev: '#C3CDDF',
  placeholder: '#9AA7BF',
  tabInactive: '#93A2BC',
  dashed: '#B7CBEC',

  // Stock bar
  stockAvailable: '#20B368',
  stockReserved: '#F0A030',
} as const;

/**
 * Screen background gradient — every .screen in the prototype:
 * linear-gradient(168deg,#E8F0FB 0%,#F3F7FD 45%,#E9F1FC 100%)
 * Use with expo-linear-gradient.
 */
export const screenGradient = {
  colors: ['#E8F0FB', '#F3F7FD', '#E9F1FC'] as const,
  locations: [0, 0.45, 1] as const,
  // 168deg ≈ near-vertical, slight lean
  start: { x: 0.1, y: 0 },
  end: { x: 0, y: 1 },
} as const;

/** Thumbnail / avatar gradients (prototype const G). */
export const gradients = {
  nav: ['#0F2B54', '#2E7CF6'],
  blue: ['#2E7CF6', '#56C8FF'],
  violet: ['#6D5BE8', '#56C8FF'],
  teal: ['#0FA5A0', '#56C8FF'],
  rose: ['#B4638F', '#E8A1C0'],
  slate: ['#33445F', '#67768F'],
} as const;

export type GradientName = keyof typeof gradients;

/**
 * iOS26 glass panel recipe. On iOS 26 the blur comes from expo-glass-effect;
 * everywhere else GlassPanel renders `fallback` below (Android never gets
 * liquid glass — expo-glass-effect is iOS/tvOS only).
 */
export const glass = {
  /** Fallback surface when liquid glass is unavailable. */
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#0A1E46',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  /**
   * Brightness ladder. Popups and dropdowns sit ABOVE cards, so they are
   * brighter — otherwise they read as dull/muddy against the content behind.
   */
  fillPanel: 'rgba(255,255,255,0.12)',
  fillTabBar: 'rgba(255,255,255,0.14)',
  fillInput: 'rgba(255,255,255,0.42)',
  fillFabMenu: 'rgba(255,255,255,0.62)',
  fillPopover: 'rgba(255,255,255,0.64)',
  fillSheet: 'rgba(255,255,255,0.68)',
  border: 'rgba(255,255,255,0.28)',
} as const;

/** Prototype spacing rhythm: screens pad 18px, cards 16px, rows 10–12px gaps. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  /** Horizontal screen gutter (.scroll padding). */
  gutter: 18,
} as const;

/** Corner radii, straight from the glass-panel block. */
export const radii = {
  sm: 12,
  input: 13,
  button: 17,
  doc: 18,
  crow: 22,
  row: 26,
  card: 30,
  sheet: 34,
  tabBar: 36,
  pill: 999,
} as const;

/**
 * Type scale. Weights are the prototype's (800 for headings/labels, 750/650 for
 * row titles); RN maps these to the closest available face.
 */
export const typography = {
  h1: { fontSize: 29, fontWeight: '800', letterSpacing: -0.6, color: colors.navy },
  h1Small: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.navy },
  navTitle: { fontSize: 17, fontWeight: '800', color: colors.navy },
  sub: { fontSize: 14.5, color: colors.muted },
  section: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.7, color: colors.muted },
  rowTitle: { fontSize: 15.5, fontWeight: '700', color: colors.navy },
  rowSub: { fontSize: 12.5, color: colors.muted },
  button: { fontSize: 16, fontWeight: '800' },
  buttonSm: { fontSize: 14.5, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  input: { fontSize: 15.5, color: colors.text },
  label: { fontSize: 13, fontWeight: '800', color: colors.navy },
} as const;

/** Fixed chrome heights the prototype's padding classes assume. */
export const layout = {
  navHeight: 112, // .pt-nav
  tabTopPad: 60, // .pt-tab
  tabBarHeight: 80,
  tabBarBottom: 11,
  bottomPadTab: 128, // .pb-tab
  bottomPadCta: 132, // .pb-cta
  bottomPadPlain: 44, // .pb-plain
  buttonHeight: 53,
  buttonHeightSm: 44,
  inputHeight: 51,
  fabSize: 57,
} as const;
