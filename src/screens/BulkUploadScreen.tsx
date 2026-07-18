import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLoader } from '../components/shared/BrandLoader';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { AppButton } from '../components/shared/AppButton';
import { bulkImportVendors } from '../services/supabase/network';
import { buildTemplateXlsx, CSV_COLUMNS, parseVendorFile, TEMPLATE_FILENAME, TEMPLATE_MIME } from '../utils/csv';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'BulkUpload'>;

export function BulkUploadScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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
    // Native: write a real file to the cache, then hand it to the share sheet.
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
        Alert.alert('Sharing not available', 'This device cannot share files.');
      }
    } catch {
      // User dismissed the share sheet, or the file couldn't be written.
    }
  };

  const pickFile = async (): Promise<void> => {
    setParseError(null);
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
    const asset = res.assets[0];
    try {
      // Read raw bytes — the file may be a binary .xlsx (zip) or text (CSV/.xls).
      const bytes =
        Platform.OS === 'web'
          ? new Uint8Array(await (await fetch(asset.uri)).arrayBuffer())
          : await new File(asset.uri).bytes();
      const parsed = parseVendorFile(bytes).filter((r) => (r.company_name ?? '').trim() !== '');
      if (parsed.length === 0) {
        setParseError('No vendor rows found. Make sure the file has a company_name column.');
        setRows(null);
        setFileName(asset.name);
        return;
      }
      setRows(parsed);
      setFileName(asset.name);
    } catch {
      setParseError('Could not read that file. Please upload a valid Excel (.xlsx) or CSV file.');
      setRows(null);
    }
  };

  const doImport = async (): Promise<void> => {
    if (!rows) return;
    setImporting(true);
    try {
      const { imported, duplicates } = await bulkImportVendors(rows);
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Import complete', `${imported} imported, ${duplicates} duplicates skipped.`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Bulk Import Vendors" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Step 1 */}
        <Text style={styles.stepLabel}>Step 1 — Download Template</Text>
        <Text style={styles.hint}>Excel template with all {CSV_COLUMNS.length} vendor fields pre-formatted.</Text>
        <AppButton title="📄 Download Excel Template" variant="outline" onPress={() => void downloadTemplate()} style={styles.block} />

        {/* Step 2 */}
        <Text style={[styles.stepLabel, styles.step2]}>Step 2 — Upload Your File</Text>
        <Text style={styles.hint}>Duplicates are automatically removed by email address.</Text>
        <Pressable style={styles.dropzone} onPress={() => void pickFile()}>
          <Text style={styles.dropIcon}>📤</Text>
          <Text style={styles.dropText}>{fileName ?? 'Tap to choose your filled template (.xlsx or .csv)'}</Text>
          {rows ? <Text style={styles.dropCount}>{rows.length} vendor row{rows.length === 1 ? '' : 's'} ready</Text> : null}
        </Pressable>
        {parseError ? <Text style={styles.error}>{parseError}</Text> : null}

        <View style={styles.warn}>
          <Text style={styles.warnText}>
            ⚠️ Vendors whose email matches an existing MyStokk account will auto-connect. Others are saved as manual
            contacts.
          </Text>
        </View>

        {importing ? (
          <View style={styles.importing}>
            <BrandLoader mode="loop" size={90} />
          </View>
        ) : (
          <AppButton
            title={rows ? `Import ${rows.length} Vendors` : 'Import Vendors'}
            onPress={() => void doImport()}
            disabled={!rows}
            style={styles.importBtn}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  body: { padding: 20, paddingBottom: 40 },
  stepLabel: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 6 },
  step2: { marginTop: 24 },
  hint: { fontSize: 12, color: colors.slate500, marginBottom: 10 },
  block: { marginTop: 2 },
  dropzone: {
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dropIcon: { fontSize: 28, marginBottom: 8 },
  dropText: { fontSize: 13, fontWeight: '600', color: colors.slate700, textAlign: 'center', paddingHorizontal: 16 },
  dropCount: { fontSize: 12, color: colors.emerald, fontWeight: '700', marginTop: 6 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 10 },
  warn: { backgroundColor: colors.amberBg, borderRadius: 10, padding: 12, marginTop: 16 },
  warnText: { fontSize: 12, color: colors.amber, lineHeight: 18 },
  importing: { marginTop: 24, alignItems: 'center' },
  importBtn: { marginTop: 24 },
});
