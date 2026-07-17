import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { ContactForm } from '../components/support/ContactForm.native';
import { faq, privacy, terms, type LegalBlock, type LegalMeta } from '../content/legal';
import { NavBar, ScreenBackground, colors, layout, spacing } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;
type Page = Props['route']['params']['page'];

const TITLES: Record<Page, string> = {
  faq: faq.title,
  privacy: privacy.title,
  terms: terms.title,
  contact: 'Contact',
};

function MetaLine({ meta }: { meta: LegalMeta }): React.JSX.Element {
  return (
    <Text style={styles.meta}>
      Version {meta.version} · Effective {meta.effectiveDate} · Last updated {meta.lastUpdated}
    </Text>
  );
}

function Blocks({ blocks }: { blocks: LegalBlock[] }): React.JSX.Element {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <Text key={i} style={styles.p}>
            {b.text}
          </Text>
        ) : (
          <View key={i} style={styles.list}>
            {b.items.map((item, j) => (
              <View key={j} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ),
      )}
    </>
  );
}

/** Legal + Contact — renders Privacy / Terms / FAQ from src/content/legal. */
export function LegalScreen({ navigation, route }: Props): React.JSX.Element {
  const { page } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground>
      <NavBar title={TITLES[page]} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {page === 'contact' ? (
            <ContactForm />
          ) : page === 'faq' ? (
            <View style={styles.prose}>
              <MetaLine meta={faq.meta} />
              {faq.categories.map((cat) => (
                <View key={cat.id}>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  {cat.items.map((item, i) => (
                    <View key={i} style={styles.qa}>
                      <Text style={styles.question}>{item.question}</Text>
                      <Text style={styles.answer}>{item.answer}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.prose}>
              <MetaLine meta={(page === 'privacy' ? privacy : terms).meta} />
              <Blocks blocks={(page === 'privacy' ? privacy : terms).intro} />
              {(page === 'privacy' ? privacy : terms).sections.map((section) => (
                <View key={section.id}>
                  <Text style={styles.h4}>{section.heading}</Text>
                  <Blocks blocks={section.body} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter },
  prose: { paddingTop: 4 },
  meta: { fontSize: 12.5, color: colors.muted, marginBottom: 14 },
  h4: { fontSize: 15.5, fontWeight: '800', color: colors.navy, marginTop: 18, marginBottom: 6 },
  p: { fontSize: 14.5, lineHeight: 23, color: colors.text, marginBottom: 10 },
  list: { marginBottom: 10, gap: 7 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletDot: { fontSize: 14.5, lineHeight: 23, color: colors.text },
  bulletText: { flex: 1, fontSize: 14.5, lineHeight: 23, color: colors.text },
  categoryName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.blue,
    marginTop: 20,
    marginBottom: 8,
  },
  qa: { marginBottom: 16 },
  question: { fontSize: 15, fontWeight: '800', color: colors.navy, marginBottom: 5 },
  answer: { fontSize: 14.5, lineHeight: 23, color: colors.text },
});
