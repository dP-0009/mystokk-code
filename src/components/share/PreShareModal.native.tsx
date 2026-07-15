import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Note, InfoNote, Sheet, TextArea, TextField } from '../mobile';

interface PreShareModalProps {
  visible: boolean;
  currency: string;
  unit: string;
  onClose: () => void;
  onContinue: (price: number | null, remark: string | null) => void;
}

const NUMERIC = /^\d*\.?\d*$/;

/**
 * Pre-share terms gate — NATIVE (prototype SCREENS.shareTermsR). Shown before
 * sharing a RECEIVED item: the original supplier's price is never passed on, so
 * the sharer sets their own optional price + remark first (the privacy chain).
 *
 * Same props/contract as the web PreShareModal, so Metro swaps it on native. Per
 * CLAUDE.md rule 5 the UI never says "forward" — the action is always "Share".
 */
export function PreShareModal({ visible, currency, unit, onClose, onContinue }: PreShareModalProps): React.JSX.Element {
  const [price, setPrice] = React.useState('');
  const [remark, setRemark] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setPrice('');
      setRemark('');
    }
  }, [visible]);

  const cont = (): void => {
    onContinue(price ? Number(price) : null, remark.trim() || null);
  };

  return (
    <Sheet open={visible} onClose={onClose} title="Your terms" description="Set what your contacts see">
      <Note>
        The original supplier&apos;s price will not be shared. Set your own price (optional) and a remark before
        sharing.
      </Note>

      <View style={styles.gap} />
      <TextField
        label={`Your price (${currency} per ${unit}) — optional`}
        value={price}
        onChangeText={(t) => NUMERIC.test(t) && setPrice(t)}
        placeholder="Leave blank to share without price"
        keyboardType="decimal-pad"
      />
      <TextArea
        label="Remark — optional"
        value={remark}
        onChangeText={setRemark}
        placeholder="e.g. MOQ 100 units, ready stock, lead time 2 weeks…"
        autoCapitalize="sentences"
      />

      <View style={styles.infoGap}>
        <InfoNote icon="shield">
          The supplier&apos;s identity and original price stay hidden — the MyStokk privacy chain protects every link.
        </InfoNote>
      </View>

      <Button
        label="Continue"
        variant="primary"
        icon={<Icon name="share" size={18} color="#FFFFFF" />}
        onPress={cont}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gap: { height: 14 },
  infoGap: { marginTop: 4, marginBottom: 14 },
});
