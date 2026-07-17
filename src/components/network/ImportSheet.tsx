import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQueryClient } from '@tanstack/react-query';

import { bulkImportVendors } from '../../services/supabase/network';
import { buildTemplateXlsx, parseVendorFile, TEMPLATE_FILENAME, TEMPLATE_MIME } from '../../utils/csv';
import { toast } from '../../stores/toast';
import { Button, Icon, Sheet, colors, radii } from '../mobile';

/**
 * Import contacts sheet (prototype SHEETS.bulk) — download the template, then a
 * dropzone that picks + imports in one step. Reuses the exact bulk-upload logic
 * from BulkUploadModal (buildTemplateXlsx / parseVendorFile / bulkImportVendors).
 */
export function ImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const downloadTemplate = async (): Promise<void> => {
    const bytes = buildTemplateXlsx();
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
      // user dismissed the share sheet, or the file couldn't be written
    }
  };

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
      const bytes =
        Platform.OS === 'web'
          ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
          : await new File(uri).bytes();
      const rows = parseVendorFile(bytes).filter((r) => (r.company_name ?? '').trim() !== '');
      if (rows.length === 0) {
        setError('No vendor rows found. Make sure the file has a company_name column.');
        return;
      }
      const { imported, duplicates } = await bulkImportVendors(rows);
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`${imported} imported${duplicates ? `, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : ''}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that file. Please upload a valid CSV.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Sheet open={visible} onClose={onClose} title="Import contacts">
      <Text style={styles.desc}>
        Download the Excel template, fill in your vendors, and upload it to add them all at once. Phone columns are
        pre-formatted as numbers so they never turn into 9.7E+11.
      </Text>

      <Button
        label="Download Excel template"
        variant="ghost"
        icon={<Icon name="doc" size={19} color={colors.navy} />}
        onPress={() => void downloadTemplate()}
        style={styles.templateBtn}
      />

      <Text style={styles.then}>THEN</Text>

      <Pressable onPress={() => void pickAndImport()} disabled={importing}>
        <View style={styles.dropzone}>
          {importing ? (
            <ActivityIndicator color={colors.blue} />
          ) : (
            <>
              <Icon name="bulk" size={26} color={colors.blue} />
              <Text style={styles.dropTitle}>Upload your filled template (.xls or .csv)</Text>
            </>
          )}
        </View>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.gap} />
      <Button label="Cancel" variant="ghost" onPress={onClose} disabled={importing} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Light 1px border on the ghost button, at its own (md) corner radius.
  templateBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.button },
  desc: { fontSize: 13.5, color: colors.muted, lineHeight: 20, marginBottom: 14 },
  then: { textAlign: 'center', fontSize: 12, fontWeight: '800', color: colors.blue, letterSpacing: 1, marginVertical: 12 },
  dropzone: {
    borderWidth: 2,
    borderColor: colors.dashed,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: 'rgba(243,248,255,0.9)',
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  dropTitle: { fontSize: 13.5, fontWeight: '800', color: colors.blue, textAlign: 'center' },
  error: { fontSize: 12.5, color: colors.red, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  gap: { height: 10 },
});
