import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { isMetricId, localDateString, metricDefinitions, validateBloodPressureInput, validateMeasurementInput } from '@/features/health/metric-input';
import { getMetricSupportedUnits, saveCompositeMeasurement, saveMeasurement } from '@/features/health/measurement-repository';
import { Page, PreviewNotice } from '@/ui/patient-ui';
import { palette } from '@/ui/palette';

export default function MeasurementEntryScreen() {
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
    }).catch(() => undefined);
    return () => { active = false; };
  }, [isSupported, metricId, session]);

  if (!definition || !isSupported) {
    return (
      <Page>
        <Stack.Screen options={{ title: 'Metric unavailable' }} />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={palette.ink} size={19} />
          <Text style={styles.backLabel}>Health</Text>
        </Pressable>
        <Text style={styles.title}>This result form is not available yet.</Text>
      </Page>
    );
  }

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

  return (
    <Page>
      <Stack.Screen options={{ title: review ? 'Review result' : `Add ${definition.name} result` }} />
      <Pressable accessibilityRole="button" onPress={() => (review ? setReview(false) : router.back())} style={styles.backButton}>
        <ArrowLeft color={palette.ink} size={19} />
        <Text style={styles.backLabel}>{review ? 'Edit result' : 'Health'}</Text>
      </Pressable>
      <PreviewNotice />

      <Text style={styles.eyebrow}>{review ? 'CHECK YOUR ENTRY' : 'ADD A RESULT'}</Text>
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
            <Text style={styles.noticeTitle}>Signed-in record</Text>
            <Text style={styles.noticeCopy}>
              {session
                ? 'This result will be saved under your authenticated profile in the current Supabase project.'
                : 'You need to sign in before saving a result.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={saving || !session}
            onPress={async () => {
              if (!session) {
                router.push('/auth');
                return;
              }

              try {
                setSaving(true);
                setError('');
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
                router.back();
              } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : 'The result could not be saved.');
              } finally {
                setSaving(false);
              }
            }}
            style={[styles.primaryButton, (saving || !session) && styles.buttonDisabled]}>
            <Check color={palette.white} size={18} />
            <Text style={styles.primaryLabel}>{saving ? 'Saving…' : 'Save result'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          {metricId === 'blood_pressure' ? <>
            <Text style={styles.fieldLabel}>Systolic (upper number)</Text>
            <View style={styles.valueRow}><TextInput accessibilityLabel="Systolic blood pressure" keyboardType="number-pad" onChangeText={setSystolic} placeholder="120" placeholderTextColor="#8A958E" style={styles.valueInput} value={systolic} /><View style={styles.fixedUnit}><Text style={styles.fixedUnitText}>mm Hg</Text></View></View>
            <Text style={styles.fieldLabel}>Diastolic (lower number)</Text>
            <View style={styles.valueRow}><TextInput accessibilityLabel="Diastolic blood pressure" keyboardType="number-pad" onChangeText={setDiastolic} placeholder="80" placeholderTextColor="#8A958E" style={styles.valueInput} value={diastolic} /><View style={styles.fixedUnit}><Text style={styles.fixedUnitText}>mm Hg</Text></View></View>
          </> : <>
            <Text style={styles.fieldLabel}>{definition.fieldLabel}</Text>
            <View style={styles.valueRow}>
              <TextInput accessibilityLabel={definition.fieldLabel} keyboardType="decimal-pad" onChangeText={(nextValue) => { setValue(nextValue); setError(''); }} placeholder="Enter result" placeholderTextColor="#8A958E" style={styles.valueInput} value={value} />
              {supportedUnits.length === 1 ? <View style={styles.fixedUnit}><Text style={styles.fixedUnitText}>{supportedUnits[0]}</Text></View> : null}
            </View>
          </>}

          {metricId === 'glucose' ? <>
            <Text style={styles.fieldLabel}>When was the test taken?</Text>
            <View style={styles.unitOptions}>{[['unspecified', 'Not specified'], ['fasting', 'Fasting'], ['postprandial_1_2h', '1-2h after meal'], ['random', 'Other time']].map(([option, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: glucoseTiming === option }} key={option} onPress={() => setGlucoseTiming(option)} style={[styles.unitOption, glucoseTiming === option && styles.unitOptionSelected]}><Text style={[styles.unitOptionText, glucoseTiming === option && styles.unitOptionTextSelected]}>{label}</Text></Pressable>)}</View>
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
          <View style={styles.dateInputWrap}>
            <TextInput
              accessibilityLabel="Test date in year-month-day format"
              onChangeText={(nextDate) => {
                setDate(nextDate);
                setError('');
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#8A958E"
              style={styles.dateInput}
              value={date}
            />
            <ChevronDown color={palette.muted} size={17} />
          </View>
          <Text style={styles.helper}>Use the date the test was performed, in YYYY-MM-DD format.</Text>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable accessibilityRole="button" onPress={handleReview} style={styles.primaryButton}>
            <Text style={styles.primaryLabel}>Review result</Text>
          </Pressable>
          <Text style={styles.formFooter}>Clinical ranges and interpretation will appear only after clinician-approved metric guidance is published.</Text>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 18,
    minHeight: 36,
  },
  backLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  eyebrow: {
    color: palette.coral,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 9,
    marginTop: 4,
  },
  title: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 31,
    lineHeight: 37,
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
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 15,
  },
  valueInput: {
    color: palette.ink,
    flex: 1,
    fontFamily: 'Georgia',
    fontSize: 23,
    minHeight: 52,
    paddingVertical: 8,
  },
  fixedUnit: {
    backgroundColor: '#EDF1EC',
    borderRadius: 5,
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
    gap: 9,
  },
  unitOption: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 43,
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
    borderRadius: 7,
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
    color: '#A83B28',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.forest,
    borderRadius: 7,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 23,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryLabel: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  formFooter: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 11,
    maxWidth: 360,
  },
  reviewCard: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 24,
    padding: 19,
  },
  reviewValue: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 29,
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
    backgroundColor: '#EDF2EA',
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
});