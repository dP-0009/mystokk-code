import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQueryClient } from '@tanstack/react-query';

import { bulkImportVendors } from '../../services/supabase/network';
import { buildTemplateXlsx, parseVendorFile, TEMPLATE_FILENAME, TEMPLATE_MIME } from '../../utils/csv';
import { webOnly } from '../layout/web';
import { colors, radius, shadows } from '../../theme/tokens';
import { toast } from '../../stores/toast';

interface BulkUploadModalProps {
  visible: boolean;
  onClose: () => void;
  /** Fired after a successful import (queries are already invalidated). */
  onImported?: () => void;
}

export function BulkUploadModal({ visible, onClose, onImported }: BulkUploadModalProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    if (importing) return; // don't dismiss mid-import
    setError(null);
    onClose();
  };

  const downloadTemplate = async (): Promise<void> => {
    const bytes = buildTemplateXlsx();
    if (Platform.OS === 'web') {
      const blob = new Blob([bytes as BlobPart], { type: TEMPLATE_MIME });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = TEMPLATE_FILENAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    // Native: write a real file to the cache, then hand it to the share sheet
    // (Share.share only takes text, which is why the old .xls arrived corrupt).
    try {
      const file = new File(Paths.cache, TEMPLATE_FILENAME);
      if (file.exists) file.delete();
      file.create();
      file.write(bytes);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: TEMPLATE_MIME,
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
          dialogTitle: 'MyStokk vendor template',
        });
      } else {
        setError('Sharing is not available on this device.');
      }
    } catch {
      // User dismissed the share sheet, or the file couldn't be written.
    }
  };

  // Upload triggers the import directly on file select (no separate submit).
  const pickAndImport = async (): Promise<void> => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'text/comma-separated-values',
        'application/vnd.ms-excel',
        'application/xml',
        'text/xml',
        'text/plain',
        '*/*',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;

    setImporting(true);
    try {
      const uri = res.assets[0].uri;
      // Read raw bytes — the file may be a binary .xlsx (zip) or text (CSV/.xls).
      const bytes =
        Platform.OS === 'web'
          ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
          : await new File(uri).bytes();
      // Accepts the filled .xlsx template, an old .xls, OR a CSV (saved-as from Excel).
      const rows = parseVendorFile(bytes).filter((r) => (r.company_name ?? '').trim() !== '');
      if (rows.length === 0) {
        setError('No vendor rows found. Make sure the file has a company_name column.');
        return;
      }
      const { imported, duplicates } = await bulkImportVendors(rows);
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`${imported} imported${duplicates ? `, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : ''}.`);
      onImported?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that file. Please upload a valid CSV.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Bulk Upload Vendors</Text>
            <Pressable style={styles.close} onPress={close} hitSlop={8} testID="bulk-close">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.desc}>
              Download the Excel template, fill in your vendors, and upload it to add them all at once.
              Phone columns are pre-formatted as numbers so they never turn into 9.7E+11.
            </Text>

            <Pressable style={styles.templateBtn} onPress={() => void downloadTemplate()} testID="bulk-download-template">
              <Ionicons name="download-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.templateBtnText}>Download Excel Template</Text>
            </Pressable>

            {/* THEN divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>THEN</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Upload zone */}
            <Pressable
              style={styles.dropzone}
              onPress={() => void pickAndImport()}
              disabled={importing}
              testID="bulk-dropzone"
            >
              {importing ? (
                <>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.dropText}>Importing…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.textMuted} />
                  <Text style={styles.dropText}>Click to upload your filled template (.xlsx or .csv)</Text>
                </>
              )}
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.cancelBtn, importing ? styles.cancelDisabled : null]}
              onPress={close}
              disabled={importing}
              testID="bulk-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // `.mo`
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // `.md` (max-width 420)
  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    overflow: 'hidden',
    ...shadows.lg,
    ...webOnly({ maxHeight: '90vh' }),
  },

  // `.mh`
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  closeText: { fontSize: 16, color: colors.textSecondary },

  // `.mb`
  body: { paddingHorizontal: 24, paddingVertical: 20 },
  desc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 20 },

  // Download template — full-width, very rounded outline
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.bgWhite,
  },
  templateBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },

  // THEN divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, fontWeight: '600', color: colors.accent },

  // Upload zone (dashed)
  dropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderDark,
    borderRadius: radius.md,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: colors.bgPage,
    alignItems: 'center',
    gap: 8,
    ...webOnly({ cursor: 'pointer' }),
  },
  dropText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  error: { fontSize: 13, color: colors.red, fontWeight: '600', marginTop: 14, textAlign: 'center' },

  // `.mf`
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.bgWhite,
    alignItems: 'center',
  },
  cancelDisabled: { opacity: 0.5 },
  cancelText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});
