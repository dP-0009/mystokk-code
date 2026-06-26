import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/tokens';
import { webOnly } from './web';

type AppShellProps = {
  /** The fixed-width left rail. Pass a `<Sidebar>`. */
  sidebar?: ReactNode;
  /** Main column content — typically a `<PageHeader>` followed by `<PageBody>`. */
  children: ReactNode;
};

/**
 * Authenticated app layout shell (mirror `.app-shell`).
 *
 * A horizontal flex split: a 240px sidebar on the left and a flex-1 main
 * column on the right. The shell fills the viewport (the web global.css gives
 * #root full height; native stretches via flex), so the sidebar runs full
 * height and the main column scrolls independently via `<PageBody>`.
 */
export function AppShell({ sidebar, children }: AppShellProps): React.JSX.Element {
  return (
    <View style={styles.shell}>
      {sidebar}
      <View style={styles.main}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bgPage,
    ...webOnly({ minHeight: '100vh' }),
  },
  // `.main` — flex:1 column that owns the page header + scrolling body.
  main: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0, // allow children to shrink/scroll horizontally on web
  },
});
