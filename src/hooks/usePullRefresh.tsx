import React from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';

import { colors } from '../components/mobile/theme';

/**
 * App-wide pull-to-refresh — NATIVE ONLY.
 *
 * The visible spinner (`refreshing`) is true ONLY while a user-initiated pull is
 * in flight. Background work — refetch-on-focus, realtime invalidations, polling
 * — never flips it, so those refreshes stay silent: the existing data keeps
 * showing and the fresh data swaps in place with no spinner, blank, or layout
 * jump. Full-screen loading stays gated on the query's own `isLoading` (which is
 * true only on the first load, before there is any data).
 *
 * Screens get back the raw `refreshing`/`onRefresh` (for FlashList's props) and a
 * ready-made `control` element (for a ScrollView's `refreshControl`), so the
 * behaviour is defined once and dropped into every screen the same way.
 */
export function usePullRefresh(
  refetch: () => Promise<unknown>,
  /** Push the spinner below an absolute header (usually the scroll's paddingTop). */
  progressViewOffset = 0,
): { refreshing: boolean; onRefresh: () => void; control: React.ReactElement<RefreshControlProps> } {
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    void Promise.resolve(refetch()).finally(() => setRefreshing(false));
  }, [refetch]);

  const control = React.useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={colors.blue}
        colors={[colors.blue]}
        progressViewOffset={progressViewOffset}
      />
    ),
    [refreshing, onRefresh, progressViewOffset],
  );

  return { refreshing, onRefresh, control };
}
