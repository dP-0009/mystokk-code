import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';

type PageHeaderProps = {
  /** Page title (mirror `.ph h1`). */
  title: string;
  /** Optional muted subtitle under the title (mirror `.ph .sub`). */
  subtitle?: string;
  /** Optional leading node above the title — e.g. a "← Back" row. */
  leading?: ReactNode;
  /** Right-aligned actions — buttons, the notification bell, etc. */
  actions?: ReactNode;
};

/**
 * Sticky-feeling page header at the top of the main column (mirror `.ph`).
 * White surface, bottom border, title/subtitle on the left and actions on the
 * right.
 */
export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
}: PageHeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        {leading}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // `.ph`
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: colors.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleBlock: { flexShrink: 1, minWidth: 0 },
  // `.ph h1`
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  // `.ph .sub`
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
});
