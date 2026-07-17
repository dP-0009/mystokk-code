/**
 * Cold-start gate — WEB VARIANT. A pure passthrough that renders nothing, so the
 * web boot path is byte-identical to before. The branded BrandLoader cold-start
 * experience is native-only (it hands off from the native splash screen); the
 * web app has no equivalent splash, so there is nothing to gate here.
 */
export function ColdStartGate(): null {
  return null;
}
