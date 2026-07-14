import type React from 'react';

/**
 * Dev-only routes — WEB VARIANT (the default resolution for the web bundle).
 *
 * Everything here is inert: the route is never registered and the linking table
 * gains nothing, so the web app renders byte-identically to before this file
 * existed. The real implementation lives in devScreens.native.ts, which Metro
 * picks for iOS/Android only.
 */
export const DEV_ROUTES_ENABLED = false;

export const DevScreenComponent: React.ComponentType | null = null;

export const DEV_LINKING: Record<string, string> = {};
