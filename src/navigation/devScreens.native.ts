import type React from 'react';

import { DesignSystemScreen } from '../screens/DesignSystemScreen.native';

/**
 * Dev-only routes — NATIVE VARIANT. Metro resolves this over devScreens.ts for
 * iOS/Android; the web bundle never sees it.
 *
 * Gated on __DEV__ as well as the platform, so the design-system gallery cannot
 * reach a production build even by accident.
 */
export const DEV_ROUTES_ENABLED: boolean = __DEV__;

export const DevScreenComponent: React.ComponentType | null = DesignSystemScreen;

export const DEV_LINKING: Record<string, string> = { DesignSystem: 'design-system' };
