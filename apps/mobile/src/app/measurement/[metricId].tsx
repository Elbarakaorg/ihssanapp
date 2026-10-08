import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { isMetricId, localDateString, metricDefinitions, validateBloodPressureInput, validateMeasurementInput } from '@/features/health/metric-input';
import { getMetricSupportedUnits, saveCompositeMeasurement, saveMeasurement } from '@/features/health/measurement-repository';
import { Page, PreviewNotice } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme, glassSurface } from '@/ui/palette';

export default function MeasurementEntryScreen() {
  useScheme();
  const { metricId } = useLocalSearchParams<{ metricId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const isSupported = metricId !== undefined && isMetricId(metricId);
  const definition = isSupported ? metricDefinitions[metricId] : null;
  const [supportedUnits, setSupportedUnits] = useState<string[]>(definition ? [...definition.units] : []);
  const [value, setValue] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [glucoseTiming, setGlucoseTiming] = useState('unspecified');
  const [unit, setUnit] = useState(definition?.units[0] ?? '');
  const [date, setDate] = useState(localDateString());
  const [error, setError] = useState('');
  const [unitLoadError, setUnitLoadError] = useState('');
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!session || !isSupported) return () => { active = false; };
    void getMetricSupportedUnits(metricId).then((units) => {
      if (active && units.length) {
        setSupportedUnits(units);
        setUnit((currentUnit) => units.includes(currentUnit) ? currentUnit : units[0]);
      }
    }).catch(() => {
      if (active) setUnitLoadError('Saved units could not be loaded. Standard units are shown instead.');
    });
    return () => { active = false; };
  }, [isSupported, metricId, session]);

  if (!definition || !isSupported) {
    return (
      <Page>
        <Stack.Screen options={{ title: 'Metric unavailable', headerShown: true }} />
        <Text style={styles.title}>This result form is not available yet.</Text>
      </Page>
    );
  }

  const selectionFeedback = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  const pickDate = (nextDate: string) => {
    selectionFeedback();
    setDate(nextDate);
    setError('');
  };

  const handleReview = () => {
    if (metricId === 'blood_pressure') {
      const result = validateBloodPressureInput({ systolic, diastolic, date });
      if (!result.valid) {
        setError(result.error);
        return;
      }
      setError('');
      setReview(true);
      return;
    }

    const result = validateMeasurementInput({ metricId, value, unit, date }, undefined, supportedUnits);
    if (!result.valid) {
      setError(result.error);
      return;
    }

    setError('');
    setReview(true);
  };

  const saveResult = async () => {
    if (!session) return;

    setSaving(true);
    setError('');
    try {
      if (metricId === 'blood_pressure') {
        const pressure = validateBloodPressureInput({ systolic, diastolic, date });
        if (!pressure.valid) {
          setError(pressure.error);
          return;
        }
        await saveCompositeMeasurement(metricId, pressure.componentValues, `${date}T00:00:00+00:00`);
      } else {
        const numericValue = validateMeasurementInput({ metricId, value, unit, date }, undefined, supportedUnits);
        if (!numericValue.valid) {
          setError(numericValue.error);
          return;
        }
        await saveMeasurement(metricId, numericValue.numericValue, unit, `${date}T00:00:00+00:00`, metricId === 'glucose' ? { timing: glucoseTiming } : {});
      }
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The result could not be saved.');
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Stack.Screen options={{ title: review ? 'Review result' : `Add ${definition.name} result`, headerShown: true }} />
      <PreviewNotice />

      <Text style={styles.eyebrow}>{review ? 'Review your entry' : 'Add a result'}</Text>
      <Text style={styles.title}>{review ? 'Review result' : definition.name}</Text>
      <Text style={styles.description}>{review ? 'Check these details before saving the result to your health record.' : definition.explanation}</Text>

      {review ? (
        <View style={styles.reviewCard}>
          {metricId === 'blood_pressure' ? <>
            <Text style={styles.fieldLabel}>Blood pressure</Text>
            <Text style={styles.reviewValue}>{systolic.trim()} <Text style={styles.reviewUnit}>/</Text> {diastolic.trim()} <Text style={styles.reviewUnit}>mm Hg</Text></Text>
          </> : <>
            <Text style={styles.fieldLabel}>{definition.fieldLabel}</Text>
            <Text style={styles.reviewValue}>{value.trim().replace(',', '.')} <Text style={styles.reviewUnit}>{unit}</Text></Text>
          </>}
          {metricId === 'glucose' ? <Text style={styles.helper}>Context: {glucoseTiming.replaceAll('_', ' ')}</Text> : null}
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>Test date</Text>
          <Text style={styles.reviewDate}>{date}</Text>
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{session ? 'Private health record' : 'Sign in to save'}</Text>
            <Text style={styles.noticeCopy}>
              {session
                ? 'This result will be saved to your account. You can choose whether to share it with a clinician.'
                : 'Your entry stays on this screen. Sign in or create an account to save it to your health record.'}
            </Text>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={() => {
              if (session) void saveResult();
              else router.push('/auth');
            }}
            style={({ pressed }) => [styles.primaryButton, saving && styles.buttonDisabled, pressed && !saving && styles.buttonPressed]}>
            {session ? <Check color={palette.paper} size={18} /> : null}
            <Text style={styles.primaryLabel}>{saving ? 'Saving…' : session ? 'Save result' : 'Sign in to save'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          {unitLoadError ? <Text accessibilityRole="alert" style={styles.unitLoadNotice}>{unitLoadError}</Text> : null}
          {metricId === 'blood_pressure' ? <>
            <Text style={styles.fieldLabel}>Systolic (upper number)</Text>
            <View style={styles.valueRow}><TextInput accessibilityLabel="Systolic blood pressure" keyboardType="number-pad" onChangeText={(nextValue) => { setSystolic(nextValue); setError(''); }} placeholder="120" placeholderTextColor="#8C8272" style={styles.valueInput} value={systolic} /><View style={styles.fixedUnit}><Text style={styles.fixedUnitText}>mm Hg</Text></View></View>
            <Text style={styles.fieldLabel}>Diastolic (lower number)</Text>
            <View style={styles.valueRow}><TextInput accessibilityLabel="Diastolic blood pressure" keyboardType="number-pad" onChangeText={(nextValue) => { setDiastolic(nextValue); setError(''); }} placeholder="80" placeholderTextColor="#8C8272" style={styles.valueInput} value={diastolic} /><View style={styles.fixedUnit}><Text style={styles.fixedUnitText}>mm Hg</Text></View></View>
          </> : <>
            <Text style={styles.fieldLabel}>{definition.fieldLabel}</Text>
            <View style={styles.valueRow}>
              <TextInput accessibilityLabel={definition.fieldLabel} keyboardType="decimal-pad" onChangeText={(nextValue) => { setValue(nextValue); setError(''); }} placeholder="Enter result" placeholderTextColor="#8C8272" style={styles.valueInput} value={value} />
              {supportedUnits.length === 1 ? <View style={styles.fixedUnit}><Text style={styles.fixedUnitText}>{supportedUnits[0]}</Text></View> : null}
            </View>
          </>}

          {metricId === 'glucose' ? <>
            <Text style={styles.fieldLabel}>When was the test taken?</Text>
            <View style={styles.unitOptions}>{[['unspecified', 'Not specified'], ['fasting', 'Fasting'], ['postprandial_1_2h', '1-2h after meal'], ['random', 'Other time']].map(([option, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: glucoseTiming === option }} key={option} onPress={() => { selectionFeedback(); setGlucoseTiming(option); }} style={[styles.unitOption, glucoseTiming === option && styles.unitOptionSelected]}><Text style={[styles.unitOptionText, glucoseTiming === option && styles.unitOptionTextSelected]}>{label}</Text></Pressable>)}</View>
          </> : null}

          {supportedUnits.length > 1 ? (
            <>
              <Text style={styles.fieldLabel}>Unit shown on your test</Text>
              <View style={styles.unitOptions}>
                {supportedUnits.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: unit === option }}
                    key={option}
                    onPress={() => {
                      selectionFeedback();
                      setUnit(option);
                      setError('');
                    }}
                    style={[styles.unitOption, unit === option && styles.unitOptionSelected]}>
                    <Text style={[styles.unitOptionText, unit === option && styles.unitOptionTextSelected]}>{option}</Text>
                    {unit === option ? <Check color={palette.forest} size={15} /> : null}
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Test date</Text>
          <View style={styles.dateChips}>
            {[['Today', 0], ['Yesterday', 1]].map(([label, offset]) => {
              const chipDate = localDateString(new Date(Date.now() - Number(offset) * 86400000));
              const selected = date === chipDate;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={label}
                  onPress={() => { pickDate(chipDate); }}
                  style={[styles.unitOption, styles.dateChip, selected && styles.unitOptionSelected]}>
                  <Text style={[styles.unitOptionText, selected && styles.unitOptionTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.dateInputWrap}>
            <TextInput
              accessibilityLabel="Test date in year-month-day format"
              onChangeText={(nextDate) => {
                setDate(nextDate);
                setError('');
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#8C8272"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={styles.dateInput}
              value={date}
            />
          </View>
          <Text style={styles.helper}>Or type the date the test was performed, as YYYY-MM-DD.</Text>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable accessibilityRole="button" onPress={handleReview} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.primaryLabel}>Review result</Text>
          </Pressable>
          <Text style={styles.formFooter}>Clinical ranges and interpretation will appear only after clinician-approved metric guidance is published.</Text>
        </View>
      )}
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  eyebrow: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 9,
    marginTop: 4,
  },
  title: {
    ...display,
    color: palette.ink,
    fontSize: 32,
    lineHeight: 38,
  },
  description: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 500,
  },
  form: {
    marginTop: 26,
  },
  fieldLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 19,
  },
  valueRow: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 18,
  },
  valueInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 34,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    minHeight: 72,
    paddingVertical: 8,
  },
  fixedUnit: {
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fixedUnitText: {
    color: palette.forest,
    fontSize: 12,
    fontWeight: '700',
  },
  unitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  dateChips: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 9,
  },
  dateChip: {
    flex: 1,
    minWidth: 0,
  },
  unitOption: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 110,
    paddingHorizontal: 13,
  },
  unitOptionSelected: {
    backgroundColor: palette.leaf,
    borderColor: palette.leafDeep,
  },
  unitOptionText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  unitOptionTextSelected: {
    color: palette.forest,
  },
  dateInputWrap: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  dateInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
  },
  helper: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  error: {
    backgroundColor: palette.dangerBg,
    borderCurve: 'continuous',
    borderRadius: 12,
    color: palette.dangerText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
    padding: 12,
  },
  unitLoadNotice: {
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: 12,
    color: palette.forest,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
    padding: 12,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: palette.forest,
    borderCurve: 'continuous',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 23,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryLabel: {
    color: palette.paper,
    fontSize: 16,
    fontWeight: '600',
  },
  formFooter: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 11,
    maxWidth: 360,
  },
  reviewCard: {
    ...glassSurface(),
    
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    padding: 19,
  },
  reviewValue: {
    color: palette.ink,
    fontSize: 29,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  reviewUnit: {
    color: palette.forest,
    fontFamily: 'System',
    fontSize: 15,
  },
  divider: {
    backgroundColor: palette.line,
    height: 1,
    marginTop: 19,
  },
  reviewDate: {
    color: palette.ink,
    fontSize: 15,
  },
  noticeBox: {
    backgroundColor: palette.successBg,
    borderRadius: 6,
    marginTop: 22,
    padding: 13,
  },
  noticeTitle: {
    color: palette.forest,
    fontSize: 12,
    fontWeight: '700',
  },
  noticeCopy: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
}));