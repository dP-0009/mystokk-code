import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FrostedFill, FROST_BORDER } from '../mobile/FrostedBackground';
import { useConfirmStore } from '../../stores/confirm';
import { colors } from '../mobile/theme';

/**
 * Confirm dialog — NATIVE. Same confirm store as the web ConfirmHost, but the
 * card is frosted white glass to match the rest of the mobile popups.
 */
export function ConfirmHost(): React.JSX.Element {
  const current = useConfirmStore((s) => s.current);
  const close = useConfirmStore((s) => s.close);
  const visible = current !== null;

  const onConfirm = (): void => {
    current?.onConfirm();
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrap}>
          <FrostedFill />
          <View style={styles.cardInner}>
            <Text style={styles.title}>{current?.title}</Text>
            {current?.message ? <Text style={styles.body}>{current.message}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.cancel]} onPress={close} testID="confirm-cancel">
                <Text style={styles.cancelText}>{current?.cancelLabel ?? 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, current?.destructive ? styles.destructive : styles.primary]}
                onPress={onConfirm}
                testID="confirm-ok"
              >
                <Text style={styles.confirmText}>{current?.confirmLabel ?? 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,24,48,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  cardWrap: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FROST_BORDER,
  },
  cardInner: { padding: 22 },
  title: { fontSize: 17, fontWeight: '800', color: colors.navy, marginBottom: 8 },
  body: { fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 13, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
  cancel: { borderWidth: 1.5, borderColor: 'rgba(15,43,84,0.15)', backgroundColor: 'rgba(255,255,255,0.5)' },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  primary: { backgroundColor: colors.navy },
  destructive: { backgroundColor: colors.red },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
