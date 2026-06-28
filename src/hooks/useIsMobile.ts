import { useWindowDimensions } from 'react-native';

/**
 * Viewport width (px) below which the app switches from the desktop sidebar
 * shell to the mobile chrome (floating footer nav, no sidebar). 820 keeps the
 * 240px sidebar + content comfortable on tablets and up.
 */
export const MOBILE_BREAKPOINT = 820;

/** True when the viewport is narrow enough to use the mobile layout. */
export function useIsMobile(): boolean {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}
