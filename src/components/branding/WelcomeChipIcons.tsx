import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { BRAND } from '../../constants/brand';

/**
 * Welcome-screen feature-chip icons — stroke glyphs in the app's icon family,
 * drawn in the brand primary. Two are custom (a shield holding three linked
 * nodes, and an inventory cube with a primary accent dot); the "Instant Sharing"
 * chip reuses the app's existing share-nodes glyph via <Icon name="share" />.
 */
export function PrivateNetworkIcon({ size = 24 }: { size?: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shield outline */}
      <Path
        d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6Z"
        stroke={BRAND.primary}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {/* Three linked nodes inside */}
      <Line x1={12} y1={8.6} x2={9.4} y2={13.2} stroke={BRAND.primary} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={12} y1={8.6} x2={14.6} y2={13.2} stroke={BRAND.primary} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={9.4} y1={13.2} x2={14.6} y2={13.2} stroke={BRAND.primary} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={12} cy={8.6} r={1.5} fill={BRAND.primary} />
      <Circle cx={9.4} cy={13.2} r={1.5} fill={BRAND.primary} />
      <Circle cx={14.6} cy={13.2} r={1.5} fill={BRAND.primary} />
    </Svg>
  );
}

export function LiveInventoryIcon({ size = 24 }: { size?: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Isometric cube outline */}
      <Path d="M21 8 12 3 3 8v8l9 5 9-5Z" stroke={BRAND.primary} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M3 8l9 5 9-5M12 13v8" stroke={BRAND.primary} strokeWidth={1.8} strokeLinejoin="round" />
      {/* Solid accent dot on the top-right corner */}
      <Circle cx={18.6} cy={5.8} r={2.4} fill={BRAND.primary} />
    </Svg>
  );
}
