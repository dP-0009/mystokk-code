import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { webOnly } from '../components/layout/web';
import { LegalContent, LEGAL_PAGES } from '../components/shared/LegalContent';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

export function LegalScreen({ navigation, route }: Props): React.JSX.Element {
  const page = route.params?.page ?? 'faq';
  const content = LEGAL_PAGES[page];

  return (
    <MainLayout active={page}>
      <PageHeader
        title={content.title}
        subtitle={content.subtitle}
        leading={<BackLink onPress={() => navigation.goBack()} />}
      />
      <PageBody>
        <View style={styles.wrap}>
          <LegalContent page={page} />
        </View>
      </PageBody>
    </MainLayout>
  );
}

function BackLink({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.backLink, webOnly({ cursor: 'pointer' })]}>
      <Text style={styles.backText}>← Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  backLink: { marginBottom: 8 },
  backText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
