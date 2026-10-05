import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Field } from '@/features/doctor/ui';
import { setMedicationStock } from '@/features/medicine/repository';
import { formatAmount, stockState, type TreatmentMedication } from '@/features/medicine/schedule';
import { palette, themedStyles, useScheme } from '@/ui/palette';

/** Remaining supply for one medicine, with a low-stock warning and a way to record a refill. */
export function StockEditor({ medication, onSaved }: { medication: TreatmentMedication; onSaved: () => void }) {
  useScheme();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const state = stockState(medication);

  const save = async () => {
    const amount = Number.parseFloat(value.replace(',', '.'));
    if (!(amount >= 0)) { setError('Enter how many you have now.'); return; }
    try { await setMedicationStock(medication.id, amount); setEditing(false); setValue(''); setError(''); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  };

  return (
    <View style={styles.wrap}>
      {state ? (
        <Text style={[styles.meta, state.level !== 'ok' && styles.warn]}>
          {state.level === 'out' ? 'Out of stock — time to refill.' : `${formatAmount(state.remaining, medication.unit)} left${state.daysLeft !== null ? ` · about ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}` : ''}${state.level === 'low' ? ' · refill soon' : ''}`}
        </Text>
      ) : null}
      {editing ? (
        <>
          <Field keyboardType="decimal-pad" label={`How many ${medication.unit}s do you have now?`} maxLength={8} onChangeText={setValue} value={value} />
          {error ? <Text style={styles.warn}>{error}</Text> : null}
          <View style={styles.row}><Button label="Save stock" onPress={() => void save()} /><Button label="Cancel" onPress={() => setEditing(false)} tone="secondary" /></View>
        </>
      ) : <Button label={state ? 'Update stock (refill)' : 'Track my stock'} onPress={() => setEditing(true)} tone="secondary" />}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { gap: 6 },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  warn: { color: palette.coral, fontSize: 12, fontWeight: '600' },
  row: { gap: 6 },
}));
