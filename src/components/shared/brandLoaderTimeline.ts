/**
 * Cold-start loader timeline — shared by BrandLoader.tsx (native, Reanimated)
 * and BrandLoader.web.tsx (web, CSS keyframes) so the two platforms animate
 * identically. Geometry lives in LOCKUP (BrandLogo.tsx); this is the motion.
 *
 * Never fork these values — a platform that drifts here is the exact bug this
 * module exists to prevent.
 */
export const TIMELINE = {
  /** Total run, ms. Plays ONCE and holds the end state. */
  DURATION: 480,
  /** Phase breakpoints in ms from the start. */
  FADE_END: 60, // opacity 0→1
  ASSEMBLE_END: 220, // blocks land in their slots
  IGNITE_START: 250, // top-right block starts navy→primary
  IGNITE_END: 320, // ignite complete
  RELEASE_START: 320, // top-right block starts its displacement
  /**
   * Looping cycle, from the reference's own demo loop: the 480ms action, then a
   * hold on the finished lockup to 94%, then a fade-out over the last 6%. The
   * blocks are fully transparent at both ends, so the wrap is invisible.
   */
  LOOP_DURATION: 1400,
  LOOP_FADE_START: 1316, // 94% of 1400
  /** Easing, in both dialects. Same curve. */
  EASE_CSS: 'cubic-bezier(0.25, 1, 0.4, 1)',
  EASE_BEZIER: [0.25, 1, 0.4, 1] as const,
  /**
   * Off-stage fly-in start offsets per block, in 150-stage units (scaled by
   * `size / 150` at render time, same as the geometry).
   */
  FROM: {
    tl: { x: -260, y: 0 },
    bl: { x: -200, y: 220 },
    br: { x: 200, y: 220 },
    tr: { x: 240, y: -200 },
  },
} as const;
