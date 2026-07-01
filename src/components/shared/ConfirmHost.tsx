import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useConfirmStore } from '../../stores/confirm';
import { colors, shadows } from '../../theme/tokens';
import { webOnly } from '../layout/web';

/**
 * Single global confirmation modal (mounted once in App.tsx). Reads the active
 * dialog from the confirm store; the confirm button fires `onConfirm`, while the
 * backdrop, Cancel button, or Escape (web) just dismiss. Styled to match the
 * app's other confirm cards (see NetworkScreen).
 */
export function ConfirmHost(): React.JSX.Element {
  const current = useConfirmStore((s) => s.current);
  const close = useConfirmStore((s) => s.close);
  const visible = current !== null;

  // Escape closes on web (parity with the app's other modals).
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, close]);

  const onConfirm = (): void => {
    current?.onConfirm();
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{current?.title}</Text>
          {current?.message ? <Text style={styles.body}>{current.message}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.cancel, webOnly({ cursor: 'pointer' })]} onPress={close} testID="confirm-cancel">
              <Text style={styles.cancelText}>{current?.cancelLabel ?? 'Cancel'}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, current?.destructive ? styles.destructive : styles.primary, webOnly({ cursor: 'pointer' })]}
              onPress={onConfirm}
              testID="confirm-ok"
            >
              <Text style={styles.confirmText}>{current?.confirmLabel ?? 'Confirm'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.bgWhite, borderRadius: 16, padding: 22, ...shadows.lg },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
  cancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgWhite },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  primary: { backgroundColor: '#0F172A' },
  destructive: { backgroundColor: '#DC2626' },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
