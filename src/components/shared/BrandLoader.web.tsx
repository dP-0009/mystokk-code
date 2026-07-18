import React from 'react';

import { BRAND } from '../../constants/brand';
import { LOCKUP } from './BrandLogo';
import { TIMELINE } from './brandLoaderTimeline';

/**
 * BrandLoader — WEB VARIANT. The ONLY loading indicator on web, driven by plain
 * CSS keyframes instead of Reanimated so the web bundle never pulls Reanimated
 * in. A 1:1 implementation of design/loader-reference.html.
 *
 * Logo only — there is never a wordmark or any text in a loading state.
 *
 * Modes:
 *  - `once` — the 480ms action, then holds (animation-fill-mode: forwards).
 *  - `loop` — action → hold → fade-out on the reference's 1.4s cycle, infinite.
 *
 * Geometry comes from LOCKUP and motion from TIMELINE — the same constants the
 * native loader uses — so the two platforms are identical by construction.
 */
const { STAGE, BLOCK, RADIUS, SLOTS, TR_RELEASE } = LOCKUP;
const { DURATION, LOOP_DURATION, LOOP_FADE_START, FADE_END, ASSEMBLE_END, IGNITE_START, IGNITE_END, RELEASE_START, EASE_CSS, FROM } =
  TIMELINE;

export type BrandLoaderMode = 'once' | 'loop';

/** ms → keyframe percentage, relative to the cycle length of the given mode. */
const pctOf = (total: number) => (ms: number): string => `${((ms / total) * 100).toFixed(3)}%`;

/**
 * Build one @keyframes block. Declarations are merged by offset before emitting:
 * IGNITE_END and RELEASE_START are both 320ms, and two keyframe blocks at the
 * same offset would rely on the cascade's per-property merge. One block per
 * offset keeps it unambiguous.
 */
const frames = (
  name: string,
  from: { x: number; y: number },
  opts: { hero: boolean; loop: boolean },
): string => {
  const total = opts.loop ? LOOP_DURATION : DURATION;
  const pct = pctOf(total);
  const at = new Map<number, string[]>();
  const add = (ms: number, decl: string): void => {
    at.set(ms, [...(at.get(ms) ?? []), decl]);
  };

  add(0, `opacity: 0`);
  add(0, `transform: translate(${from.x}px, ${from.y}px)`);
  add(FADE_END, `opacity: 1`);
  add(ASSEMBLE_END, `transform: translate(0px, 0px)`);

  if (opts.hero) {
    add(0, `background-color: ${BRAND.navy}`);
    add(IGNITE_START, `background-color: ${BRAND.navy}`);
    add(IGNITE_END, `background-color: ${BRAND.primary}`);
    add(RELEASE_START, `transform: translate(0px, 0px)`);
    add(DURATION, `transform: translate(${TR_RELEASE.x}px, ${TR_RELEASE.y}px)`);
    add(DURATION, `background-color: ${BRAND.primary}`);
  }

  if (opts.loop) {
    // Hold the finished lockup, then fade out so the cycle wraps invisibly.
    add(LOOP_FADE_START, `opacity: 1`);
    add(LOOP_DURATION, `opacity: 0`);
    if (opts.hero) {
      add(LOOP_FADE_START, `transform: translate(${TR_RELEASE.x}px, ${TR_RELEASE.y}px)`);
      add(LOOP_DURATION, `transform: translate(${TR_RELEASE.x}px, ${TR_RELEASE.y}px)`);
    } else {
      add(LOOP_FADE_START, `transform: translate(0px, 0px)`);
      add(LOOP_DURATION, `transform: translate(0px, 0px)`);
    }
  } else {
    add(DURATION, `opacity: 1`);
    if (!opts.hero) add(DURATION, `transform: translate(0px, 0px)`);
  }

  const body = [...at.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, decls]) => `  ${pct(ms)} { ${decls.join('; ')}; }`)
    .join('\n');
  return `\n@keyframes ${name} {\n${body}\n}`;
};

const sheet = (loop: boolean): string => {
  const s = loop ? 'loop' : 'once';
  return `
${frames(`mystokk-bl-${s}-tl`, FROM.tl, { hero: false, loop })}
${frames(`mystokk-bl-${s}-bl`, FROM.bl, { hero: false, loop })}
${frames(`mystokk-bl-${s}-br`, FROM.br, { hero: false, loop })}
${frames(`mystokk-bl-${s}-tr`, FROM.tr, { hero: true, loop })}
.mystokk-bl-${s} {
  animation-duration: ${loop ? LOOP_DURATION : DURATION}ms;
  animation-timing-function: ${EASE_CSS};
  animation-fill-mode: forwards;
  animation-iteration-count: ${loop ? 'infinite' : '1'};
}`;
};

const CSS = `
${sheet(false)}
${sheet(true)}
.mystokk-bl-block {
  position: absolute;
  width: ${BLOCK}px;
  height: ${BLOCK}px;
  border-radius: ${RADIUS}px;
  background-color: ${BRAND.navy};
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  /* Skip the motion, keep the destination: the finished lockup, painted at once.
     !important because animation-name is set inline, which otherwise wins. */
  .mystokk-bl-block { animation: none !important; opacity: 1; }
  .mystokk-bl-hero { background-color: ${BRAND.primary}; transform: translate(${TR_RELEASE.x}px, ${TR_RELEASE.y}px); }
}
`;

export function BrandLoader({
  size = STAGE,
  mode = 'loop',
  onComplete,
}: {
  /** Rendered stage size in px. The 150-unit stage is scaled by `size / 150`. */
  size?: number;
  /** `once` holds the end state (cold start); `loop` repeats (all other loads). */
  mode?: BrandLoaderMode;
  /** Fired when a `once` run finishes. */
  onComplete?: () => void;
}): React.JSX.Element {
  const k = size / STAGE;
  const s = mode === 'loop' ? 'loop' : 'once';

  React.useEffect(() => {
    if (!onComplete || mode === 'loop') return;
    const t = setTimeout(onComplete, DURATION);
    return () => clearTimeout(t);
    // Run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slot = (
    p: { left: number; top: number },
    corner: string,
  ): React.CSSProperties => ({
    left: p.left,
    top: p.top,
    animationName: `mystokk-bl-${s}-${corner}`,
  });

  const cls = `mystokk-bl-block mystokk-bl-${s}`;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      role="progressbar"
      aria-label="Loading"
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* The stage is authored at 150px and scaled, so one static keyframe set
          serves every `size` and stays pixel-identical to the native loader. */}
      <div style={{ width: size, height: size, position: 'relative' }}>
        <div
          style={{
            width: STAGE,
            height: STAGE,
            position: 'relative',
            transform: `scale(${k})`,
            transformOrigin: 'top left',
          }}
        >
          <div className={cls} style={slot(SLOTS.tl, 'tl')} />
          <div className={cls} style={slot(SLOTS.bl, 'bl')} />
          <div className={cls} style={slot(SLOTS.br, 'br')} />
          <div className={`${cls} mystokk-bl-hero`} style={slot(SLOTS.tr, 'tr')} />
        </div>
      </div>
    </div>
  );
}
